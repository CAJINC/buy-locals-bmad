import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Icon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessHeaderProps } from './types';
import { BusinessRating } from './BusinessRating';
import { BusinessVerification } from './BusinessVerification';
import { BusinessCategoryBadges } from './BusinessCategoryBadges';

export const BusinessHeader: React.FC<BusinessHeaderProps> = React.memo(({
  business,
  logoImage,
  showVerification = true,
}) => {
  return (
    <VStack space={4}>
      {/* Business Logo and Basic Info */}
      <HStack space={4} alignItems="flex-start">
        {logoImage && (
          <Box>
            <Box
              width={80}
              height={80}
              borderRadius="xl"
              overflow="hidden"
              bg="gray.100"
              borderWidth={2}
              borderColor="gray.200"
              shadow={2}
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
                  size="xl"
                  color="blue.500"
                />
              </Box>
            </Box>
          </Box>
        )}
        
        <VStack flex={1} space={3}>
          {/* Business Name and Verification */}
          <HStack space={2} alignItems="center" flexWrap="wrap">
            <Heading size="lg" color="gray.800" flex={1}>
              {business.name}
            </Heading>
            {showVerification && business.isVerified && (
              <BusinessVerification
                isVerified={business.isVerified}
                verificationLevel={business.verificationLevel}
                compact={true}
              />
            )}
          </HStack>
          
          {/* Rating Display */}
          {business.rating && (
            <BusinessRating
              rating={business.rating}
              reviewCount={business.reviewCount}
              size="md"
              showReviewCount={true}
              compact={false}
            />
          )}
          
          {/* Enhanced Category Badges */}
          <BusinessCategoryBadges
            categories={business.categories}
            maxDisplay={3}
          />
        </VStack>
      </HStack>
    </VStack>
  );
});