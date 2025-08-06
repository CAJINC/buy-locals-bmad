import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { success, badRequest, unauthorized, internalServerError } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { PayoutService } from '../../services/payoutService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';

interface CalculatePayoutRequest {
  businessId: string;
  dateFrom: string;
  dateTo: string;
  includeAdjustments?: boolean;
  currency?: string;
}

interface CalculatePayoutResponse {
  businessId: string;
  businessName: string;
  period: {
    from: Date;
    to: Date;
  };
  summary: {
    totalRevenue: number;
    totalPlatformFees: number;
    totalAdjustments: number;
    netPayoutAmount: number;
    transactionCount: number;
    refundCount: number;
  };
  transactions: PayoutTransaction[];
  adjustments: PayoutAdjustment[];
  currency: string;
  calculatedAt: Date;
}

interface PayoutTransaction {
  paymentIntentId: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  capturedAt: Date;
  reservationId?: string;
  description?: string;
}

interface PayoutAdjustment {
  id: string;
  type: 'refund_deduction' | 'dispute_deduction' | 'fee_adjustment' | 'manual_adjustment';
  amount: number;
  description: string;
  createdAt: Date;
}

// Validation schema for calculate payout
const calculatePayoutSchema = {
  type: 'object',
  required: ['businessId', 'dateFrom', 'dateTo'],
  properties: {
    businessId: {
      type: 'string',
      format: 'uuid'
    },
    dateFrom: {
      type: 'string',
      format: 'date'
    },
    dateTo: {
      type: 'string',
      format: 'date'
    },
    includeAdjustments: {
      type: 'boolean'
    },
    currency: {
      type: 'string',
      enum: ['USD', 'CAD', 'EUR', 'GBP']
    }
  },
  additionalProperties: false
};

