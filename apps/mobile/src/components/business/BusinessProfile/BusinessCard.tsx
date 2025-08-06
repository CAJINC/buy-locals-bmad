import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Pressable,
  Icon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessCardProps } from './types';

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  onPress,
  showDistance = false,
  compact = false,
}) => {
  const logoImage = business.media.find(m => m.type === 'logo');
  const isOpen = checkBusinessOpen(business.hours);
  
  const handlePress = () => {
    if (onPress) {
      onPress(business);
    }
  };

  return (
    <Pressable onPress={handlePress}>
      <Box
        bg="white"
        borderRadius="lg"
        shadow={2}
        p={4}
        mx={2}
        my={1}
        borderWidth={1}
        borderColor="gray.100"
      >
        <HStack space={3} alignItems="flex-start">
          {/* Business Logo */}
          {logoImage && (
            <Box
              width={compact ? 50 : 60}
              height={compact ? 50 : 60}
              borderRadius="md"
              overflow="hidden"
              bg="gray.100"
            >
              {/* Mock Image Component - Replace with actual Image */}
              <Box
                flex={1}
                bg="blue.100"
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  as={MaterialIcons}
                  name="business"
                  size={compact ? "md" : "lg"}
                  color="blue.500"
                />
              </Box>
            </Box>
          )}
          
          {/* Business Info */}
          <VStack flex={1} space={compact ? 1 : 2}>
            <VStack space={1}>
              <HStack justifyContent="space-between" alignItems="flex-start">
                <Text
                  fontWeight="bold"
                  fontSize={compact ? "md" : "lg"}
                  color="gray.800"
                  flex={1}
                  numberOfLines={1}
                >
                  {business.name}
                </Text>
                {showDistance && business.distance && (
                  <Text color="gray.500" fontSize="sm">
                    {business.distance.toFixed(1)} mi
                  </Text>
                )}
              </HStack>
              
              {business.description && !compact && (
                <Text
                  color="gray.600"
                  fontSize="sm"
                  numberOfLines={2}
                >
                  {business.description}
                </Text>
              )}
            </VStack>
            
            {/* Categories */}
            <HStack space={1} flexWrap="wrap">
              {business.categories.slice(0, compact ? 2 : 3).map((category, index) => (
                <Badge
                  key={index}
                  colorScheme="blue"
                  variant="subtle"
                  rounded="sm"
                  fontSize="xs"
                >
                  {category}
                </Badge>
              ))}
              {business.categories.length > (compact ? 2 : 3) && (
                <Badge colorScheme="gray" variant="subtle" rounded="sm" fontSize="xs">
                  +{business.categories.length - (compact ? 2 : 3)}
                </Badge>
              )}
            </HStack>
            
            {/* Status and Contact Info */}
            <HStack space={4} alignItems="center">
              {/* Open/Closed Status */}
              <HStack space={1} alignItems="center">
                <Box
                  width={2}
                  height={2}
                  borderRadius="full"
                  bg={isOpen ? "green.500" : "red.500"}
                />
                <Text
                  color={isOpen ? "green.600" : "red.600"}
                  fontSize="xs"
                  fontWeight="medium"
                >
                  {isOpen ? "Open" : "Closed"}
                </Text>
              </HStack>
              
              {/* Rating (if available) */}
              {business.rating && (
                <HStack space={1} alignItems="center">
                  <Icon
                    as={MaterialIcons}
                    name="star"
                    size="xs"
                    color="yellow.500"
                  />
                  <Text fontSize="xs" color="gray.600">
                    {business.rating.toFixed(1)}
                    {business.review_count && ` (${business.review_count})`}
                  </Text>
                </HStack>
              )}
            </HStack>
            
            {/* Address */}
            {!compact && (
              <HStack space={1} alignItems="center">
                <Icon
                  as={MaterialIcons}
                  name="location-on"
                  size="xs"
                  color="gray.400"
                />
                <Text color="gray.500" fontSize="xs" flex={1} numberOfLines={1}>
                  {business.location.address}, {business.location.city}
                </Text>
              </HStack>
            )}
          </VStack>
        </HStack>
      </Box>
    </Pressable>
  );
};

// Helper function to check if business is currently open
function checkBusinessOpen(hours: any): boolean {
  const now = new Date();
  const currentDay = now.toLocaleLowerCase().substring(0, 3); // 'mon', 'tue', etc.
  const currentTime = now.getHours() * 100 + now.getMinutes(); // 1430 for 2:30 PM
  
  const todayHours = hours[currentDay];
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