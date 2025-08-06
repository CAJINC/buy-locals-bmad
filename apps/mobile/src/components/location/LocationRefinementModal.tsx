import React, { useState, useRef } from 'react';
import { 
  Modal, 
  VStack, 
  HStack, 
  Text, 
  Button, 
  Input, 
  TextArea,
  Slider,
  Icon,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'native-base';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LocationCoordinates } from '../../services/locationService';

interface LocationRefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalLocation: LocationCoordinates;
  onRefine: (
    refinedLocation: LocationCoordinates, 
    method: 'manual_pin' | 'address_search' | 'landmark_selection' | 'map_tap',
    confidence: number,
    notes?: string
  ) => void;
}

export const LocationRefinementModal: React.FC<LocationRefinementModalProps> = ({
  isOpen,
  onClose,
  originalLocation,
  onRefine
}) => {
  const [refinementMethod, setRefinementMethod] = useState<'coordinates' | 'address' | 'landmark'>('coordinates');
  const [latitude, setLatitude] = useState(originalLocation.latitude.toString());
  const [longitude, setLongitude] = useState(originalLocation.longitude.toString());
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [confidence, setConfidence] = useState(75);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');

  const initialRef = useRef(null);

  const validateCoordinates = (lat: string, lng: string): boolean => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      setValidationError('Please enter valid numeric coordinates');
      return false;
    }
    
    if (latNum < -90 || latNum > 90) {
      setValidationError('Latitude must be between -90 and 90 degrees');
      return false;
    }
    
    if (lngNum < -180 || lngNum > 180) {
      setValidationError('Longitude must be between -180 and 180 degrees');
      return false;
    }
    
    setValidationError('');
    return true;
  };

  const handleRefine = async () => {
    setIsProcessing(true);
    setValidationError('');

    try {
      let refinedLocation: LocationCoordinates;
      let method: 'manual_pin' | 'address_search' | 'landmark_selection' | 'map_tap';

      switch (refinementMethod) {
        case 'coordinates':
          if (!validateCoordinates(latitude, longitude)) {
            setIsProcessing(false);
            return;
          }
          
          refinedLocation = {
            ...originalLocation,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            timestamp: Date.now(),
            accuracy: Math.max(10, originalLocation.accuracy * 0.5) // Improved accuracy
          };
          method = 'manual_pin';
          break;

        case 'address':
          if (!address.trim()) {
            setValidationError('Please enter an address');
            setIsProcessing(false);
            return;
          }
          
          // In a real implementation, this would geocode the address
          // For now, we'll use the original location with slight adjustment
          refinedLocation = {
            ...originalLocation,
            timestamp: Date.now(),
            accuracy: Math.max(25, originalLocation.accuracy * 0.7)
          };
          method = 'address_search';
          break;

        case 'landmark':
          if (!landmark.trim()) {
            setValidationError('Please enter a landmark');
            setIsProcessing(false);
            return;
          }
          
          // In a real implementation, this would search for the landmark
          refinedLocation = {
            ...originalLocation,
            timestamp: Date.now(),
            accuracy: Math.max(50, originalLocation.accuracy * 0.8)
          };
          method = 'landmark_selection';
          break;

        default:
          setValidationError('Please select a refinement method');
          setIsProcessing(false);
          return;
      }

      await onRefine(refinedLocation, method, confidence, notes || undefined);
      onClose();
      
    } catch (error) {
      setValidationError('Failed to refine location. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAccuracy = (accuracy: number): string => {
    if (accuracy < 1000) {
      return `±${Math.round(accuracy)}m`;
    } else {
      return `±${(accuracy / 1000).toFixed(1)}km`;
    }
  };

  const renderCoordinatesInput = () => (
    <VStack space={3}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
        Enter Precise Coordinates
      </Text>
      
      <HStack space={3}>
        <VStack flex={1} space={1}>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Latitude</Text>
          <Input
            value={latitude}
            onChangeText={setLatitude}
            placeholder="-90.000000"
            keyboardType="numeric"
            size="md"
          />
        </VStack>
        
        <VStack flex={1} space={1}>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Longitude</Text>
          <Input
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-180.000000"
            keyboardType="numeric"
            size="md"
          />
        </VStack>
      </HStack>

      <Text style={{ fontSize: 12, color: '#6B7280' }}>
        Current: {originalLocation.latitude.toFixed(6)}, {originalLocation.longitude.toFixed(6)}
      </Text>
    </VStack>
  );

  const renderAddressInput = () => (
    <VStack space={3}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
        Enter Street Address
      </Text>
      
      <Input
        ref={initialRef}
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, City, State 12345"
        size="md"
      />

      <Text style={{ fontSize: 12, color: '#6B7280' }}>
        We'll convert this address to coordinates automatically
      </Text>
    </VStack>
  );

  const renderLandmarkInput = () => (
    <VStack space={3}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
        Enter Nearby Landmark
      </Text>
      
      <Input
        value={landmark}
        onChangeText={setLandmark}
        placeholder="Central Park, Statue of Liberty, etc."
        size="md"
      />

      <Text style={{ fontSize: 12, color: '#6B7280' }}>
        Enter a well-known landmark or business near your location
      </Text>
    </VStack>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <Modal.Content maxWidth="400px">
        <Modal.CloseButton />
        <Modal.Header>
          <HStack space={2} alignItems="center">
            <Icon as={MaterialIcons} name="edit-location" size="md" color="blue.600" />
            <Text style={{ fontSize: 18, fontWeight: '600' }}>
              Refine Location
            </Text>
          </HStack>
        </Modal.Header>

        <Modal.Body>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView>
              <VStack space={4}>
                {/* Current Location Info */}
                <VStack space={2} p={3} bg="gray.50" rounded="lg">
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                    Current Location Accuracy
                  </Text>
                  <HStack justifyContent="space-between">
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Accuracy:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500' }}>
                      {formatAccuracy(originalLocation.accuracy)}
                    </Text>
                  </HStack>
                  <Text style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                    Refining your location can improve search results and recommendations
                  </Text>
                </VStack>

                {/* Method Selection */}
                <VStack space={3}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
                    Refinement Method
                  </Text>
                  
                  <VStack space={2}>
                    <Button
                      variant={refinementMethod === 'coordinates' ? 'solid' : 'outline'}
                      onPress={() => setRefinementMethod('coordinates')}
                      leftIcon={<Icon as={MaterialIcons} name="my-location" />}
                      justifyContent="flex-start"
                    >
                      Precise Coordinates
                    </Button>
                    
                    <Button
                      variant={refinementMethod === 'address' ? 'solid' : 'outline'}
                      onPress={() => setRefinementMethod('address')}
                      leftIcon={<Icon as={MaterialIcons} name="home" />}
                      justifyContent="flex-start"
                    >
                      Street Address
                    </Button>
                    
                    <Button
                      variant={refinementMethod === 'landmark' ? 'solid' : 'outline'}
                      onPress={() => setRefinementMethod('landmark')}
                      leftIcon={<Icon as={MaterialIcons} name="place" />}
                      justifyContent="flex-start"
                    >
                      Nearby Landmark
                    </Button>
                  </VStack>
                </VStack>

                {/* Input Fields */}
                <VStack space={3}>
                  {refinementMethod === 'coordinates' && renderCoordinatesInput()}
                  {refinementMethod === 'address' && renderAddressInput()}
                  {refinementMethod === 'landmark' && renderLandmarkInput()}
                </VStack>

                {/* Confidence Slider */}
                <VStack space={3}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                      Confidence Level
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                      {confidence}%
                    </Text>
                  </HStack>
                  
                  <Slider
                    value={confidence}
                    onChange={setConfidence}
                    minValue={0}
                    maxValue={100}
                    step={5}
                    colorScheme="blue"
                  >
                    <Slider.Track>
                      <Slider.FilledTrack />
                    </Slider.Track>
                    <Slider.Thumb />
                  </Slider>
                  
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>
                    How confident are you in this location refinement?
                  </Text>
                </VStack>

                {/* Notes */}
                <VStack space={2}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                    Notes (Optional)
                  </Text>
                  <TextArea
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add any additional notes about this location refinement..."
                    numberOfLines={3}
                    maxLength={200}
                  />
                </VStack>

                {/* Validation Error */}
                {validationError && (
                  <Alert status="error" colorScheme="error">
                    <HStack space={2} alignItems="center">
                      <Alert.Icon />
                      <Text style={{ fontSize: 14, color: '#DC2626' }}>
                        {validationError}
                      </Text>
                    </HStack>
                  </Alert>
                )}
              </VStack>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal.Body>

        <Modal.Footer>
          <Button.Group space={2}>
            <Button 
              variant="ghost" 
              colorScheme="blueGray" 
              onPress={onClose}
              isDisabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onPress={handleRefine}
              isLoading={isProcessing}
              leftIcon={<Icon as={MaterialIcons} name="check" />}
            >
              Refine Location
            </Button>
          </Button.Group>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};