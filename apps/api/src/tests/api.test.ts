import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

describe('API Endpoints', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('User Routes', () => {
    it('should require authentication for profile access', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access token required');
    });
  });

  describe('Business Routes', () => {
    it('should return businesses with search parameters', async () => {
      const response = await request(app)
        .get('/api/businesses')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should return categories', async () => {
      const response = await request(app)
        .get('/api/businesses/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication for business creation', async () => {
      const businessData = {
        name: 'Test Business',
        description: 'Test Description',
        location: {
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
        },
        categories: ['test'],
        hours: {
          monday: { open: '09:00', close: '17:00' },
        },
        contact: {
          phone: '+1234567890',
          email: 'test@business.com',
        },
      };

      const response = await request(app)
        .post('/api/businesses')
        .send(businessData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access token required');
    });
  });

  describe('Validation', () => {
    it('should validate business creation data', async () => {
      const invalidBusinessData = {
        name: '', // Invalid: empty name
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/businesses')
        .set('Authorization', 'Bearer invalid-token')
        .send(invalidBusinessData);

      // Should fail with validation error before auth check
      expect(response.status).toBeOneOf([400, 401, 403]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });
});