import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessListItemProps } from './types';
import { BusinessRatingDisplay } from './BusinessRatingDisplay';
import { BusinessDistanceDisplay } from './BusinessDistanceDisplay';
import { BusinessHoursIndicator } from './BusinessHoursIndicator';

const BusinessListItemComponent: React.FC<BusinessListItemProps> = ({
  business,
  currentLocation,
  onPress,
  showDistance = true,
  showRating = true,
  testID = 'business-list-item'
}) => {
  const handlePress = () => {
    onPress(business);
  };

  const getBusinessImage = () => {
    const logoMedia = business.media?.find(media => media.type === 'logo');
    const photoMedia = business.media?.find(media => media.type === 'photo');
    return logoMedia?.url || photoMedia?.url || null;
  };

  const getBusinessCategory = () => {
    return business.categories?.length > 0 ? business.categories[0] : 'Business';
  };

  const formatDescription = (description?: string) => {
    if (!description) return 'No description available';
    return description.length > 100 ? `${description.substring(0, 100)}...` : description;
  };

  const isVerified = business.isVerified;
  const businessImage = getBusinessImage();
  const primaryCategory = getBusinessCategory();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      testID={testID}
      activeOpacity={0.7}
    >
      {/* Business Image */}
      <View style={styles.imageContainer}>
        {businessImage ? (
          <Image
            source={{ uri: businessImage }}
            style={styles.businessImage}
            testID={`${testID}-image`}
          />
        ) : (
          <View style={[styles.businessImage, styles.placeholderImage]}>
            <Icon name="business" size={32} color="#999" />
          </View>
        )}
        
        {/* Verified Badge */}
        {isVerified && (
          <View style={styles.verifiedBadge} testID={`${testID}-verified-badge`}>
            <Icon name="verified" size={16} color="#007AFF" />
          </View>
        )}
      </View>

      {/* Business Content */}
      <View style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text 
            style={styles.businessName}
            numberOfLines={1}
            testID={`${testID}-name`}
          >
            {business.name}
          </Text>
          
          {showDistance && (
            <BusinessDistanceDisplay
              distance={business.distance}
              estimatedTravelTime={business.estimatedTravelTime}
              size="small"
              testID={`${testID}-distance`}
            />
          )}
        </View>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          {showRating && (
            <BusinessRatingDisplay
              rating={business.rating}
              reviewCount={business.reviewCount}
              size="small"
              showCount={true}
              testID={`${testID}-rating`}
            />
          )}
          
          <View style={styles.categoryContainer}>
            <Icon name="category" size={14} color="#666" />
            <Text style={styles.categoryText} testID={`${testID}-category`}>
              {primaryCategory}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text 
          style={styles.description}
          numberOfLines={2}
          testID={`${testID}-description`}
        >
          {formatDescription(business.description)}
        </Text>

        {/* Footer Row */}
        <View style={styles.footerRow}>
          <BusinessHoursIndicator
            hours={business.hours}
            isOpen={business.isCurrentlyOpen}
            status={business.status}
            nextChange={business.nextChange}
            timezone={business.timezone}
            size="small"
            showText={true}
            showNextChange={true}
            testID={`${testID}-hours`}
          />

          {business.contact?.phone && (
            <View style={styles.contactInfo}>
              <Icon name="phone" size={14} color="#666" />
              <Text style={styles.contactText} testID={`${testID}-phone`}>
                {business.contact.phone}
              </Text>
            </View>
          )}
        </View>

        {/* Address */}
        <View style={styles.addressRow}>
          <Icon name="location-on" size={14} color="#666" />
          <Text 
            style={styles.addressText}
            numberOfLines={1}
            testID={`${testID}-address`}
          >
            {business.location.address}, {business.location.city}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <View style={styles.chevronContainer}>
        <Icon name="chevron-right" size={24} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const BusinessListItem = memo(BusinessListItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  businessImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
});