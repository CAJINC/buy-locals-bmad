import React from 'react';
import { Box, Text, VStack } from 'native-base';

export const SearchScreen: React.FC = () => {
  return (
    <Box flex={1} bg="white" safeArea>
      <VStack space={4} p={4}>
        <Text fontSize="xl" fontWeight="bold">
          Search Businesses
        </Text>
        <Text>
          Find local businesses by name, category, or location.
        </Text>
      </VStack>
    </Box>
  );
};