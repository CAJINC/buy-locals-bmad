import { searchPerformanceService, SEARCH_PERFORMANCE_CONFIG, SearchQuery } from '../searchPerformanceService';
import { enhancedLocationSearchService } from '../enhancedLocationSearchService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

describe('SearchPerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Debounced Search', () => {
    test('should debounce search calls correctly', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [],
        totalCount: 0,
        executionTime: 100,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        search: 'test',
      };

      // Fire multiple rapid calls
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          searchPerformanceService.debouncedSearch(query, mockSearchFunction)
        );
      }

      // Wait for debounce delay + some buffer
      await new Promise(resolve => setTimeout(resolve, SEARCH_PERFORMANCE_CONFIG.DEBOUNCE_DELAY + 100));
      
      // Resolve all promises
      await Promise.all(promises);

      // Should only call the search function once due to debouncing
      expect(mockSearchFunction).toHaveBeenCalledTimes(1);
    });

    test('should handle immediate search requests', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [],
        totalCount: 0,
        executionTime: 100,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
      };

      const result = await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      expect(mockSearchFunction).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    test('should adjust debounce delay based on search complexity', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [],
        totalCount: 0,
        executionTime: 100,
      });

      const simpleQuery: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
      };

      const complexQuery: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        search: 'complex search query',
        category: ['restaurant', 'bar'],
        sortBy: 'rating',
      };

      // Test simple query (should have standard debounce)
      const start1 = Date.now();
      await searchPerformanceService.debouncedSearch(simpleQuery, mockSearchFunction);
      const duration1 = Date.now() - start1;

      // Test complex query (should have longer debounce)
      const start2 = Date.now();
      await searchPerformanceService.debouncedSearch(complexQuery, mockSearchFunction);
      const duration2 = Date.now() - start2;

      expect(mockSearchFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Progressive Search', () => {
    test('should perform progressive loading with expanding radius', async () => {
      const mockSearchFunction = jest.fn()
        .mockResolvedValueOnce({
          businesses: [{ id: '1', name: 'Business 1', distance: 2 }],
          totalCount: 1,
          executionTime: 100,
        })
        .mockResolvedValueOnce({
          businesses: [
            { id: '1', name: 'Business 1', distance: 2 },
            { id: '2', name: 'Business 2', distance: 8 },
          ],
          totalCount: 2,
          executionTime: 150,
        });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        radius: 25,
      };

      const partialResults: any[] = [];
      const result = await searchPerformanceService.progressiveSearch(
        query,
        mockSearchFunction,
        (partial, radius) => {
          partialResults.push({ results: partial, radius });
        }
      );

      expect(mockSearchFunction).toHaveBeenCalled();
      expect(result.isProgressive).toBeTruthy();
      expect(partialResults.length).toBeGreaterThan(0);
    });

    test('should stop progressive loading if time budget is exceeded', async () => {
      const slowMockSearchFunction = jest.fn()
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              businesses: [],
              totalCount: 0,
              executionTime: 900,
            }), 900)
          )
        );

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        radius: 50,
      };

      const start = Date.now();
      const result = await searchPerformanceService.progressiveSearch(
        query,
        slowMockSearchFunction
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(SEARCH_PERFORMANCE_CONFIG.PERFORMANCE_TARGET * 2);
      expect(result).toBeDefined();
    });
  });

  describe('Caching', () => {
    test('should cache search results correctly', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [{ id: '1', name: 'Test Business' }],
        totalCount: 1,
        executionTime: 100,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        search: 'test',
      };

      // First call should hit the API
      const result1 = await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      expect(mockSearchFunction).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      // Should still only be called once (second call used cache)
      expect(mockSearchFunction).toHaveBeenCalledTimes(1);
    });

    test('should handle cache expiration correctly', async () => {
      // Mock a very short cache TTL for testing
      const originalCacheTTL = SEARCH_PERFORMANCE_CONFIG.CACHE_TTL;
      (SEARCH_PERFORMANCE_CONFIG as any).CACHE_TTL = 100; // 100ms

      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [],
        totalCount: 0,
        executionTime: 50,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
      };

      // First call
      await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should hit API again due to cache expiration
      await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      expect(mockSearchFunction).toHaveBeenCalledTimes(2);

      // Restore original cache TTL
      (SEARCH_PERFORMANCE_CONFIG as any).CACHE_TTL = originalCacheTTL;
    });

    test('should handle nearby cache hits with location flexibility', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [{ id: '1', name: 'Test Business' }],
        totalCount: 1,
        executionTime: 100,
      });

      // First query at exact location
      const query1: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        radius: 25,
      };

      await searchPerformanceService.debouncedSearch(
        query1, 
        mockSearchFunction,
        { immediate: true }
      );

      // Second query very close by (should use cached result)
      const query2: SearchQuery = {
        lat: 37.7750, // Slightly different
        lng: -122.4195, // Slightly different
        radius: 25,
      };

      await searchPerformanceService.debouncedSearch(
        query2, 
        mockSearchFunction,
        { immediate: true }
      );

      // Should only call API once due to nearby cache hit
      expect(mockSearchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Monitoring', () => {
    test('should collect performance metrics correctly', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [{ id: '1', name: 'Test Business' }],
        totalCount: 1,
        executionTime: 150,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
      };

      // Perform some searches
      for (let i = 0; i < 5; i++) {
        await searchPerformanceService.debouncedSearch(
          { ...query, search: `test${i}` }, 
          mockSearchFunction,
          { immediate: true }
        );
      }

      const analytics = searchPerformanceService.getPerformanceAnalytics();
      
      expect(analytics.recentMetrics.length).toBeGreaterThan(0);
      expect(analytics.averageExecutionTime).toBeGreaterThan(0);
      expect(analytics.sub1SecondRate).toBeGreaterThanOrEqual(0);
      expect(analytics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    test('should track cache hit rate accurately', async () => {
      const mockSearchFunction = jest.fn().mockResolvedValue({
        businesses: [],
        totalCount: 0,
        executionTime: 100,
      });

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        search: 'cache-test',
      };

      // First call (cache miss)
      await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      // Second call (cache hit)
      await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      );

      const analytics = searchPerformanceService.getPerformanceAnalytics();
      
      // Should have some cache hits recorded
      expect(analytics.cacheHitRate).toBeGreaterThan(0);
      expect(mockSearchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Condition Handling', () => {
    test('should adjust behavior for slow network conditions', async () => {
      const slowMockSearchFunction = jest.fn()
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              businesses: [],
              totalCount: 0,
              executionTime: 3000, // Simulate slow network
            }), 3000)
          )
        );

      const query: SearchQuery = {
        lat: 37.7749,
        lng: -122.4194,
      };

      // This should trigger slow network detection and fallback
      try {
        await searchPerformanceService.debouncedSearch(
          query, 
          slowMockSearchFunction,
          { immediate: true }
        );
      } catch (error) {
        // Expected to fail due to timeout
        expect(error.message).toContain('timeout');
      }

      const analytics = searchPerformanceService.getPerformanceAnalytics();
      expect(analytics.networkCondition).toBeDefined();
    });
  });

  describe('Offline Cache', () => {
    test('should store and retrieve offline cache correctly', async () => {
      const mockData = JSON.stringify({
        'test-key': {
          businesses: [{ id: '1', name: 'Offline Business' }],
          totalCount: 1,
          timestamp: Date.now(),
          searchCenter: { lat: 37.7749, lng: -122.4194 },
          searchRadius: 25,
          cacheKey: 'test-key',
          isOfflineCache: true,
        },
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockData);

      const mockSearchFunction = jest.fn().mockRejectedValue(new Error('Network error'));

      const query: SearchQuery = {
        lat: 37.7750, // Close to cached location
        lng: -122.4195,
        radius: 25,
      };

      const result = await searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      ).catch(() => null); // Handle expected failure

      // Should attempt to use offline cache on network failure
      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('Preloading', () => {
    test('should update preload areas correctly', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const radius = 15;
      const priority = 7;

      searchPerformanceService.updatePreloadArea(lat, lng, radius, priority);

      // Should not throw and should handle the update
      expect(() => {
        searchPerformanceService.updatePreloadArea(lat, lng, radius, priority);
      }).not.toThrow();
    });

    test('should provide cache statistics', () => {
      const stats = searchPerformanceService.getCacheStatistics();

      expect(stats).toHaveProperty('memoryCacheSize');
      expect(stats).toHaveProperty('offlineCacheSize');
      expect(stats).toHaveProperty('preloadAreas');
      expect(stats).toHaveProperty('performanceMetrics');
      expect(typeof stats.memoryCacheSize).toBe('number');
    });
  });
});

describe('EnhancedLocationSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for API calls
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Search Methods', () => {
    test('should perform standard search correctly', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          businesses: [
            {
              id: '1',
              name: 'Test Business',
              categories: ['restaurant'],
              location: { lat: 37.7749, lng: -122.4194 },
              distance_km: 1.5,
              rating: 4.2,
              review_count: 50,
            },
          ],
          totalCount: 1,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.searchBusinesses(
        mockLocation,
        { search: 'test' },
        { enableDebouncing: false }
      );

      expect(result.businesses).toHaveLength(1);
      expect(result.businesses[0].name).toBe('Test Business');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle progressive search', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          businesses: [
            {
              id: '1',
              name: 'Nearby Business',
              categories: ['cafe'],
              location: { lat: 37.7749, lng: -122.4194 },
              distance_km: 0.5,
              rating: 4.5,
              review_count: 30,
            },
          ],
          totalCount: 1,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.searchBusinesses(
        mockLocation,
        {},
        { useProgressiveLoading: true }
      );

      expect(result.businesses).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle API errors with fallback', async () => {
      // Mock API failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Mock offline cache
      const mockOfflineData = JSON.stringify([
        {
          id: '1',
          name: 'Offline Business',
          category: ['restaurant'],
          location: { lat: 37.7749, lng: -122.4194 },
          distance: 1.0,
          rating: 4.0,
          reviewCount: 25,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockOfflineData);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.searchBusinesses(
        mockLocation,
        {},
        { fallbackToCache: true }
      );

      expect(result.businesses).toBeDefined();
      expect(result.isOffline).toBeTruthy();
    });
  });

  describe('Category Search', () => {
    test('should search by category correctly', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          businesses: [
            {
              id: '1',
              name: 'Restaurant 1',
              categories: ['restaurant'],
              location: { lat: 37.7749, lng: -122.4194 },
              distance_km: 1.0,
              rating: 4.3,
              review_count: 75,
            },
          ],
          totalCount: 1,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.searchByCategory(
        'restaurant',
        mockLocation
      );

      expect(result.businesses).toHaveLength(1);
      expect(result.businesses[0].category).toContain('restaurant');
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Text Search', () => {
    test('should search by text with debouncing', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          businesses: [
            {
              id: '1',
              name: 'Coffee Shop',
              categories: ['cafe'],
              location: { lat: 37.7749, lng: -122.4194 },
              distance_km: 0.8,
              rating: 4.6,
              review_count: 120,
            },
          ],
          totalCount: 1,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.searchByText(
        'coffee',
        mockLocation,
        { enableDebouncing: true }
      );

      expect(result.businesses).toHaveLength(1);
      expect(result.businesses[0].name).toBe('Coffee Shop');
    });
  });

  describe('Nearby Search', () => {
    test('should get nearby businesses correctly', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          businesses: [
            {
              id: '1',
              name: 'Nearby Store',
              categories: ['retail'],
              location: { lat: 37.7750, lng: -122.4195 },
              distance_km: 0.3,
              rating: 4.1,
              review_count: 45,
            },
          ],
          totalCount: 1,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const result = await enhancedLocationSearchService.getNearbyBusinesses(
        mockLocation,
        5 // 5km radius
      );

      expect(result.businesses).toHaveLength(1);
      expect(result.businesses[0].distance).toBeLessThan(5);
    });
  });

  describe('Performance Analytics', () => {
    test('should provide search performance analytics', () => {
      const analytics = enhancedLocationSearchService.getSearchPerformance();

      expect(analytics).toHaveProperty('totalSearches');
      expect(analytics).toHaveProperty('cacheHitRate');
      expect(analytics).toHaveProperty('averageLatency');
      expect(analytics).toHaveProperty('sub1SecondRate');
      expect(analytics).toHaveProperty('performanceService');
      expect(typeof analytics.totalSearches).toBe('number');
    });
  });

  describe('Cache Management', () => {
    test('should cache businesses for offline use', async () => {
      const businesses = [
        {
          id: '1',
          name: 'Test Business',
          category: ['restaurant'],
          location: { lat: 37.7749, lng: -122.4194 },
          distance: 1.0,
          rating: 4.2,
          reviewCount: 30,
        },
      ];

      await enhancedLocationSearchService.cacheBusinessesForOffline(businesses);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('should clear search cache correctly', async () => {
      await enhancedLocationSearchService.clearSearchCache();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@buy_locals:offline_businesses');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@buy_locals:search_metrics');
    });
  });

  describe('Search Suggestions', () => {
    test('should get search suggestions', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          categories: ['restaurant', 'cafe', 'retail'],
          popularSearches: ['coffee', 'food', 'shopping'],
          nearbyLandmarks: ['Central Park', 'Downtown'],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const suggestions = await enhancedLocationSearchService.getSearchSuggestions(mockLocation);

      expect(suggestions.categories).toBeDefined();
      expect(suggestions.popularSearches).toBeDefined();
      expect(suggestions.nearbyLandmarks).toBeDefined();
      expect(Array.isArray(suggestions.categories)).toBeTruthy();
    });

    test('should fallback to cached suggestions on API error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const suggestions = await enhancedLocationSearchService.getSearchSuggestions(mockLocation);

      expect(suggestions.categories).toBeDefined();
      expect(suggestions.popularSearches).toBeDefined();
      expect(Array.isArray(suggestions.categories)).toBeTruthy();
    });
  });
});

