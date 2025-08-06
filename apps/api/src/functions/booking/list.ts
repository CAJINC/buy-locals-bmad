import { APIGatewayProxyHandler } from 'aws-lambda';
import { bookingService } from '../../services/bookingService';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    const { status, limit = '20', offset = '0', businessId } = event.queryStringParameters || {};

    // Validate parameters
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return responseUtils.badRequest('Limit must be between 1 and 100');
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return responseUtils.badRequest('Offset must be non-negative');
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (status && !validStatuses.includes(status)) {
      return responseUtils.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    // Get user's bookings
    const result = await bookingService.getUserBookings({
      userId,
      status,
      businessId,
      limit: limitNum,
      offset: offsetNum
    });

    logger.info('Bookings retrieved', {
      userId,
      status,
      businessId,
      count: result.bookings.length,
      total: result.total
    });

    return responseUtils.success({
      bookings: result.bookings,
      pagination: {
        total: result.total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: result.total > offsetNum + limitNum
      }
    });

  } catch (error: any) {
    logger.error('Error retrieving bookings', error);
    return responseUtils.internalServerError('Failed to retrieve bookings');
  }
};