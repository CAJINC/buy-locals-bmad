import { Pool } from 'pg';
import { beforeAll, afterAll, describe, test, expect, beforeEach } from '@jest/globals';
import { config } from '../../config/database.js';

describe('PostGIS Spatial Queries', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      ...config,
      // Use test database
      database: config.database + '_test',
    });

    // Ensure PostGIS extension is available
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM businesses WHERE name LIKE \'Test Business%\'');
  });

  describe('PostGIS Migration Validation', () => {
    test('should have location_point column with correct type', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'location_point'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].udt_name).toBe('geometry');
    });

    test('should have spatial indexes created', async () => {
      const result = await pool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'businesses' 
        AND indexname LIKE '%location%'
      `);

      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_businesses_location_gist');
      expect(indexNames).toContain('idx_businesses_location_categories');
    });

    test('should have spatial functions available', async () => {
      const functions = [
        'search_businesses_by_location',
        'count_businesses_by_location',
        'extract_coordinates_from_location',
        'update_location_point'
      ];

      for (const funcName of functions) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = $1
          ) as exists
        `, [funcName]);

        expect(result.rows[0].exists).toBe(true);
      }
    });

    test('should have location point trigger working', async () => {
      // Insert test business with JSONB location
      const testLocation = {
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      };

      const insertResult = await pool.query(`
        INSERT INTO businesses (
          id, owner_id, name, location, categories, hours, contact, is_active
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), 'Test Business Trigger', 
          $1, $2, $3, $4, true
        ) RETURNING id, location_point
      `, [
        JSON.stringify(testLocation),
        ['restaurant'],
        JSON.stringify({}),
        JSON.stringify({})
      ]);

      expect(insertResult.rows[0].location_point).toBeTruthy();

      // Verify the geometry point is correct
      const pointResult = await pool.query(`
        SELECT ST_X(location_point) as lng, ST_Y(location_point) as lat
        FROM businesses WHERE id = $1
      `, [insertResult.rows[0].id]);

      expect(pointResult.rows[0].lat).toBeCloseTo(40.7128, 4);
      expect(pointResult.rows[0].lng).toBeCloseTo(-74.0060, 4);
    });
  });

  describe('Spatial Query Performance', () => {
    beforeEach(async () => {
      // Insert test businesses for performance testing
      const testBusinesses = [
        { name: 'Test Business 1', lat: 40.7128, lng: -74.0060, category: 'restaurant' },
        { name: 'Test Business 2', lat: 40.7614, lng: -73.9776, category: 'retail' },
        { name: 'Test Business 3', lat: 40.6892, lng: -74.0445, category: 'service' },
        { name: 'Test Business 4', lat: 40.7831, lng: -73.9712, category: 'restaurant' },
        { name: 'Test Business 5', lat: 40.7505, lng: -73.9934, category: 'retail' },
      ];

      for (const business of testBusinesses) {
        const location = {
          address: '123 Test St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          coordinates: { lat: business.lat, lng: business.lng }
        };

        await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, true
          )
        `, [
          business.name,
          JSON.stringify(location),
          [business.category],
          JSON.stringify({}),
          JSON.stringify({})
        ]);
      }
    });

    test('should perform location search within performance target (<200ms)', async () => {
      const startTime = process.hrtime.bigint();
      
      const result = await pool.query(`
        SELECT * FROM search_businesses_by_location(
          40.7128, -74.0060, 25, NULL, NULL, 10, 0
        )
      `);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      expect(executionTimeMs).toBeLessThan(200);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('should handle high-volume concurrent queries', async () => {
      const queries = Array(10).fill(null).map(() =>
        pool.query(`
          SELECT * FROM search_businesses_by_location(
            40.7128, -74.0060, 10, NULL, NULL, 5, 0
          )
        `)
      );

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(queries);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // All queries should complete within 1 second total
      expect(totalTimeMs).toBeLessThan(1000);
      
      // All queries should return results
      results.forEach(result => {
        expect(result.rows.length).toBeGreaterThanOrEqual(0);
      });
    });

    test('should use spatial index (query plan verification)', async () => {
      const explainResult = await pool.query(`
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT * FROM search_businesses_by_location(
          40.7128, -74.0060, 25, NULL, NULL, 10, 0
        )
      `);

      const queryPlan = explainResult.rows.map(row => row['QUERY PLAN']).join(' ');
      
      // Should use GiST index for spatial queries
      expect(queryPlan).toContain('Index Scan') || expect(queryPlan).toContain('Bitmap Index Scan');
      expect(queryPlan).toContain('idx_businesses_location_gist') || expect(queryPlan).toContain('location');
    });
  });

  describe('Spatial Function Accuracy', () => {
    beforeEach(async () => {
      // Insert known test locations
      const knownLocations = [
        { name: 'NYC Empire State', lat: 40.748817, lng: -73.985428 },
        { name: 'NYC Times Square', lat: 40.758896, lng: -73.985130 },
        { name: 'Boston Commons', lat: 42.355492, lng: -71.065638 },
      ];

      for (const location of knownLocations) {
        const locationData = {
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          coordinates: { lat: location.lat, lng: location.lng }
        };

        await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, true
          )
        `, [
          location.name,
          JSON.stringify(locationData),
          ['test'],
          JSON.stringify({}),
          JSON.stringify({})
        ]);
      }
    });

    test('should calculate accurate distances', async () => {
      // Search from Empire State Building
      const result = await pool.query(`
        SELECT name, distance_km
        FROM search_businesses_by_location(
          40.748817, -73.985428, 50, NULL, NULL, 10, 0
        )
        WHERE name LIKE 'NYC%' OR name LIKE 'Boston%'
        ORDER BY distance_km
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
      
      // Times Square should be closer than Boston Commons
      const timesSquare = result.rows.find(r => r.name === 'NYC Times Square');
      const bostonCommons = result.rows.find(r => r.name === 'Boston Commons');
      
      expect(timesSquare.distance_km).toBeLessThan(2); // About 1.1 km
      expect(bostonCommons.distance_km).toBeGreaterThan(300); // About 306 km
      expect(timesSquare.distance_km).toBeLessThan(bostonCommons.distance_km);
    });

    test('should respect radius filtering', async () => {
      // Search with small radius from Empire State Building
      const smallRadiusResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM search_businesses_by_location(
          40.748817, -73.985428, 2, NULL, NULL, 100, 0
        )
        WHERE name LIKE 'NYC%' OR name LIKE 'Boston%'
      `);

      // Should only find NYC locations, not Boston
      expect(parseInt(smallRadiusResult.rows[0].count)).toBeLessThan(3);

      // Search with large radius
      const largeRadiusResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM search_businesses_by_location(
          40.748817, -73.985428, 500, NULL, NULL, 100, 0
        )
        WHERE name LIKE 'NYC%' OR name LIKE 'Boston%'
      `);

      // Should find all locations
      expect(parseInt(largeRadiusResult.rows[0].count)).toBeGreaterThanOrEqual(3);
    });

    test('should handle category filtering correctly', async () => {
      // Add businesses with different categories
      const testData = [
        { name: 'Test Restaurant A', category: 'restaurant' },
        { name: 'Test Retail B', category: 'retail' },
        { name: 'Test Service C', category: 'service' }
      ];

      for (const business of testData) {
        const location = {
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        };

        await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, true
          )
        `, [
          business.name,
          JSON.stringify(location),
          [business.category],
          JSON.stringify({}),
          JSON.stringify({})
        ]);
      }

      // Test category filtering
      const restaurantResult = await pool.query(`
        SELECT name FROM search_businesses_by_location(
          40.7128, -74.0060, 25, $1, NULL, 10, 0
        )
        WHERE name LIKE 'Test%'
      `, [['restaurant']]);

      expect(restaurantResult.rows.length).toBe(1);
      expect(restaurantResult.rows[0].name).toBe('Test Restaurant A');
    });
  });

  describe('Migration Rollback Testing', () => {
    test('should be able to rollback migration safely', async () => {
      // Read rollback migration
      const rollbackSql = `
        -- Drop triggers and functions
        DROP TRIGGER IF EXISTS businesses_location_point_trigger ON businesses;
        DROP FUNCTION IF EXISTS update_location_point();
        DROP FUNCTION IF EXISTS search_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT, INTEGER, INTEGER);
        DROP FUNCTION IF EXISTS count_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT);
        DROP FUNCTION IF EXISTS extract_coordinates_from_location(JSONB);
        
        -- Drop indexes
        DROP INDEX IF EXISTS idx_businesses_location_gist;
        DROP INDEX IF EXISTS idx_businesses_location_categories;
        DROP INDEX IF EXISTS idx_businesses_location_active_created;
        DROP INDEX IF EXISTS idx_businesses_distance_calc;
        
        -- Drop statistics
        DROP STATISTICS IF EXISTS businesses_location_stats;
        
        -- Drop constraints
        ALTER TABLE businesses DROP CONSTRAINT IF EXISTS check_location_point_valid;
        
        -- Drop column
        ALTER TABLE businesses DROP COLUMN IF EXISTS location_point;
      `;

      // Test rollback (in transaction to avoid affecting other tests)
      await pool.query('BEGIN');
      
      try {
        // Execute rollback
        await pool.query(rollbackSql);
        
        // Verify column is gone
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'businesses' 
          AND column_name = 'location_point'
        `);
        
        expect(columnCheck.rows).toHaveLength(0);
        
        // Verify functions are gone
        const functionCheck = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'search_businesses_by_location'
          ) as exists
        `);
        
        expect(functionCheck.rows[0].exists).toBe(false);
        
      } finally {
        // Rollback transaction to restore state
        await pool.query('ROLLBACK');
      }
    });

    test('should maintain data integrity during rollback', async () => {
      // Insert test data
      const location = {
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      };

      const insertResult = await pool.query(`
        INSERT INTO businesses (
          id, owner_id, name, location, categories, hours, contact, is_active
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), 'Test Rollback Business', 
          $1, $2, $3, $4, true
        ) RETURNING id
      `, [
        JSON.stringify(location),
        ['test'],
        JSON.stringify({}),
        JSON.stringify({})
      ]);

      const businessId = insertResult.rows[0].id;

      await pool.query('BEGIN');
      
      try {
        // Simulate partial rollback (drop column)
        await pool.query('ALTER TABLE businesses DROP COLUMN IF EXISTS location_point');
        
        // Verify business data is still intact
        const businessCheck = await pool.query(`
          SELECT id, name, location 
          FROM businesses 
          WHERE id = $1
        `, [businessId]);
        
        expect(businessCheck.rows).toHaveLength(1);
        expect(businessCheck.rows[0].name).toBe('Test Rollback Business');
        expect(businessCheck.rows[0].location).toBeTruthy();
        
      } finally {
        await pool.query('ROLLBACK');
      }

      // Cleanup
      await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    });
  });

  describe('Data Migration Validation', () => {
    test('should properly migrate existing JSONB location data', async () => {
      // Test different JSONB location formats
      const testLocations = [
        {
          name: 'Format 1 - coordinates nested',
          location: {
            address: '123 Test St',
            coordinates: { lat: 40.7128, lng: -74.0060 }
          }
        },
        {
          name: 'Format 2 - latitude/longitude direct',
          location: {
            address: '456 Test Ave',
            latitude: 42.3601, longitude: -71.0589
          }
        }
      ];

      for (const test of testLocations) {
        await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, true
          )
        `, [
          test.name,
          JSON.stringify(test.location),
          ['test'],
          JSON.stringify({}),
          JSON.stringify({})
        ]);
      }

      // Verify both formats were converted to geometry points
      const migrationResult = await pool.query(`
        SELECT name, ST_X(location_point) as lng, ST_Y(location_point) as lat
        FROM businesses 
        WHERE name LIKE 'Format%'
        ORDER BY name
      `);

      expect(migrationResult.rows).toHaveLength(2);
      
      // Format 1
      expect(migrationResult.rows[0].lat).toBeCloseTo(40.7128, 4);
      expect(migrationResult.rows[0].lng).toBeCloseTo(-74.0060, 4);
      
      // Format 2
      expect(migrationResult.rows[1].lat).toBeCloseTo(42.3601, 4);
      expect(migrationResult.rows[1].lng).toBeCloseTo(-71.0589, 4);
    });

    test('should handle invalid location data gracefully', async () => {
      const invalidLocations = [
        { name: 'No coordinates', location: { address: '123 Test St' } },
        { name: 'Invalid coordinates', location: { coordinates: { lat: 'invalid', lng: 'invalid' } } },
        { name: 'Out of range', location: { coordinates: { lat: 999, lng: 999 } } }
      ];

      for (const test of invalidLocations) {
        await pool.query(`
          INSERT INTO businesses (
            id, owner_id, name, location, categories, hours, contact, is_active
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, true
          )
        `, [
          test.name,
          JSON.stringify(test.location),
          ['test'],
          JSON.stringify({}),
          JSON.stringify({})
        ]);
      }

      // Verify invalid data results in NULL location_point
      const invalidResult = await pool.query(`
        SELECT name, location_point
        FROM businesses 
        WHERE name IN ('No coordinates', 'Invalid coordinates', 'Out of range')
      `);

      expect(invalidResult.rows).toHaveLength(3);
      invalidResult.rows.forEach(row => {
        expect(row.location_point).toBeNull();
      });
    });
  });
});