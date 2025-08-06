import { APIGatewayProxyHandler } from 'aws-lambda';
import { inventoryService } from '../../services/inventoryService';
import { inventoryRepository } from '../../repositories/inventoryRepository';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const method = event.httpMethod;
    const businessId = event.pathParameters?.businessId;
    
    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    const userId = event.requestContext.authorizer?.principalId;
    if (!userId) {
      return responseUtils.unauthorized('User authentication required');
    }

    switch (method) {
      case 'GET':
        return await handleGetInventory(businessId, event.queryStringParameters || {});
      
      case 'POST':
        return await handleCreateOrUpdateInventory(businessId, event.body);
      
      case 'PUT':
        return await handleUpdateInventoryQuantity(businessId, event.body);
      
      case 'DELETE':
        return await handleDeleteInventory(businessId, event.queryStringParameters || {});
      
      default:
        return responseUtils.methodNotAllowed(`Method ${method} not allowed`);
    }
  } catch (error) {
    logger.error('Error in inventory management handler', { error });
    return responseUtils.internalServerError('Failed to process inventory request');
  }
};

async function handleGetInventory(
  businessId: string, 
  queryParams: Record<string, string>
) {
  try {
    const filters = {
      lowStockOnly: queryParams.lowStockOnly === 'true',
      trackingEnabled: queryParams.trackingEnabled === 'true' ? true : 
                      queryParams.trackingEnabled === 'false' ? false : undefined,
      productIds: queryParams.productIds ? queryParams.productIds.split(',') : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0
    };

    const inventory = await inventoryRepository.getBusinessInventory(businessId, filters);
    const stats = await inventoryRepository.getInventoryStats(businessId);
    const lowStockAlerts = await inventoryService.getLowStockAlerts(businessId);

    return responseUtils.success({
      inventory,
      stats,
      lowStockAlerts,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: inventory.length
      }
    });
  } catch (error) {
    logger.error('Error getting inventory', { error, businessId });
    return responseUtils.internalServerError('Failed to retrieve inventory');
  }
}

async function handleCreateOrUpdateInventory(businessId: string, body: string | null) {
  try {
    if (!body) {
      return responseUtils.badRequest('Request body is required');
    }

    const inventoryData = JSON.parse(body);
    const { 
      productId, 
      productName, 
      totalQuantity, 
      minimumStock = 0, 
      unitPrice = 0,
      productDescription,
      isTrackingEnabled = true 
    } = inventoryData;

    if (!productId || !productName) {
      return responseUtils.badRequest('Product ID and name are required');
    }

    if (typeof totalQuantity !== 'number' || totalQuantity < 0) {
      return responseUtils.badRequest('Valid total quantity is required');
    }

    const inventory = await inventoryRepository.upsertInventory({
      businessId,
      productId,
      productName,
      totalQuantity,
      availableQuantity: totalQuantity,
      minimumStock,
      unitPrice,
      productDescription,
      isTrackingEnabled
    });

    logger.info('Inventory created/updated', {
      businessId,
      productId,
      totalQuantity
    });

    return responseUtils.created({
      inventory,
      message: 'Inventory successfully created/updated'
    });
  } catch (error) {
    logger.error('Error creating/updating inventory', { error, businessId });
    
    if (error instanceof SyntaxError) {
      return responseUtils.badRequest('Invalid JSON in request body');
    }
    
    return responseUtils.internalServerError('Failed to create/update inventory');
  }
}

async function handleUpdateInventoryQuantity(businessId: string, body: string | null) {
  try {
    if (!body) {
      return responseUtils.badRequest('Request body is required');
    }

    const updateData = JSON.parse(body);
    const { productId, adjustment, reason } = updateData;

    if (!productId || typeof adjustment !== 'number' || !reason) {
      return responseUtils.badRequest('Product ID, adjustment amount, and reason are required');
    }

    const updatedInventory = await inventoryService.updateInventory(
      productId,
      adjustment,
      reason,
      businessId
    );

    logger.info('Inventory quantity updated', {
      businessId,
      productId,
      adjustment,
      reason
    });

    return responseUtils.success({
      inventory: updatedInventory,
      message: 'Inventory quantity successfully updated'
    });
  } catch (error) {
    logger.error('Error updating inventory quantity', { error, businessId });
    
    if (error instanceof SyntaxError) {
      return responseUtils.badRequest('Invalid JSON in request body');
    }

    if (error.message.includes('not found')) {
      return responseUtils.notFound('Product inventory not found');
    }
    
    return responseUtils.internalServerError('Failed to update inventory quantity');
  }
}

async function handleDeleteInventory(businessId: string, queryParams: Record<string, string>) {
  try {
    const { productId } = queryParams;

    if (!productId) {
      return responseUtils.badRequest('Product ID is required');
    }

    const deleted = await inventoryRepository.deleteInventory(businessId, productId);

    if (!deleted) {
      return responseUtils.notFound('Product inventory not found');
    }

    logger.info('Inventory deleted', { businessId, productId });

    return responseUtils.success({
      message: 'Inventory successfully deleted'
    });
  } catch (error) {
    logger.error('Error deleting inventory', { error, businessId });
    return responseUtils.internalServerError('Failed to delete inventory');
  }
}