/**
 * Calculate Payout Lambda Handler
 * 
 * Calculates detailed payout amounts for a business including platform fees,
 * adjustments, refunds, and provides comprehensive transaction breakdown.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: CalculatePayoutRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'payout_calculate',
        entityType: 'payout',
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
      requestBody = JSON.parse(event.body) as CalculatePayoutRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(calculatePayoutSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Validate date range
    const dateFrom = new Date(requestBody.dateFrom);
    const dateTo = new Date(requestBody.dateTo);
    
    if (dateFrom >= dateTo) {
      return badRequest('dateFrom must be before dateTo');
    }

    // Validate date range is not too large (max 1 year)
    const daysDifference = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 365) {
      return badRequest('Date range cannot exceed 365 days');
    }

    // Verify business exists and user has authorization
    const businessQuery = `
      SELECT b.id, b.name, b.owner_id, b.status, b.currency, b.stripe_account_id
      FROM businesses b
      WHERE b.id = $1
    `;
    
    const businessResult = await pool.query(businessQuery, [requestBody.businessId]);
    
    if (businessResult.rows.length === 0) {
      return badRequest('Business not found');
    }

    const business = businessResult.rows[0];

    // Verify user authorization (business owner, admin, or accounting role)
    const isBusinessOwner = business.owner_id === userId;
    const isAdmin = userRole === 'admin';
    const isAccounting = userRole === 'accounting';

    if (!isBusinessOwner && !isAdmin && !isAccounting) {
      await auditLogger({
        operation: 'payout_calculate',
        entityType: 'payout',
        entityId: '',
        userId,
        businessId: requestBody.businessId,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to calculate payouts for this business');
    }

    // Verify business is active and has Stripe account
    if (business.status !== 'active') {
      return badRequest('Business is not active');
    }

    if (!business.stripe_account_id) {
      return badRequest('Business does not have payment processing configured');
    }

    // Set currency from business or request
    const currency = requestBody.currency || business.currency || 'USD';

    // Get captured transactions within date range
    const transactionsQuery = `
      SELECT pt.payment_intent_id, pt.amount, pt.platform_fee, pt.business_payout,
             pt.captured_at, pt.reservation_id, pt.metadata,
             r.service_date, r.description as reservation_description
      FROM payment_transactions pt
      LEFT JOIN reservations r ON pt.reservation_id = r.id
      WHERE pt.business_id = $1 
        AND pt.status = 'succeeded' 
        AND pt.captured_at BETWEEN $2 AND $3
        AND pt.currency = $4
      ORDER BY pt.captured_at DESC
    `;
    
    const transactionsResult = await pool.query(transactionsQuery, [
      requestBody.businessId,
      dateFrom,
      dateTo,
      currency
    ]);

    // Get adjustments within date range
    let adjustments: PayoutAdjustment[] = [];
    if (requestBody.includeAdjustments !== false) {
      const adjustmentsQuery = `
        SELECT bpa.id, bpa.adjustment_type, bpa.adjustment_amount, bpa.reason, bpa.created_at
        FROM business_payout_adjustments bpa
        WHERE bpa.business_id = $1 
          AND bpa.created_at BETWEEN $2 AND $3
        ORDER BY bpa.created_at DESC
      `;
      
      const adjustmentsResult = await pool.query(adjustmentsQuery, [
        requestBody.businessId,
        dateFrom,
        dateTo
      ]);

      adjustments = adjustmentsResult.rows.map(row => ({
        id: row.id,
        type: row.adjustment_type,
        amount: parseFloat(row.adjustment_amount) || 0,
        description: row.reason,
        createdAt: new Date(row.created_at)
      }));
    }

    // Calculate summary metrics
    const transactions: PayoutTransaction[] = transactionsResult.rows.map(row => ({
      paymentIntentId: row.payment_intent_id,
      amount: parseFloat(row.amount) || 0,
      platformFee: parseFloat(row.platform_fee) || 0,
      netAmount: parseFloat(row.business_payout) || 0,
      capturedAt: new Date(row.captured_at),
      reservationId: row.reservation_id,
      description: row.reservation_description || (row.metadata ? 
        (typeof row.metadata === 'string' ? JSON.parse(row.metadata).description : row.metadata.description) 
        : undefined)
    }));

    const totalRevenue = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalPlatformFees = transactions.reduce((sum, txn) => sum + txn.platformFee, 0);
    const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
    const grossPayoutAmount = transactions.reduce((sum, txn) => sum + txn.netAmount, 0);
    const netPayoutAmount = grossPayoutAmount + totalAdjustments; // Adjustments can be negative

    // Use payout service for any additional calculations or validations
    const payoutService = new PayoutService();
    
    // Validate calculations if needed
    try {
      await payoutService.validatePayoutCalculation({
        businessId: requestBody.businessId,
        totalRevenue,
        totalPlatformFees,
        netPayoutAmount,
        currency
      });
    } catch (validationError) {
      logger.warn('Payout calculation validation warning', {
        businessId: requestBody.businessId,
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        correlationId
      });
    }

    // Audit log success
    await auditLogger({
      operation: 'payout_calculate',
      entityType: 'payout',
      entityId: '',
      userId,
      businessId: requestBody.businessId,
      correlationId,
      success: true,
      metadata: {
        dateFrom: requestBody.dateFrom,
        dateTo: requestBody.dateTo,
        totalRevenue,
        netPayoutAmount,
        transactionCount: transactions.length,
        currency
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payout calculation completed successfully', {
      businessId: requestBody.businessId,
      businessName: business.name,
      dateFrom: requestBody.dateFrom,
      dateTo: requestBody.dateTo,
      totalRevenue,
      netPayoutAmount,
      transactionCount: transactions.length,
      adjustmentCount: adjustments.length,
      currency,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: CalculatePayoutResponse = {
      businessId: requestBody.businessId,
      businessName: business.name,
      period: {
        from: dateFrom,
        to: dateTo
      },
      summary: {
        totalRevenue,
        totalPlatformFees,
        totalAdjustments,
        netPayoutAmount,
        transactionCount: transactions.length,
        refundCount: adjustments.filter(adj => adj.type === 'refund_deduction').length
      },
      transactions,
      adjustments,
      currency,
      calculatedAt: new Date()
    };

    return success(response, `Payout calculated for ${transactions.length} transactions`);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in calculate payout', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse'
    });

    await auditLogger({
      operation: 'payout_calculate',
      entityType: 'payout',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      businessId: requestBody?.businessId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};