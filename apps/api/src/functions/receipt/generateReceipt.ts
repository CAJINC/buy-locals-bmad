import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, notFound, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { ReceiptData, ReceiptGenerationOptions, ReceiptService } from '../../services/receiptService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';

interface GenerateReceiptRequest {
  transactionId: string;
  format: 'pdf' | 'html' | 'text';
  language?: 'en' | 'es' | 'fr';
  includeQrCode?: boolean;
  includeTaxBreakdown?: boolean;
  includeRefundInfo?: boolean;
}

interface GenerateReceiptResponse {
  receiptId: string;
  receiptNumber: string;
  format: string;
  content?: string; // Base64 encoded for binary formats or HTML/text content
  downloadUrl?: string;
  generatedAt: string;
}

// Validation schema for generate receipt request
const generateReceiptSchema = {
  type: 'object',
  required: ['transactionId', 'format'],
  properties: {
    transactionId: {
      type: 'string',
      format: 'uuid'
    },
    format: {
      type: 'string',
      enum: ['pdf', 'html', 'text']
    },
    language: {
      type: 'string',
      enum: ['en', 'es', 'fr']
    },
    includeQrCode: {
      type: 'boolean'
    },
    includeTaxBreakdown: {
      type: 'boolean'
    },
    includeRefundInfo: {
      type: 'boolean'
    }
  },
  additionalProperties: false
};

