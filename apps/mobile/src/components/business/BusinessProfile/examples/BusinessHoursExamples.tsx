import React, { useState } from 'react';
import { VStack, HStack, Text, Box, ScrollView, Button, Switch, Select } from 'native-base';
import { BusinessHoursDisplay } from '../BusinessHoursDisplay';
import { EnhancedBusinessHours, BusinessStatus } from '../types';

/**
 * Example implementations of the Enhanced BusinessHours component
 * Demonstrates all features and use cases
 */

export const BusinessHoursExamples: React.FC = () => {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');
  const [currentStatus, setCurrentStatus] = useState<BusinessStatus | null>(null);

  // Basic business hours
  const basicHours = {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '16:00' },
    sunday: { closed: true },
  };

  // Restaurant with special hours and late-night service
  const restaurantHours: EnhancedBusinessHours = {
    monday: { open: '11:00', close: '22:00' },
    tuesday: { open: '11:00', close: '22:00' },
    wednesday: { open: '11:00', close: '22:00' },
    thursday: { open: '11:00', close: '22:00' },
    friday: { open: '11:00', close: '23:00' },
    saturday: { open: '10:00', close: '23:00' },
    sunday: { open: '10:00', close: '21:00' },
    timezone: 'America/New_York',
    specialHours: {
      '2025-12-25': {
        open: '00:00',
        close: '00:00',
        isClosed: true,
        reason: 'Christmas Day',
      },
      '2025-12-31': {
        open: '11:00',
        close: '14:00',
        isClosed: false,
        reason: 'New Year\'s Eve - Limited Hours',
      },
      '2025-07-04': {
        open: '12:00',
        close: '20:00',
        isClosed: false,
        reason: 'Independence Day',
      },
    },
    temporaryClosures: [
      {
        startDate: '2025-01-15',
        endDate: '2025-01-17',
        reason: 'Kitchen Renovation',
      },
    ],
  };

  // 24-hour convenience store
  const twentyFourHourHours: EnhancedBusinessHours = {
    monday: { open: '00:00', close: '23:59' },
    tuesday: { open: '00:00', close: '23:59' },
    wednesday: { open: '00:00', close: '23:59' },
    thursday: { open: '00:00', close: '23:59' },
    friday: { open: '00:00', close: '23:59' },
    saturday: { open: '00:00', close: '23:59' },
    sunday: { open: '00:00', close: '23:59' },
    timezone: 'America/Los_Angeles',
  };

  // Bar with overnight hours
  const barHours: EnhancedBusinessHours = {
    monday: { closed: true },
    tuesday: { closed: true },
    wednesday: { open: '17:00', close: '02:00' },
    thursday: { open: '17:00', close: '02:00' },
    friday: { open: '17:00', close: '03:00' },
    saturday: { open: '15:00', close: '03:00' },
    sunday: { open: '15:00', close: '01:00' },
    timezone: 'America/Chicago',
  };

  // Medical clinic with irregular hours
  const clinicHours: EnhancedBusinessHours = {
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '12:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '16:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: { closed: true },
    timezone: 'America/Denver',
    specialHours: {
      '2025-01-20': {
        open: '08:00',
        close: '12:00',
        isClosed: false,
        reason: 'MLK Day - Morning Hours Only',
      },
    },
    temporaryClosures: [
      {
        startDate: '2025-08-15',
        endDate: '2025-08-20',
        reason: 'Doctor Vacation',
      },
    ],
  };

  // Seasonal business (ski shop)
  const seasonalHours: EnhancedBusinessHours = {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '08:00', close: '20:00' },
    saturday: { open: '08:00', close: '20:00' },
    sunday: { open: '09:00', close: '18:00' },
    timezone: 'America/Denver',
    temporaryClosures: [
      {
        startDate: '2025-05-01',
        endDate: '2025-11-30',
        reason: 'Closed for Summer Season',
      },
    ],
  };

  const handleStatusChange = (status: BusinessStatus) => {
    setCurrentStatus(status);
  };

  const examples = [
    {
      title: 'Basic Office Hours',
      description: 'Standard 9-5 business with weekend variations',
      hours: basicHours,
      features: ['Basic hours', 'Current status', 'Compact view'],
    },
    {
      title: 'Restaurant with Special Hours',
      description: 'Full-service restaurant with holiday hours and temporary closures',
      hours: restaurantHours,
      features: ['Special holiday hours', 'Temporary closures', 'Timezone support', 'Countdown timers'],
    },
    {
      title: '24-Hour Convenience Store',
      description: 'Always open convenience store',
      hours: twentyFourHourHours,
      features: ['24-hour operation', 'Timezone handling', 'Always open status'],
    },
    {
      title: 'Bar with Overnight Hours',
      description: 'Bar that stays open past midnight',
      hours: barHours,
      features: ['Overnight hours', 'Late-night operation', 'Multi-day spanning hours'],
    },
    {
      title: 'Medical Clinic',
      description: 'Healthcare facility with irregular hours and appointments',
      hours: clinicHours,
      features: ['Irregular hours', 'Half-day operations', 'Professional services'],
    },
    {
      title: 'Seasonal Ski Shop',
      description: 'Seasonal business with long closure periods',
      hours: seasonalHours,
      features: ['Seasonal operations', 'Extended closures', 'Mountain timezone'],
    },
  ];

  return (
    <ScrollView>
      <VStack space={6} p={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            Enhanced Business Hours Examples
          </Text>
          <Text fontSize="md" color="gray.600" mb={4}>
            Comprehensive examples showing all features of the enhanced BusinessHoursDisplay component
          </Text>

          {/* Controls */}
          <VStack space={3} mb={6} p={4} bg="gray.50" borderRadius="md">
            <HStack alignItems="center" justifyContent="space-between">
              <Text fontWeight="medium">Show All Examples:</Text>
              <Switch
                isChecked={showAllExamples}
                onToggle={setShowAllExamples}
                colorScheme="blue"
              />
            </HStack>

            <VStack space={2}>
              <Text fontWeight="medium">User Timezone:</Text>
              <Select
                selectedValue={selectedTimezone}
                onValueChange={setSelectedTimezone}
                placeholder="Select timezone"
                _selectedItem={{
                  bg: "blue.100",
                }}
              >
                <Select.Item label="Eastern Time" value="America/New_York" />
                <Select.Item label="Central Time" value="America/Chicago" />
                <Select.Item label="Mountain Time" value="America/Denver" />
                <Select.Item label="Pacific Time" value="America/Los_Angeles" />
              </Select>
            </VStack>

            {currentStatus && (
              <Box p={3} bg={currentStatus.isOpen ? 'green.50' : 'red.50'} borderRadius="md">
                <Text fontWeight="bold" color={currentStatus.isOpen ? 'green.700' : 'red.700'}>
                  Current Status: {currentStatus.isOpen ? 'Open' : 'Closed'}
                </Text>
                {currentStatus.reason && (
                  <Text fontSize="sm" color="gray.600">
                    {currentStatus.reason}
                  </Text>
                )}
              </Box>
            )}
          </VStack>
        </Box>

        {/* Examples */}
        {examples.slice(0, showAllExamples ? examples.length : 2).map((example, index) => (
          <Box key={index} p={4} bg="white" borderRadius="lg" shadow={2}>
            <VStack space={4}>
              <Box>
                <Text fontSize="lg" fontWeight="bold" color="blue.700">
                  {example.title}
                </Text>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  {example.description}
                </Text>
                <HStack space={2} flexWrap="wrap">
                  {example.features.map((feature, fIndex) => (
                    <Box
                      key={fIndex}
                      px={2}
                      py={1}
                      bg="blue.100"
                      borderRadius="sm"
                      mb={1}
                    >
                      <Text fontSize="xs" color="blue.700">
                        {feature}
                      </Text>
                    </Box>
                  ))}
                </HStack>
              </Box>

              {/* Standard View */}
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={2}>
                  Standard View:
                </Text>
                <BusinessHoursDisplay
                  hours={example.hours}
                  showCurrentStatus={true}
                  showCountdown={true}
                  showTimezone={true}
                  userTimezone={selectedTimezone}
                  expandable={true}
                  showSpecialHours={true}
                  onStatusChange={handleStatusChange}
                  refreshInterval={60000}
                />
              </Box>

              {/* Compact View */}
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={2}>
                  Compact View:
                </Text>
                <BusinessHoursDisplay
                  hours={example.hours}
                  compact={true}
                  showCurrentStatus={true}
                  showCountdown={true}
                  showTimezone={false}
                  userTimezone={selectedTimezone}
                  expandable={true}
                  showSpecialHours={true}
                />
              </Box>

              {/* Minimal View */}
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={2}>
                  Minimal View:
                </Text>
                <BusinessHoursDisplay
                  hours={example.hours}
                  compact={true}
                  showCurrentStatus={false}
                  showCountdown={false}
                  showTimezone={false}
                  expandable={false}
                  showSpecialHours={false}
                />
              </Box>
            </VStack>
          </Box>
        ))}

        {!showAllExamples && (
          <Button
            onPress={() => setShowAllExamples(true)}
            variant="outline"
            colorScheme="blue"
          >
            Show All Examples ({examples.length - 2} more)
          </Button>
        )}

        {/* Usage Documentation */}
        <Box p={4} bg="blue.50" borderRadius="lg">
          <Text fontSize="lg" fontWeight="bold" color="blue.700" mb={3}>
            Usage Guide
          </Text>
          
          <VStack space={3}>
            <Box>
              <Text fontWeight="medium" color="blue.700">Basic Usage:</Text>
              <Text fontSize="sm" color="gray.700">
                {'<BusinessHoursDisplay hours={businessHours} showCurrentStatus={true} />'}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="medium" color="blue.700">With Special Hours:</Text>
              <Text fontSize="sm" color="gray.700">
                Include specialHours and temporaryClosures in your hours object for holiday hours and temporary closures.
              </Text>
            </Box>

            <Box>
              <Text fontWeight="medium" color="blue.700">Timezone Support:</Text>
              <Text fontSize="sm" color="gray.700">
                Set timezone in hours object or pass userTimezone prop for automatic conversion.
              </Text>
            </Box>

            <Box>
              <Text fontWeight="medium" color="blue.700">Real-time Updates:</Text>
              <Text fontSize="sm" color="gray.700">
                Component automatically updates every minute. Use refreshInterval prop to customize.
              </Text>
            </Box>

            <Box>
              <Text fontWeight="medium" color="blue.700">Status Callbacks:</Text>
              <Text fontSize="sm" color="gray.700">
                Use onStatusChange prop to receive real-time business status updates.
              </Text>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </ScrollView>
  );
};

export default BusinessHoursExamples;