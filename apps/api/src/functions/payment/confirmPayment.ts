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
  BasePaymentError 
} from '../../types/Payment.js';

interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId: string;
}

interface ConfirmPaymentResponse {
  paymentIntentId: string;
  status: string;
  requiresAction: boolean;
  clientSecret?: string;
  nextAction?: any;
}

// Validation schema for confirm payment
const confirmPaymentSchema = {
  type: 'object',
  required: ['paymentIntentId', 'paymentMethodId'],
  properties: {
    paymentIntentId: {
      type: 'string',
      pattern: '^pi_[a-zA-Z0-9]{24,}$' // Stripe payment intent ID pattern
    },
    paymentMethodId: {
      type: 'string',
      pattern: '^pm_[a-zA-Z0-9]{24,}$' // Stripe payment method ID pattern
    }
  },
  additionalProperties: false
};

/**
 * Confirm Payment Lambda Handler
 * 
 * Confirms a payment intent with a payment method, handling 3DS and other authentication flows.
 * Updates database records and provides comprehensive audit logging.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: ConfirmPaymentRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'payment_confirm',
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
      requestBody = JSON.parse(event.body) as ConfirmPaymentRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(confirmPaymentSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Verify payment intent exists and user has authorization
    const paymentQuery = `
      SELECT pt.id, pt.payment_intent_id, pt.business_id, pt.user_id, pt.status,
             pt.amount, pt.currency, pt.escrow_enabled, pt.reservation_id,
             b.owner_id as business_owner_id, b.status as business_status
      FROM payment_transactions pt
      JOIN businesses b ON pt.business_id = b.id
      WHERE pt.payment_intent_id = $1
    `;
    
    const paymentResult = await pool.query(paymentQuery, [requestBody.paymentIntentId]);
    
    if (paymentResult.rows.length === 0) {
      await auditLogger({
        operation: 'payment_confirm',
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

    // Verify user authorization (customer who created payment or business owner or admin)
    const isCustomer = paymentRecord.user_id === userId;
    const isBusinessOwner = paymentRecord.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'payment_confirm',
        entityType: 'payment_intent',
        entityId: requestBody.paymentIntentId,
        userId,
        businessId: paymentRecord.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to confirm this payment');
    }

    // Check if payment is in confirmable state
    if (paymentRecord.status !== 'requires_confirmation' && paymentRecord.status !== 'requires_payment_method') {
      return badRequest(`Payment cannot be confirmed. Current status: ${paymentRecord.status}`);
    }

    // Verify business is still active
    if (paymentRecord.business_status !== 'active') {
      return badRequest('Business is not active and cannot process payments');
    }

    // Confirm payment using payment service
    const paymentService = new PaymentService();
    const confirmResult = await paymentService.confirmPayment(
      requestBody.paymentIntentId,
      requestBody.paymentMethodId
    );

    // Update database records
    const updateQuery = `
      UPDATE payment_transactions 
      SET status = $1, payment_method_id = $2, confirmed_at = NOW(), updated_at = NOW()
      WHERE payment_intent_id = $3
      RETURNING id
    `;

    await pool.query(updateQuery, [
      confirmResult.status,
      requestBody.paymentMethodId,
      requestBody.paymentIntentId
    ]);

    // Update reservation status if applicable
    if (paymentRecord.reservation_id) {
      let reservationStatus: string;
      
      if (confirmResult.status === 'succeeded') {
        reservationStatus = 'confirmed';
      } else if (confirmResult.status === 'requires_capture') {
        reservationStatus = 'payment_held'; // Escrow status
      } else if (confirmResult.status === 'requires_action') {
        reservationStatus = 'payment_pending_action';
      } else {
        reservationStatus = 'payment_failed';
      }

      await pool.query(
        `UPDATE reservations 
         SET payment_status = $1, updated_at = NOW() 
         WHERE id = $2`,
        [reservationStatus, paymentRecord.reservation_id]
      );
    }

    // Store payment method if successful
    if (confirmResult.success && isCustomer) {
      try {
        await paymentService.addPaymentMethod(paymentRecord.user_id, requestBody.paymentMethodId);
      } catch (pmError) {
        // Log but don't fail the payment confirmation
        logger.warn('Failed to store payment method for future use', {
          userId: paymentRecord.user_id,
          paymentMethodId: requestBody.paymentMethodId,
          error: pmError instanceof Error ? pmError.message : 'Unknown error',
          correlationId
        });
      }
    }

    // Audit log success
    await auditLogger({
      operation: 'payment_confirm',
      entityType: 'payment_intent',
      entityId: requestBody.paymentIntentId,
      userId,
      businessId: paymentRecord.business_id,
      correlationId,
      success: confirmResult.success,
      metadata: {
        paymentMethodId: requestBody.paymentMethodId,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: confirmResult.status,
        escrowEnabled: paymentRecord.escrow_enabled
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payment confirmation processed', {
      paymentIntentId: requestBody.paymentIntentId,
      status: confirmResult.status,
      success: confirmResult.success,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      userId,
      businessId: paymentRecord.business_id,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: ConfirmPaymentResponse = {
      paymentIntentId: confirmResult.paymentIntentId,
      status: confirmResult.status,
      requiresAction: confirmResult.status === 'requires_action',
      clientSecret: confirmResult.clientSecret
    };

    // Add next action if required (for 3DS or other authentication)
    if (confirmResult.status === 'requires_action' && confirmResult.clientSecret) {
      response.nextAction = {
        type: 'redirect_to_url',
        redirectUrl: `${process.env.APP_URL}/payment-authenticate?payment_intent=${requestBody.paymentIntentId}&client_secret=${confirmResult.clientSecret}`
      };
    }

    const statusMessage = confirmResult.success 
      ? (confirmResult.status === 'succeeded' ? 'Payment completed successfully' : 
         confirmResult.status === 'requires_capture' ? 'Payment authorized and held in escrow' :
         confirmResult.status === 'requires_action' ? 'Additional authentication required' :
         'Payment confirmation processed')
      : 'Payment confirmation failed';

    return success(response, statusMessage);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error handling
    if (error instanceof PaymentValidationError) {
      await auditLogger({
        operation: 'payment_confirm',
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
        operation: 'payment_confirm',
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
          : 'Payment confirmation failed. Please contact support.'
      );
    }

    if (error instanceof BasePaymentError) {
      await auditLogger({
        operation: 'payment_confirm',
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
    logger.error('Unexpected error in confirm payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse',
      paymentIntentId: requestBody?.paymentIntentId
    });

    await auditLogger({
      operation: 'payment_confirm',
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