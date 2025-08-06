import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import request from 'supertest';
import { app } from '../../app.js';
import { locationSearchService } from '../../services/locationSearchService.js';
import { redisClient } from '../../config/redis.js';
import { config } from '../../config/database.js';

describe('Location Search Integration Tests', () => {
  let pool: Pool;
  let testBusinessIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({
      ...config,
      database: config.database + '_test',
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testBusinessIds.length > 0) {
      await pool.query(
        `DELETE FROM businesses WHERE id = ANY($1)`,
        [testBusinessIds]
      );
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    if (redisClient.isReady) {
      await redisClient.flushall();
    }
  });

  describe('End-to-End Location Search API', () => {
    beforeEach(async () => {
      // Insert comprehensive test data
      const testBusinesses = [
        {
          name: 'Downtown Restaurant',
          lat: 40.7128,
          lng: -74.0060,
          category: 'restaurant',
          description: 'Great downtown dining'
        },
        {
          name: 'Midtown Coffee Shop',
          lat: 40.7549,
          lng: -73.9840,
          category: 'coffee',
          description: 'Best coffee in midtown'
        },
        {
          name: 'Central Park Fitness',
          lat: 40.7829,
          lng: -73.9654,
          category: 'fitness',
          description: 'Fitness center near the park'
        },
        {
          name: 'Brooklyn Boutique',
          lat: 40.6782,
          lng: -73.9442,
          category: 'retail',
          description: 'Trendy brooklyn shopping'
        },
        {
          name: 'Queens Auto Service',
          lat: 40.7282,
          lng: -73.7949,
          category: 'automotive',
          description: 'Reliable auto repairs'
        }
      ];

      testBusinessIds = [];
      for (const business of testBusinesses) {
        const location = {
          address: '123 Test St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          coordinates: { lat: business.lat, lng: business.lng }
        };

        const result = await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, description, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, $6, true
          ) RETURNING id
        `, [
          business.name,
          business.description,
          JSON.stringify(location),
          [business.category],
          JSON.stringify({}),
          JSON.stringify({})
        ]);

        testBusinessIds.push(result.rows[0].id);
      }
    });

    test('should perform location search with sub-1s performance', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 25,
          limit: 10
        })
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Performance requirement: <1 second
      expect(executionTime).toBeLessThan(1000);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.businesses).toBeInstanceOf(Array);
      expect(response.body.data.searchMetadata.executionTimeMs).toBeLessThan(1000);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should return businesses sorted by distance', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128, // Downtown Manhattan
          lng: -74.0060,
          radius: 50,
          limit: 5
        })
        .expect(200);

      const businesses = response.body.data.businesses;
      expect(businesses.length).toBeGreaterThan(0);

      // Verify distances are in ascending order
      for (let i = 1; i < businesses.length; i++) {
        expect(businesses[i].distance).toBeGreaterThanOrEqual(businesses[i - 1].distance);
      }

      // Verify the closest business is Downtown Restaurant
      expect(businesses[0].name).toBe('Downtown Restaurant');
    });

    test('should filter by category correctly', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50,
          category: 'restaurant'
        })
        .expect(200);

      const businesses = response.body.data.businesses;
      expect(businesses.length).toBeGreaterThan(0);
      
      // All businesses should be restaurants
      businesses.forEach((business: any) => {
        expect(business.categories).toContain('restaurant');
      });
    });

    test('should handle text search within location', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7549,
          lng: -73.9840,
          radius: 50,
          search: 'coffee'
        })
        .expect(200);

      const businesses = response.body.data.businesses;
      expect(businesses.length).toBeGreaterThan(0);
      
      // Should find the coffee shop
      const coffeeShop = businesses.find((b: any) => b.name === 'Midtown Coffee Shop');
      expect(coffeeShop).toBeDefined();
    });

    test('should respect radius filtering', async () => {
      // Small radius should find fewer businesses
      const smallRadiusResponse = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 5 // 5km radius
        })
        .expect(200);

      // Large radius should find more businesses
      const largeRadiusResponse = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50 // 50km radius
        })
        .expect(200);

      expect(largeRadiusResponse.body.data.businesses.length)
        .toBeGreaterThanOrEqual(smallRadiusResponse.body.data.businesses.length);
    });

    test('should handle pagination correctly', async () => {
      // First page
      const page1Response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50,
          page: 1,
          limit: 2
        })
        .expect(200);

      // Second page
      const page2Response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50,
          page: 2,
          limit: 2
        })
        .expect(200);

      const page1Businesses = page1Response.body.data.businesses;
      const page2Businesses = page2Response.body.data.businesses;

      expect(page1Businesses.length).toBeLessThanOrEqual(2);
      expect(page2Businesses.length).toBeGreaterThanOrEqual(0);

      // Verify pagination metadata
      expect(page1Response.body.data.pagination.page).toBe(1);
      expect(page2Response.body.data.pagination.page).toBe(2);
    });
  });

  describe('Cache Performance and Behavior', () => {
    test('should cache search results and show cache hits', async () => {
      const searchQuery = {
        lat: 40.7128,
        lng: -74.0060,
        radius: 25,
        limit: 10
      };

      // First request (cache miss)
      const response1 = await request(app)
        .get('/api/businesses/search/location')
        .query(searchQuery)
        .expect(200);

      expect(response1.body.data.searchMetadata.cacheHit).toBe(false);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request (should be cache hit)
      const response2 = await request(app)
        .get('/api/businesses/search/location')
        .query(searchQuery)
        .expect(200);

      expect(response2.body.data.searchMetadata.cacheHit).toBe(true);
      expect(response2.headers['x-cache']).toBe('HIT');
      
      // Cache hit should be faster
      expect(response2.body.data.searchMetadata.executionTimeMs)
        .toBeLessThan(response1.body.data.searchMetadata.executionTimeMs);
    });

    test('should handle cache invalidation correctly', async () => {
      const searchQuery = {
        lat: 40.7128,
        lng: -74.0060,
        radius: 25
      };

      // First request
      await request(app)
        .get('/api/businesses/search/location')
        .query(searchQuery)
        .expect(200);

      // Invalidate cache for this location
      await locationSearchService.invalidateLocationCache(
        undefined,
        { lat: searchQuery.lat, lng: searchQuery.lng }
      );

      // Next request should be cache miss
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query(searchQuery)
        .expect(200);

      expect(response.body.data.searchMetadata.cacheHit).toBe(false);
    });
  });

  describe('Categories in Location API', () => {
    test('should return available categories in location', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location/categories')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      
      // Should contain categories from our test data
      expect(response.body.data.categories).toContain('restaurant');
      expect(response.body.data.location).toEqual({
        lat: 40.7128,
        lng: -74.0060,
        radius: 50
      });
    });

    test('should cache categories results', async () => {
      const query = { lat: 40.7128, lng: -74.0060, radius: 25 };

      // First request (cache miss)
      const response1 = await request(app)
        .get('/api/businesses/search/location/categories')
        .query(query)
        .expect(200);

      // Second request should be faster (cache hit)
      const startTime = Date.now();
      const response2 = await request(app)
        .get('/api/businesses/search/location/categories')
        .query(query)
        .expect(200);
      const endTime = Date.now();

      expect(response2.body.data.categories).toEqual(response1.body.data.categories);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Popular Areas API', () => {
    test('should return popular business areas', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location/popular-areas')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.popularAreas).toBeInstanceOf(Array);
      expect(response.body.data.searchCenter).toBeDefined();

      if (response.body.data.popularAreas.length > 0) {
        const area = response.body.data.popularAreas[0];
        expect(area.center).toBeDefined();
        expect(area.center.lat).toBeTypeOf('number');
        expect(area.center.lng).toBeTypeOf('number');
        expect(area.businessCount).toBeTypeOf('number');
        expect(area.averageRating).toBeTypeOf('number');
        expect(area.topCategories).toBeInstanceOf(Array);
      }
    });
  });

  describe('Error Handling', () => {
    test('should validate required coordinates', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid search parameters');
    });

    test('should validate coordinate ranges', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 999, // Invalid latitude
          lng: -74.0060,
          radius: 25
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid radius values', async () => {
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 999 // Too large radius
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle database connection errors gracefully', async () => {
      // Temporarily close the database connection
      await pool.end();
      
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 25
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Location search failed');

      // Restore connection for cleanup
      pool = new Pool({
        ...config,
        database: config.database + '_test',
      });
    });
  });

  describe('Security and Rate Limiting', () => {
    test('should handle malicious coordinate inputs', async () => {
      const maliciousInputs = [
        { lat: 'DROP TABLE businesses;', lng: -74.0060 },
        { lat: 40.7128, lng: '<script>alert("xss")</script>' },
        { lat: '40.7128; DELETE FROM businesses WHERE 1=1;--', lng: -74.0060 }
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: input.lat,
            lng: input.lng,
            radius: 25
          });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should sanitize text search inputs', async () => {
      const maliciousSearch = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 25,
          search: maliciousSearch
        });

      // Should either succeed with sanitized input or fail with validation error
      if (response.status === 200) {
        // Verify no businesses match malicious script
        expect(response.body.data.businesses.length).toBe(0);
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    test('should handle high-volume concurrent requests', async () => {
      const concurrentRequests = 20;
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        request(app)
          .get('/api/businesses/search/location')
          .query({
            lat: 40.7128 + (index * 0.001), // Slightly different locations
            lng: -74.0060 + (index * 0.001),
            radius: 25
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      expect(totalTime).toBeLessThan(5000); // All requests under 5 seconds
      expect(avgTimePerRequest).toBeLessThan(1000); // Average under 1 second

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should maintain performance with large datasets', async () => {
      // This test would be more meaningful with a larger test dataset
      // For now, we'll test with current data
      const response = await request(app)
        .get('/api/businesses/search/location')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 100, // Large radius
          limit: 50    // Large limit
        })
        .expect(200);

      expect(response.body.data.searchMetadata.executionTimeMs).toBeLessThan(1000);
      expect(response.body.data.businesses.length).toBeGreaterThanOrEqual(0);
    });
  });
});