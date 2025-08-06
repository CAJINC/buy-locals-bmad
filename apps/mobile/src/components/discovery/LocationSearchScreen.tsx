import React, { useState, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Pressable,
  Icon,
  Modal,
  Button,
  useColorModeValue,
  ScrollView,
  Divider,
  Badge,
  useToast,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocationInput } from './LocationInput';
import { LocationHistory } from './LocationHistory';
import { SavedLocations } from './SavedLocations';
import { LocationCoordinates } from '../../services/locationService';
import { geocodingService, GeocodingResult } from '../../services/geocodingService';
import { locationHistoryService } from '../../services/locationHistoryService';

export interface LocationSearchScreenProps {
  onLocationSelect: (coordinates: LocationCoordinates, address: string, placeId?: string) => void;
  onClose?: () => void;
  currentLocation?: LocationCoordinates;
  title?: string;
  showZipCodeExpansion?: boolean;
}

interface ZipCodeInfo {
  zipCode: string;
  expansion: {
    center: LocationCoordinates;
    radius: number;
    cities: string[];
    state: string;
  };
}

export const LocationSearchScreen: React.FC<LocationSearchScreenProps> = ({
  onLocationSelect,
  onClose,
  currentLocation,
  title = "Search Location",
  showZipCodeExpansion = true
}) => {
  // State
  const [selectedLocation, setSelectedLocation] = useState<{
    coordinates: LocationCoordinates;
    address: string;
    placeId?: string;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isProcessingZipCode, setIsProcessingZipCode] = useState(false);
  const [zipCodeInfo, setZipCodeInfo] = useState<ZipCodeInfo | null>(null);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  
  const toast = useToast();
  
  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.900');
  const surfaceColor = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  
  /**
   * Handle location selection from any source
   */
  const handleLocationSelect = useCallback(async (
    coordinates: LocationCoordinates,
    address: string,
    placeId?: string
  ) => {
    try {
      setSelectedLocation({ coordinates, address, placeId });
      
      // Check if this looks like a zip code search and expand if needed
      if (showZipCodeExpansion && isLikelyZipCode(address)) {
        await handleZipCodeExpansion(address, coordinates);
      } else {
        // Directly select the location
        onLocationSelect(coordinates, address, placeId);
      }
    } catch (error) {
      console.error('Location selection error:', error);
      toast.show({
        description: 'Error processing location selection',
        status: 'error'
      });
    }
  }, [onLocationSelect, showZipCodeExpansion, toast]);
  
  /**
   * Handle zip code expansion
   */
  const handleZipCodeExpansion = async (address: string, coordinates: LocationCoordinates) => {
    setIsProcessingZipCode(true);
    
    try {
      const zipCodeMatch = address.match(/\b\d{5}(-\d{4})?\b/);
      if (!zipCodeMatch) {
        onLocationSelect(coordinates, address);
        return;
      }
      
      const zipCode = zipCodeMatch[0];
      const expansion = await geocodingService.expandZipCodeArea(zipCode);
      
      if (expansion) {
        setZipCodeInfo({
          zipCode,
          expansion
        });
        setShowLocationDetails(true);
      } else {
        onLocationSelect(coordinates, address);
      }
    } catch (error) {
      console.error('Zip code expansion error:', error);
      onLocationSelect(coordinates, address);
    } finally {
      setIsProcessingZipCode(false);
    }
  };
  
  /**
   * Check if address looks like a zip code search
   */
  const isLikelyZipCode = (address: string): boolean => {
    // Simple heuristic: if the address starts with a zip code or is primarily a zip code
    const zipCodePattern = /^\s*\d{5}(-\d{4})?\b/;
    return zipCodePattern.test(address);
  };
  
  /**
   * Handle error from location input
   */
  const handleLocationError = useCallback((error: string) => {
    toast.show({
      description: error,
      status: 'error'
    });
  }, [toast]);
  
  /**
   * Handle save location
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
      console.error('Save location error:', error);
      toast.show({
        description: 'Failed to save location',
        status: 'error'
      });
    }
  }, [toast]);
  
  /**
   * Confirm zip code area selection
   */
  const handleZipCodeConfirm = (useExpanded: boolean) => {
    if (!zipCodeInfo || !selectedLocation) return;
    
    if (useExpanded) {
      // Use expanded area center
      onLocationSelect(
        zipCodeInfo.expansion.center,
        `${zipCodeInfo.zipCode} area (${zipCodeInfo.expansion.cities.join(', ')})`,
        selectedLocation.placeId
      );
    } else {
      // Use original coordinates
      onLocationSelect(
        selectedLocation.coordinates,
        selectedLocation.address,
        selectedLocation.placeId
      );
    }
    
    setShowLocationDetails(false);
    setZipCodeInfo(null);
    setSelectedLocation(null);
  };
  
  /**
   * Get distance string
   */
  const getDistanceString = (coordinates: LocationCoordinates): string => {
    if (!currentLocation) return '';
    
    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      coordinates.latitude,
      coordinates.longitude
    );
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    } else {
      return `${distance.toFixed(1)}km away`;
    }
  };
  
  /**
   * Calculate distance between coordinates
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  };
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <VStack flex={1} space={0}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center" p={4} borderBottomWidth={1} borderBottomColor={borderColor}>
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            {title}
          </Text>
          
          <HStack space={2}>
            <Pressable onPress={() => setShowHistory(!showHistory)}>
              <Icon
                as={MaterialIcons}
                name={showHistory ? "history" : "history"}
                size="md"
                color={showHistory ? "blue.500" : subtextColor}
              />
            </Pressable>
            
            <Pressable onPress={() => setShowSaved(!showSaved)}>
              <Icon
                as={MaterialIcons}
                name={showSaved ? "bookmark" : "bookmark-border"}
                size="md"
                color={showSaved ? "purple.500" : subtextColor}
              />
            </Pressable>
            
            {onClose && (
              <Pressable onPress={onClose}>
                <Icon as={MaterialIcons} name="close" size="md" color={subtextColor} />
              </Pressable>
            )}
          </HStack>
        </HStack>
        
        {/* Search Input */}
        <Box p={4} bg={bgColor} borderBottomWidth={1} borderBottomColor={borderColor}>
          <LocationInput
            onLocationSelect={handleLocationSelect}
            onError={handleLocationError}
            placeholder="Search for address, city, or zip code"
            showHistory={!showHistory && !showSaved}
            showSavedLocations={!showHistory && !showSaved}
            enableCurrentLocation
          />
          
          {isProcessingZipCode && (
            <HStack justifyContent="center" alignItems="center" mt={2}>
              <Text fontSize="sm" color={subtextColor}>
                Expanding search area...
              </Text>
            </HStack>
          )}
        </Box>
        
        {/* Content Area */}
        <Box flex={1}>
          {showHistory && (
            <LocationHistory
              onLocationSelect={handleLocationSelect}
              showStats
              title="Search History"
              containerStyle={{ flex: 1, padding: 16 }}
            />
          )}
          
          {showSaved && (
            <SavedLocations
              onLocationSelect={handleLocationSelect}
              onSaveLocation={handleSaveLocation}
              enableAdd
              title="Saved Places"
              containerStyle={{ flex: 1, padding: 16 }}
            />
          )}
          
          {!showHistory && !showSaved && (
            <ScrollView flex={1} bg={surfaceColor}>
              <VStack space={4} p={4}>
                {/* Quick Access */}
                <Box bg={bgColor} borderRadius="md" p={4}>
                  <Text fontSize="md" fontWeight="semibold" color={textColor} mb={3}>
                    Quick Access
                  </Text>
                  
                  <VStack space={2}>
                    <Pressable onPress={() => setShowSaved(true)}>
                      <HStack space={3} alignItems="center" py={2}>
                        <Icon as={MaterialIcons} name="bookmark" size="sm" color="purple.500" />
                        <Text color={textColor}>Saved Places</Text>
                        <Icon as={MaterialIcons} name="chevron-right" size="sm" color={subtextColor} />
                      </HStack>
                    </Pressable>
                    
                    <Pressable onPress={() => setShowHistory(true)}>
                      <HStack space={3} alignItems="center" py={2}>
                        <Icon as={MaterialIcons} name="history" size="sm" color="blue.500" />
                        <Text color={textColor}>Recent Searches</Text>
                        <Icon as={MaterialIcons} name="chevron-right" size="sm" color={subtextColor} />
                      </HStack>
                    </Pressable>
                  </VStack>
                </Box>
                
                {/* Tips */}
                <Box bg={bgColor} borderRadius="md" p={4}>
                  <Text fontSize="md" fontWeight="semibold" color={textColor} mb={3}>
                    Search Tips
                  </Text>
                  
                  <VStack space={2}>
                    <Text fontSize="sm" color={subtextColor}>
                      • Enter a specific address for precise results
                    </Text>
                    <Text fontSize="sm" color={subtextColor}>
                      • Use city names for broader area searches
                    </Text>
                    <Text fontSize="sm" color={subtextColor}>
                      • ZIP codes will expand to include nearby areas
                    </Text>
                    <Text fontSize="sm" color={subtextColor}>
                      • Tap the location icon to use current location
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            </ScrollView>
          )}
        </Box>
        
        {/* Zip Code Expansion Modal */}
        <Modal isOpen={showLocationDetails} onClose={() => setShowLocationDetails(false)}>
          <Modal.Content>
            <Modal.CloseButton />
            <Modal.Header>Choose Search Area</Modal.Header>
            <Modal.Body>
              <VStack space={4}>
                <Text color={textColor}>
                  We found that "{zipCodeInfo?.zipCode}" covers a broader area. 
                  How would you like to search?
                </Text>
                
                {zipCodeInfo && (
                  <VStack space={3}>
                    <Box borderWidth={1} borderColor={borderColor} borderRadius="md" p={3}>
                      <HStack justifyContent="space-between" alignItems="center" mb={2}>
                        <Text fontWeight="semibold" color={textColor}>
                          Exact Location
                        </Text>
                        <Badge colorScheme="blue" variant="subtle">
                          Precise
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color={subtextColor} mb={1}>
                        {selectedLocation?.address}
                      </Text>
                      {currentLocation && selectedLocation && (
                        <Text fontSize="xs" color={subtextColor}>
                          {getDistanceString(selectedLocation.coordinates)}
                        </Text>
                      )}
                    </Box>
                    
                    <Box borderWidth={1} borderColor={borderColor} borderRadius="md" p={3}>
                      <HStack justifyContent="space-between" alignItems="center" mb={2}>
                        <Text fontWeight="semibold" color={textColor}>
                          {zipCodeInfo.zipCode} Area
                        </Text>
                        <Badge colorScheme="green" variant="subtle">
                          Broader
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color={subtextColor} mb={1}>
                        Includes: {zipCodeInfo.expansion.cities.join(', ')}
                      </Text>
                      <Text fontSize="sm" color={subtextColor} mb={1}>
                        ~{zipCodeInfo.expansion.radius}km radius
                      </Text>
                      {currentLocation && (
                        <Text fontSize="xs" color={subtextColor}>
                          {getDistanceString(zipCodeInfo.expansion.center)}
                        </Text>
                      )}
                    </Box>
                  </VStack>
                )}
              </VStack>
            </Modal.Body>
            <Modal.Footer>
              <Button.Group space={2}>
                <Button
                  variant="outline"
                  onPress={() => handleZipCodeConfirm(false)}
                  flex={1}
                >
                  Use Exact
                </Button>
                <Button
                  onPress={() => handleZipCodeConfirm(true)}
                  flex={1}
                >
                  Use Area
                </Button>
              </Button.Group>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </VStack>
    </SafeAreaView>
  );
};