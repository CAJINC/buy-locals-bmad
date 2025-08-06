import { APIGatewayProxyHandler } from 'aws-lambda';
import { bookingService } from '../../services/bookingService';
import { cancellationSchema } from '../../schemas/bookingSchemas';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { bookingId } = event.pathParameters || {};
    
    if (!bookingId) {
      return responseUtils.badRequest('Booking ID is required');
    }

    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    let cancellationData = {};
    if (event.body) {
      const requestData = JSON.parse(event.body);
      const { error, value } = cancellationSchema.validate(requestData);
      if (error) {
        return responseUtils.badRequest(`Validation error: ${error.details[0].message}`);
      }
      cancellationData = value;
    }

    // Cancel the booking with policy enforcement
    const result = await bookingService.cancelBooking({
      bookingId,
      userId,
      ...cancellationData
    });

    logger.info('Booking cancelled successfully', {
      bookingId,
      userId,
      reason: cancellationData.reason
    });

    return responseUtils.success({
      booking: result.booking,
      refundAmount: result.refundAmount,
      message: result.message
    });

  } catch (error: any) {
    logger.error('Error cancelling booking', error);

    if (error.message === 'Booking not found') {
      return responseUtils.notFound('Booking not found');
    }

    if (error.message === 'Unauthorized to cancel this booking') {
      return responseUtils.forbidden('You are not authorized to cancel this booking');
    }

    if (error.message === 'Booking cannot be cancelled') {
      return responseUtils.badRequest('This booking cannot be cancelled (already completed or cancelled)');
    }

    if (error.message.includes('Cancellation notice period')) {
      return responseUtils.badRequest(error.message);
    }

    return responseUtils.internalServerError('Failed to cancel booking');
  }
};