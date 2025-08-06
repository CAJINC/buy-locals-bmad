import React, { useState } from 'react';
import { VStack, FormControl, Input, Button, HStack, Text, Alert, useToast } from 'native-base';
import { FormStepProps } from '../types';
import { businessService } from '../../../../services/businessService';

export const LocationStep: React.FC<FormStepProps> = ({
  data,
  onDataChange,
  errors,
  isLoading,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'success' | 'error'>('none');
  const [validationMessage, setValidationMessage] = useState('');

  const toast = useToast();

  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleLocationChange = (field: string, value: string) => {
    const updatedLocation = {
      ...data.location,
      [field]: value,
    };
    onDataChange({ location: updatedLocation });

    // Reset validation status when user changes input
    if (validationStatus !== 'none') {
      setValidationStatus('none');
      setValidationMessage('');
    }
  };

  const validateAddress = async () => {
    const { location } = data;
    if (!location?.address || !location?.city || !location?.state || !location?.zipCode) {
      toast.show({
        title: 'Incomplete Address',
        description: 'Please fill in all address fields before validating',
        status: 'warning',
      });
      return;
    }

    setIsValidating(true);
    setValidationStatus('none');

    try {
      const result = await businessService.geocodeAddress(
        location.address,
        location.city,
        location.state,
        location.zipCode
      );

      // Update location with validated coordinates
      onDataChange({
        location: {
          ...location,
          coordinates: result.coordinates,
        },
      });

      setValidationStatus('success');
      setValidationMessage(`Address validated: ${result.formattedAddress}`);

      toast.show({
        title: 'Address Validated',
        description: 'Your address has been verified and geocoded',
        status: 'success',
      });
    } catch (error) {
      setValidationStatus('error');
      setValidationMessage(error instanceof Error ? error.message : 'Failed to validate address');

      toast.show({
        title: 'Validation Failed',
        description: 'Please check your address and try again',
        status: 'error',
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <VStack space={6}>
      <Text fontSize="lg" fontWeight="semibold" color="gray.800">
        Business Location
      </Text>

      {/* Street Address */}
      <FormControl isRequired isInvalid={!!getFieldError('location.address')}>
        <FormControl.Label>Street Address</FormControl.Label>
        <Input
          placeholder="123 Main Street"
          value={data.location?.address || ''}
          onChangeText={value => handleLocationChange('address', value)}
          size="lg"
        />
        <FormControl.ErrorMessage>{getFieldError('location.address')}</FormControl.ErrorMessage>
      </FormControl>

      {/* City and State Row */}
      <HStack space={3}>
        <FormControl flex={2} isRequired isInvalid={!!getFieldError('location.city')}>
          <FormControl.Label>City</FormControl.Label>
          <Input
            placeholder="City"
            value={data.location?.city || ''}
            onChangeText={value => handleLocationChange('city', value)}
            size="lg"
          />
          <FormControl.ErrorMessage>{getFieldError('location.city')}</FormControl.ErrorMessage>
        </FormControl>

        <FormControl flex={1} isRequired isInvalid={!!getFieldError('location.state')}>
          <FormControl.Label>State</FormControl.Label>
          <Input
            placeholder="CA"
            value={data.location?.state || ''}
            onChangeText={value => handleLocationChange('state', value.toUpperCase())}
            maxLength={2}
            size="lg"
            autoCapitalize="characters"
          />
          <FormControl.ErrorMessage>{getFieldError('location.state')}</FormControl.ErrorMessage>
        </FormControl>
      </HStack>

      {/* ZIP Code */}
      <FormControl isRequired isInvalid={!!getFieldError('location.zipCode')}>
        <FormControl.Label>ZIP Code</FormControl.Label>
        <Input
          placeholder="12345"
          value={data.location?.zipCode || ''}
          onChangeText={value => handleLocationChange('zipCode', value)}
          keyboardType="numeric"
          maxLength={10}
          size="lg"
        />
        <FormControl.ErrorMessage>{getFieldError('location.zipCode')}</FormControl.ErrorMessage>
      </FormControl>

      {/* Address Validation */}
      <VStack space={3}>
        <Button
          onPress={validateAddress}
          isLoading={isValidating}
          loadingText="Validating..."
          isDisabled={isLoading}
          variant="outline"
          colorScheme="blue"
        >
          Validate Address
        </Button>

        {validationStatus === 'success' && (
          <Alert status="success" variant="left-accent">
            <Alert.Icon />
            <Text fontSize="sm">{validationMessage}</Text>
          </Alert>
        )}

        {validationStatus === 'error' && (
          <Alert status="error" variant="left-accent">
            <Alert.Icon />
            <Text fontSize="sm">{validationMessage}</Text>
          </Alert>
        )}

        <Text fontSize="xs" color="gray.600">
          Address validation helps customers find your business and improves search results.
        </Text>
      </VStack>

      {/* Coordinates Display (if available) */}
      {data.location?.coordinates && (
        <VStack space={2} bg="gray.50" p={3} rounded="md">
          <Text fontSize="sm" fontWeight="semibold" color="gray.700">
            Location Coordinates:
          </Text>
          <Text fontSize="xs" color="gray.600">
            Latitude: {data.location.coordinates.lat.toFixed(6)}
          </Text>
          <Text fontSize="xs" color="gray.600">
            Longitude: {data.location.coordinates.lng.toFixed(6)}
          </Text>
        </VStack>
      )}
    </VStack>
  );
};