/**
 * Generate Receipt Lambda Handler
 * 
 * Generates a receipt in the requested format for a completed transaction.
 * Supports PDF, HTML, and text formats with multi-language support.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: GenerateReceiptRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'receipt_generate',
        entityType: 'receipt',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Parse and validate request body
    if (!event.body) {
      return badRequest('Request body is required');
    }

    try {
      requestBody = JSON.parse(event.body) as GenerateReceiptRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(generateReceiptSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Query transaction details with business and customer info
    const transactionQuery = `
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
        u.phone as customer_phone,
        -- Receipt details
        r.id as existing_receipt_id,
        r.receipt_number
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      LEFT JOIN receipts r ON pt.id = r.transaction_id
      WHERE pt.id = $1 AND pt.status IN ('paid', 'refunded', 'partially_refunded')
    `;
    
    const transactionResult = await pool.query(transactionQuery, [requestBody.transactionId]);
    
    if (transactionResult.rows.length === 0) {
      return notFound('Transaction not found or not eligible for receipt generation');
    }

    const transaction = transactionResult.rows[0];
    
    // Authorization check - user must be customer, business owner, or admin
    const isCustomer = transaction.customer_id === userId;
    const isBusinessOwner = await checkBusinessOwnership(transaction.business_id, userId);
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'receipt_generate',
        entityType: 'receipt',
        entityId: '',
        userId,
        businessId: transaction.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to generate this receipt');
    }

    // Get transaction items
    const itemsQuery = `
      SELECT 
        id,
        name,
        description,
        quantity,
        unit_price,
        total_price,
        tax_rate,
        tax_amount,
        category
      FROM transaction_items 
      WHERE transaction_id = $1
      ORDER BY created_at
    `;
    
    const itemsResult = await pool.query(itemsQuery, [requestBody.transactionId]);

    // Build receipt data
    const receiptData: ReceiptData = {
      id: transaction.existing_receipt_id || uuidv4(),
      receiptNumber: transaction.receipt_number || generateReceiptNumber(transaction.business_id),
      transactionId: requestBody.transactionId,
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
      } as any, // Cast as any for Business type compatibility
      customer: {
        id: transaction.customer_id,
        email: transaction.customer_email,
        profile: {
          firstName: transaction.customer_first_name,
          lastName: transaction.customer_last_name,
          phone: transaction.customer_phone
        }
      } as any, // Cast as any for User type compatibility
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined
    };

    // Configure receipt generation options
    const options: ReceiptGenerationOptions = {
      format: requestBody.format,
      language: requestBody.language || 'en',
      includeQrCode: requestBody.includeQrCode ?? true,
      includeTaxBreakdown: requestBody.includeTaxBreakdown ?? true,
      includeRefundInfo: requestBody.includeRefundInfo ?? (receiptData.status !== 'paid'),
      branding: transaction.primary_color ? {
        primaryColor: transaction.primary_color,
        secondaryColor: transaction.secondary_color || '#64748b',
        fontFamily: 'Inter, system-ui, -apple-system',
        logoUrl: transaction.business_logo_url
      } : undefined
    };

    // Generate receipt using receipt service
    const receiptService = new ReceiptService();
    const generationResult = await receiptService.generateReceipt(receiptData, options);

    if (!generationResult.success) {
      logger.error('Receipt generation failed', {
        transactionId: requestBody.transactionId,
        format: requestBody.format,
        error: generationResult.error,
        correlationId
      });
      return internalServerError(`Receipt generation failed: ${generationResult.error}`);
    }

    // Store receipt record if not exists
    if (!transaction.existing_receipt_id) {
      await storeReceiptRecord({
        receiptId: receiptData.id,
        receiptNumber: receiptData.receiptNumber,
        transactionId: requestBody.transactionId,
        businessId: transaction.business_id,
        customerId: transaction.customer_id,
        format: requestBody.format,
        language: options.language,
        downloadUrl: generationResult.downloadUrl,
        generatedAt: new Date(),
        correlationId
      });
    }

    // Audit log success
    await auditLogger({
      operation: 'receipt_generate',
      entityType: 'receipt',
      entityId: receiptData.id,
      userId,
      businessId: transaction.business_id,
      correlationId,
      success: true,
      metadata: {
        transactionId: requestBody.transactionId,
        format: requestBody.format,
        language: options.language
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Receipt generated successfully', {
      receiptId: receiptData.id,
      receiptNumber: receiptData.receiptNumber,
      transactionId: requestBody.transactionId,
      format: requestBody.format,
      userId,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: GenerateReceiptResponse = {
      receiptId: receiptData.id,
      receiptNumber: receiptData.receiptNumber,
      format: requestBody.format,
      content: requestBody.format === 'pdf' 
        ? undefined 
        : typeof generationResult.content === 'string' 
          ? generationResult.content 
          : Buffer.from(generationResult.content!).toString('base64'),
      downloadUrl: generationResult.downloadUrl,
      generatedAt: generationResult.generatedAt.toISOString()
    };

    return success(response, 'Receipt generated successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in generate receipt', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse'
    });

    await auditLogger({
      operation: 'receipt_generate',
      entityType: 'receipt',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred while generating the receipt. Please try again or contact support.');
  }
};

// Helper functions

async function checkBusinessOwnership(businessId: string, userId: string): Promise<boolean> {
  try {
    const ownershipQuery = `
      SELECT 1 FROM businesses 
      WHERE id = $1 AND owner_id = $2
    `;
    const result = await pool.query(ownershipQuery, [businessId, userId]);
    return result.rows.length > 0;
  } catch {
    return false;
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

async function storeReceiptRecord(record: {
  receiptId: string;
  receiptNumber: string;
  transactionId: string;
  businessId: string;
  customerId: string;
  format: string;
  language: string;
  downloadUrl?: string;
  generatedAt: Date;
  correlationId: string;
}): Promise<void> {
  const insertQuery = `
    INSERT INTO receipts (
      id, receipt_number, transaction_id, business_id, customer_id,
      format, language, download_url, generated_at, created_at, correlation_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    ON CONFLICT (id) DO NOTHING
  `;

  await pool.query(insertQuery, [
    record.receiptId,
    record.receiptNumber,
    record.transactionId,
    record.businessId,
    record.customerId,
    record.format,
    record.language,
    record.downloadUrl,
    record.generatedAt,
    record.correlationId
  ]);
}