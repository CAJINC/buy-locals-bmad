import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { success, badRequest, notFound, unauthorized, internalServerError } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { ReceiptService } from '../../services/receiptService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface DownloadReceiptResponse {
  receiptId: string;
  receiptNumber: string;
  fileName: string;
  contentType: string;
  downloadUrl: string;
  expiresAt: string;
  content?: string; // Base64 encoded content for small files
}

/**
 * Download Receipt Lambda Handler
 * 
 * Provides secure download links for receipts with proper authorization.
 * Supports both direct content delivery and pre-signed URLs for larger files.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract receipt ID from path parameters
    const receiptId = event.pathParameters?.receiptId;
    const format = event.queryStringParameters?.format || 'pdf';
    const language = event.queryStringParameters?.language || 'en';
    
    if (!receiptId) {
      return badRequest('Receipt ID is required');
    }

    // Validate format parameter
    if (!['pdf', 'html', 'text'].includes(format)) {
      return badRequest('Invalid format. Must be pdf, html, or text');
    }

    // Validate language parameter
    if (!['en', 'es', 'fr'].includes(language)) {
      return badRequest('Invalid language. Must be en, es, or fr');
    }

    // Extract user from JWT token (optional for public receipt links)
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    // Check for public access token in query parameters
    const publicToken = event.queryStringParameters?.token;
    
    // Query receipt details with transaction and authorization info
    const receiptQuery = `
      SELECT 
        r.id as receipt_id,
        r.receipt_number,
        r.transaction_id,
        r.business_id,
        r.customer_id,
        r.format as stored_format,
        r.language as stored_language,
        r.download_url,
        r.created_at,
        r.public_access_token,
        r.expires_at,
        -- Transaction details
        pt.amount,
        pt.currency,
        pt.status,
        -- Business details  
        b.name as business_name,
        b.owner_id as business_owner_id,
        -- Customer details
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name
      FROM receipts r
      INNER JOIN payment_transactions pt ON r.transaction_id = pt.id
      INNER JOIN businesses b ON r.business_id = b.id
      INNER JOIN users u ON r.customer_id = u.id
      WHERE r.id = $1 OR r.receipt_number = $1
    `;
    
    const receiptResult = await pool.query(receiptQuery, [receiptId]);
    
    if (receiptResult.rows.length === 0) {
      return notFound('Receipt not found');
    }

    const receipt = receiptResult.rows[0];
    
    // Authorization check
    let authorized = false;
    let authMethod = 'none';
    
    // Check public token access
    if (publicToken && receipt.public_access_token === publicToken) {
      // Check if public link has expired
      if (receipt.expires_at && new Date() > receipt.expires_at) {
        return unauthorized('Download link has expired');
      }
      authorized = true;
      authMethod = 'public_token';
    }
    
    // Check authenticated user access
    if (!authorized && userId) {
      const isCustomer = receipt.customer_id === userId;
      const isBusinessOwner = receipt.business_owner_id === userId;
      const isAdmin = userRole === 'admin';
      
      if (isCustomer || isBusinessOwner || isAdmin) {
        authorized = true;
        authMethod = isCustomer ? 'customer' : isBusinessOwner ? 'business_owner' : 'admin';
      }
    }

    if (!authorized) {
      await auditLogger({
        operation: 'receipt_download',
        entityType: 'receipt',
        entityId: receipt.receipt_id,
        userId: userId || 'anonymous',
        businessId: receipt.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to download this receipt');
    }

    // Check if we need to generate the receipt in the requested format/language
    const needsGeneration = 
      !receipt.download_url || 
      receipt.stored_format !== format || 
      receipt.stored_language !== language;

    let downloadUrl = receipt.download_url;
    let fileName = `receipt-${receipt.receipt_number}.${format}`;
    let content: string | undefined;

    if (needsGeneration) {
      // Get transaction data to regenerate receipt
      const transactionData = await getTransactionDataForReceipt(receipt.transaction_id);
      
      if (!transactionData) {
        return internalServerError('Unable to retrieve transaction data for receipt generation');
      }

      // Generate receipt in requested format
      const receiptService = new ReceiptService();
      const generationResult = await receiptService.generateReceipt(transactionData, {
        format: format as any,
        language: language as any,
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: transactionData.status !== 'paid'
      });

      if (!generationResult.success) {
        logger.error('Receipt generation failed for download', {
          receiptId: receipt.receipt_id,
          format,
          language,
          error: generationResult.error,
          correlationId
        });
        return internalServerError('Failed to generate receipt for download');
      }

      downloadUrl = generationResult.downloadUrl;
      
      // For small text receipts, include content directly in response
      if (format === 'text' && generationResult.content) {
        content = Buffer.from(generationResult.content as string).toString('base64');
      }

      // Update receipt record with new download URL
      await updateReceiptDownloadUrl(receipt.receipt_id, downloadUrl, format, language);
    }

    // Generate pre-signed URL with expiration for security
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // For PDF and HTML, generate secure download URL
    if (downloadUrl && (format === 'pdf' || format === 'html')) {
      downloadUrl = await generateSecureDownloadUrl(downloadUrl, expiresAt);
    }

    // Log download access
    await logReceiptAccess({
      receiptId: receipt.receipt_id,
      userId: userId || 'anonymous',
      authMethod,
      format,
      language,
      ipAddress: event.requestContext.identity?.sourceIp || 'unknown',
      userAgent: event.headers['User-Agent'] || 'unknown',
      correlationId
    });

    // Audit log success
    await auditLogger({
      operation: 'receipt_download',
      entityType: 'receipt',
      entityId: receipt.receipt_id,
      userId: userId || 'anonymous',
      businessId: receipt.business_id,
      correlationId,
      success: true,
      metadata: {
        authMethod,
        format,
        language,
        regenerated: needsGeneration
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Receipt download prepared successfully', {
      receiptId: receipt.receipt_id,
      receiptNumber: receipt.receipt_number,
      format,
      language,
      authMethod,
      userId: userId || 'anonymous',
      regenerated: needsGeneration,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: DownloadReceiptResponse = {
      receiptId: receipt.receipt_id,
      receiptNumber: receipt.receipt_number,
      fileName,
      contentType: getContentType(format),
      downloadUrl: downloadUrl || '',
      expiresAt: expiresAt.toISOString(),
      content
    };

    return success(response, 'Receipt download link generated successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in download receipt', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId || 'anonymous',
      receiptId: event.pathParameters?.receiptId
    });

    await auditLogger({
      operation: 'receipt_download',
      entityType: 'receipt',
      entityId: event.pathParameters?.receiptId || '',
      userId: event.requestContext.authorizer?.userId || 'anonymous',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred while preparing the receipt download. Please try again or contact support.');
  }
};

// Helper functions

async function getTransactionDataForReceipt(transactionId: string): Promise<any> {
  try {
    const query = `
      SELECT 
        pt.id,
        pt.payment_intent_id,
        pt.business_id,
        pt.user_id as customer_id,
        pt.amount,
        pt.currency,
        pt.platform_fee,
        pt.business_amount,
        pt.tax_amount,
        pt.tax_rate,
        pt.status,
        pt.created_at,
        pt.refunded_at,
        pt.refund_amount,
        pt.metadata,
        -- Business details
        b.name as business_name,
        b.email as business_email,
        b.phone as business_phone,
        b.address as business_address,
        b.city as business_city,
        b.state as business_state,
        b.postal_code as business_postal_code,
        b.logo_url as business_logo_url,
        b.primary_color,
        b.secondary_color,
        -- Customer details
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      WHERE pt.id = $1
    `;
    
    const result = await pool.query(query, [transactionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const transaction = result.rows[0];

    // Get transaction items
    const itemsQuery = `
      SELECT id, name, description, quantity, unit_price, total_price,
             tax_rate, tax_amount, category
      FROM transaction_items 
      WHERE transaction_id = $1
      ORDER BY created_at
    `;
    
    const itemsResult = await pool.query(itemsQuery, [transactionId]);

    // Build receipt data structure
    return {
      id: uuidv4(),
      receiptNumber: generateReceiptNumber(transaction.business_id),
      transactionId: transaction.id,
      paymentIntentId: transaction.payment_intent_id,
      businessId: transaction.business_id,
      customerId: transaction.customer_id,
      amount: transaction.amount,
      currency: transaction.currency,
      platformFee: transaction.platform_fee || 0,
      businessPayout: transaction.business_amount || 0,
      taxAmount: transaction.tax_amount || 0,
      taxRate: transaction.tax_rate || 0,
      status: mapTransactionStatusToReceiptStatus(transaction.status),
      createdAt: transaction.created_at,
      refundedAt: transaction.refunded_at,
      refundAmount: transaction.refund_amount,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        taxRate: item.tax_rate || 0,
        taxAmount: item.tax_amount || 0,
        category: item.category
      })),
      business: {
        id: transaction.business_id,
        name: transaction.business_name,
        email: transaction.business_email,
        phone: transaction.business_phone,
        address: transaction.business_address,
        city: transaction.business_city,
        state: transaction.business_state,
        postalCode: transaction.business_postal_code,
        logoUrl: transaction.business_logo_url
      },
      customer: {
        id: transaction.customer_id,
        email: transaction.customer_email,
        profile: {
          firstName: transaction.customer_first_name,
          lastName: transaction.customer_last_name,
          phone: transaction.customer_phone
        }
      },
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined
    };
  } catch (error) {
    logger.error('Failed to get transaction data for receipt', { error, transactionId });
    return null;
  }
}

function generateReceiptNumber(businessId: string): string {
  const year = new Date().getFullYear();
  const businessPrefix = businessId.substring(0, 4).toUpperCase();
  const randomSuffix = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `${businessPrefix}-${year}-${randomSuffix}`;
}

function mapTransactionStatusToReceiptStatus(status: string): 'paid' | 'refunded' | 'partially_refunded' | 'disputed' {
  switch (status) {
    case 'paid':
    case 'completed':
      return 'paid';
    case 'refunded':
      return 'refunded';
    case 'partially_refunded':
      return 'partially_refunded';
    case 'disputed':
      return 'disputed';
    default:
      return 'paid';
  }
}

async function updateReceiptDownloadUrl(
  receiptId: string, 
  downloadUrl: string, 
  format: string, 
  language: string
): Promise<void> {
  try {
    const updateQuery = `
      UPDATE receipts 
      SET download_url = $1, format = $2, language = $3, updated_at = NOW()
      WHERE id = $4
    `;
    
    await pool.query(updateQuery, [downloadUrl, format, language, receiptId]);
  } catch (error) {
    logger.error('Failed to update receipt download URL', { error, receiptId, downloadUrl });
  }
}

async function generateSecureDownloadUrl(originalUrl: string, expiresAt: Date): Promise<string> {
  try {
    // In a real implementation, this would generate a pre-signed URL using AWS S3 or similar
    // For now, return the original URL with a secure token parameter
    const secureToken = Buffer.from(`${originalUrl}:${expiresAt.getTime()}`).toString('base64');
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}token=${secureToken}&expires=${expiresAt.getTime()}`;
  } catch (error) {
    logger.error('Failed to generate secure download URL', { error, originalUrl });
    return originalUrl;
  }
}

function getContentType(format: string): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'html':
      return 'text/html';
    case 'text':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

async function logReceiptAccess(log: {
  receiptId: string;
  userId: string;
  authMethod: string;
  format: string;
  language: string;
  ipAddress: string;
  userAgent: string;
  correlationId: string;
}): Promise<void> {
  try {
    const insertQuery = `
      INSERT INTO receipt_access_log (
        id, receipt_id, user_id, auth_method, format, language,
        ip_address, user_agent, accessed_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
    `;

    await pool.query(insertQuery, [
      uuidv4(),
      log.receiptId,
      log.userId,
      log.authMethod,
      log.format,
      log.language,
      log.ipAddress,
      log.userAgent,
      log.correlationId
    ]);
  } catch (error) {
    logger.error('Failed to log receipt access', { error, log });
  }
}