import React, { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { 
  VStack, 
  HStack, 
  Text, 
  Button, 
  Icon, 
  Alert as NativeAlert,
  Progress,
  Badge,
  Divider,
  ScrollView
} from 'native-base';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LocationPermissionDeniedFlow as LocationPermissionDeniedFlowType } from '../../services/locationService';

interface LocationPermissionDeniedFlowProps {
  permissionFlow: LocationPermissionDeniedFlowType;
  onRetryPermission?: () => void;
  onUseIPLocation?: () => void;
  onManualEntry?: () => void;
  onZipCodeEntry?: () => void;
  onCitySelection?: () => void;
  onSettingsOpen?: () => void;
}

export const LocationPermissionDeniedFlow: React.FC<LocationPermissionDeniedFlowProps> = ({
  permissionFlow,
  onRetryPermission,
  onUseIPLocation,
  onManualEntry,
  onZipCodeEntry,
  onCitySelection,
  onSettingsOpen
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [educationShown, setEducationShown] = useState(permissionFlow.userEducationShown);

  const getDenialSeverity = () => {
    switch (permissionFlow.denialType) {
      case 'soft': return { color: 'warning.500', text: 'Temporary', severity: 'Low' };
      case 'hard': return { color: 'error.500', text: 'Repeated', severity: 'Medium' };
      case 'system_settings': return { color: 'error.700', text: 'Permanent', severity: 'High' };
      default: return { color: 'gray.500', text: 'Unknown', severity: 'Unknown' };
    }
  };

  const openDeviceSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
    onSettingsOpen?.();
  };

  const handleRetryPermission = async () => {
    if (!permissionFlow.canRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetryPermission?.();
    } finally {
      setIsRetrying(false);
    }
  };

  const renderEducationalContent = () => {
    if (educationShown) return null;

    return (
      <VStack space={3} p={4} bg="blue.50" rounded="lg" mb={4}>
        <HStack alignItems="center" space={2}>
          <Icon as={MaterialIcons} name="info" color="blue.600" size="md" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1E40AF' }}>
            Why Location Access?
          </Text>
        </HStack>
        
        <Text style={{ fontSize: 14, color: '#1E3A8A', lineHeight: 20 }}>
          Buy Locals uses your location to show nearby businesses and provide personalized recommendations. 
          Your location data stays on your device and is only used to enhance your shopping experience.
        </Text>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onPress={() => setEducationShown(true)}
          _text={{ color: 'blue.600', fontSize: 12 }}
        >
          Got it, don't show again
        </Button>
      </VStack>
    );
  };

  const renderFallbackOptions = () => {
    const severity = getDenialSeverity();
    
    return (
      <VStack space={3}>
        <VStack space={2}>
          <HStack justifyContent="space-between" alignItems="center">
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
              Permission Status
            </Text>
            <Badge colorScheme={severity.color.split('.')[0]} variant="solid">
              {severity.text}
            </Badge>
          </HStack>
          
          <HStack space={2} alignItems="center">
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              Attempts: {permissionFlow.retryAttempts}/{permissionFlow.maxRetryAttempts}
            </Text>
            <Progress 
              value={(permissionFlow.retryAttempts / permissionFlow.maxRetryAttempts) * 100}
              size="sm"
              colorScheme={severity.color.split('.')[0]}
              flex={1}
            />
          </HStack>
        </VStack>

        <Divider />

        <VStack space={2}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
            Continue Without GPS
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>
            Choose an alternative way to set your location:
          </Text>
        </VStack>

        <VStack space={3}>
          {permissionFlow.fallbackOptions.includes('ip_location') && (
            <Button
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="wifi-tethering" />}
              onPress={onUseIPLocation}
              _text={{ color: 'blue.600' }}
              borderColor="blue.300"
            >
              Use Approximate Location (IP-based)
            </Button>
          )}

          {permissionFlow.fallbackOptions.includes('manual_entry') && (
            <Button
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="edit-location" />}
              onPress={onManualEntry}
              _text={{ color: 'green.600' }}
              borderColor="green.300"
            >
              Enter Address Manually
            </Button>
          )}

          {permissionFlow.fallbackOptions.includes('zip_code') && (
            <Button
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="pin-drop" />}
              onPress={onZipCodeEntry}
              _text={{ color: 'purple.600' }}
              borderColor="purple.300"
            >
              Enter ZIP Code
            </Button>
          )}

          {permissionFlow.fallbackOptions.includes('city_selection') && (
            <Button
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="location-city" />}
              onPress={onCitySelection}
              _text={{ color: 'orange.600' }}
              borderColor="orange.300"
            >
              Browse by City
            </Button>
          )}
        </VStack>
      </VStack>
    );
  };

  const renderRetrySection = () => {
    if (!permissionFlow.canRetry && permissionFlow.denialType !== 'system_settings') {
      return null;
    }

    return (
      <VStack space={3} mt={4}>
        <Divider />
        
        {permissionFlow.denialType === 'system_settings' ? (
          <VStack space={3}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
              Enable in Settings
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              To use GPS location, you'll need to enable location permissions in your device settings.
            </Text>
            
            <Button
              colorScheme="blue"
              leftIcon={<Icon as={MaterialIcons} name="settings" />}
              onPress={openDeviceSettings}
            >
              Open Settings
            </Button>
          </VStack>
        ) : (
          <VStack space={3}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
              Try Again
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              You can try requesting location permission again.
            </Text>
            
            <Button
              colorScheme="blue"
              leftIcon={<Icon as={MaterialIcons} name="refresh" />}
              onPress={handleRetryPermission}
              isLoading={isRetrying}
              isDisabled={!permissionFlow.canRetry}
            >
              Request Permission Again
            </Button>
          </VStack>
        )}
      </VStack>
    );
  };

  return (
    <ScrollView flex={1} bg="gray.50">
      <VStack space={4} p={4}>
        {/* Header */}
        <VStack space={2} alignItems="center">
          <Icon 
            as={MaterialIcons} 
            name="location-off" 
            size="4xl" 
            color="error.500" 
          />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', textAlign: 'center' }}>
            Location Access Denied
          </Text>
          <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
            We need location access to show you nearby businesses
          </Text>
        </VStack>

        {/* Educational Content */}
        {renderEducationalContent()}

        {/* Alert */}
        <NativeAlert status="warning" colorScheme="warning">
          <VStack space={1} flexShrink={1} w="100%">
            <HStack flexShrink={1} space={2} justifyContent="space-between" alignItems="center">
              <HStack space={2} flexShrink={1}>
                <NativeAlert.Icon />
                <Text style={{ fontSize: 14, color: '#92400E' }}>
                  Without location access, you'll need to manually specify where to search for businesses.
                </Text>
              </HStack>
            </HStack>
          </VStack>
        </NativeAlert>

        {/* Main Content */}
        <VStack space={4} bg="white" p={4} rounded="lg" shadow={1}>
          {renderFallbackOptions()}
          {renderRetrySection()}
        </VStack>

        {/* Footer */}
        <VStack space={2} alignItems="center" mt={4}>
          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Your privacy is important to us. Location data is only used to enhance your shopping experience.
          </Text>
        </VStack>
      </VStack>
    </ScrollView>
  );
};