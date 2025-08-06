import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, notFound, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface RefundStatusResponse {
  refundId: string;
  paymentIntentId: string;
  amount: number;
  reason?: string;
  reasonCode?: string;
  status: string;
  businessAdjustment: number;
  platformFeeRefund: number;
  createdAt: Date;
  processedAt?: Date;
  expectedRefundDate?: Date;
  businessId: string;
  businessName: string;
  initiatedBy: string;
  timeline: RefundTimelineEvent[];
}

interface RefundTimelineEvent {
  timestamp: Date;
  event: string;
  description: string;
  status?: string;
}

/**
 * Get Refund Status Lambda Handler
 * 
 * Retrieves comprehensive refund status information including processing timeline.
 * Supports both customers and business owners with appropriate data filtering.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'refund_status_get',
        entityType: 'refund',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Extract refund ID from path parameters
    const refundId = event.pathParameters?.refundId;
    
    if (!refundId) {
      return badRequest('Refund ID is required');
    }

    // Validate refund ID format (Stripe refund ID or UUID)
    if (!/^(re_[a-zA-Z0-9]{24,}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12})$/i.test(refundId)) {
      return badRequest('Invalid refund ID format');
    }

    // Get comprehensive refund information
    const refundQuery = `
      SELECT r.id, r.refund_id, r.payment_intent_id, r.business_id, r.user_id,
             r.amount, r.reason, r.reason_code, r.status, r.business_adjustment,
             r.platform_fee_refund, r.initiated_by, r.created_at, r.processed_at,
             r.metadata, r.correlation_id,
             pt.amount as original_amount, pt.currency, pt.captured_amount,
             b.owner_id as business_owner_id, b.name as business_name, b.status as business_status,
             u.email as customer_email, u.profile as customer_profile
      FROM refunds r
      JOIN payment_transactions pt ON r.payment_intent_id = pt.payment_intent_id
      JOIN businesses b ON r.business_id = b.id
      JOIN users u ON r.user_id = u.id
      WHERE r.refund_id = $1
    `;
    
    const refundResult = await pool.query(refundQuery, [refundId]);
    
    if (refundResult.rows.length === 0) {
      await auditLogger({
        operation: 'refund_status_get',
        entityType: 'refund',
        entityId: refundId,
        userId,
        correlationId,
        success: false,
        error: 'Refund not found'
      });
      return notFound('Refund not found');
    }

    const refundRecord = refundResult.rows[0];

    // Verify user authorization
    const isCustomer = refundRecord.user_id === userId;
    const isBusinessOwner = refundRecord.business_owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isBusinessOwner && !isAdmin) {
      await auditLogger({
        operation: 'refund_status_get',
        entityType: 'refund',
        entityId: refundId,
        userId,
        businessId: refundRecord.business_id,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to view this refund');
    }

    // Get refund timeline/audit events
    const timelineQuery = `
      SELECT pal.timestamp, pal.operation_type, pal.success, pal.metadata
      FROM payment_audit_logs pal
      WHERE pal.entity_id = $1 AND pal.entity_type = 'refund'
      ORDER BY pal.timestamp ASC
    `;
    
    const timelineResult = await pool.query(timelineQuery, [refundId]);
    
    // Build timeline events
    const timeline: RefundTimelineEvent[] = [];
    
    // Add initial refund creation event
    timeline.push({
      timestamp: new Date(refundRecord.created_at),
      event: 'refund_initiated',
      description: `Refund initiated by ${refundRecord.initiated_by}`,
      status: 'pending'
    });
    
    timelineResult.rows.forEach(row => {
      let description = '';
      let status: string | undefined;
      
      switch (row.operation_type) {
        case 'refund_create':
          if (row.success) {
            description = 'Refund request submitted to payment processor';
            status = 'processing';
          } else {
            description = 'Refund request failed';
            status = 'failed';
          }
          break;
        case 'refund_process':
          if (row.success) {
            description = 'Refund processed successfully';
            status = 'succeeded';
          } else {
            description = 'Refund processing failed';
            status = 'failed';
          }
          break;
        case 'refund_complete':
          description = 'Refund completed and funds returned';
          status = 'completed';
          break;
        default:
          description = `${row.operation_type.replace(/_/g, ' ')} ${row.success ? 'completed' : 'failed'}`;
      }
      
      timeline.push({
        timestamp: new Date(row.timestamp),
        event: row.operation_type,
        description,
        status
      });
    });

    // Add expected completion timeline event if still processing
    if (refundRecord.status === 'pending' || refundRecord.status === 'processing') {
      const expectedDate = new Date(refundRecord.created_at);
      expectedDate.setDate(expectedDate.getDate() + 7); // 5-7 business days
      
      timeline.push({
        timestamp: expectedDate,
        event: 'refund_expected_completion',
        description: 'Expected refund completion date (may vary by payment method)',
        status: 'expected'
      });
    }

    // Calculate expected refund date
    let expectedRefundDate: Date | undefined;
    if (refundRecord.status !== 'succeeded' && refundRecord.status !== 'failed') {
      expectedRefundDate = new Date(refundRecord.created_at);
      expectedRefundDate.setDate(expectedRefundDate.getDate() + 7);
    }

    // Audit log access
    await auditLogger({
      operation: 'refund_status_get',
      entityType: 'refund',
      entityId: refundId,
      userId,
      businessId: refundRecord.business_id,
      correlationId,
      success: true,
      metadata: {
        amount: refundRecord.amount,
        status: refundRecord.status,
        accessType: isCustomer ? 'customer' : isBusinessOwner ? 'business_owner' : 'admin'
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Refund status retrieved successfully', {
      refundId,
      paymentIntentId: refundRecord.payment_intent_id,
      status: refundRecord.status,
      amount: refundRecord.amount,
      userId,
      businessId: refundRecord.business_id,
      accessType: isCustomer ? 'customer' : isBusinessOwner ? 'business_owner' : 'admin',
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: RefundStatusResponse = {
      refundId: refundRecord.refund_id,
      paymentIntentId: refundRecord.payment_intent_id,
      amount: refundRecord.amount,
      reason: refundRecord.reason,
      reasonCode: refundRecord.reason_code,
      status: refundRecord.status,
      businessAdjustment: refundRecord.business_adjustment,
      platformFeeRefund: refundRecord.platform_fee_refund,
      createdAt: new Date(refundRecord.created_at),
      businessId: refundRecord.business_id,
      businessName: refundRecord.business_name,
      initiatedBy: refundRecord.initiated_by,
      timeline
    };

    // Add optional fields if available
    if (refundRecord.processed_at) {
      response.processedAt = new Date(refundRecord.processed_at);
    }
    
    if (expectedRefundDate) {
      response.expectedRefundDate = expectedRefundDate;
    }

    return success(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in get refund status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      refundId: event.pathParameters?.refundId
    });

    await auditLogger({
      operation: 'refund_status_get',
      entityType: 'refund',
      entityId: event.pathParameters?.refundId || '',
      userId: event.requestContext.authorizer?.userId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};