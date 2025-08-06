import { businessRepository } from '../repositories/businessRepository';
import { logger } from '../utils/logger';

export interface BusinessHours {
  [key: number]: {
    isOpen: boolean;
    open: string; // HH:mm format
    close: string; // HH:mm format
    breaks?: Array<{
      start: string;
      end: string;
    }>;
  };
}

export interface ServiceAvailability {
  id: string;
  name: string;
  duration: number; // minutes
  bufferTime: number; // minutes between appointments
  price?: number;
  description?: string;
  isActive: boolean;
  maxBookingsPerDay?: number;
  advanceBookingDays?: number; // how far in advance bookings can be made
  cancellationHours?: number; // hours notice required for cancellation
}

export interface AvailabilitySettings {
  businessHours: BusinessHours;
  services: ServiceAvailability[];
  holidayDates: string[]; // ISO date strings for business closures
  specialHours: Array<{
    date: string; // ISO date string
    hours: {
      isOpen: boolean;
      open?: string;
      close?: string;
    };
    reason?: string;
  }>;
  bookingSettings: {
    minAdvanceBookingHours: number;
    maxAdvanceBookingDays: number;
    defaultServiceDuration: number;
    defaultBufferTime: number;
    allowOnlineBooking: boolean;
    requireApproval: boolean;
    autoConfirm: boolean;
  };
  timezone: string; // Business timezone for accurate scheduling
}

class AvailabilitySettingsService {
  async getBusinessAvailabilitySettings(
    businessId: string,
    userId: string
  ): Promise<AvailabilitySettings | null> {
    // Verify user owns or has access to this business
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    // Check authorization (business owner or admin)
    if (business.owner_id !== userId) {
      throw new Error('Unauthorized to access this business');
    }

    // Extract availability settings from business data
    const settings: AvailabilitySettings = {
      businessHours: business.hours || this.getDefaultBusinessHours(),
      services: business.services || [],
      holidayDates: business.holiday_dates || [],
      specialHours: business.special_hours || [],
      bookingSettings: {
        minAdvanceBookingHours: business.min_advance_booking_hours || 2,
        maxAdvanceBookingDays: business.max_advance_booking_days || 90,
        defaultServiceDuration: business.default_service_duration || 60,
        defaultBufferTime: business.default_buffer_time || 15,
        allowOnlineBooking: business.allow_online_booking !== false,
        requireApproval: business.require_approval || false,
        autoConfirm: business.auto_confirm || true
      },
      timezone: business.timezone || 'America/New_York'
    };

    return settings;
  }

  async updateBusinessAvailabilitySettings(
    businessId: string,
    userId: string,
    settings: Partial<AvailabilitySettings>
  ): Promise<AvailabilitySettings> {
    // Verify user owns this business
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner_id !== userId) {
      throw new Error('Unauthorized to modify this business');
    }

    // Validate business hours if provided
    if (settings.businessHours) {
      this.validateBusinessHours(settings.businessHours);
    }

    // Validate services if provided
    if (settings.services) {
      this.validateServices(settings.services);
    }

    // Validate special hours if provided
    if (settings.specialHours) {
      this.validateSpecialHours(settings.specialHours);
    }

    // Update business with new availability settings
    const updateData: any = {};

    if (settings.businessHours) {
      updateData.hours = settings.businessHours;
    }

    if (settings.services) {
      updateData.services = settings.services;
    }

    if (settings.holidayDates) {
      updateData.holiday_dates = settings.holidayDates;
    }

    if (settings.specialHours) {
      updateData.special_hours = settings.specialHours;
    }

