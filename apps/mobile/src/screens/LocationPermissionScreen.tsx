import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { locationService, LocationPermissionStatus } from '../services/locationService';

interface LocationPermissionScreenProps {
  onPermissionGranted: () => void;
  onPermissionDenied?: () => void;
  showSkipOption?: boolean;
  title?: string;
  description?: string;
}

export const LocationPermissionScreen: React.FC<LocationPermissionScreenProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  showSkipOption = false,
  title = 'Find Local Businesses Near You',
  description = 'To help you discover amazing local businesses in your area, we need access to your location. This helps us show you the most relevant businesses nearby.',
}) => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(false);

  useEffect(() => {
    checkInitialPermissionStatus();
  }, []);

  const checkInitialPermissionStatus = async () => {
    try {
      const status = await locationService.requestLocationPermission();
      setPermissionStatus(status);
      
      if (status.granted) {
        onPermissionGranted();
      }
    } catch (error) {
      console.error('Failed to check initial permission status:', error);
    }
  };

  const handleRequestPermission = async () => {
    if (isRequesting) return;
    
    setIsRequesting(true);
    
    try {
      const status = await locationService.requestLocationPermission();
      setPermissionStatus(status);
      
      if (status.granted) {
        onPermissionGranted();
      } else if (!status.canAskAgain) {
        showSettingsAlert();
      } else {
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      Alert.alert(
        'Permission Error',
        'Unable to request location permission. Please try again.',
        [{ text: 'OK', onPress: () => setIsRequesting(false) }]
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const showSettingsAlert = () => {
    Alert.alert(
      'Location Permission Required',
      'Location access has been permanently denied. To use location-based features, please enable location permissions in your device settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => onPermissionDenied?.(),
        },
        {
          text: 'Open Settings',
          onPress: openSettings,
        },
      ]
    );
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const getPermissionStatusText = () => {
    if (!permissionStatus) return '';
    
    switch (permissionStatus.status) {
      case 'denied':
        return permissionStatus.canAskAgain 
          ? 'Location permission was denied. Tap "Allow Location Access" to try again.'
          : 'Location permission was permanently denied. Please enable it in settings.';
      case 'blocked':
        return 'Location access is blocked. Please enable it in your device settings.';
      case 'unavailable':
        return 'Location services are not available on this device.';
      default:
        return '';
    }
  };

  const getButtonText = () => {
    if (!permissionStatus) return 'Allow Location Access';
    
    switch (permissionStatus.status) {
      case 'denied':
        return permissionStatus.canAskAgain ? 'Allow Location Access' : 'Open Settings';
      case 'blocked':
        return 'Open Settings';
      case 'unavailable':
        return 'Location Unavailable';
      default:
        return 'Allow Location Access';
    }
  };

  const handleButtonPress = () => {
    if (!permissionStatus || permissionStatus.canAskAgain) {
      handleRequestPermission();
    } else {
      openSettings();
    }
  };

  const isButtonDisabled = () => {
    return isRequesting || 
           (permissionStatus?.status === 'unavailable') ||
           permissionStatus?.granted;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Location Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.locationIcon}>
            <Text style={styles.locationIconText}>📍</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          {permissionStatus && !permissionStatus.granted && (
            <Text style={styles.statusText}>{getPermissionStatusText()}</Text>
          )}
        </View>

        {/* Benefits List */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🔍</Text>
            <Text style={styles.benefitText}>Discover businesses within walking distance</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>⚡</Text>
            <Text style={styles.benefitText}>Get real-time distance and directions</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🎯</Text>
            <Text style={styles.benefitText}>See businesses currently open near you</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💡</Text>
            <Text style={styles.benefitText}>Personalized recommendations based on your area</Text>
          </View>
        </View>

        {/* Privacy Information */}
        <TouchableOpacity 
          style={styles.privacyToggle}
          onPress={() => setShowDetailedExplanation(!showDetailedExplanation)}
        >
          <Text style={styles.privacyToggleText}>
            {showDetailedExplanation ? 'Hide' : 'Learn more about'} location privacy
          </Text>
        </TouchableOpacity>

        {showDetailedExplanation && (
          <View style={styles.privacyDetails}>
            <Text style={styles.privacyText}>
              • Your location data is only used to find nearby businesses{'\n'}
              • We never store your location permanently{'\n'}
              • Location data is not shared with third parties{'\n'}
              • You can disable location access anytime in settings{'\n'}
              • The app works without location, but search results may be less relevant
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              isButtonDisabled() && styles.disabledButton
            ]}
            onPress={handleButtonPress}
            disabled={isButtonDisabled()}
          >
            <Text style={[
              styles.primaryButtonText,
              isButtonDisabled() && styles.disabledButtonText
            ]}>
              {isRequesting ? 'Requesting Permission...' : getButtonText()}
            </Text>
          </TouchableOpacity>

          {showSkipOption && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => onPermissionDenied?.()}
            >
              <Text style={styles.secondaryButtonText}>
                Continue Without Location
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Additional Help */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            Need help? Contact our support team if you're having trouble with location permissions.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  locationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  locationIconText: {
    fontSize: 36,
  },
  textContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1A1A1A',
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#FF3B30',
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  benefitsList: {
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  privacyToggle: {
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyToggleText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  privacyDetails: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#E5E5E7',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButtonText: {
    color: '#8E8E93',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
  helpSection: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default LocationPermissionScreen;