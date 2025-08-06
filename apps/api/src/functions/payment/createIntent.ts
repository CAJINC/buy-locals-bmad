import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { PaymentService } from '../../services/paymentService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';
import { 
  BasePaymentError,
  PaymentIntentParams,
  PaymentProcessingError,
  PaymentValidationError 
} from '../../types/Payment.js';

interface CreateIntentRequest {
  businessId: string;
  reservationId?: string;
  serviceId?: string;
  amount: number;
  currency: string;
  description?: string;
  automaticCapture?: boolean;
  escrowReleaseDate?: string;
  metadata?: Record<string, string>;
}

interface CreateIntentResponse {
  paymentIntentId: string;
  clientSecret?: string;
  status: string;
  escrowEnabled: boolean;
  platformFee: number;
  businessAmount: number;
}

// Validation schema for create payment intent
const createIntentSchema = {
  type: 'object',
  required: ['businessId', 'amount', 'currency'],
  properties: {
    businessId: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    reservationId: {
      type: 'string',
      format: 'uuid'
    },
    serviceId: {
      type: 'string',
      format: 'uuid'
    },
    amount: {
      type: 'number',
      minimum: 50, // $0.50 minimum
      maximum: 1000000 // $10,000 maximum
    },
    currency: {
      type: 'string',
      enum: ['USD', 'CAD', 'EUR', 'GBP']
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    automaticCapture: {
      type: 'boolean'
    },
    escrowReleaseDate: {
      type: 'string',
      format: 'date-time'
    },
    metadata: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 500
      }
    }
  },
  additionalProperties: false
};

/**
 * Create Payment Intent Lambda Handler
 * 
 * Creates a new payment intent for reservation or service payment with escrow capability.
 * Implements comprehensive security, validation, and audit logging.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: CreateIntentRequest;
  
  try {
    // Security headers and input sanitization
    sanitizeInput(event);
    
    // Extract user from JWT token (assuming middleware has processed it)
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'payment_intent_create',
        entityType: 'payment_intent',
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
      requestBody = JSON.parse(event.body) as CreateIntentRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(createIntentSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Business authorization - verify user can create payments for this business
    const businessAuthQuery = `
      SELECT b.id, b.stripe_account_id, b.owner_id, b.status 
      FROM businesses b 
      WHERE b.id = $1 AND b.status = 'active'
    `;
    
    const businessResult = await pool.query(businessAuthQuery, [requestBody.businessId]);
    
    if (businessResult.rows.length === 0) {
      return badRequest('Business not found or inactive');
    }

    const business = businessResult.rows[0];
    
    // Verify user authorization (business owner or admin)
    if (userRole !== 'admin' && business.owner_id !== userId) {
      await auditLogger({
        operation: 'payment_intent_create',
        entityType: 'payment_intent',
        entityId: '',
        userId,
        businessId: requestBody.businessId,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to create payments for this business');
    }

    // Verify business has Stripe account configured
    if (!business.stripe_account_id) {
      return badRequest('Business payment processing not configured');
    }

    // Get or create customer record
    let customerId: string | undefined;
    
    const customerQuery = `
      SELECT stripe_customer_id 
      FROM users 
      WHERE id = $1 AND stripe_customer_id IS NOT NULL
    `;
    
    const customerResult = await pool.query(customerQuery, [userId]);
    
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].stripe_customer_id;
    }

    // Prepare payment service parameters
    const paymentParams: PaymentIntentParams = {
      amount: requestBody.amount,
      currency: requestBody.currency.toUpperCase(),
      businessId: requestBody.businessId,
      customerId,
      description: requestBody.description || `Payment for ${requestBody.businessId}`,
      automaticCapture: requestBody.automaticCapture ?? false, // Default to escrow
      escrowReleaseDate: requestBody.escrowReleaseDate ? new Date(requestBody.escrowReleaseDate) : undefined,
      metadata: {
        ...requestBody.metadata,
        userId,
        correlationId,
        ...(requestBody.reservationId && { reservationId: requestBody.reservationId }),
        ...(requestBody.serviceId && { serviceId: requestBody.serviceId })
      }
    };

    // Create payment intent using payment service
    const paymentService = new PaymentService();
    const paymentResult = await paymentService.createPaymentIntent(paymentParams);

    // Store transaction record in database
    const transactionInsertQuery = `
      INSERT INTO payment_transactions (
        id, payment_intent_id, business_id, user_id, reservation_id, service_id,
        amount, currency, platform_fee, business_amount, status, escrow_enabled,
        metadata, created_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14)
      RETURNING id, created_at
    `;

    const transactionValues = [
      uuidv4(),
      paymentResult.paymentIntentId,
      requestBody.businessId,
      userId,
      requestBody.reservationId || null,
      requestBody.serviceId || null,
      requestBody.amount,
      requestBody.currency.toUpperCase(),
      paymentResult.metadata?.platformFee || 0,
      paymentResult.metadata?.businessAmount || 0,
      paymentResult.status,
      !requestBody.automaticCapture,
      JSON.stringify(paymentParams.metadata),
      correlationId
    ];

    await pool.query(transactionInsertQuery, transactionValues);

    // Update reservation if applicable
    if (requestBody.reservationId) {
      await pool.query(
        `UPDATE reservations 
         SET payment_intent_id = $1, payment_status = 'pending', updated_at = NOW() 
         WHERE id = $2`,
        [paymentResult.paymentIntentId, requestBody.reservationId]
      );
    }

    // Audit log success
    await auditLogger({
      operation: 'payment_intent_create',
      entityType: 'payment_intent',
      entityId: paymentResult.paymentIntentId,
      userId,
      businessId: requestBody.businessId,
      correlationId,
      success: true,
      metadata: {
        amount: requestBody.amount,
        currency: requestBody.currency,
        escrowEnabled: !requestBody.automaticCapture
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payment intent created successfully', {
      paymentIntentId: paymentResult.paymentIntentId,
      amount: requestBody.amount,
      currency: requestBody.currency,
      businessId: requestBody.businessId,
      userId,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: CreateIntentResponse = {
      paymentIntentId: paymentResult.paymentIntentId,
      clientSecret: paymentResult.clientSecret,
      status: paymentResult.status,
      escrowEnabled: !requestBody.automaticCapture,
      platformFee: paymentResult.metadata?.platformFee || 0,
      businessAmount: paymentResult.metadata?.businessAmount || 0
    };

    return success(response, 'Payment intent created successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error handling
    if (error instanceof PaymentValidationError) {
      await auditLogger({
        operation: 'payment_intent_create',
        entityType: 'payment_intent',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      return badRequest(error.message);
    }

    if (error instanceof PaymentProcessingError) {
      await auditLogger({
        operation: 'payment_intent_create',
        entityType: 'payment_intent',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      
      return internalServerError(
        error.retryable 
          ? 'Payment service temporarily unavailable. Please try again.'
          : 'Payment processing failed. Please contact support.'
      );
    }

    if (error instanceof BasePaymentError) {
      await auditLogger({
        operation: 'payment_intent_create',
        entityType: 'payment_intent',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      return internalServerError(error.message);
    }

    // Log unexpected errors
    logger.error('Unexpected error in create payment intent', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse'
    });

    await auditLogger({
      operation: 'payment_intent_create',
      entityType: 'payment_intent',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};