import React from 'react';
import {
  HStack,
  VStack,
  Text,
  Icon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessRatingProps } from './types';

export const BusinessRating: React.FC<BusinessRatingProps> = React.memo(({
  rating,
  reviewCount = 0,
  size = 'md',
  showReviewCount = true,
  compact = false,
}) => {
  // Calculate star display
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const starSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';
  const textSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';

  const renderStars = () => {
    const stars = [];
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Icon
          key={`full-${i}`}
          as={MaterialIcons}
          name="star"
          size={starSize}
          color="amber.400"
        />
      );
    }
    
    // Half star
    if (hasHalfStar) {
      stars.push(
        <Icon
          key="half"
          as={MaterialIcons}
          name="star-half"
          size={starSize}
          color="amber.400"
        />
      );
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Icon
          key={`empty-${i}`}
          as={MaterialIcons}
          name="star-outline"
          size={starSize}
          color="gray.300"
        />
      );
    }
    
    return stars;
  };

  if (compact) {
    return (
      <HStack space={1} alignItems="center">
        <HStack space={0.5}>
          {renderStars()}
        </HStack>
        <Text fontSize={textSize} color="gray.600" fontWeight="medium">
          {rating.toFixed(1)}
        </Text>
        {showReviewCount && reviewCount > 0 && (
          <Text fontSize={textSize} color="gray.500">
            ({reviewCount})
          </Text>
        )}
      </HStack>
    );
  }

  return (
    <VStack space={1}>
      <HStack space={2} alignItems="center">
        <HStack space={0.5}>
          {renderStars()}
        </HStack>
        <Text fontSize={textSize} color="gray.700" fontWeight="semibold">
          {rating.toFixed(1)}
        </Text>
      </HStack>
      {showReviewCount && reviewCount > 0 && (
        <Text fontSize={textSize} color="gray.500">
          {reviewCount} review{reviewCount !== 1 ? 's' : ''}
        </Text>
      )}
    </VStack>
  );
});