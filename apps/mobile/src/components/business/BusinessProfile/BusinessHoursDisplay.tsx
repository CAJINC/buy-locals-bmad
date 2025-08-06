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
import { EnhancedBusinessHoursDisplayProps, EnhancedBusinessHours, BusinessStatus } from './types';

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
  const [error, setError] = useState<string | null>(null);
  const daysOfWeek = useMemo(
    () => [
      { key: 'monday', label: 'Monday', short: 'Mon' },
      { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
      { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
      { key: 'thursday', label: 'Thursday', short: 'Thu' },
      { key: 'friday', label: 'Friday', short: 'Fri' },
      { key: 'saturday', label: 'Saturday', short: 'Sat' },
      { key: 'sunday', label: 'Sunday', short: 'Sun' },
    ],
    []
  );

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
          hour12: true,
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
  const formatHoursRange = useCallback(
    (dayHours: EnhancedBusinessHours[keyof EnhancedBusinessHours], date?: string): string => {
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
    },
    [enhancedHours, formatTime]
  );

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
        <Text fontSize="sm" color="gray.500" mt={2}>
          Loading hours...
        </Text>
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
            <Text fontSize="sm" flex={1}>
              {error}
            </Text>
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
                colorScheme={businessStatus.isOpen ? 'green' : 'red'}
                variant="subtle"
                rounded="md"
                size="md"
              >
                <HStack alignItems="center" space={1}>
                  <Box
                    w={2}
                    h={2}
                    borderRadius="full"
                    bg={businessStatus.isOpen ? 'green.500' : 'red.500'}
                  />
                  <Text fontSize="sm" fontWeight="medium">
                    {businessStatus.isOpen ? 'Open Now' : 'Closed'}
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
                name={isExpanded ? 'expand-less' : 'expand-more'}
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
                    fontWeight={group.isCurrent ? 'bold' : 'normal'}
                  >
                    {group.days}
                  </Text>
                  <Text
                    color={group.isCurrent ? 'blue.600' : 'gray.600'}
                    fontSize="sm"
                    fontWeight={group.isCurrent ? 'bold' : 'normal'}
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
                const hasSpecialHours =
                  enhancedHours.specialHours?.[dateString] ||
                  enhancedHours.temporaryClosures?.some(closure => {
                    return (
                      dayDate >= new Date(closure.startDate) && dayDate <= new Date(closure.endDate)
                    );
                  });

                return (
                  <HStack
                    key={day.key}
                    justifyContent="space-between"
                    alignItems="center"
                    py={compact ? 1 : 2}
                    px={isCurrent ? 3 : 0}
                    bg={isCurrent ? 'blue.50' : hasSpecialHours ? 'yellow.50' : 'transparent'}
                    borderRadius={isCurrent || hasSpecialHours ? 'md' : 0}
                    borderWidth={hasSpecialHours ? 1 : 0}
                    borderColor={hasSpecialHours ? 'yellow.200' : 'transparent'}
                  >
                    <VStack alignItems="flex-start" minWidth="80px">
                      <Text
                        color={isCurrent ? 'blue.700' : 'gray.700'}
                        fontSize={compact ? 'sm' : 'md'}
                        fontWeight={isCurrent ? 'bold' : 'normal'}
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
                        color={isCurrent ? 'blue.600' : hasSpecialHours ? 'yellow.700' : 'gray.600'}
                        fontSize={compact ? 'sm' : 'md'}
                        fontWeight={isCurrent ? 'bold' : 'normal'}
                        textAlign="right"
                      >
                        {formatHoursRange(dayHours, dateString)}
                      </Text>

                      {/* Special hours indicator */}
                      {hasSpecialHours && showSpecialHours && (
                        <HStack alignItems="center" space={1}>
                          <Icon as={MaterialIcons} name="star" size={3} color="yellow.500" />
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
            <HStack
              alignItems="center"
              space={2}
              pt={2}
              borderTopWidth={1}
              borderTopColor="gray.200"
            >
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
      {Object.keys(enhancedHours).filter(
        key => !['timezone', 'specialHours', 'temporaryClosures'].includes(key)
      ).length === 0 && (
        <Box p={4} bg="gray.50" borderRadius="md">
          <VStack alignItems="center" space={2}>
            <Icon as={MaterialIcons} name="schedule" size={6} color="gray.400" />
            <Text color="gray.500" fontSize="md" textAlign="center" italic>
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

// Note: Utility functions have been moved to utils/hoursUtils.ts for better organization and reusability
