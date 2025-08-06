import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Pressable,
  Icon,
  Alert,
  Spinner,
  Center,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { EnhancedBusinessHoursDisplayProps, EnhancedBusinessHours, TimeZoneInfo, BusinessStatus } from './types';

// Type definitions for enhanced business hours functionality
interface CountdownInfo {
  message: string;
  timeUntil: number;
}

export const BusinessHoursDisplay: React.FC<EnhancedBusinessHoursDisplayProps> = ({
  hours,
  compact = false,
  showCurrentStatus = true,
  showCountdown = true,
  showTimezone = true,
  userTimezone,
  expandable = true,
  showSpecialHours = true,
  onStatusChange,
  refreshInterval = 60000, // 1 minute
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Enhanced hours validation and processing
  const enhancedHours = useMemo((): EnhancedBusinessHours => {
    try {
      setError(null);
      return validateAndEnhanceHours(hours, userTimezone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid hours data');
      return {
        ...hours,
        timezone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  }, [hours, userTimezone]);

  // Business status calculation
  const businessStatus = useMemo((): BusinessStatus => {
    return calculateBusinessStatus(enhancedHours, currentTime);
  }, [enhancedHours, currentTime]);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(businessStatus);
  }, [businessStatus, onStatusChange]);

  const currentDayIndex = getCurrentDayIndex(currentTime);
  const timezoneInfo = getTimezoneInfo(enhancedHours.timezone);

  // Enhanced time formatting with timezone support
  const formatTime = useCallback((time: string, timezone?: string): string => {
    if (!time) return '';
    
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      if (timezone && timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
          hour12: true
        });
      }
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  }, []);

  // Enhanced hours range formatting with special hours support
  const formatHoursRange = useCallback((dayHours: any, date?: string): string => {
    // Check for special hours first
    if (date && enhancedHours.specialHours?.[date]) {
      const specialHour = enhancedHours.specialHours[date];
      if (specialHour.isClosed) {
        return `Closed - ${specialHour.reason}`;
      }
      return `${formatTime(specialHour.open, enhancedHours.timezone)} - ${formatTime(specialHour.close, enhancedHours.timezone)} (${specialHour.reason})`;
    }
    
    // Check for temporary closures
    if (date && enhancedHours.temporaryClosures) {
      const closure = enhancedHours.temporaryClosures.find(closure => {
        const checkDate = new Date(date);
        return checkDate >= new Date(closure.startDate) && checkDate <= new Date(closure.endDate);
      });
      if (closure) {
        return `Closed - ${closure.reason}`;
      }
    }
    
    if (!dayHours || dayHours.closed || dayHours.isClosed) {
      return 'Closed';
    }
    
    if (!dayHours.open || !dayHours.close) {
      return 'Hours not set';
    }
    
    // Handle 24-hour businesses
    if (dayHours.open === '00:00' && dayHours.close === '23:59') {
      return '24 Hours';
    }
    
    return `${formatTime(dayHours.open, enhancedHours.timezone)} - ${formatTime(dayHours.close, enhancedHours.timezone)}`;
  }, [enhancedHours, formatTime]);

  // Enhanced grouping with special hours consideration
  const groupedHours = useMemo(() => {
    return compact ? groupConsecutiveDays(enhancedHours, daysOfWeek, currentTime) : null;
  }, [compact, enhancedHours, daysOfWeek, currentTime]);

  // Countdown timer for next status change
  const countdownInfo = useMemo(() => {
    if (!showCountdown) return null;
    return calculateCountdown(enhancedHours, currentTime);
  }, [enhancedHours, currentTime, showCountdown]);

  // Toggle expansion handler
  const handleToggleExpand = useCallback(() => {
    if (expandable) {
      setIsExpanded(prev => !prev);
    }
  }, [expandable]);

  // Loading state
  if (loading) {
    return (
      <Center py={4}>
        <Spinner size="sm" />
        <Text fontSize="sm" color="gray.500" mt={2}>Loading hours...</Text>
      </Center>
    );
  }

  return (
    <VStack space={compact ? 2 : 3}>
      {/* Error Display */}
      {error && (
        <Alert status="warning" borderRadius="md">
          <HStack space={2} alignItems="center">
            <Alert.Icon />
            <Text fontSize="sm" flex={1}>{error}</Text>
          </HStack>
        </Alert>
      )}

      {/* Enhanced Status Header */}
      {showCurrentStatus && (
        <Pressable onPress={expandable ? handleToggleExpand : undefined}>
          <HStack alignItems="center" justifyContent="space-between">
            <HStack alignItems="center" space={3} flex={1}>
              {/* Status Badge */}
              <Badge
                colorScheme={businessStatus.isOpen ? "green" : "red"}
                variant="subtle"
                rounded="md"
                size="md"
              >
                <HStack alignItems="center" space={1}>
                  <Box
                    w={2}
                    h={2}
                    borderRadius="full"
                    bg={businessStatus.isOpen ? "green.500" : "red.500"}
                  />
                  <Text fontSize="sm" fontWeight="medium">
                    {businessStatus.isOpen ? "Open Now" : "Closed"}
                  </Text>
                </HStack>
              </Badge>

              {/* Countdown Timer */}
              {countdownInfo && (
                <VStack space={0}>
                  <Text color="gray.600" fontSize="sm" fontWeight="medium">
                    {countdownInfo.message}
                  </Text>
                  {showTimezone && timezoneInfo.abbreviation && (
                    <Text color="gray.400" fontSize="xs">
                      {timezoneInfo.abbreviation}
                    </Text>
                  )}
                </VStack>
              )}
            </HStack>

            {/* Expand/Collapse Icon */}
            {expandable && (
              <Icon
                as={MaterialIcons}
                name={isExpanded ? "expand-less" : "expand-more"}
                size={5}
                color="gray.400"
              />
            )}
          </HStack>
        </Pressable>
      )}

      {/* Hours Display */}
      {isExpanded && (
        <VStack space={compact ? 1 : 2}>
          {compact && groupedHours ? (
            // Compact view with grouped days
            <VStack space={1}>
              {groupedHours.map((group, index) => (
                <HStack key={index} justifyContent="space-between" alignItems="center">
                  <Text
                    color="gray.700"
                    fontSize="sm"
                    fontWeight={group.isCurrent ? "bold" : "normal"}
                  >
                    {group.days}
                  </Text>
                  <Text
                    color={group.isCurrent ? "blue.600" : "gray.600"}
                    fontSize="sm"
                    fontWeight={group.isCurrent ? "bold" : "normal"}
                    textAlign="right"
                    flex={1}
                    ml={2}
                  >
                    {group.hours}
                  </Text>
                </HStack>
              ))}
            </VStack>
          ) : (
            // Full view with all days
            <VStack space={compact ? 1 : 2}>
              {daysOfWeek.map((day, index) => {
                const dayHours = enhancedHours[day.key];
                const isCurrent = index === currentDayIndex;
                const today = new Date(currentTime);
                const dayDate = new Date(today);
                dayDate.setDate(today.getDate() + (index - currentDayIndex));
                const dateString = dayDate.toISOString().split('T')[0];
                
                // Check for special hours or temporary closures
                const hasSpecialHours = enhancedHours.specialHours?.[dateString] || 
                  enhancedHours.temporaryClosures?.some(closure => {
                    return dayDate >= new Date(closure.startDate) && dayDate <= new Date(closure.endDate);
                  });
                
                return (
                  <HStack
                    key={day.key}
                    justifyContent="space-between"
                    alignItems="center"
                    py={compact ? 1 : 2}
                    px={isCurrent ? 3 : 0}
                    bg={isCurrent ? "blue.50" : hasSpecialHours ? "yellow.50" : "transparent"}
                    borderRadius={isCurrent || hasSpecialHours ? "md" : 0}
                    borderWidth={hasSpecialHours ? 1 : 0}
                    borderColor={hasSpecialHours ? "yellow.200" : "transparent"}
                  >
                    <VStack alignItems="flex-start" minWidth="80px">
                      <Text
                        color={isCurrent ? "blue.700" : "gray.700"}
                        fontSize={compact ? "sm" : "md"}
                        fontWeight={isCurrent ? "bold" : "normal"}
                      >
                        {compact ? day.short : day.label}
                      </Text>
                      {isCurrent && (
                        <Text fontSize="xs" color="blue.500">
                          Today
                        </Text>
                      )}
                    </VStack>
                    
                    <VStack alignItems="flex-end" flex={1}>
                      <Text
                        color={isCurrent ? "blue.600" : hasSpecialHours ? "yellow.700" : "gray.600"}
                        fontSize={compact ? "sm" : "md"}
                        fontWeight={isCurrent ? "bold" : "normal"}
                        textAlign="right"
                      >
                        {formatHoursRange(dayHours, dateString)}
                      </Text>
                      
                      {/* Special hours indicator */}
                      {hasSpecialHours && showSpecialHours && (
                        <HStack alignItems="center" space={1}>
                          <Icon
                            as={MaterialIcons}
                            name="star"
                            size={3}
                            color="yellow.500"
                          />
                          <Text fontSize="xs" color="yellow.600">
                            Special Hours
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
          
          {/* Timezone Information */}
          {showTimezone && timezoneInfo.name && (
            <HStack alignItems="center" space={2} pt={2} borderTopWidth={1} borderTopColor="gray.200">
              <Icon as={MaterialIcons} name="schedule" size={4} color="gray.400" />
              <Text fontSize="xs" color="gray.500">
                Times shown in {timezoneInfo.name}
                {timezoneInfo.abbreviation && ` (${timezoneInfo.abbreviation})`}
              </Text>
            </HStack>
          )}
        </VStack>
      )}

      {/* No hours message */}
      {Object.keys(enhancedHours).filter(key => !['timezone', 'specialHours', 'temporaryClosures'].includes(key)).length === 0 && (
        <Box p={4} bg="gray.50" borderRadius="md">
          <VStack alignItems="center" space={2}>
            <Icon as={MaterialIcons} name="schedule" size={6} color="gray.400" />
            <Text color="gray.500" fontSize="md" textAlign="center" style={{ fontStyle: 'italic' }}>
              Business hours not available
            </Text>
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Contact the business for current hours
            </Text>
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

// Enhanced utility functions for business hours management

// Get current day index (Monday = 0, Sunday = 6)
function getCurrentDayIndex(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

// Validate and enhance hours data with timezone and special hours support
function validateAndEnhanceHours(hours: any, userTimezone?: string): EnhancedBusinessHours {
  if (!hours || typeof hours !== 'object') {
    throw new Error('Invalid hours data provided');
  }

  const enhanced: EnhancedBusinessHours = {
    ...hours,
    timezone: hours.timezone || userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  // Validate each day's hours
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of daysOfWeek) {
    const dayHours = enhanced[day];
    if (dayHours && !dayHours.closed && !dayHours.isClosed) {
      if (!isValidTimeFormat(dayHours.open) || !isValidTimeFormat(dayHours.close)) {
        console.warn(`Invalid time format for ${day}:`, dayHours);
      }
    }
  }

  return enhanced;
}

// Validate time format (HH:MM)
function isValidTimeFormat(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

// Calculate comprehensive business status
function calculateBusinessStatus(hours: EnhancedBusinessHours, currentTime: Date): BusinessStatus {
  const dayIndex = getCurrentDayIndex(currentTime);
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const currentDay = daysOfWeek[dayIndex];
  const dateString = currentTime.toISOString().split('T')[0];
  
  // Check for temporary closures
  if (hours.temporaryClosures) {
    const activeClosure = hours.temporaryClosures.find(closure => {
      return currentTime >= new Date(closure.startDate) && currentTime <= new Date(closure.endDate);
    });
    if (activeClosure) {
      return {
        isOpen: false,
        status: 'closed',
        reason: activeClosure.reason,
        nextChange: findNextOpenTime(hours, currentTime),
      };
    }
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
    return checkIfTimeInRange(currentTime, specialHours.open, specialHours.close, hours.timezone)
      ? {
          isOpen: true,
          status: 'open',
          reason: specialHours.reason,
          nextChange: getCloseTime(currentTime, specialHours.close, hours.timezone),
        }
      : {
          isOpen: false,
          status: 'closed',
          nextChange: findNextOpenTime(hours, currentTime),
        };
  }
  
  // Check regular hours
  const todayHours = hours[currentDay];
  if (!todayHours || todayHours.closed || todayHours.isClosed) {
    return {
      isOpen: false,
      status: 'closed',
      nextChange: findNextOpenTime(hours, currentTime),
    };
  }
  
  if (!todayHours.open || !todayHours.close) {
    return {
      isOpen: false,
      status: 'unknown',
      reason: 'Hours not set',
      nextChange: null,
    };
  }
  
  // Handle 24-hour businesses
  if (todayHours.open === '00:00' && todayHours.close === '23:59') {
    return {
      isOpen: true,
      status: 'open',
      reason: '24 Hours',
      nextChange: null,
    };
  }
  
  const isCurrentlyOpen = checkIfTimeInRange(currentTime, todayHours.open, todayHours.close, hours.timezone);
  
  return {
    isOpen: isCurrentlyOpen,
    status: isCurrentlyOpen ? 'open' : 'closed',
    nextChange: isCurrentlyOpen 
      ? getCloseTime(currentTime, todayHours.close, hours.timezone)
      : findNextOpenTime(hours, currentTime),
  };
}

// Check if current time is within business hours range
function checkIfTimeInRange(currentTime: Date, openTime: string, closeTime: string, timezone?: string): boolean {
  try {
    const now = timezone ? convertToTimezone(currentTime, timezone) : currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [openHours, openMins] = openTime.split(':').map(Number);
    const [closeHours, closeMins] = closeTime.split(':').map(Number);
    
    const openMinutes = openHours * 60 + openMins;
    const closeMinutes = closeHours * 60 + closeMins;
    
    // Handle overnight businesses (close time is next day)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch (error) {
    console.error('Error checking time range:', error);
    return false;
  }
}

// Convert time to specific timezone
function convertToTimezone(date: Date, timezone: string): Date {
  try {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const targetTime = new Date(utc + (getTimezoneOffset(timezone) * 60000));
    return targetTime;
  } catch (error) {
    console.error('Error converting timezone:', error);
    return date;
  }
}

// Get timezone offset in minutes
function getTimezoneOffset(timezone: string): number {
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

// Get timezone information
function getTimezoneInfo(timezone?: string): TimeZoneInfo {
  if (!timezone) {
    return { name: '', abbreviation: '', offset: 0 };
  }
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(now);
    const abbreviation = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    return {
      name: timezone.replace('_', ' '),
      abbreviation,
      offset: getTimezoneOffset(timezone),
    };
  } catch (error) {
    console.error('Error getting timezone info:', error);
    return { name: timezone, abbreviation: '', offset: 0 };
  }
}

// Find next opening time
function findNextOpenTime(hours: EnhancedBusinessHours, currentTime: Date): Date | null {
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const startDayIndex = getCurrentDayIndex(currentTime);
  
  // Check next 7 days
  for (let i = 0; i < 7; i++) {
    const dayIndex = (startDayIndex + i) % 7;
    const dayKey = daysOfWeek[dayIndex];
    const checkDate = new Date(currentTime);
    checkDate.setDate(currentTime.getDate() + i);
    const dateString = checkDate.toISOString().split('T')[0];
    
    // Check for temporary closures
    if (hours.temporaryClosures) {
      const activeClosure = hours.temporaryClosures.find(closure => {
        return checkDate >= new Date(closure.startDate) && checkDate <= new Date(closure.endDate);
      });
      if (activeClosure) continue;
    }
    
    // Check special hours
    const specialHours = hours.specialHours?.[dateString];
    if (specialHours) {
      if (!specialHours.isClosed && specialHours.open) {
        return getOpenTime(checkDate, specialHours.open, hours.timezone);
      }
      continue;
    }
    
    // Check regular hours
    const dayHours = hours[dayKey];
    if (dayHours && !dayHours.closed && !dayHours.isClosed && dayHours.open) {
      const openTime = getOpenTime(checkDate, dayHours.open, hours.timezone);
      
      // If it's today, make sure the open time is in the future
      if (i === 0 && openTime <= currentTime) {
        continue;
      }
      
      return openTime;
    }
  }
  
  return null;
}

// Get specific open time for a date
function getOpenTime(date: Date, timeString: string, timezone?: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const openTime = new Date(date);
  openTime.setHours(hours, minutes, 0, 0);
  
  if (timezone) {
    // Convert from business timezone to local timezone
    return convertFromTimezone(openTime, timezone);
  }
  
  return openTime;
}

// Get specific close time for a date
function getCloseTime(date: Date, timeString: string, timezone?: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const closeTime = new Date(date);
  closeTime.setHours(hours, minutes, 0, 0);
  
  if (timezone) {
    return convertFromTimezone(closeTime, timezone);
  }
  
  return closeTime;
}

// Convert from specific timezone to local
function convertFromTimezone(date: Date, timezone: string): Date {
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  } catch (error) {
    console.error('Error converting from timezone:', error);
    return date;
  }
}

// Calculate countdown to next status change
function calculateCountdown(hours: EnhancedBusinessHours, currentTime: Date): { message: string; timeUntil: number } | null {
  const status = calculateBusinessStatus(hours, currentTime);
  
  if (!status.nextChange) {
    if (status.reason === '24 Hours') {
      return { message: 'Open 24 hours', timeUntil: 0 };
    }
    return null;
  }
  
  const timeUntil = status.nextChange.getTime() - currentTime.getTime();
  const minutesUntil = Math.ceil(timeUntil / (1000 * 60));
  const hoursUntil = Math.floor(minutesUntil / 60);
  const remainingMinutes = minutesUntil % 60;
  
  let message: string;
  
  if (status.isOpen) {
    if (hoursUntil > 0) {
      message = `Closes in ${hoursUntil}h ${remainingMinutes}m`;
    } else {
      message = `Closes in ${minutesUntil}m`;
    }
  } else {
    if (hoursUntil > 24) {
      const days = Math.floor(hoursUntil / 24);
      message = `Opens in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hoursUntil > 0) {
      message = `Opens in ${hoursUntil}h ${remainingMinutes}m`;
    } else {
      message = `Opens in ${minutesUntil}m`;
    }
  }
  
  return { message, timeUntil };
}

// Enhanced grouping function with special hours consideration
function groupConsecutiveDays(
  hours: EnhancedBusinessHours, 
  daysOfWeek: any[], 
  currentTime: Date
): any[] {
  const groups: any[] = [];
  let currentGroup: any = null;
  const currentDayIndex = getCurrentDayIndex(currentTime);
  
  daysOfWeek.forEach((day, index) => {
    const dayHours = hours[day.key];
    const checkDate = new Date(currentTime);
    checkDate.setDate(currentTime.getDate() + (index - currentDayIndex));
    const dateString = checkDate.toISOString().split('T')[0];
    
    const hoursString = formatHoursForGrouping(dayHours, hours, dateString);
    const isCurrent = index === currentDayIndex;
    
    if (!currentGroup || currentGroup.hours !== hoursString) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        days: day.short,
        hours: hoursString,
        isCurrent: isCurrent,
      };
    } else {
      currentGroup.days += ` - ${day.short}`;
      currentGroup.isCurrent = currentGroup.isCurrent || isCurrent;
    }
  });
  
  if (currentGroup) {
    groups.push(currentGroup);
  }
  
  return groups;
}

// Enhanced hours formatting for grouping with special hours
function formatHoursForGrouping(
  dayHours: any, 
  enhancedHours: EnhancedBusinessHours, 
  dateString: string
): string {
  // Check for special hours first
  const specialHours = enhancedHours.specialHours?.[dateString];
  if (specialHours) {
    if (specialHours.isClosed) {
      return `Closed - ${specialHours.reason}`;
    }
    return `${specialHours.open} - ${specialHours.close} (${specialHours.reason})`;
  }
  
  // Check for temporary closures
  if (enhancedHours.temporaryClosures) {
    const closure = enhancedHours.temporaryClosures.find(closure => {
      const checkDate = new Date(dateString);
      return checkDate >= new Date(closure.startDate) && checkDate <= new Date(closure.endDate);
    });
    if (closure) {
      return `Closed - ${closure.reason}`;
    }
  }
  
  if (!dayHours || dayHours.closed || dayHours.isClosed) {
    return 'Closed';
  }
  
  if (!dayHours.open || !dayHours.close) {
    return 'Hours not set';
  }
  
  // Handle 24-hour businesses
  if (dayHours.open === '00:00' && dayHours.close === '23:59') {
    return '24 Hours';
  }
  
  return `${dayHours.open} - ${dayHours.close}`;
}