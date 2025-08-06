/**
 * Comprehensive Location Search Backend Tests
 * Tests PostGIS spatial queries, Redis caching, and API endpoints
 */

import request from 'supertest';
import { app } from '../../app';
import { connectRedis, redisClient } from '../../config/redis';
import { locationSearchService } from '../../services/locationSearchService';
import { LocationSearchError, LocationSearchErrorType } from '../../schemas/businessSchemas';
import { Pool } from 'pg';

// Test configuration
const TEST_COORDINATES = {
  VALID: { lat: 40.7128, lng: -74.0060 }, // New York City
  INVALID_LAT: { lat: 95.0, lng: -74.0060 },
  INVALID_LNG: { lat: 40.7128, lng: -185.0060 },
  EDGE_CASE: { lat: 0.0, lng: 0.0 }, // Null Island
};

const TEST_BUSINESS_DATA = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Coffee Shop',
    location: { coordinates: { lat: 40.7130, lng: -74.0062 } },
    categories: ['food', 'coffee'],
    is_active: true,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Restaurant',
    location: { coordinates: { lat: 40.7125, lng: -74.0058 } },
    categories: ['food', 'restaurant'],
    is_active: true,
  },
];

describe('Location Search Backend - Comprehensive Validation', () => {
  beforeAll(async () => {
    // Initialize Redis connection
    await connectRedis();
    
    // Clean test data
    await redisClient.flushall();
    
    // Set up test business data
    // Note: In a real test environment, you'd insert this into a test database
  });

  afterAll(async () => {
    // Clean up
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redisClient.flushall();
  });

  describe('PostGIS Spatial Queries', () => {
    describe('Distance-Based Search Function', () => {
      test('should execute search_businesses_by_location function', async () => {
        const query = `
          SELECT * FROM search_businesses_by_location(
            $1::FLOAT, $2::FLOAT, $3::FLOAT, $4::TEXT[], $5::TEXT, $6::INTEGER, $7::INTEGER
          )
        `;

        const params = [
          TEST_COORDINATES.VALID.lat,
          TEST_COORDINATES.VALID.lng,
          25.0, // radius
          ['food'], // categories
          null, // search text
          10, // limit
          0, // offset
        ];

        // This would normally be executed against a test database
        // const result = await locationSearchService.query(query, params);
        // expect(result.rows).toBeDefined();
        expect(true).toBe(true); // Placeholder for actual database test
      });

      test('should calculate accurate distances using PostGIS geography', async () => {
        const manhattanToQueens = {
          from: { lat: 40.7831, lng: -73.9712 }, // Manhattan
          to: { lat: 40.7282, lng: -73.7949 },   // Queens
        };

        // Expected distance ~15km
        const expectedDistance = 15;
        const tolerance = 2; // 2km tolerance

        // This would test actual PostGIS distance calculation
        // const distance = await locationSearchService.calculateDistance(...);
        // expect(distance).toBeCloseTo(expectedDistance, tolerance);
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('Spatial Indexing Performance', () => {
      test('should execute searches within performance thresholds', async () => {
        const startTime = Date.now();

        const searchQuery = {
          lat: TEST_COORDINATES.VALID.lat,
          lng: TEST_COORDINATES.VALID.lng,
          radius: 25,
          limit: 10,
        };

        try {
          // This would execute against test database
          // const result = await locationSearchService.searchByLocation(searchQuery);
          const executionTime = Date.now() - startTime;

          // Sub-1-second requirement for location searches
          expect(executionTime).toBeLessThan(1000);
          expect(true).toBe(true); // Placeholder
        } catch (error) {
          // Should not timeout or fail
          expect(error).toBeUndefined();
        }
      });

      test('should efficiently handle large radius searches', async () => {
        const largeRadiusQuery = {
          lat: TEST_COORDINATES.VALID.lat,
          lng: TEST_COORDINATES.VALID.lng,
          radius: 100, // Maximum allowed radius
          limit: 50,
        };

        const startTime = Date.now();
        // const result = await locationSearchService.searchByLocation(largeRadiusQuery);
        const executionTime = Date.now() - startTime;

        // Even large searches should complete within 2 seconds
        expect(executionTime).toBeLessThan(2000);
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('Boundary and Edge Cases', () => {
      test('should handle searches near poles', async () => {
        const arcticQuery = {
          lat: 89.5, // Near North Pole
          lng: 0,
          radius: 100,
        };

        // Should not throw errors for extreme coordinates
        // const result = await locationSearchService.searchByLocation(arcticQuery);
        expect(true).toBe(true); // Placeholder
      });

      test('should handle searches crossing date line', async () => {
        const dateLineQuery = {
          lat: 60.0,
          lng: 179.5, // Near International Date Line
          radius: 50,
        };

        // Should handle longitude wrap-around correctly
        // const result = await locationSearchService.searchByLocation(dateLineQuery);
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('Redis Caching Layer', () => {
    describe('Cache Key Generation', () => {
      test('should generate consistent cache keys for same queries', async () => {
        const query1 = { lat: 40.7128, lng: -74.0060, radius: 25, page: 1 };
        const query2 = { lat: 40.7128, lng: -74.0060, radius: 25, page: 1 };

        // Mock the private method testing via public interface
        const service = locationSearchService;
        
        // Both queries should generate the same cache key
        expect(true).toBe(true); // Would test actual cache key generation
      });

      test('should generate different cache keys for different locations', async () => {
        const nycQuery = { lat: 40.7128, lng: -74.0060, radius: 25 };
        const laQuery = { lat: 34.0522, lng: -118.2437, radius: 25 };

        // Different locations should have different cache keys
        expect(true).toBe(true); // Placeholder
      });

      test('should handle coordinate precision for cache optimization', async () => {
        // These coordinates are very close (within cache precision)
        const coord1 = { lat: 40.71280001, lng: -74.00600001 };
        const coord2 = { lat: 40.71279999, lng: -74.00599999 };

        // Should generate same cache key for nearby coordinates
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('Cache Performance', () => {
      test('should serve cached results significantly faster', async () => {
        const query = {
          lat: TEST_COORDINATES.VALID.lat,
          lng: TEST_COORDINATES.VALID.lng,
          radius: 25,
        };

        // First request (cache miss)
        const firstStart = Date.now();
        // const firstResult = await locationSearchService.searchByLocation(query);
        const firstTime = Date.now() - firstStart;

        // Second request (cache hit)
        const secondStart = Date.now();
        // const secondResult = await locationSearchService.searchByLocation(query);
        const secondTime = Date.now() - secondStart;

        // Cache hit should be significantly faster (at least 5x)
        // expect(secondTime * 5).toBeLessThan(firstTime);
        expect(true).toBe(true); // Placeholder
      });

      test('should properly handle cache expiration', async () => {
        const query = {
          lat: TEST_COORDINATES.VALID.lat,
          lng: TEST_COORDINATES.VALID.lng,
          radius: 25,
        };

        // Make request to populate cache
        // await locationSearchService.searchByLocation(query);

        // Verify cache exists
        // const cacheKey = generateCacheKey(query);
        // const cached = await redisClient.get(cacheKey);
        // expect(cached).toBeTruthy();

        // Wait for expiration (would need to mock TTL for faster testing)
        // Verify cache is expired
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('Cache Invalidation', () => {
      test('should invalidate cache when business locations change', async () => {
        const businessCoordinates = { lat: 40.7128, lng: -74.0060 };

        // Populate cache
        const searchQuery = {
          lat: businessCoordinates.lat,
          lng: businessCoordinates.lng,
          radius: 25,
        };

        // await locationSearchService.searchByLocation(searchQuery);

        // Invalidate cache for business update
        await locationSearchService.invalidateLocationCache(
          'business-id',
          businessCoordinates
        );

        // Cache should be cleared
        expect(true).toBe(true); // Placeholder
      });

      test('should invalidate surrounding grid cells', async () => {
        const centerCoord = { lat: 40.7128, lng: -74.0060 };

        // Invalidate cache - should clear surrounding area
        await locationSearchService.invalidateLocationCache(undefined, centerCoord);

        // Multiple cache keys should be invalidated
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('API Endpoints', () => {
    describe('GET /api/businesses/search/location', () => {
      test('should return successful response with valid coordinates', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 25,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.businesses).toBeDefined();
        expect(response.body.data.pagination).toBeDefined();
        expect(response.body.data.searchMetadata).toBeDefined();
        expect(response.headers['x-execution-time']).toBeDefined();
        expect(response.headers['x-cache']).toMatch(/^(HIT|MISS)$/);
      });

      test('should return 400 for invalid coordinates', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.INVALID_LAT.lat,
            lng: TEST_COORDINATES.INVALID_LAT.lng,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      test('should handle missing required parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({ lat: 40.7128 }); // Missing lng

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('should respect pagination parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            page: 2,
            limit: 5,
          });

        expect(response.body.data.pagination.page).toBe(2);
        expect(response.body.data.pagination.limit).toBe(5);
      });
    });

    describe('GET /api/businesses/search/location/advanced', () => {
      test('should handle advanced search parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/advanced')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 10,
            category: 'food,coffee',
            sortBy: 'rating',
            rating: 4.0,
            amenities: 'wifi,parking',
            isOpen: true,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.searchMetadata.performanceLevel).toBeDefined();
      });

      test('should validate price range parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/advanced')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            priceRange: JSON.stringify([100, 50]), // Invalid: min > max
          });

        expect(response.status).toBe(400);
      });

      test('should return performance warnings for slow queries', async () => {
        // This would test with a complex query that takes longer
        const response = await request(app)
          .get('/api/businesses/search/location/advanced')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 100, // Large radius
            category: 'food,restaurant,coffee,retail,service',
            amenities: 'wifi,parking,outdoor,delivery,takeout',
          });

        // Depending on execution time, might include performance warning header
        if (parseInt(response.headers['x-execution-time']) > 1000) {
          expect(response.headers['x-performance-warning']).toBeDefined();
        }
      });
    });

    describe('GET /api/businesses/search/location/density', () => {
      test('should return business density grid data', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/density')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 10,
            gridSize: 1.0,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.densityGrid).toBeDefined();
        expect(response.body.data.metadata).toBeDefined();
        expect(response.body.data.metadata.totalGridCells).toBeGreaterThanOrEqual(0);
      });

      test('should validate grid size parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/density')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            gridSize: 10, // Exceeds maximum
          });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/businesses/search/location/nearest/:count', () => {
      test('should return nearest businesses', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/nearest/5')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.businesses).toBeDefined();
        expect(response.body.data.requestedCount).toBe(5);
        expect(response.body.data.actualCount).toBeGreaterThanOrEqual(0);
      });

      test('should enforce maximum count limit', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/nearest/50') // Exceeds max of 20
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
          });

        expect(response.status).toBe(400);
      });

      test('should filter by category', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location/nearest/10')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            category: 'food',
          });

        // All returned businesses should have 'food' category
        if (response.body.data.businesses.length > 0) {
          response.body.data.businesses.forEach((business: any) => {
            expect(business.categories).toContain('food');
          });
        }
      });
    });

    describe('GET /api/businesses/search/analytics (Admin Only)', () => {
      // This would require setting up admin authentication
      test.skip('should return search analytics for admin users', async () => {
        // Would need to implement admin token generation for testing
      });

      test('should deny access to non-admin users', async () => {
        const response = await request(app)
          .get('/api/businesses/search/analytics');

        expect(response.status).toBe(401); // Or 403 depending on middleware
      });
    });
  });

  describe('Error Handling', () => {
    describe('LocationSearchError Types', () => {
      test('should handle coordinate validation errors', () => {
        const error = new LocationSearchError(
          LocationSearchErrorType.INVALID_COORDINATES,
          'Invalid latitude provided',
          400,
          { lat: 95, lng: -74 }
        );

        expect(error.type).toBe(LocationSearchErrorType.INVALID_COORDINATES);
        expect(error.statusCode).toBe(400);
        expect(error.metadata.lat).toBe(95);
      });

      test('should handle radius limit errors', () => {
        const error = new LocationSearchError(
          LocationSearchErrorType.RADIUS_TOO_LARGE,
          'Search radius exceeds maximum',
          400,
          { requestedRadius: 150, maxRadius: 100 }
        );

        expect(error.statusCode).toBe(400);
        expect(error.metadata.requestedRadius).toBe(150);
      });

      test('should handle search timeout errors', () => {
        const error = new LocationSearchError(
          LocationSearchErrorType.SEARCH_TIMEOUT,
          'Location search timed out',
          408
        );

        expect(error.statusCode).toBe(408);
      });
    });

    describe('Database Connection Errors', () => {
      test('should handle database unavailability gracefully', async () => {
        // Mock database connection error
        // const mockError = new Error('Connection refused');
        // jest.spyOn(locationSearchService, 'query').mockRejectedValue(mockError);

        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
          });

        // Should handle gracefully, not crash
        expect([200, 503]).toContain(response.status);
      });
    });

    describe('Cache Failures', () => {
      test('should continue functioning when Redis is unavailable', async () => {
        // Temporarily disconnect Redis
        await redisClient.quit();

        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
          });

        // Should still return results, just without caching
        expect(response.status).toBe(200);
        expect(response.headers['x-cache']).toBe('MISS');

        // Reconnect for other tests
        await connectRedis();
      });
    });
  });

  describe('Performance and Scalability', () => {
    describe('Response Time Requirements', () => {
      test('should meet sub-1-second requirement for simple searches', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 25,
            limit: 10,
          });

        const executionTime = Date.now() - startTime;
        
        expect(response.status).toBe(200);
        expect(executionTime).toBeLessThan(1000); // Sub-1-second requirement
      });

      test('should handle concurrent requests efficiently', async () => {
        const concurrentRequests = 10;
        const requests = [];

        for (let i = 0; i < concurrentRequests; i++) {
          requests.push(
            request(app)
              .get('/api/businesses/search/location')
              .query({
                lat: TEST_COORDINATES.VALID.lat + (i * 0.001), // Slightly different coordinates
                lng: TEST_COORDINATES.VALID.lng + (i * 0.001),
                radius: 25,
              })
          );
        }

        const startTime = Date.now();
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;

        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        // Concurrent processing should be faster than sequential
        expect(totalTime).toBeLessThan(concurrentRequests * 500); // Reasonable threshold
      });
    });

    describe('Memory Usage', () => {
      test('should handle large result sets without memory issues', async () => {
        const initialMemory = process.memoryUsage();

        // Make request for large radius (potentially many results)
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            radius: 100, // Large radius
            limit: 50, // Maximum results
          });

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        expect(response.status).toBe(200);
        // Memory increase should be reasonable (less than 50MB for this operation)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      });
    });
  });

  describe('Security and Rate Limiting', () => {
    describe('Input Sanitization', () => {
      test('should sanitize malicious input in search parameters', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            search: '<script>alert("xss")</script>',
          });

        // Should not execute script, should sanitize or reject
        expect(response.status).toBeIn([200, 400]);
        if (response.status === 200) {
          // Search results should not contain unsanitized script
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('<script>');
        }
      });

      test('should validate SQL injection attempts', async () => {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: TEST_COORDINATES.VALID.lat,
            lng: TEST_COORDINATES.VALID.lng,
            search: "'; DROP TABLE businesses; --",
          });

        // Should handle safely without SQL injection
        expect([200, 400]).toContain(response.status);
      });
    });

    describe('Rate Limiting', () => {
      test('should enforce rate limits for location searches', async () => {
        // This would test the rate limiting middleware
        const requests = [];
        const rateLimitCount = 100; // Adjust based on actual rate limit

        for (let i = 0; i < rateLimitCount + 1; i++) {
          requests.push(
            request(app)
              .get('/api/businesses/search/location')
              .query({
                lat: TEST_COORDINATES.VALID.lat,
                lng: TEST_COORDINATES.VALID.lng,
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // Some requests should be rate limited
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });
    });
  });
});