import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { BusinessRepository } from '../../repositories/businessRepository';
import { DatabasePool } from '../../config/database';
import { filterStateService, AdvancedFilters } from '../../services/filterStateService';

/**
 * Comprehensive Advanced Filtering Integration Tests
 * Tests the complete advanced filtering system end-to-end
 */

describe('Advanced Filtering Integration Tests', () => {
  let businessRepository: BusinessRepository;
  let testBusinesses: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    businessRepository = new BusinessRepository();
    
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!',
        role: 'business_owner'
      });
    
    authToken = userResponse.body.data.token;
  });

  beforeEach(async () => {
    // Clean up test data
    await DatabasePool.query('DELETE FROM businesses WHERE name LIKE $1', ['%Test Business%']);
    testBusinesses = [];
    
    // Create test businesses with diverse characteristics
    const testBusinessData = [
      {
        name: 'Test Business 1 - Pizza Palace',
        description: 'Authentic Italian pizza restaurant with fresh ingredients',
        location: {
          address: '123 Main St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          country: 'US',
          coordinates: { lat: 47.6062, lng: -122.3321 }
        },
        categories: ['restaurant', 'italian'],
        hours: {
          monday: { open: '11:00', close: '22:00' },
          tuesday: { open: '11:00', close: '22:00' },
          wednesday: { open: '11:00', close: '22:00' },
          thursday: { open: '11:00', close: '22:00' },
          friday: { open: '11:00', close: '23:00' },
          saturday: { open: '11:00', close: '23:00' },
          sunday: { open: '12:00', close: '21:00' }
        },
        contact: {
          phone: '(555) 123-4567',
          email: 'info@pizzapalace.com',
          website: 'https://pizzapalace.com'
        },
        services: [
          { name: 'Margherita Pizza', description: 'Classic pizza', price: 18.99, duration: 20, isActive: true },
          { name: 'Pepperoni Pizza', description: 'Popular pizza', price: 21.99, duration: 20, isActive: true }
        ],
        media: ['https://example.com/pizza1.jpg', 'https://example.com/pizza2.jpg'],
        verified: true
      },
      {
        name: 'Test Business 2 - Coffee Corner',
        description: 'Artisan coffee shop with fresh pastries and specialty drinks',
        location: {
          address: '456 Pine St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98102',
          country: 'US',
          coordinates: { lat: 47.6105, lng: -122.3250 }
        },
        categories: ['cafe', 'bakery'],
        hours: {
          monday: { open: '06:00', close: '19:00' },
          tuesday: { open: '06:00', close: '19:00' },
          wednesday: { open: '06:00', close: '19:00' },
          thursday: { open: '06:00', close: '19:00' },
          friday: { open: '06:00', close: '20:00' },
          saturday: { open: '07:00', close: '20:00' },
          sunday: { open: '08:00', close: '18:00' }
        },
        contact: {
          phone: '(555) 234-5678',
          email: 'hello@coffeecorner.com'
        },
        services: [
          { name: 'Espresso', description: 'Fresh espresso', price: 3.50, duration: 5, isActive: true },
          { name: 'Croissant', description: 'Buttery croissant', price: 4.25, duration: 2, isActive: true }
        ],
        media: ['https://example.com/coffee1.jpg'],
        verified: false
      },
      {
        name: 'Test Business 3 - Luxury Spa',
        description: 'High-end spa with premium treatments and relaxation services',
        location: {
          address: '789 Wellness Blvd',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98103',
          country: 'US',
          coordinates: { lat: 47.6205, lng: -122.3100 }
        },
        categories: ['spa', 'wellness'],
        hours: {
          monday: { open: '09:00', close: '21:00' },
          tuesday: { open: '09:00', close: '21:00' },
          wednesday: { open: '09:00', close: '21:00' },
          thursday: { open: '09:00', close: '21:00' },
          friday: { open: '09:00', close: '22:00' },
          saturday: { open: '08:00', close: '22:00' },
          sunday: { open: '10:00', close: '20:00' }
        },
        contact: {
          phone: '(555) 345-6789',
          email: 'info@luxuryspa.com',
          website: 'https://luxuryspa.com'
        },
        services: [
          { name: 'Swedish Massage', description: 'Relaxing massage', price: 120.00, duration: 60, isActive: true },
          { name: 'Facial Treatment', description: 'Premium facial', price: 95.00, duration: 45, isActive: true }
        ],
        verified: true
      },
      {
        name: 'Test Business 4 - Budget Gym',
        description: 'Affordable fitness center with basic equipment and classes',
        location: {
          address: '321 Fitness Ave',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98104',
          country: 'US',
          coordinates: { lat: 47.5995, lng: -122.3355 }
        },
        categories: ['fitness', 'gym'],
        hours: {
          monday: { open: '05:00', close: '23:00' },
          tuesday: { open: '05:00', close: '23:00' },
          wednesday: { open: '05:00', close: '23:00' },
          thursday: { open: '05:00', close: '23:00' },
          friday: { open: '05:00', close: '23:00' },
          saturday: { open: '06:00', close: '22:00' },
          sunday: { open: '07:00', close: '21:00' }
        },
        contact: {
          phone: '(555) 456-7890',
          email: 'info@budgetgym.com'
        },
        services: [
          { name: 'Basic Membership', description: 'Access to gym equipment', price: 29.99, duration: null, isActive: true },
          { name: 'Personal Training', description: '1-on-1 training', price: 65.00, duration: 60, isActive: true }
        ],
        verified: false
      },
      {
        name: 'Test Business 5 - 24/7 Convenience',
        description: 'Round-the-clock convenience store with essentials and snacks',
        location: {
          address: '555 Always Open St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98105',
          country: 'US',
          coordinates: { lat: 47.6150, lng: -122.3200 }
        },
        categories: ['convenience', 'retail'],
        hours: {
          monday: { open: '00:00', close: '23:59' },
          tuesday: { open: '00:00', close: '23:59' },
          wednesday: { open: '00:00', close: '23:59' },
          thursday: { open: '00:00', close: '23:59' },
          friday: { open: '00:00', close: '23:59' },
          saturday: { open: '00:00', close: '23:59' },
          sunday: { open: '00:00', close: '23:59' }
        },
        contact: {
          phone: '(555) 567-8901'
        },
        services: [
          { name: 'Coffee', description: 'Hot coffee', price: 2.99, duration: 2, isActive: true },
          { name: 'Snacks', description: 'Various snacks', price: 1.99, duration: null, isActive: true }
        ],
        verified: false
      }
    ];

    // Create businesses via API
    for (const businessData of testBusinessData) {
      const response = await request(app)
        .post('/api/businesses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(businessData);
      
      if (response.status === 201) {
        testBusinesses.push(response.body.data);
      }
    }

    // Add some reviews to create rating data
    // Note: This would require review endpoints to be implemented
    // For now, we'll simulate by directly updating the database if needed
  });

  afterEach(async () => {
    // Clean up test data
    for (const business of testBusinesses) {
      try {
        await DatabasePool.query('DELETE FROM businesses WHERE id = $1', [business.id]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  });

  afterAll(async () => {
    // Clean up test user
    await DatabasePool.query('DELETE FROM users WHERE email = $1', ['testuser@example.com']);
  });

  describe('Filter State Service', () => {
    it('should validate filters correctly', () => {
      const validFilters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant'],
        search: 'pizza',
        priceRange: { min: 10, max: 50 },
        minRating: 4.0
      };

      const validation = filterStateService.validateFilters(validFilters);
      expect(validation.isValid).toBe(true);
      expect(validation.conflicts).toHaveLength(0);
      expect(validation.appliedFilters.length).toBeGreaterThan(0);
    });

    it('should detect filter conflicts', () => {
      const conflictingFilters: AdvancedFilters = {
        location: { lat: 200, lng: -122.3321, radius: 150 }, // Invalid lat and radius
        priceRange: { min: 100, max: 50 }, // Invalid price range
        minRating: 6.0 // Invalid rating
      };

      const validation = filterStateService.validateFilters(conflictingFilters);
      expect(validation.isValid).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
      expect(validation.conflicts.some(c => c.type === 'error')).toBe(true);
    });

    it('should serialize and deserialize URL parameters', () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 15 },
        categories: ['restaurant', 'cafe'],
        search: 'coffee shop',
        priceRange: { min: 5, max: 25 },
        minRating: 4.5,
        hasPhotos: true,
        verifiedOnly: true
      };

      const urlParams = filterStateService.filtersToUrlParams(filters);
      const reconstructedFilters = filterStateService.urlParamsToFilters(urlParams);

      expect(reconstructedFilters.location?.lat).toBe(filters.location?.lat);
      expect(reconstructedFilters.location?.lng).toBe(filters.location?.lng);
      expect(reconstructedFilters.categories).toEqual(filters.categories);
      expect(reconstructedFilters.search).toBe(filters.search);
      expect(reconstructedFilters.priceRange?.min).toBe(filters.priceRange?.min);
      expect(reconstructedFilters.hasPhotos).toBe(filters.hasPhotos);
      expect(reconstructedFilters.verifiedOnly).toBe(filters.verifiedOnly);
    });

    it('should generate filter breadcrumbs', () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant'],
        search: 'pizza',
        priceRange: { min: 10, max: 30 },
        minRating: 4.0,
        hasPhotos: true
      };

      const breadcrumbs = filterStateService.generateFilterBreadcrumbs(filters);
      
      expect(breadcrumbs.length).toBeGreaterThan(0);
      expect(breadcrumbs.some(b => b.label === 'Location')).toBe(true);
      expect(breadcrumbs.some(b => b.label === 'Category')).toBe(true);
      expect(breadcrumbs.some(b => b.label === 'Search')).toBe(true);
      expect(breadcrumbs.some(b => b.label === 'Price')).toBe(true);
      expect(breadcrumbs.some(b => b.label === 'Rating')).toBe(true);
      expect(breadcrumbs.every(b => b.removable)).toBe(true);
    });

    it('should handle filter presets', () => {
      const presets = filterStateService.getDefaultPresets();
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.every(p => p.id && p.name && p.filters)).toBe(true);

      // Test custom preset creation
      const customFilters: AdvancedFilters = {
        categories: ['restaurant'],
        minRating: 4.5,
        priceRange: { min: 20, max: 50 }
      };

      const customPreset = filterStateService.createCustomPreset(
        'My Favorite Restaurants',
        customFilters,
        'High-quality restaurants in my price range'
      );

      expect(customPreset.id).toBeDefined();
      expect(customPreset.name).toBe('My Favorite Restaurants');
      expect(customPreset.filters).toEqual(customFilters);
      expect(customPreset.isDefault).toBe(false);
    });
  });

  describe('Advanced Search API', () => {
    it('should perform basic advanced search', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant']
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.businesses).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.filters).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();

      // Should find the pizza restaurant
      const pizzaRestaurant = response.body.data.businesses.find(
        (b: any) => b.name.includes('Pizza Palace')
      );
      expect(pizzaRestaurant).toBeDefined();
    });

    it('should filter by price range', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        priceRange: { min: 50, max: 150 } // Should match spa services
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      // Should find the luxury spa
      const luxurySpa = businesses.find((b: any) => b.name.includes('Luxury Spa'));
      expect(luxurySpa).toBeDefined();
    });

    it('should filter by text search', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        search: 'coffee'
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      // Should find coffee-related businesses
      const hasCoffe = businesses.some((b: any) => 
        b.name.toLowerCase().includes('coffee') || 
        b.description.toLowerCase().includes('coffee')
      );
      expect(hasCoffe).toBe(true);
    });

    it('should filter by business hours (24/7)', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        businessHours: { is24x7: true }
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      // Should find the 24/7 convenience store
      const convenience = businesses.find((b: any) => b.name.includes('24/7 Convenience'));
      expect(convenience).toBeDefined();
    });

    it('should filter by verified status', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        verifiedOnly: true
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      // All returned businesses should be verified
      businesses.forEach((business: any) => {
        expect(business.verified).toBe(true);
      });
    });

    it('should filter by photo availability', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        hasPhotos: true
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      // All returned businesses should have photos
      businesses.forEach((business: any) => {
        expect(business.media).toBeDefined();
        expect(Array.isArray(business.media)).toBe(true);
        expect(business.media.length).toBeGreaterThan(0);
      });
    });

    it('should sort by distance', async () => {
      const centerLat = 47.6062;
      const centerLng = -122.3321;
      
      const filters: AdvancedFilters = {
        location: { lat: centerLat, lng: centerLng, radius: 20 },
        sortBy: 'distance'
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      const businesses = response.body.data.businesses;
      
      if (businesses.length > 1) {
        // Verify distances are in ascending order
        for (let i = 1; i < businesses.length; i++) {
          expect(businesses[i].distance).toBeGreaterThanOrEqual(businesses[i - 1].distance);
        }
      }
    });

    it('should handle complex filter combinations', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        categories: ['restaurant', 'cafe'],
        search: 'pizza',
        priceRange: { min: 10, max: 50 },
        hasPhotos: true,
        sortBy: 'rating'
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.data.filters.applied.length).toBeGreaterThan(3);
      expect(response.body.data.filters.breadcrumbs.length).toBeGreaterThan(3);
      expect(response.body.data.metadata.queryComplexity).toBe('complex');
    });

    it('should handle pagination', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 20 },
        page: 1,
        limit: 2
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.businesses.length).toBeLessThanOrEqual(2);
      
      if (response.body.data.pagination.total > 2) {
        expect(response.body.data.pagination.totalPages).toBeGreaterThan(1);
      }
    });
  });

  describe('Filter Preset API', () => {
    it('should get default presets', async () => {
      const response = await request(app).get('/api/businesses/search/filters/presets');

      expect(response.status).toBe(200);
      expect(response.body.data.default).toBeDefined();
      expect(response.body.data.default.length).toBeGreaterThan(0);
      expect(response.body.data.custom).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should create custom preset when authenticated', async () => {
      const presetData = {
        name: 'My Test Preset',
        description: 'A test filter preset',
        filters: {
          categories: ['restaurant'],
          minRating: 4.0,
          priceRange: { min: 15, max: 40 }
        }
      };

      const response = await request(app)
        .post('/api/businesses/search/filters/presets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(presetData);

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe(presetData.name);
      expect(response.body.data.filters).toEqual(presetData.filters);
    });

    it('should apply preset with location override', async () => {
      // Get a default preset first
      const presetsResponse = await request(app).get('/api/businesses/search/filters/presets');
      const presetId = presetsResponse.body.data.default[0].id;

      const response = await request(app)
        .post(`/api/businesses/search/filters/apply-preset/${presetId}`)
        .send({
          location: { lat: 47.6062, lng: -122.3321 }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.filters).toBeDefined();
      expect(response.body.data.filters.location).toBeDefined();
      expect(response.body.data.state).toBeDefined();
      expect(response.body.data.breadcrumbs).toBeDefined();
      expect(response.body.data.preset.id).toBe(presetId);
    });
  });

  describe('Filter Validation API', () => {
    it('should validate filters', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant'],
        minRating: 4.0
      };

      const response = await request(app)
        .post('/api/businesses/search/filters/validate')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.data.validation.isValid).toBe(true);
      expect(response.body.data.state).toBeDefined();
      expect(response.body.data.breadcrumbs).toBeDefined();
    });

    it('should detect invalid filters', async () => {
      const invalidFilters = {
        location: { lat: 200, lng: -122.3321 }, // Invalid latitude
        priceRange: { min: 100, max: 50 }, // Invalid range
        minRating: 6.0 // Invalid rating
      };

      const response = await request(app)
        .post('/api/businesses/search/filters/validate')
        .send(invalidFilters);

      expect(response.status).toBe(200);
      expect(response.body.data.validation.isValid).toBe(false);
      expect(response.body.data.validation.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('URL Parameter Parsing API', () => {
    it('should parse URL parameters into filters', async () => {
      const params = 'lat=47.6062&lng=-122.3321&radius=10&categories=restaurant,cafe&search=pizza&minRating=4.0&hasPhotos=true';

      const response = await request(app)
        .get(`/api/businesses/search/filters/parse-url?${params}`);

      expect(response.status).toBe(200);
      expect(response.body.data.filters.location.lat).toBe(47.6062);
      expect(response.body.data.filters.location.lng).toBe(-122.3321);
      expect(response.body.data.filters.categories).toEqual(['restaurant', 'cafe']);
      expect(response.body.data.filters.search).toBe('pizza');
      expect(response.body.data.filters.minRating).toBe(4.0);
      expect(response.body.data.filters.hasPhotos).toBe(true);
    });
  });

  describe('Filter Clearing API', () => {
    it('should clear specific filter', async () => {
      const currentFilters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant'],
        search: 'pizza',
        minRating: 4.0
      };

      const response = await request(app)
        .delete('/api/businesses/search/filters/clear/search')
        .send(currentFilters);

      expect(response.status).toBe(200);
      expect(response.body.data.filters.search).toBeUndefined();
      expect(response.body.data.filters.location).toBeDefined();
      expect(response.body.data.filters.categories).toBeDefined();
      expect(response.body.data.cleared).toBe('search');
    });

    it('should clear all filters', async () => {
      const currentFilters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant'],
        search: 'pizza'
      };

      const response = await request(app)
        .delete('/api/businesses/search/filters/clear/all')
        .send(currentFilters);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.data.filters)).toHaveLength(0);
      expect(response.body.data.cleared).toBe('all');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle invalid filter validation gracefully', async () => {
      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send({
          location: { lat: 'invalid', lng: -122.3321 }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return performance metadata', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 10 },
        categories: ['restaurant', 'cafe'],
        search: 'test',
        priceRange: { min: 10, max: 100 },
        minRating: 3.0
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.data.metadata.searchTime).toBeDefined();
      expect(response.body.data.metadata.queryComplexity).toBeDefined();
      expect(['simple', 'moderate', 'complex']).toContain(response.body.data.metadata.queryComplexity);
    });

    it('should handle large result sets with pagination', async () => {
      const filters: AdvancedFilters = {
        location: { lat: 47.6062, lng: -122.3321, radius: 50 }, // Large radius
        limit: 2
      };

      const response = await request(app)
        .post('/api/businesses/search/advanced')
        .send(filters);

      expect(response.status).toBe(200);
      expect(response.body.data.businesses.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });
});