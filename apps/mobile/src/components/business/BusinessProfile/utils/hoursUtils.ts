import { EnhancedBusinessHours, BusinessStatus, TimeZoneInfo } from '../types';

/**
 * Comprehensive utility functions for business hours management
 * Handles timezone conversion, special hours, and real-time status calculation
 */

// Common timezone mappings for better user experience
export const COMMON_TIMEZONES = {
  'America/New_York': { name: 'Eastern Time', abbreviation: 'ET' },
  'America/Chicago': { name: 'Central Time', abbreviation: 'CT' },
  'America/Denver': { name: 'Mountain Time', abbreviation: 'MT' },
  'America/Los_Angeles': { name: 'Pacific Time', abbreviation: 'PT' },
  'America/Phoenix': { name: 'Arizona Time', abbreviation: 'MST' },
  'America/Anchorage': { name: 'Alaska Time', abbreviation: 'AKST' },
  'Pacific/Honolulu': { name: 'Hawaii Time', abbreviation: 'HST' },
} as const;

// Days of the week mapping
export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon', index: 0 },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue', index: 1 },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed', index: 2 },
  { key: 'thursday', label: 'Thursday', short: 'Thu', index: 3 },
  { key: 'friday', label: 'Friday', short: 'Fri', index: 4 },
  { key: 'saturday', label: 'Saturday', short: 'Sat', index: 5 },
  { key: 'sunday', label: 'Sunday', short: 'Sun', index: 6 },
] as const;

/**
 * Validates time format (HH:MM or H:MM)
 */
