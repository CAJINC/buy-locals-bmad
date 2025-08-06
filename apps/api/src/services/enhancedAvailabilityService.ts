import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { availabilityService } from './availabilityService';
import type { ServiceTypeConfig } from '../types/ServiceType';

export interface BlackoutPeriod {
  id: string;
  businessId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  serviceTypeIds?: string[]; // If specific to certain services
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrencePattern {
  type: 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N weeks/months/years
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: Date;
  occurrences?: number;
}

export interface SpecialHours {
  id: string;
  businessId: string;
  date: Date;
  startTime: string; // HH:MM format
  endTime: string;
  isOpen: boolean;
  description?: string;
  serviceTypeIds?: string[];
}

export interface BookingRestriction {
  id: string;
  businessId: string;
  name: string;
  type: 'advance_booking' | 'minimum_notice' | 'maximum_per_day' | 'capacity_limit' | 'time_window';
  rules: BookingRestrictionRules;
  serviceTypeIds?: string[];
  isActive: boolean;
}

export interface BookingRestrictionRules {
  advanceBookingDays?: number;
  minimumNoticeMinutes?: number;
  maximumBookingsPerDay?: number;
  maximumConcurrentBookings?: number;
  timeWindows?: Array<{
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    maxBookings?: number;
  }>;
}

export interface PremiumTimeSlot {
  id: string;
  businessId: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  priceMultiplier: number;
  description?: string;
  serviceTypeIds?: string[];
  validFrom?: Date;
  validUntil?: Date;
}

export interface EnhancedTimeSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  isPremium?: boolean;
  premiumMultiplier?: number;
  serviceId?: string;
  restrictions?: string[];
  metadata?: {
    conflictReason?: string;
    availableCapacity?: number;
    totalCapacity?: number;
    waitlistAvailable?: boolean;
  };
}

export class EnhancedAvailabilityService {
  private readonly redis = db.redis;

  /**
   * Get enhanced availability with blackout periods and restrictions
   */
  async getEnhancedAvailability(
    businessId: string,
    date: Date,
    serviceTypeId?: string,
    duration: number = 60
  ): Promise<EnhancedTimeSlot[]> {
    try {
      // Get basic time slots
      const basicSlots = await availabilityService.getAvailableTimeSlots(
        businessId,
        date,
        duration,
        serviceTypeId
      );

      // Get blackout periods
      const blackoutPeriods = await this.getActiveBlackoutPeriods(businessId, date, serviceTypeId);
      
      // Get special hours
      const specialHours = await this.getSpecialHours(businessId, date, serviceTypeId);
      
      // Get booking restrictions
      const restrictions = await this.getBookingRestrictions(businessId, serviceTypeId);
      
      // Get premium time slots
      const premiumSlots = await this.getPremiumTimeSlots(businessId, serviceTypeId);

      // Process and enhance each time slot
      const enhancedSlots: EnhancedTimeSlot[] = [];

      for (const slot of basicSlots) {
        const enhancedSlot = await this.enhanceTimeSlot(
          slot,
          blackoutPeriods,
          specialHours,
          restrictions,
          premiumSlots,
          businessId,
          serviceTypeId
        );

        enhancedSlots.push(enhancedSlot);
      }

      // Filter out unavailable slots unless explicitly requested
      return enhancedSlots.filter(slot => slot.isAvailable);
    } catch (error) {
      logger.error('Error getting enhanced availability', { 
        error, businessId, date, serviceTypeId 
      });
      return [];
    }
  }

