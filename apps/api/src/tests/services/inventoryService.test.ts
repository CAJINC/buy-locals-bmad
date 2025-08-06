import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InventoryService, inventoryService } from '../../services/inventoryService';
import { db } from '../../utils/database';
import type { ReservationItem } from '../../types/Reservation';

// Mock database and dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/logger');

const mockDb = db as jest.Mocked<typeof db>;
const mockTransaction = jest.fn();
const mockQuery = jest.fn();
const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn()
};

// Mock transaction structure
mockDb.transaction = mockTransaction;
mockDb.redis = mockRedis;

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default query builder mock
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      first: jest.fn(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      increment: jest.fn().mockReturnThis(),
      decrement: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      forUpdate: jest.fn().mockReturnThis()
    };

    mockQuery.mockReturnValue(queryBuilder);
    
    // Mock table access
    (mockDb as any).mockImplementation(() => queryBuilder);
    mockDb.table = jest.fn().mockReturnValue(queryBuilder);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkAvailability', () => {
    it('should return true when all items are available', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 2, price: 10, name: 'Test Product 1' },
        { productId: 'product-2', quantity: 1, price: 20, name: 'Test Product 2' }
      ];

      mockRedis.get
        .mockResolvedValueOnce(null) // No cache for first product
        .mockResolvedValueOnce(null); // No cache for second product

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn()
          .mockResolvedValueOnce({
            id: '1',
            business_id: 'business-1',
            product_id: 'product-1',
            available_quantity: 5,
            is_tracking_enabled: true
          })
          .mockResolvedValueOnce({
            id: '2',
            business_id: 'business-1',
            product_id: 'product-2',
            available_quantity: 3,
            is_tracking_enabled: true
          })
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.checkAvailability(items);

      expect(result).toBe(true);
      expect(queryBuilder.where).toHaveBeenCalledWith('product_id', 'product-1');
      expect(queryBuilder.where).toHaveBeenCalledWith('product_id', 'product-2');
    });

    it('should return false when insufficient inventory', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 10, price: 10, name: 'Test Product 1' }
      ];

      mockRedis.get.mockResolvedValue(null);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          business_id: 'business-1',
          product_id: 'product-1',
          available_quantity: 5,
          is_tracking_enabled: true
        })
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.checkAvailability(items);

      expect(result).toBe(false);
    });

    it('should skip availability check when tracking is disabled', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 100, price: 10, name: 'Test Product 1' }
      ];

      mockRedis.get.mockResolvedValue(null);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          business_id: 'business-1',
          product_id: 'product-1',
          available_quantity: 5,
          is_tracking_enabled: false
        })
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.checkAvailability(items);

      expect(result).toBe(true);
    });

    it('should handle missing inventory records', async () => {
      const items: ReservationItem[] = [
        { productId: 'nonexistent-product', quantity: 1, price: 10, name: 'Test Product' }
      ];

      mockRedis.get.mockResolvedValue(null);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.checkAvailability(items);

      expect(result).toBe(true); // Should skip when no inventory record
    });
  });

  describe('reserveItems', () => {
    it('should reserve items with database transaction', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 2, price: 10, name: 'Test Product 1' }
      ];

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          business_id: 'business-1',
          product_id: 'product-1',
          available_quantity: 5,
          reserved_quantity: 0,
          is_tracking_enabled: true
        }),
        update: jest.fn().mockResolvedValue(1),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
          id: 'hold-1',
          reservation_id: 'reservation-1',
          product_id: 'product-1',
          quantity_held: 2,
          hold_until: new Date(),
          status: 'active',
          created_at: new Date()
        }])
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      (mockTrx as any).mockReturnValue(mockTrx);

      const holds = await inventoryService.reserveItems(items, 30, 'reservation-1');

      expect(holds).toHaveLength(1);
      expect(holds[0]).toMatchObject({
        productId: 'product-1',
        quantity: 2,
        status: 'active'
      });

      expect(mockTrx.update).toHaveBeenCalledWith({
        available_quantity: 3, // 5 - 2
        reserved_quantity: 2,   // 0 + 2
        updated_at: expect.any(Date)
      });
    });

    it('should throw error for insufficient inventory in transaction', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 10, price: 10, name: 'Test Product 1' }
      ];

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          product_id: 'product-1',
          available_quantity: 5,
          is_tracking_enabled: true
        })
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      await expect(inventoryService.reserveItems(items, 30, 'reservation-1'))
        .rejects.toThrow('Insufficient inventory for product product-1');
    });

    it('should skip items with no inventory tracking', async () => {
      const items: ReservationItem[] = [
        { productId: 'product-1', quantity: 2, price: 10, name: 'Test Product 1' }
      ];

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          product_id: 'product-1',
          available_quantity: 5,
          is_tracking_enabled: false
        })
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      const holds = await inventoryService.reserveItems(items, 30, 'reservation-1');

      expect(holds).toHaveLength(0);
      expect(mockTrx.first).toHaveBeenCalled();
    });
  });

  describe('confirmReservation', () => {
    it('should confirm holds and update inventory', async () => {
      const holdIds = ['hold-1', 'hold-2'];

      const mockTrx = {
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          product_id: 'product-1',
          total_quantity: 100,
          reserved_quantity: 5
        }),
        update: jest.fn().mockResolvedValue(1)
      };

      mockTransaction.mockImplementation(async (callback) => {
        // First call gets the holds
        mockTrx.whereIn.mockReturnValueOnce({
          where: jest.fn().mockReturnValue([
            { id: 'hold-1', product_id: 'product-1', quantity_held: 2 },
            { id: 'hold-2', product_id: 'product-1', quantity_held: 3 }
          ])
        });

        return await callback(mockTrx);
      });

      await inventoryService.confirmReservation(holdIds);

      expect(mockTrx.whereIn).toHaveBeenCalledWith('id', holdIds);
      expect(mockTrx.update).toHaveBeenCalledWith({
        status: 'confirmed',
        updated_at: expect.any(Date)
      });
    });
  });

  describe('releaseHolds', () => {
    it('should release holds and restore inventory', async () => {
      const holdIds = ['hold-1'];

      const mockTrx = {
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        increment: jest.fn().mockReturnThis(),
        decrement: jest.fn().mockReturnThis()
      };

      mockTransaction.mockImplementation(async (callback) => {
        // Mock the holds query
        mockTrx.whereIn.mockReturnValueOnce({
          whereIn: jest.fn().mockReturnValue([
            { id: 'hold-1', product_id: 'product-1', quantity_held: 2 }
          ])
        });

        return await callback(mockTrx);
      });

      await inventoryService.releaseHolds(holdIds);

      expect(mockTrx.update).toHaveBeenCalledWith({
        status: 'released',
        updated_at: expect.any(Date)
      });
      expect(mockTrx.increment).toHaveBeenCalledWith('available_quantity', 2);
      expect(mockTrx.decrement).toHaveBeenCalledWith('reserved_quantity', 2);
    });
  });

  describe('processExpiredHolds', () => {
    it('should process expired holds automatically', async () => {
      const expiredHolds = [
        { id: 'hold-1', product_id: 'product-1' },
        { id: 'hold-2', product_id: 'product-2' }
      ];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(2)
      };

      (mockDb as any).mockReturnValue(queryBuilder);
      queryBuilder.where.mockReturnValueOnce(queryBuilder);
      queryBuilder.where.mockResolvedValue(expiredHolds);

      // Mock the release holds functionality
      jest.spyOn(inventoryService, 'releaseHolds').mockResolvedValue();

      await inventoryService.processExpiredHolds();

      expect(queryBuilder.where).toHaveBeenCalledWith('status', 'active');
      expect(queryBuilder.where).toHaveBeenCalledWith('hold_until', '<', expect.any(Date));
      expect(inventoryService.releaseHolds).toHaveBeenCalledWith(['hold-1', 'hold-2']);
    });

    it('should handle no expired holds gracefully', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis()
      };

      (mockDb as any).mockReturnValue(queryBuilder);
      queryBuilder.where.mockResolvedValue([]);

      await inventoryService.processExpiredHolds();

      expect(queryBuilder.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateInventory', () => {
    it('should update inventory with adjustment tracking', async () => {
      const productId = 'product-1';
      const adjustment = 10;
      const reason = 'Stock replenishment';
      const businessId = 'business-1';

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: '1',
          total_quantity: 50,
          available_quantity: 30
        }),
        update: jest.fn().mockResolvedValue(1),
        insert: jest.fn().mockResolvedValue(1)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      // Mock getInventory for return value
      jest.spyOn(inventoryService, 'getInventory').mockResolvedValue({
        id: '1',
        businessId: 'business-1',
        productId: 'product-1',
        totalQuantity: 60,
        availableQuantity: 40,
        reservedQuantity: 0,
        minimumStock: 5,
        isTrackingEnabled: true,
        lastUpdated: new Date(),
        productName: 'Test Product',
        unitPrice: 10
      });

      const result = await inventoryService.updateInventory(productId, adjustment, reason, businessId);

      expect(mockTrx.update).toHaveBeenCalledWith({
        total_quantity: 60, // 50 + 10
        available_quantity: 40, // 30 + 10
        updated_at: expect.any(Date)
      });

      expect(mockTrx.insert).toHaveBeenCalledWith({
        product_id: productId,
        business_id: businessId,
        adjustment,
        reason,
        previous_quantity: 50,
        new_quantity: 60,
        created_at: expect.any(Date)
      });

      expect(result.totalQuantity).toBe(60);
    });

    it('should handle negative adjustments within bounds', async () => {
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total_quantity: 50,
          available_quantity: 30
        }),
        update: jest.fn().mockResolvedValue(1),
        insert: jest.fn().mockResolvedValue(1)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      jest.spyOn(inventoryService, 'getInventory').mockResolvedValue({
        id: '1',
        businessId: 'business-1',
        productId: 'product-1',
        totalQuantity: 30, // After negative adjustment
        availableQuantity: 10,
        reservedQuantity: 0,
        minimumStock: 5,
        isTrackingEnabled: true,
        lastUpdated: new Date(),
        productName: 'Test Product',
        unitPrice: 10
      });

      await inventoryService.updateInventory('product-1', -20, 'Damage adjustment', 'business-1');

      expect(mockTrx.update).toHaveBeenCalledWith({
        total_quantity: 30, // max(0, 50-20)
        available_quantity: 10, // 30-20
        updated_at: expect.any(Date)
      });
    });
  });

  describe('getLowStockAlerts', () => {
    it('should return products with low stock', async () => {
      const businessId = 'business-1';
      const lowStockItems = [
        {
          id: '1',
          business_id: businessId,
          product_id: 'product-1',
          product_name: 'Low Stock Product',
          total_quantity: 5,
          available_quantity: 2,
          reserved_quantity: 0,
          minimum_stock: 5,
          is_tracking_enabled: true,
          updated_at: new Date(),
          unit_price: 10
        }
      ];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockResolvedValue(lowStockItems)
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.getLowStockAlerts(businessId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        productId: 'product-1',
        productName: 'Low Stock Product',
        availableQuantity: 2,
        minimumStock: 5
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('business_id', businessId);
      expect(queryBuilder.whereRaw).toHaveBeenCalledWith('available_quantity <= minimum_stock');
    });
  });

  describe('initializeInventory', () => {
    it('should create new inventory record', async () => {
      const inventoryData = {
        businessId: 'business-1',
        productId: 'product-1',
        initialQuantity: 100,
        minimumStock: 10,
        productName: 'New Product',
        unitPrice: 25
      };

      const insertedRecord = {
        id: 'inventory-1',
        business_id: inventoryData.businessId,
        product_id: inventoryData.productId,
        product_name: inventoryData.productName,
        total_quantity: inventoryData.initialQuantity,
        available_quantity: inventoryData.initialQuantity,
        reserved_quantity: 0,
        minimum_stock: inventoryData.minimumStock,
        is_tracking_enabled: true,
        unit_price: inventoryData.unitPrice,
        created_at: new Date()
      };

      const queryBuilder = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([insertedRecord])
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.initializeInventory(
        inventoryData.businessId,
        inventoryData.productId,
        inventoryData.initialQuantity,
        inventoryData.minimumStock,
        inventoryData.productName,
        inventoryData.unitPrice
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        business_id: inventoryData.businessId,
        product_id: inventoryData.productId,
        total_quantity: inventoryData.initialQuantity,
        available_quantity: inventoryData.initialQuantity,
        reserved_quantity: 0,
        minimum_stock: inventoryData.minimumStock,
        is_tracking_enabled: true,
        product_name: inventoryData.productName,
        unit_price: inventoryData.unitPrice
      });

      expect(result).toMatchObject({
        businessId: inventoryData.businessId,
        productId: inventoryData.productId,
        totalQuantity: inventoryData.initialQuantity,
        availableQuantity: inventoryData.initialQuantity,
        productName: inventoryData.productName,
        unitPrice: inventoryData.unitPrice
      });
    });
  });

  describe('getInventory', () => {
    it('should return cached inventory when available', async () => {
      const productId = 'product-1';
      const cachedInventory = JSON.stringify({
        id: '1',
        productId,
        totalQuantity: 100,
        availableQuantity: 80
      });

      mockRedis.get.mockResolvedValue(cachedInventory);

      const result = await inventoryService.getInventory(productId);

      expect(result).toMatchObject({
        productId,
        totalQuantity: 100,
        availableQuantity: 80
      });
      expect(mockRedis.get).toHaveBeenCalledWith(`inventory:${productId}`);
    });

    it('should fetch from database and cache when not cached', async () => {
      const productId = 'product-1';
      const dbRecord = {
        id: '1',
        business_id: 'business-1',
        product_id: productId,
        product_name: 'Test Product',
        total_quantity: 100,
        available_quantity: 80,
        reserved_quantity: 20,
        minimum_stock: 10,
        is_tracking_enabled: true,
        updated_at: new Date(),
        unit_price: 15
      };

      mockRedis.get.mockResolvedValue(null);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(dbRecord)
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.getInventory(productId);

      expect(result).toMatchObject({
        productId,
        productName: 'Test Product',
        totalQuantity: 100,
        availableQuantity: 80,
        reservedQuantity: 20,
        minimumStock: 10,
        unitPrice: 15
      });

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        `inventory:${productId}`,
        300,
        expect.any(String)
      );
    });

    it('should return null for non-existent product', async () => {
      mockRedis.get.mockResolvedValue(null);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      const result = await inventoryService.getInventory('nonexistent');

      expect(result).toBeNull();
    });
  });
});