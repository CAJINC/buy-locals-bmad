import { jest } from '@jest/globals';
import { locationService, LocationCoordinates, LocationAccuracyAssessment } from '../locationService';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  check: jest.fn(),
  request: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock fetch for IP geolocation
global.fetch = jest.fn();

describe('LocationService - Accuracy Assessment and Fallback Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationService.resetLocationAccuracySystem();
  });

  describe('GPS Accuracy Assessment', () => {
    test('should assess excellent accuracy for high precision GPS', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        timestamp: Date.now(),
      };

      // Use private method via any cast for testing
      const assessment = (locationService as any).assessLocationAccuracy(mockLocation);

      expect(assessment.quality).toBe('excellent');
      expect(assessment.confidenceLevel).toBe(95);
      expect(assessment.accuracyIndicator).toBe('high');
      expect(assessment.isUsable).toBe(true);
    });

    test('should assess good accuracy for moderate GPS precision', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 25,
        timestamp: Date.now(),
      };

      const assessment = (locationService as any).assessLocationAccuracy(mockLocation);

      expect(assessment.quality).toBe('good');
      expect(assessment.confidenceLevel).toBe(85);
      expect(assessment.accuracyIndicator).toBe('high');
      expect(assessment.isUsable).toBe(true);
    });

    test('should assess fair accuracy for lower GPS precision', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 75,
        timestamp: Date.now(),
      };

      const assessment = (locationService as any).assessLocationAccuracy(mockLocation);

      expect(assessment.quality).toBe('fair');
      expect(assessment.confidenceLevel).toBe(70);
      expect(assessment.accuracyIndicator).toBe('medium');
      expect(assessment.isUsable).toBe(true);
    });

    test('should assess poor accuracy but usable for very low precision', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 250,
        timestamp: Date.now(),
      };

      const assessment = (locationService as any).assessLocationAccuracy(mockLocation);

      expect(assessment.quality).toBe('poor');
      expect(assessment.confidenceLevel).toBe(50);
      expect(assessment.accuracyIndicator).toBe('low');
      expect(assessment.isUsable).toBe(true);
    });

    test('should assess poor accuracy as unusable for extremely low precision', () => {
      const mockLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 1500,
        timestamp: Date.now(),
      };

      const assessment = (locationService as any).assessLocationAccuracy(mockLocation);

      expect(assessment.quality).toBe('poor');
      expect(assessment.confidenceLevel).toBe(25);
      expect(assessment.accuracyIndicator).toBe('low');
      expect(assessment.isUsable).toBe(false);
    });
  });

  describe('IP-based Location Fallback', () => {
    test('should successfully get network-based location from first provider', async () => {
      const mockIPResponse = {
        latitude: 40.7128,
        longitude: -74.0060,
        city: 'New York',
        country: 'US',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIPResponse),
      });

      const location = await (locationService as any).getNetworkBasedLocation();

      expect(location.latitude).toBe(40.7128);
      expect(location.longitude).toBe(-74.0060);
      expect(location.accuracy).toBe(5000); // Default IP accuracy
      expect(fetch).toHaveBeenCalledWith(
        'https://ipapi.co/json/',
        expect.objectContaining({
          timeout: 10000,
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'BuyLocals/1.0',
          }),
        })
      );
    });

    test('should try fallback providers when first fails', async () => {
      // First provider fails
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            latitude: 40.7128,
            longitude: -74.0060,
          }),
        });

      const location = await (locationService as any).getNetworkBasedLocation();

      expect(location.latitude).toBe(40.7128);
      expect(location.longitude).toBe(-74.0060);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should handle different IP provider response formats', async () => {
      // Test geojs.io format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          latitude: '40.7128',
          longitude: '-74.0060',
        }),
      });

      const location = await (locationService as any).getNetworkBasedLocation();
      expect(location.latitude).toBe(40.7128);
      expect(location.longitude).toBe(-74.0060);
    });

    test('should handle ipinfo.io loc format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          loc: '40.7128,-74.0060',
          city: 'New York',
        }),
      });

      const location = await (locationService as any).getNetworkBasedLocation();
      expect(location.latitude).toBe(40.7128);
      expect(location.longitude).toBe(-74.0060);
    });

    test('should throw error when all IP providers fail', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect((locationService as any).getNetworkBasedLocation())
        .rejects.toThrow('All IP-based location providers failed');
      
      expect(fetch).toHaveBeenCalledTimes(3); // Should try all 3 providers
    });

    test('should validate IP coordinates and reject invalid ones', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          latitude: 200, // Invalid latitude
          longitude: -74.0060,
        }),
      });

      await expect((locationService as any).getNetworkBasedLocation())
        .rejects.toThrow('All IP-based location providers failed');
    });
  });

  describe('Manual Location Refinement', () => {
    test('should successfully refine location manually', async () => {
      const originalLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 100,
        timestamp: Date.now() - 1000,
      };

      const refinedLocation: LocationCoordinates = {
        latitude: 40.7130,
        longitude: -74.0062,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await locationService.refineLocationManually(
        originalLocation,
        refinedLocation,
        'manual_pin',
        85,
        'Adjusted to exact building location'
      );

      expect(result).toEqual(refinedLocation);
      
      const refinementHistory = locationService.getLocationRefinementHistory();
      expect(refinementHistory).toHaveLength(1);
      expect(refinementHistory[0].refinementMethod).toBe('manual_pin');
      expect(refinementHistory[0].userConfidence).toBe(85);
      expect(refinementHistory[0].notes).toBe('Adjusted to exact building location');
    });

    test('should store refinement with high reliability score', async () => {
      const originalLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 200,
        timestamp: Date.now(),
      };

      const refinedLocation: LocationCoordinates = {
        latitude: 40.7130,
        longitude: -74.0062,
        accuracy: 5,
        timestamp: Date.now(),
      };

      await locationService.refineLocationManually(
        originalLocation,
        refinedLocation,
        'address_search',
        90
      );

      const bestCached = locationService.getBestCachedLocation();
      expect(bestCached?.reliability).toBeGreaterThanOrEqual(98); // 80 base + 90 * 0.2
    });

    test('should track refinement history chronologically', async () => {
      const baseLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 100,
        timestamp: Date.now(),
      };

      // Add multiple refinements
      await locationService.refineLocationManually(
        baseLocation,
        { ...baseLocation, latitude: 40.7130 },
        'manual_pin',
        80,
        'First refinement'
      );

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await locationService.refineLocationManually(
        baseLocation,
        { ...baseLocation, latitude: 40.7135 },
        'landmark_selection',
        85,
        'Second refinement'
      );

      const history = locationService.getLocationRefinementHistory();
      expect(history).toHaveLength(2);
      expect(history[0].notes).toBe('Second refinement'); // Most recent first
      expect(history[1].notes).toBe('First refinement');
    });
  });

  describe('Location Update Frequency Management', () => {
    test('should configure location update frequency', () => {
      const config = {
        interval: 20000,
        distanceFilter: 25,
        batteryOptimized: false,
      };

      locationService.configureLocationUpdateFrequency(config);

      const stats = locationService.getLocationUpdateFrequencyStats();
      expect(stats.currentConfig.interval).toBe(20000);
      expect(stats.currentConfig.distanceFilter).toBe(25);
      expect(stats.currentConfig.batteryOptimized).toBe(false);
    });

    test('should determine movement patterns correctly', () => {
      const service = locationService as any;

      expect(service.determineMovementPattern(0.3)).toBe('stationary');
      expect(service.determineMovementPattern(1.5)).toBe('walking');
      expect(service.determineMovementPattern(8)).toBe('transit');
      expect(service.determineMovementPattern(20)).toBe('driving');
    });

    test('should adjust frequency based on movement pattern', () => {
      const service = locationService as any;
      
      // Enable adaptive frequency
      locationService.configureLocationUpdateFrequency({ adaptiveFrequency: true });

      // Simulate driving pattern
      service.adaptiveFrequencyData.movementPattern = 'driving';
      service.adaptiveFrequencyData.averageSpeed = 20; // m/s
      
      service.adjustUpdateFrequencyBasedOnMovement();

      const stats = locationService.getLocationUpdateFrequencyStats();
      expect(stats.currentConfig.interval).toBe(5000); // Frequent updates for driving
    });

    test('should respect frequency limits', () => {
      const service = locationService as any;
      
      locationService.configureLocationUpdateFrequency({
        adaptiveFrequency: true,
        maxFrequency: 2, // 2 updates per minute max
        minFrequency: 0.5 // 0.5 updates per minute min
      });

      // Simulate very fast movement requiring frequent updates
      service.adaptiveFrequencyData.movementPattern = 'driving';
      service.adaptiveFrequencyData.averageSpeed = 50;
      
      service.adjustUpdateFrequencyBasedOnMovement();

      const stats = locationService.getLocationUpdateFrequencyStats();
      expect(stats.currentConfig.interval).toBeGreaterThanOrEqual(30000); // At least 30 seconds (2/min)
    });
  });

  describe('Location Permission Denied Flow', () => {
    test('should handle soft denial correctly', async () => {
      const flow = await locationService.handleLocationPermissionDenied();

      expect(flow.denialType).toBe('soft');
      expect(flow.canRetry).toBe(true);
      expect(flow.fallbackOptions).toContain('ip_location');
      expect(flow.fallbackOptions).toContain('manual_entry');
      expect(flow.retryAttempts).toBe(1);
    });

    test('should escalate to hard denial after multiple attempts', async () => {
      // First denial
      await locationService.handleLocationPermissionDenied();
      // Second denial
      const flow = await locationService.handleLocationPermissionDenied();

      expect(flow.denialType).toBe('hard');
      expect(flow.fallbackOptions).toContain('city_selection');
      expect(flow.retryAttempts).toBe(2);
    });

    test('should escalate to system settings after max attempts', async () => {
      // Three denials to trigger system settings
      await locationService.handleLocationPermissionDenied();
      await locationService.handleLocationPermissionDenied();
      const flow = await locationService.handleLocationPermissionDenied();

      expect(flow.denialType).toBe('system_settings');
      expect(flow.systemSettingsPrompted).toBe(true);
      expect(flow.canRetry).toBe(false);
      expect(flow.retryAttempts).toBe(3);
      expect(flow.fallbackOptions).not.toContain('ip_location'); // No IP fallback for system settings
    });
  });

  describe('Service Unavailable Handling', () => {
    test('should handle GPS service unavailable with network fallback', async () => {
      const handling = await locationService.handleServiceUnavailable('gps');

      expect(handling.serviceType).toBe('gps');
      expect(handling.fallbackStrategy).toBe('network');
      expect(handling.alternativeOptions).toContain('Use IP-based location');
      expect(handling.graceDegradation).toBe(true);
    });

    test('should handle network service unavailable with cache fallback', async () => {
      const handling = await locationService.handleServiceUnavailable('network');

      expect(handling.serviceType).toBe('network');
      expect(handling.fallbackStrategy).toBe('cached');
      expect(handling.alternativeOptions).toContain('Use cached location');
      expect(handling.userPromptRequired).toBe(true);
    });

    test('should handle geocoding service unavailable with manual fallback', async () => {
      const handling = await locationService.handleServiceUnavailable('geocoding');

      expect(handling.serviceType).toBe('geocoding');
      expect(handling.fallbackStrategy).toBe('manual');
      expect(handling.alternativeOptions).toContain('Enter coordinates manually');
      expect(handling.graceDegradation).toBe(false);
    });

    test('should throw error for unknown service type', async () => {
      await expect(locationService.handleServiceUnavailable('unknown' as any))
        .rejects.toThrow('No handling strategy configured for service: unknown');
    });
  });

  describe('Location Validation', () => {
    test('should validate coordinates correctly', () => {
      const service = locationService as any;

      expect(service.isValidCoordinate(40.7128, -74.0060)).toBe(true);
      expect(service.isValidCoordinate(0, 0)).toBe(true);
      expect(service.isValidCoordinate(90, 180)).toBe(true);
      expect(service.isValidCoordinate(-90, -180)).toBe(true);
      
      // Invalid coordinates
      expect(service.isValidCoordinate(91, 0)).toBe(false);
      expect(service.isValidCoordinate(0, 181)).toBe(false);
      expect(service.isValidCoordinate(NaN, 0)).toBe(false);
      expect(service.isValidCoordinate(0, NaN)).toBe(false);
    });

    test('should validate location coordinates with issues detection', () => {
      const service = locationService as any;

      const validLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 50,
        timestamp: Date.now(),
      };

      const validation = service.validateLocationCoordinates(validLocation);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should detect invalid coordinates in validation', () => {
      const service = locationService as any;

      const invalidLocation: LocationCoordinates = {
        latitude: 200, // Invalid
        longitude: -74.0060,
        accuracy: 50,
        timestamp: Date.now(),
      };

      const validation = service.validateLocationCoordinates(invalidLocation);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Invalid coordinate range');
    });

    test('should detect poor accuracy in validation', () => {
      const service = locationService as any;

      const poorAccuracyLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 6000, // Very poor accuracy
        timestamp: Date.now(),
      };

      const validation = service.validateLocationCoordinates(poorAccuracyLocation);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Location accuracy too poor (>5km)');
    });

    test('should detect old location data in validation', () => {
      const service = locationService as any;

      const oldLocation: LocationCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 50,
        timestamp: Date.now() - 3700000, // More than 1 hour old
      };

      const validation = service.validateLocationCoordinates(oldLocation);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Location data too old (>1 hour)');
    });
  });

  describe('Cache and Statistics', () => {
    test('should provide accurate cache statistics', () => {
      // Clear and add some test data
      locationService.clearLocationCache();
      
      // Add mock cache entries via private method for testing
      const service = locationService as any;
      const now = Date.now();
      
      service.locationCache.set('key1', {
        location: { latitude: 40.7128, longitude: -74.0060, accuracy: 10, timestamp: now },
        cacheTimestamp: now - 1000,
        source: 'gps',
        reliability: 95
      });
      
      service.locationCache.set('key2', {
        location: { latitude: 40.7130, longitude: -74.0062, accuracy: 25, timestamp: now },
        cacheTimestamp: now - 2000,
        source: 'network',
        reliability: 75
      });

      const stats = service.getCacheStatistics();
      expect(stats.cacheSize).toBe(2);
      expect(stats.averageReliability).toBe(85); // (95 + 75) / 2
      expect(stats.sourceCounts.gps).toBe(1);
      expect(stats.sourceCounts.network).toBe(1);
    });

    test('should reset accuracy system correctly', () => {
      // Add some test data first
      locationService.configureLocationUpdateFrequency({ interval: 30000 });
      
      locationService.resetLocationAccuracySystem();

      const stats = locationService.getLocationUpdateFrequencyStats();
      expect(stats.currentConfig.interval).toBe(10000); // Back to default
      expect(stats.movementData.averageSpeed).toBe(0);
      expect(stats.movementData.movementPattern).toBe('stationary');
      
      const history = locationService.getLocationRefinementHistory();
      expect(history).toHaveLength(0);
    });
  });
});