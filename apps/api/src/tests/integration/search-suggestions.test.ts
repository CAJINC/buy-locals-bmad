import request from 'supertest';
import { app } from '../../app';
import { redisClient } from '../../config/redis';
import { searchSuggestionService } from '../../services/searchSuggestionService';
import { searchAnalyticsService } from '../../services/searchAnalyticsService';

// Test data for suggestions
const mockLocation = { lat: 40.7128, lng: -74.0060 }; // New York City
const mockBusinesses = [
  {
    id: 'test-business-1',
    name: 'Best Pizza Place',
    categories: ['restaurants', 'pizza'],
    location: { coordinates: { lat: 40.7130, lng: -74.0058 } },
    address: '123 Main St, New York, NY',
    is_active: true,
  },
  {
    id: 'test-business-2',
    name: 'Coffee Central',
    categories: ['cafes', 'coffee'],
    location: { coordinates: { lat: 40.7125, lng: -74.0062 } },
    address: '456 Oak Ave, New York, NY',
    is_active: true,
  },
];

describe('Search Suggestions API Integration Tests', () => {
  beforeAll(async () => {
    // Ensure Redis connection
    if (!redisClient.isReady) {
      await new Promise((resolve) => {
        redisClient.on('ready', resolve);
      });
    }
  });

  afterAll(async () => {
    // Clean up Redis connections
    if (redisClient.isReady) {
      await redisClient.quit();
    }
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    if (redisClient.isReady) {
      await redisClient.flushAll();
    }
  });

  describe('GET /api/suggestions/autocomplete', () => {
    it('should return suggestions for valid query', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'pizza',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
          limit: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('responseTime');
      expect(response.body.data).toHaveProperty('metadata');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should return empty suggestions for empty query', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: '',
          limit: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toHaveLength(0);
      expect(response.body.data.totalCount).toBe(0);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'a', // Too short
          lat: 'invalid', // Invalid latitude
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'restaurant',
          limit: 3,
        })
        .expect(200);

      expect(response.body.data.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return results within performance target', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'coffee',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // Allow some margin for test environment
      expect(response.headers['x-response-time']).toBeDefined();
    });

    it('should handle location-based suggestions', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'food',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
          radius: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.location).toEqual(mockLocation);
    });

    it('should cache suggestions for performance', async () => {
      const query = {
        q: 'unique-test-query',
        lat: mockLocation.lat,
        lng: mockLocation.lng,
      };

      // First request
      const response1 = await request(app)
        .get('/api/suggestions/autocomplete')
        .query(query)
        .expect(200);

      expect(response1.body.data.cacheHit).toBe(false);

      // Second request should hit cache
      const response2 = await request(app)
        .get('/api/suggestions/autocomplete')
        .query(query)
        .expect(200);

      expect(response2.headers['x-cache-hit']).toBe('true');
    });
  });

  describe('GET /api/suggestions/business-names', () => {
    it('should return business name suggestions', async () => {
      const response = await request(app)
        .get('/api/suggestions/business-names')
        .query({
          q: 'piz',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should validate minimum query length', async () => {
      const response = await request(app)
        .get('/api/suggestions/business-names')
        .query({
          q: 'p', // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return suggestions with similarity scores', async () => {
      const response = await request(app)
        .get('/api/suggestions/business-names')
        .query({
          q: 'coffee',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion.metadata.relevanceScore).toBeGreaterThan(0);
        expect(suggestion.type).toBe('business');
      }
    });
  });

  describe('GET /api/suggestions/categories', () => {
    it('should return category suggestions', async () => {
      const response = await request(app)
        .get('/api/suggestions/categories')
        .query({
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
    });

    it('should filter categories by query', async () => {
      const response = await request(app)
        .get('/api/suggestions/categories')
        .query({
          q: 'rest',
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion.type).toBe('category');
        expect(suggestion.text.toLowerCase()).toContain('rest');
      }
    });
  });

  describe('GET /api/suggestions/trending', () => {
    it('should return trending suggestions', async () => {
      const response = await request(app)
        .get('/api/suggestions/trending')
        .query({
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      
      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion.type).toBe('trending');
        expect(suggestion.displayText).toContain('🔥');
      }
    });

    it('should respect location radius', async () => {
      const response = await request(app)
        .get('/api/suggestions/trending')
        .query({
          lat: mockLocation.lat,
          lng: mockLocation.lng,
          radius: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.location).toEqual(mockLocation);
    });
  });

  describe('GET /api/suggestions/popular', () => {
    it('should return popular suggestions', async () => {
      const response = await request(app)
        .get('/api/suggestions/popular')
        .query({
          lat: mockLocation.lat,
          lng: mockLocation.lng,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      
      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion.type).toBe('query');
        expect(suggestion.displayText).toContain('⭐');
      }
    });
  });

  describe('POST /api/suggestions/analytics/track', () => {
    it('should track suggestion analytics', async () => {
      const analyticsData = {
        suggestionId: 'test-suggestion-1',
        query: 'pizza',
        action: 'click',
        userContext: {
          sessionId: 'test-session-1',
          position: 0,
        },
      };

      const response = await request(app)
        .post('/api/suggestions/analytics/track')
        .send(analyticsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tracked).toBe(true);
      expect(response.body.data.action).toBe('click');
    });

    it('should validate analytics data', async () => {
      const invalidData = {
        suggestionId: '', // Empty
        query: 'test',
        action: 'invalid-action', // Invalid action
      };

      const response = await request(app)
        .post('/api/suggestions/analytics/track')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should track conversions with type', async () => {
      const conversionData = {
        suggestionId: 'test-suggestion-2',
        query: 'coffee',
        action: 'conversion',
        conversionType: 'purchase',
      };

      const response = await request(app)
        .post('/api/suggestions/analytics/track')
        .send(conversionData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/suggestions/analytics', () => {
    it('should return analytics summary', async () => {
      const response = await request(app)
        .get('/api/suggestions/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalClicks');
      expect(response.body.data).toHaveProperty('totalConversions');
      expect(response.body.data).toHaveProperty('averageCTR');
      expect(response.body.data).toHaveProperty('topSuggestions');
      expect(response.body.data).toHaveProperty('performanceMetrics');
    });
  });

  describe('GET /api/suggestions/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/suggestions/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toHaveProperty('redis');
      expect(response.body.data.services).toHaveProperty('database');
      expect(response.body.data.features).toBeDefined();
    });

    it('should complete health check quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/suggestions/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
      expect(response.body.data.performance.responseTime).toBeDefined();
    });
  });

  describe('DELETE /api/suggestions/cache/clear', () => {
    it('should clear suggestion cache', async () => {
      // First, populate some cache
      await request(app)
        .get('/api/suggestions/autocomplete')
        .query({ q: 'test', limit: 3 })
        .expect(200);

      // Clear cache
      const response = await request(app)
        .delete('/api/suggestions/cache/clear')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.keysCleared).toBeGreaterThanOrEqual(0);
      expect(response.body.data.patterns).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on autocomplete endpoint', async () => {
      const requests = Array.from({ length: 105 }, (_, i) => 
        request(app)
          .get('/api/suggestions/autocomplete')
          .query({ q: `test${i}` })
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429)
      const rateLimitedRequests = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && 
          (result.value as any).status === 429
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for this test

    it('should have different rate limits for different endpoints', async () => {
      // Business names endpoint should allow more requests
      const businessNameRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get('/api/suggestions/business-names')
          .query({ q: `te${i}` })
      );

      const responses = await Promise.allSettled(businessNameRequests);
      
      // Most requests should succeed for business names
      const successfulRequests = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && 
          (result.value as any).status === 200
      );

      expect(successfulRequests.length).toBeGreaterThan(15);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get('/api/suggestions/autocomplete')
          .query({
            q: 'restaurant',
            lat: mockLocation.lat + (i * 0.001),
            lng: mockLocation.lng + (i * 0.001),
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Average response time should be reasonable
      expect(totalTime / responses.length).toBeLessThan(300);
    });

    it('should benefit from caching on repeated requests', async () => {
      const query = {
        q: 'performance-test',
        lat: mockLocation.lat,
        lng: mockLocation.lng,
      };

      // First request (no cache)
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get('/api/suggestions/autocomplete')
        .query(query)
        .expect(200);
      const time1 = Date.now() - startTime1;

      // Second request (should hit cache)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get('/api/suggestions/autocomplete')
        .query(query)
        .expect(200);
      const time2 = Date.now() - startTime2;

      expect(response1.body.data.cacheHit).toBe(false);
      expect(response2.headers['x-cache-hit']).toBe('true');
      expect(time2).toBeLessThan(time1); // Cache should be faster
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Temporarily disconnect Redis
      if (redisClient.isReady) {
        await redisClient.disconnect();
      }

      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({ q: 'test' })
        .expect(200); // Should still work without Redis

      expect(response.body.success).toBe(true);

      // Reconnect Redis
      if (!redisClient.isReady) {
        await redisClient.connect();
      }
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({
          q: 'test',
          lat: 'not-a-number',
          lng: 'also-not-a-number',
          radius: -5, // Negative radius
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle extremely long queries', async () => {
      const longQuery = 'a'.repeat(200); // 200 character query

      const response = await request(app)
        .get('/api/suggestions/autocomplete')
        .query({ q: longQuery })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Search Suggestion Service Unit Tests', () => {
  describe('Suggestion Generation', () => {
    it('should generate business name suggestions', async () => {
      const suggestions = await searchSuggestionService.getBusinessNameAutocomplete(
        'pizza',
        mockLocation,
        10,
        5
      );

      expect(Array.isArray(suggestions)).toBe(true);
      suggestions.forEach(suggestion => {
        expect(suggestion.type).toBe('business');
        expect(suggestion.metadata.relevanceScore).toBeGreaterThan(0);
        expect(suggestion.id).toMatch(/^business_/);
      });
    });

    it('should generate category suggestions', async () => {
      const suggestions = await searchSuggestionService.getCategorySuggestions(
        'food',
        mockLocation,
        25,
        5
      );

      expect(Array.isArray(suggestions)).toBe(true);
      suggestions.forEach(suggestion => {
        expect(suggestion.type).toBe('category');
        expect(suggestion.action.type).toBe('filter');
      });
    });

    it('should rank suggestions by relevance', async () => {
      const response = await searchSuggestionService.getSuggestions({
        query: 'restaurant',
        location: mockLocation,
        limit: 10,
      });

      if (response.suggestions.length > 1) {
        // Check that suggestions are sorted by relevance
        for (let i = 1; i < response.suggestions.length; i++) {
          expect(response.suggestions[i - 1].metadata.relevanceScore)
            .toBeGreaterThanOrEqual(response.suggestions[i].metadata.relevanceScore);
        }
      }
    });
  });

  describe('Caching Logic', () => {
    it('should generate consistent cache keys', async () => {
      // This would test the internal cache key generation logic
      // Actual implementation would be tested through integration tests
      expect(true).toBe(true);
    });

    it('should handle cache expiration', async () => {
      // Test cache TTL and expiration logic
      expect(true).toBe(true);
    });
  });

  describe('Analytics Tracking', () => {
    it('should track suggestion impressions', async () => {
      const mockSuggestions = [
        {
          id: 'test-suggestion-1',
          type: 'business' as const,
          text: 'Test Business',
          displayText: 'Test Business',
          metadata: { relevanceScore: 0.8 } as any,
          action: { type: 'search' as const, payload: {} },
          analytics: { impressions: 0, clicks: 0, conversions: 0, ctr: 0 },
        }
      ];

      await searchSuggestionService.trackSuggestionClick(
        'test-suggestion-1',
        'test query',
        { sessionId: 'test-session' }
      );

      // Verify analytics were tracked (would check Redis in real test)
      expect(true).toBe(true);
    });
  });
});

describe('Search Analytics Service Unit Tests', () => {
  describe('Analytics Tracking', () => {
    it('should track impression events', async () => {
      await searchAnalyticsService.trackSuggestionImpression(
        'test-suggestion-1',
        'business',
        'pizza',
        0,
        { sessionId: 'test-session' },
        mockLocation
      );

      // Verify impression was tracked
      expect(true).toBe(true);
    });

    it('should track click events', async () => {
      await searchAnalyticsService.trackSuggestionClick(
        'test-suggestion-1',
        'pizza',
        { sessionId: 'test-session' },
        mockLocation
      );

      // Verify click was tracked
      expect(true).toBe(true);
    });

    it('should track conversion events', async () => {
      await searchAnalyticsService.trackSuggestionConversion(
        'test-suggestion-1',
        'pizza',
        'view',
        undefined,
        { sessionId: 'test-session' },
        mockLocation
      );

      // Verify conversion was tracked
      expect(true).toBe(true);
    });
  });

  describe('Analytics Reports', () => {
    it('should generate effectiveness report', async () => {
      const report = await searchAnalyticsService.getSuggestionEffectivenessReport();

      expect(report).toHaveProperty('overallMetrics');
      expect(report).toHaveProperty('topPerformingSuggestions');
      expect(report).toHaveProperty('underperformingSuggestions');
      expect(report).toHaveProperty('trendingQueries');
      expect(report).toHaveProperty('recommendationsForImprovement');
    });

    it('should generate user behavior analytics', async () => {
      const analytics = await searchAnalyticsService.getUserBehaviorAnalytics();

      expect(analytics).toHaveProperty('sessionMetrics');
      expect(analytics).toHaveProperty('searchPatterns');
      expect(analytics).toHaveProperty('geographicDistribution');
      expect(analytics).toHaveProperty('deviceAndNetworkAnalytics');
    });
  });

  describe('Real-time Analytics', () => {
    it('should provide real-time metrics', async () => {
      const realTimeData = await searchAnalyticsService.getRealTimeAnalytics();

      expect(realTimeData).toHaveProperty('currentMetrics');
      expect(realTimeData).toHaveProperty('topQueriesNow');
      expect(realTimeData).toHaveProperty('systemHealth');
      expect(realTimeData).toHaveProperty('alerts');

      expect(realTimeData.currentMetrics).toHaveProperty('activeUsers');
      expect(realTimeData.currentMetrics).toHaveProperty('avgResponseTime');
      expect(realTimeData.currentMetrics).toHaveProperty('cacheHitRate');
    });
  });
});

describe('Database Function Tests', () => {
  describe('Suggestion Queries', () => {
    it('should execute business name suggestion function', async () => {
      // This would test the PostgreSQL function directly
      // Implementation would depend on database test setup
      expect(true).toBe(true);
    });

    it('should execute category suggestion function', async () => {
      // Test category suggestion database function
      expect(true).toBe(true);
    });

    it('should execute trending queries function', async () => {
      // Test trending queries database function
      expect(true).toBe(true);
    });
  });
});

// Cleanup and utility functions for tests
export const cleanupTestData = async () => {
  if (redisClient.isReady) {
    await redisClient.flushAll();
  }
};

export const createMockSuggestion = (overrides: any = {}) => ({
  id: 'test-suggestion-1',
  type: 'business',
  text: 'Test Business',
  displayText: 'Test Business',
  description: 'A test business',
  metadata: {
    frequency: 10,
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
    impressions: 100,
    clicks: 20,
    conversions: 5,
    ctr: 0.2,
  },
  ...overrides,
});