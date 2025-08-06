import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Input,
  VStack,
  HStack,
  Text,
  Pressable,
  Icon,
  Spinner,
  Badge,
  FlatList,
  Alert,
  useColorModeValue,
} from 'native-base';
import { GooglePlacesAutocomplete, GooglePlaceData, GooglePlaceDetail } from 'react-native-google-places-autocomplete';
import { MaterialIcons } from '@expo/vector-icons';
import { Keyboard, Platform } from 'react-native';
import { locationService, LocationCoordinates } from '../../../services/locationService';
import { geocodingService, GeocodingResult } from '../../../services/geocodingService';
import { locationHistoryService, LocationHistoryEntry, SavedLocation } from '../../../services/locationHistoryService';
import { debounce } from 'lodash';

export interface LocationInputProps {
  onLocationSelect: (location: LocationCoordinates, address: string, placeId?: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  initialValue?: string;
  showHistory?: boolean;
  showSavedLocations?: boolean;
  enableCurrentLocation?: boolean;
  autoFocus?: boolean;
  containerStyle?: object;
}

interface LocationSuggestion {
  id: string;
  title: string;
  subtitle: string;
  coordinates: LocationCoordinates;
  placeId?: string;
  source: 'history' | 'saved' | 'places' | 'current';
  icon: string;
}

export const LocationInput: React.FC<LocationInputProps> = ({
  onLocationSelect,
  onError,
  placeholder = "Search for an address or place",
  initialValue = "",
  showHistory = true,
  showSavedLocations = true,
  enableCurrentLocation = true,
  autoFocus = false,
  containerStyle
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Refs
  const autocompleteRef = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  
  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  
  /**
   * Initialize component
   */
  useEffect(() => {
    initializeCurrentLocation();
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
  
  /**
   * Get current location
   */
  const initializeCurrentLocation = async () => {
    if (!enableCurrentLocation) return;
    
    try {
      const location = locationService.getCachedLocation();
      if (location) {
        setCurrentLocation(location);
      }
    } catch (error) {
      console.log('Could not get cached location:', error);
    }
  };
  
  /**
   * Handle text input changes
   */
  const handleTextChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowSuggestions(true);
    
    // Clear previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Debounce search
    debounceTimer.current = setTimeout(() => {
      if (text.trim().length >= 2) {
        searchLocations(text.trim());
      } else {
        loadDefaultSuggestions();
      }
    }, 300);
  }, []);
  
  /**
   * Search locations with multiple sources
   */
  const searchLocations = async (query: string) => {
    setIsLoading(true);
    
    try {
      const suggestions: LocationSuggestion[] = [];
      
      // 1. Search history if enabled
      if (showHistory) {
        const history = await locationHistoryService.searchHistory(query, 3);
        history.forEach(entry => {
          suggestions.push({
            id: `history_${entry.id}`,
            title: entry.address.split(',')[0],
            subtitle: entry.address,
            coordinates: entry.coordinates,
            placeId: entry.placeId,
            source: 'history',
            icon: 'history'
          });
        });
      }
      
      // 2. Search saved locations if enabled
      if (showSavedLocations) {
        const saved = await locationHistoryService.getSavedLocations();
        const filteredSaved = saved.filter(loc => 
          loc.name.toLowerCase().includes(query.toLowerCase()) ||
          loc.address.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 2);
        
        filteredSaved.forEach(location => {
          suggestions.push({
            id: `saved_${location.id}`,
            title: location.name,
            subtitle: location.address,
            coordinates: location.coordinates,
            placeId: location.placeId,
            source: 'saved',
            icon: location.category === 'home' ? 'home' : 
                  location.category === 'work' ? 'work' :
                  location.category === 'favorite' ? 'star' : 'bookmark'
          });
        });
      }
      
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Search error:', error);
      onError?.(String(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Load default suggestions (recent + saved + current location)
   */
  const loadDefaultSuggestions = async () => {
    setIsLoading(true);
    
    try {
      const suggestions: LocationSuggestion[] = [];
      
      // Add current location
      if (enableCurrentLocation && currentLocation) {
        suggestions.push({
          id: 'current',
          title: 'Current Location',
          subtitle: 'Use my current location',
          coordinates: currentLocation,
          source: 'current',
          icon: 'my-location'
        });
      }
      
      // Add recent searches
      if (showHistory) {
        const recent = await locationHistoryService.getRecentSearches(3);
        recent.forEach(entry => {
          suggestions.push({
            id: `recent_${entry.id}`,
            title: entry.address.split(',')[0],
            subtitle: entry.address,
            coordinates: entry.coordinates,
            placeId: entry.placeId,
            source: 'history',
            icon: 'schedule'
          });
        });
      }
      
      // Add saved locations
      if (showSavedLocations) {
        const saved = await locationHistoryService.getSavedLocations();
        saved.slice(0, 3).forEach(location => {
          suggestions.push({
            id: `saved_${location.id}`,
            title: location.name,
            subtitle: location.address,
            coordinates: location.coordinates,
            placeId: location.placeId,
            source: 'saved',
            icon: location.category === 'home' ? 'home' : 
                  location.category === 'work' ? 'work' :
                  location.category === 'favorite' ? 'star' : 'bookmark'
          });
        });
      }
      
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Load default suggestions error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle current location selection
   */
  const handleCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      const location = await locationService.getCurrentLocation(true);
      setCurrentLocation(location);
      
      // Get address for current location
      const results = await geocodingService.reverseGeocode(location.latitude, location.longitude);
      const address = results[0]?.formattedAddress || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      
      // Add to history
      await locationHistoryService.addToHistory(
        'Current Location',
        {
          formattedAddress: address,
          coordinates: location,
          components: results[0]?.components || {},
          types: results[0]?.types || ['current_location']
        },
        'gps'
      );
      
      setSearchQuery(address.split(',')[0]);
      setShowSuggestions(false);
      Keyboard.dismiss();
      
      onLocationSelect(location, address);
    } catch (error) {
      console.error('Current location error:', error);
      onError?.('Unable to get current location. Please check location permissions.');
    } finally {
      setIsGettingLocation(false);
    }
  };
  
  /**
   * Handle suggestion selection
   */
  const handleSuggestionSelect = async (suggestion: LocationSuggestion) => {
    try {
      setSearchQuery(suggestion.title);
      setShowSuggestions(false);
      Keyboard.dismiss();
      
      // Update usage for saved locations
      if (suggestion.source === 'saved') {
        const savedId = suggestion.id.replace('saved_', '');
        await locationHistoryService.updateSavedLocationUsage(savedId);
      }
      
      // Add to history if not already from history
      if (suggestion.source !== 'history') {
        await locationHistoryService.addToHistory(
          suggestion.title,
          {
            formattedAddress: suggestion.subtitle,
            coordinates: suggestion.coordinates,
            placeId: suggestion.placeId,
            components: {},
            types: []
          },
          suggestion.source
        );
      }
      
      onLocationSelect(suggestion.coordinates, suggestion.subtitle, suggestion.placeId);
    } catch (error) {
      console.error('Suggestion select error:', error);
      onError?.(String(error));
    }
  };
  
  /**
   * Handle Google Places selection
   */
  const handlePlaceSelect = async (data: GooglePlaceData, detail: GooglePlaceDetail | null) => {
    if (!detail?.geometry?.location) {
      onError?.('Invalid location data received');
      return;
    }
    
    try {
      const coordinates: LocationCoordinates = {
        latitude: detail.geometry.location.lat,
        longitude: detail.geometry.location.lng,
        accuracy: 10, // Places API accuracy
        timestamp: Date.now()
      };
      
      const result: GeocodingResult = {
        formattedAddress: detail.formatted_address || data.description,
        coordinates,
        placeId: detail.place_id,
        components: {},
        types: detail.types || []
      };
      
      // Parse address components
      detail.address_components?.forEach((component) => {
        const types = component.types;
        if (types.includes('street_number')) {
          result.components.streetNumber = component.long_name;
        } else if (types.includes('route')) {
          result.components.route = component.long_name;
        } else if (types.includes('locality')) {
          result.components.locality = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          result.components.administrativeAreaLevel1 = component.short_name;
        } else if (types.includes('postal_code')) {
          result.components.postalCode = component.long_name;
        }
      });
      
      // Add to history
      await locationHistoryService.addToHistory(data.description, result, 'search');
      
      setShowSuggestions(false);
      onLocationSelect(coordinates, result.formattedAddress, detail.place_id);
    } catch (error) {
      console.error('Place select error:', error);
      onError?.(String(error));
    }
  };
  
  /**
   * Handle focus events
   */
  const handleFocus = () => {
    setShowSuggestions(true);
    if (searchQuery.trim().length < 2) {
      loadDefaultSuggestions();
    }
  };
  
  /**
   * Handle blur events
   */
  const handleBlur = () => {
    // Delay hiding suggestions to allow for tap selection
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };
  
  /**
   * Clear search input
   */
  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    autocompleteRef.current?.setAddressText('');
  };
  
  /**
   * Render suggestion item
   */
  const renderSuggestion = ({ item }: { item: LocationSuggestion }) => (
    <Pressable
      onPress={() => handleSuggestionSelect(item)}
      _pressed={{ bg: 'gray.100' }}
    >
      <HStack space={3} p={3} alignItems="center">
        <Icon
          as={MaterialIcons}
          name={item.icon}
          size="sm"
          color={item.source === 'current' ? 'blue.500' : 
                 item.source === 'saved' ? 'green.500' :
                 item.source === 'history' ? 'gray.500' : 'purple.500'}
        />
        <VStack flex={1} space={1}>
          <Text fontSize="md" color={textColor} numberOfLines={1}>
            {item.title}
          </Text>
          <Text fontSize="sm" color={subtextColor} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </VStack>
        {item.source === 'saved' && (
          <Badge colorScheme="green" variant="subtle">
            Saved
          </Badge>
        )}
        {item.source === 'history' && (
          <Badge colorScheme="gray" variant="subtle">
            Recent
          </Badge>
        )}
      </HStack>
    </Pressable>
  );
  
  return (
    <Box style={containerStyle}>
      <VStack space={2}>
        {/* Custom Input Header with Actions */}
        <HStack space={2} alignItems="center">
          <Box flex={1}>
            <GooglePlacesAutocomplete
              ref={autocompleteRef}
              placeholder={placeholder}
              onPress={handlePlaceSelect}
              query={{
                key: process.env.GOOGLE_PLACES_API_KEY || '',
                language: 'en',
              }}
              textInputProps={{
                value: searchQuery,
                onChangeText: handleTextChange,
                onFocus: handleFocus,
                onBlur: handleBlur,
                autoFocus,
                returnKeyType: 'search',
                style: {
                  fontSize: 16,
                  color: textColor,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                  paddingHorizontal: 12,
                },
              }}
              styles={{
                container: {
                  flex: 1,
                },
                textInput: {
                  backgroundColor: bgColor,
                  borderColor: borderColor,
                  borderWidth: 1,
                  borderRadius: 8,
                  color: textColor,
                },
                listView: {
                  position: 'absolute',
                  top: 50,
                  left: 0,
                  right: 0,
                  backgroundColor: bgColor,
                  borderColor: borderColor,
                  borderWidth: 1,
                  borderTopWidth: 0,
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8,
                  maxHeight: 200,
                  zIndex: 1000,
                },
                row: {
                  padding: 12,
                  minHeight: 44,
                },
                separator: {
                  height: 1,
                  backgroundColor: borderColor,
                },
              }}
              debounce={300}
              minLength={2}
              enablePoweredByContainer={false}
              nearbyPlacesAPI="GooglePlacesSearch"
              GooglePlacesSearchQuery={{
                rankby: 'distance',
              }}
              GooglePlacesDetailsQuery={{
                fields: 'formatted_address,geometry,place_id,address_components,types',
              }}
            />
          </Box>
          
          {/* Action Buttons */}
          <HStack space={1}>
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch}>
                <Icon as={MaterialIcons} name="clear" size="md" color="gray.500" />
              </Pressable>
            )}
            
            {enableCurrentLocation && (
              <Pressable onPress={handleCurrentLocation} disabled={isGettingLocation}>
                <Icon
                  as={MaterialIcons}
                  name="my-location"
                  size="md"
                  color={isGettingLocation ? "gray.300" : "blue.500"}
                />
                {isGettingLocation && (
                  <Spinner size="sm" color="blue.500" position="absolute" />
                )}
              </Pressable>
            )}
          </HStack>
        </HStack>
        
        {/* Custom Suggestions List */}
        {showSuggestions && suggestions.length > 0 && (
          <Box
            bg={bgColor}
            borderColor={borderColor}
            borderWidth={1}
            borderRadius="md"
            maxH="300"
            shadow={1}
          >
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestion}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={true}
              ItemSeparatorComponent={() => (
                <Box h="0.5" bg={borderColor} />
              )}
            />
            {isLoading && (
              <HStack justifyContent="center" p={2}>
                <Spinner size="sm" />
              </HStack>
            )}
          </Box>
        )}
        
        {/* Loading State */}
        {isLoading && !showSuggestions && (
          <HStack justifyContent="center" p={2}>
            <Spinner size="sm" />
          </HStack>
        )}
      </VStack>
    </Box>
  );
};