  /**
   * Create blackout period
   */
  async createBlackoutPeriod(blackoutData: Omit<BlackoutPeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<BlackoutPeriod> {
    try {
      const [blackout] = await db('blackout_periods')
        .insert({
          business_id: blackoutData.businessId,
          title: blackoutData.title,
          description: blackoutData.description,
          start_date: blackoutData.startDate,
          end_date: blackoutData.endDate,
          is_recurring: blackoutData.isRecurring,
          recurrence_pattern: blackoutData.recurrencePattern ? JSON.stringify(blackoutData.recurrencePattern) : null,
          service_type_ids: blackoutData.serviceTypeIds ? JSON.stringify(blackoutData.serviceTypeIds) : null,
          is_active: blackoutData.isActive
        })
        .returning('*');

      logger.info('Blackout period created', {
        blackoutId: blackout.id,
        businessId: blackoutData.businessId,
        title: blackoutData.title
      });

      return this.transformBlackoutPeriod(blackout);
    } catch (error) {
      logger.error('Error creating blackout period', { error, blackoutData });
      throw new Error('Failed to create blackout period');
    }
  }

  /**
   * Create special hours
   */
  async createSpecialHours(specialHoursData: Omit<SpecialHours, 'id'>): Promise<SpecialHours> {
    try {
      const [specialHours] = await db('special_hours')
        .insert({
          business_id: specialHoursData.businessId,
          date: specialHoursData.date,
          start_time: specialHoursData.startTime,
          end_time: specialHoursData.endTime,
          is_open: specialHoursData.isOpen,
          description: specialHoursData.description,
          service_type_ids: specialHoursData.serviceTypeIds ? JSON.stringify(specialHoursData.serviceTypeIds) : null
        })
        .returning('*');

      logger.info('Special hours created', {
        specialHoursId: specialHours.id,
        businessId: specialHoursData.businessId,
        date: specialHoursData.date
      });

      return this.transformSpecialHours(specialHours);
    } catch (error) {
      logger.error('Error creating special hours', { error, specialHoursData });
      throw new Error('Failed to create special hours');
    }
  }

  /**
   * Create booking restriction
   */
  async createBookingRestriction(restrictionData: Omit<BookingRestriction, 'id'>): Promise<BookingRestriction> {
    try {
      const [restriction] = await db('booking_restrictions')
        .insert({
          business_id: restrictionData.businessId,
          name: restrictionData.name,
          type: restrictionData.type,
          rules: JSON.stringify(restrictionData.rules),
          service_type_ids: restrictionData.serviceTypeIds ? JSON.stringify(restrictionData.serviceTypeIds) : null,
          is_active: restrictionData.isActive
        })
        .returning('*');

      logger.info('Booking restriction created', {
        restrictionId: restriction.id,
        businessId: restrictionData.businessId,
        type: restrictionData.type
      });

      return this.transformBookingRestriction(restriction);
    } catch (error) {
      logger.error('Error creating booking restriction', { error, restrictionData });
      throw new Error('Failed to create booking restriction');
    }
  }

  /**
   * Check if booking is allowed based on restrictions
   */
  async validateBookingRestrictions(
    businessId: string,
    serviceTypeId: string | undefined,
    scheduledAt: Date,
    duration: number
  ): Promise<{ allowed: boolean; violations: string[] }> {
    try {
      const restrictions = await this.getBookingRestrictions(businessId, serviceTypeId);
      const violations: string[] = [];

      for (const restriction of restrictions) {
        const violation = await this.checkRestrictionViolation(
          restriction,
          scheduledAt,
          duration,
          businessId,
          serviceTypeId
        );

        if (violation) {
          violations.push(violation);
        }
      }

      return {
        allowed: violations.length === 0,
        violations
      };
    } catch (error) {
      logger.error('Error validating booking restrictions', { 
        error, businessId, serviceTypeId, scheduledAt 
      });
      return { allowed: false, violations: ['Unable to validate booking restrictions'] };
    }
  }

  /**
   * Get multi-day availability for extended bookings
   */
  async getMultiDayAvailability(
    businessId: string,
    startDate: Date,
    endDate: Date,
    serviceTypeId?: string,
    duration: number = 60
  ): Promise<Map<string, EnhancedTimeSlot[]>> {
    const availability = new Map<string, EnhancedTimeSlot[]>();
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const slots = await this.getEnhancedAvailability(
        businessId,
        new Date(currentDate),
        serviceTypeId,
        duration
      );
      
      availability.set(dateKey, slots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  }

  /**
   * Get timezone-aware availability
   */
  async getTimezoneAwareAvailability(
    businessId: string,
    date: Date,
    clientTimezone: string,
    serviceTypeId?: string,
    duration: number = 60
  ): Promise<EnhancedTimeSlot[]> {
    try {
      // Get business timezone from settings
      const businessSettings = await db('business_availability_settings')
        .where('business_id', businessId)
        .first();

      const businessTimezone = businessSettings?.timezone || 'UTC';

      // Convert date to business timezone for availability calculation
      const businessDate = this.convertTimezone(date, clientTimezone, businessTimezone);
      
      // Get availability in business timezone
      const availability = await this.getEnhancedAvailability(
        businessId,
        businessDate,
        serviceTypeId,
        duration
      );

      // Convert time slots back to client timezone
      return availability.map(slot => ({
        ...slot,
        startTime: this.convertTimezone(slot.startTime, businessTimezone, clientTimezone),
        endTime: this.convertTimezone(slot.endTime, businessTimezone, clientTimezone)
      }));
    } catch (error) {
      logger.error('Error getting timezone-aware availability', { 
        error, businessId, clientTimezone 
      });
      return [];
    }
  }

  private async enhanceTimeSlot(
    basicSlot: any,
    blackoutPeriods: BlackoutPeriod[],
    specialHours: SpecialHours[],
    restrictions: BookingRestriction[],
    premiumSlots: PremiumTimeSlot[],
    businessId: string,
    serviceTypeId?: string
  ): Promise<EnhancedTimeSlot> {
    const slot: EnhancedTimeSlot = {
      startTime: basicSlot.startTime,
      endTime: basicSlot.endTime,
      isAvailable: basicSlot.isAvailable,
      price: basicSlot.price,
      serviceId: basicSlot.serviceId,
      restrictions: [],
      metadata: {}
    };

    // Check blackout periods
    for (const blackout of blackoutPeriods) {
      if (this.isTimeSlotInBlackout(slot, blackout)) {
        slot.isAvailable = false;
        slot.metadata!.conflictReason = `Blackout period: ${blackout.title}`;
        slot.restrictions!.push(blackout.title);
      }
    }

    // Apply special hours
    const applicableSpecialHours = specialHours.filter(sh => 
      this.isSameDateAs(slot.startTime, sh.date)
    );

    if (applicableSpecialHours.length > 0) {
      const specialHour = applicableSpecialHours[0];
      if (!specialHour.isOpen) {
        slot.isAvailable = false;
        slot.metadata!.conflictReason = `Closed: ${specialHour.description || 'Special hours'}`;
      }
    }

    // Check premium pricing
    const applicablePremiumSlot = this.findApplicablePremiumSlot(slot, premiumSlots);
    if (applicablePremiumSlot) {
      slot.isPremium = true;
      slot.premiumMultiplier = applicablePremiumSlot.priceMultiplier;
      if (slot.price) {
        slot.price = slot.price * applicablePremiumSlot.priceMultiplier;
      }
    }

    // Check capacity limits
    const capacityInfo = await this.getSlotCapacityInfo(
      businessId,
      slot.startTime,
      serviceTypeId
    );

    slot.metadata!.availableCapacity = capacityInfo.available;
    slot.metadata!.totalCapacity = capacityInfo.total;
    slot.metadata!.waitlistAvailable = capacityInfo.waitlistEnabled;

    if (capacityInfo.available <= 0) {
      slot.isAvailable = false;
      slot.metadata!.conflictReason = 'Fully booked';
    }

    return slot;
  }

  private async getActiveBlackoutPeriods(
    businessId: string,
    date: Date,
    serviceTypeId?: string
  ): Promise<BlackoutPeriod[]> {
    try {
      const query = db('blackout_periods')
        .where('business_id', businessId)
        .where('is_active', true)
        .where(function() {
          // Non-recurring blackouts that overlap with the date
          this.where('is_recurring', false)
            .where('start_date', '<=', date)
            .where('end_date', '>=', date)
            .orWhere('is_recurring', true); // Get all recurring for processing
        });

      const blackouts = await query;
      
      return blackouts
        .map(b => this.transformBlackoutPeriod(b))
        .filter(blackout => {
          // Filter service-specific blackouts
          if (blackout.serviceTypeIds && blackout.serviceTypeIds.length > 0) {
            return serviceTypeId && blackout.serviceTypeIds.includes(serviceTypeId);
          }
          return true;
        })
        .filter(blackout => {
          // For recurring blackouts, check if date matches pattern
          if (blackout.isRecurring && blackout.recurrencePattern) {
            return this.matchesRecurrencePattern(date, blackout.recurrencePattern);
          }
          return true;
        });
    } catch (error) {
      logger.error('Error getting active blackout periods', { error, businessId, date });
      return [];
    }
  }

  private async getSpecialHours(
    businessId: string,
    date: Date,
    serviceTypeId?: string
  ): Promise<SpecialHours[]> {
    try {
      const specialHours = await db('special_hours')
        .where('business_id', businessId)
        .where('date', date.toISOString().split('T')[0]);

      return specialHours
        .map(sh => this.transformSpecialHours(sh))
        .filter(sh => {
          if (sh.serviceTypeIds && sh.serviceTypeIds.length > 0) {
            return serviceTypeId && sh.serviceTypeIds.includes(serviceTypeId);
          }
          return true;
        });
    } catch (error) {
      logger.error('Error getting special hours', { error, businessId, date });
      return [];
    }
  }

  private async getBookingRestrictions(
    businessId: string,
    serviceTypeId?: string
  ): Promise<BookingRestriction[]> {
    try {
      const restrictions = await db('booking_restrictions')
        .where('business_id', businessId)
        .where('is_active', true);

      return restrictions
        .map(r => this.transformBookingRestriction(r))
        .filter(restriction => {
          if (restriction.serviceTypeIds && restriction.serviceTypeIds.length > 0) {
            return serviceTypeId && restriction.serviceTypeIds.includes(serviceTypeId);
          }
          return true;
        });
    } catch (error) {
      logger.error('Error getting booking restrictions', { error, businessId });
      return [];
    }
  }

  private async getPremiumTimeSlots(
    businessId: string,
    serviceTypeId?: string
  ): Promise<PremiumTimeSlot[]> {
    try {
      const premiumSlots = await db('premium_time_slots')
        .where('business_id', businessId)
        .where(function() {
          this.whereNull('valid_until')
            .orWhere('valid_until', '>=', new Date());
        })
        .where(function() {
          this.whereNull('valid_from')
            .orWhere('valid_from', '<=', new Date());
        });

      return premiumSlots
        .map(ps => this.transformPremiumTimeSlot(ps))
        .filter(slot => {
          if (slot.serviceTypeIds && slot.serviceTypeIds.length > 0) {
            return serviceTypeId && slot.serviceTypeIds.includes(serviceTypeId);
          }
          return true;
        });
    } catch (error) {
      logger.error('Error getting premium time slots', { error, businessId });
      return [];
    }
  }

  // Transformation methods
  private transformBlackoutPeriod(dbRecord: any): BlackoutPeriod {
    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      title: dbRecord.title,
      description: dbRecord.description,
      startDate: new Date(dbRecord.start_date),
      endDate: new Date(dbRecord.end_date),
      isRecurring: dbRecord.is_recurring,
      recurrencePattern: dbRecord.recurrence_pattern ? JSON.parse(dbRecord.recurrence_pattern) : undefined,
      serviceTypeIds: dbRecord.service_type_ids ? JSON.parse(dbRecord.service_type_ids) : undefined,
      isActive: dbRecord.is_active,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    };
  }

  private transformSpecialHours(dbRecord: any): SpecialHours {
    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      date: new Date(dbRecord.date),
      startTime: dbRecord.start_time,
      endTime: dbRecord.end_time,
      isOpen: dbRecord.is_open,
      description: dbRecord.description,
      serviceTypeIds: dbRecord.service_type_ids ? JSON.parse(dbRecord.service_type_ids) : undefined
    };
  }

