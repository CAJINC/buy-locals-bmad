import { bookingRepository } from '../repositories/bookingRepository';
import { businessRepository } from '../repositories/businessRepository';
import { redisClient as redis } from '../config/redis';
import { logger } from '../utils/logger';

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  serviceId?: string;
}

export interface GetAvailabilityOptions {
  businessId: string;
  date: Date;
  serviceId?: string;
  duration?: number;
}

export interface CheckAvailabilityOptions {
  businessId: string;
  startTime: Date;
  duration: number;
  transaction?: any;
}

export interface ReserveTimeSlotOptions {
  businessId: string;
  startTime: Date;
  duration: number;
  bookingId: string;
}

class AvailabilityService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly DEFAULT_SLOT_DURATION = 60; // 60 minutes
  private readonly DEFAULT_BUFFER_TIME = 15; // 15 minutes

  async getAvailability(options: GetAvailabilityOptions): Promise<TimeSlot[]> {
    const { businessId, date, serviceId, duration } = options;

    // Generate cache key
    const cacheKey = this.generateCacheKey(businessId, date, serviceId, duration);
    
    try {
      // Try to get from cache first
      const cachedSlots = await redis.get(cacheKey);
      if (cachedSlots) {
        logger.debug('Availability retrieved from cache', { businessId, date });
        return JSON.parse(cachedSlots).map((slot: any) => ({
          ...slot,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime)
        }));
      }
    } catch (error) {
      logger.warn('Cache retrieval failed, falling back to database', error);
    }

    // Generate fresh availability slots
    const slots = await this.generateAvailabilitySlots(options);

    // Cache the results
    try {
      await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(slots));
    } catch (error) {
      logger.warn('Failed to cache availability', error);
    }

    return slots;
  }

  async checkAvailabilityWithLock(options: CheckAvailabilityOptions): Promise<boolean> {
    const { businessId, startTime, duration, transaction } = options;

    // Check for conflicting bookings with database lock
    const conflictingBookings = await bookingRepository.findConflictingBookings(
      {
        businessId,
        startTime,
        duration,
        excludeStatuses: ['cancelled']
      },
      transaction
    );

    return conflictingBookings.length === 0;
  }

  async reserveTimeSlot(options: ReserveTimeSlotOptions): Promise<void> {
    const { businessId, startTime, duration } = options;

    // Invalidate cache for the affected date
    const date = new Date(startTime);
    date.setHours(0, 0, 0, 0);
    
    const cachePattern = this.generateCachePattern(businessId, date);
    await this.invalidateCachePattern(cachePattern);

    logger.debug('Time slot reserved and cache invalidated', {
      businessId,
      startTime: startTime.toISOString(),
      duration
    });
  }

  async releaseTimeSlot(options: Omit<ReserveTimeSlotOptions, 'bookingId'>): Promise<void> {
    const { businessId, startTime, duration } = options;

    // Invalidate cache for the affected date
    const date = new Date(startTime);
    date.setHours(0, 0, 0, 0);
    
    const cachePattern = this.generateCachePattern(businessId, date);
    await this.invalidateCachePattern(cachePattern);

    logger.debug('Time slot released and cache invalidated', {
      businessId,
      startTime: startTime.toISOString(),
      duration
    });
  }

  private async generateAvailabilitySlots(options: GetAvailabilityOptions): Promise<TimeSlot[]> {
    const { businessId, date, serviceId, duration } = options;

    // Get business information
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    // Get business hours for the requested date
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const businessHours = business.businessHours?.[dayOfWeek];

    if (!businessHours || !businessHours.isOpen) {
      // Business is closed on this day
      return [];
    }

    // Get service information if specified
    let serviceDuration = duration || this.DEFAULT_SLOT_DURATION;
    let bufferTime = this.DEFAULT_BUFFER_TIME;
    let servicePrice: number | undefined;

    if (serviceId && business.services) {
      const service = business.services.find((s: any) => s.id === serviceId);
      if (service) {
        serviceDuration = service.duration || serviceDuration;
        bufferTime = service.bufferTime || bufferTime;
        servicePrice = service.price;
      }
    }

    // Parse business hours
    const openTime = this.timeStringToMinutes(businessHours.open);
    const closeTime = this.timeStringToMinutes(businessHours.close);

    // Generate potential time slots
    const slots: TimeSlot[] = [];
    const slotInterval = serviceDuration + bufferTime;

    for (let timeInMinutes = openTime; timeInMinutes + serviceDuration <= closeTime; timeInMinutes += slotInterval) {
      const startTime = this.minutesToDateTime(date, timeInMinutes);
      const endTime = new Date(startTime.getTime() + serviceDuration * 60000);

      slots.push({
        startTime,
        endTime,
        isAvailable: true, // We'll check this against existing bookings
        price: servicePrice,
        serviceId: serviceId
      });
    }

    // Check existing bookings to mark unavailable slots
    const existingBookings = await bookingRepository.findBookingsForDate({
      businessId,
      date,
      excludeStatuses: ['cancelled']
    });

    // Mark slots as unavailable if they conflict with existing bookings
    for (const slot of slots) {
      for (const booking of existingBookings) {
        const bookingStart = new Date(booking.scheduledAt);
        const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);

        // Check if there's any overlap
        if (
          (slot.startTime >= bookingStart && slot.startTime < bookingEnd) ||
          (slot.endTime > bookingStart && slot.endTime <= bookingEnd) ||
          (slot.startTime <= bookingStart && slot.endTime >= bookingEnd)
        ) {
          slot.isAvailable = false;
          break;
        }
      }
    }

    // Filter to only return available slots unless explicitly requested
    return slots.filter(slot => slot.isAvailable);
  }

  private generateCacheKey(businessId: string, date: Date, serviceId?: string, duration?: number): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `availability:${businessId}:${dateStr}:${serviceId || 'all'}:${duration || 'default'}`;
  }

  private generateCachePattern(businessId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `availability:${businessId}:${dateStr}:*`;
  }

  private async invalidateCachePattern(pattern: string): Promise<void> {
    try {
      // Note: Redis KEYS command is not ideal for production with large datasets
      // Consider using Redis Streams or other patterns for better performance
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Cache invalidated', { pattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.warn('Cache invalidation failed', error);
    }
  }

  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToDateTime(date: Date, minutes: number): Date {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    const result = new Date(date);
    result.setHours(hours, mins, 0, 0);
    
    return result;
  }
}

export const availabilityService = new AvailabilityService();