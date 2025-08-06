import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
  Center,
  Alert,
  Pressable,
  Icon,
  useColorModeValue,
  useToast,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions, Platform, Alert as RNAlert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Business } from 'packages/shared/src/types/business';

const { width: screenWidth } = Dimensions.get('window');

export interface LocationMapProps {
  business: Business;
  showDirectionsButton?: boolean;
  showAddressCopy?: boolean;
  showParkingInfo?: boolean;
  showAccessibilityInfo?: boolean;
  mapHeight?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  customMarkerColor?: string;
  onDirectionsPress?: (address: string) => void;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  business,
  showDirectionsButton = true,
  showAddressCopy = true,
  showParkingInfo = true,
  showAccessibilityInfo = true,
  mapHeight = 200,
  enableZoom = true,
  enablePan = true,
  customMarkerColor = '#3182CE',
  onDirectionsPress,
  onMapPress,
}) => {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const toast = useToast();
  
  // Theme-based colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.300');

  // Memoized location data
  const locationData = useMemo(() => {
    if (!business?.location) return null;
    
    const { location } = business;
    const fullAddress = `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`;
    
    return {
      coordinate: {
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
      },
      fullAddress,
      hasCoordinates: location.latitude && location.longitude,
    };
  }, [business?.location]);

  // Map region configuration
  const mapRegion = useMemo(() => {
    if (!locationData?.hasCoordinates) return null;
    
    return {
      ...locationData.coordinate,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [locationData]);

  // Handle directions navigation
  const handleDirections = useCallback(async () => {
    if (!locationData) return;

    try {
      const { coordinate, fullAddress } = locationData;
      
      if (onDirectionsPress) {
        onDirectionsPress(fullAddress);
        return;
      }

      // Try to open in native maps app with coordinates
      if (locationData.hasCoordinates) {
        const url = Platform.select({
          ios: `maps:${coordinate.latitude},${coordinate.longitude}`,
          android: `geo:${coordinate.latitude},${coordinate.longitude}?q=${encodeURIComponent(fullAddress)}`,
        });

        if (url) {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            return;
          }
        }
      }

      // Fallback to address-based maps URLs
      const fallbackUrl = Platform.select({
        ios: `maps:?q=${encodeURIComponent(fullAddress)}`,
        android: `geo:0,0?q=${encodeURIComponent(fullAddress)}`,
      });

      if (fallbackUrl) {
        const canOpen = await Linking.canOpenURL(fallbackUrl);
        if (canOpen) {
          await Linking.openURL(fallbackUrl);
        } else {
          // Final fallback to web maps
          const webUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}`;
          await Linking.openURL(webUrl);
        }
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      toast.show({
        title: 'Error',
        description: 'Unable to open directions',
        status: 'error',
        duration: 3000,
      });
    }
  }, [locationData, onDirectionsPress, toast]);

  // Handle address copy to clipboard
  const handleCopyAddress = useCallback(() => {
    if (!locationData?.fullAddress) return;

    Clipboard.setString(locationData.fullAddress);
    toast.show({
      title: 'Copied',
      description: 'Address copied to clipboard',
      status: 'success',
      duration: 2000,
    });
  }, [locationData?.fullAddress, toast]);

  // Handle map loading states
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setMapError(null);
  }, []);

  const handleMapError = useCallback((error: any) => {
    console.error('Map error:', error);
    setMapError('Failed to load map');
    setMapReady(true);
  }, []);

  // Handle map press
  const handleMapPress = useCallback((event: any) => {
    if (!enablePan) return;
    
    const coordinate = event.nativeEvent.coordinate;
    onMapPress?.(coordinate);
  }, [enablePan, onMapPress]);

  if (!business?.location) {
    return (
      <Alert w="100%" status="warning">
        <VStack space={2} flexShrink={1} w="100%" alignItems="center">
          <Alert.Icon />
          <Text fontSize="sm" color="warning.600">
            Location information not available
          </Text>
        </VStack>
      </Alert>
    );
  }

  if (!locationData?.hasCoordinates && !mapError) {
    return (
      <VStack space={4} bg={bgColor} borderRadius="lg" borderWidth={1} borderColor={borderColor} p={4}>
        <HStack space={3} alignItems="center">
          <Icon as={MaterialIcons} name="location-on" size="md" color="blue.500" />
          <VStack flex={1} space={1}>
            <Text fontWeight="medium" color={textColor} fontSize="md">
              Address
            </Text>
            <Text color={subtextColor} fontSize="sm">
              {locationData?.fullAddress}
            </Text>
            {showAddressCopy && (
              <Pressable onPress={handleCopyAddress} hitSlop={8}>
                <Text color="blue.600" fontSize="xs" fontWeight="medium">
                  Tap to copy address
                </Text>
              </Pressable>
            )}
          </VStack>
        </HStack>
        
        {showDirectionsButton && (
          <Button
            variant="outline"
            colorScheme="blue"
            size="sm"
            leftIcon={<Icon as={MaterialIcons} name="directions" />}
            onPress={handleDirections}
          >
            Get Directions
          </Button>
        )}
      </VStack>
    );
  }

  return (
    <VStack space={4} bg={bgColor} borderRadius="lg" borderWidth={1} borderColor={borderColor} overflow="hidden">
      {/* Map Container */}
      <Box position="relative" height={mapHeight}>
        {!mapReady && (
          <Center position="absolute" top={0} left={0} right={0} bottom={0} bg={bgColor} zIndex={2}>
            <VStack space={2} alignItems="center">
              <Spinner size="lg" color="blue.500" />
              <Text fontSize="sm" color={subtextColor}>
                Loading map...
              </Text>
            </VStack>
          </Center>
        )}

        {mapError ? (
          <Center flex={1} bg={bgColor}>
            <VStack space={2} alignItems="center" px={4}>
              <Icon as={MaterialIcons} name="error-outline" size="lg" color="error.500" />
              <Text fontSize="sm" color="error.500" textAlign="center">
                {mapError}
              </Text>
              <Button
                size="sm"
                variant="outline"
                colorScheme="error"
                onPress={() => {
                  setMapError(null);
                  setMapReady(false);
                }}
              >
                Retry
              </Button>
            </VStack>
          </Center>
        ) : (
          mapRegion && (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              region={mapRegion}
              zoomEnabled={enableZoom}
              scrollEnabled={enablePan}
              rotateEnabled={enablePan}
              pitchEnabled={enablePan}
              onMapReady={handleMapReady}
              onError={handleMapError}
              onPress={handleMapPress}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              mapType="standard"
              accessible={true}
              accessibilityLabel={`Map showing location of ${business.name}`}
              accessibilityHint="Double tap to interact with map"
            >
              <Marker
                coordinate={locationData.coordinate}
                title={business.name}
                description={locationData.fullAddress}
                pinColor={customMarkerColor}
                identifier="business-location"
                accessible={true}
                accessibilityLabel={`${business.name} location marker`}
              />
            </MapView>
          )
        )}
      </Box>

      {/* Address and Action Section */}
      <VStack space={3} p={4}>
        {/* Address Display */}
        <HStack space={3} alignItems="flex-start">
          <Icon as={MaterialIcons} name="location-on" size="md" color="blue.500" mt={0.5} />
          <VStack flex={1} space={1}>
            <Text fontWeight="medium" color={textColor} fontSize="md">
              Address
            </Text>
            <Text color={subtextColor} fontSize="sm" lineHeight="lg">
              {locationData?.fullAddress}
            </Text>
            {showAddressCopy && (
              <Pressable onPress={handleCopyAddress} hitSlop={8}>
                <HStack space={1} alignItems="center" mt={1}>
                  <Icon as={MaterialIcons} name="content-copy" size="xs" color="blue.600" />
                  <Text color="blue.600" fontSize="xs" fontWeight="medium">
                    Copy address
                  </Text>
                </HStack>
              </Pressable>
            )}
          </VStack>
        </HStack>

        {/* Parking Information */}
        {showParkingInfo && business.amenities?.parking && (
          <HStack space={3} alignItems="flex-start">
            <Icon as={MaterialIcons} name="local-parking" size="md" color="green.500" mt={0.5} />
            <VStack flex={1} space={1}>
              <Text fontWeight="medium" color={textColor} fontSize="sm">
                Parking
              </Text>
              <Text color={subtextColor} fontSize="xs">
                {business.amenities.parking.type || 'Available'}
                {business.amenities.parking.cost && ` • ${business.amenities.parking.cost}`}
              </Text>
            </VStack>
          </HStack>
        )}

        {/* Accessibility Information */}
        {showAccessibilityInfo && business.amenities?.accessibility && (
          <HStack space={3} alignItems="flex-start">
            <Icon as={MaterialIcons} name="accessible" size="md" color="blue.500" mt={0.5} />
            <VStack flex={1} space={1}>
              <Text fontWeight="medium" color={textColor} fontSize="sm">
                Accessibility
              </Text>
              <Text color={subtextColor} fontSize="xs">
                {business.amenities.accessibility.wheelchairAccessible && 'Wheelchair accessible'}
                {business.amenities.accessibility.notes && ` • ${business.amenities.accessibility.notes}`}
              </Text>
            </VStack>
          </HStack>
        )}

        {/* Directions Button */}
        {showDirectionsButton && (
          <Button
            variant="solid"
            colorScheme="blue"
            size="md"
            leftIcon={<Icon as={MaterialIcons} name="directions" />}
            onPress={handleDirections}
            accessible={true}
            accessibilityLabel={`Get directions to ${business.name}`}
            accessibilityHint="Opens navigation app with directions"
          >
            Get Directions
          </Button>
        )}
      </VStack>
    </VStack>
  );
};