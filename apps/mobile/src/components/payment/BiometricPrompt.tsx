import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { styles } from './styles';
import { logger } from '../../utils/logger';

// Note: In a real implementation, you would install and use react-native-biometrics
// or a similar library. For this implementation, we'll simulate the biometric check.

export interface BiometricPromptProps {
  onSuccess: () => void;
  onCancel: () => void;
  onFallback?: () => void;
  title?: string;
  subtitle?: string;
  description?: string;
  theme?: 'light' | 'dark';
  biometricType?: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometric';
}

/**
 * BiometricPrompt Component
 * 
 * Prompts user for biometric authentication when using saved payment methods
 * Supports Touch ID, Face ID, and Android fingerprint authentication
 */
export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  onSuccess,
  onCancel,
  onFallback,
  title = 'Authenticate Payment',
  subtitle = 'Verify your identity to proceed',
  description = 'Use your biometric authentication to confirm this payment',
  theme = 'light',
  biometricType = Platform.OS === 'ios' ? 'FaceID' : 'Fingerprint',
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authAttempts, setAuthAttempts] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    // Auto-start biometric authentication when component mounts
    handleBiometricAuth();
  }, []);

  // Get biometric icon based on type
  const getBiometricIcon = useCallback(() => {
    switch (biometricType) {
      case 'TouchID':
        return '👆';
      case 'FaceID':
        return '👤';
      case 'Fingerprint':
        return '👆';
      default:
        return '🔐';
    }
  }, [biometricType]);

  // Get biometric instruction text
  const getBiometricInstruction = useCallback(() => {
    switch (biometricType) {
      case 'TouchID':
        return 'Place your finger on the Touch ID sensor';
      case 'FaceID':
        return 'Look at your device to authenticate with Face ID';
      case 'Fingerprint':
        return 'Place your finger on the fingerprint sensor';
      default:
        return 'Use your device biometric authentication';
    }
  }, [biometricType]);

  // Simulate biometric authentication
  // In a real app, this would use react-native-biometrics or similar
  const performBiometricAuth = useCallback(async (): Promise<boolean> => {
    // Simulate authentication delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate success/failure (80% success rate for demo)
    const success = Math.random() > 0.2;
    
    return success;
  }, []);

  // Handle biometric authentication
  const handleBiometricAuth = useCallback(async () => {
    if (isAuthenticating || authAttempts >= maxAttempts) {
      return;
    }

    setIsAuthenticating(true);
    const newAttempts = authAttempts + 1;
    setAuthAttempts(newAttempts);

    try {
      logger.info('Starting biometric authentication', {
        biometricType,
        attempt: newAttempts,
      });

      const authSuccess = await performBiometricAuth();

      if (authSuccess) {
        logger.info('Biometric authentication successful', {
          biometricType,
          attempt: newAttempts,
        });
        onSuccess();
      } else {
        logger.warn('Biometric authentication failed', {
          biometricType,
          attempt: newAttempts,
          attemptsRemaining: maxAttempts - newAttempts,
        });

        if (newAttempts >= maxAttempts) {
          Alert.alert(
            'Authentication Failed',
            'Too many failed attempts. Please use an alternative payment method or try again later.',
            [
              {
                text: 'Use Password',
                onPress: onFallback,
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: onCancel,
              },
            ]
          );
        } else {
          Alert.alert(
            'Authentication Failed',
            `Authentication failed. ${maxAttempts - newAttempts} attempts remaining.`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  setIsAuthenticating(false);
                  // Small delay before retry
                  setTimeout(() => handleBiometricAuth(), 500);
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: onCancel,
              },
            ]
          );
        }
      }
    } catch (error) {
      logger.error('Biometric authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        biometricType,
        attempt: newAttempts,
      });

      Alert.alert(
        'Authentication Error',
        'Biometric authentication is not available. Please use an alternative payment method.',
        [
          {
            text: 'Use Password',
            onPress: onFallback,
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: onCancel,
          },
        ]
      );
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating, authAttempts, biometricType, onSuccess, onCancel, onFallback, performBiometricAuth]);

  // Handle manual retry
  const handleRetry = useCallback(() => {
    if (authAttempts < maxAttempts) {
      handleBiometricAuth();
    }
  }, [authAttempts, handleBiometricAuth]);

  return (
    <View style={[styles.biometricPrompt, theme === 'dark' && styles.biometricPromptDark]}>
      {/* Biometric Icon */}
      <Text style={styles.biometricIcon}>{getBiometricIcon()}</Text>

      {/* Title and Description */}
      <Text style={[styles.biometricTitle, theme === 'dark' && styles.biometricTitleDark]}>
        {title}
      </Text>
      
      <Text style={[styles.biometricDescription, theme === 'dark' && styles.biometricDescriptionDark]}>
        {subtitle}
      </Text>

      {/* Instructions */}
      <Text style={[styles.biometricDescription, theme === 'dark' && styles.biometricDescriptionDark]}>
        {getBiometricInstruction()}
      </Text>

      {/* Attempt Counter */}
      {authAttempts > 0 && (
        <Text style={[styles.biometricDescription, { marginTop: 8, fontWeight: '600' }, theme === 'dark' && styles.biometricDescriptionDark]}>
          Attempt {authAttempts} of {maxAttempts}
        </Text>
      )}

      {/* Action Buttons */}
      <View style={styles.biometricActions}>
        {!isAuthenticating && authAttempts < maxAttempts && (
          <TouchableOpacity
            style={[styles.biometricButton, styles.biometricPrimaryButton]}
            onPress={handleRetry}
            accessibilityLabel="Retry biometric authentication"
            accessibilityRole="button"
          >
            <Text style={[styles.biometricButtonText, styles.biometricPrimaryButtonText]}>
              {authAttempts > 0 ? 'Try Again' : 'Authenticate'}
            </Text>
          </TouchableOpacity>
        )}

        {isAuthenticating && (
          <View style={[styles.biometricButton, styles.biometricPrimaryButton, { opacity: 0.7 }]}>
            <Text style={[styles.biometricButtonText, styles.biometricPrimaryButtonText]}>
              Authenticating...
            </Text>
          </View>
        )}

        {onFallback && (
          <TouchableOpacity
            style={[styles.biometricButton, styles.biometricSecondaryButton]}
            onPress={onFallback}
            disabled={isAuthenticating}
            accessibilityLabel="Use alternative authentication"
            accessibilityRole="button"
          >
            <Text style={[styles.biometricButtonText, styles.biometricSecondaryButtonText]}>
              Use Password
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.biometricButton, styles.biometricSecondaryButton]}
          onPress={onCancel}
          disabled={isAuthenticating}
          accessibilityLabel="Cancel authentication"
          accessibilityRole="button"
        >
          <Text style={[styles.biometricButtonText, styles.biometricSecondaryButtonText]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>

      {/* Security Notice */}
      <View style={[styles.securityNotice, { marginTop: 16, borderTopWidth: 0 }]}>
        <Text style={styles.securityIcon}>🔒</Text>
        <Text style={[styles.securityText, theme === 'dark' && styles.securityTextDark]}>
          Your biometric data never leaves your device
        </Text>
      </View>
    </View>
  );
};