import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, notFound, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface PaymentStatusResponse {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  capturedAmount?: number;
  platformFee?: number;
  businessPayout?: number;
  escrowEnabled: boolean;
  createdAt: Date;
  confirmedAt?: Date;
  capturedAt?: Date;
  businessId: string;
  businessName: string;
  reservationId?: string;
  serviceId?: string;
  metadata?: Record<string, unknown>;
  timeline: PaymentTimelineEvent[];
}

interface PaymentTimelineEvent {
  timestamp: Date;
  event: string;
  description: string;
  amount?: number;
}

/**
 * Get Payment Status Lambda Handler
 * 
 * Retrieves comprehensive payment status information including timeline and escrow details.
 * Supports both customers and business owners with appropriate data filtering.
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
        operation: 'payment_status_get',
        entityType: 'payment_intent',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Extract payment intent ID from path parameters
    const paymentIntentId = event.pathParameters?.paymentIntentId;
    
    if (!paymentIntentId) {
      return badRequest('Payment intent ID is required');
    }

    // Validate payment intent ID format
    if (!/^pi_[a-zA-Z0-9]{24,}$/.test(paymentIntentId)) {
      return badRequest('Invalid payment intent ID format');
    }

    // Get comprehensive payment information
    const paymentQuery = `
      SELECT pt.id, pt.payment_intent_id, pt.business_id, pt.user_id, pt.status,
             pt.amount, pt.currency, pt.captured_amount, pt.platform_fee, pt.business_payout,
             pt.escrow_enabled, pt.created_at, pt.confirmed_at, pt.captured_at,
             pt.reservation_id, pt.service_id, pt.metadata, pt.payment_method_id,
             b.owner_id as business_owner_id, b.name as business_name, b.status as business_status,
             u.email as customer_email, u.profile as customer_profile,
             r.service_date, r.completion_status as reservation_status
      FROM payment_transactions pt
      JOIN businesses b ON pt.business_id = b.id
      JOIN users u ON pt.user_id = u.id
      LEFT JOIN reservations r ON pt.reservation_id = r.id
      WHERE pt.payment_intent_id = $1
    `;
    
    const paymentResult = await pool.query(paymentQuery, [paymentIntentId]);
    
    if (paymentResult.rows.length === 0) {
      await auditLogger({
        operation: 'payment_status_get',
        entityType: 'payment_intent',
        entityId: paymentIntentId,
        userId,
        correlationId,
        success: false,
        error: 'Payment intent not found'
      });
      return notFound('Payment intent not found');
    }

    const paymentRecord = paymentResult.rows[0];

    // Verify user authorization
    const isCustomer = paymentRecord.user_id === userId;
    const isBusinessOwner = paymentRecord.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'payment_status_get',
        entityType: 'payment_intent',
        entityId: paymentIntentId,
        userId,
        businessId: paymentRecord.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to view this payment');
    }

    // Get payment timeline/audit events
    const timelineQuery = `
      SELECT pal.timestamp, pal.operation_type, pal.success, pal.metadata
      FROM payment_audit_logs pal
      WHERE pal.entity_id = $1 AND pal.entity_type = 'payment_intent'
      ORDER BY pal.timestamp ASC
    `;
    
    const timelineResult = await pool.query(timelineQuery, [paymentIntentId]);
    
    // Build timeline events
    const timeline: PaymentTimelineEvent[] = [];
    
    timelineResult.rows.forEach(row => {
      let description = '';
      let amount: number | undefined;
      
      switch (row.operation_type) {
        case 'payment_intent_create':
          description = 'Payment intent created';
          amount = paymentRecord.amount;
          break;
        case 'payment_confirm':
          description = row.success ? 'Payment confirmed' : 'Payment confirmation failed';
          break;
        case 'payment_capture':
          description = row.success ? 'Payment captured from escrow' : 'Payment capture failed';
          amount = paymentRecord.captured_amount;
          break;
        case 'refund_create':
          description = row.success ? 'Refund processed' : 'Refund failed';
          if (row.metadata && typeof row.metadata === 'object') {
            amount = parseInt(row.metadata.amount) || undefined;
          }
          break;
        default:
          description = `${row.operation_type.replace(/_/g, ' ')} ${row.success ? 'completed' : 'failed'}`;
      }
      
      timeline.push({
        timestamp: new Date(row.timestamp),
        event: row.operation_type,
        description,
        amount
      });
    });

    // Add initial timeline event if not present
    if (timeline.length === 0 || timeline[0].event !== 'payment_intent_create') {
      timeline.unshift({
        timestamp: new Date(paymentRecord.created_at),
        event: 'payment_intent_create',
        description: 'Payment intent created',
        amount: paymentRecord.amount
      });
    }

    // Audit log access
    await auditLogger({
      operation: 'payment_status_get',
      entityType: 'payment_intent',
      entityId: paymentIntentId,
      userId,
      businessId: paymentRecord.business_id,
      correlationId,
      success: true,
      metadata: {
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: paymentRecord.status,
        accessType: isCustomer ? 'customer' : isBusinessOwner ? 'business_owner' : 'admin'
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Payment status retrieved successfully', {
      paymentIntentId,
      status: paymentRecord.status,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      userId,
      businessId: paymentRecord.business_id,
      accessType: isCustomer ? 'customer' : isBusinessOwner ? 'business_owner' : 'admin',
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response (filter sensitive data based on user role)
    const response: PaymentStatusResponse = {
      paymentIntentId: paymentRecord.payment_intent_id,
      status: paymentRecord.status,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      escrowEnabled: paymentRecord.escrow_enabled,
      createdAt: new Date(paymentRecord.created_at),
      businessId: paymentRecord.business_id,
      businessName: paymentRecord.business_name,
      timeline
    };

    // Add optional fields if available
    if (paymentRecord.captured_amount) {
      response.capturedAmount = paymentRecord.captured_amount;
    }
    
    if (paymentRecord.platform_fee) {
      response.platformFee = paymentRecord.platform_fee;
    }
    
    if (paymentRecord.business_payout) {
      response.businessPayout = paymentRecord.business_payout;
    }
    
    if (paymentRecord.confirmed_at) {
      response.confirmedAt = new Date(paymentRecord.confirmed_at);
    }
    
    if (paymentRecord.captured_at) {
      response.capturedAt = new Date(paymentRecord.captured_at);
    }
    
    if (paymentRecord.reservation_id) {
      response.reservationId = paymentRecord.reservation_id;
    }
    
    if (paymentRecord.service_id) {
      response.serviceId = paymentRecord.service_id;
    }

    // Add metadata (filter sensitive information for customers)
    if (paymentRecord.metadata) {
      try {
        const metadata = typeof paymentRecord.metadata === 'string' 
          ? JSON.parse(paymentRecord.metadata) 
          : paymentRecord.metadata;
        
        if (isCustomer) {
          // Filter out sensitive business information for customers
          response.metadata = {
            description: metadata.description,
            reservationId: metadata.reservationId,
            serviceId: metadata.serviceId
          };
        } else {
          // Business owners and admins get full metadata
          response.metadata = metadata;
        }
      } catch (parseError) {
        logger.warn('Failed to parse payment metadata', {
          paymentIntentId,
          metadata: paymentRecord.metadata,
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
      }
    }

    return success(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in get payment status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      paymentIntentId: event.pathParameters?.paymentIntentId
    });

    await auditLogger({
      operation: 'payment_status_get',
      entityType: 'payment_intent',
      entityId: event.pathParameters?.paymentIntentId || '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};