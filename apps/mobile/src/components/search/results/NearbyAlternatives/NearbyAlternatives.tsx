import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NearbyAlternativesProps, SearchResultItem } from '../types';
import { LocationCoordinates } from '../../../../services/locationService';
import { formatDistance } from '../utils/searchResultUtils';

export const NearbyAlternatives: React.FC<NearbyAlternativesProps> = ({
  currentLocation,
  searchQuery,
  onAlternativePress,
  testID = 'nearby-alternatives'
}) => {
  const [alternatives, setAlternatives] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch nearby alternatives
  const fetchNearbyAlternatives = useCallback(async () => {
    if (!currentLocation) return;

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call for nearby alternatives
      // In a real app, this would call your location search service
      const mockAlternatives: SearchResultItem[] = [
        {
          id: 'alt-1',
          name: 'Popular Café Nearby',
          category: 'restaurant',
          coordinates: {
            latitude: currentLocation.latitude + 0.002,
            longitude: currentLocation.longitude + 0.002
          },
          address: '123 Main St, Downtown',
          rating: 4.3,
          review_count: 156,
          price_range: '$$',
          phone: '(555) 123-4567',
          website: 'https://popularcafe.com',
          photos: [],
          hours: {},
          tags: ['cafe', 'coffee', 'breakfast'],
          description: 'Cozy neighborhood café with excellent coffee and pastries',
          distance: 0.2,
          isCurrentlyOpen: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'alt-2',
          name: 'Local Bookstore',
          category: 'retail',
          coordinates: {
            latitude: currentLocation.latitude - 0.001,
            longitude: currentLocation.longitude + 0.003
          },
          address: '456 Oak Avenue',
          rating: 4.6,
          review_count: 89,
          price_range: '$',
          phone: '(555) 987-6543',
          website: 'https://localbookstore.com',
          photos: [],
          hours: {},
          tags: ['books', 'coffee', 'events'],
          description: 'Independent bookstore with rare finds and community events',
          distance: 0.3,
          isCurrentlyOpen: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'alt-3',
          name: 'Artisan Pizza',
          category: 'restaurant',
          coordinates: {
            latitude: currentLocation.latitude + 0.001,
            longitude: currentLocation.longitude - 0.002
          },
          address: '789 Pine Street',
          rating: 4.8,
          review_count: 234,
          price_range: '$$$',
          phone: '(555) 456-7890',
          website: 'https://artisanpizza.com',
          photos: [],
          hours: {},
          tags: ['pizza', 'italian', 'dinner'],
          description: 'Wood-fired pizza with locally sourced ingredients',
          distance: 0.25,
          isCurrentlyOpen: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAlternatives(mockAlternatives);
    } catch (err) {
      setError('Failed to load nearby alternatives');
      console.error('Error fetching alternatives:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation]);

  // Load alternatives on mount
  useEffect(() => {
    fetchNearbyAlternatives();
  }, [fetchNearbyAlternatives]);

  // Handle alternative press
  const handleAlternativePress = useCallback((alternative: SearchResultItem) => {
    onAlternativePress(alternative);
  }, [onAlternativePress]);

  // Handle retry
  const handleRetry = useCallback(() => {
    fetchNearbyAlternatives();
  }, [fetchNearbyAlternatives]);

  // Render alternative item
  const renderAlternativeItem = useCallback(({ item, index }: any) => (
    <TouchableOpacity
      style={styles.alternativeItem}
      onPress={() => handleAlternativePress(item)}
      activeOpacity={0.7}
      testID={`${testID}-item-${index}`}
    >
      <View style={styles.alternativeContent}>
        {/* Business Icon */}
        <View style={styles.businessIcon}>
          <Ionicons 
            name={item.category === 'restaurant' ? 'restaurant' : 'storefront'} 
            size={24} 
            color="#007AFF" 
          />
        </View>

        {/* Business Info */}
        <View style={styles.businessInfo}>
          <Text style={styles.businessName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.businessCategory}>
            {item.category}
          </Text>
          <View style={styles.metaInfo}>
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>
                {item.rating?.toFixed(1)}
              </Text>
            </View>
            
            {/* Distance */}
            <Text style={styles.distanceText}>
              • {formatDistance(item.distance)}
            </Text>

            {/* Status */}
            <View style={[
              styles.statusIndicator,
              item.isCurrentlyOpen ? styles.openIndicator : styles.closedIndicator
            ]}>
              <Text style={[
                styles.statusText,
                { color: item.isCurrentlyOpen ? '#34C759' : '#FF3B30' }
              ]}>
                {item.isCurrentlyOpen ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>
        </View>

        {/* Arrow */}
        <Ionicons 
          name="chevron-forward" 
          size={16} 
          color="#C7C7CC" 
        />
      </View>
    </TouchableOpacity>
  ), [handleAlternativePress, testID]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.title}>
          Finding nearby alternatives...
        </Text>
        <ActivityIndicator 
          size="large" 
          color="#007AFF" 
          style={styles.loadingIndicator}
        />
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.title}>
          Nearby Alternatives
        </Text>
        <Text style={styles.errorText}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          activeOpacity={0.7}
          testID={`${testID}-retry`}
        >
          <Ionicons name="refresh" size={16} color="#007AFF" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Don't render if no alternatives
  if (alternatives.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Ionicons name="compass" size={20} color="#007AFF" />
        <Text style={styles.title}>
          Nearby Alternatives
        </Text>
      </View>
      
      <Text style={styles.subtitle}>
        Popular businesses in your area
      </Text>

      <FlatList
        data={alternatives}
        renderItem={renderAlternativeItem}
        keyExtractor={item => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        testID={`${testID}-list`}
      />

      <TouchableOpacity
        style={styles.viewMoreButton}
        onPress={() => {
          // Handle view more alternatives
        }}
        activeOpacity={0.7}
        testID={`${testID}-view-more`}
      >
        <Text style={styles.viewMoreText}>
          View More Nearby Businesses
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    padding: 20,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  retryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  alternativeItem: {
    marginBottom: 16,
  },
  alternativeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#8E8E93',
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '500',
    marginLeft: 2,
  },
  distanceText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  statusIndicator: {
    marginLeft: 8,
  },
  openIndicator: {},
  closedIndicator: {},
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E8FF',
    marginTop: 8,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 8,
  },
});