    if (settings.bookingSettings) {
      const bookingSettings = settings.bookingSettings;
      if (bookingSettings.minAdvanceBookingHours !== undefined) {
        updateData.min_advance_booking_hours = bookingSettings.minAdvanceBookingHours;
      }
      if (bookingSettings.maxAdvanceBookingDays !== undefined) {
        updateData.max_advance_booking_days = bookingSettings.maxAdvanceBookingDays;
      }
      if (bookingSettings.defaultServiceDuration !== undefined) {
        updateData.default_service_duration = bookingSettings.defaultServiceDuration;
      }
      if (bookingSettings.defaultBufferTime !== undefined) {
        updateData.default_buffer_time = bookingSettings.defaultBufferTime;
      }
      if (bookingSettings.allowOnlineBooking !== undefined) {
        updateData.allow_online_booking = bookingSettings.allowOnlineBooking;
      }
      if (bookingSettings.requireApproval !== undefined) {
        updateData.require_approval = bookingSettings.requireApproval;
      }
      if (bookingSettings.autoConfirm !== undefined) {
        updateData.auto_confirm = bookingSettings.autoConfirm;
      }
    }

    if (settings.timezone) {
      updateData.timezone = settings.timezone;
    }

    updateData.updated_at = new Date();

    // Update the business
    await businessRepository.update(businessId, updateData);

