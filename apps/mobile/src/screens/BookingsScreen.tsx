import React from 'react';
import { Box, Text, VStack } from 'native-base';

export const BookingsScreen: React.FC = () => {
  return (
    <Box flex={1} bg="white" safeArea>
      <VStack space={4} p={4}>
        <Text fontSize="xl" fontWeight="bold">
          My Bookings
        </Text>
        <Text>
          View and manage your reservations.
        </Text>
      </VStack>
    </Box>
  );
};