import React from 'react';
import { VStack, HStack, Text, Switch, Select, CheckIcon, FormControl, Divider } from 'native-base';
import { FormStepProps } from '../types';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

// Generate time options from 6:00 AM to 11:30 PM in 30-minute intervals
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 6; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
      times.push({ value: time24, label: time12 });
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

interface DayHoursProps {
  day: { key: string; label: string };
  hours: { open?: string; close?: string; closed?: boolean } | undefined;
  onHoursChange: (
    dayKey: string,
    hours: { open?: string; close?: string; closed?: boolean }
  ) => void;
}

const DayHours: React.FC<DayHoursProps> = ({ day, hours, onHoursChange }) => {
  const isClosed = hours?.closed || false;
  const openTime = hours?.open || '09:00';
  const closeTime = hours?.close || '17:00';

  const handleClosedToggle = (value: boolean) => {
    if (value) {
      onHoursChange(day.key, { closed: true });
    } else {
      onHoursChange(day.key, { open: openTime, close: closeTime, closed: false });
    }
  };

  const handleTimeChange = (type: 'open' | 'close', time: string) => {
    onHoursChange(day.key, {
      ...hours,
      [type]: time,
      closed: false,
    });
  };

  return (
    <VStack space={3} bg="gray.50" p={4} rounded="md">
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontSize="md" fontWeight="semibold" flex={1}>
          {day.label}
        </Text>
        <HStack space={2} alignItems="center">
          <Text fontSize="sm" color={isClosed ? 'red.600' : 'green.600'}>
            {isClosed ? 'Closed' : 'Open'}
          </Text>
          <Switch isChecked={isClosed} onToggle={handleClosedToggle} colorScheme="red" size="sm" />
        </HStack>
      </HStack>

      {!isClosed && (
        <HStack space={3} alignItems="center">
          <VStack flex={1}>
            <Text fontSize="xs" color="gray.600" mb={1}>
              Opening Time
            </Text>
            <Select
              selectedValue={openTime}
              onValueChange={value => handleTimeChange('open', value)}
              placeholder="Select opening time"
              size="sm"
              _selectedItem={{
                bg: 'blue.600',
                endIcon: <CheckIcon size={2} />,
              }}
            >
              {TIME_OPTIONS.map(timeOption => (
                <Select.Item
                  key={timeOption.value}
                  label={timeOption.label}
                  value={timeOption.value}
                />
              ))}
            </Select>
          </VStack>

          <Text fontSize="lg" color="gray.400" mt={4}>
            to
          </Text>

          <VStack flex={1}>
            <Text fontSize="xs" color="gray.600" mb={1}>
              Closing Time
            </Text>
            <Select
              selectedValue={closeTime}
              onValueChange={value => handleTimeChange('close', value)}
              placeholder="Select closing time"
              size="sm"
              _selectedItem={{
                bg: 'blue.600',
                endIcon: <CheckIcon size={2} />,
              }}
            >
              {TIME_OPTIONS.map(timeOption => (
                <Select.Item
                  key={timeOption.value}
                  label={timeOption.label}
                  value={timeOption.value}
                />
              ))}
            </Select>
          </VStack>
        </HStack>
      )}
    </VStack>
  );
};

export const BusinessHoursStep: React.FC<FormStepProps> = ({ data, onDataChange, errors }) => {
  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleDayHoursChange = (
    dayKey: string,
    dayHours: { open?: string; close?: string; closed?: boolean }
  ) => {
    const updatedHours = {
      ...data.hours,
      [dayKey]: dayHours,
    };
    onDataChange({ hours: updatedHours });
  };

  // Quick actions for common patterns
  const setWeekdayHours = () => {
    const weekdayHours = { open: '09:00', close: '17:00', closed: false };
    const weekendHours = { closed: true };

    const updatedHours = {
      monday: weekdayHours,
      tuesday: weekdayHours,
      wednesday: weekdayHours,
      thursday: weekdayHours,
      friday: weekdayHours,
      saturday: weekendHours,
      sunday: weekendHours,
    };

    onDataChange({ hours: updatedHours });
  };

  const setEveryDayOpen = () => {
    const dailyHours = { open: '09:00', close: '17:00', closed: false };
    const updatedHours = {};

    DAYS_OF_WEEK.forEach(day => {
      updatedHours[day.key] = { ...dailyHours };
    });

    onDataChange({ hours: updatedHours });
  };

  return (
    <VStack space={6}>
      <VStack space={2}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">
          Business Hours
        </Text>
        <Text fontSize="sm" color="gray.600">
          Set your operating hours for each day of the week. Toggle the switch to mark days as
          closed.
        </Text>
      </VStack>

      {/* Quick Actions */}
      <VStack space={3} bg="blue.50" p={4} rounded="md">
        <Text fontSize="sm" fontWeight="semibold" color="blue.800">
          Quick Setup:
        </Text>
        <HStack space={2} flexWrap="wrap">
          <Text
            onPress={setWeekdayHours}
            bg="blue.100"
            color="blue.800"
            px={3}
            py={2}
            rounded="md"
            fontSize="sm"
          >
            Mon-Fri 9AM-5PM
          </Text>
          <Text
            onPress={setEveryDayOpen}
            bg="blue.100"
            color="blue.800"
            px={3}
            py={2}
            rounded="md"
            fontSize="sm"
          >
            Every Day 9AM-5PM
          </Text>
        </HStack>
      </VStack>

      {/* Error Display */}
      {getFieldError('hours') && (
        <FormControl isInvalid>
          <FormControl.ErrorMessage>{getFieldError('hours')}</FormControl.ErrorMessage>
        </FormControl>
      )}

      {/* Days of Week */}
      <VStack space={4}>
        {DAYS_OF_WEEK.map((day, index) => (
          <VStack key={day.key} space={2}>
            <DayHours
              day={day}
              hours={data.hours?.[day.key]}
              onHoursChange={handleDayHoursChange}
            />
            {index < DAYS_OF_WEEK.length - 1 && <Divider />}
          </VStack>
        ))}
      </VStack>

      {/* Summary */}
      <VStack space={2} bg="gray.50" p={4} rounded="md">
        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
          Hours Summary:
        </Text>
        <VStack space={1}>
          {DAYS_OF_WEEK.map(day => {
            const dayHours = data.hours?.[day.key];
            const displayText = dayHours?.closed
              ? 'Closed'
              : dayHours?.open && dayHours?.close
                ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
                : 'Not set';

            return (
              <HStack key={day.key} justifyContent="space-between">
                <Text fontSize="sm" color="gray.600">
                  {day.label}:
                </Text>
                <Text fontSize="sm" color={dayHours?.closed ? 'red.600' : 'gray.800'}>
                  {displayText}
                </Text>
              </HStack>
            );
          })}
        </VStack>
      </VStack>
    </VStack>
  );
};

// Helper function to format 24-hour time to 12-hour format
function formatTime(time24: string): string {
  const [hour, minute] = time24.split(':').map(Number);
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}
