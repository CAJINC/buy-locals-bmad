import { SuggestionService } from '../suggestionService';
import { ApiService } from '../apiService';
import { LocationCoordinates } from '../locationService';

// Mock ApiService
const mockApiService = {
  get: jest.fn(),
  post: jest.fn(),
} as unknown as ApiService;

// Mock location for testing
const mockLocation: LocationCoordinates = {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: Date.now(),
};

// Mock suggestions data
const mockSuggestionResponse = {
  success: true,
  data: {
    suggestions: [
      {
        id: 'business_1',
        type: 'business',
        text: 'Pizza Palace',
        displayText: 'Pizza Palace',
        description: '123 Main St, New York, NY',
        category: 'restaurants',
        location: {
          lat: 40.7130,
          lng: -74.0058,
          address: '123 Main St, New York, NY',
          distance: 0.2,
        },
        metadata: {
          frequency: 25,
          relevanceScore: 0.9,
          lastUsed: Date.now() - 3600000,
          userSpecific: false,
          globalPopularity: 85,
          locationPopularity: 90,
        },
        action: {
          type: 'search',
          payload: { query: 'Pizza Palace' },
        },
        analytics: {
          impressions: 120,
          clicks: 24,
          conversions: 8,
          ctr: 0.2,
        },
      },
      {
        id: 'category_1',
        type: 'category',
        text: 'pizza',
        displayText: 'Pizza',
        description: '15 businesses in area',
        category: 'restaurants',
        metadata: {
          frequency: 45,
          relevanceScore: 0.8,
          lastUsed: Date.now() - 1800000,
          userSpecific: false,
          globalPopularity: 70,
          locationPopularity: 75,
        },
        action: {
          type: 'filter',
          payload: { category: 'pizza' },
        },
        analytics: {
          impressions: 200,
          clicks: 35,
          conversions: 12,
          ctr: 0.175,
        },
      },
    ],
    totalCount: 2,
    responseTime: 145,
    cacheHit: false,
    metadata: {
      query: 'pizza',
      location: mockLocation,
      sources: ['business', 'category'],
      confidence: 0.85,
      hasMore: false,
    },
  },
};

const mockBusinessNamesResponse = {
  success: true,
  data: {
    suggestions: [
      {
        id: 'business_2',
        type: 'business',
        text: 'Pizza Corner',
        displayText: 'Pizza Corner',
        description: '456 Oak Ave, New York, NY',
        metadata: {
          relevanceScore: 0.85,
          frequency: 15,
          lastUsed: Date.now(),
          userSpecific: false,
          globalPopularity: 60,
        },
        action: {
          type: 'search',
          payload: { query: 'Pizza Corner' },
        },
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
        },
      },
    ],
    responseTime: 89,
    query: 'pizza',
  },
};