    // Return the updated settings
    return this.getBusinessAvailabilitySettings(businessId, userId) as Promise<AvailabilitySettings>;
  }

  async addService(
    businessId: string,
    userId: string,
    service: Omit<ServiceAvailability, 'id'>
  ): Promise<ServiceAvailability> {
    const settings = await this.getBusinessAvailabilitySettings(businessId, userId);
    if (!settings) {
      throw new Error('Business settings not found');
    }

    const newService: ServiceAvailability = {
      ...service,
      id: this.generateServiceId(),
      isActive: service.isActive !== false
    };

    this.validateService(newService);

    const updatedServices = [...settings.services, newService];
    await this.updateBusinessAvailabilitySettings(businessId, userId, {
      services: updatedServices
    });

    logger.info('Service added to business', {
      businessId,
      serviceId: newService.id,
      serviceName: newService.name
    });

    return newService;
  }

  async updateService(
    businessId: string,
    userId: string,
    serviceId: string,
    updates: Partial<ServiceAvailability>
  ): Promise<ServiceAvailability> {
    const settings = await this.getBusinessAvailabilitySettings(businessId, userId);
    if (!settings) {
      throw new Error('Business settings not found');
    }

    const serviceIndex = settings.services.findIndex(s => s.id === serviceId);
    if (serviceIndex === -1) {
      throw new Error('Service not found');
    }

    const updatedService = { ...settings.services[serviceIndex], ...updates };
    this.validateService(updatedService);

    const updatedServices = [...settings.services];
    updatedServices[serviceIndex] = updatedService;

    await this.updateBusinessAvailabilitySettings(businessId, userId, {
      services: updatedServices
    });

    logger.info('Service updated', {
      businessId,
      serviceId,
      serviceName: updatedService.name
    });

    return updatedService;
  }

  async deleteService(
    businessId: string,
    userId: string,
    serviceId: string
  ): Promise<void> {
    const settings = await this.getBusinessAvailabilitySettings(businessId, userId);
    if (!settings) {
      throw new Error('Business settings not found');
    }

    const updatedServices = settings.services.filter(s => s.id !== serviceId);
    
    if (updatedServices.length === settings.services.length) {
      throw new Error('Service not found');
    }

    await this.updateBusinessAvailabilitySettings(businessId, userId, {
      services: updatedServices
    });

    logger.info('Service deleted', { businessId, serviceId });
  }

  private getDefaultBusinessHours(): BusinessHours {
    const defaultHours = {
      isOpen: true,
      open: '09:00',
      close: '17:00'
    };

    return {
      0: { isOpen: false, open: '09:00', close: '17:00' }, // Sunday
      1: defaultHours, // Monday
      2: defaultHours, // Tuesday
      3: defaultHours, // Wednesday
      4: defaultHours, // Thursday
      5: defaultHours, // Friday
      6: { isOpen: true, open: '10:00', close: '16:00' } // Saturday
    };
  }

  private validateBusinessHours(hours: BusinessHours): void {
    for (const [day, dayHours] of Object.entries(hours)) {
      const dayNum = parseInt(day);
      if (dayNum < 0 || dayNum > 6) {
        throw new Error(`Invalid day number: ${day}. Must be 0-6 (Sunday-Saturday)`);
      }

      if (dayHours.isOpen) {
        if (!this.isValidTimeFormat(dayHours.open)) {
          throw new Error(`Invalid time format for open time on day ${day}: ${dayHours.open}`);
        }
        if (!this.isValidTimeFormat(dayHours.close)) {
          throw new Error(`Invalid time format for close time on day ${day}: ${dayHours.close}`);
        }

        const openMinutes = this.timeToMinutes(dayHours.open);
        const closeMinutes = this.timeToMinutes(dayHours.close);

        if (openMinutes >= closeMinutes) {
          throw new Error(`Open time must be before close time for day ${day}`);
        }

        // Validate breaks if present
        if (dayHours.breaks) {
          for (const breakTime of dayHours.breaks) {
            if (!this.isValidTimeFormat(breakTime.start) || !this.isValidTimeFormat(breakTime.end)) {
              throw new Error(`Invalid break time format for day ${day}`);
            }

            const breakStart = this.timeToMinutes(breakTime.start);
            const breakEnd = this.timeToMinutes(breakTime.end);

            if (breakStart >= breakEnd) {
              throw new Error(`Break start time must be before break end time for day ${day}`);
            }

            if (breakStart < openMinutes || breakEnd > closeMinutes) {
              throw new Error(`Break times must be within business hours for day ${day}`);
            }
          }
        }
      }
    }
  }

  private validateServices(services: ServiceAvailability[]): void {
    for (const service of services) {
      this.validateService(service);
    }
  }

  private validateService(service: ServiceAvailability): void {
    if (!service.name || service.name.trim().length === 0) {
      throw new Error('Service name is required');
    }

    if (!service.duration || service.duration < 15 || service.duration > 480) {
      throw new Error('Service duration must be between 15 and 480 minutes');
    }

    if (service.bufferTime < 0 || service.bufferTime > 120) {
      throw new Error('Buffer time must be between 0 and 120 minutes');
    }

    if (service.price !== undefined && service.price < 0) {
      throw new Error('Service price cannot be negative');
    }

    if (service.maxBookingsPerDay !== undefined && service.maxBookingsPerDay < 1) {
      throw new Error('Max bookings per day must be at least 1');
    }

    if (service.advanceBookingDays !== undefined && (service.advanceBookingDays < 1 || service.advanceBookingDays > 365)) {
      throw new Error('Advance booking days must be between 1 and 365');
    }

    if (service.cancellationHours !== undefined && service.cancellationHours < 0) {
      throw new Error('Cancellation hours cannot be negative');
    }
  }

  private validateSpecialHours(specialHours: AvailabilitySettings['specialHours']): void {
    for (const special of specialHours) {
      if (!special.date || !/^\d{4}-\d{2}-\d{2}$/.test(special.date)) {
        throw new Error(`Invalid date format for special hours: ${special.date}`);
      }

      if (special.hours.isOpen) {
        if (!special.hours.open || !special.hours.close) {
          throw new Error(`Open and close times required for special hours on ${special.date}`);
        }

        if (!this.isValidTimeFormat(special.hours.open) || !this.isValidTimeFormat(special.hours.close)) {
          throw new Error(`Invalid time format for special hours on ${special.date}`);
        }

        const openMinutes = this.timeToMinutes(special.hours.open);
        const closeMinutes = this.timeToMinutes(special.hours.close);

        if (openMinutes >= closeMinutes) {
          throw new Error(`Open time must be before close time for special hours on ${special.date}`);
        }
      }
    }
  }

  private isValidTimeFormat(time: string): boolean {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private generateServiceId(): string {
    return `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const availabilitySettingsService = new AvailabilitySettingsService();