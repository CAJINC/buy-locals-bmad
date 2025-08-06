import React, { useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Icon,
  Pressable,
  Image,
  Skeleton,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { ServiceItemProps, EnhancedService } from './types';

export const ServiceItem: React.FC<ServiceItemProps> = React.memo(({
  service,
  onPress,
  onBook,
  showBookingButton = true,
  compact = false,
}) => {
  // Memoized price display logic
  const priceDisplay = useMemo(() => {
    const { pricing } = service;
    
    switch (pricing.type) {
      case 'exact':
        return `${pricing.currency}${pricing.amount?.toFixed(2) || '0.00'}`;
      case 'range':
        return `${pricing.currency}${pricing.minAmount?.toFixed(2) || '0.00'} - ${pricing.currency}${pricing.maxAmount?.toFixed(2) || '0.00'}`;
      case 'quote':
        return 'Call for Quote';
      default:
        return 'Price Available';
    }
  }, [service.pricing]);

  // Memoized availability styling
  const availabilityConfig = useMemo(() => {
    switch (service.availability) {
      case 'available':
        return {
          color: 'green.600',
          bg: 'green.100',
          text: 'Available',
          icon: 'check-circle',
        };
      case 'busy':
        return {
          color: 'orange.600',
          bg: 'orange.100',
          text: 'Busy',
          icon: 'schedule',
        };
      case 'unavailable':
        return {
          color: 'red.600',
          bg: 'red.100',
          text: 'Unavailable',
          icon: 'cancel',
        };
      default:
        return {
          color: 'gray.600',
          bg: 'gray.100',
          text: 'Unknown',
          icon: 'help-outline',
        };
    }
  }, [service.availability]);

  // Duration display
  const durationDisplay = useMemo(() => {
    if (!service.duration) return null;
    
    const hours = Math.floor(service.duration / 60);
    const minutes = service.duration % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }, [service.duration]);

  const handlePress = () => {
    onPress?.(service);
  };

  const handleBook = (e: any) => {
    e.stopPropagation();
    onBook?.(service);
  };

  if (compact) {
    return (
      <Pressable onPress={handlePress}>
        <Box
          p={3}
          bg="white"
          borderRadius="lg"
          borderWidth={1}
          borderColor="gray.200"
          shadow={1}
          _pressed={{ opacity: 0.8 }}
        >
          <HStack space={3} alignItems="center">
            {/* Service Image */}
            {service.images && service.images[0] && (
              <Box w={12} h={12} borderRadius="md" overflow="hidden">
                <Image
                  source={{ uri: service.images[0] }}
                  alt={service.name}
                  w="100%"
                  h="100%"
                  fallbackElement={
                    <Box w="100%" h="100%" bg="gray.200" justifyContent="center" alignItems="center">
                      <Icon as={MaterialIcons} name="image" size="md" color="gray.400" />
                    </Box>
                  }
                />
              </Box>
            )}
            
            {/* Service Info */}
            <VStack flex={1} space={1}>
              <Text fontWeight="semibold" color="gray.800" fontSize="md" numberOfLines={1}>
                {service.name}
              </Text>
              
              <HStack space={2} alignItems="center">
                <Text fontWeight="bold" color="green.600" fontSize="sm">
                  {priceDisplay}
                </Text>
                {durationDisplay && (
                  <>
                    <Text color="gray.400" fontSize="xs">•</Text>
                    <Text color="gray.500" fontSize="xs">
                      {durationDisplay}
                    </Text>
                  </>
                )}
              </HStack>
            </VStack>

            {/* Availability Badge */}
            <Badge
              colorScheme={availabilityConfig.color.split('.')[0]}
              variant="subtle"
              borderRadius="full"
              px={2}
              py={1}
            >
              <HStack space={1} alignItems="center">
                <Icon
                  as={MaterialIcons}
                  name={availabilityConfig.icon}
                  size="xs"
                  color={availabilityConfig.color}
                />
                <Text fontSize="xs" color={availabilityConfig.color}>
                  {availabilityConfig.text}
                </Text>
              </HStack>
            </Badge>
          </HStack>
        </Box>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress}>
      <Box
        p={4}
        bg="white"
        borderRadius="xl"
        borderWidth={1}
        borderColor="gray.200"
        shadow={2}
        _pressed={{ opacity: 0.9, transform: [{ scale: 0.98 }] }}
      >
        <VStack space={4}>
          {/* Service Image */}
          {service.images && service.images[0] && (
            <Box w="100%" h={40} borderRadius="lg" overflow="hidden">
              <Image
                source={{ uri: service.images[0] }}
                alt={service.name}
                w="100%"
                h="100%"
                resizeMode="cover"
                fallbackElement={
                  <Skeleton w="100%" h="100%" borderRadius="lg" />
                }
              />
            </Box>
          )}

          {/* Header */}
          <VStack space={2}>
            <HStack justifyContent="space-between" alignItems="flex-start">
              <VStack flex={1} space={1}>
                <Text fontWeight="bold" color="gray.800" fontSize="lg" numberOfLines={2}>
                  {service.name}
                </Text>
                
                {/* Category Badge */}
                <Badge
                  colorScheme="blue"
                  variant="outline"
                  borderRadius="full"
                  alignSelf="flex-start"
                >
                  {service.category}
                </Badge>
              </VStack>

              {/* Availability Badge */}
              <Badge
                colorScheme={availabilityConfig.color.split('.')[0]}
                variant="subtle"
                borderRadius="full"
                px={3}
                py={1}
              >
                <HStack space={1} alignItems="center">
                  <Icon
                    as={MaterialIcons}
                    name={availabilityConfig.icon}
                    size="xs"
                    color={availabilityConfig.color}
                  />
                  <Text fontSize="xs" fontWeight="medium" color={availabilityConfig.color}>
                    {availabilityConfig.text}
                  </Text>
                </HStack>
              </Badge>
            </HStack>

            {/* Description */}
            <Text color="gray.600" fontSize="sm" numberOfLines={3}>
              {service.description}
            </Text>
          </VStack>

          {/* Price and Duration */}
          <HStack justifyContent="space-between" alignItems="center">
            <VStack space={1}>
              <Text fontWeight="bold" color="green.600" fontSize="xl">
                {priceDisplay}
              </Text>
              {durationDisplay && (
                <HStack space={1} alignItems="center">
                  <Icon as={MaterialIcons} name="schedule" size="xs" color="gray.500" />
                  <Text color="gray.500" fontSize="sm">
                    {durationDisplay}
                  </Text>
                </HStack>
              )}
            </VStack>

            {/* Booking Button */}
            {showBookingButton && service.bookingEnabled && service.availability === 'available' && (
              <Button
                size="md"
                colorScheme="blue"
                borderRadius="full"
                leftIcon={<Icon as={MaterialIcons} name="event" />}
                onPress={handleBook}
                _pressed={{ opacity: 0.8 }}
              >
                Book Now
              </Button>
            )}
          </HStack>

          {/* Requirements */}
          {service.requirements && service.requirements.length > 0 && (
            <VStack space={2}>
              <Text fontWeight="medium" color="gray.700" fontSize="sm">
                Requirements:
              </Text>
              <VStack space={1}>
                {service.requirements.map((requirement, index) => (
                  <HStack key={index} space={2} alignItems="center">
                    <Icon as={MaterialIcons} name="info-outline" size="xs" color="blue.500" />
                    <Text color="gray.600" fontSize="sm" flex={1}>
                      {requirement}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          )}
        </VStack>
      </Box>
    </Pressable>
  );
});

ServiceItem.displayName = 'ServiceItem';