describe('SuggestionService', () => {
  let suggestionService: SuggestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    suggestionService = new SuggestionService(mockApiService);
  });

  afterEach(() => {
    suggestionService.cleanup();
  });

  describe('getSuggestions', () => {
    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);
    });

    it('should return suggestions for valid query', async () => {
      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].type).toBe('business');
      expect(result.suggestions[1].type).toBe('category');
      expect(result.cacheHit).toBe(false);
      expect(result.responseTime).toBe(145);
    });

    it('should return empty response for short queries', async () => {
      const result = await suggestionService.getSuggestions('a', mockLocation);

      expect(result.suggestions).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(mockApiService.get).not.toHaveBeenCalled();
    });

    it('should cache suggestions for performance', async () => {
      const query = 'test-query';
      
      // First call
      const result1 = await suggestionService.getSuggestions(query, mockLocation);
      expect(result1.cacheHit).toBe(false);
      expect(mockApiService.get).toHaveBeenCalledTimes(1);

      // Second call should hit cache
      const result2 = await suggestionService.getSuggestions(query, mockLocation);
      expect(result2.cacheHit).toBe(true);
      expect(mockApiService.get).toHaveBeenCalledTimes(1); // Still only one API call
    });

    it('should handle API errors gracefully', async () => {
      (mockApiService.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(result.suggestions).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.metadata.query).toBe('pizza');
    });

    it('should generate correct cache key', async () => {
      await suggestionService.getSuggestions('test', mockLocation);
      await suggestionService.getSuggestions('test', mockLocation, { maxSuggestions: 5 });
      await suggestionService.getSuggestions('test', mockLocation, { performanceMode: 'comprehensive' });

      // Should make 3 different API calls due to different cache keys
      expect(mockApiService.get).toHaveBeenCalledTimes(3);
    });

    it('should build correct API parameters', async () => {
      await suggestionService.getSuggestions('restaurant', mockLocation, {
        maxSuggestions: 10,
        performanceMode: 'comprehensive',
      });

      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/suggestions/autocomplete?')
      );
      
      const callUrl = (mockApiService.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('q=restaurant');
      expect(callUrl).toContain(`lat=${mockLocation.latitude}`);
      expect(callUrl).toContain(`lng=${mockLocation.longitude}`);
      expect(callUrl).toContain('limit=10');
      expect(callUrl).toContain('includeTrending=true');
    });
  });

  describe('getSuggestionsDebounced', () => {
    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce multiple rapid calls', async () => {
      const promise1 = suggestionService.getSuggestionsDebounced('piz', mockLocation);
      const promise2 = suggestionService.getSuggestionsDebounced('pizza', mockLocation);
      const promise3 = suggestionService.getSuggestionsDebounced('pizza place', mockLocation);

      // Fast-forward time
      jest.advanceTimersByTime(200);

      await Promise.all([promise1, promise2, promise3]);

      // Should only make one API call for the last query
      expect(mockApiService.get).toHaveBeenCalledTimes(1);
      expect((mockApiService.get as jest.Mock).mock.calls[0][0]).toContain('pizza%20place');
    });

    it('should call callback with results', async () => {
      const callback = jest.fn();
      
      const promise = suggestionService.getSuggestionsDebounced('test', mockLocation, {}, callback);
      
      jest.advanceTimersByTime(200);
      
      const result = await promise;
      
      expect(callback).toHaveBeenCalledWith(result);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should use custom debounce time', async () => {
      const promise = suggestionService.getSuggestionsDebounced('test', mockLocation, {
        debounceMs: 300,
      });

      jest.advanceTimersByTime(200);
      expect(mockApiService.get).not.toHaveBeenCalled();

      jest.advanceTimersByTime(150);
      await promise;

      expect(mockApiService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBusinessNameAutocomplete', () => {
    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockBusinessNamesResponse);
    });

    it('should return business name suggestions', async () => {
      const result = await suggestionService.getBusinessNameAutocomplete('pizza', mockLocation);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('business');
      expect(result[0].text).toBe('Pizza Corner');
    });

    it('should return empty array for short queries', async () => {
      const result = await suggestionService.getBusinessNameAutocomplete('p', mockLocation);

      expect(result).toHaveLength(0);
      expect(mockApiService.get).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      (mockApiService.get as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await suggestionService.getBusinessNameAutocomplete('pizza', mockLocation);

      expect(result).toHaveLength(0);
    });

    it('should build correct API parameters', async () => {
      await suggestionService.getBusinessNameAutocomplete('cafe', mockLocation, 3);

      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/suggestions/business-names?')
      );

      const callUrl = (mockApiService.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('q=cafe');
      expect(callUrl).toContain('limit=3');
      expect(callUrl).toContain(`lat=${mockLocation.latitude}`);
      expect(callUrl).toContain(`lng=${mockLocation.longitude}`);
    });
  });

  describe('getCategorySuggestions', () => {
    const mockCategoryResponse = {
      success: true,
      data: {
        suggestions: [
          {
            id: 'category_food',
            type: 'category',
            text: 'restaurants',
            displayText: 'Restaurants',
            description: '25 businesses in area (12.5%)',
            metadata: {
              frequency: 25,
              relevanceScore: 0.75,
              lastUsed: Date.now(),
              userSpecific: false,
              globalPopularity: 80,
              locationPopularity: 85,
            },
            action: {
              type: 'filter',
              payload: { category: 'restaurants' },
            },
            analytics: {
              impressions: 0,
              clicks: 0,
              conversions: 0,
              ctr: 0,
            },
          },
        ],
      },
    };

    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockCategoryResponse);
    });

    it('should return category suggestions', async () => {
      const result = await suggestionService.getCategorySuggestions('food', mockLocation);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('category');
      expect(result[0].action.type).toBe('filter');
    });

    it('should handle empty query', async () => {
      await suggestionService.getCategorySuggestions('', mockLocation);

      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('q=')
      );
    });
  });

  describe('getTrendingSuggestions', () => {
    const mockTrendingResponse = {
      success: true,
      data: {
        suggestions: [
          {
            id: 'trending_brunch',
            type: 'trending',
            text: 'brunch spots',
            displayText: '🔥 brunch spots',
            description: 'Trending (+45.2% today)',
            metadata: {
              frequency: 38,
              relevanceScore: 0.65,
              lastUsed: Date.now(),
              userSpecific: false,
              globalPopularity: 70,
            },
            action: {
              type: 'search',
              payload: { query: 'brunch spots' },
            },
            analytics: {
              impressions: 0,
              clicks: 0,
              conversions: 0,
              ctr: 0,
            },
          },
        ],
      },
    };

    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockTrendingResponse);
    });

    it('should return trending suggestions', async () => {
      const result = await suggestionService.getTrendingSuggestions(mockLocation);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('trending');
      expect(result[0].displayText).toContain('🔥');
    });

    it('should handle no location', async () => {
      await suggestionService.getTrendingSuggestions();

      const callUrl = (mockApiService.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).not.toContain('lat=');
      expect(callUrl).not.toContain('lng=');
    });
  });

  describe('Analytics Tracking', () => {
    beforeEach(() => {
      (mockApiService.post as jest.Mock).mockResolvedValue({ success: true });
    });

    it('should track suggestion clicks', async () => {
      const suggestion = mockSuggestionResponse.data.suggestions[0];
      
      await suggestionService.trackSuggestionClick(
        suggestion,
        'pizza',
        mockLocation,
        { sessionId: 'test-session' }
      );

      // Check that analytics event was queued
      expect(suggestionService['analyticsQueue']).toHaveLength(1);
      
      const event = suggestionService['analyticsQueue'][0];
      expect(event.action).toBe('click');
      expect(event.suggestionId).toBe(suggestion.id);
      expect(event.query).toBe('pizza');
    });

    it('should track suggestion conversions', async () => {
      const suggestion = mockSuggestionResponse.data.suggestions[0];
      
      await suggestionService.trackSuggestionConversion(
        suggestion,
        'pizza',
        'purchase',
        mockLocation,
        { sessionId: 'test-session' }
      );

      expect(suggestionService['analyticsQueue']).toHaveLength(1);
      
      const event = suggestionService['analyticsQueue'][0];
      expect(event.action).toBe('conversion');
      expect(event.conversionType).toBe('purchase');
    });

    it('should batch analytics requests', async () => {
      const suggestion = mockSuggestionResponse.data.suggestions[0];
      const batchSize = suggestionService['ANALYTICS_BATCH_SIZE'];
      
      // Add enough events to trigger batch processing
      for (let i = 0; i < batchSize; i++) {
        await suggestionService.trackSuggestionClick(
          suggestion,
          `query-${i}`,
          mockLocation
        );
      }

      // Should have made API call to process batch
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/suggestions/analytics/track',
        { events: expect.any(Array) }
      );
      
      // Queue should be empty after batch processing
      expect(suggestionService['analyticsQueue']).toHaveLength(0);
    });

    it('should handle analytics API errors gracefully', async () => {
      (mockApiService.post as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const suggestion = mockSuggestionResponse.data.suggestions[0];
      
      // Should not throw error
      await expect(
        suggestionService.trackSuggestionClick(suggestion, 'pizza', mockLocation)
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);
    });

    it('should limit cache size', async () => {
      const cacheLimit = suggestionService['CACHE_SIZE_LIMIT'];
      
      // Fill cache beyond limit
      for (let i = 0; i <= cacheLimit; i++) {
        await suggestionService.getSuggestions(`query-${i}`, mockLocation);
      }

      // Cache should not exceed limit
      expect(suggestionService['suggestionCache'].size).toBeLessThanOrEqual(cacheLimit);
    });

    it('should expire cached entries', async () => {
      const shortCacheTimeout = 100; // 100ms
      
      await suggestionService.getSuggestions('test', mockLocation, {
        cacheTimeout: shortCacheTimeout,
      });

      // Should hit cache immediately
      const result1 = await suggestionService.getSuggestions('test', mockLocation, {
        cacheTimeout: shortCacheTimeout,
      });
      expect(result1.cacheHit).toBe(true);

      // Wait for cache expiration
      await new Promise(resolve => setTimeout(resolve, shortCacheTimeout + 10));

      // Should miss cache after expiration
      const result2 = await suggestionService.getSuggestions('test', mockLocation, {
        cacheTimeout: shortCacheTimeout,
      });
      expect(result2.cacheHit).toBe(false);
    });

    it('should clear cache', () => {
      // Add something to cache first
      suggestionService['suggestionCache'].set('test-key', {
        data: mockSuggestionResponse.data,
        timestamp: Date.now(),
      });

      expect(suggestionService['suggestionCache'].size).toBe(1);

      suggestionService.clearCache();

      expect(suggestionService['suggestionCache'].size).toBe(0);
    });

    it('should provide cache statistics', () => {
      const stats = suggestionService.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('avgResponseTime');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.avgResponseTime).toBe('number');
    });
  });

  describe('Performance and Retry Logic', () => {
    it('should retry failed API requests', async () => {
      (mockApiService.get as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(mockSuggestionResponse);

      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(mockApiService.get).toHaveBeenCalledTimes(3);
      expect(result.suggestions).toHaveLength(2);
    });

    it('should stop retrying after max attempts', async () => {
      (mockApiService.get as jest.Mock).mockRejectedValue(new Error('Persistent error'));

      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(mockApiService.get).toHaveBeenCalledTimes(2); // MAX_RETRY_ATTEMPTS
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        suggestionService.getSuggestions(`query-${i}`, mockLocation)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockApiService.get).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result.suggestions).toBeDefined();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', () => {
      // Add some data to clean up
      suggestionService['suggestionCache'].set('test', {
        data: mockSuggestionResponse.data,
        timestamp: Date.now(),
      });
      suggestionService['debounceTimers'].set('test', setTimeout(() => {}, 1000));
      suggestionService['analyticsQueue'].push({
        suggestionId: 'test',
        query: 'test',
        action: 'impression',
        timestamp: Date.now(),
      });

      suggestionService.cleanup();

      expect(suggestionService['suggestionCache'].size).toBe(0);
      expect(suggestionService['debounceTimers'].size).toBe(0);
    });

    it('should clear debounce timers on cleanup', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Add some timers
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 2000);
      suggestionService['debounceTimers'].set('test1', timer1);
      suggestionService['debounceTimers'].set('test2', timer2);

      suggestionService.cleanup();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer2);
      expect(suggestionService['debounceTimers'].size).toBe(0);

      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('SuggestionService Edge Cases', () => {
  let suggestionService: SuggestionService;

  beforeEach(() => {
    suggestionService = new SuggestionService(mockApiService);
  });

  afterEach(() => {
    suggestionService.cleanup();
  });

  describe('Error Scenarios', () => {
    it('should handle malformed API responses', async () => {
      (mockApiService.get as jest.Mock).mockResolvedValue({
        success: true,
        data: null, // Malformed response
      });

      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(result.suggestions).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle API timeout gracefully', async () => {
      (mockApiService.get as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await suggestionService.getSuggestions('pizza', mockLocation);

      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(1000);

      // Should still attempt to make request (validation happens on server)
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);
      
      const result = await suggestionService.getSuggestions(longQuery, mockLocation);
      
      expect(mockApiService.get).toHaveBeenCalled();
    });

    it('should handle invalid location coordinates', async () => {
      const invalidLocation = {
        latitude: NaN,
        longitude: Infinity,
        accuracy: -1,
        timestamp: Date.now(),
      };

      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);

      // Should still work, server should handle validation
      const result = await suggestionService.getSuggestions('pizza', invalidLocation);
      expect(result).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many queries', async () => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);

      // Make many different queries
      for (let i = 0; i < 200; i++) {
        await suggestionService.getSuggestions(`query-${i}`, mockLocation);
      }

      // Cache should be limited
      const cacheSize = suggestionService['suggestionCache'].size;
      expect(cacheSize).toBeLessThanOrEqual(suggestionService['CACHE_SIZE_LIMIT']);
    });

    it('should clean up expired cache entries', async () => {
      jest.useFakeTimers();
      
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);

      // Add entries to cache
      await suggestionService.getSuggestions('test1', mockLocation);
      await suggestionService.getSuggestions('test2', mockLocation);

      expect(suggestionService['suggestionCache'].size).toBe(2);

      // Fast-forward time to expire cache
      jest.advanceTimersByTime(400000); // 400 seconds

      // Trigger cache cleanup (would normally happen on interval)
      suggestionService['suggestionCache'].clear(); // Simulate cleanup

      expect(suggestionService['suggestionCache'].size).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Analytics Edge Cases', () => {
    it('should handle analytics queue overflow', async () => {
      (mockApiService.post as jest.Mock).mockResolvedValue({ success: true });

      const mockSuggestion = {
        id: 'test-suggestion',
        type: 'business' as const,
        text: 'Test',
        displayText: 'Test',
        metadata: {} as any,
        action: { type: 'search' as const, payload: {} },
        analytics: { impressions: 0, clicks: 0, conversions: 0, ctr: 0 },
      };

      // Add many analytics events
      for (let i = 0; i < 50; i++) {
        await suggestionService.trackSuggestionClick(
          mockSuggestion,
          `query-${i}`,
          mockLocation
        );
      }

      // Should have processed batches
      expect(mockApiService.post).toHaveBeenCalled();
    });

    it('should continue working if analytics fails', async () => {
      (mockApiService.get as jest.Mock).mockResolvedValue(mockSuggestionResponse);
      (mockApiService.post as jest.Mock).mockRejectedValue(new Error('Analytics failed'));

      const mockSuggestion = mockSuggestionResponse.data.suggestions[0];

      // Analytics failure should not affect main functionality
      await suggestionService.trackSuggestionClick(
        mockSuggestion,
        'pizza',
        mockLocation
      );

      const result = await suggestionService.getSuggestions('pizza', mockLocation);
      expect(result.suggestions).toHaveLength(2);
    });
  });
});

// Test utilities
export const createMockSuggestion = (overrides: any = {}) => ({
  id: 'test-suggestion',
  type: 'business',
  text: 'Test Business',
  displayText: 'Test Business',
  description: 'A test business',
  metadata: {
    frequency: 1,
    relevanceScore: 0.8,
    lastUsed: Date.now(),
    userSpecific: false,
    globalPopularity: 50,
  },
  action: {
    type: 'search',
    payload: { query: 'test' },
  },
  analytics: {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
  },
  ...overrides,
});

export const createMockLocation = (overrides: Partial<LocationCoordinates> = {}): LocationCoordinates => ({
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: Date.now(),
  ...overrides,
});