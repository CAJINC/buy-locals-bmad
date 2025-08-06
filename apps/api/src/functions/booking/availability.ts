import { APIGatewayProxyHandler } from 'aws-lambda';
import { availabilityService } from '../../services/availabilityService';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { businessId } = event.pathParameters || {};
    const { date, serviceId, duration } = event.queryStringParameters || {};

    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    if (!date) {
      return responseUtils.badRequest('Date parameter is required (YYYY-MM-DD format)');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return responseUtils.badRequest('Invalid date format. Use YYYY-MM-DD');
    }

    const requestDate = new Date(date);
    if (isNaN(requestDate.getTime())) {
      return responseUtils.badRequest('Invalid date provided');
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate < today) {
      return responseUtils.badRequest('Cannot request availability for past dates');
    }

    const serviceDuration = duration ? parseInt(duration) : undefined;
    if (duration && (isNaN(serviceDuration) || serviceDuration <= 0)) {
      return responseUtils.badRequest('Duration must be a positive number');
    }

    // Get available time slots
    const availability = await availabilityService.getAvailability({
      businessId,
      date: requestDate,
      serviceId: serviceId || undefined,
      duration: serviceDuration
    });

    logger.info('Availability retrieved', {
      businessId,
      date,
      serviceId,
      slotsCount: availability.length
    });

    return responseUtils.success({
      date,
      businessId,
      serviceId,
      availability
    });

  } catch (error: any) {
    logger.error('Error retrieving availability', error);

    if (error.message === 'Business not found') {
      return responseUtils.notFound('Business not found');
    }

    if (error.message === 'Service not found') {
      return responseUtils.notFound('Service not found');
    }

    return responseUtils.internalServerError('Failed to retrieve availability');
  }
};