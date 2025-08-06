import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationService } from '../../services/reservationService';
import { inventoryService } from '../../services/inventoryService';
import { reservationExpirationService } from '../../services/reservationExpirationService';
import { db } from '../../utils/database';
import type { CreateReservationInput, ReservationType } from '../../types/Reservation';

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/logger');
jest.mock('../../services/inventoryService');
jest.mock('../../services/reservationExpirationService');

const mockDb = db as jest.Mocked<typeof db>;
const mockInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockExpirationService = reservationExpirationService as jest.Mocked<typeof reservationExpirationService>;

describe('ReservationService', () => {
  let reservationService: ReservationService;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    reservationService = new ReservationService();
    
    mockTransaction = jest.fn();
    mockDb.transaction = mockTransaction;
    
    // Setup default query builder
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereBetween: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      first: jest.fn(),
      clone: jest.fn().mockReturnThis(),
      count: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis()
    };

    (mockDb as any).mockReturnValue(queryBuilder);
    mockDb.table = jest.fn().mockReturnValue(queryBuilder);
  });

  describe('createReservation', () => {
    const validReservationInput: CreateReservationInput = {
      businessId: 'business-1',
      type: 'service' as ReservationType,
      scheduledAt: new Date('2025-08-07T14:00:00Z'),
      duration: 60,
      customerInfo: {
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com'
      },
      totalAmount: 100,
      notes: 'Test reservation'
    };

    it('should create reservation without inventory items', async () => {
      const mockBooking = {
        id: 'booking-1',
        business_id: 'business-1',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@example.com',
        scheduled_at: new Date('2025-08-07T14:00:00Z'),
        duration: 60,
        total_amount: 100,
        status: 'pending',
        notes: 'Test reservation',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockReservationRecord = {
        id: 'booking-1',
        type: 'service',
        items: null,
        requirements: null,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        modification_policy: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockTrx = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn()
          .mockResolvedValueOnce([mockBooking])
          .mockResolvedValueOnce([mockReservationRecord])
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      mockExpirationService.setReservationTTL.mockResolvedValue();

      const result = await reservationService.createReservation(validReservationInput);

      expect(result).toMatchObject({
        id: 'booking-1',
        businessId: 'business-1',
        customerName: 'John Doe',
        type: 'service',
        duration: 60,
        totalAmount: 100,
        status: 'pending'
      });

      expect(mockTrx.insert).toHaveBeenCalledTimes(2); // booking + reservation
      expect(mockExpirationService.setReservationTTL).toHaveBeenCalledWith('booking-1', 30);
    });

    it('should create reservation with inventory items', async () => {
      const inputWithItems: CreateReservationInput = {
        ...validReservationInput,
        items: [
          { productId: 'product-1', quantity: 2, price: 25, name: 'Product 1' },
          { productId: 'product-2', quantity: 1, price: 50, name: 'Product 2' }
        ],
        holdDuration: 60
      };

      const mockBooking = {
        id: 'booking-1',
        business_id: 'business-1',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@example.com',
        scheduled_at: new Date('2025-08-07T14:00:00Z'),
        duration: 60,
        total_amount: 100,
        status: 'pending',
        notes: 'Test reservation',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockReservationRecord = {
        id: 'booking-1',
        type: 'service',
        items: JSON.stringify(inputWithItems.items),
        requirements: null,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        modification_policy: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockInventoryHolds = [
        {
          id: 'hold-1',
          productId: 'product-1',
          quantity: 2,
          holdUntil: new Date(Date.now() + 60 * 60 * 1000),
          status: 'active' as const,
          createdAt: new Date()
        }
      ];

      const mockTrx = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn()
          .mockResolvedValueOnce([mockBooking])
          .mockResolvedValueOnce([mockReservationRecord])
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      mockInventoryService.reserveItems.mockResolvedValue(mockInventoryHolds);
      mockExpirationService.setReservationTTL.mockResolvedValue();

      const result = await reservationService.createReservation(inputWithItems);

      expect(result.items).toHaveLength(2);
      expect(result.inventoryHolds).toEqual(mockInventoryHolds);
      expect(mockInventoryService.reserveItems).toHaveBeenCalledWith(
        inputWithItems.items,
        60,
        'booking-1'
      );
      expect(mockExpirationService.setReservationTTL).toHaveBeenCalledWith('booking-1', 60);
    });

    it('should handle transaction rollback on error', async () => {
      const mockTrx = {
        insert: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      await expect(reservationService.createReservation(validReservationInput))
        .rejects.toThrow('Database error');
    });
  });

  describe('getReservations', () => {
    it('should get reservations with filters', async () => {
      const businessId = 'business-1';
      const filters = {
        status: ['pending', 'confirmed'],
        type: ['service'] as ReservationType[],
        limit: 10,
        offset: 0,
        sortBy: 'scheduledAt' as const,
        sortOrder: 'asc' as const
      };

      const mockReservations = [
        {
          id: 'booking-1',
          business_id: businessId,
          customer_name: 'John Doe',
          customer_phone: '+1234567890',
          customer_email: 'john@example.com',
          scheduled_at: new Date('2025-08-07T14:00:00Z'),
          duration: 60,
          total_amount: 100,
          status: 'pending',
          notes: 'Test reservation',
          created_at: new Date(),
          updated_at: new Date(),
          type: 'service',
          items: null,
          requirements: null,
          expires_at: null,
          modification_policy: JSON.stringify({})
        }
      ];

      const mockCountResult = [{ count: '5' }];
      const mockInventoryHolds: any[] = [];

      // Mock the query chain
      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue(mockCountResult),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnValue(mockReservations)
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      // Mock inventory holds query
      mockDb.table = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockInventoryHolds)
      });

      const result = await reservationService.getReservations(businessId, filters);

      expect(result).toMatchObject({
        reservations: expect.arrayContaining([
          expect.objectContaining({
            id: 'booking-1',
            businessId: businessId,
            customerName: 'John Doe',
            type: 'service',
            status: 'pending'
          })
        ]),
        total: 5,
        hasMore: false
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('bookings.business_id', businessId);
      expect(queryBuilder.whereIn).toHaveBeenCalledWith('bookings.status', ['pending', 'confirmed']);
      expect(queryBuilder.whereIn).toHaveBeenCalledWith('reservations.type', ['service']);
    });

    it('should handle date range filters', async () => {
      const businessId = 'business-1';
      const startDate = new Date('2025-08-01');
      const endDate = new Date('2025-08-31');
      
      const filters = {
        dateRange: [startDate, endDate] as [Date, Date],
        limit: 10,
        offset: 0
      };

      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereBetween: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '0' }]),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnValue([])
      };

      (mockDb as any).mockReturnValue(queryBuilder);
      mockDb.table = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      });

      await reservationService.getReservations(businessId, filters);

      expect(queryBuilder.whereBetween).toHaveBeenCalledWith('bookings.scheduled_at', [startDate, endDate]);
    });

    it('should handle expired items filter', async () => {
      const filters = {
        hasExpiredItems: true,
        limit: 10,
        offset: 0
      };

      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '0' }]),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnValue([])
      };

      (mockDb as any).mockReturnValue(queryBuilder);
      mockDb.table = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      });

      await reservationService.getReservations('business-1', filters);

      expect(queryBuilder.where).toHaveBeenCalledWith('reservations.expires_at', '<', expect.any(Date));
    });
  });

  describe('cancelReservation', () => {
    it('should cancel reservation and release holds', async () => {
      const reservationId = 'booking-1';
      const cancelledBy = 'user-1';
      const reason = 'Customer request';

      const mockReservation = {
        id: reservationId,
        status: 'pending',
        notes: 'Original notes'
      };

      const mockHolds = [
        { id: 'hold-1', reservation_id: reservationId, status: 'active' },
        { id: 'hold-2', reservation_id: reservationId, status: 'confirmed' }
      ];

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockReservation),
        update: jest.fn().mockResolvedValue(1),
        select: jest.fn().mockReturnValue(mockHolds)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      mockInventoryService.releaseHolds.mockResolvedValue();

      const result = await reservationService.cancelReservation(reservationId, cancelledBy, reason);

      expect(result.success).toBe(true);
      expect(mockTrx.update).toHaveBeenCalledWith({
        status: 'cancelled',
        notes: expect.stringContaining('Cancellation reason: Customer request'),
        updated_at: expect.any(Date)
      });
      expect(mockInventoryService.releaseHolds).toHaveBeenCalledWith(['hold-1', 'hold-2']);
    });

    it('should reject cancellation of already cancelled reservation', async () => {
      const mockReservation = {
        id: 'booking-1',
        status: 'cancelled'
      };

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockReservation)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      const result = await reservationService.cancelReservation('booking-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Reservation already cancelled');
    });

    it('should reject cancellation of completed reservation', async () => {
      const mockReservation = {
        id: 'booking-1',
        status: 'completed'
      };

      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockReservation)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      const result = await reservationService.cancelReservation('booking-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot cancel completed reservation');
    });

    it('should handle non-existent reservation', async () => {
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      const result = await reservationService.cancelReservation('nonexistent', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Reservation not found');
    });
  });

  describe('getDefaultModificationPolicy', () => {
    it('should return different policies for different reservation types', async () => {
      // Access private method via type assertion
      const getDefaultPolicy = (reservationService as any).getDefaultModificationPolicy.bind(reservationService);

      const servicePolicy = getDefaultPolicy('service');
      const productPolicy = getDefaultPolicy('product');
      const consultationPolicy = getDefaultPolicy('consultation');
      const eventPolicy = getDefaultPolicy('event');

      expect(servicePolicy.modificationDeadline).toBe(24);
      expect(productPolicy.modificationDeadline).toBe(2);
      expect(consultationPolicy.modificationDeadline).toBe(48);
      expect(eventPolicy.modificationDeadline).toBe(168);

      expect(servicePolicy.modificationFee).toBe(0);
      expect(consultationPolicy.modificationFee).toBe(25);
      expect(eventPolicy.modificationFee).toBe(50);

      expect(servicePolicy.requiresApproval).toBe(false);
      expect(productPolicy.requiresApproval).toBe(true);
      expect(consultationPolicy.requiresApproval).toBe(true);
    });

    it('should return service policy as default for unknown types', async () => {
      const getDefaultPolicy = (reservationService as any).getDefaultModificationPolicy.bind(reservationService);
      
      const unknownPolicy = getDefaultPolicy('unknown-type');
      const servicePolicy = getDefaultPolicy('service');

      expect(unknownPolicy).toEqual(servicePolicy);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in createReservation', async () => {
      const mockTrx = {
        insert: jest.fn().mockRejectedValue(new Error('Connection timeout'))
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      await expect(reservationService.createReservation(validReservationInput))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle database errors gracefully in getReservations', async () => {
      const queryBuilder = {
        leftJoin: jest.fn().mockRejectedValue(new Error('Query failed'))
      };

      (mockDb as any).mockReturnValue(queryBuilder);

      await expect(reservationService.getReservations('business-1'))
        .rejects.toThrow('Failed to retrieve reservations');
    });

    it('should handle transaction errors gracefully in cancelReservation', async () => {
      mockTransaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(reservationService.cancelReservation('booking-1', 'user-1'))
        .rejects.toThrow('Failed to cancel reservation');
    });
  });
});