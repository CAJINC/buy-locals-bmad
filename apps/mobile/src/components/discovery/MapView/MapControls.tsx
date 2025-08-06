import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MapControlsProps, UserLocationButtonProps } from './types';

export const UserLocationButton: React.FC<UserLocationButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
}) => (
  <TouchableOpacity
    style={[
      styles.userLocationButton,
      disabled && styles.buttonDisabled,
    ]}
    onPress={onPress}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#007AFF" />
    ) : (
      <Text style={styles.userLocationIcon}>🎯</Text>
    )}
  </TouchableOpacity>
);

export const MapControls: React.FC<MapControlsProps> = ({
  onLocationPress,
  onToggleMapType,
  onToggleTraffic,
  showTrafficLayer = false,
  mapType = 'standard',
  locationLoading = false,
  locationDisabled = false,
}) => {
  const getMapTypeIcon = () => {
    switch (mapType) {
      case 'satellite':
        return '🛰️';
      case 'hybrid':
        return '🗺️';
      case 'terrain':
        return '🏔️';
      default:
        return '🗺️';
    }
  };

  const getMapTypeLabel = () => {
    switch (mapType) {
      case 'satellite':
        return 'Satellite';
      case 'hybrid':
        return 'Hybrid';
      case 'terrain':
        return 'Terrain';
      default:
        return 'Standard';
    }
  };

  return (
    <View style={styles.controlsContainer}>
      {/* Map Type Toggle */}
      <TouchableOpacity style={styles.controlButton} onPress={onToggleMapType}>
        <Text style={styles.controlIcon}>{getMapTypeIcon()}</Text>
        <Text style={styles.controlLabel}>{getMapTypeLabel()}</Text>
      </TouchableOpacity>

      {/* Traffic Layer Toggle */}
      {onToggleTraffic && (
        <TouchableOpacity
          style={[
            styles.controlButton,
            showTrafficLayer && styles.controlButtonActive,
          ]}
          onPress={onToggleTraffic}
        >
          <Text style={styles.controlIcon}>🚦</Text>
          <Text style={styles.controlLabel}>Traffic</Text>
        </TouchableOpacity>
      )}

      {/* User Location Button */}
      <UserLocationButton
        onPress={onLocationPress}
        loading={locationLoading}
        disabled={locationDisabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    position: 'absolute',
    top: 50,
    right: 15,
    gap: 10,
    zIndex: 1000,
  },
  controlButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
    minWidth: 70,
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  controlIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  controlLabel: {
    fontSize: 10,
    color: '#333333',
    fontWeight: '500',
  },
  userLocationButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  userLocationIcon: {
    fontSize: 20,
  },
});

export default MapControls;