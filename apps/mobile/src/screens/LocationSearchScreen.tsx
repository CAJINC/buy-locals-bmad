import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Spinner,
  Center,
  Alert,
  ScrollView,
  Pressable,
  Icon,
  Badge,
  Divider,
  Modal,
  Switch,
  Slider,
  Checkbox,
  useColorModeValue,
  useToast,
  FlatList,
  RefreshControl,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationSearchStore } from '../stores/locationSearchStore';
import { BusinessCard } from '../components/business/BusinessProfile/BusinessCard';
import { LocationMap } from '../components/business/BusinessProfile/LocationMap';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LocationSearchScreenProps {
  navigation: any;
}

export const LocationSearchScreen: React.FC<LocationSearchScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  
  // State
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [tempFilters, setTempFilters] = useState({});
  
  // Store
  const {
    currentLocation,
    locationPermissionGranted,
    locationLoading,
    locationError,
    searchResults,
    searchLoading,
    searchError,
    searchExecutionTime,
    cacheHit,
    filters,
    totalResults,
    hasNextPage,
    mapRegion,
    selectedBusiness,
    recentSearches,
    
    requestLocationPermission,
    getCurrentLocation,
    searchNearbyBusinesses,
    searchWithFilters,
    loadMoreResults,
    updateFilters,
    clearSearch,
    setSelectedBusiness,
    addRecentSearch,
    setMapRegion,
    centerMapOnCurrentLocation,
    centerMapOnBusiness,
  } = useLocationSearchStore();

  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.300');

  // Initialize location on mount
  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      if (!locationPermissionGranted) {
        const granted = await requestLocationPermission();
        if (!granted) {
          toast.show({
            title: 'Location Permission Required',
            description: 'Please enable location access to find nearby businesses.',
            status: 'warning',
            duration: 5000,
          });
          return;
        }
      }

      const location = await getCurrentLocation();
      if (location) {
        // Auto-search on first load
        await searchNearbyBusinesses();
      }
    } catch (error) {
      console.error('Location initialization error:', error);
      toast.show({
        title: 'Location Error',
        description: 'Unable to get your current location. Please try again.',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle search input
  const handleSearch = useCallback(async () => {
    if (searchInput.trim()) {
      addRecentSearch(searchInput.trim());
      await searchWithFilters({ search: searchInput.trim() });
    }
  }, [searchInput, searchWithFilters, addRecentSearch]);

  // Handle filter application
  const applyFilters = useCallback(async () => {
    await searchWithFilters(tempFilters);
    setShowFilters(false);
    setTempFilters({});
  }, [tempFilters, searchWithFilters]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    updateFilters({
      radius: 25,
      categories: [],
      search: '',
      sortBy: 'distance',
      amenities: [],
      isOpen: false,
    });
    setSearchInput('');
    clearSearch();
  }, [updateFilters, clearSearch]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (currentLocation) {
      await searchNearbyBusinesses();
    }
  }, [currentLocation, searchNearbyBusinesses]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (hasNextPage && !searchLoading) {
      await loadMoreResults();
    }
  }, [hasNextPage, searchLoading, loadMoreResults]);

  // Performance metrics display
  const performanceInfo = useMemo(() => {
    if (!searchExecutionTime) return null;
    
    const isPerformant = searchExecutionTime < 1000;
    const cacheStatus = cacheHit ? 'CACHED' : 'FRESH';
    
    return (
      <HStack space={2} alignItems="center" px={4} pb={2}>
        <Icon 
          as={MaterialIcons} 
          name={isPerformant ? 'speed' : 'warning'} 
          size="xs" 
          color={isPerformant ? 'green.500' : 'orange.500'} 
        />
        <Text fontSize="xs" color={subtextColor}>
          {searchExecutionTime}ms • {cacheStatus} • {totalResults} results
        </Text>
        {cacheHit && (
          <Badge size="sm" colorScheme="green" variant="subtle">
            FAST
          </Badge>
        )}
      </HStack>
    );
  }, [searchExecutionTime, cacheHit, totalResults, subtextColor]);

  // Search header component
  const SearchHeader = () => (
    <VStack space={3} bg={bgColor} px={4} pt={insets.top + 10} pb={3}>
      {/* Search input */}
      <HStack space={3} alignItems="center">
        <Input
          flex={1}
          placeholder="Search businesses..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={handleSearch}
          leftElement={
            <Icon as={MaterialIcons} name="search" size="md" ml={3} color="gray.400" />
          }
          rightElement={
            searchInput ? (
              <Pressable onPress={() => setSearchInput('')} p={2}>
                <Icon as={MaterialIcons} name="clear" size="sm" color="gray.400" />
              </Pressable>
            ) : undefined
          }
        />
        <Button
          variant="outline"
          leftIcon={<Icon as={MaterialIcons} name="tune" />}
          onPress={() => setShowFilters(true)}
        >
          Filter
        </Button>
      </HStack>

      {/* View mode toggle */}
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2}>
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'solid' : 'outline'}
            leftIcon={<Icon as={MaterialIcons} name="list" />}
            onPress={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'map' ? 'solid' : 'outline'}
            leftIcon={<Icon as={MaterialIcons} name="map" />}
            onPress={() => setViewMode('map')}
          >
            Map
          </Button>
        </HStack>

        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Icon as={MaterialIcons} name="my-location" />}
          onPress={centerMapOnCurrentLocation}
        >
          My Location
        </Button>
      </HStack>

      {/* Active filters display */}
      {(filters.categories.length > 0 || filters.search || filters.isOpen) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack space={2} alignItems="center">
            {filters.search && (
              <Badge colorScheme="blue" variant="subtle">
                "{filters.search}"
              </Badge>
            )}
            {filters.categories.map(category => (
              <Badge key={category} colorScheme="purple" variant="subtle">
                {category}
              </Badge>
            ))}
            {filters.isOpen && (
              <Badge colorScheme="green" variant="subtle">
                Open Now
              </Badge>
            )}
            <Button size="xs" variant="ghost" onPress={clearAllFilters}>
              Clear All
            </Button>
          </HStack>
        </ScrollView>
      )}

      {performanceInfo}
    </VStack>
  );

  // List view component
  const ListView = () => (
    <FlatList
      data={searchResults}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Box px={4} py={2}>
          <BusinessCard
            business={item}
            onPress={() => navigation.navigate('BusinessProfile', { businessId: item.id })}
            showDistance={true}
            showDirections={true}
          />
        </Box>
      )}
      refreshControl={
        <RefreshControl
          refreshing={searchLoading && searchResults.length === 0}
          onRefresh={handleRefresh}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      ListFooterComponent={
        hasNextPage ? (
          <Center py={4}>
            <ActivityIndicator size="small" />
            <Text fontSize="sm" color={subtextColor} mt={2}>
              Loading more...
            </Text>
          </Center>
        ) : searchResults.length > 0 ? (
          <Center py={4}>
            <Text fontSize="sm" color={subtextColor}>
              No more results
            </Text>
          </Center>
        ) : null
      }
      ListEmptyComponent={
        searchLoading ? (
          <Center py={10}>
            <Spinner size="lg" />
            <Text mt={2} color={subtextColor}>
              Searching nearby businesses...
            </Text>
          </Center>
        ) : searchError ? (
          <Center py={10}>
            <Alert w="90%" status="error">
              <VStack space={2} flexShrink={1} w="100%" alignItems="center">
                <Alert.Icon />
                <Text fontSize="sm" color="error.600" textAlign="center">
                  {searchError}
                </Text>
                <Button size="sm" onPress={handleRefresh}>
                  Try Again
                </Button>
              </VStack>
            </Alert>
          </Center>
        ) : (
          <Center py={10}>
            <Icon as={MaterialIcons} name="location-off" size="xl" color="gray.400" />
            <Text mt={2} color={subtextColor} textAlign="center">
              No businesses found in this area
            </Text>
            <Button mt={3} variant="outline" onPress={handleRefresh}>
              Search Again
            </Button>
          </Center>
        )
      }
    />
  );

  // Map view component
  const MapView = () => (
    <Box flex={1}>
      {mapRegion && (
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
        >
          {searchResults.map((business) => (
            <Marker
              key={business.id}
              coordinate={{
                latitude: business.location.coordinates.lat,
                longitude: business.location.coordinates.lng,
              }}
              title={business.name}
              description={`${business.distance.toFixed(1)}km away`}
              onPress={() => setSelectedBusiness(business)}
            >
              <Callout
                onPress={() => navigation.navigate('BusinessProfile', { businessId: business.id })}
              >
                <Box p={2} minW={200}>
                  <Text fontWeight="bold" fontSize="sm">
                    {business.name}
                  </Text>
                  <Text fontSize="xs" color={subtextColor}>
                    {business.distance.toFixed(1)}km • {business.categories.join(', ')}
                  </Text>
                  {business.isCurrentlyOpen !== undefined && (
                    <Badge
                      size="sm"
                      colorScheme={business.isCurrentlyOpen ? 'green' : 'red'}
                      mt={1}
                    >
                      {business.isCurrentlyOpen ? 'Open' : 'Closed'}
                    </Badge>
                  )}
                </Box>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}
    </Box>
  );

  // Filter modal component
  const FilterModal = () => (
    <Modal isOpen={showFilters} onClose={() => setShowFilters(false)} size="full">
      <Modal.Content>
        <Modal.CloseButton />
        <Modal.Header>Search Filters</Modal.Header>
        <Modal.Body>
          <VStack space={4}>
            {/* Search radius */}
            <VStack space={2}>
              <Text fontWeight="medium">Search Radius: {tempFilters.radius || filters.radius}km</Text>
              <Slider
                value={tempFilters.radius || filters.radius}
                onChange={(value) => setTempFilters({ ...tempFilters, radius: value })}
                minValue={1}
                maxValue={100}
                step={1}
              >
                <Slider.Track>
                  <Slider.FilledTrack />
                </Slider.Track>
                <Slider.Thumb />
              </Slider>
            </VStack>

            {/* Open now toggle */}
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="medium">Open Now</Text>
              <Switch
                value={tempFilters.isOpen ?? filters.isOpen}
                onToggle={(value) => setTempFilters({ ...tempFilters, isOpen: value })}
              />
            </HStack>

            {/* Sort by */}
            <VStack space={2}>
              <Text fontWeight="medium">Sort By</Text>
              <HStack space={2}>
                {['distance', 'rating', 'newest'].map((sort) => (
                  <Button
                    key={sort}
                    size="sm"
                    variant={(tempFilters.sortBy || filters.sortBy) === sort ? 'solid' : 'outline'}
                    onPress={() => setTempFilters({ ...tempFilters, sortBy: sort })}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Button>
                ))}
              </HStack>
            </VStack>

            {/* Categories */}
            <VStack space={2}>
              <Text fontWeight="medium">Categories</Text>
              <Text fontSize="sm" color={subtextColor}>
                Select categories to filter by
              </Text>
              {/* This would be populated with actual categories from the API */}
              {['Restaurant', 'Retail', 'Service', 'Entertainment'].map((category) => (
                <Checkbox
                  key={category}
                  value={category}
                  isChecked={(tempFilters.categories || filters.categories)?.includes(category)}
                  onChange={(checked) => {
                    const categories = tempFilters.categories || filters.categories || [];
                    const updated = checked
                      ? [...categories, category]
                      : categories.filter(c => c !== category);
                    setTempFilters({ ...tempFilters, categories: updated });
                  }}
                >
                  {category}
                </Checkbox>
              ))}
            </VStack>
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button.Group space={2}>
            <Button variant="ghost" onPress={() => setShowFilters(false)}>
              Cancel
            </Button>
            <Button onPress={applyFilters}>
              Apply Filters
            </Button>
          </Button.Group>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );

  // Loading state
  if (locationLoading && !currentLocation) {
    return (
      <Center flex={1} bg={bgColor}>
        <VStack space={3} alignItems="center">
          <Spinner size="lg" />
          <Text color={subtextColor}>Getting your location...</Text>
        </VStack>
      </Center>
    );
  }

  // Permission denied state
  if (!locationPermissionGranted) {
    return (
      <Center flex={1} bg={bgColor} px={6}>
        <VStack space={4} alignItems="center">
          <Icon as={MaterialIcons} name="location-off" size="xl" color="gray.400" />
          <Text fontSize="lg" fontWeight="medium" textAlign="center">
            Location Permission Required
          </Text>
          <Text color={subtextColor} textAlign="center">
            To find nearby businesses, please enable location access in your device settings.
          </Text>
          <Button onPress={requestLocationPermission}>
            Enable Location
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Box flex={1} bg={bgColor}>
      <SearchHeader />
      {viewMode === 'list' ? <ListView /> : <MapView />}
      <FilterModal />
    </Box>
  );
};