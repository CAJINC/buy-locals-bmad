import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Box,
  Badge,
} from 'native-base';
import { BusinessHoursDisplayProps } from './types';

export const BusinessHoursDisplay: React.FC<BusinessHoursDisplayProps> = ({
  hours,
  compact = false,
  showCurrentStatus = false,
}) => {
  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];

  const getCurrentDayIndex = (): number => {
    const now = new Date();
    const day = now.getDay();
    // Convert Sunday (0) to index 6, Monday (1) to index 0, etc.
    return day === 0 ? 6 : day - 1;
  };

  const currentDayIndex = getCurrentDayIndex();
  const isBusinessOpen = checkBusinessOpen(hours);

  // Format time string for display (e.g., "09:00" -> "9:00 AM")
  const formatTime = (time: string): string => {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Format hours range for display
  const formatHoursRange = (dayHours: any): string => {
    if (!dayHours || dayHours.closed) {
      return 'Closed';
    }
    
    if (!dayHours.open || !dayHours.close) {
      return 'Hours not set';
    }
    
    return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
  };

  // Group consecutive days with same hours
  const groupedHours = compact ? groupConsecutiveDays(hours, daysOfWeek) : null;

  return (
    <VStack space={compact ? 2 : 3}>
      {/* Current Status Badge */}
      {showCurrentStatus && (
        <HStack alignItems="center" space={2}>
          <Badge
            colorScheme={isBusinessOpen ? "green" : "red"}
            variant="subtle"
            rounded="md"
          >
            {isBusinessOpen ? "Open Now" : "Closed"}
          </Badge>
          {isBusinessOpen && (
            <Text color="gray.500" fontSize="sm">
              {getNextCloseTime(hours)}
            </Text>
          )}
        </HStack>
      )}

      {/* Hours Display */}
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
            const dayHours = hours[day.key];
            const isCurrent = index === currentDayIndex;
            
            return (
              <HStack
                key={day.key}
                justifyContent="space-between"
                alignItems="center"
                py={compact ? 1 : 2}
                px={isCurrent ? 3 : 0}
                bg={isCurrent ? "blue.50" : "transparent"}
                borderRadius={isCurrent ? "md" : 0}
              >
                <Text
                  color={isCurrent ? "blue.700" : "gray.700"}
                  fontSize={compact ? "sm" : "md"}
                  fontWeight={isCurrent ? "bold" : "normal"}
                  minWidth="80px"
                >
                  {compact ? day.short : day.label}
                </Text>
                <Text
                  color={isCurrent ? "blue.600" : "gray.600"}
                  fontSize={compact ? "sm" : "md"}
                  fontWeight={isCurrent ? "bold" : "normal"}
                  textAlign="right"
                >
                  {formatHoursRange(dayHours)}
                </Text>
              </HStack>
            );
          })}
        </VStack>
      )}

      {/* No hours message */}
      {Object.keys(hours).length === 0 && (
        <Box p={4} bg="gray.50" borderRadius="md">
          <Text color="gray.500" fontSize="md" textAlign="center" style={{ fontStyle: 'italic' }}>
            Business hours not available
          </Text>
        </Box>
      )}
    </VStack>
  );
};

// Helper function to check if business is currently open
function checkBusinessOpen(hours: any): boolean {
  const now = new Date();
  const currentDay = now.toLocaleLowerCase().substring(0, 3); // 'mon', 'tue', etc.
  const currentTime = now.getHours() * 100 + now.getMinutes(); // 1430 for 2:30 PM
  
  // Map day names to match the hours object keys
  const dayMap: { [key: string]: string } = {
    'mon': 'monday',
    'tue': 'tuesday',
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday',
  };
  
  const dayKey = dayMap[currentDay];
  const todayHours = hours[dayKey];
  
  if (!todayHours || todayHours.closed) {
    return false;
  }
  
  if (!todayHours.open || !todayHours.close) {
    return false;
  }
  
  // Convert time strings to numbers (e.g., "14:30" -> 1430)
  const openTime = parseInt(todayHours.open.replace(':', ''));
  const closeTime = parseInt(todayHours.close.replace(':', ''));
  
  // Handle overnight businesses (close time is next day)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  
  return currentTime >= openTime && currentTime <= closeTime;
}

// Helper function to get next closing time
function getNextCloseTime(hours: any): string {
  const now = new Date();
  const currentDay = now.toLocaleLowerCase().substring(0, 3);
  
  const dayMap: { [key: string]: string } = {
    'mon': 'monday',
    'tue': 'tuesday',
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday',
  };
  
  const dayKey = dayMap[currentDay];
  const todayHours = hours[dayKey];
  
  if (todayHours && todayHours.close && !todayHours.closed) {
    const [hours24, minutes] = todayHours.close.split(':').map(Number);
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const displayHours = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    
    return `Closes at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return '';
}

// Helper function to group consecutive days with same hours
function groupConsecutiveDays(hours: any, daysOfWeek: any[]): any[] {
  const groups: any[] = [];
  let currentGroup: any = null;
  const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  
  daysOfWeek.forEach((day, index) => {
    const dayHours = hours[day.key];
    const hoursString = formatHoursForGrouping(dayHours);
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
      };
    } else {
      // Extend current group
      currentGroup.days += ` - ${day.short}`;
      currentGroup.isCurrent = currentGroup.isCurrent || isCurrent;
    }
  });
  
  if (currentGroup) {
    groups.push(currentGroup);
  }
  
  return groups;
}

// Helper function to format hours for grouping comparison
function formatHoursForGrouping(dayHours: any): string {
  if (!dayHours || dayHours.closed) {
    return 'Closed';
  }
  
  if (!dayHours.open || !dayHours.close) {
    return 'Hours not set';
  }
  
  return `${dayHours.open} - ${dayHours.close}`;
}