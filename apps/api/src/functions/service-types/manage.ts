import { APIGatewayProxyHandler } from 'aws-lambda';
import { serviceTypeService } from '../../services/serviceTypeService';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';
import type { CreateServiceTypeInput, UpdateServiceTypeInput } from '../../types/ServiceType';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const method = event.httpMethod;
    const businessId = event.pathParameters?.businessId;
    const serviceTypeId = event.pathParameters?.serviceTypeId;
    
    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    switch (method) {
      case 'GET':
        if (serviceTypeId) {
          return await handleGetServiceType(serviceTypeId);
        } else {
          return await handleGetBusinessServiceTypes(businessId, event.queryStringParameters || {});
        }
      
      case 'POST':
        return await handleCreateServiceType(businessId, event.body);
      
      case 'PUT':
        if (!serviceTypeId) {
          return responseUtils.badRequest('Service type ID is required for updates');
        }
        return await handleUpdateServiceType(serviceTypeId, event.body);
      
      case 'DELETE':
        if (!serviceTypeId) {
          return responseUtils.badRequest('Service type ID is required for deletion');
        }
        return await handleDeleteServiceType(serviceTypeId);
      
      default:
        return responseUtils.methodNotAllowed(`Method ${method} not allowed`);
    }
  } catch (error) {
    logger.error('Error in service type management handler', { error });
    return responseUtils.internalServerError('Failed to process service type request');
  }
};

async function handleGetServiceType(serviceTypeId: string) {
  try {
    const serviceType = await serviceTypeService.getServiceType(serviceTypeId);
    
    if (!serviceType) {
      return responseUtils.notFound('Service type not found');
    }

    return responseUtils.success({
      serviceType
    });
  } catch (error) {
    logger.error('Error getting service type', { error, serviceTypeId });
    return responseUtils.internalServerError('Failed to retrieve service type');
  }
}

async function handleGetBusinessServiceTypes(
  businessId: string, 
  queryParams: Record<string, string>
) {
  try {
    const filters = {
      category: queryParams.category,
      isActive: queryParams.isActive === 'true' ? true : 
               queryParams.isActive === 'false' ? false : undefined,
      includeInactive: queryParams.includeInactive === 'true'
    };

    const serviceTypes = await serviceTypeService.getBusinessServiceTypes(businessId, filters);

    // Also include available templates for reference
    const templates = serviceTypeService.getAvailableTemplates();

    return responseUtils.success({
      serviceTypes,
      availableTemplates: Object.keys(templates).map(id => ({
        id,
        name: templates[id].name,
        category: templates[id].category,
        description: templates[id].description
      }))
    });
  } catch (error) {
    logger.error('Error getting business service types', { error, businessId });
    return responseUtils.internalServerError('Failed to retrieve service types');
  }
}

async function handleCreateServiceType(businessId: string, body: string | null) {
  try {
    if (!body) {
      return responseUtils.badRequest('Request body is required');
    }

    const requestData = JSON.parse(body);
    
    // Check if creating from template
    if (requestData.templateId) {
      const { templateId, customizations } = requestData;
      
      const serviceType = await serviceTypeService.createFromTemplate(
        businessId,
        templateId,
        customizations
      );

      logger.info('Service type created from template', {
        businessId,
        templateId,
        serviceTypeId: serviceType.id
      });

      return responseUtils.created({
        serviceType,
        message: 'Service type created successfully from template'
      });
    }

    // Create custom service type
    const input: CreateServiceTypeInput = {
      businessId,
      name: requestData.name,
      category: requestData.category,
      description: requestData.description,
      formFields: requestData.formFields,
      bookingRules: requestData.bookingRules,
      pricingModel: requestData.pricingModel,
      requirements: requestData.requirements
    };

    // Validate required fields
    if (!input.name || !input.category) {
      return responseUtils.badRequest('Service name and category are required');
    }

    const serviceType = await serviceTypeService.createServiceType(input);

    logger.info('Custom service type created', {
      businessId,
      serviceTypeId: serviceType.id,
      name: input.name
    });

    return responseUtils.created({
      serviceType,
      message: 'Service type created successfully'
    });
  } catch (error) {
    logger.error('Error creating service type', { error, businessId });
    
    if (error instanceof SyntaxError) {
      return responseUtils.badRequest('Invalid JSON in request body');
    }
    
    if (error.message.includes('not found')) {
      return responseUtils.badRequest(error.message);
    }
    
    return responseUtils.internalServerError('Failed to create service type');
  }
}

async function handleUpdateServiceType(serviceTypeId: string, body: string | null) {
  try {
    if (!body) {
      return responseUtils.badRequest('Request body is required');
    }

    const updates: UpdateServiceTypeInput = JSON.parse(body);
    
    const serviceType = await serviceTypeService.updateServiceType(serviceTypeId, updates);

    logger.info('Service type updated', {
      serviceTypeId,
      updatedFields: Object.keys(updates)
    });

    return responseUtils.success({
      serviceType,
      message: 'Service type updated successfully'
    });
  } catch (error) {
    logger.error('Error updating service type', { error, serviceTypeId });
    
    if (error instanceof SyntaxError) {
      return responseUtils.badRequest('Invalid JSON in request body');
    }
    
    if (error.message.includes('not found')) {
      return responseUtils.notFound('Service type not found');
    }
    
    return responseUtils.internalServerError('Failed to update service type');
  }
}

async function handleDeleteServiceType(serviceTypeId: string) {
  try {
    const deleted = await serviceTypeService.deleteServiceType(serviceTypeId);
    
    if (!deleted) {
      return responseUtils.notFound('Service type not found');
    }

    logger.info('Service type deleted', { serviceTypeId });

    return responseUtils.success({
      message: 'Service type deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting service type', { error, serviceTypeId });
    return responseUtils.internalServerError('Failed to delete service type');
  }
}