import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MapLoadingState as LoadingState, MapErrorState } from './types';

interface MapLoadingStateProps {
  loading: LoadingState;
}

interface MapErrorStateProps {
  error: MapErrorState;
  onRetry?: () => void;
}

export const MapLoadingState: React.FC<MapLoadingStateProps> = ({ loading }) => {
  if (!loading.isLoading) return null;

  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {loading.loadingText || 'Loading map...'}
        </Text>
        {loading.progress !== undefined && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${loading.progress}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(loading.progress)}%</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export const MapErrorState: React.FC<MapErrorStateProps> = ({ error, onRetry }) => {
  if (!error.hasError) return null;

  const getErrorIcon = () => {
    switch (error.errorType) {
      case 'permission':
        return '🔒';
      case 'network':
        return '🌐';
      case 'location':
        return '📍';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = () => {
    switch (error.errorType) {
      case 'permission':
        return 'Location Access Required';
      case 'network':
        return 'Network Error';
      case 'location':
        return 'Location Not Available';
      default:
        return 'Map Error';
    }
  };

  const getErrorSuggestions = () => {
    switch (error.errorType) {
      case 'permission':
        return [
          'Enable location permissions in Settings',
          'Allow "When Using App" location access',
          'Check your device location settings',
        ];
      case 'network':
        return [
          'Check your internet connection',
          'Try switching between Wi-Fi and cellular',
          'Wait for better network coverage',
        ];
      case 'location':
        return [
          'Move to an area with better GPS signal',
          'Make sure location services are enabled',
          'Try restarting your device',
        ];
      default:
        return [
          'Try again in a few moments',
          'Check your internet connection',
          'Restart the app if the problem persists',
        ];
    }
  };

  return (
    <View style={styles.errorOverlay}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>{getErrorIcon()}</Text>
        <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
        <Text style={styles.errorMessage}>
          {error.errorMessage || 'Something went wrong with the map'}
        </Text>
        
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Try these solutions:</Text>
          {getErrorSuggestions().map((suggestion, index) => (
            <Text key={index} style={styles.suggestionItem}>
              • {suggestion}
            </Text>
          ))}
        </View>

        {error.canRetry && onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 16,
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: 350,
    width: '100%',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  suggestionsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  suggestionItem: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 6,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export { MapLoadingState as LoadingState, MapErrorState as ErrorState };