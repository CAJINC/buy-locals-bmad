import { BaseRepository } from './BaseRepository';
import type { Booking, CreateBookingData, UpdateBookingData } from '../types/Booking';
import { logger } from '../utils/logger';

export interface FindConflictingBookingsOptions {
  businessId: string;
  startTime: Date;
  duration: number;
  excludeStatuses?: string[];
  excludeBookingId?: string;
}

export interface FindBookingsForDateOptions {
  businessId: string;
  date: Date;
  excludeStatuses?: string[];
}

export interface FindUserBookingsOptions {
  userId: string;
  status?: string;
  businessId?: string;
  limit: number;
  offset: number;
}

class BookingRepository extends BaseRepository {
  private readonly table = 'bookings';

  async create(data: CreateBookingData, transaction?: unknown): Promise<Booking> {
    const db = transaction || this.db;
    
    try {
      const [booking] = await db(this.table)
        .insert({
          consumer_id: data.consumerId,
          business_id: data.businessId,
          service_id: data.serviceId,
          scheduled_at: data.scheduledAt,
          duration: data.duration,
          status: data.status,
          notes: data.notes,
          total_amount: data.totalAmount,
          customer_info: JSON.stringify(data.customerInfo),
          created_at: data.createdAt,
          updated_at: data.updatedAt
        })
        .returning('*');

      return this.mapToBooking(booking);
    } catch (error) {
      logger.error('Error creating booking', { error, data });
      throw error;
    }
  }

  async findById(id: string, transaction?: unknown): Promise<Booking | null> {
    const db = transaction || this.db;
    
    try {
      const booking = await db(this.table)
        .where('id', id)
        .first();

      return booking ? this.mapToBooking(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by id', { error, id });
      throw error;
    }
  }

  async findByIdForUpdate(id: string, transaction: unknown): Promise<Booking | null> {
    try {
      const booking = await transaction(this.table)
        .where('id', id)
        .forUpdate()
        .first();

      return booking ? this.mapToBooking(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by id for update', { error, id });
      throw error;
    }
  }

  async update(id: string, data: UpdateBookingData, transaction?: unknown): Promise<Booking> {
    const db = transaction || this.db;
    
    try {
      const updateData: Record<string, unknown> = {
        updated_at: data.updatedAt
      };

      if (data.status !== undefined) updateData.status = data.status;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.cancelledAt !== undefined) updateData.cancelled_at = data.cancelledAt;
      if (data.cancellationReason !== undefined) updateData.cancellation_reason = data.cancellationReason;

      const [booking] = await db(this.table)
        .where('id', id)
        .update(updateData)
        .returning('*');

      if (!booking) {
        throw new Error('Booking not found for update');
      }

      return this.mapToBooking(booking);
    } catch (error) {
      logger.error('Error updating booking', { error, id, data });
      throw error;
    }
  }

  async findConflictingBookings(
    options: FindConflictingBookingsOptions,
    transaction?: unknown
  ): Promise<Booking[]> {
    const { businessId, startTime, duration, excludeStatuses = [], excludeBookingId } = options;
    const db = transaction || this.db;

    try {
      const endTime = new Date(startTime.getTime() + duration * 60000);
      
      let query = db(this.table)
        .where('business_id', businessId)
        .where(function() {
          this.where(function() {
            // Booking starts during the requested time slot
            this.where('scheduled_at', '>=', startTime)
              .andWhere('scheduled_at', '<', endTime);
          })
          .orWhere(function() {
            // Booking ends during the requested time slot
            this.whereRaw('scheduled_at + (duration * interval \'1 minute\') > ?', [startTime])
              .andWhere('scheduled_at', '<', startTime);
          })
          .orWhere(function() {
            // Booking completely encompasses the requested time slot
            this.where('scheduled_at', '<=', startTime)
              .andWhereRaw('scheduled_at + (duration * interval \'1 minute\') >= ?', [endTime]);
          });
        });

      if (excludeStatuses.length > 0) {
        query = query.whereNotIn('status', excludeStatuses);
      }

      if (excludeBookingId) {
        query = query.where('id', '!=', excludeBookingId);
      }

      if (transaction) {
        query = query.forUpdate();
      }

      const bookings = await query;
      return bookings.map(this.mapToBooking);
    } catch (error) {
      logger.error('Error finding conflicting bookings', { error, options });
      throw error;
    }
  }

  async findBookingsForDate(options: FindBookingsForDateOptions): Promise<Booking[]> {
    const { businessId, date, excludeStatuses = [] } = options;
    
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      let query = this.db(this.table)
        .where('business_id', businessId)
        .where('scheduled_at', '>=', startOfDay)
        .where('scheduled_at', '<=', endOfDay);

      if (excludeStatuses.length > 0) {
        query = query.whereNotIn('status', excludeStatuses);
      }

      const bookings = await query.orderBy('scheduled_at');
      return bookings.map(this.mapToBooking);
    } catch (error) {
      logger.error('Error finding bookings for date', { error, options });
      throw error;
    }
  }

  async findUserBookings(options: FindUserBookingsOptions): Promise<{
    bookings: Booking[];
    total: number;
  }> {
    const { userId, status, businessId, limit, offset } = options;
    
    try {
      let query = this.db(this.table)
        .where('consumer_id', userId);

      if (status) {
        query = query.where('status', status);
      }

      if (businessId) {
        query = query.where('business_id', businessId);
      }

      // Get total count
      const [{ count }] = await query.clone().count('id as count');
      const total = parseInt(count as string);

      // Get bookings with pagination
      const bookings = await query
        .orderBy('scheduled_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        bookings: bookings.map(this.mapToBooking),
        total
      };
    } catch (error) {
      logger.error('Error finding user bookings', { error, options });
      throw error;
    }
  }

  async findBusinessBookings(
    businessId: string,
    options: {
      status?: string;
      date?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ bookings: Booking[]; total: number }> {
    const { status, date, limit = 50, offset = 0 } = options;
    
    try {
      let query = this.db(this.table)
        .where('business_id', businessId);

      if (status) {
        query = query.where('status', status);
      }

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        query = query
          .where('scheduled_at', '>=', startOfDay)
          .where('scheduled_at', '<=', endOfDay);
      }

      // Get total count
      const [{ count }] = await query.clone().count('id as count');
      const total = parseInt(count as string);

      // Get bookings with pagination
      const bookings = await query
        .orderBy('scheduled_at', 'asc')
        .limit(limit)
        .offset(offset);

      return {
        bookings: bookings.map(this.mapToBooking),
        total
      };
    } catch (error) {
      logger.error('Error finding business bookings', { error, businessId, options });
      throw error;
    }
  }

  private mapToBooking(row: Record<string, unknown>): Booking {
    return {
      id: row.id,
      consumerId: row.consumer_id,
      businessId: row.business_id,
      serviceId: row.service_id,
      scheduledAt: new Date(row.scheduled_at),
      duration: row.duration,
      status: row.status,
      notes: row.notes,
      totalAmount: parseFloat(row.total_amount),
      customerInfo: typeof row.customer_info === 'string' 
        ? JSON.parse(row.customer_info) 
        : row.customer_info,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      cancellationReason: row.cancellation_reason
    };
  }
}

export const bookingRepository = new BookingRepository();