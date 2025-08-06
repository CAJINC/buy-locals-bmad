import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { CustomMarkerProps } from './types';
import { MapUtils } from './utils';

interface MarkerCalloutProps {
  business: CustomMarkerProps['business'];
  onPress: () => void;
}

const MarkerCallout: React.FC<MarkerCalloutProps> = ({ business, onPress }) => (
  <TouchableOpacity style={styles.calloutContainer} onPress={onPress}>
    <View style={styles.calloutContent}>
      <Text style={styles.calloutTitle} numberOfLines={1}>
        {business.name}
      </Text>
      <Text style={styles.calloutSubtitle} numberOfLines={1}>
        {business.category}
      </Text>
      {business.rating && (
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>
            ⭐ {MapUtils.formatRating(business.rating)}
          </Text>
          {business.reviewCount && (
            <Text style={styles.reviewCount}>
              ({business.reviewCount})
            </Text>
          )}
        </View>
      )}
      {business.distance && (
        <Text style={styles.distanceText}>
          {MapUtils.formatDistance(business.distance)}
        </Text>
      )}
    </View>
    <View style={styles.calloutArrow} />
  </TouchableOpacity>
);

interface CustomMarkerViewProps {
  business: CustomMarkerProps['business'];
  selected: boolean;
  size: 'small' | 'medium' | 'large';
}

const CustomMarkerView: React.FC<CustomMarkerViewProps> = ({ 
  business, 
  selected, 
  size 
}) => {
  const categoryColor = MapUtils.getCategoryColor(business.category);
  const categoryIcon = MapUtils.getCategoryIcon(business.category);
  
  const markerStyle = [
    styles.markerContainer,
    styles[`marker${size.charAt(0).toUpperCase() + size.slice(1)}`],
    { backgroundColor: categoryColor },
    selected && styles.markerSelected,
  ];

  return (
    <View style={styles.markerWrapper}>
      <View style={markerStyle}>
        <Text style={styles.markerIcon}>{categoryIcon}</Text>
        {business.verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedIcon}>✓</Text>
          </View>
        )}
      </View>
      <View style={[styles.markerPin, { borderTopColor: categoryColor }]} />
    </View>
  );
};

export const BusinessMarker: React.FC<CustomMarkerProps> = ({
  business,
  onPress,
  selected = false,
  size = 'medium',
}) => {
  const handlePress = () => {
    onPress(business);
  };

  return (
    <Marker
      coordinate={{
        latitude: business.coordinates.latitude,
        longitude: business.coordinates.longitude,
      }}
      onPress={handlePress}
      identifier={business.id}
      tracksViewChanges={false} // Optimize performance
    >
      <CustomMarkerView 
        business={business}
        selected={selected}
        size={size}
      />
      <MarkerCallout 
        business={business}
        onPress={handlePress}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: 'center',
  },
  markerContainer: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  markerSmall: {
    width: 24,
    height: 24,
  },
  markerMedium: {
    width: 32,
    height: 32,
  },
  markerLarge: {
    width: 40,
    height: 40,
  },
  markerSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  markerIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  markerPin: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#00C851',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  verifiedIcon: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    maxWidth: 250,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutContent: {
    alignItems: 'flex-start',
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  calloutArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});

export default BusinessMarker;