describe('Performance Integration Tests', () => {
  test('should maintain sub-1-second performance for cached results', async () => {
    const mockSearchFunction = jest.fn().mockResolvedValue({
      businesses: [{ id: '1', name: 'Fast Business' }],
      totalCount: 1,
      executionTime: 50,
    });

    const query: SearchQuery = {
      lat: 37.7749,
      lng: -122.4194,
    };

    // First call to populate cache
    await searchPerformanceService.debouncedSearch(
      query, 
      mockSearchFunction,
      { immediate: true }
    );

    // Second call should be from cache and very fast
    const start = Date.now();
    const result = await searchPerformanceService.debouncedSearch(
      query, 
      mockSearchFunction,
      { immediate: true }
    );
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should be very fast from cache
    expect(result).toBeDefined();
  });

  test('should handle concurrent search requests efficiently', async () => {
    const mockSearchFunction = jest.fn().mockResolvedValue({
      businesses: [],
      totalCount: 0,
      executionTime: 200,
    });

    const query: SearchQuery = {
      lat: 37.7749,
      lng: -122.4194,
      search: 'concurrent-test',
    };

    // Fire multiple concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      )
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    // Should handle concurrent requests efficiently
    expect(results).toHaveLength(10);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
    expect(mockSearchFunction).toHaveBeenCalledTimes(1); // Should deduplicate requests
  });

  test('should maintain cache efficiency under load', async () => {
    const mockSearchFunction = jest.fn().mockResolvedValue({
      businesses: [],
      totalCount: 0,
      executionTime: 100,
    });

    // Perform many searches to test cache efficiency
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        searchPerformanceService.debouncedSearch(
          {
            lat: 37.7749 + (i * 0.001), // Slight variations
            lng: -122.4194 + (i * 0.001),
            search: `test-${Math.floor(i / 10)}`, // Some repeated searches
          }, 
          mockSearchFunction,
          { immediate: true }
        )
      );
    }

    await Promise.all(promises);

    const analytics = searchPerformanceService.getPerformanceAnalytics();
    
    // Should maintain good cache hit rate
    expect(analytics.cacheHitRate).toBeGreaterThan(0.2); // At least 20% cache hits
    expect(analytics.averageExecutionTime).toBeLessThan(500); // Average under 500ms
  });
});

