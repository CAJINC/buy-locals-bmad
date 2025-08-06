import React from 'react';
import { Box, Text, VStack } from 'native-base';

export const HomeScreen: React.FC = () => {
  return (
    <Box flex={1} bg="white" safeArea>
      <VStack space={4} p={4}>
        <Text fontSize="xl" fontWeight="bold">
          Welcome to BuyLocals
        </Text>
        <Text>
          Discover and book local businesses in your area.
        </Text>
      </VStack>
    </Box>
  );
};