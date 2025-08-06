import { APIGatewayProxyHandler } from 'aws-lambda';
import { availabilitySettingsService } from '../../services/availabilitySettingsService';
import { availabilitySettingsSchema } from '../../schemas/businessSchemas';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const getAvailabilitySettings: APIGatewayProxyHandler = async (event) => {
  try {
    const { businessId } = event.pathParameters || {};
    
    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    const settings = await availabilitySettingsService.getBusinessAvailabilitySettings(
      businessId,
      userId
    );

    logger.info('Availability settings retrieved', {
      businessId,
      userId,
      hasSettings: !!settings
    });

    return responseUtils.success(settings || {});

  } catch (error: any) {
    logger.error('Error retrieving availability settings', error);

    if (error.message === 'Business not found') {
      return responseUtils.notFound('Business not found');
    }

    if (error.message === 'Unauthorized to access this business') {
      return responseUtils.forbidden('Unauthorized to access this business');
    }

    return responseUtils.internalServerError('Failed to retrieve availability settings');
  }
};

export const updateAvailabilitySettings: APIGatewayProxyHandler = async (event) => {
  try {
    const { businessId } = event.pathParameters || {};
    
    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    if (!event.body) {
      return responseUtils.badRequest('Request body is required');
    }

    const requestData = JSON.parse(event.body);
    
    // Validate the request data
    const { error, value } = availabilitySettingsSchema.validate(requestData);
    if (error) {
      return responseUtils.badRequest(`Validation error: ${error.details[0].message}`);
    }

    const settings = await availabilitySettingsService.updateBusinessAvailabilitySettings(
      businessId,
      userId,
      value
    );

    logger.info('Availability settings updated', {
      businessId,
      userId,
      settingsCount: Object.keys(value).length
    });

    return responseUtils.success(settings, 'Availability settings updated successfully');

  } catch (error: any) {
    logger.error('Error updating availability settings', error);

    if (error.message === 'Business not found') {
      return responseUtils.notFound('Business not found');
    }

    if (error.message === 'Unauthorized to modify this business') {
      return responseUtils.forbidden('Unauthorized to modify this business');
    }

    if (error.message.includes('Invalid time format')) {
      return responseUtils.badRequest(error.message);
    }

    return responseUtils.internalServerError('Failed to update availability settings');
  }
};