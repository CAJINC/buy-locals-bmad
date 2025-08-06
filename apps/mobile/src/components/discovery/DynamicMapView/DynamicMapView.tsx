import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import MapView from 'react-native-maps';
import { locationService, LocationCoordinates } from '../../../services/locationService';
import { dynamicSearchService, SearchUpdateNotification } from '../../../services/dynamicSearchService';
import { searchHistoryService } from '../../../services/searchHistoryService';
import { SearchNotificationSystem } from '../SearchNotifications';
import { BusinessMarker } from '../MapView/BusinessMarker';
import { ClusterMarker } from '../MapView/ClusterMarker';
import { BusinessSummary } from '../MapView/BusinessSummary';
import { MapControls } from '../MapView/MapControls';
import { LoadingState, ErrorState } from '../MapView/MapLoadingState';
import { MapUtils } from '../MapView/utils';
import {
  MapViewProps,
  Business,
  MapRegion,
  MarkerCluster,
  MapType,
  MapLoadingState,
  MapErrorState,
} from '../MapView/types';

const DEFAULT_REGION: MapRegion = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export interface DynamicMapViewProps extends Omit<MapViewProps, 'onRegionChange'> {
  onDynamicSearchResults?: (results: any) => void;
  enableDynamicSearch?: boolean;
  searchNotificationsEnabled?: boolean;
  contextPreservationEnabled?: boolean;
  bandwidthOptimization?: boolean;
  onSearchStateChange?: (state: 'idle' | 'searching' | 'completed' | 'error') => void;
  searchQuery?: string;
  searchFilters?: any;
}

/**
 * Enhanced MapView with dynamic search capabilities, real-time updates,
 * bandwidth-conscious strategies, and comprehensive context preservation
 */
