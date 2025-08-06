import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  badRequest,
  internalServerError,
  notFound,
  success,
  unauthorized,
} from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { EmailReceiptOptions, ReceiptData, ReceiptService } from '../../services/receiptService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';

interface EmailReceiptRequest {
  transactionId: string;
  recipientEmail: string;
  ccEmails?: string[];
  bccEmails?: string[];
  customSubject?: string;
  customMessage?: string;
  language?: 'en' | 'es' | 'fr';
  attachPdf?: boolean;
  sendToCustomer?: boolean;
  sendToBusiness?: boolean;
}

interface EmailReceiptResponse {
  success: boolean;
  messageId?: string;
  recipientEmail: string;
  deliveredAt: string;
  receiptNumber: string;
}

// Validation schema for email receipt request
const emailReceiptSchema = {
  type: 'object',
  required: ['transactionId', 'recipientEmail'],
  properties: {
    transactionId: {
      type: 'string',
      format: 'uuid',
    },
    recipientEmail: {
      type: 'string',
      format: 'email',
    },
    ccEmails: {
      type: 'array',
      items: {
        type: 'string',
        format: 'email',
      },
      maxItems: 5,
    },
    bccEmails: {
      type: 'array',
      items: {
        type: 'string',
        format: 'email',
      },
      maxItems: 5,
    },
    customSubject: {
      type: 'string',
      maxLength: 200,
    },
    customMessage: {
      type: 'string',
      maxLength: 1000,
    },
    language: {
      type: 'string',
      enum: ['en', 'es', 'fr'],
    },
    attachPdf: {
      type: 'boolean',
    },
    sendToCustomer: {
      type: 'boolean',
    },
    sendToBusiness: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
};

/**
 * Email Receipt Lambda Handler
 *
 * Sends a receipt via email to specified recipients with customizable options.
 * Supports HTML email with optional PDF attachment and multi-language templates.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: EmailReceiptRequest;

  try {
    // Security headers and input sanitization
    sanitizeInput(event);

    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;

    if (!userId) {
      await auditLogger({
        operation: 'receipt_email',
        entityType: 'receipt',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication',
      });
      return unauthorized('Authentication required');
    }

    // Parse and validate request body
    if (!event.body) {
      return badRequest('Request body is required');
    }

    try {
      requestBody = JSON.parse(event.body) as EmailReceiptRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(emailReceiptSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Rate limiting check - prevent email spam
    const emailRateLimit = await checkEmailRateLimit(userId, requestBody.transactionId);
    if (!emailRateLimit.allowed) {
      return badRequest(
        `Email rate limit exceeded. Please wait ${emailRateLimit.waitTimeMinutes} minutes before sending another receipt.`
      );
    }

    // Query transaction details with full context
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
        b.owner_id as business_owner_id,
        -- Customer details
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        -- Receipt details
        r.id as receipt_id,
        r.receipt_number
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      LEFT JOIN receipts r ON pt.id = r.transaction_id
      WHERE pt.id = $1 AND pt.status IN ('paid', 'refunded', 'partially_refunded')
    `;

    const transactionResult = await pool.query(transactionQuery, [requestBody.transactionId]);

    if (transactionResult.rows.length === 0) {
      return notFound('Transaction not found or not eligible for receipt email');
    }

    const transaction = transactionResult.rows[0];

    // Authorization check - user must be customer, business owner, or admin
    const isCustomer = transaction.customer_id === userId;
    const isBusinessOwner = transaction.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'receipt_email',
        entityType: 'receipt',
        entityId: transaction.receipt_id || '',
        userId,
        businessId: transaction.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions',
      });
      return unauthorized('You do not have permission to email this receipt');
    }

    // Additional validation for customer/business email restrictions
    if (
      isCustomer &&
      !requestBody.sendToCustomer &&
      requestBody.recipientEmail !== transaction.customer_email
    ) {
      return unauthorized('Customers can only send receipts to their own email address');
    }

    // Get transaction items
    const itemsQuery = `
      SELECT 
        id, name, description, quantity, unit_price, total_price,
        tax_rate, tax_amount, category
      FROM transaction_items 
      WHERE transaction_id = $1
      ORDER BY created_at
    `;

    const itemsResult = await pool.query(itemsQuery, [requestBody.transactionId]);

    // Build receipt data
    const receiptData: ReceiptData = {
      id: transaction.receipt_id || uuidv4(),
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
        category: item.category,
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
        logoUrl: transaction.business_logo_url,
      } as any,
      customer: {
        id: transaction.customer_id,
        email: transaction.customer_email,
        profile: {
          firstName: transaction.customer_first_name,
          lastName: transaction.customer_last_name,
          phone: transaction.customer_phone,
        },
      } as any,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined,
    };

    // Configure email options
    const emailOptions: EmailReceiptOptions = {
      to: requestBody.recipientEmail,
      cc: requestBody.ccEmails,
      bcc: requestBody.bccEmails,
      subject: requestBody.customSubject,
      customMessage: requestBody.customMessage,
      language: requestBody.language || 'en',
      attachPdf: requestBody.attachPdf ?? false,
    };

    // Send email using receipt service
    const receiptService = new ReceiptService();
    const emailResult = await receiptService.emailReceipt(receiptData, emailOptions);

    if (!emailResult.success) {
      logger.error('Receipt email failed', {
        transactionId: requestBody.transactionId,
        recipientEmail: requestBody.recipientEmail,
        error: emailResult.error,
        correlationId,
      });
      return internalServerError(`Email delivery failed: ${emailResult.error}`);
    }

    // Log email delivery for rate limiting and audit
    await logEmailDelivery({
      userId,
      transactionId: requestBody.transactionId,
      receiptId: receiptData.id,
      recipientEmail: requestBody.recipientEmail,
      messageId: emailResult.messageId!,
      success: true,
      deliveredAt: emailResult.deliveredAt,
      correlationId,
    });

    // Audit log success
    await auditLogger({
      operation: 'receipt_email',
      entityType: 'receipt',
      entityId: receiptData.id,
      userId,
      businessId: transaction.business_id,
      correlationId,
      success: true,
      metadata: {
        transactionId: requestBody.transactionId,
        recipientEmail: requestBody.recipientEmail,
        messageId: emailResult.messageId,
        language: emailOptions.language,
        attachPdf: emailOptions.attachPdf,
      },
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Receipt email sent successfully', {
      receiptId: receiptData.id,
      receiptNumber: receiptData.receiptNumber,
      transactionId: requestBody.transactionId,
      recipientEmail: requestBody.recipientEmail,
      messageId: emailResult.messageId,
      userId,
      correlationId,
      processingTimeMs: processingTime,
    });

    // Prepare response
    const response: EmailReceiptResponse = {
      success: true,
      messageId: emailResult.messageId,
      recipientEmail: requestBody.recipientEmail,
      deliveredAt: emailResult.deliveredAt.toISOString(),
      receiptNumber: receiptData.receiptNumber,
    };

    return success(response, 'Receipt email sent successfully');
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log email delivery failure
    if (requestBody) {
      await logEmailDelivery({
        userId: event.requestContext.authorizer?.userId || '',
        transactionId: requestBody.transactionId,
        receiptId: '',
        recipientEmail: requestBody.recipientEmail,
        messageId: '',
        success: false,
        deliveredAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      });
    }

    // Log unexpected errors
    logger.error('Unexpected error in email receipt', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse',
    });

    await auditLogger({
      operation: 'receipt_email',
      entityType: 'receipt',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error',
    });

    return internalServerError(
      'An unexpected error occurred while sending the receipt email. Please try again or contact support.'
    );
  }
};

// Helper functions

async function checkEmailRateLimit(
  userId: string,
  transactionId: string
): Promise<{
  allowed: boolean;
  waitTimeMinutes?: number;
}> {
  try {
    // Check if user has sent too many emails for this transaction recently
    const rateLimitQuery = `
      SELECT COUNT(*) as email_count
      FROM receipt_email_log
      WHERE user_id = $1 
      AND transaction_id = $2 
      AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const result = await pool.query(rateLimitQuery, [userId, transactionId]);
    const emailCount = parseInt(result.rows[0]?.email_count || '0');

    // Allow max 3 emails per transaction per hour
    if (emailCount >= 3) {
      return { allowed: false, waitTimeMinutes: 60 };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Email rate limit check failed', { error, userId, transactionId });
    // Fail open - allow the email if rate limit check fails
    return { allowed: true };
  }
}

function generateReceiptNumber(businessId: string): string {
  const year = new Date().getFullYear();
  const businessPrefix = businessId.substring(0, 4).toUpperCase();
  const randomSuffix = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `${businessPrefix}-${year}-${randomSuffix}`;
}

function mapTransactionStatusToReceiptStatus(
  status: string
): 'paid' | 'refunded' | 'partially_refunded' | 'disputed' {
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

async function logEmailDelivery(log: {
  userId: string;
  transactionId: string;
  receiptId: string;
  recipientEmail: string;
  messageId: string;
  success: boolean;
  deliveredAt: Date;
  error?: string;
  correlationId: string;
}): Promise<void> {
  try {
    const insertQuery = `
      INSERT INTO receipt_email_log (
        id, user_id, transaction_id, receipt_id, recipient_email,
        message_id, success, error_message, delivered_at, created_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    `;

    await pool.query(insertQuery, [
      uuidv4(),
      log.userId,
      log.transactionId,
      log.receiptId,
      log.recipientEmail,
      log.messageId,
      log.success,
      log.error,
      log.deliveredAt,
      log.correlationId,
    ]);
  } catch (error) {
    logger.error('Failed to log email delivery', { error, log });
  }
}
