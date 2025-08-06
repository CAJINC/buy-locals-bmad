import { APIGatewayProxyHandler } from 'aws-lambda';
import { createResponse, parseJSON } from '../../utils/apiResponse';
import { validateRequestBody } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { reservationExpirationService } from '../../services/reservationExpirationService';
import { z } from 'zod';

const setTTLSchema = z.object({
  reservationId: z.string().uuid(),
  ttlMinutes: z.number().min(5).max(10080).optional(), // 5 minutes to 7 days
  businessId: z.string().uuid().optional()
});

const extendTTLSchema = z.object({
  reservationId: z.string().uuid(),
  additionalMinutes: z.number().min(1).max(1440) // Up to 24 hours extension
});

const getExpiringReservationsSchema = z.object({
  withinMinutes: z.number().min(1).max(10080).optional().default(60),
  businessId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50)
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { httpMethod, pathParameters, queryStringParameters } = event;
    const action = pathParameters?.action;

    if (!action) {
      return createResponse(400, { 
        success: false, 
        error: 'Action parameter is required' 
      });
    }

    switch (httpMethod) {
      case 'POST':
        return await handlePostActions(action, event.body);
      
      case 'GET':
        return await handleGetActions(action, queryStringParameters);

      default:
        return createResponse(405, { 
          success: false, 
          error: 'Method not allowed' 
        });
    }
  } catch (error) {
    logger.error('Error in TTL management handler', { error, event });
    return createResponse(500, { 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Handle POST actions for TTL management
 */
async function handlePostActions(action: string, requestBody: string | null): Promise<any> {
  switch (action) {
    case 'set-ttl':
      return await handleSetTTL(requestBody);
    
    case 'extend-ttl':
      return await handleExtendTTL(requestBody);
    
    default:
      return createResponse(400, { 
        success: false, 
        error: 'Invalid action for POST method' 
      });
  }
}

/**
 * Handle GET actions for TTL management
 */
async function handleGetActions(action: string, queryParams: any): Promise<any> {
  switch (action) {
    case 'expiring':
      return await handleGetExpiringReservations(queryParams);
    
    case 'expired':
      return await handleGetExpiredReservations(queryParams);

    case 'analytics':
      return await handleGetExpirationAnalytics(queryParams);
    
    default:
      return createResponse(400, { 
        success: false, 
        error: 'Invalid action for GET method' 
      });
  }
}

/**
 * Set TTL for a reservation
 */
async function handleSetTTL(requestBody: string | null): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, { 
        success: false, 
        error: 'Request body is required' 
      });
    }

    const validationResult = validateRequestBody(body, setTTLSchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const { reservationId, ttlMinutes, businessId } = validationResult.data;

    await reservationExpirationService.setReservationTTL(
      reservationId,
      ttlMinutes,
      businessId
    );

    logger.info('Reservation TTL set', {
      reservationId,
      ttlMinutes,
      businessId
    });

    return createResponse(200, {
      success: true,
      message: 'TTL set successfully',
      data: {
        reservationId,
        ttlMinutes: ttlMinutes || 30,
        expiresAt: new Date(Date.now() + (ttlMinutes || 30) * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    logger.error('Error setting reservation TTL', { error });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to set reservation TTL' 
    });
  }
}

/**
 * Extend TTL for a reservation
 */
async function handleExtendTTL(requestBody: string | null): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, { 
        success: false, 
        error: 'Request body is required' 
      });
    }

    const validationResult = validateRequestBody(body, extendTTLSchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const { reservationId, additionalMinutes } = validationResult.data;

    const success = await reservationExpirationService.extendReservation(
      reservationId,
      additionalMinutes
    );

    if (!success) {
      return createResponse(409, {
        success: false,
        error: 'Cannot extend expired or cleaned reservation'
      });
    }

    logger.info('Reservation TTL extended', {
      reservationId,
      additionalMinutes
    });

    return createResponse(200, {
      success: true,
      message: 'TTL extended successfully',
      data: {
        reservationId,
        additionalMinutes
      }
    });
  } catch (error) {
    logger.error('Error extending reservation TTL', { error });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to extend reservation TTL' 
    });
  }
}

/**
 * Get reservations expiring soon
 */
async function handleGetExpiringReservations(queryParams: any): Promise<any> {
  try {
    const validationResult = validateRequestBody(queryParams || {}, getExpiringReservationsSchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const { withinMinutes, businessId, limit } = validationResult.data;

    let expiringReservations = await reservationExpirationService.getExpiringReservations(withinMinutes);

    // Filter by business if provided
    if (businessId) {
      expiringReservations = expiringReservations.filter(r => r.businessId === businessId);
    }

    // Limit results
    expiringReservations = expiringReservations.slice(0, limit);

    return createResponse(200, {
      success: true,
      data: {
        reservations: expiringReservations,
        count: expiringReservations.length,
        withinMinutes
      }
    });
  } catch (error) {
    logger.error('Error getting expiring reservations', { error });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to get expiring reservations' 
    });
  }
}

/**
 * Get expired reservations
 */
async function handleGetExpiredReservations(queryParams: any): Promise<any> {
  try {
    const businessId = queryParams?.businessId;
    const limit = Math.min(parseInt(queryParams?.limit || '50'), 100);

    let expiredReservations = await reservationExpirationService.getExpiredReservations();

    // Filter by business if provided
    if (businessId) {
      expiredReservations = expiredReservations.filter(r => r.businessId === businessId);
    }

    // Limit results
    expiredReservations = expiredReservations.slice(0, limit);

    return createResponse(200, {
      success: true,
      data: {
        reservations: expiredReservations,
        count: expiredReservations.length
      }
    });
  } catch (error) {
    logger.error('Error getting expired reservations', { error });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to get expired reservations' 
    });
  }
}

/**
 * Get expiration analytics
 */
async function handleGetExpirationAnalytics(queryParams: any): Promise<any> {
  try {
    const businessId = queryParams?.businessId;
    
    if (!businessId) {
      return createResponse(400, { 
        success: false, 
        error: 'Business ID is required for analytics' 
      });
    }

    let dateRange: { startDate: Date; endDate: Date } | undefined;
    
    if (queryParams?.startDate && queryParams?.endDate) {
      dateRange = {
        startDate: new Date(queryParams.startDate),
        endDate: new Date(queryParams.endDate)
      };

      // Validate date range
      if (isNaN(dateRange.startDate.getTime()) || isNaN(dateRange.endDate.getTime())) {
        return createResponse(400, {
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
        });
      }

      if (dateRange.startDate >= dateRange.endDate) {
        return createResponse(400, {
          success: false,
          error: 'Start date must be before end date'
        });
      }
    }

    const analytics = await reservationExpirationService.getExpirationAnalytics(
      businessId,
      dateRange
    );

    return createResponse(200, {
      success: true,
      data: {
        analytics,
        dateRange: dateRange ? {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        } : null
      }
    });
  } catch (error) {
    logger.error('Error getting expiration analytics', { error });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to get expiration analytics' 
    });
  }
}