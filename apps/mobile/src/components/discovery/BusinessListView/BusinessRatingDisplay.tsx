import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessRatingDisplayProps } from './types';

export const BusinessRatingDisplay: React.FC<BusinessRatingDisplayProps> = ({
  rating,
  reviewCount = 0,
  size = 'medium',
  showCount = true,
  testID = 'business-rating-display'
}) => {
  if (!rating && rating !== 0) {
    return (
      <View style={[styles.container, styles[size]]} testID={testID}>
        <Text style={[styles.noRatingText, styles[`noRatingText_${size}`]]}>
          No ratings
        </Text>
      </View>
    );
  }

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - Math.ceil(rating);

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Icon
          key={`full-${i}`}
          name="star"
          size={styles[`starIcon_${size}`].fontSize}
          color="#FFD700"
        />
      );
    }

    // Half star
    if (hasHalfStar) {
      stars.push(
        <Icon
          key="half"
          name="star-half"
          size={styles[`starIcon_${size}`].fontSize}
          color="#FFD700"
        />
      );
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Icon
          key={`empty-${i}`}
          name="star-border"
          size={styles[`starIcon_${size}`].fontSize}
          color="#E0E0E0"
        />
      );
    }

    return stars;
  };

  return (
    <View style={[styles.container, styles[size]]} testID={testID}>
      <View style={styles.starsContainer}>
        {renderStars()}
      </View>
      <Text style={[styles.ratingText, styles[`ratingText_${size}`]]}>
        {rating.toFixed(1)}
      </Text>
      {showCount && reviewCount > 0 && (
        <Text style={[styles.reviewCount, styles[`reviewCount_${size}`]]}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  small: {
    gap: 2,
  },
  medium: {
    gap: 4,
  },
  large: {
    gap: 6,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon_small: {
    fontSize: 12,
  },
  starIcon_medium: {
    fontSize: 14,
  },
  starIcon_large: {
    fontSize: 16,
  },
  ratingText: {
    fontWeight: '600',
    color: '#333',
  },
  ratingText_small: {
    fontSize: 12,
  },
  ratingText_medium: {
    fontSize: 14,
  },
  ratingText_large: {
    fontSize: 16,
  },
  reviewCount: {
    color: '#666',
    fontWeight: '400',
  },
  reviewCount_small: {
    fontSize: 11,
  },
  reviewCount_medium: {
    fontSize: 12,
  },
  reviewCount_large: {
    fontSize: 14,
  },
  noRatingText: {
    color: '#999',
    fontStyle: 'italic',
  },
  noRatingText_small: {
    fontSize: 11,
  },
  noRatingText_medium: {
    fontSize: 12,
  },
  noRatingText_large: {
    fontSize: 14,
  },
});