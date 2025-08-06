import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { inventoryService } from './inventoryService';
import { reservationExpirationService } from './reservationExpirationService';
import type {
  CreateReservationInput,
  InventoryHold,
  Reservation,
  ReservationFilters,
  ReservationItem
} from '../types/Reservation';

export class ReservationService {
  /**
   * Create a new reservation with inventory holds
   */
  async createReservation(input: CreateReservationInput): Promise<Reservation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create the base booking record
      const bookingResult = await client.query(
        `INSERT INTO bookings 
         (business_id, customer_name, customer_phone, customer_email, scheduled_at, duration, total_amount, notes, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          input.businessId,
          input.customerInfo.name,
          input.customerInfo.phone,
          input.customerInfo.email,
          input.scheduledAt,
          input.duration,
          input.totalAmount,
          input.notes,
          'pending'
        ]
      );

      const booking = bookingResult.rows[0];

      // Create reservation record with extended properties
      const expiresAt = input.holdDuration 
        ? new Date(Date.now() + input.holdDuration * 60 * 1000)
        : new Date(Date.now() + 30 * 60 * 1000); // Default 30 minutes

      const reservationResult = await client.query(
        `INSERT INTO reservations 
         (id, type, items, requirements, expires_at, modification_policy, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          booking.id,
          input.type,
          input.items ? JSON.stringify(input.items) : null,
          input.requirements ? JSON.stringify(input.requirements) : null,
          expiresAt,
          JSON.stringify(this.getDefaultModificationPolicy(input.type))
        ]
      );

      const reservationRecord = reservationResult.rows[0];
      let inventoryHolds: InventoryHold[] = [];

      // Reserve inventory if items are included
      if (input.items && input.items.length > 0) {
        inventoryHolds = await inventoryService.reserveItems(
          input.items,
          input.holdDuration || 30,
          booking.id
        );
      }

      // Set up expiration handling
      await reservationExpirationService.setReservationTTL(
        booking.id,
        input.holdDuration || 30
      );

      await client.query('COMMIT');

      // Build complete reservation object
      const reservation: Reservation = {
        id: booking.id,
        businessId: booking.business_id,
        customerId: booking.customer_id,
        customerName: booking.customer_name,
        customerPhone: booking.customer_phone,
        customerEmail: booking.customer_email,
        scheduledAt: new Date(booking.scheduled_at),
        duration: booking.duration,
        totalAmount: booking.total_amount,
        status: booking.status,
        notes: booking.notes,
        createdAt: new Date(booking.created_at),
        updatedAt: new Date(booking.updated_at),
        type: reservationRecord.type,
        items: reservationRecord.items ? JSON.parse(reservationRecord.items) : undefined,
        requirements: reservationRecord.requirements ? JSON.parse(reservationRecord.requirements) : undefined,
        expiresAt: reservationRecord.expires_at ? new Date(reservationRecord.expires_at) : undefined,
        modificationPolicy: JSON.parse(reservationRecord.modification_policy),
        inventoryHolds
      };

      logger.info('Reservation created successfully', {
        reservationId: reservation.id,
        businessId: input.businessId,
        type: input.type,
        itemCount: input.items?.length || 0,
        inventoryHolds: inventoryHolds.length
      });

