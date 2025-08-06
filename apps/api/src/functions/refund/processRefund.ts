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
import { PaymentService } from '../../services/paymentService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';
import {
  BasePaymentError,
  PaymentProcessingError,
  PaymentValidationError,
} from '../../types/Payment.js';

interface ProcessRefundRequest {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  reasonCode?:
    | 'duplicate'
    | 'fraudulent'
    | 'requested_by_customer'
    | 'service_cancelled'
    | 'service_not_delivered';
  metadata?: Record<string, string>;
  notifyCustomer?: boolean;
}

interface ProcessRefundResponse {
  refundId: string;
  paymentIntentId: string;
  amount: number;
  reason?: string;
  status: string;
  businessAdjustment: number;
  platformFeeRefund: number;
  expectedRefundDate: Date;
}

// Validation schema for process refund
const processRefundSchema = {
  type: 'object',
  required: ['paymentIntentId'],
  properties: {
    paymentIntentId: {
      type: 'string',
      pattern: '^pi_[a-zA-Z0-9]{24,}$', // Stripe payment intent ID pattern
    },
    amount: {
      type: 'number',
      minimum: 1,
      maximum: 1000000, // $10,000 maximum
    },
    reason: {
      type: 'string',
      maxLength: 1000,
    },
    reasonCode: {
      type: 'string',
      enum: [
        'duplicate',
        'fraudulent',
        'requested_by_customer',
        'service_cancelled',
        'service_not_delivered',
      ],
    },
    metadata: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 500,
      },
    },
    notifyCustomer: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
};