  private transformBookingRestriction(dbRecord: any): BookingRestriction {
    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      name: dbRecord.name,
      type: dbRecord.type,
      rules: JSON.parse(dbRecord.rules),
      serviceTypeIds: dbRecord.service_type_ids ? JSON.parse(dbRecord.service_type_ids) : undefined,
      isActive: dbRecord.is_active
    };
  }

  private transformPremiumTimeSlot(dbRecord: any): PremiumTimeSlot {
    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      startTime: dbRecord.start_time,
      endTime: dbRecord.end_time,
      daysOfWeek: JSON.parse(dbRecord.days_of_week || '[]'),
      priceMultiplier: dbRecord.price_multiplier,
      description: dbRecord.description,
      serviceTypeIds: dbRecord.service_type_ids ? JSON.parse(dbRecord.service_type_ids) : undefined,
      validFrom: dbRecord.valid_from ? new Date(dbRecord.valid_from) : undefined,
      validUntil: dbRecord.valid_until ? new Date(dbRecord.valid_until) : undefined
    };
  }

  // Helper methods would continue here...
  private isTimeSlotInBlackout(slot: EnhancedTimeSlot, blackout: BlackoutPeriod): boolean {
    return slot.startTime >= blackout.startDate && slot.startTime < blackout.endDate;
  }

  private isSameDateAs(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private findApplicablePremiumSlot(
    slot: EnhancedTimeSlot,
    premiumSlots: PremiumTimeSlot[]
  ): PremiumTimeSlot | null {
    const dayOfWeek = slot.startTime.getDay();
    const timeStr = slot.startTime.toTimeString().substring(0, 5);

    return premiumSlots.find(ps => 
      ps.daysOfWeek.includes(dayOfWeek) &&
      timeStr >= ps.startTime &&
      timeStr < ps.endTime
    ) || null;
  }

  private matchesRecurrencePattern(date: Date, pattern: RecurrencePattern): boolean {
    // Implementation would check if date matches the recurrence pattern
    // This is a simplified version
    if (pattern.type === 'weekly') {
      return pattern.daysOfWeek?.includes(date.getDay()) || false;
    }
    return false;
  }

  private async getSlotCapacityInfo(
    businessId: string,
    startTime: Date,
    serviceTypeId?: string
  ): Promise<{ total: number; available: number; waitlistEnabled: boolean }> {
    // Implementation would check existing bookings and capacity limits
    return { total: 10, available: 8, waitlistEnabled: true };
  }

  private async checkRestrictionViolation(
    restriction: BookingRestriction,
    scheduledAt: Date,
    duration: number,
    businessId: string,
    serviceTypeId?: string
  ): Promise<string | null> {
    // Implementation would check each restriction type
    return null;
  }

  private convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    // Implementation would convert between timezones
    return date;
  }
}

export const enhancedAvailabilityService = new EnhancedAvailabilityService();