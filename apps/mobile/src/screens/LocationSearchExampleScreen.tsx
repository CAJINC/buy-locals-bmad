/**
 * Example integration of the Manual Location Entry System
 * This demonstrates how to integrate the new location discovery components
 * into an existing screen or create a new location search interface.
 * 
 * Story 2.2 Task 2: Manual Location Entry System with Google Places API autocomplete
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useToast,
  Modal,
  Alert,
  StatusBar,
} from 'native-base';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  LocationSearchScreen,
  LocationInput,
  LocationHistory,
  SavedLocations 
} from '../components/discovery';
import { locationService, LocationCoordinates } from '../services/locationService';
import { geocodingService, GeocodingResult } from '../services/geocodingService';
import { locationHistoryService } from '../services/locationHistoryService';

interface LocationSearchExampleScreenProps {
  navigation: any;
  route: any;
}

export const LocationSearchExampleScreen: React.FC<LocationSearchExampleScreenProps> = ({
  navigation,
  route
}) => {
  // State
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    coordinates: LocationCoordinates;
    address: string;
    placeId?: string;
  } | null>(null);
  const [showFullSearch, setShowFullSearch] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const toast = useToast();
  
  /**
   * Initialize component
   */
  useEffect(() => {
    initializeLocationServices();
  }, []);
  
  /**
   * Initialize location services and get current location
   */
  const initializeLocationServices = async () => {
    try {
      setIsLoading(true);
      
      // Check location availability
      const availability = await locationService.isLocationAvailable();
      if (!availability.available) {
        toast.show({
          description: 'Location services are not available',
          status: 'warning'
        });
      }
      
      // Try to get current location
      const location = locationService.getCachedLocation();
      if (location) {
        setCurrentLocation(location);
      } else {
        // Try to get fresh location
        try {
          const freshLocation = await locationService.getCurrentLocation();
          setCurrentLocation(freshLocation);
        } catch (error) {
          console.log('Could not get current location:', error);
        }
      }
      
      // Initialize history service
      await locationHistoryService.initialize();
      
    } catch (error) {
      console.error('Failed to initialize location services:', error);
      toast.show({
        description: 'Failed to initialize location services',
        status: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle location selection from any component
   */
  const handleLocationSelect = useCallback((
    coordinates: LocationCoordinates,
    address: string,
    placeId?: string
  ) => {
    setSelectedLocation({ coordinates, address, placeId });
    
    // Close any open modals
    setShowFullSearch(false);
    setShowQuickInput(false);
    setShowHistory(false);
    setShowSaved(false);
    
    toast.show({
      description: `Selected: ${address}`,
      status: 'success'
    });
    
    // Navigate to next screen or process the location
    handleProcessLocation(coordinates, address, placeId);
  }, []);
  
  /**
   * Process the selected location (example implementation)
   */
  const handleProcessLocation = useCallback((
    coordinates: LocationCoordinates,
    address: string,
    placeId?: string
  ) => {
    // Example: Navigate to business search screen with selected location
    navigation.navigate('BusinessSearch', {
      location: coordinates,
      address,
      placeId,
      searchRadius: 5 // km
    });
    
    // Or dispatch to Redux store
    // dispatch(setSearchLocation({ coordinates, address, placeId }));
    
    // Or call parent callback if this is a modal
    // route.params?.onLocationSelect?.(coordinates, address, placeId);
  }, [navigation]);
  
  /**
   * Handle location save
   */
  const handleSaveLocation = useCallback(async (
    name: string,
    result: GeocodingResult,
    category: 'home' | 'work' | 'favorite' | 'custom',
    notes?: string
  ) => {
    try {
      await locationHistoryService.saveLocation(name, result, category, notes);
      toast.show({
        description: 'Location saved successfully',
        status: 'success'
      });
    } catch (error) {
      console.error('Failed to save location:', error);
      toast.show({
        description: 'Failed to save location',
        status: 'error'
      });
    }
  }, [toast]);
  
  /**
   * Handle errors from location components
   */
  const handleLocationError = useCallback((error: string) => {
    console.error('Location error:', error);
    toast.show({
      description: error,
      status: 'error'
    });
  }, [toast]);
  
  /**
   * Get current location manually
   */
  const handleGetCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      const location = await locationService.getCurrentLocation(true);
      setCurrentLocation(location);
      
      // Reverse geocode to get address
      const addresses = await geocodingService.reverseGeocode(
        location.latitude,
        location.longitude
      );
      
      const address = addresses[0]?.formattedAddress || 
        `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      
      handleLocationSelect(location, address);
    } catch (error) {
      handleLocationError('Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  }, [handleLocationSelect, handleLocationError]);
  
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text>Initializing location services...</Text>
        </Box>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      
      <VStack flex={1} space={4} p={4}>
        {/* Header */}
        <VStack space={2}>
          <Text fontSize="2xl" fontWeight="bold">
            Location Search Demo
          </Text>
          <Text fontSize="sm" color="gray.600">
            Demonstrating Story 2.2 Task 2: Manual Location Entry System
          </Text>
        </VStack>
        
        {/* Current Location Display */}
        {currentLocation && (
          <Alert status="info">
            <VStack space={2} flex={1}>
              <Alert.Icon />
              <Text fontSize="sm" fontWeight="medium">
                Current Location Available
              </Text>
              <Text fontSize="xs" color="gray.600">
                Lat: {currentLocation.latitude.toFixed(6)}, 
                Lng: {currentLocation.longitude.toFixed(6)}
              </Text>
            </VStack>
          </Alert>
        )}
        
        {/* Selected Location Display */}
        {selectedLocation && (
          <Alert status="success">
            <VStack space={2} flex={1}>
              <Alert.Icon />
              <Text fontSize="sm" fontWeight="medium">
                Selected Location
              </Text>
              <Text fontSize="xs" color="gray.700">
                {selectedLocation.address}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {selectedLocation.coordinates.latitude.toFixed(6)}, {selectedLocation.coordinates.longitude.toFixed(6)}
              </Text>
            </VStack>
          </Alert>
        )}
        
        {/* Action Buttons */}
        <VStack space={3}>
          <Button
            onPress={() => setShowFullSearch(true)}
            size="lg"
            colorScheme="blue"
          >
            Open Full Location Search
          </Button>
          
          <Button
            onPress={() => setShowQuickInput(true)}
            size="lg"
            variant="outline"
            colorScheme="blue"
          >
            Quick Location Input
          </Button>
          
          <HStack space={2}>
            <Button
              onPress={() => setShowHistory(true)}
              flex={1}
              variant="outline"
              colorScheme="gray"
            >
              View History
            </Button>
            
            <Button
              onPress={() => setShowSaved(true)}
              flex={1}
              variant="outline"
              colorScheme="purple"
            >
              Saved Places
            </Button>
          </HStack>
          
          <Button
            onPress={handleGetCurrentLocation}
            variant="outline"
            colorScheme="green"
            isLoading={isLoading}
            loadingText="Getting location..."
          >
            Use Current Location
          </Button>
        </VStack>
        
        {/* Component Examples */}
        <VStack space={2}>
          <Text fontSize="lg" fontWeight="semibold">
            Component Examples
          </Text>
          
          <Text fontSize="sm" color="gray.600">
            The buttons above demonstrate different ways to use the location discovery components:
          </Text>
          
          <VStack space={1} pl={4}>
            <Text fontSize="xs" color="gray.600">
              • Full Search: Complete LocationSearchScreen with all features
            </Text>
            <Text fontSize="xs" color="gray.600">
              • Quick Input: Simple LocationInput for inline use
            </Text>
            <Text fontSize="xs" color="gray.600">
              • History: LocationHistory component standalone
            </Text>
            <Text fontSize="xs" color="gray.600">
              • Saved Places: SavedLocations component standalone
            </Text>
          </VStack>
        </VStack>
      </VStack>
      
      {/* Full Location Search Modal */}
      <Modal 
        isOpen={showFullSearch} 
        onClose={() => setShowFullSearch(false)}
        size="full"
      >
        <Modal.Content>
          <LocationSearchScreen
            onLocationSelect={handleLocationSelect}
            onClose={() => setShowFullSearch(false)}
            currentLocation={currentLocation}
            title="Find Location"
            showZipCodeExpansion={true}
          />
        </Modal.Content>
      </Modal>
      
      {/* Quick Input Modal */}
      <Modal 
        isOpen={showQuickInput} 
        onClose={() => setShowQuickInput(false)}
        size="lg"
      >
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Quick Location Search</Modal.Header>
          <Modal.Body>
            <LocationInput
              onLocationSelect={handleLocationSelect}
              onError={handleLocationError}
              placeholder="Enter address or place name"
              showHistory={true}
              showSavedLocations={true}
              enableCurrentLocation={true}
              autoFocus={true}
            />
          </Modal.Body>
        </Modal.Content>
      </Modal>
      
      {/* History Modal */}
      <Modal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)}
        size="lg"
      >
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Search History</Modal.Header>
          <Modal.Body>
            <LocationHistory
              onLocationSelect={handleLocationSelect}
              showStats={true}
              maxItems={15}
              title=""
            />
          </Modal.Body>
        </Modal.Content>
      </Modal>
      
      {/* Saved Locations Modal */}
      <Modal 
        isOpen={showSaved} 
        onClose={() => setShowSaved(false)}
        size="lg"
      >
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Saved Places</Modal.Header>
          <Modal.Body>
            <SavedLocations
              onLocationSelect={handleLocationSelect}
              onSaveLocation={handleSaveLocation}
              enableAdd={true}
              maxItems={15}
              title=""
            />
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </SafeAreaView>
  );
};