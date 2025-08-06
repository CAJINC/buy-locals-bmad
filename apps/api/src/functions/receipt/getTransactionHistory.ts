import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface TransactionHistoryRequest {
  businessId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  status?: string[];
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  sortBy?: 'date' | 'amount' | 'status' | 'business';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface TransactionHistoryItem {
  id: string;
  receiptNumber: string;
  transactionId: string;
  paymentIntentId: string;
  businessId: string;
  businessName: string;
  businessLogo?: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  platformFee: number;
  businessPayout: number;
  taxAmount: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  refundedAt?: string;
  refundAmount?: number;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  receiptAvailable: boolean;
  downloadUrl?: string;
}

interface TransactionHistoryResponse {
  transactions: TransactionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    totalAmount: number;
    totalTransactions: number;
    totalRefunded: number;
    averageTransactionAmount: number;
    statusBreakdown: Record<string, number>;
  };
  filters: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    appliedFilters: string[];
  };
}

/**
 * Get Transaction History Lambda Handler
 * 
 * Retrieves paginated transaction history with advanced filtering and sorting options.
 * Supports both business owners viewing their transactions and customers viewing their purchases.
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
        operation: 'transaction_history',
        entityType: 'transaction',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    const request: TransactionHistoryRequest = {
      businessId: queryParams.businessId,
      customerId: queryParams.customerId,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      status: queryParams.status ? queryParams.status.split(',') : undefined,
      paymentMethod: queryParams.paymentMethod,
      minAmount: queryParams.minAmount ? parseFloat(queryParams.minAmount) * 100 : undefined, // Convert to cents
      maxAmount: queryParams.maxAmount ? parseFloat(queryParams.maxAmount) * 100 : undefined, // Convert to cents
      searchQuery: queryParams.searchQuery,
      sortBy: (queryParams.sortBy as TransactionHistoryRequest['sortBy']) || 'date',
      sortOrder: (queryParams.sortOrder as TransactionHistoryRequest['sortOrder']) || 'desc',
      page: parseInt(queryParams.page || '1'),
      limit: Math.min(parseInt(queryParams.limit || '20'), 100) // Max 100 per page
    };

    // Validate pagination parameters
    if ((request.page || 1) < 1) {
      return badRequest('Page must be greater than 0');
    }

    if ((request.limit || 20) < 1 || (request.limit || 20) > 100) {
      return badRequest('Limit must be between 1 and 100');
    }

    // Authorization and filter validation
    let authorizedBusinessIds: string[] = [];
    let authorizedCustomerId: string | null = null;

    if (userRole === 'admin') {
      // Admin can see all transactions with specified filters
    } else {
      // Regular users can only see their own transactions
      if (request.businessId) {
        // Check if user owns this business
        const businessOwnershipQuery = `
          SELECT id FROM businesses WHERE id = $1 AND owner_id = $2
        `;
        const ownershipResult = await pool.query(businessOwnershipQuery, [request.businessId, userId]);
        
        if (ownershipResult.rows.length === 0) {
          return unauthorized('You do not have permission to view transactions for this business');
        }
        authorizedBusinessIds = [request.businessId];
      } else {
        // Get all businesses owned by user
        const userBusinessesQuery = `
          SELECT id FROM businesses WHERE owner_id = $1
        `;
        const businessesResult = await pool.query(userBusinessesQuery, [userId]);
        authorizedBusinessIds = businessesResult.rows.map(row => row.id);
        
        // If user is not a business owner, they can only see their customer transactions
        if (authorizedBusinessIds.length === 0) {
          authorizedCustomerId = userId;
        }
      }
    }

    // Build query conditions
    const conditions: string[] = [];
    const queryValues: unknown[] = [];
    let paramIndex = 1;

    // Authorization filters
    if (authorizedCustomerId) {
      conditions.push(`pt.user_id = $${paramIndex++}`);
      queryValues.push(authorizedCustomerId);
    } else if (authorizedBusinessIds.length > 0) {
      const businessPlaceholders = authorizedBusinessIds.map(() => `$${paramIndex++}`).join(',');
      conditions.push(`pt.business_id IN (${businessPlaceholders})`);
      queryValues.push(...authorizedBusinessIds);
    }

    // Additional filters
    if (request.customerId && userRole === 'admin') {
      conditions.push(`pt.user_id = $${paramIndex++}`);
      queryValues.push(request.customerId);
    }

    if (request.startDate) {
      conditions.push(`pt.created_at >= $${paramIndex++}`);
      queryValues.push(new Date(request.startDate));
    }

    if (request.endDate) {
      conditions.push(`pt.created_at <= $${paramIndex++}`);
      queryValues.push(new Date(request.endDate));
    }

    if (request.status && request.status.length > 0) {
      const statusPlaceholders = request.status.map(() => `$${paramIndex++}`).join(',');
      conditions.push(`pt.status IN (${statusPlaceholders})`);
      queryValues.push(...request.status);
    }

    if (request.minAmount) {
      conditions.push(`pt.amount >= $${paramIndex++}`);
      queryValues.push(request.minAmount);
    }

    if (request.maxAmount) {
      conditions.push(`pt.amount <= $${paramIndex++}`);
      queryValues.push(request.maxAmount);
    }

    if (request.searchQuery) {
      conditions.push(`(
        b.name ILIKE $${paramIndex} OR 
        pt.id::text ILIKE $${paramIndex} OR
        r.receipt_number ILIKE $${paramIndex} OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex}
      )`);
      queryValues.push(`%${request.searchQuery}%`);
      paramIndex++;
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderByClause = '';
    switch (request.sortBy) {
      case 'date':
        orderByClause = `ORDER BY pt.created_at ${request.sortOrder}`;
        break;
      case 'amount':
        orderByClause = `ORDER BY pt.amount ${request.sortOrder}`;
        break;
      case 'status':
        orderByClause = `ORDER BY pt.status ${request.sortOrder}, pt.created_at DESC`;
        break;
      case 'business':
        orderByClause = `ORDER BY b.name ${request.sortOrder}, pt.created_at DESC`;
        break;
      default:
        orderByClause = `ORDER BY pt.created_at ${request.sortOrder}`;
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      LEFT JOIN receipts r ON pt.id = r.transaction_id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryValues);
    const totalCount = parseInt(countResult.rows[0].total_count);

    // Calculate pagination
    const offset = ((request.page || 1) - 1) * (request.limit || 20);
    const totalPages = Math.ceil(totalCount / (request.limit || 20));
    const hasMore = (request.page || 1) < totalPages;

    // Get transactions with pagination
    const transactionsQuery = `
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
        pt.status,
        pt.created_at,
        pt.refunded_at,
        pt.refund_amount,
        pt.metadata,
        -- Business details
        b.name as business_name,
        b.logo_url as business_logo,
        -- Customer details
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        -- Receipt details
        r.id as receipt_id,
        r.receipt_number,
        r.download_url
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      LEFT JOIN receipts r ON pt.id = r.transaction_id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryValues.push(request.limit, offset);

    const transactionsResult = await pool.query(transactionsQuery, queryValues);

    // Get transaction items for each transaction
    const transactionIds = transactionsResult.rows.map(row => row.id);
    const transactionItems: Record<string, TransactionItem[]> = {};

    if (transactionIds.length > 0) {
      const itemsQuery = `
        SELECT 
          transaction_id,
          id,
          name,
          quantity,
          unit_price,
          total_price
        FROM transaction_items
        WHERE transaction_id = ANY($1)
        ORDER BY transaction_id, created_at
      `;

      const itemsResult = await pool.query(itemsQuery, [transactionIds]);
      
      // Group items by transaction ID
      itemsResult.rows.forEach(item => {
        if (!transactionItems[item.transaction_id]) {
          transactionItems[item.transaction_id] = [];
        }
        transactionItems[item.transaction_id].push({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price
        });
      });
    }

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(pt.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN pt.status = 'refunded' THEN pt.refund_amount ELSE 0 END), 0) as total_refunded,
        COALESCE(AVG(pt.amount), 0) as average_amount,
        pt.status,
        COUNT(*) as status_count
      FROM payment_transactions pt
      INNER JOIN businesses b ON pt.business_id = b.id
      INNER JOIN users u ON pt.user_id = u.id
      ${whereClause}
      GROUP BY ROLLUP(pt.status)
      ORDER BY pt.status NULLS LAST
    `;

    const summaryResult = await pool.query(summaryQuery, queryValues.slice(0, -2)); // Remove limit and offset

    // Process summary data
    let totalAmount = 0;
    let totalTransactions = 0;
    let totalRefunded = 0;
    let averageAmount = 0;
    const statusBreakdown: Record<string, number> = {};

    summaryResult.rows.forEach(row => {
      if (row.status === null) {
        // This is the ROLLUP total row
        totalAmount = row.total_amount;
        totalTransactions = row.total_transactions;
        totalRefunded = row.total_refunded;
        averageAmount = row.average_amount;
      } else {
        statusBreakdown[row.status] = row.status_count;
      }
    });

    // Build response data
    const transactions: TransactionHistoryItem[] = transactionsResult.rows.map(row => ({
      id: row.id,
      receiptNumber: row.receipt_number || `TXN-${row.id.substring(0, 8)}`,
      transactionId: row.id,
      paymentIntentId: row.payment_intent_id,
      businessId: row.business_id,
      businessName: row.business_name,
      businessLogo: row.business_logo,
      customerId: row.customer_id,
      customerName: `${row.customer_first_name} ${row.customer_last_name}`,
      amount: row.amount,
      currency: row.currency,
      platformFee: row.platform_fee || 0,
      businessPayout: row.business_amount || 0,
      taxAmount: row.tax_amount || 0,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      refundedAt: row.refunded_at?.toISOString(),
      refundAmount: row.refund_amount,
      items: transactionItems[row.id] || [],
      receiptAvailable: !!row.receipt_id,
      downloadUrl: row.download_url
    }));

    // Audit log success
    await auditLogger({
      operation: 'transaction_history',
      entityType: 'transaction',
      entityId: '',
      userId,
      correlationId,
      success: true,
      metadata: {
        page: request.page,
        limit: request.limit,
        totalCount,
        filtersApplied: Object.keys(request).filter(key => 
          request[key as keyof TransactionHistoryRequest] !== undefined && 
          key !== 'page' && 
          key !== 'limit'
        )
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Transaction history retrieved successfully', {
      userId,
      totalCount,
      page: request.page,
      limit: request.limit,
      filtersApplied: conditions.length,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: TransactionHistoryResponse = {
      transactions,
      pagination: {
        page: request.page || 1,
        limit: request.limit || 20,
        totalCount,
        totalPages,
        hasMore
      },
      summary: {
        totalAmount,
        totalTransactions,
        totalRefunded,
        averageTransactionAmount: averageAmount,
        statusBreakdown
      },
      filters: {
        dateRange: {
          startDate: request.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: request.endDate || new Date().toISOString()
        },
        appliedFilters: Object.keys(request).filter(key => 
          request[key as keyof TransactionHistoryRequest] !== undefined && 
          key !== 'page' && 
          key !== 'limit' &&
          key !== 'sortBy' &&
          key !== 'sortOrder'
        )
      }
    };

    return success(response, 'Transaction history retrieved successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in get transaction history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      queryParams: event.queryStringParameters
    });

    await auditLogger({
      operation: 'transaction_history',
      entityType: 'transaction',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred while retrieving transaction history. Please try again or contact support.');
  }
};