export function isValidTimeFormat(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Converts 24-hour time string to 12-hour format with AM/PM
 */
export function formatTo12Hour(time: string): string {
  if (!isValidTimeFormat(time)) return time;
  
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Gets current day index (Monday = 0, Sunday = 6)
 */
export function getCurrentDayIndex(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

/**
 * Gets day key from date
 */
export function getDayKey(date: Date): string {
  const dayIndex = getCurrentDayIndex(date);
  return DAYS_OF_WEEK[dayIndex].key;
}

/**
 * Checks if a time is within a range, handling overnight hours
 */
export function isTimeInRange(
  currentTime: Date,
  openTime: string,
  closeTime: string,
  timezone?: string
): boolean {
  try {
    const now = timezone ? convertToTimezone(currentTime, timezone) : currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [openHours, openMins] = openTime.split(':').map(Number);
    const [closeHours, closeMins] = closeTime.split(':').map(Number);
    
    const openMinutes = openHours * 60 + openMins;
    const closeMinutes = closeHours * 60 + closeMins;
    
    // Handle overnight businesses (close time is next day)
    if (closeMinutes <= openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch (error) {
    console.error('Error checking time range:', error);
    return false;
  }
}

/**
 * Converts time to specific timezone
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  } catch (error) {
    console.error('Error converting timezone:', error);
    return date;
  }
}

/**
 * Gets timezone information including name and abbreviation
 */
export function getTimezoneInfo(timezone?: string): TimeZoneInfo {
  if (!timezone) {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    timezone = userTimezone;
  }
  
  try {
    const now = new Date();
    
    // Check if it's a common timezone with predefined info
    if (timezone in COMMON_TIMEZONES) {
      const commonTz = COMMON_TIMEZONES[timezone as keyof typeof COMMON_TIMEZONES];
      return {
        name: commonTz.name,
        abbreviation: commonTz.abbreviation,
        offset: getTimezoneOffset(timezone),
      };
    }
    
    // Get timezone abbreviation from Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(now);
    const abbreviation = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    return {
      name: timezone.replace(/_/g, ' '),
      abbreviation,
      offset: getTimezoneOffset(timezone),
    };
  } catch (error) {
    console.error('Error getting timezone info:', error);
    return { 
      name: timezone.replace(/_/g, ' '), 
      abbreviation: '', 
      offset: 0 
    };
  }
}

/**
 * Gets timezone offset in minutes from UTC
 */
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const target = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (target.getTime() - utc.getTime()) / 60000;
  } catch (error) {
    console.error('Error getting timezone offset:', error);
    return 0;
  }
}

/**
 * Calculates the next time the business status will change
 */
export function getNextStatusChange(
  hours: EnhancedBusinessHours,
  currentTime: Date
): Date | null {
  const currentStatus = calculateBusinessStatus(hours, currentTime);
  const startDayIndex = getCurrentDayIndex(currentTime);
  
  // If currently open, find next close time
  if (currentStatus.isOpen) {
    return findNextCloseTime(hours, currentTime);
  }
  
  // If currently closed, find next open time
  return findNextOpenTime(hours, currentTime);
}

/**
 * Finds the next opening time
 */
export function findNextOpenTime(
  hours: EnhancedBusinessHours,
  currentTime: Date
): Date | null {
  const startDayIndex = getCurrentDayIndex(currentTime);
  
  // Check next 7 days
  for (let i = 0; i < 7; i++) {
    const dayIndex = (startDayIndex + i) % 7;
    const dayKey = DAYS_OF_WEEK[dayIndex].key;
    const checkDate = new Date(currentTime);
    checkDate.setDate(currentTime.getDate() + i);
    const dateString = checkDate.toISOString().split('T')[0];
    
    // Check for temporary closures
    if (isTemporarilyClosed(hours, checkDate)) {
      continue;
    }
    
    // Check special hours
    const specialHours = hours.specialHours?.[dateString];
    if (specialHours) {
      if (!specialHours.isClosed && specialHours.open) {
        const openTime = createTimeOnDate(checkDate, specialHours.open, hours.timezone);
        if (i === 0 && openTime <= currentTime) continue;
        return openTime;
      }
      continue;
    }
    
    // Check regular hours
    const dayHours = hours[dayKey];
    if (dayHours && !dayHours.closed && !dayHours.isClosed && dayHours.open) {
      const openTime = createTimeOnDate(checkDate, dayHours.open, hours.timezone);
      if (i === 0 && openTime <= currentTime) continue;
      return openTime;
    }
  }
  
  return null;
}

/**
 * Finds the next closing time
 */
export function findNextCloseTime(
  hours: EnhancedBusinessHours,
  currentTime: Date
): Date | null {
  const currentDayKey = getDayKey(currentTime);
  const dateString = currentTime.toISOString().split('T')[0];
  
  // Check special hours first
  const specialHours = hours.specialHours?.[dateString];
  if (specialHours && !specialHours.isClosed) {
    return createTimeOnDate(currentTime, specialHours.close, hours.timezone);
  }
  
  // Check regular hours
  const dayHours = hours[currentDayKey];
  if (dayHours && !dayHours.closed && !dayHours.isClosed && dayHours.close) {
    const closeTime = createTimeOnDate(currentTime, dayHours.close, hours.timezone);
    
    // Handle overnight businesses
    if (closeTime <= currentTime) {
      const nextDay = new Date(currentTime);
      nextDay.setDate(nextDay.getDate() + 1);
      return createTimeOnDate(nextDay, dayHours.close, hours.timezone);
    }
    
    return closeTime;
  }
  
  return null;
}

/**
 * Creates a Date object with specific time on given date
 */
export function createTimeOnDate(date: Date, timeString: string, timezone?: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  
  if (timezone) {
    // Convert from business timezone to local timezone
    const businessTime = new Date(result.toLocaleString('en-US', { timeZone: timezone }));
    const localTime = new Date(result.toLocaleString());
    const offset = businessTime.getTime() - localTime.getTime();
    result.setTime(result.getTime() - offset);
  }
  
  return result;
}

/**
 * Checks if business is temporarily closed on given date
 */
export function isTemporarilyClosed(hours: EnhancedBusinessHours, date: Date): boolean {
  if (!hours.temporaryClosures) return false;
  
  return hours.temporaryClosures.some(closure => {
    const startDate = new Date(closure.startDate);
    const endDate = new Date(closure.endDate);
    return date >= startDate && date <= endDate;
  });
}

/**
 * Calculates comprehensive business status
 */
export function calculateBusinessStatus(
  hours: EnhancedBusinessHours,
  currentTime: Date
): BusinessStatus {
  const dayKey = getDayKey(currentTime);
  const dateString = currentTime.toISOString().split('T')[0];
  
  // Check for temporary closures
  if (isTemporarilyClosed(hours, currentTime)) {
    const closure = hours.temporaryClosures!.find(closure => {
      const startDate = new Date(closure.startDate);
      const endDate = new Date(closure.endDate);
      return currentTime >= startDate && currentTime <= endDate;
    })!;
    
    return {
      isOpen: false,
      status: 'closed',
      reason: closure.reason,
      nextChange: findNextOpenTime(hours, currentTime),
    };
  }
  
  // Check for special hours
  const specialHours = hours.specialHours?.[dateString];
  if (specialHours) {
    if (specialHours.isClosed) {
      return {
        isOpen: false,
        status: 'closed',
        reason: specialHours.reason,
        nextChange: findNextOpenTime(hours, currentTime),
      };
    }
    
    const isInSpecialHours = isTimeInRange(
      currentTime,
      specialHours.open,
      specialHours.close,
      hours.timezone
    );
    
    return {
      isOpen: isInSpecialHours,
      status: isInSpecialHours ? 'open' : 'closed',
      reason: specialHours.reason,
      nextChange: isInSpecialHours
        ? createTimeOnDate(currentTime, specialHours.close, hours.timezone)
        : findNextOpenTime(hours, currentTime),
    };
  }
  
  // Check regular hours
  const dayHours = hours[dayKey];
  if (!dayHours || dayHours.closed || dayHours.isClosed) {
    return {
      isOpen: false,
      status: 'closed',
      nextChange: findNextOpenTime(hours, currentTime),
    };
  }
  
  if (!dayHours.open || !dayHours.close) {
    return {
      isOpen: false,
      status: 'unknown',
      reason: 'Hours not set',
      nextChange: null,
    };
  }
  
  // Handle 24-hour businesses
  if (dayHours.open === '00:00' && dayHours.close === '23:59') {
    return {
      isOpen: true,
      status: 'open',
      reason: '24 Hours',
      nextChange: null,
    };
  }
  
  const isCurrentlyOpen = isTimeInRange(
    currentTime,
    dayHours.open,
    dayHours.close,
    hours.timezone
  );
  
  return {
    isOpen: isCurrentlyOpen,
    status: isCurrentlyOpen ? 'open' : 'closed',
    nextChange: isCurrentlyOpen
      ? findNextCloseTime(hours, currentTime)
      : findNextOpenTime(hours, currentTime),
  };
}

/**
 * Formats countdown time until next status change
 */
export function formatCountdown(timeUntil: number): string {
  const totalMinutes = Math.ceil(timeUntil / (1000 * 60));
  
  if (totalMinutes <= 0) return 'Now';
  
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  
  return `${minutes}m`;
}

/**
 * Validates business hours data structure
 */
export function validateBusinessHours(hours: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!hours || typeof hours !== 'object') {
    errors.push('Hours data must be a valid object');
    return { isValid: false, errors, warnings };
  }
  
  // Validate regular hours
  for (const day of DAYS_OF_WEEK) {
    const dayHours = hours[day.key];
    
    if (dayHours && !dayHours.closed && !dayHours.isClosed) {
      if (!dayHours.open || !dayHours.close) {
        warnings.push(`${day.label}: Missing open or close time`);
        continue;
      }
      
      if (!isValidTimeFormat(dayHours.open)) {
        errors.push(`${day.label}: Invalid open time format - ${dayHours.open}`);
      }
      
      if (!isValidTimeFormat(dayHours.close)) {
        errors.push(`${day.label}: Invalid close time format - ${dayHours.close}`);
      }
      
      // Check for logical consistency
      if (dayHours.open === dayHours.close && dayHours.open !== '00:00') {
        warnings.push(`${day.label}: Open and close times are the same`);
      }
    }
  }
  
  // Validate special hours
  if (hours.specialHours) {
    for (const [date, specialHour] of Object.entries(hours.specialHours)) {
      if (!Date.parse(date)) {
        errors.push(`Special hours: Invalid date format - ${date}`);
        continue;
      }
      
      const sh = specialHour as any;
      if (!sh.isClosed) {
        if (!sh.open || !sh.close) {
          warnings.push(`Special hours (${date}): Missing open or close time`);
        } else {
          if (!isValidTimeFormat(sh.open)) {
            errors.push(`Special hours (${date}): Invalid open time - ${sh.open}`);
          }
          if (!isValidTimeFormat(sh.close)) {
            errors.push(`Special hours (${date}): Invalid close time - ${sh.close}`);
          }
        }
      }
    }
  }
  
  // Validate temporary closures
  if (hours.temporaryClosures) {
    hours.temporaryClosures.forEach((closure: any, index: number) => {
      if (!closure.startDate || !closure.endDate) {
        errors.push(`Temporary closure ${index + 1}: Missing start or end date`);
        return;
      }
      
      const startDate = new Date(closure.startDate);
      const endDate = new Date(closure.endDate);
      
      if (isNaN(startDate.getTime())) {
        errors.push(`Temporary closure ${index + 1}: Invalid start date`);
      }
      
      if (isNaN(endDate.getTime())) {
        errors.push(`Temporary closure ${index + 1}: Invalid end date`);
      }
      
      if (startDate > endDate) {
        errors.push(`Temporary closure ${index + 1}: Start date is after end date`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Groups consecutive days with same hours for compact display
 */
export function groupConsecutiveDays(
  hours: EnhancedBusinessHours,
  currentTime: Date
): Array<{
  days: string;
  hours: string;
  isCurrent: boolean;
  hasSpecialHours: boolean;
}> {
  const groups: Array<{
    days: string;
    hours: string;
    isCurrent: boolean;
    hasSpecialHours: boolean;
  }> = [];
  
  let currentGroup: {
    days: string;
    hours: string;
    isCurrent: boolean;
    hasSpecialHours: boolean;
  } | null = null;
  
  const currentDayIndex = getCurrentDayIndex(currentTime);
  
  DAYS_OF_WEEK.forEach((day, index) => {
    const dayHours = hours[day.key];
    const checkDate = new Date(currentTime);
    checkDate.setDate(currentTime.getDate() + (index - currentDayIndex));
    const dateString = checkDate.toISOString().split('T')[0];
    
    const { hoursString, hasSpecial } = formatHoursForGrouping(dayHours, hours, dateString);
    const isCurrent = index === currentDayIndex;
    
    if (!currentGroup || currentGroup.hours !== hoursString) {
      // Start new group
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        days: day.short,
        hours: hoursString,
        isCurrent: isCurrent,
        hasSpecialHours: hasSpecial,
      };
    } else {
      // Extend current group
      currentGroup.days += ` - ${day.short}`;
      currentGroup.isCurrent = currentGroup.isCurrent || isCurrent;
      currentGroup.hasSpecialHours = currentGroup.hasSpecialHours || hasSpecial;
    }
  });
  
  if (currentGroup) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Formats hours for grouping comparison
 */
function formatHoursForGrouping(
  dayHours: any,
  enhancedHours: EnhancedBusinessHours,
  dateString: string
): { hoursString: string; hasSpecial: boolean } {
  // Check for special hours first
  const specialHours = enhancedHours.specialHours?.[dateString];
  if (specialHours) {
    if (specialHours.isClosed) {
      return {
        hoursString: `Closed - ${specialHours.reason}`,
        hasSpecial: true,
      };
    }
    return {
      hoursString: `${formatTo12Hour(specialHours.open)} - ${formatTo12Hour(specialHours.close)} (${specialHours.reason})`,
      hasSpecial: true,
    };
  }
  
  // Check for temporary closures
  const checkDate = new Date(dateString);
  if (isTemporarilyClosed(enhancedHours, checkDate)) {
    const closure = enhancedHours.temporaryClosures!.find(closure => {
      const startDate = new Date(closure.startDate);
      const endDate = new Date(closure.endDate);
      return checkDate >= startDate && checkDate <= endDate;
    })!;
    
    return {
      hoursString: `Closed - ${closure.reason}`,
      hasSpecial: true,
    };
  }
  
  if (!dayHours || dayHours.closed || dayHours.isClosed) {
    return { hoursString: 'Closed', hasSpecial: false };
  }
  
  if (!dayHours.open || !dayHours.close) {
    return { hoursString: 'Hours not set', hasSpecial: false };
  }
  
  // Handle 24-hour businesses
  if (dayHours.open === '00:00' && dayHours.close === '23:59') {
    return { hoursString: '24 Hours', hasSpecial: false };
  }
  
  return {
    hoursString: `${formatTo12Hour(dayHours.open)} - ${formatTo12Hour(dayHours.close)}`,
    hasSpecial: false,
  };
}