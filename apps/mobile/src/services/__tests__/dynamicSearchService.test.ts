import { dynamicSearchService, SearchUpdateNotification } from '../dynamicSearchService';
import { locationService } from '../locationService';
import NetInfo from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('../locationService');
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockLocationService = locationService as jest.Mocked<typeof locationService>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('DynamicSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup default mocks
    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: {}
    });
    
    mockNetInfo.addEventListener.mockReturnValue(() => {});
    
    mockLocationService.subscribeToLocationUpdates.mockReturnValue(() => {});
    mockLocationService.calculateDistance.mockReturnValue(1.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    dynamicSearchService.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with default settings', async () => {
      const stats = dynamicSearchService.getSearchStatistics();
      
      expect(stats.totalSearches).toBe(0);
      expect(stats.activeSearches).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });

    test('should setup network monitoring', async () => {
      expect(mockNetInfo.fetch).toHaveBeenCalled();
      expect(mockNetInfo.addEventListener).toHaveBeenCalled();
    });

    test('should setup location monitoring', async () => {
      expect(mockLocationService.subscribeToLocationUpdates).toHaveBeenCalled();
    });
  });

  describe('Region Change Handling', () => {
    test('should handle region changes with debouncing', async () => {
      const region = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      const notificationPromise = new Promise<SearchUpdateNotification>((resolve) => {
        dynamicSearchService.once('search_notification', resolve);
      });

      await dynamicSearchService.handleRegionChange(region, 'user_pan');
      
      // Fast-forward debounce timer
      jest.advanceTimersByTime(2000);

      const notification = await notificationPromise;
      expect(notification.type).toBe('search_started');
      expect(notification.region).toEqual(region);
    });

    test('should not trigger search for insignificant region changes', async () => {
      const region1 = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      const region2 = {
        ...region1,
        latitude: region1.latitude + 0.0001, // Very small change
        timestamp: Date.now()
      };

      let notificationCount = 0;
      dynamicSearchService.on('search_notification', () => {
        notificationCount++;
      });

      await dynamicSearchService.handleRegionChange(region1, 'user_pan');
      await dynamicSearchService.handleRegionChange(region2, 'user_pan');

      jest.advanceTimersByTime(2000);

      expect(notificationCount).toBeLessThanOrEqual(1);
    });

    test('should batch multiple rapid region changes', async () => {
      const baseRegion = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      let notificationCount = 0;
      dynamicSearchService.on('search_notification', () => {
        notificationCount++;
      });

      // Rapid region changes
      for (let i = 0; i < 5; i++) {
        await dynamicSearchService.handleRegionChange({
          ...baseRegion,
          latitude: baseRegion.latitude + (i * 0.001),
          timestamp: Date.now()
        }, 'user_pan');
      }

      jest.advanceTimersByTime(2000);

      // Should only trigger one search for the last region
      expect(notificationCount).toBeLessThanOrEqual(2); // Start + complete
    });
  });

  describe('Dynamic Search Execution', () => {
    test('should perform fresh search successfully', async () => {
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      const result = await dynamicSearchService.performDynamicSearch(criteria);

      expect(result.id).toBeDefined();
      expect(result.businesses).toBeInstanceOf(Array);
      expect(result.source).toBe('fresh');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should return cached results when available', async () => {
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      // First search
      const firstResult = await dynamicSearchService.performDynamicSearch(criteria);
      
      // Second search with same criteria (should use cache)
      const secondResult = await dynamicSearchService.performDynamicSearch(criteria);

      expect(secondResult.source).toBe('cached');
      expect(secondResult.id).toBe(firstResult.id);
    });

    test('should handle search failures gracefully', async () => {
      // Mock network failure
      mockNetInfo.fetch.mockResolvedValue({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
        details: {}
      });

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      let errorNotification: SearchUpdateNotification | null = null;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_failed') {
          errorNotification = notification;
        }
      });

      try {
        await dynamicSearchService.performDynamicSearch(criteria);
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(errorNotification).toBeTruthy();
      expect(errorNotification?.type).toBe('search_failed');
    });
  });

  describe('Bandwidth Management', () => {
    test('should limit searches on 2G connections', async () => {
      // Mock 2G connection
      mockNetInfo.fetch.mockResolvedValue({
        type: 'cellular',
        isConnected: true,
        isInternetReachable: true,
        details: {
          cellularGeneration: '2g'
        }
      });

      const region = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      let bandwidthNotification: SearchUpdateNotification | null = null;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'bandwidth_limited') {
          bandwidthNotification = notification;
        }
      });

      await dynamicSearchService.handleRegionChange(region, 'user_pan');
      jest.advanceTimersByTime(5000);

      expect(bandwidthNotification).toBeTruthy();
      expect(bandwidthNotification?.bandwidthInfo?.isLowBandwidth).toBe(true);
    });

    test('should adjust search frequency based on network speed', async () => {
      // Mock fast WiFi connection
      mockNetInfo.fetch.mockResolvedValue({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        details: {}
      });

      const stats = dynamicSearchService.getSearchStatistics();
      expect(stats.bandwidthStrategy.debounceMs).toBeLessThan(3000);
    });
  });

  describe('Search Result Invalidation', () => {
    test('should invalidate search results for overlapping regions', async () => {
      const region1 = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      const region2 = {
        latitude: 37.7750, // Slightly different
        longitude: -122.4195,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      // Perform initial search
      const criteria1 = {
        radius: 5,
        location: { latitude: region1.latitude, longitude: region1.longitude, accuracy: 10, timestamp: Date.now() },
        region: region1,
        timestamp: Date.now()
      };
      await dynamicSearchService.performDynamicSearch(criteria1);

      let invalidationNotification: SearchUpdateNotification | null = null;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'results_invalidated') {
          invalidationNotification = notification;
        }
      });

      // Invalidate results
      await dynamicSearchService.invalidateSearchResults(region2, 'location_change');

      expect(invalidationNotification).toBeTruthy();
      expect(invalidationNotification?.region).toEqual(region2);
    });
  });

  describe('User Preferences', () => {
    test('should respect auto-search disabled preference', async () => {
      await dynamicSearchService.updateUserPreferences({ autoSearchEnabled: false });

      const region = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      let searchStarted = false;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_started') {
          searchStarted = true;
        }
      });

      await dynamicSearchService.handleRegionChange(region, 'user_pan');
      jest.advanceTimersByTime(3000);

      expect(searchStarted).toBe(false);
    });

    test('should update data usage preferences', async () => {
      const preferences = { dataUsageMode: 'minimal' as const };
      await dynamicSearchService.updateUserPreferences(preferences);

      // Verify preferences were applied
      const stats = dynamicSearchService.getSearchStatistics();
      expect(stats.bandwidthStrategy.debounceMs).toBeGreaterThan(2000);
    });
  });

  describe('Location Updates', () => {
    test('should trigger search on significant location change', async () => {
      const location1 = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const location2 = { latitude: 37.7849, longitude: -122.4294, accuracy: 10, timestamp: Date.now() }; // ~1.5km away

      // Mock distance calculation to return significant distance
      mockLocationService.calculateDistance.mockReturnValue(1.5);

      let searchStarted = false;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_started') {
          searchStarted = true;
        }
      });

      // Simulate location updates
      const mockCallback = mockLocationService.subscribeToLocationUpdates.mock.calls[0][0];
      mockCallback(location1);
      mockCallback(location2);

      jest.advanceTimersByTime(2000);

      expect(searchStarted).toBe(true);
    });

    test('should not trigger search on small location changes', async () => {
      const location1 = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const location2 = { latitude: 37.7750, longitude: -122.4195, accuracy: 10, timestamp: Date.now() }; // Small change

      // Mock distance calculation to return small distance
      mockLocationService.calculateDistance.mockReturnValue(0.05);

      let searchStarted = false;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_started') {
          searchStarted = true;
        }
      });

      // Simulate location updates
      const mockCallback = mockLocationService.subscribeToLocationUpdates.mock.calls[0][0];
      mockCallback(location1);
      mockCallback(location2);

      jest.advanceTimersByTime(2000);

      expect(searchStarted).toBe(false);
    });
  });

  describe('Performance and Optimization', () => {
    test('should limit concurrent searches', async () => {
      const criteria1 = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      const criteria2 = {
        radius: 5,
        location: { latitude: 37.7849, longitude: -122.4294, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7849, longitude: -122.4294, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      // Start multiple searches concurrently
      const search1Promise = dynamicSearchService.performDynamicSearch(criteria1);
      const search2Promise = dynamicSearchService.performDynamicSearch(criteria2);

      const stats = dynamicSearchService.getSearchStatistics();
      expect(stats.activeSearches).toBeGreaterThan(0);
      expect(stats.activeSearches).toBeLessThanOrEqual(stats.bandwidthStrategy.maxConcurrentRequests);

      await Promise.all([search1Promise, search2Promise]);
    });

    test('should calculate search confidence correctly', async () => {
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 50, timestamp: Date.now() }, // Good accuracy
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      const result = await dynamicSearchService.performDynamicSearch(criteria);

      expect(result.confidence).toBeGreaterThan(70); // Should be high confidence
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('Data Management', () => {
    test('should manage cache size limits', async () => {
      // Perform many searches to fill cache
      for (let i = 0; i < 60; i++) {
        const criteria = {
          radius: 5,
          location: { latitude: 37.7749 + (i * 0.001), longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
          region: { latitude: 37.7749 + (i * 0.001), longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
          timestamp: Date.now()
        };
        await dynamicSearchService.performDynamicSearch(criteria);
      }

      const stats = dynamicSearchService.getSearchStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(50); // Should enforce cache limit
    });

    test('should clear all data when requested', async () => {
      // Perform some searches
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };
      await dynamicSearchService.performDynamicSearch(criteria);

      await dynamicSearchService.clearAllSearchData();

      const stats = dynamicSearchService.getSearchStatistics();
      expect(stats.cacheSize).toBe(0);
      expect(stats.totalSearches).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock network error
      mockNetInfo.addEventListener.mockImplementation((callback) => {
        callback({
          type: 'none',
          isConnected: false,
          isInternetReachable: false,
          details: {}
        });
        return () => {};
      });

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      let errorOccurred = false;
      try {
        await dynamicSearchService.performDynamicSearch(criteria);
      } catch (error) {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);
    });

    test('should recover from temporary failures', async () => {
      let failureCount = 0;
      
      // Mock API to fail first few times then succeed
      jest.spyOn(dynamicSearchService as any, 'fetchBusinessesFromAPI')
        .mockImplementation(async () => {
          if (failureCount < 2) {
            failureCount++;
            throw new Error('Temporary network error');
          }
          return [{ id: '1', name: 'Test Business' }];
        });

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      // Should eventually succeed after retries
      const result = await dynamicSearchService.performDynamicSearch(criteria);
      expect(result.businesses.length).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    test('should emit proper notification sequence for successful search', async () => {
      const notifications: SearchUpdateNotification[] = [];
      
      dynamicSearchService.on('search_notification', (notification) => {
        notifications.push(notification);
      });

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      await dynamicSearchService.performDynamicSearch(criteria);

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('search_started');
      expect(notifications[notifications.length - 1].type).toBe('search_completed');
    });

    test('should provide progress notifications during search', async () => {
      let progressNotifications = 0;
      
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_progress') {
          progressNotifications++;
        }
      });

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      await dynamicSearchService.performDynamicSearch(criteria);

      expect(progressNotifications).toBeGreaterThan(0);
    });
  });
});