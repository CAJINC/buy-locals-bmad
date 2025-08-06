import { locationService, LocationCoordinates, LocationPermissionStatus } from '../../services/locationService';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION'
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again'
    },
    request: jest.fn()
  }
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn()
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE'
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

import Geolocation from '@react-native-community/geolocation';
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

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', () => {
      // Set up some state
      locationService['watchId'] = 123;
      locationService['isWatching'] = true;
      locationService['currentLocation'] = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now()
      };
      locationService['locationUpdateCallbacks'] = [jest.fn()];

      locationService.cleanup();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(123);
      expect(locationService['watchId']).toBeNull();
      expect(locationService['isWatching']).toBe(false);
      expect(locationService['currentLocation']).toBeNull();
      expect(locationService['locationUpdateCallbacks']).toHaveLength(0);
    });
  });
});