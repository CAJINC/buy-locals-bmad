import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { success, badRequest, unauthorized, notFound, internalServerError } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { PaymentService } from '../../services/paymentService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';
import { 
  PaymentValidationError,
  PaymentProcessingError,
  BasePaymentError,
  EscrowError 
} from '../../types/Payment.js';

interface CapturePaymentRequest {
  paymentIntentId: string;
  amountToCapture?: number;
  reason?: string;
}

interface CapturePaymentResponse {
  paymentIntentId: string;
  capturedAmount: number;
  platformFee: number;
  businessPayout: number;
  capturedAt: Date;
  status: string;
}

// Validation schema for capture payment
const capturePaymentSchema = {
  type: 'object',
  required: ['paymentIntentId'],
  properties: {
    paymentIntentId: {
      type: 'string',
      pattern: '^pi_[a-zA-Z0-9]{24,}$' // Stripe payment intent ID pattern
    },
    amountToCapture: {
      type: 'number',
      minimum: 1,
      maximum: 1000000 // $10,000 maximum
    },
    reason: {
      type: 'string',
      maxLength: 500
    }
  },
  additionalProperties: false
};

/**
 * Capture Payment Lambda Handler
 * 
 * Captures funds from escrow for a payment intent, releasing payment to business owner.
 * Only business owners, admins, or automated systems can capture payments.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: CapturePaymentRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'payment_capture',
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
      requestBody = JSON.parse(event.body) as CapturePaymentRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(capturePaymentSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Verify payment intent exists and get details
    const paymentQuery = `
      SELECT pt.id, pt.payment_intent_id, pt.business_id, pt.user_id, pt.status,
             pt.amount, pt.currency, pt.escrow_enabled, pt.reservation_id,
             b.owner_id as business_owner_id, b.status as business_status,
             b.name as business_name,
             r.service_date, r.completion_status
      FROM payment_transactions pt
      JOIN businesses b ON pt.business_id = b.id
      LEFT JOIN reservations r ON pt.reservation_id = r.id
      WHERE pt.payment_intent_id = $1
    `;
    
    const paymentResult = await pool.query(paymentQuery, [requestBody.paymentIntentId]);
    
    if (paymentResult.rows.length === 0) {
      await auditLogger({
        operation: 'payment_capture',
        entityType: 'payment_intent',
        entityId: requestBody.paymentIntentId,
        userId,
        correlationId,
        success: false,
        error: 'Payment intent not found'
      });
      return notFound('Payment intent not found');
    }

    const paymentRecord = paymentResult.rows[0];

    // Verify user authorization (business owner or admin only)
    const isBusinessOwner = paymentRecord.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'payment_capture',
        entityType: 'payment_intent',
        entityId: requestBody.paymentIntentId,
        userId,
        businessId: paymentRecord.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions - only business owner or admin can capture payments'
      });
      return unauthorized('Only the business owner or admin can capture payments');
    }

    // Verify payment is in escrow and capturable state
    if (!paymentRecord.escrow_enabled) {
      return badRequest('This payment was not held in escrow and has already been processed');
    }

    if (paymentRecord.status !== 'requires_capture') {
      return badRequest(`Payment cannot be captured. Current status: ${paymentRecord.status}`);
    }

    // Verify business is still active
    if (paymentRecord.business_status !== 'active') {
      return badRequest('Business is not active and cannot capture payments');
    }

    // For service reservations, verify completion status
    if (paymentRecord.reservation_id) {
      // Auto-capture logic based on service completion
      if (paymentRecord.completion_status === 'completed') {
        logger.info('Auto-capturing payment for completed service', {
          paymentIntentId: requestBody.paymentIntentId,
          reservationId: paymentRecord.reservation_id,
          correlationId
        });
      } else if (paymentRecord.completion_status === 'pending' || paymentRecord.completion_status === 'in_progress') {
        // Allow manual capture if business owner explicitly requests it
        if (!requestBody.reason) {
          return badRequest('Reason required for capturing payment before service completion');
        }
      } else if (paymentRecord.completion_status === 'cancelled') {
        return badRequest('Cannot capture payment for cancelled service. Consider processing a refund instead.');
      }
    }

    // Validate capture amount if specified
    const amountToCapture = requestBody.amountToCapture || paymentRecord.amount;
    
    if (amountToCapture > paymentRecord.amount) {
      return badRequest(`Cannot capture more than original amount (${paymentRecord.amount})`);
    }

    if (amountToCapture <= 0) {
      return badRequest('Capture amount must be greater than 0');
    }

    // Capture payment using payment service
    const paymentService = new PaymentService();
    const captureResult = await paymentService.capturePayment(
      requestBody.paymentIntentId,
      amountToCapture
    );

    // Update database records
    const updateQuery = `
      UPDATE payment_transactions 
      SET status = 'succeeded', captured_amount = $1, captured_at = NOW(), 
          platform_fee = $2, business_payout = $3, updated_at = NOW(),
          capture_reason = $4
      WHERE payment_intent_id = $5
      RETURNING id
    `;

    await pool.query(updateQuery, [
      captureResult.capturedAmount,
      captureResult.platformFee,
      captureResult.businessPayout,
      requestBody.reason || 'Payment captured by business owner',
      requestBody.paymentIntentId
    ]);

    // Update reservation status if applicable
    if (paymentRecord.reservation_id) {
      await pool.query(
        `UPDATE reservations 
         SET payment_status = 'completed', payment_captured_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [paymentRecord.reservation_id]
      );
    }

    // Create payout record for business accounting
    const payoutInsertQuery = `
      INSERT INTO business_payouts (
        id, business_id, payment_intent_id, amount, platform_fee,
        net_amount, status, created_at, expected_payout_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW(), NOW() + INTERVAL '2 days')
    `;

    await pool.query(payoutInsertQuery, [
      uuidv4(),
      paymentRecord.business_id,
      requestBody.paymentIntentId,
      captureResult.capturedAmount,
      captureResult.platformFee,
      captureResult.businessPayout
    ]);

    // Audit log success
    await auditLogger({
      operation: 'payment_capture',
      entityType: 'payment_intent',
      entityId: requestBody.paymentIntentId,
      userId,
      businessId: paymentRecord.business_id,
      correlationId,
      success: true,
      metadata: {
        capturedAmount: captureResult.capturedAmount,
        platformFee: captureResult.platformFee,
        businessPayout: captureResult.businessPayout,
        originalAmount: paymentRecord.amount,
        reason: requestBody.reason,
        reservationId: paymentRecord.reservation_id
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payment captured from escrow successfully', {
      paymentIntentId: requestBody.paymentIntentId,
      capturedAmount: captureResult.capturedAmount,
      platformFee: captureResult.platformFee,
      businessPayout: captureResult.businessPayout,
      businessId: paymentRecord.business_id,
      businessName: paymentRecord.business_name,
      userId,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: CapturePaymentResponse = {
      paymentIntentId: captureResult.paymentIntentId,
      capturedAmount: captureResult.capturedAmount,
      platformFee: captureResult.platformFee,
      businessPayout: captureResult.businessPayout,
      capturedAt: captureResult.capturedAt,
      status: 'succeeded'
    };

    return success(response, 'Payment captured successfully. Payout has been scheduled.');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error handling
    if (error instanceof PaymentValidationError || error instanceof EscrowError) {
      await auditLogger({
        operation: 'payment_capture',
        entityType: 'payment_intent',
        entityId: requestBody?.paymentIntentId || '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      return badRequest(error.message);
    }

    if (error instanceof PaymentProcessingError) {
      await auditLogger({
        operation: 'payment_capture',
        entityType: 'payment_intent',
        entityId: requestBody?.paymentIntentId || '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      
      return internalServerError(
        error.retryable 
          ? 'Payment service temporarily unavailable. Please try again.'
          : 'Payment capture failed. Please contact support.'
      );
    }

    if (error instanceof BasePaymentError) {
      await auditLogger({
        operation: 'payment_capture',
        entityType: 'payment_intent',
        entityId: requestBody?.paymentIntentId || '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message
      });
      return internalServerError(error.message);
    }

    // Log unexpected errors
    logger.error('Unexpected error in capture payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse',
      paymentIntentId: requestBody?.paymentIntentId
    });

    await auditLogger({
      operation: 'payment_capture',
      entityType: 'payment_intent',
      entityId: requestBody?.paymentIntentId || '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};