      return reservation;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating reservation', { error, input });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get reservations with filtering and pagination
   */
  async getReservations(businessId?: string, filters?: ReservationFilters): Promise<{
    reservations: Reservation[];
    total: number;
    hasMore: boolean;
  }> {
    const client = await pool.connect();
    try {
      let baseQuery = `
        SELECT b.*, r.type, r.items, r.requirements, r.expires_at, r.modification_policy
        FROM bookings b
        LEFT JOIN reservations r ON b.id = r.id
      `;
      let countQuery = 'SELECT COUNT(*) as count FROM bookings b LEFT JOIN reservations r ON b.id = r.id';
      
      const queryParams: any[] = [];
      const conditions: string[] = [];
      let paramIndex = 1;

      // Apply business filter
      if (businessId) {
        conditions.push(`b.business_id = $${paramIndex}`);
        queryParams.push(businessId);
        paramIndex++;
      }

      // Apply filters
      if (filters) {
        if (filters.status && filters.status.length > 0) {
          conditions.push(`b.status = ANY($${paramIndex})`);
          queryParams.push(filters.status);
          paramIndex++;
        }

        if (filters.type && filters.type.length > 0) {
          conditions.push(`r.type = ANY($${paramIndex})`);
          queryParams.push(filters.type);
          paramIndex++;
        }

        if (filters.customerId) {
          conditions.push(`b.customer_id = $${paramIndex}`);
          queryParams.push(filters.customerId);
          paramIndex++;
        }

        if (filters.dateRange) {
          conditions.push(`b.scheduled_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          queryParams.push(filters.dateRange[0], filters.dateRange[1]);
          paramIndex += 2;
        }

        if (filters.hasExpiredItems !== undefined) {
          if (filters.hasExpiredItems) {
            conditions.push(`r.expires_at < CURRENT_TIMESTAMP`);
          } else {
            conditions.push(`(r.expires_at IS NULL OR r.expires_at >= CURRENT_TIMESTAMP)`);
          }
        }
      }

      // Add WHERE clause if we have conditions
      if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(' AND ')}`;
        baseQuery += whereClause;
        countQuery += whereClause;
      }

      // Get total count
      const totalResult = await client.query(countQuery, queryParams);
      const total = parseInt(totalResult.rows[0].count);

      // Apply sorting
      const sortBy = filters?.sortBy || 'scheduledAt';
      const sortOrder = filters?.sortOrder || 'asc';
      
      let orderByClause = '';
      if (sortBy === 'scheduledAt') {
        orderByClause = `ORDER BY b.scheduled_at ${sortOrder}`;
      } else if (sortBy === 'createdAt') {
        orderByClause = `ORDER BY b.created_at ${sortOrder}`;
      } else if (sortBy === 'totalAmount') {
        orderByClause = `ORDER BY b.total_amount ${sortOrder}`;
      } else if (sortBy === 'status') {
        orderByClause = `ORDER BY b.status ${sortOrder}`;
      }

      baseQuery += ` ${orderByClause}`;

      // Apply pagination
      const limit = filters?.limit || 20;
      const offset = filters?.offset || 0;
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      const results = await client.query(baseQuery, queryParams);

      // Get inventory holds for each reservation
      const reservationIds = results.rows.map(r => r.id);
      let inventoryHolds: any[] = [];
      
      if (reservationIds.length > 0) {
        const holdsResult = await client.query(
          'SELECT * FROM inventory_holds WHERE reservation_id = ANY($1)',
          [reservationIds]
        );
        inventoryHolds = holdsResult.rows;
      }

      const holdsByReservation = inventoryHolds.reduce((acc, hold) => {
        if (!acc[hold.reservation_id]) {
          acc[hold.reservation_id] = [];
        }
        acc[hold.reservation_id].push({
          id: hold.id,
          productId: hold.product_id,
          quantity: hold.quantity_held,
          holdUntil: new Date(hold.hold_until),
          status: hold.status,
          createdAt: new Date(hold.created_at)
        });
        return acc;
      }, {} as Record<string, InventoryHold[]>);

      // Transform results to Reservation objects
      const reservations: Reservation[] = results.rows.map(record => ({
        id: record.id,
        businessId: record.business_id,
        customerId: record.customer_id,
        customerName: record.customer_name,
        customerPhone: record.customer_phone,
        customerEmail: record.customer_email,
        scheduledAt: new Date(record.scheduled_at),
        duration: record.duration,
        totalAmount: record.total_amount,
        status: record.status,
        notes: record.notes,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
        type: record.type,
        items: record.items ? JSON.parse(record.items) : undefined,
        requirements: record.requirements ? JSON.parse(record.requirements) : undefined,
        expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
        modificationPolicy: record.modification_policy ? JSON.parse(record.modification_policy) : this.getDefaultModificationPolicy(record.type),
        inventoryHolds: holdsByReservation[record.id] || []
      }));

      return {
        reservations,
        total,
        hasMore: (offset + limit) < total
      };
    } catch (error) {
      logger.error('Error retrieving reservations', { error, businessId, filters });
      throw new Error('Failed to retrieve reservations');
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a reservation and release inventory holds
   */
  async cancelReservation(
    reservationId: string, 
    cancelledBy: string, 
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the reservation
      const reservationResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1',
        [reservationId]
      );

      if (reservationResult.rows.length === 0) {
        return { success: false, message: 'Reservation not found' };
      }

      const reservation = reservationResult.rows[0];

      if (reservation.status === 'cancelled') {
        return { success: false, message: 'Reservation already cancelled' };
      }

      if (reservation.status === 'completed') {
        return { success: false, message: 'Cannot cancel completed reservation' };
      }

      // Update booking status
      const updatedNotes = reason 
        ? `${reservation.notes || ''}\n\nCancellation reason: ${reason}`
        : reservation.notes;

      await client.query(
        'UPDATE bookings SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['cancelled', updatedNotes, reservationId]
      );

      // Release inventory holds
      const holdsResult = await client.query(
        'SELECT * FROM inventory_holds WHERE reservation_id = $1 AND status = ANY($2)',
        [reservationId, ['active', 'confirmed']]
      );

      if (holdsResult.rows.length > 0) {
        const holdIds = holdsResult.rows.map(h => h.id);
        await inventoryService.releaseHolds(holdIds);
      }

      await client.query('COMMIT');

      logger.info('Reservation cancelled successfully', {
        reservationId,
        cancelledBy,
        reason,
        releasedHolds: holdsResult.rows.length
      });

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling reservation', { error, reservationId });
      throw new Error('Failed to cancel reservation');
    } finally {
      client.release();
    }
  }

  /**
   * Get a single reservation by ID
   */
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT b.*, r.type, r.items, r.requirements, r.expires_at, r.modification_policy
         FROM bookings b
         LEFT JOIN reservations r ON b.id = r.id
         WHERE b.id = $1`,
        [reservationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const record = result.rows[0];

      // Get inventory holds
      const holdsResult = await client.query(
        'SELECT * FROM inventory_holds WHERE reservation_id = $1',
        [reservationId]
      );

      const inventoryHolds = holdsResult.rows.map(hold => ({
        id: hold.id,
        productId: hold.product_id,
        quantity: hold.quantity_held,
        holdUntil: new Date(hold.hold_until),
        status: hold.status,
        createdAt: new Date(hold.created_at)
      }));

      return {
        id: record.id,
        businessId: record.business_id,
        customerId: record.customer_id,
        customerName: record.customer_name,
        customerPhone: record.customer_phone,
        customerEmail: record.customer_email,
        scheduledAt: new Date(record.scheduled_at),
        duration: record.duration,
        totalAmount: record.total_amount,
        status: record.status,
        notes: record.notes,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
        type: record.type,
        items: record.items ? JSON.parse(record.items) : undefined,
        requirements: record.requirements ? JSON.parse(record.requirements) : undefined,
        expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
        modificationPolicy: record.modification_policy ? JSON.parse(record.modification_policy) : this.getDefaultModificationPolicy(record.type),
        inventoryHolds
      };
    } catch (error) {
      logger.error('Error getting reservation by ID', { error, reservationId });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get default modification policy based on reservation type
   */
  private getDefaultModificationPolicy(type: string) {
    const basePolicies = {
      service: {
        allowModification: true,
        modificationDeadline: 24, // 24 hours
        modificationFee: 0,
        allowedChanges: [
          { field: 'time', restrictions: [], additionalFee: 0 },
          { field: 'date', restrictions: [], additionalFee: 5 }
        ],
        requiresApproval: false,
        maxModifications: 3
      },
      product: {
        allowModification: true,
        modificationDeadline: 2, // 2 hours
        modificationFee: 0,
        allowedChanges: [
          { field: 'quantity', restrictions: [], additionalFee: 0 },
          { field: 'specifications', restrictions: [], additionalFee: 0 }
        ],
        requiresApproval: true,
        maxModifications: 2
      },
      table: {
        allowModification: true,
        modificationDeadline: 2, // 2 hours
        modificationFee: 0,
        allowedChanges: [
          { field: 'time', restrictions: [], additionalFee: 0 },
          { field: 'service', restrictions: [], additionalFee: 0 }
        ],
        requiresApproval: false,
        maxModifications: 2
      },
      consultation: {
        allowModification: true,
        modificationDeadline: 48, // 48 hours
        modificationFee: 25,
        allowedChanges: [
          { field: 'time', restrictions: [], additionalFee: 0 },
          { field: 'date', restrictions: [], additionalFee: 10 }
        ],
        requiresApproval: true,
        maxModifications: 1
      },
      event: {
        allowModification: true,
        modificationDeadline: 168, // 1 week
        modificationFee: 50,
        allowedChanges: [
          { field: 'date', restrictions: [], additionalFee: 25 }
        ],
        requiresApproval: true,
        maxModifications: 1
      }
    };

    return basePolicies[type as keyof typeof basePolicies] || basePolicies.service;
  }
}

export const reservationService = new ReservationService();