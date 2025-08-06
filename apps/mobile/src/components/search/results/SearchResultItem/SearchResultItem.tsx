import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchResultItemProps } from '../types';
import { ResultActions } from '../ResultActions/ResultActions';
import { 
  formatDistance, 
  formatRating, 
  isBusinessOpen 
} from '../utils/searchResultUtils';
import { HIGHLIGHT_COLORS } from '../constants';

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  currentLocation,
  searchQuery,
  onPress,
  onBookmark,
  onShare,
  onGetDirections,
  isBookmarked = false,
  showDistance = true,
  showRating = true,
  showHighlights = true,
  testID = 'search-result-item'
}) => {
  // Calculate if business is currently open
  const currentlyOpen = useMemo(() => {
    return isBusinessOpen(result.hours);
  }, [result.hours]);

  // Handle main press
  const handlePress = useCallback(() => {
    onPress(result);
  }, [onPress, result]);

  // Render highlighted text
  const renderHighlightedText = useCallback((
    text: string,
    highlights: string[] = [],
    style: any
  ) => {
    if (!showHighlights || !searchQuery || highlights.length === 0) {
      return <Text style={style}>{text}</Text>;
    }

    const parts = [];
    let lastIndex = 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();

    // Find all matches
    const regex = new RegExp(`(${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`text-${lastIndex}`} style={style}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      // Add highlighted match
      parts.push(
        <Text 
          key={`highlight-${match.index}`}
          style={[style, styles.highlightedText]}
        >
          {match[0]}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`text-${lastIndex}`} style={style}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return <Text>{parts}</Text>;
  }, [showHighlights, searchQuery]);

  // Render rating stars
  const renderRating = useCallback(() => {
    if (!showRating || !result.rating) return null;

    const stars = [];
    const fullStars = Math.floor(result.rating);
    const hasHalfStar = result.rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Ionicons 
          key={`star-${i}`}
          name="star" 
          size={12} 
          color="#FFD700" 
        />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <Ionicons 
          key="half-star"
          name="star-half" 
          size={12} 
          color="#FFD700" 
        />
      );
    }

    const emptyStars = 5 - Math.ceil(result.rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons 
          key={`empty-${i}`}
          name="star-outline" 
          size={12} 
          color="#C7C7CC" 
        />
      );
    }

    return (
      <View style={styles.ratingContainer}>
        <View style={styles.starsContainer}>
          {stars}
        </View>
        <Text style={styles.ratingText}>
          {result.rating.toFixed(1)}
        </Text>
        {result.review_count && (
          <Text style={styles.reviewCount}>
            ({result.review_count})
          </Text>
        )}
      </View>
    );
  }, [showRating, result.rating, result.review_count]);

  // Render distance badge
  const renderDistance = useCallback(() => {
    if (!showDistance) return null;

    return (
      <View style={styles.distanceBadge}>
        <Ionicons name="location-outline" size={12} color="#007AFF" />
        <Text style={styles.distanceText}>
          {formatDistance(result.distance)}
        </Text>
        {result.estimatedTravelTime && (
          <Text style={styles.travelTime}>
            • {Math.round(result.estimatedTravelTime)}min
          </Text>
        )}
      </View>
    );
  }, [showDistance, result.distance, result.estimatedTravelTime]);

  // Render business hours indicator
  const renderHoursIndicator = useCallback(() => {
    return (
      <View style={[
        styles.hoursIndicator,
        currentlyOpen ? styles.openIndicator : styles.closedIndicator
      ]}>
        <View style={[
          styles.statusDot,
          { backgroundColor: currentlyOpen ? '#34C759' : '#FF3B30' }
        ]} />
        <Text style={[
          styles.hoursText,
          { color: currentlyOpen ? '#34C759' : '#FF3B30' }
        ]}>
          {currentlyOpen ? 'Open' : 'Closed'}
        </Text>
      </View>
    );
  }, [currentlyOpen]);

  // Render price range
  const renderPriceRange = useCallback(() => {
    if (!result.price_range) return null;

    return (
      <Text style={styles.priceRange}>
        {result.price_range}
      </Text>
    );
  }, [result.price_range]);

  // Render category tags
  const renderCategory = useCallback(() => {
    if (!result.category) return null;

    return (
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {result.category}
        </Text>
      </View>
    );
  }, [result.category]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={testID}
    >
      {/* Business Image */}
      <View style={styles.imageContainer}>
        {result.photos && result.photos.length > 0 ? (
          <Image
            source={{ uri: result.photos[0] }}
            style={styles.businessImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="business" size={24} color="#8E8E93" />
          </View>
        )}
      </View>

      {/* Business Info */}
      <View style={styles.infoContainer}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.nameContainer}>
            {renderHighlightedText(
              result.name,
              result.searchMatchHighlights?.name,
              styles.businessName
            )}
            {renderCategory()}
          </View>
          {renderDistance()}
        </View>

        {/* Rating and Hours */}
        <View style={styles.metaRow}>
          {renderRating()}
          {renderHoursIndicator()}
          {renderPriceRange()}
        </View>

        {/* Address */}
        {result.address && (
          <Text style={styles.address} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} color="#8E8E93" />
            {' '}{result.address}
          </Text>
        )}

        {/* Description with highlights */}
        {result.description && (
          <Text style={styles.description} numberOfLines={2}>
            {renderHighlightedText(
              result.description,
              result.searchMatchHighlights?.description,
              { color: '#8E8E93', fontSize: 14 }
            )}
          </Text>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <ResultActions
            result={result}
            onBookmark={onBookmark}
            onShare={onShare}
            onGetDirections={onGetDirections}
            isBookmarked={isBookmarked}
            testID={`${testID}-actions`}
          />
        </View>
      </View>

      {/* Bookmark Indicator */}
      {isBookmarked && (
        <View style={styles.bookmarkIndicator}>
          <Ionicons name="bookmark" size={16} color="#007AFF" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 16,
  },
  businessImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  highlightedText: {
    backgroundColor: HIGHLIGHT_COLORS.background,
    color: HIGHLIGHT_COLORS.primary,
    fontWeight: '600',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  categoryText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 2,
  },
  travelTime: {
    fontSize: 12,
    color: '#007AFF',
    opacity: 0.7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  hoursIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  openIndicator: {},
  closedIndicator: {},
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  hoursText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceRange: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionsContainer: {
    marginTop: 'auto',
  },
  bookmarkIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});