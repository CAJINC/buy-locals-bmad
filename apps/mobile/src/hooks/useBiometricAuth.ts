import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { logger } from '../utils/logger';

// Note: In a real implementation, you would install and use react-native-biometrics
// or a similar library. This is a simplified implementation for demonstration.

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: 'TouchID' | 'FaceID' | 'Fingerprint' | 'None';
  isEnrolled: boolean;
  error?: string;
}

interface UseBiometricAuthReturn {
  capability: BiometricCapability;
  isChecking: boolean;
  authenticate: (reason: string) => Promise<boolean>;
  checkCapability: () => Promise<void>;
}

/**
 * useBiometricAuth Hook
 * 
 * Provides biometric authentication functionality including:
 * - Checking device biometric capabilities
 * - Performing biometric authentication
 * - Handling different biometric types (Touch ID, Face ID, Fingerprint)
 */
export const useBiometricAuth = (): UseBiometricAuthReturn => {
  const [capability, setCapability] = useState<BiometricCapability>({
    isAvailable: false,
    biometricType: 'None',
    isEnrolled: false,
  });
  const [isChecking, setIsChecking] = useState(false);

  // Simulate checking biometric capability
  // In a real app, this would use a library like react-native-biometrics
  const simulateCapabilityCheck = useCallback(async (): Promise<BiometricCapability> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate device capabilities based on platform
    if (Platform.OS === 'ios') {
      // Simulate iOS devices having Face ID or Touch ID
      const hasFaceID = Math.random() > 0.5; // 50% chance
      const hasEnrollment = Math.random() > 0.2; // 80% chance of enrollment

      return {
        isAvailable: true,
        biometricType: hasFaceID ? 'FaceID' : 'TouchID',
        isEnrolled: hasEnrollment,
      };
    } else {
      // Simulate Android devices having fingerprint
      const hasFingerprint = Math.random() > 0.3; // 70% chance
      const hasEnrollment = hasFingerprint ? Math.random() > 0.2 : false; // 80% chance if available

      return {
        isAvailable: hasFingerprint,
        biometricType: hasFingerprint ? 'Fingerprint' : 'None',
        isEnrolled: hasEnrollment,
        error: !hasFingerprint ? 'Biometric authentication not available on this device' : undefined,
      };
    }
  }, []);

  // Check biometric capability
  const checkCapability = useCallback(async (): Promise<void> => {
    setIsChecking(true);

    try {
      logger.debug('Checking biometric capability');

      const cap = await simulateCapabilityCheck();
      
      setCapability(cap);

      logger.info('Biometric capability checked', {
        isAvailable: cap.isAvailable,
        biometricType: cap.biometricType,
        isEnrolled: cap.isEnrolled,
        platform: Platform.OS,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setCapability({
        isAvailable: false,
        biometricType: 'None',
        isEnrolled: false,
        error: errorMessage,
      });

      logger.error('Failed to check biometric capability', {
        error: errorMessage,
        platform: Platform.OS,
      });
    } finally {
      setIsChecking(false);
    }
  }, [simulateCapabilityCheck]);

  // Perform biometric authentication
  const authenticate = useCallback(async (reason: string): Promise<boolean> => {
    if (!capability.isAvailable || !capability.isEnrolled) {
      throw new Error('Biometric authentication not available or not enrolled');
    }

    try {
      logger.info('Starting biometric authentication', {
        biometricType: capability.biometricType,
        reason,
      });

      // Simulate biometric authentication
      // In a real app, this would use the biometric library
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate auth delay

      // Simulate success/failure (85% success rate for demo)
      const success = Math.random() > 0.15;

      if (success) {
        logger.info('Biometric authentication successful', {
          biometricType: capability.biometricType,
        });
        return true;
      } else {
        logger.warn('Biometric authentication failed', {
          biometricType: capability.biometricType,
        });
        return false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      logger.error('Biometric authentication error', {
        error: errorMessage,
        biometricType: capability.biometricType,
      });

      throw error;
    }
  }, [capability]);

  // Check capability on mount
  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

  return {
    capability,
    isChecking,
    authenticate,
    checkCapability,
  };
};

/**
 * Utility function to show biometric prompt
 */
export const showBiometricPrompt = (
  biometricType: BiometricCapability['biometricType'],
  onSuccess: () => void,
  onError: (error: string) => void,
  onCancel: () => void
): void => {
  const getBiometricName = () => {
    switch (biometricType) {
      case 'TouchID':
        return 'Touch ID';
      case 'FaceID':
        return 'Face ID';
      case 'Fingerprint':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  };

  const getInstructionText = () => {
    switch (biometricType) {
      case 'TouchID':
        return 'Place your finger on the Touch ID sensor to authenticate';
      case 'FaceID':
        return 'Look at your device to authenticate with Face ID';
      case 'Fingerprint':
        return 'Place your finger on the fingerprint sensor to authenticate';
      default:
        return 'Use your biometric authentication to proceed';
    }
  };

  Alert.alert(
    `${getBiometricName()} Authentication`,
    getInstructionText(),
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'Authenticate',
        onPress: async () => {
          try {
            // This would be replaced with actual biometric authentication
            const success = await new Promise<boolean>(resolve => {
              setTimeout(() => resolve(Math.random() > 0.2), 1500);
            });

            if (success) {
              onSuccess();
            } else {
              onError('Authentication failed. Please try again.');
            }
          } catch (error) {
            onError(error instanceof Error ? error.message : 'Authentication error');
          }
        },
      },
    ]
  );
};

/**
 * Check if device supports biometric authentication
 */
export const isBiometricSupported = (): boolean => {
  // In a real app, this would check actual device capabilities
  // For demo purposes, we'll assume most modern devices support it
  return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 23);
};