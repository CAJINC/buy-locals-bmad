import { APIGatewayProxyHandler } from 'aws-lambda';
import { bookingService } from '../../services/bookingService';
import { bookingSchema } from '../../schemas/bookingSchemas';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return responseUtils.badRequest('Request body is required');
    }

    const requestData = JSON.parse(event.body);
    
    // Validate the request data
    const { error, value } = bookingSchema.validate(requestData);
    if (error) {
      return responseUtils.badRequest(`Validation error: ${error.details[0].message}`);
    }

    // Extract user ID from the token (added by auth middleware)
    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    const bookingData = {
      ...value,
      consumerId: userId,
    };

    // Create the booking with double-booking prevention
    const booking = await bookingService.createBooking(bookingData);

    logger.info('Booking created successfully', {
      bookingId: booking.id,
      businessId: booking.businessId,
      consumerId: booking.consumerId,
    });

    return responseUtils.created({
      booking,
      message: 'Booking created successfully'
    });

  } catch (error: any) {
    logger.error('Error creating booking', error);

    if (error.message === 'Time slot no longer available') {
      return responseUtils.badRequest(error.message);
    }

    if (error.message === 'Business not found') {
      return responseUtils.notFound('Business not found');
    }

    if (error.message === 'Service not available') {
      return responseUtils.badRequest('Service not available');
    }

    return responseUtils.internalServerError('Failed to create booking');
  }
};