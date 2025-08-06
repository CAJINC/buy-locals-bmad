import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import MapView from 'react-native-maps';
import { locationService, LocationCoordinates } from '../../../services/locationService';
import { BusinessMarker } from './BusinessMarker';
import { ClusterMarker } from './ClusterMarker';
import { BusinessSummary } from './BusinessSummary';
import { MapControls } from './MapControls';
import { LoadingState, ErrorState } from './MapLoadingState';
import { MapUtils } from './utils';
import {
  MapViewProps,
  Business,
  MapRegion,
  MarkerCluster,
  MapType,
  MapLoadingState,
  MapErrorState,
  SearchTriggerConfig,
} from './types';

const DEFAULT_REGION: MapRegion = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const DEFAULT_SEARCH_CONFIG: SearchTriggerConfig = {
  debounceMs: 1000,
  minRegionChange: 0.001,
  enableAutoSearch: true,
};

export const MapViewComponent: React.FC<MapViewProps> = ({
  businesses = [],
  initialRegion,
  onRegionChange,
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
  testID,
}) => {
  // Refs
  const mapRef = useRef<MapView>(null);
  const regionChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRegionRef = useRef<MapRegion | null>(null);

  // State
  const [currentRegion, setCurrentRegion] = useState<MapRegion>(
    initialRegion || DEFAULT_REGION
  );
  const [mapType, setMapType] = useState<MapType>('standard');
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
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
  const [searchInProgress, setSearchInProgress] = useState(false);

  // Memoized clusters
  const clusters = useMemo(() => {
    if (!enableClustering || !isMapReady) return [];
    
    return MapUtils.clusterBusinesses(businesses, currentRegion, {
      radius: clusteringRadius,
    });
  }, [businesses, currentRegion, enableClustering, clusteringRadius, isMapReady]);

  // Individual markers (businesses not in clusters)
  const individualMarkers = useMemo(() => {
    if (!enableClustering || clusters.length === 0) return businesses;
    
    const clusteredBusinessIds = new Set(
      clusters.flatMap(cluster => cluster.businesses.map(b => b.id))
    );
    
    return businesses.filter(business => !clusteredBusinessIds.has(business.id));
  }, [businesses, clusters, enableClustering]);

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
  }, [showUserLocation, initialRegion, searchRadius]);

  // Subscribe to location updates
  useEffect(() => {
    if (!showUserLocation || !followUserLocation) return;

    const unsubscribe = locationService.subscribeToLocationUpdates((location) => {
      setUserLocation(location);
    });

    locationService.startLocationWatch(true);

    return () => {
      unsubscribe();
      locationService.stopLocationWatch();
    };
  }, [showUserLocation, followUserLocation]);

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

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    setLoadingState({ isLoading: false });
    onMapReady?.();
  }, [onMapReady]);

  // Handle region change with debouncing
  const handleRegionChange = useCallback(
    (region: MapRegion) => {
      setCurrentRegion(region);
      
      // Clear existing timeout
      if (regionChangeTimeoutRef.current) {
        clearTimeout(regionChangeTimeoutRef.current);
      }

      // Set new timeout for triggering search
      regionChangeTimeoutRef.current = setTimeout(() => {
        const lastRegion = lastRegionRef.current;
        
        if (
          !lastRegion ||
          MapUtils.hasSignificantRegionChange(
            lastRegion,
            region,
            DEFAULT_SEARCH_CONFIG.minRegionChange
          )
        ) {
          lastRegionRef.current = region;
          
          if (DEFAULT_SEARCH_CONFIG.enableAutoSearch) {
            setSearchInProgress(true);
            onRegionChange?.(region);
            
            // Simulate search completion (in real app, this would be handled by parent)
            setTimeout(() => setSearchInProgress(false), 2000);
          }
        }
      }, DEFAULT_SEARCH_CONFIG.debounceMs);
    },
    [onRegionChange]
  );

  // Handle business selection
  const handleBusinessSelect = useCallback(
    (business: Business) => {
      setSelectedBusiness(business);
      onBusinessSelect?.(business);
    },
    [onBusinessSelect]
  );

  // Handle cluster press
  const handleClusterPress = useCallback((cluster: MarkerCluster) => {
    if (!mapRef.current) return;

    // Calculate region to fit all businesses in cluster
    const coordinates = cluster.businesses.map(b => b.coordinates);
    const region = MapUtils.getBoundsFromCoordinates(coordinates, 0.2);
    
    if (region) {
      mapRef.current.animateToRegion(region, 1000);
    }
  }, []);

  // Handle user location press
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
  }, [onLocationPress]);

  // Handle map type toggle
  const handleToggleMapType = useCallback(() => {
    const mapTypes: MapType[] = ['standard', 'satellite', 'hybrid'];
    const currentIndex = mapTypes.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    setMapType(mapTypes[nextIndex]);
  }, [mapType]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setErrorState({ hasError: false, canRetry: false });
    setLoadingState({ isLoading: true, loadingText: 'Retrying...' });
    onRetry?.();
  }, [onRetry]);

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

      {/* Search Progress Indicator */}
      {searchInProgress && (
        <View style={styles.searchIndicator}>
          <View style={styles.searchIndicatorContent}>
            <Text style={styles.searchIndicatorText}>Searching businesses...</Text>
          </View>
        </View>
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
  searchIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  searchIndicatorContent: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  searchIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MapViewComponent;