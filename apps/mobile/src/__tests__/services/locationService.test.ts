import { locationService, LocationCoordinates, LocationPermissionStatus, LocationAccuracyAssessment, LocationCacheEntry, BackgroundLocationOptions } from '../../services/locationService';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 30 },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION'
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again'
    },
    request: jest.fn()
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn()
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS'
    }
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable'
  },
  check: jest.fn(),
  request: jest.fn()
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    locationService.cleanup();
  });

  describe('Permission Handling', () => {
    test('should request iOS location permission successfully', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const result = await locationService.requestLocationPermission();

      expect(result.granted).toBe(true);
      expect(result.status).toBe('granted');
      expect(result.canAskAgain).toBe(true);
    });

    test('should handle iOS permission blocked', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);

      const result = await locationService.requestLocationPermission();

      expect(result.granted).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.canAskAgain).toBe(false);
    });

    test('should handle iOS permission already granted', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const result = await locationService.requestLocationPermission();

      expect(result.granted).toBe(true);
      expect(result.status).toBe('granted');
      expect(result.canAskAgain).toBe(true);
    });

    test('should handle permission request errors', async () => {
      (check as jest.Mock).mockRejectedValue(new Error('Permission error'));

      const result = await locationService.requestLocationPermission();

      expect(result.granted).toBe(false);
      expect(result.status).toBe('unavailable');
      expect(result.canAskAgain).toBe(false);
    });
  });

  describe('Location Acquisition', () => {
    const mockLocation: LocationCoordinates = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 15,
      timestamp: Date.now()
    };

    test('should get current location successfully', async () => {
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: mockLocation.latitude,
            longitude: mockLocation.longitude,
            accuracy: mockLocation.accuracy
          },
          timestamp: mockLocation.timestamp
        });
      });

      const location = await locationService.getCurrentLocation();

      expect(location.latitude).toBe(mockLocation.latitude);
      expect(location.longitude).toBe(mockLocation.longitude);
      expect(location.accuracy).toBe(mockLocation.accuracy);
    });

    test('should handle location timeout with fallback', async () => {
      let callCount = 0;
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error) => {
        callCount++;
        if (callCount === 1) {
          // First call (high accuracy) times out
          error({ code: 3, message: 'Timeout' });
        } else {
          // Second call (low accuracy) succeeds
          success({
            coords: {
              latitude: mockLocation.latitude,
              longitude: mockLocation.longitude,
              accuracy: 100 // Lower accuracy
            },
            timestamp: mockLocation.timestamp
          });
        }
      });

      const location = await locationService.getCurrentLocation(true);

      expect(location.latitude).toBe(mockLocation.latitude);
      expect(location.longitude).toBe(mockLocation.longitude);
      expect(location.accuracy).toBe(100);
      expect(callCount).toBe(2);
    });

    test('should use cached location when available', async () => {
      const cachedLocation: LocationCoordinates = {
        latitude: 40.7589,
        longitude: -73.9851,
        accuracy: 20,
        timestamp: Date.now() - 30000 // 30 seconds ago
      };

      // Set up cached location
      locationService['currentLocation'] = cachedLocation;
      locationService['lastLocationUpdate'] = Date.now() - 30000;

      const location = locationService.getCachedLocation();

      expect(location).toEqual(cachedLocation);
    });

    test('should return null for expired cached location', async () => {
      const expiredLocation: LocationCoordinates = {
        latitude: 40.7589,
        longitude: -73.9851,
        accuracy: 20,
        timestamp: Date.now() - 120000 // 2 minutes ago (expired)
      };

      // Set up expired cached location
      locationService['currentLocation'] = expiredLocation;
      locationService['lastLocationUpdate'] = Date.now() - 120000;

      const location = locationService.getCachedLocation();

      expect(location).toBeNull();
    });
  });

  describe('Location Accuracy Assessment', () => {
    test('should assess excellent location quality', async () => {
      const highAccuracyLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        timestamp: Date.now()
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: highAccuracyLocation.latitude,
            longitude: highAccuracyLocation.longitude,
            accuracy: highAccuracyLocation.accuracy
          },
          timestamp: highAccuracyLocation.timestamp
        });
      });

      const result = await locationService.getValidatedCurrentLocation();

      expect(result.quality).toBe('excellent');
      expect(result.validation.isValid).toBe(true);
    });

    test('should assess poor location quality', async () => {
      const poorAccuracyLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 2000, // 2km accuracy
        timestamp: Date.now()
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: poorAccuracyLocation.latitude,
            longitude: poorAccuracyLocation.longitude,
            accuracy: poorAccuracyLocation.accuracy
          },
          timestamp: poorAccuracyLocation.timestamp
        });
      });

      const result = await locationService.getValidatedCurrentLocation();

      expect(result.quality).toBe('poor');
      // Should still be valid if accuracy < 5km
      expect(result.validation.isValid).toBe(true);
    });

    test('should detect impossible movement', async () => {
      // Set initial location (New York)
      const initialLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now() - 1000 // 1 second ago
      };

      locationService['currentLocation'] = initialLocation;

      // Try to set location in Tokyo (impossible movement)
      const tokyoLocation: LocationCoordinates = {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10,
        timestamp: Date.now()
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: tokyoLocation.latitude,
            longitude: tokyoLocation.longitude,
            accuracy: tokyoLocation.accuracy
          },
          timestamp: tokyoLocation.timestamp
        });
      });

      const result = await locationService.getValidatedCurrentLocation();

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.issues).toContain('Impossible movement detected (teleportation)');
    });
  });

  describe('Location Watching', () => {
    test('should start location watching', () => {
      const mockWatchId = 123;
      (Geolocation.watchPosition as jest.Mock).mockReturnValue(mockWatchId);

      locationService.startLocationWatch();

      expect(Geolocation.watchPosition).toHaveBeenCalled();
      expect(locationService['watchId']).toBe(mockWatchId);
      expect(locationService['isWatching']).toBe(true);
    });

    test('should stop location watching', () => {
      const mockWatchId = 123;
      locationService['watchId'] = mockWatchId;
      locationService['isWatching'] = true;

      locationService.stopLocationWatch();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(mockWatchId);
      expect(locationService['watchId']).toBeNull();
      expect(locationService['isWatching']).toBe(false);
    });

    test('should handle location updates during watching', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
        timestamp: Date.now()
      };

      let watchCallback: ((position: any) => void) | null = null;
      (Geolocation.watchPosition as jest.Mock).mockImplementation((success) => {
        watchCallback = success;
        return 123;
      });

      const updateCallback = jest.fn();
      const unsubscribe = locationService.subscribeToLocationUpdates(updateCallback);

      locationService.startLocationWatch();

      // Simulate location update
      if (watchCallback) {
        watchCallback({
          coords: {
            latitude: mockLocation.latitude,
            longitude: mockLocation.longitude,
            accuracy: mockLocation.accuracy
          },
          timestamp: mockLocation.timestamp
        });
      }

      expect(updateCallback).toHaveBeenCalledWith(expect.objectContaining({
        latitude: mockLocation.latitude,
        longitude: mockLocation.longitude
      }));

      unsubscribe();
    });
  });

  describe('Distance and Bearing Calculations', () => {
    test('should calculate distance correctly', () => {
      // Distance from NYC to Boston (approximately 300km)
      const nycLat = 40.7128, nycLng = -74.0060;
      const bostonLat = 42.3601, bostonLng = -71.0589;

      const distance = locationService.calculateDistance(nycLat, nycLng, bostonLat, bostonLng);

      expect(distance).toBeCloseTo(306, 0); // Within 1km accuracy
    });

    test('should calculate bearing correctly', () => {
      // Bearing from NYC to Boston should be roughly northeast (around 45-60 degrees)
      const nycLat = 40.7128, nycLng = -74.0060;
      const bostonLat = 42.3601, bostonLng = -71.0589;

      const bearing = locationService.calculateBearing(nycLat, nycLng, bostonLat, bostonLng);

      expect(bearing).toBeGreaterThan(45);
      expect(bearing).toBeLessThan(80);
    });

    test('should generate search area bounds correctly', () => {
      const center: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now()
      };
      const radiusKm = 5;

      const searchArea = locationService.generateSearchArea(center, radiusKm);

      expect(searchArea.center).toEqual(center);
      expect(searchArea.radius).toBe(radiusKm);
      expect(searchArea.bounds).toBeDefined();
      
      if (searchArea.bounds) {
        expect(searchArea.bounds.northeast.latitude).toBeGreaterThan(center.latitude);
        expect(searchArea.bounds.northeast.longitude).toBeGreaterThan(center.longitude);
        expect(searchArea.bounds.southwest.latitude).toBeLessThan(center.latitude);
        expect(searchArea.bounds.southwest.longitude).toBeLessThan(center.longitude);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle permission denied error', async () => {
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error) => {
        error({ code: 1, message: 'Permission denied' });
      });

      await expect(locationService.getCurrentLocation()).rejects.toThrow(
        'Location access denied. Please enable location permissions in settings.'
      );
    });

    test('should handle location unavailable error', async () => {
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error) => {
        error({ code: 2, message: 'Position unavailable' });
      });

      await expect(locationService.getCurrentLocation()).rejects.toThrow(
        'Location unavailable. Please check your device\'s location settings.'
      );
    });

    test('should handle location timeout error', async () => {
      let callCount = 0;
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error) => {
        callCount++;
        error({ code: 3, message: 'Timeout' });
      });

      await expect(locationService.getCurrentLocation()).rejects.toThrow();
      expect(callCount).toBe(2); // Should try both high and low accuracy
    });
  });

  describe('Fallback Strategies', () => {
    test('should execute fallback strategies on poor accuracy', async () => {
      let callCount = 0;
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success, error, options) => {
        callCount++;
        if (callCount === 1) {
          // First call returns poor accuracy
          success({
            coords: {
              latitude: 40.7128,
              longitude: -74.0060,
              accuracy: 5000 // Very poor accuracy (5km)
            },
            timestamp: Date.now()
          });
        } else {
          // Fallback calls return better accuracy
          success({
            coords: {
              latitude: 40.7128,
              longitude: -74.0060,
              accuracy: 50 // Better accuracy
            },
            timestamp: Date.now()
          });
        }
      });

      const location = await locationService.getCurrentLocation(true);

      expect(location.accuracy).toBe(50);
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('Background Location Updates', () => {
    test('should start background location updates successfully', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (Geolocation.watchPosition as jest.Mock).mockReturnValue(456);

      const result = await locationService.startBackgroundLocationUpdates();

      expect(result).toBe(true);
      expect(locationService['isBackgroundWatching']).toBe(true);
      expect(locationService['backgroundWatchId']).toBe(456);
    });

    test('should fail to start background updates without permission', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const result = await locationService.startBackgroundLocationUpdates();

      expect(result).toBe(false);
      expect(locationService['isBackgroundWatching']).toBe(false);
    });

    test('should stop background location updates', () => {
      locationService['backgroundWatchId'] = 456;
      locationService['isBackgroundWatching'] = true;

      locationService.stopBackgroundLocationUpdates();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(456);
      expect(locationService['backgroundWatchId']).toBeNull();
      expect(locationService['isBackgroundWatching']).toBe(false);
    });

    test('should handle background location callbacks', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
        timestamp: Date.now()
      };

      const backgroundCallback = jest.fn();
      const unsubscribe = locationService.subscribeToBackgroundLocationUpdates(backgroundCallback);

      // Simulate background location update
      locationService['backgroundLocationCallbacks'].forEach(callback => callback(mockLocation));

      expect(backgroundCallback).toHaveBeenCalledWith(mockLocation);

      unsubscribe();
      expect(locationService['backgroundLocationCallbacks']).toHaveLength(0);
    });
  });

  describe('Enhanced Accuracy Assessment', () => {
    test('should provide comprehensive accuracy assessment', async () => {
      const highAccuracyLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        timestamp: Date.now()
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: highAccuracyLocation.latitude,
            longitude: highAccuracyLocation.longitude,
            accuracy: highAccuracyLocation.accuracy
          },
          timestamp: highAccuracyLocation.timestamp
        });
      });

      const result = await locationService.getValidatedCurrentLocation();

      expect(result.quality).toBe('excellent');
      expect(result.validation.isValid).toBe(true);
      expect(result.location.accuracy).toBe(5);
    });

    test('should assess location with confidence levels', async () => {
      const fairAccuracyLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 75,
        timestamp: Date.now()
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: fairAccuracyLocation.latitude,
            longitude: fairAccuracyLocation.longitude,
            accuracy: fairAccuracyLocation.accuracy
          },
          timestamp: fairAccuracyLocation.timestamp
        });
      });

      const result = await locationService.getValidatedCurrentLocation();
      const assessment = locationService['assessLocationAccuracy'](fairAccuracyLocation);

      expect(assessment.quality).toBe('fair');
      expect(assessment.accuracyIndicator).toBe('medium');
      expect(assessment.confidenceLevel).toBe(70);
    });
  });

  describe('Location Caching', () => {
    test('should cache location with reliability scoring', async () => {
      const location: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now()
      };

      await locationService['storeLastKnownLocation'](location, 'gps');

      expect(locationService['locationCache'].size).toBeGreaterThan(0);
      expect(locationService['currentLocation']).toEqual(location);
    });

    test('should get best cached location near coordinates', () => {
      // Set up cache with multiple entries
      const nearLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
        timestamp: Date.now()
      };

      const cacheEntry: LocationCacheEntry = {
        location: nearLocation,
        cacheTimestamp: Date.now(),
        source: 'gps',
        reliability: 85
      };

      locationService['locationCache'].set('40.713,-74.006', cacheEntry);

      const result = locationService.getBestCachedLocation(nearLocation);

      expect(result).toBeDefined();
      expect(result?.reliability).toBe(85);
      expect(result?.source).toBe('gps');
    });

    test('should provide cache statistics', () => {
      const stats = locationService.getCacheStatistics();

      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('averageReliability');
      expect(stats).toHaveProperty('sourceCounts');
    });

    test('should clear location cache', async () => {
      await locationService.clearLocationCache();

      expect(locationService['locationCache'].size).toBe(0);
    });
  });

  describe('Comprehensive Location Status', () => {
    test('should provide detailed location status', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const status = await locationService.getLocationStatus();

      expect(status).toHaveProperty('hasLocation');
      expect(status).toHaveProperty('permission');
      expect(status).toHaveProperty('accuracy');
      expect(status).toHaveProperty('cacheStatus');
      expect(status).toHaveProperty('isWatching');
      expect(status).toHaveProperty('isBackgroundWatching');
    });

    test('should check comprehensive location availability', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const availability = await locationService.isLocationAvailable();

      expect(availability).toHaveProperty('available');
      expect(availability).toHaveProperty('permission');
      expect(availability).toHaveProperty('gpsEnabled');
      expect(availability).toHaveProperty('networkLocationEnabled');
    });
  });

  describe('Background Permission Handling', () => {
    test('should request background location permission on iOS', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const result = await locationService.requestBackgroundLocationPermission();

      expect(result.backgroundLocationGranted).toBe(true);
      expect(result.alwaysLocationGranted).toBe(true);
      expect(result.status).toBe('granted');
    });

    test('should handle blocked background permission', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);

      const result = await locationService.requestBackgroundLocationPermission();

      expect(result.backgroundLocationGranted).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.canAskAgain).toBe(false);
    });
  });

  describe('Enhanced Error Handling', () => {
    test('should handle location watch errors gracefully', () => {
      let watchCallback: ((position: any, error?: any) => void) | null = null;
      (Geolocation.watchPosition as jest.Mock).mockImplementation((success, error) => {
        watchCallback = error;
        return 123;
      });

      locationService.startLocationWatch();

      // Simulate location error
      if (watchCallback) {
        watchCallback(null, { code: 2, message: 'Position unavailable' });
      }

      // Should continue watching for recoverable errors
      expect(locationService['isWatching']).toBe(true);
    });

    test('should stop watching on permission denied error', () => {
      let watchCallback: ((position: any, error?: any) => void) | null = null;
      (Geolocation.watchPosition as jest.Mock).mockImplementation((success, error) => {
        watchCallback = error;
        return 123;
      });

      locationService.startLocationWatch();

      // Simulate permission denied error
      if (watchCallback) {
        watchCallback(null, { code: 1, message: 'Permission denied' });
      }

      expect(locationService['isWatching']).toBe(false);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', async () => {
      // Set up some state
      locationService['watchId'] = 123;
      locationService['backgroundWatchId'] = 456;
      locationService['isWatching'] = true;
      locationService['isBackgroundWatching'] = true;
      locationService['currentLocation'] = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now()
      };
      locationService['locationUpdateCallbacks'] = [jest.fn()];
      locationService['backgroundLocationCallbacks'] = [jest.fn()];
      locationService['locationCache'].set('test', {
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: Date.now()
        },
        cacheTimestamp: Date.now(),
        source: 'gps',
        reliability: 85
      });

      locationService.cleanup();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(123);
      expect(Geolocation.clearWatch).toHaveBeenCalledWith(456);
      expect(locationService['watchId']).toBeNull();
      expect(locationService['backgroundWatchId']).toBeNull();
      expect(locationService['isWatching']).toBe(false);
      expect(locationService['isBackgroundWatching']).toBe(false);
      expect(locationService['currentLocation']).toBeNull();
      expect(locationService['locationUpdateCallbacks']).toHaveLength(0);
      expect(locationService['backgroundLocationCallbacks']).toHaveLength(0);
      expect(locationService['locationCache'].size).toBe(0);
    });
  });
});