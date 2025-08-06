import { db } from '../utils/database';
import { logger } from '../utils/logger';
import type { InventoryHold, ProductInventory } from '../types/Reservation';

export class InventoryRepository {
  /**
   * Get business inventory with filtering and pagination
   */
  async getBusinessInventory(
    businessId: string,
    filters?: {
      lowStockOnly?: boolean;
      trackingEnabled?: boolean;
      productIds?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ProductInventory[]> {
    try {
      let query = db('product_inventory')
        .where('business_id', businessId);

      if (filters?.lowStockOnly) {
        query = query.whereRaw('available_quantity <= minimum_stock')
                    .where('minimum_stock', '>', 0);
      }

      if (filters?.trackingEnabled !== undefined) {
        query = query.where('is_tracking_enabled', filters.trackingEnabled);
      }

      if (filters?.productIds && filters.productIds.length > 0) {
        query = query.whereIn('product_id', filters.productIds);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const inventory = await query.orderBy('updated_at', 'desc');

      return inventory.map(item => ({
        id: item.id,
        businessId: item.business_id,
        productId: item.product_id,
        totalQuantity: item.total_quantity,
        availableQuantity: item.available_quantity,
        reservedQuantity: item.reserved_quantity,
        minimumStock: item.minimum_stock || 0,
        isTrackingEnabled: item.is_tracking_enabled,
        lastUpdated: new Date(item.updated_at),
        productName: item.product_name || 'Unknown Product',
        productDescription: item.product_description,
        unitPrice: item.unit_price || 0
      }));
    } catch (error) {
      logger.error('Error getting business inventory', { error, businessId, filters });
      throw new Error('Failed to retrieve business inventory');
    }
  }

  /**
   * Get inventory holds for a reservation or business
   */
  async getInventoryHolds(params: {
    reservationId?: string;
    businessId?: string;
    status?: string[];
    includeExpired?: boolean;
  }): Promise<InventoryHold[]> {
    try {
      let query = db('inventory_holds as ih')
        .select(
          'ih.*',
          'pi.business_id',
          'pi.product_name'
        )
        .leftJoin('product_inventory as pi', 'ih.product_id', 'pi.product_id');

      if (params.reservationId) {
        query = query.where('ih.reservation_id', params.reservationId);
      }

      if (params.businessId) {
        query = query.where('pi.business_id', params.businessId);
      }

      if (params.status && params.status.length > 0) {
        query = query.whereIn('ih.status', params.status);
      }

      if (!params.includeExpired) {
        query = query.where('ih.status', '!=', 'expired');
      }

      const holds = await query.orderBy('ih.created_at', 'desc');

      return holds.map(hold => ({
        id: hold.id,
        productId: hold.product_id,
        quantity: hold.quantity_held,
        holdUntil: new Date(hold.hold_until),
        status: hold.status,
        createdAt: new Date(hold.created_at)
      }));
    } catch (error) {
      logger.error('Error getting inventory holds', { error, params });
      throw new Error('Failed to retrieve inventory holds');
    }
  }

  /**
   * Get inventory statistics for a business
   */
  async getInventoryStats(businessId: string): Promise<{
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    reservedQuantity: number;
    averageStockLevel: number;
    topProducts: Array<{
      productId: string;
      productName: string;
      totalQuantity: number;
      reservedQuantity: number;
      value: number;
    }>;
  }> {
    try {
      const stats = await db('product_inventory')
        .where('business_id', businessId)
        .where('is_tracking_enabled', true)
        .select(
          db.raw('COUNT(*) as total_products'),
          db.raw('SUM(total_quantity * unit_price) as total_value'),
          db.raw('SUM(CASE WHEN available_quantity <= minimum_stock AND minimum_stock > 0 THEN 1 ELSE 0 END) as low_stock_count'),
          db.raw('SUM(reserved_quantity) as reserved_quantity'),
          db.raw('AVG(available_quantity) as average_stock_level')
        )
        .first();

      const topProducts = await db('product_inventory')
        .where('business_id', businessId)
        .where('is_tracking_enabled', true)
        .select(
          'product_id',
          'product_name',
          'total_quantity',
          'reserved_quantity',
          db.raw('total_quantity * unit_price as value')
        )
        .orderBy('value', 'desc')
        .limit(10);

      return {
        totalProducts: parseInt(stats.total_products) || 0,
        totalValue: parseFloat(stats.total_value) || 0,
        lowStockCount: parseInt(stats.low_stock_count) || 0,
        reservedQuantity: parseInt(stats.reserved_quantity) || 0,
        averageStockLevel: parseFloat(stats.average_stock_level) || 0,
        topProducts: topProducts.map(product => ({
          productId: product.product_id,
          productName: product.product_name,
          totalQuantity: product.total_quantity,
          reservedQuantity: product.reserved_quantity,
          value: parseFloat(product.value) || 0
        }))
      };
    } catch (error) {
      logger.error('Error getting inventory statistics', { error, businessId });
      throw new Error('Failed to retrieve inventory statistics');
    }
  }

  /**
   * Create or update inventory record
   */
  async upsertInventory(inventory: Partial<ProductInventory> & {
    businessId: string;
    productId: string;
  }): Promise<ProductInventory> {
    try {
      const existing = await db('product_inventory')
        .where('business_id', inventory.businessId)
        .where('product_id', inventory.productId)
        .first();

      let result;

      if (existing) {
        // Update existing inventory
        await db('product_inventory')
          .where('id', existing.id)
          .update({
            total_quantity: inventory.totalQuantity ?? existing.total_quantity,
            available_quantity: inventory.availableQuantity ?? existing.available_quantity,
            reserved_quantity: inventory.reservedQuantity ?? existing.reserved_quantity,
            minimum_stock: inventory.minimumStock ?? existing.minimum_stock,
            is_tracking_enabled: inventory.isTrackingEnabled ?? existing.is_tracking_enabled,
            product_name: inventory.productName ?? existing.product_name,
            product_description: inventory.productDescription ?? existing.product_description,
            unit_price: inventory.unitPrice ?? existing.unit_price,
            updated_at: new Date()
          });

        result = await db('product_inventory').where('id', existing.id).first();
      } else {
        // Create new inventory record
        [result] = await db('product_inventory')
          .insert({
            business_id: inventory.businessId,
            product_id: inventory.productId,
            total_quantity: inventory.totalQuantity ?? 0,
            available_quantity: inventory.availableQuantity ?? inventory.totalQuantity ?? 0,
            reserved_quantity: inventory.reservedQuantity ?? 0,
            minimum_stock: inventory.minimumStock ?? 0,
            is_tracking_enabled: inventory.isTrackingEnabled ?? true,
            product_name: inventory.productName ?? 'Unknown Product',
            product_description: inventory.productDescription,
            unit_price: inventory.unitPrice ?? 0
          })
          .returning('*');
      }

      return {
        id: result.id,
        businessId: result.business_id,
        productId: result.product_id,
        totalQuantity: result.total_quantity,
        availableQuantity: result.available_quantity,
        reservedQuantity: result.reserved_quantity,
        minimumStock: result.minimum_stock,
        isTrackingEnabled: result.is_tracking_enabled,
        lastUpdated: new Date(result.updated_at),
        productName: result.product_name,
        productDescription: result.product_description,
        unitPrice: result.unit_price
      };
    } catch (error) {
      logger.error('Error upserting inventory', { error, inventory });
      throw new Error('Failed to create or update inventory');
    }
  }

  /**
   * Delete inventory record
   */
  async deleteInventory(businessId: string, productId: string): Promise<boolean> {
    try {
      const deleted = await db('product_inventory')
        .where('business_id', businessId)
        .where('product_id', productId)
        .del();

      return deleted > 0;
    } catch (error) {
      logger.error('Error deleting inventory', { error, businessId, productId });
      return false;
    }
  }

  /**
   * Get inventory adjustment history
   */
  async getInventoryAdjustments(
    businessId: string,
    productId?: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    productId: string;
    adjustment: number;
    reason: string;
    previousQuantity: number;
    newQuantity: number;
    createdAt: Date;
  }>> {
    try {
      let query = db('inventory_adjustments')
        .where('business_id', businessId);

      if (productId) {
        query = query.where('product_id', productId);
      }

      const adjustments = await query
        .orderBy('created_at', 'desc')
        .limit(limit);

      return adjustments.map(adj => ({
        id: adj.id,
        productId: adj.product_id,
        adjustment: adj.adjustment,
        reason: adj.reason,
        previousQuantity: adj.previous_quantity,
        newQuantity: adj.new_quantity,
        createdAt: new Date(adj.created_at)
      }));
    } catch (error) {
      logger.error('Error getting inventory adjustments', { error, businessId, productId });
      return [];
    }
  }
}

export const inventoryRepository = new InventoryRepository();