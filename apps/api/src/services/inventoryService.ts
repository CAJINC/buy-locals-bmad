import { pool } from '../config/database';
import { logger } from '../utils/logger';
import type {
  CreateReservationInput,
  InventoryHold,
  ProductInventory,
  ReservationItem
} from '../types/Reservation';

export class InventoryService {
  /**
   * Check if requested items are available for reservation
   */
  async checkAvailability(items: ReservationItem[]): Promise<boolean> {
    const client = await pool.connect();
    try {
      for (const item of items) {
        const result = await client.query(
          'SELECT available_quantity, is_tracking_enabled FROM product_inventory WHERE product_id = $1',
          [item.productId]
        );
        
        const inventory = result.rows[0];
        if (!inventory || !inventory.is_tracking_enabled) {
          continue; // Skip availability check if inventory tracking disabled
        }

        if (inventory.available_quantity < item.quantity) {
          logger.warn(`Insufficient inventory for product ${item.productId}`, {
            requested: item.quantity,
            available: inventory.available_quantity
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking inventory availability', { error, items });
      throw new Error('Unable to verify inventory availability');
    } finally {
      client.release();
    }
  }

  /**
   * Reserve items with temporary hold
   */
  async reserveItems(
    items: ReservationItem[], 
    holdDurationMinutes: number = 30,
    reservationId?: string
  ): Promise<InventoryHold[]> {
    const holdUntil = new Date(Date.now() + holdDurationMinutes * 60 * 1000);
    const holds: InventoryHold[] = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const item of items) {
        // Get inventory with row-level lock
        const inventoryResult = await client.query(
          'SELECT * FROM product_inventory WHERE product_id = $1 FOR UPDATE',
          [item.productId]
        );

        const inventory = inventoryResult.rows[0];
        if (!inventory || !inventory.is_tracking_enabled) {
          continue; // Skip if no inventory tracking
        }

        if (inventory.available_quantity < item.quantity) {
          throw new Error(`Insufficient inventory for product ${item.productId}`);
        }

        // Update inventory quantities
        await client.query(
          'UPDATE product_inventory SET available_quantity = $1, reserved_quantity = $2, updated_at = CURRENT_TIMESTAMP WHERE product_id = $3',
          [
            inventory.available_quantity - item.quantity,
            inventory.reserved_quantity + item.quantity,
            item.productId
          ]
        );

        // Create inventory hold record
        const holdResult = await client.query(
          'INSERT INTO inventory_holds (reservation_id, product_id, quantity_held, hold_until, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [reservationId, item.productId, item.quantity, holdUntil, 'active']
        );

        const hold = holdResult.rows[0];
        holds.push({
          id: hold.id,
          productId: hold.product_id,
          quantity: hold.quantity_held,
          holdUntil: new Date(hold.hold_until),
          status: hold.status,
          createdAt: new Date(hold.created_at)
        });

        logger.info('Inventory hold created', {
          holdId: hold.id,
          productId: item.productId,
          quantity: item.quantity,
          holdUntil
        });
      }

      await client.query('COMMIT');
      return holds;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reserving inventory items', { error, items });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Confirm reservation and convert holds to permanent allocation
   */
  async confirmReservation(holdIds: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const holdsResult = await client.query(
        'SELECT * FROM inventory_holds WHERE id = ANY($1) AND status = $2',
        [holdIds, 'active']
      );

      for (const hold of holdsResult.rows) {
        // Update hold status to confirmed
        await client.query(
          'UPDATE inventory_holds SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['confirmed', hold.id]
        );

        // Update inventory - move from reserved to confirmed
        const inventoryResult = await client.query(
          'SELECT * FROM product_inventory WHERE product_id = $1',
          [hold.product_id]
        );

        const inventory = inventoryResult.rows[0];
        await client.query(
          'UPDATE product_inventory SET total_quantity = $1, reserved_quantity = $2, updated_at = CURRENT_TIMESTAMP WHERE product_id = $3',
          [
            inventory.total_quantity - hold.quantity_held,
            inventory.reserved_quantity - hold.quantity_held,
            hold.product_id
          ]
        );

        logger.info('Inventory hold confirmed', {
          holdId: hold.id,
          productId: hold.product_id,
          quantity: hold.quantity_held
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error confirming inventory holds', { error, holdIds });
      throw new Error('Failed to confirm inventory reservation');
    } finally {
      client.release();
    }
  }

  /**
   * Release inventory holds and restore availability
   */
  async releaseHolds(holdIds: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const holdsResult = await client.query(
        'SELECT * FROM inventory_holds WHERE id = ANY($1) AND status = ANY($2)',
        [holdIds, ['active', 'expired']]
      );

      for (const hold of holdsResult.rows) {
        // Update hold status to released
        await client.query(
          'UPDATE inventory_holds SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['released', hold.id]
        );

        // Restore inventory availability
        await client.query(
          'UPDATE product_inventory SET available_quantity = available_quantity + $1, reserved_quantity = reserved_quantity - $2, updated_at = CURRENT_TIMESTAMP WHERE product_id = $3',
          [hold.quantity_held, hold.quantity_held, hold.product_id]
        );

        logger.info('Inventory hold released', {
          holdId: hold.id,
          productId: hold.product_id,
          quantity: hold.quantity_held
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error releasing inventory holds', { error, holdIds });
      throw new Error('Failed to release inventory holds');
    } finally {
      client.release();
    }
  }

  /**
   * Get current inventory for a product
   */
  async getInventory(productId: string): Promise<ProductInventory | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM product_inventory WHERE product_id = $1',
        [productId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const inventory = result.rows[0];
      return {
        id: inventory.id,
        businessId: inventory.business_id,
        productId: inventory.product_id,
        totalQuantity: inventory.total_quantity,
        availableQuantity: inventory.available_quantity,
        reservedQuantity: inventory.reserved_quantity,
        minimumStock: inventory.minimum_stock || 0,
        isTrackingEnabled: inventory.is_tracking_enabled,
        lastUpdated: new Date(inventory.updated_at),
        productName: inventory.product_name || 'Unknown Product',
        productDescription: inventory.product_description,
        unitPrice: inventory.unit_price || 0
      };
    } catch (error) {
      logger.error('Error getting inventory', { error, productId });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize inventory for a new product
   */
  async initializeInventory(
    businessId: string,
    productId: string,
    initialQuantity: number,
    minimumStock: number = 0,
    productName: string,
    unitPrice: number = 0
  ): Promise<ProductInventory> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO product_inventory 
         (business_id, product_id, total_quantity, available_quantity, reserved_quantity, minimum_stock, product_name, unit_price) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [businessId, productId, initialQuantity, initialQuantity, 0, minimumStock, productName, unitPrice]
      );

      const inventory = result.rows[0];
      logger.info('Inventory initialized', {
        businessId,
        productId,
        initialQuantity,
        minimumStock
      });

      return {
        id: inventory.id,
        businessId: inventory.business_id,
        productId: inventory.product_id,
        totalQuantity: inventory.total_quantity,
        availableQuantity: inventory.available_quantity,
        reservedQuantity: inventory.reserved_quantity,
        minimumStock: inventory.minimum_stock,
        isTrackingEnabled: inventory.is_tracking_enabled,
        lastUpdated: new Date(inventory.created_at),
        productName: inventory.product_name,
        productDescription: inventory.product_description,
        unitPrice: inventory.unit_price
      };
    } catch (error) {
      logger.error('Error initializing inventory', { 
        error, businessId, productId, initialQuantity 
      });
      throw new Error('Failed to initialize inventory');
    } finally {
      client.release();
    }
  }

  /**
   * Get low stock alerts for business
   */
  async getLowStockAlerts(businessId: string): Promise<ProductInventory[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM product_inventory WHERE business_id = $1 AND is_tracking_enabled = true AND available_quantity <= minimum_stock AND minimum_stock > 0',
        [businessId]
      );

      return result.rows.map(item => ({
        id: item.id,
        businessId: item.business_id,
        productId: item.product_id,
        totalQuantity: item.total_quantity,
        availableQuantity: item.available_quantity,
        reservedQuantity: item.reserved_quantity,
        minimumStock: item.minimum_stock,
        isTrackingEnabled: item.is_tracking_enabled,
        lastUpdated: new Date(item.updated_at),
        productName: item.product_name || 'Unknown Product',
        productDescription: item.product_description,
        unitPrice: item.unit_price || 0
      }));
    } catch (error) {
      logger.error('Error getting low stock alerts', { error, businessId });
      return [];
    } finally {
      client.release();
    }
  }
}

export const inventoryService = new InventoryService();