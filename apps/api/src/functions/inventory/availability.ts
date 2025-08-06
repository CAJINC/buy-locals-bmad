import { APIGatewayProxyHandler } from 'aws-lambda';
import { inventoryService } from '../../services/inventoryService';
import { responseUtils } from '../../utils/lambdaResponseUtils';
import { logger } from '../../utils/logger';
import type { ReservationItem } from '../../types/Reservation';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const businessId = event.pathParameters?.businessId;
    
    if (!businessId) {
      return responseUtils.badRequest('Business ID is required');
    }

    const method = event.httpMethod;

    switch (method) {
      case 'GET':
        return await handleGetAvailability(businessId, event.queryStringParameters || {});
      
      case 'POST':
        return await handleCheckReservationAvailability(businessId, event.body);
      
      default:
        return responseUtils.methodNotAllowed(`Method ${method} not allowed`);
    }
  } catch (error) {
    logger.error('Error in inventory availability handler', { error });
    return responseUtils.internalServerError('Failed to check inventory availability');
  }
};

async function handleGetAvailability(
  businessId: string,
  queryParams: Record<string, string>
) {
  try {
    const { productIds } = queryParams;
    
    if (!productIds) {
      return responseUtils.badRequest('Product IDs are required');
    }

    const productIdArray = productIds.split(',').map(id => id.trim());
    const availability: Array<{
      productId: string;
      available: boolean;
      availableQuantity: number;
      totalQuantity: number;
      reservedQuantity: number;
      productName: string;
      unitPrice: number;
    }> = [];

    for (const productId of productIdArray) {
      const inventory = await inventoryService.getInventory(productId);
      
      if (!inventory || inventory.businessId !== businessId) {
        availability.push({
          productId,
          available: false,
          availableQuantity: 0,
          totalQuantity: 0,
          reservedQuantity: 0,
          productName: 'Product not found',
          unitPrice: 0
        });
        continue;
      }

      availability.push({
        productId,
        available: inventory.isTrackingEnabled ? inventory.availableQuantity > 0 : true,
        availableQuantity: inventory.availableQuantity,
        totalQuantity: inventory.totalQuantity,
        reservedQuantity: inventory.reservedQuantity,
        productName: inventory.productName,
        unitPrice: inventory.unitPrice
      });
    }

    return responseUtils.success({
      businessId,
      availability,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting product availability', { error, businessId });
    return responseUtils.internalServerError('Failed to retrieve product availability');
  }
}

async function handleCheckReservationAvailability(
  businessId: string,
  body: string | null
) {
  try {
    if (!body) {
      return responseUtils.badRequest('Request body with reservation items is required');
    }

    const requestData = JSON.parse(body);
    const { items, holdDurationMinutes = 30 } = requestData;

    if (!items || !Array.isArray(items)) {
      return responseUtils.badRequest('Reservation items array is required');
    }

    // Validate and structure items
    const reservationItems: ReservationItem[] = items.map((item: unknown) => {
      const itemData = item as Record<string, unknown>;
      
      if (!itemData.productId || typeof itemData.quantity !== 'number') {
        throw new Error('Each item must have productId and quantity');
      }

      if (itemData.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      return {
        productId: itemData.productId as string,
        quantity: itemData.quantity as number,
        price: (itemData.price as number) || 0,
        name: (itemData.name as string) || 'Unknown Product',
        specifications: (itemData.specifications as Record<string, unknown>) || {},
        customizations: (itemData.customizations as string[]) || []
      };
    });

    // Check availability for all items
    const isAvailable = await inventoryService.checkAvailability(reservationItems);
    
    if (!isAvailable) {
      // Get detailed availability info for each item
      const itemAvailability = [];
      
      for (const item of reservationItems) {
        const inventory = await inventoryService.getInventory(item.productId);
        
        itemAvailability.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: inventory?.availableQuantity || 0,
          sufficient: inventory ? inventory.availableQuantity >= item.quantity : false,
          productName: inventory?.productName || 'Unknown Product'
        });
      }

      return responseUtils.badRequest({
        message: 'Insufficient inventory for reservation',
        available: false,
        itemAvailability,
        checkedAt: new Date().toISOString()
      });
    }

    // If available, optionally create temporary holds
    let holds = null;
    if (requestData.createHolds === true) {
      try {
        holds = await inventoryService.reserveItems(
          reservationItems,
          holdDurationMinutes
        );
        
        logger.info('Temporary inventory holds created', {
          businessId,
          holdCount: holds.length,
          holdDuration: holdDurationMinutes
        });
      } catch (error) {
        logger.warn('Failed to create temporary holds', { error });
        // Continue without holds - availability was confirmed
      }
    }

    return responseUtils.success({
      available: true,
      message: 'All items are available for reservation',
      items: reservationItems,
      holds: holds ? holds.map(hold => ({
        holdId: hold.id,
        productId: hold.productId,
        quantity: hold.quantity,
        holdUntil: hold.holdUntil,
        status: hold.status
      })) : null,
      holdsExpiresAt: holds && holds.length > 0 ? 
        new Date(Date.now() + holdDurationMinutes * 60 * 1000) : null,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking reservation availability', { error, businessId });
    
    if (error instanceof SyntaxError) {
      return responseUtils.badRequest('Invalid JSON in request body');
    }
    
    if (error.message.includes('must have')) {
      return responseUtils.badRequest(error.message);
    }
    
    return responseUtils.internalServerError('Failed to check reservation availability');
  }
}