import { HoursTimeSlot, WeeklyHours } from '../../types/business';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class HoursValidationService {
  /**
   * Validates a single day's hours
   */
  validateDayHours(dayName: string, dayHours: HoursTimeSlot): ValidationResult {
    const errors: string[] = [];
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // If day is closed, no further validation needed
    if (dayHours.closed) {
      return { isValid: true, errors: [] };
    }

    // Check for required fields when not closed
    if (!dayHours.open) {
      errors.push(`${capitalizedDay}: Open time is required when not closed`);
    }

    if (!dayHours.close) {
      errors.push(`${capitalizedDay}: Close time is required when not closed`);
    }

    // Validate time formats
    if (dayHours.open && !this.validateTimeFormat(dayHours.open)) {
      if (this.isInvalidHour(dayHours.open)) {
        errors.push(`${capitalizedDay}: Invalid open time - hours must be 00-23`);
      } else if (this.isInvalidMinute(dayHours.open)) {
        errors.push(`${capitalizedDay}: Invalid open time - minutes must be 00-59`);
      } else {
        errors.push(`${capitalizedDay}: Open time must be in HH:MM format`);
      }
    }

    if (dayHours.close && !this.validateTimeFormat(dayHours.close)) {
      if (this.isInvalidHour(dayHours.close)) {
        errors.push(`${capitalizedDay}: Invalid close time - hours must be 00-23`);
      } else if (this.isInvalidMinute(dayHours.close)) {
        errors.push(`${capitalizedDay}: Invalid close time - minutes must be 00-59`);
      } else {
        errors.push(`${capitalizedDay}: Close time must be in HH:MM format`);
      }
    }

    // Validate time logic (only if both times are valid)
    if (dayHours.open && dayHours.close && 
        this.validateTimeFormat(dayHours.open) && 
        this.validateTimeFormat(dayHours.close)) {
      
      // Allow overnight schedules, but validate same-day schedules
      if (!this.isOvernightSchedule(dayHours.open, dayHours.close)) {
        const openMinutes = this.timeToMinutes(dayHours.open);
        const closeMinutes = this.timeToMinutes(dayHours.close);
        
        if (closeMinutes <= openMinutes) {
          errors.push(`${capitalizedDay}: Close time must be after open time`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates a complete weekly schedule
   */
  validateWeeklyHours(weeklyHours: WeeklyHours): ValidationResult {
    const errors: string[] = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    let hasOpenDays = false;

    // Validate each day
    for (const day of days) {
      const dayHours = weeklyHours[day];
      if (dayHours) {
        const dayValidation = this.validateDayHours(day, dayHours);
        errors.push(...dayValidation.errors);
        
        // Check if there are any open days
        if (!dayHours.closed) {
          hasOpenDays = true;
        }
      }
    }

    // Warn if no days are open
    if (!hasOpenDays && Object.keys(weeklyHours).length > 0) {
      errors.push('Warning: Business is closed all week');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates time format (HH:MM)
   */
  validateTimeFormat(time: string | null | undefined): boolean {
    if (!time) return false;
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Checks if the hour component is invalid
   */
  private isInvalidHour(time: string): boolean {
    const parts = time.split(':');
    if (parts.length !== 2) return false;
    
    const hour = parseInt(parts[0], 10);
    return isNaN(hour) || hour < 0 || hour > 23;
  }

  /**
   * Checks if the minute component is invalid
   */
  private isInvalidMinute(time: string): boolean {
    const parts = time.split(':');
    if (parts.length !== 2) return false;
    
    const minute = parseInt(parts[1], 10);
    return isNaN(minute) || minute < 0 || minute > 59;
  }

  /**
   * Converts time string to minutes since midnight
   */
  timeToMinutes(time: string): number {
    if (!this.validateTimeFormat(time)) {
      return 0;
    }

    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Converts minutes since midnight to time string
   */
  minutesToTime(minutes: number): string {
    // Handle negative and overflow values
    const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
    
    const hours = Math.floor(normalizedMinutes / 60);
    const mins = normalizedMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Determines if the schedule spans overnight (close time is next day)
   */
  isOvernightSchedule(openTime: string, closeTime: string): boolean {
    if (!this.validateTimeFormat(openTime) || !this.validateTimeFormat(closeTime)) {
      return false;
    }

    const openMinutes = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);
    
    return closeMinutes < openMinutes;
  }

  /**
   * Calculates duration in minutes, handling overnight schedules
   */
  calculateDuration(openTime: string, closeTime: string): number {
    if (!this.validateTimeFormat(openTime) || !this.validateTimeFormat(closeTime)) {
      return 0;
    }

    const openMinutes = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);
    
    if (this.isOvernightSchedule(openTime, closeTime)) {
      // Overnight: add 24 hours to close time for calculation
      return (closeMinutes + 1440) - openMinutes;
    } else {
      return closeMinutes - openMinutes;
    }
  }

  /**
   * Validates that hours don't exceed maximum reasonable duration
   */
  validateReasonableDuration(openTime: string, closeTime: string, maxHours: number = 24): ValidationResult {
    const duration = this.calculateDuration(openTime, closeTime);
    const maxMinutes = maxHours * 60;

    if (duration > maxMinutes) {
      return {
        isValid: false,
        errors: [`Duration of ${Math.round(duration / 60)} hours exceeds maximum of ${maxHours} hours`],
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validates special business rules
   */
  validateBusinessRules(dayName: string, dayHours: HoursTimeSlot): ValidationResult {
    const errors: string[] = [];
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    if (dayHours.closed || !dayHours.open || !dayHours.close) {
      return { isValid: true, errors: [] };
    }

    // Check for very short operating hours (less than 1 hour might be suspicious)
    const duration = this.calculateDuration(dayHours.open, dayHours.close);
    if (duration < 30) { // Less than 30 minutes
      errors.push(`${capitalizedDay}: Operating hours are very short (${duration} minutes)`);
    }

    // Check for very long hours (more than 18 hours might be suspicious)
    if (duration > 18 * 60) { // More than 18 hours
      errors.push(`${capitalizedDay}: Operating hours are very long (${Math.round(duration / 60)} hours)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Comprehensive validation combining all rules
   */
  validateComprehensive(dayName: string, dayHours: HoursTimeSlot): ValidationResult {
    const basicValidation = this.validateDayHours(dayName, dayHours);
    
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    const businessRulesValidation = this.validateBusinessRules(dayName, dayHours);
    
    return {
      isValid: basicValidation.isValid && businessRulesValidation.isValid,
      errors: [...basicValidation.errors, ...businessRulesValidation.errors],
    };
  }
}