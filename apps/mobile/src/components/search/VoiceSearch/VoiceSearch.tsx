import React, { useState, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Voice, {
  SpeechRecognizedEvent,
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export interface VoiceSearchProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  theme: {
    primaryColor: string;
    textColor: string;
    placeholderColor: string;
  };
  disabled?: boolean;
  language?: string;
}

interface VoiceSearchState {
  isListening: boolean;
  isAvailable: boolean;
  hasPermission: boolean;
  isRecognizing: boolean;
  results: string[];
  partialResults: string[];
  error: string | null;
}

export const VoiceSearch: React.FC<VoiceSearchProps> = ({
  onResult,
  onError,
  onStart,
  onEnd,
  theme,
  disabled = false,
  language = 'en-US',
}) => {
  const [voiceState, setVoiceState] = useState<VoiceSearchState>({
    isListening: false,
    isAvailable: false,
    hasPermission: false,
    isRecognizing: false,
    results: [],
    partialResults: [],
    error: null,
  });

  // Animation values
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const iconOpacity = useSharedValue(1);

  // Initialize voice recognition
  const initializeVoice = useCallback(async () => {
    try {
      const isAvailable = await Voice.isAvailable();
      setVoiceState(prev => ({ ...prev, isAvailable }));

      if (isAvailable) {
        // Check if we have permission
        const hasPermission = await checkVoicePermission();
        setVoiceState(prev => ({ ...prev, hasPermission }));
      }
    } catch (error) {
      console.warn('Voice recognition not available:', error);
      setVoiceState(prev => ({ 
        ...prev, 
        isAvailable: false, 
        error: 'Voice recognition not available' 
      }));
    }
  }, []);

  // Check voice permission
  const checkVoicePermission = useCallback(async (): Promise<boolean> => {
    try {
      // This is a simplified check - in a real app, you'd use react-native-permissions
      return true;
    } catch (error) {
      console.warn('Failed to check voice permission:', error);
      return false;
    }
  }, []);

  // Voice recognition event handlers
  const onSpeechStart = useCallback(() => {
    console.log('Speech recognition started');
    setVoiceState(prev => ({ ...prev, isListening: true, error: null }));
    onStart?.();
    
    // Start pulse animation
    pulseOpacity.value = withSequence(
      withTiming(0.7, { duration: 300 }),
      withTiming(0.3, { duration: 600 }),
      withTiming(0.7, { duration: 600 })
    );
  }, [onStart, pulseOpacity]);

  const onSpeechRecognized = useCallback(() => {
    console.log('Speech recognized');
    setVoiceState(prev => ({ ...prev, isRecognizing: true }));
  }, []);

  const onSpeechEnd = useCallback(() => {
    console.log('Speech recognition ended');
    setVoiceState(prev => ({ 
      ...prev, 
      isListening: false, 
      isRecognizing: false 
    }));
    
    // Stop animations
    pulseOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withSpring(1);
    
    onEnd?.();
  }, [onEnd, pulseOpacity, scale]);

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    console.log('Speech results:', e.value);
    
    if (e.value && e.value.length > 0) {
      const bestResult = e.value[0];
      setVoiceState(prev => ({ ...prev, results: e.value || [] }));
      
      // Vibrate to indicate success
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 100]);
      } else {
        Vibration.vibrate(100);
      }
      
      // Success animation
      scale.value = withSequence(
        withSpring(1.2, { damping: 10 }),
        withSpring(1, { damping: 15 })
      );
      
      // Call result handler
      onResult(bestResult);
    }
  }, [onResult, scale]);

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    console.log('Partial results:', e.value);
    setVoiceState(prev => ({ ...prev, partialResults: e.value || [] }));
  }, []);

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.error('Speech recognition error:', e.error);
    
    const errorMessage = getErrorMessage(e.error?.code || e.error?.message || 'Unknown error');
    setVoiceState(prev => ({ 
      ...prev, 
      error: errorMessage, 
      isListening: false, 
      isRecognizing: false 
    }));
    
    // Stop animations
    pulseOpacity.value = withTiming(0, { duration: 300 });
    scale.value = withSpring(1);
    
    // Error animation
    rotateZ.value = withSequence(
      withTiming(-0.1, { duration: 100 }),
      withTiming(0.1, { duration: 100 }),
      withTiming(-0.1, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    
    onError?.(errorMessage);
    
    // Show user-friendly error
    if (errorMessage !== 'No speech detected' && errorMessage !== 'User cancelled') {
      Alert.alert(
        'Voice Search Error',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [onError, pulseOpacity, scale, rotateZ]);

  // Get user-friendly error message
  const getErrorMessage = useCallback((error: string): string => {
    const errorCode = error.toLowerCase();
    
    if (errorCode.includes('no_match') || errorCode.includes('no match')) {
      return 'No speech detected. Please try again.';
    }
    if (errorCode.includes('network')) {
      return 'Network error. Please check your connection.';
    }
    if (errorCode.includes('permission') || errorCode.includes('denied')) {
      return 'Microphone permission denied. Please enable it in settings.';
    }
    if (errorCode.includes('busy') || errorCode.includes('in_use')) {
      return 'Voice recognition is busy. Please try again.';
    }
    if (errorCode.includes('not_available') || errorCode.includes('unavailable')) {
      return 'Voice recognition is not available on this device.';
    }
    if (errorCode.includes('cancelled') || errorCode.includes('user')) {
      return 'User cancelled';
    }
    
    return 'Voice recognition failed. Please try again.';
  }, []);

  // Set up voice recognition listeners
  useEffect(() => {
    // Set event listeners
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechRecognized = onSpeechRecognized;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechError = onSpeechError;

    // Initialize
    initializeVoice();

    // Cleanup
    return () => {
      Voice.destroy();
    };
  }, [
    onSpeechStart,
    onSpeechRecognized,
    onSpeechEnd,
    onSpeechResults,
    onSpeechPartialResults,
    onSpeechError,
    initializeVoice,
  ]);

  // Start voice recognition
  const startVoiceRecognition = useCallback(async () => {
    if (disabled || voiceState.isListening) {
      return;
    }

    try {
      // Check permission again before starting
      if (!voiceState.hasPermission) {
        const hasPermission = await checkVoicePermission();
        if (!hasPermission) {
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone permission to use voice search.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => {
                // In a real app, open settings
                console.log('Open settings to enable microphone permission');
              }},
            ]
          );
          return;
        }
      }

      // Clear previous state
      setVoiceState(prev => ({ 
        ...prev, 
        error: null, 
        results: [], 
        partialResults: [] 
      }));

      // Start recognition
      await Voice.start(language);
      
      // Start animation
      scale.value = withSpring(1.1, { damping: 15 });
      iconOpacity.value = withTiming(0.8, { duration: 300 });
      
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start voice recognition';
      setVoiceState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [
    disabled,
    voiceState.isListening,
    voiceState.hasPermission,
    checkVoicePermission,
    language,
    onError,
    scale,
    iconOpacity,
  ]);

  // Stop voice recognition
  const stopVoiceRecognition = useCallback(async () => {
    if (!voiceState.isListening) {
      return;
    }

    try {
      await Voice.stop();
    } catch (error) {
      console.error('Failed to stop voice recognition:', error);
    }
  }, [voiceState.isListening]);

  // Handle button press
  const handlePress = useCallback(() => {
    if (voiceState.isListening) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  }, [voiceState.isListening, startVoiceRecognition, stopVoiceRecognition]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotateZ: `${rotateZ.value}rad` },
      ],
    };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [
        { scale: interpolate(pulseOpacity.value, [0, 1], [1, 1.5]) },
      ],
    };
  });

  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: iconOpacity.value,
    };
  });

  // Don't render if voice recognition is not available
  if (!voiceState.isAvailable) {
    return null;
  }

  const getIconName = () => {
    if (voiceState.isListening) {
      return voiceState.isRecognizing ? 'mic' : 'mic-outline';
    }
    return 'mic-outline';
  };

  const getIconColor = () => {
    if (voiceState.isListening) {
      return voiceState.isRecognizing ? '#FF3B30' : theme.primaryColor;
    }
    return theme.placeholderColor;
  };

  return (
    <Animated.View style={[styles.container, buttonAnimatedStyle]}>
      {/* Pulse animation background */}
      {voiceState.isListening && (
        <Animated.View
          style={[
            styles.pulseBackground,
            {
              backgroundColor: theme.primaryColor,
            },
            pulseAnimatedStyle,
          ]}
        />
      )}
      
      {/* Voice button */}
      <TouchableOpacity
        style={[styles.voiceButton]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons
            name={getIconName() as any}
            size={18}
            color={getIconColor()}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseBackground: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.3,
  },
  voiceButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    zIndex: 1,
  },
});

export default VoiceSearch;