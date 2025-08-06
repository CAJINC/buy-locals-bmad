import { dynamicSearchService } from '../../dynamicSearchService';
import { locationService } from '../../locationService';
import { bandwidthManager } from '../../../utils/bandwidthManager';

// Mock dependencies for performance testing
jest.mock('../../locationService');
jest.mock('../../../utils/bandwidthManager');
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockLocationService = locationService as jest.Mocked<typeof locationService>;
const mockBandwidthManager = bandwidthManager as jest.Mocked<typeof bandwidthManager>;

describe('DynamicSearchService Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup performance-optimized mocks
    mockLocationService.subscribeToLocationUpdates.mockReturnValue(() => {});
    mockLocationService.calculateDistance.mockReturnValue(1.0);
    
    mockBandwidthManager.canMakeRequest.mockReturnValue(true);
    mockBandwidthManager.queueRequest.mockReturnValue(true);
    mockBandwidthManager.getOptimalUpdateFrequency.mockReturnValue(1000);
  });

  afterEach(() => {
    jest.useRealTimers();
    dynamicSearchService.cleanup();
  });

  describe('Search Response Time Performance', () => {
    test('should complete searches within acceptable time limits', async () => {
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      const startTime = performance.now();
      const result = await dynamicSearchService.performDynamicSearch(criteria);
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      // Should complete within 3 seconds for fresh searches
      expect(responseTime).toBeLessThan(3000);
      expect(result.id).toBeDefined();
    });

    test('should return cached results quickly', async () => {
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      // First search to populate cache
      await dynamicSearchService.performDynamicSearch(criteria);

      // Second search should use cache
      const startTime = performance.now();
      const result = await dynamicSearchService.performDynamicSearch(criteria);
      const endTime = performance.now();
      
      const cacheResponseTime = endTime - startTime;
      
      // Cached results should be very fast (< 100ms)
      expect(cacheResponseTime).toBeLessThan(100);
      expect(result.source).toBe('cached');
    });

    test('should handle concurrent searches efficiently', async () => {
      const searchPromises = [];
      const startTime = performance.now();

      // Start 5 concurrent searches with different regions
      for (let i = 0; i < 5; i++) {
        const criteria = {
          radius: 5,
          location: { 
            latitude: 37.7749 + (i * 0.01), 
            longitude: -122.4194 + (i * 0.01), 
            accuracy: 10, 
            timestamp: Date.now() 
          },
          region: { 
            latitude: 37.7749 + (i * 0.01), 
            longitude: -122.4194 + (i * 0.01), 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01, 
            timestamp: Date.now() 
          },
          timestamp: Date.now()
        };
        
        searchPromises.push(dynamicSearchService.performDynamicSearch(criteria));
      }

      const results = await Promise.all(searchPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / results.length;

      // Concurrent searches should complete efficiently
      expect(totalTime).toBeLessThan(5000); // 5 seconds total
      expect(averageTime).toBeLessThan(2000); // 2 seconds average
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.id).toBeDefined();
      });
    });
  });

  describe('Memory Usage Performance', () => {
    test('should limit cache memory usage', async () => {
      const initialStats = dynamicSearchService.getSearchStatistics();
      
      // Perform many searches to test cache limits
      for (let i = 0; i < 100; i++) {
        const criteria = {
          radius: 5,
          location: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194 + (i * 0.001), 
            accuracy: 10, 
            timestamp: Date.now() 
          },
          region: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194 + (i * 0.001), 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01, 
            timestamp: Date.now() 
          },
          timestamp: Date.now()
        };
        
        await dynamicSearchService.performDynamicSearch(criteria);
      }

      const finalStats = dynamicSearchService.getSearchStatistics();
      
      // Cache should enforce size limits
      expect(finalStats.cacheSize).toBeLessThanOrEqual(50);
      expect(finalStats.totalSearches).toBe(100);
    });

    test('should cleanup expired cache entries efficiently', async () => {
      // Mock time progression
      let currentTime = Date.now();
      const originalNow = Date.now;
      Date.now = jest.fn(() => currentTime);

      // Add searches
      for (let i = 0; i < 10; i++) {
        const criteria = {
          radius: 5,
          location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: currentTime },
          region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: currentTime },
          timestamp: currentTime
        };
        
        await dynamicSearchService.performDynamicSearch(criteria);
        currentTime += 1000; // Advance time
      }

      const midStats = dynamicSearchService.getSearchStatistics();
      
      // Advance time significantly to expire cache
      currentTime += 15 * 60 * 1000; // 15 minutes
      
      // Trigger cache cleanup by performing new search
      const cleanupCriteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: currentTime },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: currentTime },
        timestamp: currentTime
      };
      
      await dynamicSearchService.performDynamicSearch(cleanupCriteria);
      
      const finalStats = dynamicSearchService.getSearchStatistics();
      
      // Cache should be cleaned up
      expect(finalStats.cacheSize).toBeLessThan(midStats.cacheSize);
      
      Date.now = originalNow;
    });
  });

  describe('Bandwidth Optimization Performance', () => {
    test('should adapt to network conditions quickly', async () => {
      // Simulate slow network
      mockBandwidthManager.getCurrentNetworkCondition.mockReturnValue({
        type: 'cellular',
        isConnected: true,
        isInternetReachable: true,
        details: { cellularGeneration: '2g' },
        timestamp: Date.now()
      });
      
      mockBandwidthManager.getOptimalUpdateFrequency.mockReturnValue(5000); // 5 second debounce

      const region = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      const startTime = performance.now();
      await dynamicSearchService.handleRegionChange(region, 'user_pan');
      
      // Fast-forward to trigger debounced search
      jest.advanceTimersByTime(6000);
      const endTime = performance.now();

      // Should respect bandwidth limitations
      expect(mockBandwidthManager.queueRequest).toHaveBeenCalled();
      expect(mockBandwidthManager.canMakeRequest).toHaveBeenCalled();
    });

    test('should throttle requests under bandwidth constraints', async () => {
      // Simulate bandwidth limitations
      mockBandwidthManager.canMakeRequest.mockReturnValue(false);
      
      let requestCount = 0;
      const originalPerformSearch = dynamicSearchService.performDynamicSearch;
      dynamicSearchService.performDynamicSearch = jest.fn().mockImplementation(async (...args) => {
        requestCount++;
        return originalPerformSearch.apply(dynamicSearchService, args);
      });

      // Try to make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const criteria = {
          radius: 5,
          location: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194, 
            accuracy: 10, 
            timestamp: Date.now() 
          },
          region: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194, 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01, 
            timestamp: Date.now() 
          },
          timestamp: Date.now()
        };
        
        promises.push(
          dynamicSearchService.performDynamicSearch(criteria).catch(() => null)
        );
      }

      await Promise.allSettled(promises);

      // Should have limited the number of actual requests
      expect(requestCount).toBeLessThan(10);
    });
  });

  describe('Region Change Debouncing Performance', () => {
    test('should efficiently batch rapid region changes', async () => {
      let searchTriggerCount = 0;
      dynamicSearchService.on('search_notification', (notification) => {
        if (notification.type === 'search_started') {
          searchTriggerCount++;
        }
      });

      const baseRegion = {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        timestamp: Date.now()
      };

      const startTime = performance.now();

      // Simulate rapid region changes (like user panning)
      for (let i = 0; i < 20; i++) {
        await dynamicSearchService.handleRegionChange({
          ...baseRegion,
          latitude: baseRegion.latitude + (i * 0.0001),
          timestamp: Date.now()
        }, 'user_pan');
        
        // Small delay between changes
        jest.advanceTimersByTime(50);
      }

      // Wait for debounce to complete
      jest.advanceTimersByTime(2000);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      // Should efficiently batch changes and only trigger 1-2 searches
      expect(searchTriggerCount).toBeLessThanOrEqual(2);
      expect(processingTime).toBeLessThan(1000); // Should be fast to process
    });

    test('should handle high-frequency location updates efficiently', async () => {
      mockLocationService.subscribeToLocationUpdates.mockImplementation((callback) => {
        // Simulate high-frequency GPS updates
        const interval = setInterval(() => {
          callback({
            latitude: 37.7749 + (Math.random() * 0.001),
            longitude: -122.4194 + (Math.random() * 0.001),
            accuracy: 10,
            timestamp: Date.now()
          });
        }, 100); // 10 times per second

        return () => clearInterval(interval);
      });

      let processedUpdates = 0;
      const originalHandleLocationUpdate = (dynamicSearchService as any).handleLocationUpdate;
      (dynamicSearchService as any).handleLocationUpdate = jest.fn().mockImplementation(async (...args) => {
        processedUpdates++;
        return originalHandleLocationUpdate.apply(dynamicSearchService, args);
      });

      const startTime = performance.now();
      
      // Let it run for 2 seconds
      jest.advanceTimersByTime(2000);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should handle all updates without performance issues
      expect(processedUpdates).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(500); // Efficient processing
    });
  });

  describe('Search Result Processing Performance', () => {
    test('should process large result sets efficiently', async () => {
      // Mock large result set
      const largeBusiness = Array.from({ length: 1000 }, (_, i) => ({
        id: `business-${i}`,
        name: `Business ${i}`,
        coordinates: { 
          latitude: 37.7749 + (Math.random() * 0.01), 
          longitude: -122.4194 + (Math.random() * 0.01) 
        },
        rating: 3 + Math.random() * 2,
        category: ['restaurant', 'retail', 'service'][i % 3]
      }));

      const mockFetchBusinesses = jest.spyOn(
        dynamicSearchService as any, 
        'fetchBusinessesFromAPI'
      ).mockResolvedValue(largeBusiness);

      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      const startTime = performance.now();
      const result = await dynamicSearchService.performDynamicSearch(criteria);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      // Should process large result sets efficiently
      expect(result.businesses).toHaveLength(1000);
      expect(processingTime).toBeLessThan(2000); // Should process within 2 seconds
      expect(result.confidence).toBeGreaterThan(0);

      mockFetchBusinesses.mockRestore();
    });

    test('should calculate confidence scores efficiently', async () => {
      const scenarios = [
        { accuracy: 5, responseTime: 500, businessCount: 50 }, // Excellent
        { accuracy: 100, responseTime: 1500, businessCount: 20 }, // Good
        { accuracy: 500, responseTime: 3000, businessCount: 5 }, // Fair
        { accuracy: 2000, responseTime: 8000, businessCount: 1 }, // Poor
      ];

      const confidenceResults = [];
      const startTime = performance.now();

      for (const scenario of scenarios) {
        const criteria = {
          radius: 5,
          location: { 
            latitude: 37.7749, 
            longitude: -122.4194, 
            accuracy: scenario.accuracy, 
            timestamp: Date.now() 
          },
          region: { 
            latitude: 37.7749, 
            longitude: -122.4194, 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01, 
            timestamp: Date.now() 
          },
          timestamp: Date.now()
        };

        // Mock performance characteristics
        jest.spyOn(dynamicSearchService as any, 'fetchBusinessesFromAPI')
          .mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, scenario.responseTime / 10));
            return Array.from({ length: scenario.businessCount }, (_, i) => ({
              id: `business-${i}`,
              name: `Business ${i}`
            }));
          });

        const result = await dynamicSearchService.performDynamicSearch(criteria);
        confidenceResults.push(result.confidence);
      }

      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;

      // Should calculate confidence efficiently
      expect(totalProcessingTime).toBeLessThan(1000);
      
      // Confidence should correlate with quality factors
      expect(confidenceResults[0]).toBeGreaterThan(confidenceResults[1]); // Excellent > Good
      expect(confidenceResults[1]).toBeGreaterThan(confidenceResults[2]); // Good > Fair
      expect(confidenceResults[2]).toBeGreaterThan(confidenceResults[3]); // Fair > Poor
    });
  });

  describe('Event System Performance', () => {
    test('should handle high-frequency event emissions efficiently', async () => {
      let eventCount = 0;
      const eventTypes = ['search_started', 'search_progress', 'search_completed'];
      
      const eventHandler = jest.fn(() => {
        eventCount++;
      });
      
      dynamicSearchService.on('search_notification', eventHandler);

      const startTime = performance.now();

      // Emit many events rapidly
      for (let i = 0; i < 1000; i++) {
        dynamicSearchService.emit('search_notification', {
          type: eventTypes[i % eventTypes.length],
          searchId: `search-${i}`,
          timestamp: Date.now(),
          region: {
            latitude: 37.7749,
            longitude: -122.4194,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
            timestamp: Date.now()
          }
        });
      }

      const endTime = performance.now();
      const emissionTime = endTime - startTime;

      // Should handle high-frequency events efficiently
      expect(eventCount).toBe(1000);
      expect(emissionTime).toBeLessThan(500); // Should be very fast
      expect(eventHandler).toHaveBeenCalledTimes(1000);
    });

    test('should cleanup event listeners efficiently', () => {
      const handlers = [];
      
      // Add many event listeners
      for (let i = 0; i < 100; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        dynamicSearchService.on('search_notification', handler);
      }

      const startTime = performance.now();
      
      // Remove all listeners
      dynamicSearchService.removeAllListeners('search_notification');
      
      const endTime = performance.now();
      const cleanupTime = endTime - startTime;

      // Should cleanup efficiently
      expect(cleanupTime).toBeLessThan(100);
      
      // Verify listeners are removed
      expect(dynamicSearchService.listenerCount('search_notification')).toBe(0);
    });
  });

  describe('Resource Cleanup Performance', () => {
    test('should cleanup resources efficiently', () => {
      const startTime = performance.now();
      
      dynamicSearchService.cleanup();
      
      const endTime = performance.now();
      const cleanupTime = endTime - startTime;

      // Should cleanup quickly
      expect(cleanupTime).toBeLessThan(100);
    });

    test('should handle memory cleanup under load', async () => {
      // Create many searches to test cleanup under load
      const searchPromises = [];
      for (let i = 0; i < 50; i++) {
        const criteria = {
          radius: 5,
          location: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194, 
            accuracy: 10, 
            timestamp: Date.now() 
          },
          region: { 
            latitude: 37.7749 + (i * 0.001), 
            longitude: -122.4194, 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01, 
            timestamp: Date.now() 
          },
          timestamp: Date.now()
        };
        
        searchPromises.push(dynamicSearchService.performDynamicSearch(criteria));
      }

      await Promise.all(searchPromises);

      const beforeCleanup = dynamicSearchService.getSearchStatistics();
      
      const startTime = performance.now();
      await dynamicSearchService.clearAllSearchData();
      const endTime = performance.now();
      
      const cleanupTime = endTime - startTime;
      const afterCleanup = dynamicSearchService.getSearchStatistics();

      // Should cleanup efficiently even under load
      expect(cleanupTime).toBeLessThan(500);
      expect(afterCleanup.cacheSize).toBe(0);
      expect(afterCleanup.activeSearches).toBe(0);
    });
  });

  describe('Integration Performance', () => {
    test('should maintain performance with multiple service integrations', async () => {
      // Enable all features
      const criteria = {
        radius: 5,
        location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: Date.now() },
        timestamp: Date.now()
      };

      // Mock all integrations being active
      mockBandwidthManager.canMakeRequest.mockReturnValue(true);
      mockBandwidthManager.queueRequest.mockReturnValue(true);
      mockBandwidthManager.startRequest.mockImplementation(() => {});
      mockBandwidthManager.completeRequest.mockImplementation(() => {});

      const startTime = performance.now();
      
      // Perform search with all integrations active
      const result = await dynamicSearchService.performDynamicSearch(criteria);
      
      const endTime = performance.now();
      const integrationTime = endTime - startTime;

      // Should maintain good performance with all integrations
      expect(integrationTime).toBeLessThan(3000);
      expect(result.id).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      
      // Verify all integrations were called
      expect(mockBandwidthManager.canMakeRequest).toHaveBeenCalled();
      expect(mockBandwidthManager.queueRequest).toHaveBeenCalled();
    });
  });
});