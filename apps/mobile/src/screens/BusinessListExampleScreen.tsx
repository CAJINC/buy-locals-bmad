import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { BusinessListView } from '../components/discovery/BusinessListView';
import { useLocationSearchStore } from '../stores/locationSearchStore';
import { BusinessWithDistance } from '../components/discovery/BusinessListView/types';

interface BusinessListExampleScreenProps {
  navigation: any;
}

export const BusinessListExampleScreen: React.FC<BusinessListExampleScreenProps> = ({ 
  navigation 
}) => {
  const {
    // State
    searchResults,
    currentLocation,
    searchLoading,
    searchError,
    filters,
    hasNextPage,
    locationPermissionGranted,
    
    // Actions
    requestLocationPermission,
    getCurrentLocation,
    searchNearbyBusinesses,
    loadMoreResults,
    updateFilters,
    clearSearch,
  } = useLocationSearchStore();

  // Initialize location and search on mount
  useEffect(() => {
    initializeLocationAndSearch();
  }, []);

  const initializeLocationAndSearch = async () => {
    try {
      // Request location permission if not granted
      if (!locationPermissionGranted) {
        const permissionGranted = await requestLocationPermission();
        if (!permissionGranted) {
          Alert.alert(
            'Location Required',
            'This app needs location access to find nearby businesses. Please enable location permissions in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => {
                // In a real app, you'd open device settings
                console.log('Open device settings');
              }}
            ]
          );
          return;
        }
      }

      // Get current location
      await getCurrentLocation();

      // Search for nearby businesses
      await searchNearbyBusinesses();
    } catch (error) {
      console.error('Failed to initialize location and search:', error);
      Alert.alert(
        'Error',
        'Failed to get your location. Please check your location settings and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle business item press
  const handleBusinessPress = useCallback((business: BusinessWithDistance) => {
    console.log('Business pressed:', business.name);
    
    // Navigate to business profile (example)
    navigation.navigate('BusinessProfile', { 
      businessId: business.id,
      business 
    });
  }, [navigation]);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    try {
      await getCurrentLocation();
      await searchNearbyBusinesses();
    } catch (error) {
      console.error('Refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh results. Please try again.');
    }
  }, [getCurrentLocation, searchNearbyBusinesses]);

  // Handle load more results
  const handleLoadMore = useCallback(async () => {
    if (hasNextPage && !searchLoading) {
      try {
        await loadMoreResults();
      } catch (error) {
        console.error('Load more failed:', error);
        Alert.alert('Error', 'Failed to load more results. Please try again.');
      }
    }
  }, [hasNextPage, searchLoading, loadMoreResults]);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: 'distance' | 'rating' | 'name' | 'newest') => {
    updateFilters({ sortBy });
  }, [updateFilters]);

  // Handle retry from empty state
  const handleRetry = useCallback(() => {
    initializeLocationAndSearch();
  }, []);

  // Convert search results to BusinessWithDistance format
  const businessesWithDistance: BusinessWithDistance[] = searchResults.map(result => ({
    id: result.id,
    owner_id: '', // Not available in search results
    name: result.name,
    description: result.description,
    location: result.location,
    categories: result.categories,
    hours: result.hours,
    contact: result.contact,
    media: result.media,
    services: result.services,
    is_active: true, // Assume active from search results
    rating: undefined, // Not available in current search results
    reviewCount: undefined,
    isVerified: undefined,
    verificationLevel: undefined,
    verificationDate: undefined,
    created_at: new Date(), // Placeholder
    updated_at: new Date(), // Placeholder
    distance: result.distance,
    bearing: result.bearing,
    estimatedTravelTime: result.estimatedTravelTime,
    isCurrentlyOpen: result.isCurrentlyOpen,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <BusinessListView
        businesses={businessesWithDistance}
        currentLocation={currentLocation}
        loading={searchLoading}
        refreshing={searchLoading}
        hasNextPage={hasNextPage}
        sortBy={filters.sortBy}
        onBusinessPress={handleBusinessPress}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onSortChange={handleSortChange}
        emptyStateMessage="No businesses found nearby"
        emptyStateSubtitle="Try expanding your search radius or adjusting your location settings."
        emptyStateAction={handleRetry}
        emptyStateActionLabel="Try Again"
        showSortOptions={true}
        showDistance={true}
        showRating={true}
        testID="business-list-example-screen"
      />
      
      {searchError && (
        <View style={styles.errorContainer}>
          {/* Error handling UI could go here */}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB3B3',
  },
});