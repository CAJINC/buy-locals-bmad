import { HoursValidationService } from '../hoursValidationService';
import { HoursTimeSlot, WeeklyHours } from '../../../types/business';

describe('HoursValidationService', () => {
  let service: HoursValidationService;

  beforeEach(() => {
    service = new HoursValidationService();
  });

  describe('validateDayHours', () => {
    it('should validate open day hours correctly', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '09:00',
        close: '17:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate closed day correctly', () => {
      const dayHours: HoursTimeSlot = {
        closed: true,
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing open time', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        close: '17:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Open time is required when not closed');
    });

    it('should reject missing close time', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '09:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Close time is required when not closed');
    });

    it('should reject invalid time format', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '9:00', // Invalid format
        close: '17:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Open time must be in HH:MM format');
    });

    it('should reject close time before open time (same day)', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '17:00',
        close: '09:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Close time must be after open time');
    });

    it('should allow overnight hours (close time next day)', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '20:00',
        close: '02:00', // Next day
      };

      const result = service.validateDayHours('friday', dayHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid hour values', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '25:00', // Invalid hour
        close: '17:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Invalid open time - hours must be 00-23');
    });

    it('should reject invalid minute values', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '09:60', // Invalid minutes
        close: '17:00',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monday: Invalid open time - minutes must be 00-59');
    });

    it('should handle edge case of midnight', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '00:00',
        close: '23:59',
      };

      const result = service.validateDayHours('monday', dayHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateWeeklyHours', () => {
    it('should validate complete weekly schedule', () => {
      const weeklyHours: WeeklyHours = {
        monday: { closed: false, open: '09:00', close: '17:00' },
        tuesday: { closed: false, open: '09:00', close: '17:00' },
        wednesday: { closed: false, open: '09:00', close: '17:00' },
        thursday: { closed: false, open: '09:00', close: '17:00' },
        friday: { closed: false, open: '09:00', close: '17:00' },
        saturday: { closed: true },
        sunday: { closed: true },
      };

      const result = service.validateWeeklyHours(weeklyHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate partial weekly schedule', () => {
      const weeklyHours: WeeklyHours = {
        monday: { closed: false, open: '09:00', close: '17:00' },
        tuesday: { closed: false, open: '09:00', close: '17:00' },
        // Missing other days
      };

      const result = service.validateWeeklyHours(weeklyHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from multiple days', () => {
      const weeklyHours: WeeklyHours = {
        monday: { closed: false, open: '09:00' }, // Missing close
        tuesday: { closed: false, close: '17:00' }, // Missing open
        wednesday: { closed: false, open: '17:00', close: '09:00' }, // Close before open
      };

      const result = service.validateWeeklyHours(weeklyHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Monday: Close time is required when not closed');
      expect(result.errors).toContain('Tuesday: Open time is required when not closed');
      expect(result.errors).toContain('Wednesday: Close time must be after open time');
    });

    it('should warn about no open days', () => {
      const weeklyHours: WeeklyHours = {
        monday: { closed: true },
        tuesday: { closed: true },
        wednesday: { closed: true },
        thursday: { closed: true },
        friday: { closed: true },
        saturday: { closed: true },
        sunday: { closed: true },
      };

      const result = service.validateWeeklyHours(weeklyHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Warning: Business is closed all week');
    });
  });

  describe('validateTimeFormat', () => {
    it('should validate correct time format', () => {
      expect(service.validateTimeFormat('09:00')).toBe(true);
      expect(service.validateTimeFormat('23:59')).toBe(true);
      expect(service.validateTimeFormat('00:00')).toBe(true);
    });

    it('should reject incorrect time format', () => {
      expect(service.validateTimeFormat('9:00')).toBe(false); // Single digit hour
      expect(service.validateTimeFormat('09:0')).toBe(false); // Single digit minute
      expect(service.validateTimeFormat('09')).toBe(false); // Missing minutes
      expect(service.validateTimeFormat('09:00:00')).toBe(false); // Includes seconds
      expect(service.validateTimeFormat('25:00')).toBe(false); // Invalid hour
      expect(service.validateTimeFormat('09:60')).toBe(false); // Invalid minute
    });

    it('should handle edge cases', () => {
      expect(service.validateTimeFormat('')).toBe(false);
      expect(service.validateTimeFormat(undefined)).toBe(false);
      expect(service.validateTimeFormat(null)).toBe(false);
    });
  });

  describe('timeToMinutes', () => {
    it('should convert time to minutes correctly', () => {
      expect(service.timeToMinutes('00:00')).toBe(0);
      expect(service.timeToMinutes('01:00')).toBe(60);
      expect(service.timeToMinutes('09:30')).toBe(570);
      expect(service.timeToMinutes('23:59')).toBe(1439);
    });

    it('should handle invalid input gracefully', () => {
      expect(service.timeToMinutes('invalid')).toBe(0);
      expect(service.timeToMinutes('')).toBe(0);
    });
  });

  describe('minutesToTime', () => {
    it('should convert minutes to time correctly', () => {
      expect(service.minutesToTime(0)).toBe('00:00');
      expect(service.minutesToTime(60)).toBe('01:00');
      expect(service.minutesToTime(570)).toBe('09:30');
      expect(service.minutesToTime(1439)).toBe('23:59');
    });

    it('should handle overflow correctly', () => {
      expect(service.minutesToTime(1440)).toBe('00:00'); // Next day
      expect(service.minutesToTime(1500)).toBe('01:00'); // Next day + 1 hour
    });

    it('should handle negative values', () => {
      expect(service.minutesToTime(-60)).toBe('23:00'); // Previous day
    });
  });

  describe('isOvernightSchedule', () => {
    it('should detect overnight schedule', () => {
      expect(service.isOvernightSchedule('22:00', '02:00')).toBe(true);
      expect(service.isOvernightSchedule('23:00', '01:00')).toBe(true);
    });

    it('should detect same-day schedule', () => {
      expect(service.isOvernightSchedule('09:00', '17:00')).toBe(false);
      expect(service.isOvernightSchedule('22:00', '23:00')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(service.isOvernightSchedule('00:00', '23:59')).toBe(false); // Full day
      expect(service.isOvernightSchedule('23:59', '00:00')).toBe(true); // Just past midnight
    });
  });

  describe('Business Rules Validation', () => {
    it('should allow reasonable business hours', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '08:00',
        close: '18:00',
      };

      const result = service.validateDayHours('monday', dayHours);
      expect(result.isValid).toBe(true);
    });

    it('should allow restaurant/bar hours', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '17:00',
        close: '02:00', // Next day
      };

      const result = service.validateDayHours('friday', dayHours);
      expect(result.isValid).toBe(true);
    });

    it('should allow 24-hour operations', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '00:00',
        close: '00:00', // Next day
      };

      const result = service.validateDayHours('monday', dayHours);
      expect(result.isValid).toBe(true);
    });

    it('should handle very short hours', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '12:00',
        close: '12:01',
      };

      const result = service.validateDayHours('monday', dayHours);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format day names consistently', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: '09:00',
      };

      const result = service.validateDayHours('monday', dayHours);
      expect(result.errors[0]).toStartWith('Monday:');
    });

    it('should provide specific error messages', () => {
      const dayHours: HoursTimeSlot = {
        closed: false,
        open: 'invalid',
        close: '17:00',
      };

      const result = service.validateDayHours('tuesday', dayHours);
      expect(result.errors).toContain('Tuesday: Open time must be in HH:MM format');
    });
  });
});