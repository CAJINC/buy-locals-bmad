import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  badRequest,
  internalServerError,
  success,
  unauthorized,
} from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { PayoutService } from '../../services/payoutService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';

interface SchedulePayoutRequest {
  businessId: string;
  payoutDate?: string;
  payoutType: 'manual' | 'automatic';
  description?: string;
  metadata?: Record<string, string>;
}

interface SchedulePayoutResponse {
  payoutId: string;
  businessId: string;
  businessName: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  payoutDate: Date;
  payoutType: string;
  status: string;
  description?: string;
  transactionCount: number;
  expectedArrivalDate: Date;
}

// Validation schema for schedule payout
const schedulePayoutSchema = {
  type: 'object',
  required: ['businessId', 'payoutType'],
  properties: {
    businessId: {
      type: 'string',
      format: 'uuid',
    },
    payoutDate: {
      type: 'string',
      format: 'date-time',
    },
    payoutType: {
      type: 'string',
      enum: ['manual', 'automatic'],
    },
    description: {
      type: 'string',
      maxLength: 1000,
    },
    metadata: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        maxLength: 500,
      },
    },
  },
  additionalProperties: false,
};

/**
 * Schedule Payout Lambda Handler
 *
 * Schedules payouts for businesses with proper authorization, validation,
 * and Stripe payout creation. Handles both manual and automatic payout scheduling.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: SchedulePayoutRequest;

  try {
    // Security headers and input sanitization
    sanitizeInput(event);

    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;

    if (!userId) {
      await auditLogger({
        operation: 'payout_schedule',
        entityType: 'payout',
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
      requestBody = JSON.parse(event.body) as SchedulePayoutRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(schedulePayoutSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Verify business exists and user has authorization
    const businessQuery = `
      SELECT b.id, b.name, b.owner_id, b.status, b.currency, b.stripe_account_id,
             b.payout_schedule, b.minimum_payout_amount
      FROM businesses b
      WHERE b.id = $1
    `;

    const businessResult = await pool.query(businessQuery, [requestBody.businessId]);

    if (businessResult.rows.length === 0) {
      return badRequest('Business not found');
    }

    const business = businessResult.rows[0];

    // Verify user authorization (business owner, admin, or finance role)
    const isBusinessOwner = business.owner_id === userId;
    const isAdmin = userRole === 'admin';
    const isFinance = userRole === 'finance';

    if (!isBusinessOwner && !isAdmin && !isFinance) {
      await auditLogger({
        operation: 'payout_schedule',
        entityType: 'payout',
        entityId: '',
        userId,
        businessId: requestBody.businessId,
        correlationId,
        success: false,
        error: 'Insufficient permissions',
      });
      return unauthorized('You do not have permission to schedule payouts for this business');
    }

    // Verify business is active and has Stripe account
    if (business.status !== 'active') {
      return badRequest('Business is not active');
    }

    if (!business.stripe_account_id) {
      return badRequest('Business does not have payment processing configured');
    }

    // Validate payout date
    const now = new Date();
    const payoutDate = requestBody.payoutDate ? new Date(requestBody.payoutDate) : now;

    // Manual payouts can be scheduled for future dates, automatic payouts are immediate
    if (requestBody.payoutType === 'manual' && payoutDate <= now) {
      return badRequest('Manual payout date must be in the future');
    }

    if (requestBody.payoutType === 'automatic' && requestBody.payoutDate) {
      return badRequest('Automatic payouts cannot specify a future date');
    }

    // Check for pending payouts that would conflict
    const existingPayoutQuery = `
      SELECT COUNT(*) as count
      FROM business_payouts bp
      WHERE bp.business_id = $1 
        AND bp.status IN ('scheduled', 'processing') 
        AND DATE(bp.expected_payout_date) = DATE($2)
    `;

    const existingPayoutResult = await pool.query(existingPayoutQuery, [
      requestBody.businessId,
      payoutDate,
    ]);

    if (parseInt(existingPayoutResult.rows[0].count) > 0) {
      return badRequest('A payout is already scheduled for this date');
    }

    // Get available payout amount (captured but not yet paid out)
    const availablePayoutQuery = `
      SELECT 
        COALESCE(SUM(pt.business_payout), 0) as total_available,
        COALESCE(SUM(pt.platform_fee), 0) as total_platform_fees,
        COUNT(*) as transaction_count,
        pt.currency
      FROM payment_transactions pt
      WHERE pt.business_id = $1 
        AND pt.status = 'succeeded' 
        AND pt.captured_at IS NOT NULL
        AND pt.id NOT IN (
          SELECT DISTINCT ptx.id 
          FROM payment_transactions ptx
          JOIN business_payouts bp ON ptx.id = ANY(bp.transaction_ids)
          WHERE bp.status IN ('scheduled', 'processing', 'paid')
        )
      GROUP BY pt.currency
    `;

    const availablePayoutResult = await pool.query(availablePayoutQuery, [requestBody.businessId]);

    if (availablePayoutResult.rows.length === 0) {
      return badRequest('No funds available for payout');
    }

    const payoutInfo = availablePayoutResult.rows[0];
    const totalAvailable = parseFloat(payoutInfo.total_available) || 0;
    const totalPlatformFees = parseFloat(payoutInfo.total_platform_fees) || 0;
    const transactionCount = parseInt(payoutInfo.transaction_count) || 0;
    const currency = payoutInfo.currency || business.currency || 'USD';

    // Check minimum payout amount
    const minimumPayoutAmount = business.minimum_payout_amount || 100; // Default $1.00 minimum
    if (totalAvailable < minimumPayoutAmount) {
      return badRequest(
        `Minimum payout amount is ${minimumPayoutAmount / 100} ${currency}. Available: ${totalAvailable / 100} ${currency}`
      );
    }

    // Get transaction IDs for this payout
    const transactionIdsQuery = `
      SELECT array_agg(pt.id) as transaction_ids
      FROM payment_transactions pt
      WHERE pt.business_id = $1 
        AND pt.status = 'succeeded' 
        AND pt.captured_at IS NOT NULL
        AND pt.id NOT IN (
          SELECT DISTINCT ptx.id 
          FROM payment_transactions ptx
          JOIN business_payouts bp ON ptx.id = ANY(bp.transaction_ids)
          WHERE bp.status IN ('scheduled', 'processing', 'paid')
        )
    `;

    const transactionIdsResult = await pool.query(transactionIdsQuery, [requestBody.businessId]);
    const transactionIds = transactionIdsResult.rows[0].transaction_ids || [];

    // Use payout service to create payout with Stripe
    const payoutService = new PayoutService();
    const payoutId = uuidv4();

    try {
      await payoutService.createStripePayout({
        businessId: requestBody.businessId,
        stripeAccountId: business.stripe_account_id,
        amount: totalAvailable,
        currency,
        description: requestBody.description || `Payout for ${transactionCount} transactions`,
        metadata: {
          ...requestBody.metadata,
          payoutId,
          correlationId,
          payoutType: requestBody.payoutType,
          transactionCount: transactionCount.toString(),
        },
      });
    } catch (stripeError) {
      logger.error('Failed to create Stripe payout', {
        businessId: requestBody.businessId,
        amount: totalAvailable,
        error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
        correlationId,
      });
      return internalServerError('Failed to create payout with payment processor');
    }

    // Create payout record in database
    const payoutInsertQuery = `
      INSERT INTO business_payouts (
        id, business_id, amount, platform_fee, net_amount, currency,
        status, payout_type, description, transaction_ids, transaction_count,
        expected_payout_date, created_at, metadata, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)
      RETURNING id, created_at
    `;

    // Calculate expected arrival date (typically 2-7 business days)
    const expectedArrivalDate = new Date(payoutDate);
    expectedArrivalDate.setDate(expectedArrivalDate.getDate() + 2); // 2 business days typical

    const payoutValues = [
      payoutId,
      requestBody.businessId,
      totalAvailable,
      totalPlatformFees,
      totalAvailable, // Net amount is same as amount for business payouts
      currency,
      requestBody.payoutType === 'automatic' ? 'processing' : 'scheduled',
      requestBody.payoutType,
      requestBody.description || `Payout for ${transactionCount} transactions`,
      transactionIds,
      transactionCount,
      payoutDate,
      JSON.stringify(requestBody.metadata || {}),
      correlationId,
    ];

    await pool.query(payoutInsertQuery, payoutValues);

    // Audit log success
    await auditLogger({
      operation: 'payout_schedule',
      entityType: 'payout',
      entityId: payoutId,
      userId,
      businessId: requestBody.businessId,
      correlationId,
      success: true,
      metadata: {
        amount: totalAvailable,
        currency,
        payoutType: requestBody.payoutType,
        payoutDate: payoutDate.toISOString(),
        transactionCount,
      },
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payout scheduled successfully', {
      payoutId,
      businessId: requestBody.businessId,
      businessName: business.name,
      amount: totalAvailable,
      currency,
      payoutType: requestBody.payoutType,
      payoutDate,
      expectedArrivalDate,
      transactionCount,
      correlationId,
      processingTimeMs: processingTime,
    });

    // Prepare response
    const response: SchedulePayoutResponse = {
      payoutId,
      businessId: requestBody.businessId,
      businessName: business.name,
      amount: totalAvailable,
      platformFee: totalPlatformFees,
      netAmount: totalAvailable,
      currency,
      payoutDate,
      payoutType: requestBody.payoutType,
      status: requestBody.payoutType === 'automatic' ? 'processing' : 'scheduled',
      description: requestBody.description,
      transactionCount,
      expectedArrivalDate,
    };

    const message =
      requestBody.payoutType === 'automatic'
        ? 'Payout is being processed and will arrive in 2-7 business days'
        : `Payout scheduled for ${payoutDate.toDateString()}`;

    return success(response, message);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log unexpected errors
    logger.error('Unexpected error in schedule payout', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse',
    });

    await auditLogger({
      operation: 'payout_schedule',
      entityType: 'payout',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      businessId: requestBody?.businessId || '',
      correlationId,
      success: false,
      error: 'Internal server error',
    });

    return internalServerError(
      'An unexpected error occurred. Please try again or contact support.'
    );
  }
};
