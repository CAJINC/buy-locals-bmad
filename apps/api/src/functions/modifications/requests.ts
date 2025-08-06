import { APIGatewayProxyHandler } from 'aws-lambda';
import { createResponse, parseJSON } from '../../utils/apiResponse';
import { validateRequestBody } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { reservationModificationService } from '../../services/reservationModificationService';
import { z } from 'zod';

const createModificationRequestSchema = z.object({
  reservationId: z.string().uuid(),
  type: z.enum([
    'date_time',
    'service_type',
    'duration',
    'customer_info',
    'requirements',
    'add_services',
    'remove_services',
    'party_size',
    'special_requests'
  ]),
  proposedChanges: z.record(z.any()),
  reason: z.string().optional(),
  customerMessage: z.string().max(500).optional()
});

const reviewModificationRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  businessMessage: z.string().max(500).optional(),
  fee: z.number().min(0).optional(),
  conditions: z.array(z.string()).optional()
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { httpMethod, pathParameters, queryStringParameters } = event;
    const requestId = pathParameters?.requestId;

    switch (httpMethod) {
      case 'GET':
        if (requestId) {
          return await handleGetModificationRequest(requestId);
        } else {
          return await handleListModificationRequests(queryStringParameters);
        }

      case 'POST':
        if (requestId && pathParameters?.action === 'review') {
          return await handleReviewModificationRequest(requestId, event.body);
        } else {
          return await handleCreateModificationRequest(event.body);
        }

      default:
        return createResponse(405, {
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    logger.error('Error in modification requests handler', { error, event });
    return createResponse(500, {
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Create a new modification request
 */
async function handleCreateModificationRequest(requestBody: string | null): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, {
        success: false,
        error: 'Request body is required'
      });
    }

    const validationResult = validateRequestBody(body, createModificationRequestSchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const requestedBy = body.requestedBy || 'customer';
    delete body.requestedBy;

    const result = await reservationModificationService.createModificationRequest(
      validationResult.data,
      requestedBy
    );

    logger.info('Modification request created', {
      requestId: result.request.id,
      reservationId: validationResult.data.reservationId,
      type: validationResult.data.type
    });

    return createResponse(201, {
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error creating modification request', { error });
    
    if (error instanceof Error) {
      return createResponse(400, {
        success: false,
        error: error.message
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Failed to create modification request'
    });
  }
}

/**
 * Review a modification request (approve/reject)
 */
async function handleReviewModificationRequest(
  requestId: string,
  requestBody: string | null
): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, {
        success: false,
        error: 'Request body is required'
      });
    }

    const validationResult = validateRequestBody(body, reviewModificationRequestSchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const reviewerId = body.reviewerId || 'system'; // Would get from auth context
    delete body.reviewerId;

    const updatedRequest = await reservationModificationService.reviewModificationRequest(
      requestId,
      validationResult.data,
      reviewerId
    );

    logger.info('Modification request reviewed', {
      requestId,
      action: validationResult.data.action,
      reviewerId
    });

    return createResponse(200, {
      success: true,
      data: { request: updatedRequest }
    });

  } catch (error) {
    logger.error('Error reviewing modification request', { error, requestId });
    
    if (error instanceof Error) {
      return createResponse(400, {
        success: false,
        error: error.message
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Failed to review modification request'
    });
  }
}

/**
 * Get a specific modification request
 */
async function handleGetModificationRequest(requestId: string): Promise<any> {
  try {
    // This would be implemented in the service
    // For now, return a placeholder response
    return createResponse(200, {
      success: true,
      data: {
        message: 'Get modification request endpoint - to be implemented'
      }
    });

  } catch (error) {
    logger.error('Error getting modification request', { error, requestId });
    return createResponse(500, {
      success: false,
      error: 'Failed to get modification request'
    });
  }
}

/**
 * List modification requests with filters
 */
async function handleListModificationRequests(queryParams: any): Promise<any> {
  try {
    const businessId = queryParams?.businessId;
    const reservationId = queryParams?.reservationId;
    const status = queryParams?.status;
    const limit = Math.min(parseInt(queryParams?.limit || '50'), 100);

    let requests;

    if (reservationId) {
      requests = await reservationModificationService.getReservationModificationRequests(reservationId);
    } else if (businessId) {
      requests = await reservationModificationService.getBusinessModificationRequests(
        businessId,
        status,
        limit
      );
    } else {
      return createResponse(400, {
        success: false,
        error: 'Either businessId or reservationId is required'
      });
    }

    return createResponse(200, {
      success: true,
      data: {
        requests,
        count: requests.length
      }
    });

  } catch (error) {
    logger.error('Error listing modification requests', { error });
    return createResponse(500, {
      success: false,
      error: 'Failed to list modification requests'
    });
  }
}