export const DynamicMapView: React.FC<DynamicMapViewProps> = ({
  businesses = [],
  initialRegion,
  onBusinessSelect,
  showUserLocation = true,
  enableClustering = true,
  clusteringRadius = 50,
  searchRadius = 10,
  loading = false,
  error = null,
  onRetry,
  customMapStyle,
  showTrafficLayer = false,
  followUserLocation = false,
  minZoomLevel = 3,
  maxZoomLevel = 20,
  onLocationPress,
  onMapReady,
  onDynamicSearchResults,
  enableDynamicSearch = true,
  searchNotificationsEnabled = true,
  contextPreservationEnabled = true,
  bandwidthOptimization = true,
  onSearchStateChange,
  searchQuery,
  searchFilters,
  testID,
}) => {
  // Refs
  const mapRef = useRef<MapView>(null);
  const lastSearchId = useRef<string | null>(null);
  const contextSnapshotTimer = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // State
  const [currentRegion, setCurrentRegion] = useState<MapRegion>(
    initialRegion || DEFAULT_REGION
  );
  const [mapType, setMapType] = useState<MapType>('standard');
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [dynamicBusinesses, setDynamicBusinesses] = useState<Business[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'completed' | 'error'>('idle');
  
  const [loadingState, setLoadingState] = useState<MapLoadingState>({
    isLoading: loading,
    loadingText: 'Loading map...',
  });
  const [errorState, setErrorState] = useState<MapErrorState>({
    hasError: !!error,
    errorMessage: error || undefined,
    canRetry: !!onRetry,
  });
  
  const [locationLoading, setLocationLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastNotification, setLastNotification] = useState<SearchUpdateNotification | null>(null);

  // Combine static and dynamic businesses
  const allBusinesses = useMemo(() => {
    if (enableDynamicSearch) {
      // Merge and deduplicate businesses
      const businessMap = new Map();
      
      // Add static businesses
      businesses.forEach(business => {
        businessMap.set(business.id, business);
      });
      
      // Add dynamic businesses (override static ones)
      dynamicBusinesses.forEach(business => {
        businessMap.set(business.id, business);
      });
      
      return Array.from(businessMap.values());
    }
    return businesses;
  }, [businesses, dynamicBusinesses, enableDynamicSearch]);

  // Memoized clusters with all businesses
  const clusters = useMemo(() => {
    if (!enableClustering || !isMapReady) return [];
    
    return MapUtils.clusterBusinesses(allBusinesses, currentRegion, {
      radius: clusteringRadius,
    });
  }, [allBusinesses, currentRegion, enableClustering, clusteringRadius, isMapReady]);

  // Individual markers (businesses not in clusters)
  const individualMarkers = useMemo(() => {
    if (!enableClustering || clusters.length === 0) return allBusinesses;
    
    const clusteredBusinessIds = new Set(
      clusters.flatMap(cluster => cluster.businesses.map(b => b.id))
    );
    
    return allBusinesses.filter(business => !clusteredBusinessIds.has(business.id));
  }, [allBusinesses, clusters, enableClustering]);

  // Initialize services and subscriptions
  useEffect(() => {
    if (!enableDynamicSearch) return;

    const initializeDynamicSearch = async () => {
      try {
        // Subscribe to search notifications
        const handleSearchNotification = (notification: SearchUpdateNotification) => {
          setLastNotification(notification);
          handleSearchStateUpdate(notification);
        };

        dynamicSearchService.on('search_notification', handleSearchNotification);

        // Subscribe to app state changes for context preservation
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
          const prevState = appState.current;
          appState.current = nextAppState;
          
          if (contextPreservationEnabled) {
            handleAppStateTransition(prevState, nextAppState);
          }
        };

        AppState.addEventListener('change', handleAppStateChange);

        // Start context snapshots
        if (contextPreservationEnabled) {
          startContextSnapshots();
        }

        return () => {
          dynamicSearchService.off('search_notification', handleSearchNotification);
          AppState.removeEventListener('change', handleAppStateChange);
          stopContextSnapshots();
        };
      } catch (error) {
        console.error('Failed to initialize dynamic search:', error);
      }
    };

    initializeDynamicSearch();
  }, [enableDynamicSearch, contextPreservationEnabled]);

  // Initialize user location
  useEffect(() => {
    const initializeLocation = async () => {
      if (!showUserLocation) return;

      try {
        setLocationLoading(true);
        const location = await locationService.getCurrentLocation();
        setUserLocation(location);

        // Set initial region to user location if not provided
        if (!initialRegion) {
          const newRegion = MapUtils.createInitialRegion(location, searchRadius);
          setCurrentRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
        }

        // Trigger initial search if dynamic search is enabled
        if (enableDynamicSearch && isMapReady) {
          await triggerDynamicSearch(newRegion || currentRegion, location);
        }
      } catch (locationError) {
        console.warn('Failed to get initial location:', locationError);
        setErrorState({
          hasError: true,
          errorMessage: 'Unable to get your current location',
          errorType: 'location',
          canRetry: true,
        });
      } finally {
        setLocationLoading(false);
      }
    };

    initializeLocation();
  }, [showUserLocation, initialRegion, searchRadius, enableDynamicSearch, isMapReady]);

  // Subscribe to location updates
  useEffect(() => {
    if (!showUserLocation || !followUserLocation) return;

    const unsubscribe = locationService.subscribeToLocationUpdates((location) => {
      setUserLocation(location);
      
      // Update search context with new location
      if (enableDynamicSearch && contextPreservationEnabled) {
        updateSearchContext({ currentLocation: location });
      }
    });

    locationService.startLocationWatch(true);

    return () => {
      unsubscribe();
      locationService.stopLocationWatch();
    };
  }, [showUserLocation, followUserLocation, enableDynamicSearch, contextPreservationEnabled]);

  // Update loading state
  useEffect(() => {
    setLoadingState({
      isLoading: loading,
      loadingText: 'Loading map...',
    });
  }, [loading]);

  // Update error state
  useEffect(() => {
    setErrorState({
      hasError: !!error,
      errorMessage: error || undefined,
      canRetry: !!onRetry,
    });
  }, [error, onRetry]);

  // Notify parent of search state changes
  useEffect(() => {
    onSearchStateChange?.(searchState);
  }, [searchState, onSearchStateChange]);

  /**
   * Handle map ready
   */
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    setLoadingState({ isLoading: false });
    onMapReady?.();
  }, [onMapReady]);

  /**
   * Handle region change with dynamic search integration
   */
  const handleRegionChange = useCallback(
    async (region: MapRegion) => {
      setCurrentRegion(region);
      
      if (enableDynamicSearch) {
        // Let dynamic search service handle the region change
        await dynamicSearchService.handleRegionChange(
          {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
            timestamp: Date.now()
          },
          'user_pan'
        );
      }

      // Save context snapshot
      if (contextPreservationEnabled) {
        await saveContextSnapshot(region);
      }
    },
    [enableDynamicSearch, contextPreservationEnabled]
  );

  /**
   * Trigger dynamic search manually
   */
  const triggerDynamicSearch = useCallback(
    async (region: MapRegion, location?: LocationCoordinates) => {
      if (!enableDynamicSearch) return;

      try {
        setSearchState('searching');
        
        const searchLocation = location || userLocation || {
          latitude: region.latitude,
          longitude: region.longitude,
          accuracy: 1000,
          timestamp: Date.now()
        };

        const result = await dynamicSearchService.performDynamicSearch({
          query: searchQuery,
          radius: searchRadius,
          location: searchLocation,
          region: {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });

        // Update businesses with search results
        setDynamicBusinesses(result.businesses || []);
        setSearchState('completed');

        // Add to search history
        if (contextPreservationEnabled) {
          await searchHistoryService.addSearchEntry(
            searchQuery,
            searchLocation,
            region,
            result,
            {
              networkType: result.networkCondition,
              appState: 'foreground'
            }
          );
        }

        // Notify parent component
        onDynamicSearchResults?.(result);

        lastSearchId.current = result.id;

      } catch (error) {
        console.error('Dynamic search failed:', error);
        setSearchState('error');
        
        // Show error notification
        Alert.alert(
          'Search Error',
          'Unable to search for businesses. Please check your connection and try again.',
          [
            { text: 'Retry', onPress: () => triggerDynamicSearch(region, location) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    },
    [enableDynamicSearch, searchQuery, searchRadius, userLocation, onDynamicSearchResults, contextPreservationEnabled]
  );

  /**
   * Handle search state updates from notifications
   */
  const handleSearchStateUpdate = useCallback((notification: SearchUpdateNotification) => {
    switch (notification.type) {
      case 'search_started':
        setSearchState('searching');
        break;
      case 'search_completed':
        setSearchState('completed');
        break;
      case 'search_failed':
        setSearchState('error');
        break;
      case 'results_invalidated':
        // Trigger fresh search
        triggerDynamicSearch(currentRegion);
        break;
    }
  }, [currentRegion, triggerDynamicSearch]);

  /**
   * Handle business selection with history tracking
   */
  const handleBusinessSelect = useCallback(
    async (business: Business) => {
      setSelectedBusiness(business);
      onBusinessSelect?.(business);

      // Update user interaction in search history
      if (contextPreservationEnabled && lastSearchId.current) {
        await searchHistoryService.updateUserInteraction(lastSearchId.current, {
          businessesViewed: [business.id],
          businessesInteracted: [business.id]
        });
      }
    },
    [onBusinessSelect, contextPreservationEnabled]
  );

  /**
   * Handle cluster press
   */
  const handleClusterPress = useCallback((cluster: MarkerCluster) => {
    if (!mapRef.current) return;

    // Calculate region to fit all businesses in cluster
    const coordinates = cluster.businesses.map(b => b.coordinates);
    const region = MapUtils.getBoundsFromCoordinates(coordinates, 0.2);
    
    if (region) {
      mapRef.current.animateToRegion(region, 1000);
    }
  }, []);

  /**
   * Handle user location press with dynamic search
   */
  const handleLocationPress = useCallback(async () => {
    if (onLocationPress) {
      onLocationPress();
      return;
    }

    try {
      setLocationLoading(true);
      const location = await locationService.getCurrentLocation();
      setUserLocation(location);

      const region = MapUtils.createInitialRegion(location, 2); // 2km radius
      mapRef.current?.animateToRegion(region, 1000);

      // Trigger search at new location
      if (enableDynamicSearch) {
        await triggerDynamicSearch(region, location);
      }
    } catch (locationError) {
      console.warn('Failed to get current location:', locationError);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please check your location settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocationLoading(false);
    }
  }, [onLocationPress, enableDynamicSearch, triggerDynamicSearch]);

  /**
   * Handle map type toggle
   */
  const handleToggleMapType = useCallback(() => {
    const mapTypes: MapType[] = ['standard', 'satellite', 'hybrid'];
    const currentIndex = mapTypes.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    setMapType(mapTypes[nextIndex]);
  }, [mapType]);

  /**
   * Handle retry
   */
  const handleRetry = useCallback(() => {
    setErrorState({ hasError: false, canRetry: false });
    setLoadingState({ isLoading: true, loadingText: 'Retrying...' });
    
    if (enableDynamicSearch) {
      triggerDynamicSearch(currentRegion);
    }
    
    onRetry?.();
  }, [onRetry, enableDynamicSearch, triggerDynamicSearch, currentRegion]);

  /**
   * Handle search notification actions
   */
  const handleNotificationAction = useCallback(
    async (action: string, notification: SearchUpdateNotification) => {
      switch (action) {
        case 'retry':
          await triggerDynamicSearch(currentRegion);
          break;
        case 'disable_updates':
          await dynamicSearchService.updateUserPreferences({ autoSearchEnabled: false });
          Alert.alert(
            'Auto-Search Disabled',
            'Dynamic search updates have been disabled. You can re-enable them in settings.',
            [{ text: 'OK' }]
          );
          break;
        case 'show_cached':
          // Show cached results (already handled by dynamic search service)
          break;
      }
    },
    [currentRegion, triggerDynamicSearch]
  );

  /**
   * Start context snapshots for preservation
   */
  const startContextSnapshots = useCallback(() => {
    if (contextSnapshotTimer.current) {
      clearInterval(contextSnapshotTimer.current);
    }

    contextSnapshotTimer.current = setInterval(() => {
      saveContextSnapshot(currentRegion);
    }, 30000); // Every 30 seconds
  }, [currentRegion]);

  /**
   * Stop context snapshots
   */
  const stopContextSnapshots = useCallback(() => {
    if (contextSnapshotTimer.current) {
      clearInterval(contextSnapshotTimer.current);
      contextSnapshotTimer.current = null;
    }
  }, []);

  /**
   * Save context snapshot
   */
  const saveContextSnapshot = useCallback(
    async (region: MapRegion) => {
      if (!contextPreservationEnabled) return;

      try {
        const snapshot = searchHistoryService.createContextSnapshot(
          userLocation || {
            latitude: region.latitude,
            longitude: region.longitude,
            accuracy: 1000,
            timestamp: Date.now()
          },
          {
            activeQuery: searchQuery,
            activeFilters: searchFilters,
            currentRegion: region,
            resultCount: allBusinesses.length
          },
          {
            interactionMode: selectedBusiness ? 'exploring' : 'browsing',
            recentActions: ['region_change']
          },
          {
            networkCondition: 'unknown' // Would be populated by network service
          }
        );

        await searchHistoryService.saveContextSnapshot(snapshot);
      } catch (error) {
        console.warn('Failed to save context snapshot:', error);
      }
    },
    [contextPreservationEnabled, userLocation, searchQuery, searchFilters, allBusinesses.length, selectedBusiness]
  );

  /**
   * Handle app state transitions for context preservation
   */
  const handleAppStateTransition = useCallback(
    async (prevState: AppStateStatus, nextState: AppStateStatus) => {
      if (prevState === 'active' && nextState.match(/inactive|background/)) {
        // App going to background - save comprehensive context
        await saveContextSnapshot(currentRegion);
      } else if (prevState.match(/inactive|background/) && nextState === 'active') {
        // App returning to foreground - potentially restore context
        const lastSnapshot = searchHistoryService.getContextSnapshot();
        if (lastSnapshot && enableDynamicSearch) {
          // Check if location has changed significantly
          const distance = locationService.calculateDistance(
            lastSnapshot.location.latitude, lastSnapshot.location.longitude,
            userLocation?.latitude || currentRegion.latitude,
            userLocation?.longitude || currentRegion.longitude
          );
          
          if (distance > 1) { // More than 1km difference
            await triggerDynamicSearch(currentRegion);
          }
        }
      }
    },
    [currentRegion, userLocation, enableDynamicSearch, triggerDynamicSearch]
  );

  /**
   * Update search context
   */
  const updateSearchContext = useCallback((updates: any) => {
    // Update search context in history service
    // Implementation would depend on search history service API
  }, []);

  // Calculate marker size based on zoom level
  const markerSize = MapUtils.getMarkerSize(currentRegion);

  return (
    <View style={styles.container} testID={testID}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={currentRegion}
        onRegionChangeComplete={handleRegionChange}
        onMapReady={handleMapReady}
        showsUserLocation={showUserLocation && !!userLocation}
        followsUserLocation={followUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={Platform.OS === 'android'}
        showsBuildings={true}
        showsTraffic={showTrafficLayer}
        mapType={mapType}
        customMapStyle={customMapStyle}
        minZoomLevel={minZoomLevel}
        maxZoomLevel={maxZoomLevel}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
      >
        {/* Cluster Markers */}
        {clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onPress={handleClusterPress}
          />
        ))}

        {/* Individual Business Markers */}
        {individualMarkers.map((business) => (
          <BusinessMarker
            key={business.id}
            business={business}
            onPress={handleBusinessSelect}
            selected={selectedBusiness?.id === business.id}
            size={markerSize}
          />
        ))}
      </MapView>

      {/* Map Controls */}
      <MapControls
        onLocationPress={handleLocationPress}
        onToggleMapType={handleToggleMapType}
        mapType={mapType}
        locationLoading={locationLoading}
        locationDisabled={!showUserLocation}
      />

      {/* Search Notifications */}
      {searchNotificationsEnabled && enableDynamicSearch && (
        <SearchNotificationSystem
          enabled={true}
          position="top"
          onActionPress={handleNotificationAction}
        />
      )}

      {/* Loading State */}
      <LoadingState loading={loadingState} />

      {/* Error State */}
      <ErrorState error={errorState} onRetry={handleRetry} />

      {/* Business Summary Modal */}
      {selectedBusiness && (
        <BusinessSummary
          business={selectedBusiness}
          visible={true}
          onClose={() => setSelectedBusiness(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default DynamicMapView;