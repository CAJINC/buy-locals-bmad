import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessDistanceDisplayProps } from './types';

export const BusinessDistanceDisplay: React.FC<BusinessDistanceDisplayProps> = ({
  distance,
  estimatedTravelTime,
  size = 'medium',
  testID = 'business-distance-display'
}) => {
  const formatDistance = (distanceInKm: number): string => {
    if (distanceInKm < 1) {
      return `${Math.round(distanceInKm * 1000)}m`;
    }
    return `${distanceInKm.toFixed(1)}km`;
  };

  const formatTravelTime = (timeInMinutes: number): string => {
    if (timeInMinutes < 60) {
      return `${Math.round(timeInMinutes)}min`;
    }
    const hours = Math.floor(timeInMinutes / 60);
    const minutes = Math.round(timeInMinutes % 60);
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  };

  return (
    <View style={[styles.container, styles[size]]} testID={testID}>
      <Icon
        name="near-me"
        size={styles[`icon_${size}`].fontSize}
        color="#666"
      />
      <Text style={[styles.distanceText, styles[`distanceText_${size}`]]}>
        {formatDistance(distance)}
      </Text>
      {estimatedTravelTime && (
        <Text style={[styles.travelTimeText, styles[`travelTimeText_${size}`]]}>
          • {formatTravelTime(estimatedTravelTime)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
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
  icon_small: {
    fontSize: 12,
  },
  icon_medium: {
    fontSize: 14,
  },
  icon_large: {
    fontSize: 16,
  },
  distanceText: {
    color: '#666',
    fontWeight: '500',
  },
  distanceText_small: {
    fontSize: 11,
  },
  distanceText_medium: {
    fontSize: 12,
  },
  distanceText_large: {
    fontSize: 14,
  },
  travelTimeText: {
    color: '#888',
    fontWeight: '400',
  },
  travelTimeText_small: {
    fontSize: 10,
  },
  travelTimeText_medium: {
    fontSize: 11,
  },
  travelTimeText_large: {
    fontSize: 12,
  },
});