import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  badRequest,
  internalServerError,
  success,
  unauthorized,
} from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface PayoutHistoryResponse {
  businessId: string;
  businessName: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  summary: {
    totalPayouts: number;
    totalAmount: number;
    currency: string;
    lastPayoutDate?: Date;
  };
  payouts: PayoutHistoryItem[];
}

interface PayoutHistoryItem {
  id: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: string;
  payoutType: string;
  description?: string;
  transactionCount: number;
  expectedPayoutDate: Date;
  paidAt?: Date;
  stripePayoutId?: string;
  failureReason?: string;
  createdAt: Date;
}

/**
 * Get Payout History Lambda Handler
 *
 * Retrieves paginated payout history for a business with filtering options.
 * Supports business owners and admins with appropriate data access controls.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();

  try {
    // Security headers and input sanitization
    sanitizeInput(event);

    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;

    if (!userId) {
      await auditLogger({
        operation: 'payout_history_get',
        entityType: 'payout',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication',
      });
      return unauthorized('Authentication required');
    }

    // Extract business ID from path parameters
    const businessId = event.pathParameters?.businessId;

    if (!businessId) {
      return badRequest('Business ID is required');
    }

    // Validate business ID format
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}$/i.test(businessId)
    ) {
      return badRequest('Invalid business ID format');
    }

    // Extract query parameters for filtering and pagination
    const queryParams = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(queryParams.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20')));
    const status = queryParams.status; // Filter by status
    const dateFrom = queryParams.dateFrom ? new Date(queryParams.dateFrom) : null;
    const dateTo = queryParams.dateTo ? new Date(queryParams.dateTo) : null;
    const payoutType = queryParams.payoutType; // Filter by payout type

    // Verify business exists and user has authorization
    const businessQuery = `
      SELECT b.id, b.name, b.owner_id, b.status, b.currency
      FROM businesses b
      WHERE b.id = $1
    `;

    const businessResult = await pool.query(businessQuery, [businessId]);

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
        operation: 'payout_history_get',
        entityType: 'payout',
        entityId: '',
        userId,
        businessId,
        correlationId,
        success: false,
        error: 'Insufficient permissions',
      });
      return unauthorized('You do not have permission to view payout history for this business');
    }

    // Build dynamic WHERE clause for filtering
    const whereConditions = ['bp.business_id = $1'];
    const queryValues: unknown[] = [businessId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`bp.status = $${paramIndex}`);
      queryValues.push(status);
      paramIndex++;
    }

    if (payoutType) {
      whereConditions.push(`bp.payout_type = $${paramIndex}`);
      queryValues.push(payoutType);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`bp.created_at >= $${paramIndex}`);
      queryValues.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`bp.created_at <= $${paramIndex}`);
      queryValues.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM business_payouts bp
      WHERE ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryValues);
    const total = parseInt(countResult.rows[0].total) || 0;

    // Calculate pagination info
    const offset = (page - 1) * limit;
    const hasNext = offset + limit < total;
    const hasPrevious = page > 1;

    // Get payout history with pagination
    const payoutsQuery = `
      SELECT bp.id, bp.amount, bp.platform_fee, bp.net_amount, bp.currency,
             bp.status, bp.payout_type, bp.description, bp.transaction_count,
             bp.expected_payout_date, bp.paid_at, bp.stripe_payout_id,
             bp.failure_reason, bp.created_at
      FROM business_payouts bp
      WHERE ${whereClause}
      ORDER BY bp.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryValues.push(limit, offset);
    const payoutsResult = await pool.query(payoutsQuery, queryValues);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_payouts,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN net_amount ELSE 0 END), 0) as total_amount,
        MAX(paid_at) as last_payout_date,
        currency
      FROM business_payouts bp
      WHERE bp.business_id = $1
      GROUP BY currency
    `;

    const summaryResult = await pool.query(summaryQuery, [businessId]);
    const summary = summaryResult.rows[0] || {
      total_payouts: 0,
      total_amount: 0,
      currency: business.currency || 'USD',
      last_payout_date: null,
    };

    // Map results to response format
    const payouts: PayoutHistoryItem[] = payoutsResult.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount) || 0,
      platformFee: parseFloat(row.platform_fee) || 0,
      netAmount: parseFloat(row.net_amount) || 0,
      currency: row.currency,
      status: row.status,
      payoutType: row.payout_type,
      description: row.description,
      transactionCount: parseInt(row.transaction_count) || 0,
      expectedPayoutDate: new Date(row.expected_payout_date),
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      stripePayoutId: row.stripe_payout_id,
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at),
    }));

    // Audit log access
    await auditLogger({
      operation: 'payout_history_get',
      entityType: 'payout',
      entityId: '',
      userId,
      businessId,
      correlationId,
      success: true,
      metadata: {
        page,
        limit,
        total,
        filters: {
          status,
          payoutType,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        },
        accessType: isBusinessOwner ? 'business_owner' : isAdmin ? 'admin' : 'finance',
      },
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payout history retrieved successfully', {
      businessId,
      businessName: business.name,
      page,
      limit,
      total,
      resultCount: payouts.length,
      userId,
      accessType: isBusinessOwner ? 'business_owner' : isAdmin ? 'admin' : 'finance',
      correlationId,
      processingTimeMs: processingTime,
    });

    // Prepare response
    const response: PayoutHistoryResponse = {
      businessId,
      businessName: business.name,
      pagination: {
        page,
        limit,
        total,
        hasNext,
        hasPrevious,
      },
      summary: {
        totalPayouts: parseInt(summary.total_payouts) || 0,
        totalAmount: parseFloat(summary.total_amount) || 0,
        currency: summary.currency,
        lastPayoutDate: summary.last_payout_date ? new Date(summary.last_payout_date) : undefined,
      },
      payouts,
    };

    return success(response);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log unexpected errors
    logger.error('Unexpected error in get payout history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      businessId: event.pathParameters?.businessId,
    });

    await auditLogger({
      operation: 'payout_history_get',
      entityType: 'payout',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      businessId: event.pathParameters?.businessId || '',
      correlationId,
      success: false,
      error: 'Internal server error',
    });

    return internalServerError(
      'An unexpected error occurred. Please try again or contact support.'
    );
  }
};
