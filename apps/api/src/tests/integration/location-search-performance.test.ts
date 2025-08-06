import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { locationSearchService } from '../../services/locationSearchService';
import { redisClient, connectRedis, disconnectRedis } from '../../config/redis';
import { pool } from '../../config/database';

describe('Location Search Performance Tests', () => {
  beforeAll(async () => {
    await connectRedis();
    
    // Ensure test database has sample data
    await setupTestData();
  });

  afterAll(async () => {
    await disconnectRedis();
    await pool.end();
  });

  describe('Sub-1-Second Performance Requirements', () => {
    test('should return results within 1000ms for typical search', async () => {
      const startTime = Date.now();
      
      const result = await locationSearchService.searchByLocation({
        lat: 37.7749, // San Francisco
        lng: -122.4194,
        radius: 25,
        limit: 10,
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1000);
      expect(result.businesses).toBeDefined();
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(1000);
    });

    test('should return cached results within 100ms', async () => {
      const searchQuery = {
        lat: 37.7749,
        lng: -122.4194,
        radius: 25,
        limit: 10,
      };

      // First search to populate cache
      await locationSearchService.searchByLocation(searchQuery);
      
      // Second search should be cached
      const startTime = Date.now();
      const result = await locationSearchService.searchByLocation(searchQuery);
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(result.cacheHit).toBe(true);
    });

    test('should handle large radius searches within performance bounds', async () => {
      const startTime = Date.now();
      
      const result = await locationSearchService.searchByLocation({
        lat: 40.7128, // New York
        lng: -74.0060,
        radius: 100, // Large radius
        limit: 50,
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(2000); // Allow 2s for large radius
      expect(result.businesses).toBeDefined();
    });

    test('should maintain performance with complex filters', async () => {
      const startTime = Date.now();
      
      const result = await locationSearchService.searchByLocation({
        lat: 34.0522, // Los Angeles
        lng: -118.2437,
        radius: 25,
        category: ['restaurant', 'retail'],
        search: 'coffee',
        limit: 20,
        sortBy: 'distance',
        isOpen: true,
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1500); // Allow slightly more time for complex filters
      expect(result.businesses).toBeDefined();
    });
  });

  describe('Concurrent Load Testing', () => {
    test('should handle concurrent requests without degradation', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        const promise = locationSearchService.searchByLocation({
          lat: 37.7749 + (Math.random() - 0.5) * 0.1, // Slight variation
          lng: -122.4194 + (Math.random() - 0.5) * 0.1,
          radius: 25,
          limit: 10,
        });
        promises.push(promise);
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(5000);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.businesses).toBeDefined();
        expect(result.executionTimeMs).toBeLessThan(2000);
      });
    });

    test('should maintain cache hit rate under load', async () => {
      const sameQuery = {
        lat: 37.7749,
        lng: -122.4194,
        radius: 25,
        limit: 10,
      };
      
      // Prime the cache
      await locationSearchService.searchByLocation(sameQuery);
      
      // Make multiple identical requests
      const promises = Array(5).fill(null).map(() => 
        locationSearchService.searchByLocation(sameQuery)
      );
      
      const results = await Promise.all(promises);
      
      // Most should be cache hits
      const cacheHits = results.filter(r => r.cacheHit).length;
      expect(cacheHits).toBeGreaterThan(2);
    });
  });

  describe('Database Performance', () => {
    test('should use PostGIS spatial indexes efficiently', async () => {
      // Query plan analysis to ensure indexes are used
      const explainQuery = `
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT * FROM search_businesses_by_location(37.7749, -122.4194, 25, NULL, NULL, 10, 0)
      `;
      
      const result = await pool.query(explainQuery);
      const queryPlan = result.rows.map(row => row['QUERY PLAN']).join('\n');
      
      // Should use spatial index
      expect(queryPlan).toContain('Index Scan');
      expect(queryPlan).toContain('idx_businesses_location_gist');
      
      // Should not do full table scan
      expect(queryPlan).not.toContain('Seq Scan on businesses');
    });

    test('should optimize query execution time', async () => {
      const testQueries = [
        { lat: 37.7749, lng: -122.4194, radius: 10 },
        { lat: 40.7128, lng: -74.0060, radius: 25 },
        { lat: 34.0522, lng: -118.2437, radius: 50 },
      ];
      
      for (const query of testQueries) {
        const startTime = Date.now();
        
        const sql = `
          SELECT * FROM search_businesses_by_location($1, $2, $3, NULL, NULL, 10, 0)
        `;
        
        const result = await pool.query(sql, [query.lat, query.lng, query.radius]);
        const executionTime = Date.now() - startTime;
        
        expect(executionTime).toBeLessThan(500); // Direct DB query should be very fast
        expect(result.rows).toBeDefined();
      }
    });
  });

  describe('Cache Performance', () => {
    test('should have efficient cache key generation', async () => {
      const testCases = [
        { lat: 37.7749, lng: -122.4194, radius: 25 },
        { lat: 37.7750, lng: -122.4195, radius: 25 }, // Slightly different
        { lat: 37.7749, lng: -122.4194, radius: 26 }, // Different radius
      ];
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        
        await locationSearchService.searchByLocation({
          ...testCase,
          limit: 10,
        });
        
        const cacheWriteTime = Date.now() - startTime;
        
        // Cache operations should be fast
        expect(cacheWriteTime).toBeLessThan(1200);
      }
    });

    test('should handle cache misses gracefully', async () => {
      // Clear cache for this test
      await redisClient.flushDb();
      
      const startTime = Date.now();
      
      const result = await locationSearchService.searchByLocation({
        lat: 37.7749,
        lng: -122.4194,
        radius: 25,
        limit: 10,
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(result.cacheHit).toBe(false);
      expect(executionTime).toBeLessThan(1000); // Still within performance bounds
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not cause memory leaks during repeated searches', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many searches
      for (let i = 0; i < 100; i++) {
        await locationSearchService.searchByLocation({
          lat: 37.7749 + (Math.random() - 0.5) * 0.01,
          lng: -122.4194 + (Math.random() - 0.5) * 0.01,
          radius: 25,
          limit: 10,
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large result sets efficiently', async () => {
      const startTime = Date.now();
      
      const result = await locationSearchService.searchByLocation({
        lat: 37.7749,
        lng: -122.4194,
        radius: 100, // Large radius to get many results
        limit: 50, // Large limit
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(2000);
      expect(result.businesses.length).toBeLessThanOrEqual(50);
    });
  });

  // Helper function to setup test data
  async function setupTestData() {
    // Check if test data exists
    const countResult = await pool.query('SELECT COUNT(*) FROM businesses');
    const businessCount = parseInt(countResult.rows[0].count);
    
    if (businessCount < 100) {
      // Insert test businesses with realistic coordinates
      const testBusinesses = generateTestBusinesses(200);
      
      for (const business of testBusinesses) {
        await pool.query(`
          INSERT INTO businesses 
          (name, description, location, categories, hours, contact, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT DO NOTHING
        `, [
          business.name,
          business.description,
          JSON.stringify(business.location),
          business.categories,
          JSON.stringify(business.hours),
          JSON.stringify(business.contact),
        ]);
      }
    }
  }

  function generateTestBusinesses(count: number) {
    const businesses = [];
    const cities = [
      { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      { name: 'New York', lat: 40.7128, lng: -74.0060 },
      { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Houston', lat: 29.7604, lng: -95.3698 },
    ];
    
    const categories = ['restaurant', 'retail', 'service', 'entertainment', 'health'];
    
    for (let i = 0; i < count; i++) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      // Add some randomness to coordinates within city bounds
      const lat = city.lat + (Math.random() - 0.5) * 0.1;
      const lng = city.lng + (Math.random() - 0.5) * 0.1;
      
      businesses.push({
        name: `Test Business ${i} - ${city.name}`,
        description: `A test ${category} business in ${city.name}`,
        location: {
          address: `${100 + i} Main St`,
          city: city.name,
          state: 'CA',
          zipCode: '94000',
          coordinates: { lat, lng },
        },
        categories: [category],
        hours: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
          saturday: { closed: true },
          sunday: { closed: true },
        },
        contact: {
          phone: `(555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          email: `test${i}@example.com`,
        },
      });
    }
    
    return businesses;
  }
});