/**
 * Process Refund Lambda Handler
 *
 * Processes partial or full refunds for completed payments with proper authorization,
 * business payout adjustments, and comprehensive audit logging.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: ProcessRefundRequest;

  try {
    // Security headers and input sanitization
    sanitizeInput(event);

    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;

    if (!userId) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
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
      requestBody = JSON.parse(event.body) as ProcessRefundRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(processRefundSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Verify payment intent exists and get details
    const paymentQuery = `
      SELECT pt.id, pt.payment_intent_id, pt.business_id, pt.user_id, pt.status,
             pt.amount, pt.currency, pt.captured_amount, pt.platform_fee, pt.business_payout,
             pt.escrow_enabled, pt.reservation_id, pt.created_at, pt.captured_at,
             b.owner_id as business_owner_id, b.name as business_name, b.status as business_status,
             u.email as customer_email, u.profile as customer_profile,
             r.service_date, r.completion_status as reservation_status,
             COALESCE(
               (SELECT SUM(amount) FROM refunds WHERE payment_intent_id = pt.payment_intent_id AND status = 'succeeded'),
               0
             ) as total_refunded
      FROM payment_transactions pt
      JOIN businesses b ON pt.business_id = b.id
      JOIN users u ON pt.user_id = u.id
      LEFT JOIN reservations r ON pt.reservation_id = r.id
      WHERE pt.payment_intent_id = $1
    `;

    const paymentResult = await pool.query(paymentQuery, [requestBody.paymentIntentId]);

    if (paymentResult.rows.length === 0) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
        entityId: '',
        userId,
        correlationId,
        success: false,
        error: 'Payment intent not found',
      });
      return notFound('Payment intent not found');
    }

    const paymentRecord = paymentResult.rows[0];

    // Verify user authorization (business owner, admin, or customer under certain conditions)
    const isCustomer = paymentRecord.user_id === userId;
    const isBusinessOwner = paymentRecord.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (
      !isBusinessOwner &&
      !isAdmin &&
      (!isCustomer || !requestBody.reasonCode?.includes('requested_by_customer'))
    ) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
        entityId: '',
        userId,
        businessId: paymentRecord.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions',
      });
      return unauthorized('You do not have permission to process refunds for this payment');
    }

    // Verify payment status allows refunds
    if (paymentRecord.status !== 'succeeded') {
      return badRequest(
        `Cannot refund payment with status: ${paymentRecord.status}. Only succeeded payments can be refunded.`
      );
    }

    // Verify business is active
    if (paymentRecord.business_status !== 'active') {
      return badRequest('Business is not active and cannot process refunds');
    }

    // Calculate refund amount
    const capturedAmount = paymentRecord.captured_amount || paymentRecord.amount;
    const totalRefunded = parseFloat(paymentRecord.total_refunded) || 0;
    const availableToRefund = capturedAmount - totalRefunded;
    const refundAmount = requestBody.amount || availableToRefund;

    // Validate refund amount
    if (refundAmount <= 0) {
      return badRequest('Refund amount must be greater than 0');
    }

    if (refundAmount > availableToRefund) {
      return badRequest(
        `Cannot refund ${refundAmount}. Only ${availableToRefund} available to refund (${totalRefunded} already refunded from ${capturedAmount} captured).`
      );
    }

    // Additional validation for customer-initiated refunds
    if (isCustomer) {
      // Customers can only request refunds within certain time limits or conditions
      const now = new Date();
      const capturedAt = new Date(paymentRecord.captured_at || paymentRecord.created_at);
      const daysSincePayment = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSincePayment > 30) {
        return badRequest('Customer-initiated refunds are only allowed within 30 days of payment');
      }

      // Check if service has already been completed
      if (paymentRecord.reservation_status === 'completed') {
        return badRequest(
          'Cannot request refund for completed service. Please contact the business directly.'
        );
      }

      // Require reason for customer refunds
      if (!requestBody.reason || requestBody.reason.trim().length < 10) {
        return badRequest(
          'Please provide a detailed reason (minimum 10 characters) for the refund request'
        );
      }
    }

    // Process refund using payment service
    const paymentService = new PaymentService();
    const refundResult = await paymentService.processRefund(
      requestBody.paymentIntentId,
      refundAmount,
      requestBody.reason || requestBody.reasonCode || 'Refund requested',
      {
        ...requestBody.metadata,
        initiatedBy: isCustomer ? 'customer' : isBusinessOwner ? 'business' : 'admin',
        reasonCode: requestBody.reasonCode || 'requested_by_customer',
        correlationId,
      }
    );

    // Store refund record in database
    const refundInsertQuery = `
      INSERT INTO refunds (
        id, refund_id, payment_intent_id, business_id, user_id, amount,
        reason, reason_code, status, business_adjustment, platform_fee_refund,
        initiated_by, metadata, created_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14)
      RETURNING id, created_at
    `;

    const refundValues = [
      uuidv4(),
      refundResult.refundId,
      requestBody.paymentIntentId,
      paymentRecord.business_id,
      paymentRecord.user_id,
      refundAmount,
      requestBody.reason || 'Refund requested',
      requestBody.reasonCode || 'requested_by_customer',
      refundResult.status,
      refundResult.businessAdjustment,
      refundResult.platformFeeRefund,
      isCustomer ? 'customer' : isBusinessOwner ? 'business' : 'admin',
      JSON.stringify(requestBody.metadata || {}),
      correlationId,
    ];

    await pool.query(refundInsertQuery, refundValues);

    // Update payment transaction status if fully refunded
    const newTotalRefunded = totalRefunded + refundAmount;
    if (newTotalRefunded >= capturedAmount) {
      await pool.query(
        `UPDATE payment_transactions 
         SET status = 'refunded', updated_at = NOW() 
         WHERE payment_intent_id = $1`,
        [requestBody.paymentIntentId]
      );
    }

    // Update reservation status if applicable
    if (paymentRecord.reservation_id) {
      let reservationStatus = paymentRecord.reservation_status;

      if (newTotalRefunded >= capturedAmount) {
        reservationStatus = 'cancelled';
      } else if (refundAmount > 0) {
        reservationStatus = 'partially_refunded';
      }

      await pool.query(
        `UPDATE reservations 
         SET payment_status = $1, refund_amount = COALESCE(refund_amount, 0) + $2, updated_at = NOW()
         WHERE id = $3`,
        [reservationStatus, refundAmount, paymentRecord.reservation_id]
      );
    }

    // Create business payout adjustment record
    if (refundResult.businessAdjustment > 0) {
      await pool.query(
        `
        INSERT INTO business_payout_adjustments (
          id, business_id, payment_intent_id, refund_id, adjustment_amount,
          adjustment_type, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'refund_deduction', $6, NOW())
      `,
        [
          uuidv4(),
          paymentRecord.business_id,
          requestBody.paymentIntentId,
          refundResult.refundId,
          -refundResult.businessAdjustment, // Negative adjustment
          `Refund processed: ${requestBody.reason || requestBody.reasonCode}`,
        ]
      );
    }

    // Send notification if requested
    if (requestBody.notifyCustomer) {
      try {
        // TODO: Implement notification service call
        logger.info('Customer notification scheduled for refund', {
          refundId: refundResult.refundId,
          customerEmail: paymentRecord.customer_email,
          amount: refundAmount,
          correlationId,
        });
      } catch (notificationError) {
        logger.warn('Failed to send customer notification', {
          refundId: refundResult.refundId,
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        });
      }
    }

    // Audit log success
    await auditLogger({
      operation: 'refund_create',
      entityType: 'refund',
      entityId: refundResult.refundId,
      userId,
      businessId: paymentRecord.business_id,
      correlationId,
      success: true,
      metadata: {
        amount: refundAmount,
        paymentIntentId: requestBody.paymentIntentId,
        businessAdjustment: refundResult.businessAdjustment,
        platformFeeRefund: refundResult.platformFeeRefund,
        reason: requestBody.reason,
        reasonCode: requestBody.reasonCode,
        initiatedBy: isCustomer ? 'customer' : isBusinessOwner ? 'business' : 'admin',
      },
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Refund processed successfully', {
      refundId: refundResult.refundId,
      paymentIntentId: requestBody.paymentIntentId,
      amount: refundAmount,
      businessId: paymentRecord.business_id,
      businessName: paymentRecord.business_name,
      customerEmail: paymentRecord.customer_email,
      initiatedBy: isCustomer ? 'customer' : isBusinessOwner ? 'business' : 'admin',
      correlationId,
      processingTimeMs: processingTime,
    });

    // Prepare response
    const response: ProcessRefundResponse = {
      refundId: refundResult.refundId,
      paymentIntentId: requestBody.paymentIntentId,
      amount: refundAmount,
      reason: requestBody.reason,
      status: refundResult.status,
      businessAdjustment: refundResult.businessAdjustment,
      platformFeeRefund: refundResult.platformFeeRefund,
      expectedRefundDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5-7 business days
    };

    return success(
      response,
      'Refund processed successfully. It may take 5-7 business days to appear on the original payment method.'
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Enhanced error handling
    if (error instanceof PaymentValidationError) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message,
      });
      return badRequest(error.message);
    }

    if (error instanceof PaymentProcessingError) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message,
      });

      return internalServerError(
        error.retryable
          ? 'Payment service temporarily unavailable. Please try again.'
          : 'Refund processing failed. Please contact support.'
      );
    }

    if (error instanceof BasePaymentError) {
      await auditLogger({
        operation: 'refund_create',
        entityType: 'refund',
        entityId: '',
        userId: event.requestContext.authorizer?.userId || '',
        correlationId,
        success: false,
        error: error.message,
      });
      return internalServerError(error.message);
    }

    // Log unexpected errors
    logger.error('Unexpected error in process refund', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse',
      paymentIntentId: requestBody?.paymentIntentId,
    });

    await auditLogger({
      operation: 'refund_create',
      entityType: 'refund',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error',
    });

    return internalServerError(
      'An unexpected error occurred. Please try again or contact support.'
    );
  }
};
