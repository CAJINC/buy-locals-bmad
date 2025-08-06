import { bookingRepository } from '../repositories/bookingRepository';
import { businessRepository } from '../repositories/businessRepository';
import { availabilityService } from './availabilityService';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';
import type { Booking, CancelBookingInput, CreateBookingInput, GetBookingsOptions } from '../types/Booking';

class BookingService {
  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const {
      businessId,
      serviceId,
      scheduledAt,
      duration,
      customerInfo,
      notes,
      totalAmount,
      consumerId
    } = input;

    // Start transaction for atomic booking creation
    return await bookingRepository.transaction(async (trx) => {
      // Verify business exists and is active
      const business = await businessRepository.findById(businessId, trx);
      if (!business) {
        throw new Error('Business not found');
      }

      if (!business.isActive) {
        throw new Error('Business is not accepting bookings');
      }

      // Check availability with lock
      const isAvailable = await availabilityService.checkAvailabilityWithLock({
        businessId,
        startTime: scheduledAt,
        duration,
        transaction: trx
      });

      if (!isAvailable) {
        throw new Error('Time slot no longer available');
      }

      // Validate service exists for the business
      if (serviceId && business.services) {
        const service = business.services.find((s: Record<string, unknown>) => s.id === serviceId);
        if (!service) {
          throw new Error('Service not available');
        }

        // Verify service duration matches or is not specified
        if (service.duration && service.duration !== duration) {
          logger.warn('Service duration mismatch', {
            serviceId,
            requestedDuration: duration,
            serviceDuration: service.duration
          });
        }
      }

      // Validate booking timing (business hours, advance booking rules)
      await this.validateBookingTiming(businessId, scheduledAt);

      // Create the booking
      const bookingData = {
        consumerId,
        businessId,
        serviceId,
        scheduledAt,
        duration,
        status: 'pending' as const,
        notes,
        totalAmount,
        customerInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const booking = await bookingRepository.create(bookingData, trx);

      // Reserve the time slot in availability cache
      await availabilityService.reserveTimeSlot({
        businessId,
        startTime: scheduledAt,
        duration,
        bookingId: booking.id
      });

      logger.info('Booking created successfully', {
        bookingId: booking.id,
        businessId,
        consumerId,
        scheduledAt: scheduledAt.toISOString()
      });

      return booking;
    });
  }

  async cancelBooking(input: CancelBookingInput): Promise<{
    booking: Booking;
    refundAmount: number;
    message: string;
  }> {
    const { bookingId, userId, reason, notifyBusiness = true } = input;

    return await bookingRepository.transaction(async (trx) => {
      // Get the booking with lock
      const booking = await bookingRepository.findByIdForUpdate(bookingId, trx);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check authorization
      if (booking.consumerId !== userId) {
        throw new Error('Unauthorized to cancel this booking');
      }

      // Check if booking can be cancelled
      if (booking.status === 'cancelled') {
        throw new Error('Booking is already cancelled');
      }

      if (booking.status === 'completed') {
        throw new Error('Booking cannot be cancelled (already completed)');
      }

      // Enforce cancellation notice period
      const now = new Date();
      const bookingTime = new Date(booking.scheduledAt);
      const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Default 24-hour cancellation policy (this could be business-specific)
      const requiredNoticeHours = 24;
      let refundAmount = 0;
      let message = '';

      if (hoursUntilBooking < requiredNoticeHours) {
        if (hoursUntilBooking < 2) {
          // Less than 2 hours: no refund
          message = 'Booking cancelled with no refund due to short notice period';
        } else {
          // Between 2-24 hours: partial refund
          refundAmount = booking.totalAmount * 0.5;
          message = 'Booking cancelled with 50% refund due to short notice period';
        }
      } else {
        // More than 24 hours: full refund
        refundAmount = booking.totalAmount;
        message = 'Booking cancelled with full refund';
      }

      // Update booking status
      const cancelledBooking = await bookingRepository.update(
        bookingId,
        {
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: reason,
          updatedAt: now
        },
        trx
      );

      // Release the time slot
      await availabilityService.releaseTimeSlot({
        businessId: booking.businessId,
        startTime: booking.scheduledAt,
        duration: booking.duration
      });

      // Send notifications
      if (notifyBusiness) {
        await notificationService.sendBookingCancellation({
          booking: cancelledBooking,
          reason,
          refundAmount
        });
      }

      logger.info('Booking cancelled', {
        bookingId,
        userId,
        reason,
        refundAmount,
        hoursNotice: hoursUntilBooking
      });

      return {
        booking: cancelledBooking,
        refundAmount,
        message
      };
    });
  }

  async getUserBookings(options: GetBookingsOptions): Promise<{
    bookings: Booking[];
    total: number;
  }> {
    const { userId, status, businessId, limit, offset } = options;

    const result = await bookingRepository.findUserBookings({
      userId,
      status,
      businessId,
      limit,
      offset
    });

    return result;
  }

  async getBookingById(bookingId: string, userId: string): Promise<Booking | null> {
    const booking = await bookingRepository.findById(bookingId);
    
    if (!booking) {
      return null;
    }

    // Check authorization
    if (booking.consumerId !== userId) {
      throw new Error('Unauthorized to view this booking');
    }

    return booking;
  }

  async updateBookingStatus(
    bookingId: string,
    status: Booking['status'],
    userId?: string
  ): Promise<Booking> {
    return await bookingRepository.transaction(async (trx) => {
      const booking = await bookingRepository.findByIdForUpdate(bookingId, trx);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Authorization check if userId provided
      if (userId && booking.consumerId !== userId) {
        throw new Error('Unauthorized to modify this booking');
      }

      const updatedBooking = await bookingRepository.update(
        bookingId,
        {
          status,
          updatedAt: new Date()
        },
        trx
      );

      logger.info('Booking status updated', {
        bookingId,
        oldStatus: booking.status,
        newStatus: status,
        userId
      });

      return updatedBooking;
    });
  }

  private async validateBookingTiming(businessId: string, scheduledAt: Date): Promise<void> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const now = new Date();
    const bookingTime = new Date(scheduledAt);

    // Check minimum advance booking time (default 2 hours)
    const minAdvanceHours = business.minAdvanceBookingHours || 2;
    const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < minAdvanceHours) {
      throw new Error(`Minimum advance booking time is ${minAdvanceHours} hours`);
    }

    // Check maximum advance booking window (default 90 days)
    const maxAdvanceDays = business.maxAdvanceBookingDays || 90;
    const daysUntilBooking = hoursUntilBooking / 24;

    if (daysUntilBooking > maxAdvanceDays) {
      throw new Error(`Maximum advance booking window is ${maxAdvanceDays} days`);
    }

    // Check if booking is during business hours
    const dayOfWeek = bookingTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const bookingHour = bookingTime.getHours();
    const bookingMinute = bookingTime.getMinutes();
    const bookingTimeInMinutes = bookingHour * 60 + bookingMinute;

    if (business.businessHours && business.businessHours[dayOfWeek]) {
      const dayHours = business.businessHours[dayOfWeek];
      
      if (!dayHours.isOpen) {
        throw new Error('Business is closed on this day');
      }

      const openTime = this.timeStringToMinutes(dayHours.open);
      const closeTime = this.timeStringToMinutes(dayHours.close);

      if (bookingTimeInMinutes < openTime || bookingTimeInMinutes > closeTime) {
        throw new Error('Booking time is outside business hours');
      }
    }
  }

  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

export const bookingService = new BookingService();