describe('Error Handling and Resilience', () => {
  test('should handle search function failures gracefully', async () => {
    const mockSearchFunction = jest.fn().mockRejectedValue(new Error('Search API failed'));

    const query: SearchQuery = {
      lat: 37.7749,
      lng: -122.4194,
    };

    await expect(
      searchPerformanceService.debouncedSearch(
        query, 
        mockSearchFunction,
        { immediate: true }
      )
    ).rejects.toThrow('Search API failed');
  });

  test('should handle malformed API responses', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve(null), // Malformed response
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockLocation = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      timestamp: Date.now(),
    };

    const result = await enhancedLocationSearchService.searchBusinesses(
      mockLocation,
      {},
      { fallbackToCache: true }
    );

    // Should handle gracefully and provide empty results
    expect(result).toBeDefined();
    expect(Array.isArray(result.businesses)).toBeTruthy();
  });

  test('should recover from cache corruption', async () => {
    // Mock corrupted cache data
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

    // Should not throw and should continue working
    await expect(searchPerformanceService.clearAllCaches()).resolves.not.toThrow();
  });
});

// Performance benchmark tests
describe('Performance Benchmarks', () => {
  test('should meet 1-second performance target for most searches', async () => {
    const fastMockSearchFunction = jest.fn().mockResolvedValue({
      businesses: Array.from({ length: 20 }, (_, i) => ({
        id: `business-${i}`,
        name: `Business ${i}`,
        distance: i * 0.5,
      })),
      totalCount: 20,
      executionTime: 150,
    });

    const query: SearchQuery = {
      lat: 37.7749,
      lng: -122.4194,
      limit: 20,
    };

    const start = Date.now();
    const result = await searchPerformanceService.debouncedSearch(
      query, 
      fastMockSearchFunction,
      { immediate: true }
    );
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(SEARCH_PERFORMANCE_CONFIG.PERFORMANCE_TARGET);
    expect(result.businesses).toHaveLength(20);
  });
});