import request from 'supertest';
import { handler } from '../../../functions/business/get.js';
import { pool } from '../../../config/database.js';

describe('GET /businesses/:businessId', () => {
  let testBusinessId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, profile) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['test@example.com', 'hashedpassword', 'business_owner', '{}']
    );
    testUserId = userResult.rows[0].id;

    // Create a test business
    const businessResult = await pool.query(
      `INSERT INTO businesses (owner_id, name, description, location, categories, hours, contact, services, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        testUserId,
        'Test Restaurant',
        'A great place to eat',
        JSON.stringify({
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        }),
        ['restaurant', 'food'],
        JSON.stringify({
          monday: { open: '09:00', close: '21:00' },
          sunday: { closed: true }
        }),
        JSON.stringify({
          phone: '+1234567890',
          email: 'restaurant@example.com'
        }),
        JSON.stringify([]),
        true
      ]
    );
    testBusinessId = businessResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM businesses WHERE id = $1', [testBusinessId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  it('should get business by ID successfully', async () => {
    const response = await request(handler)
      .get(`/businesses/${testBusinessId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.business).toBeDefined();
    expect(response.body.business.id).toBe(testBusinessId);
    expect(response.body.business.name).toBe('Test Restaurant');
    expect(response.body.business.location).toBeDefined();
    expect(response.body.business.categories).toEqual(['restaurant', 'food']);
  });

  it('should return 404 for non-existent business', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000';
    
    await request(handler)
      .get(`/businesses/${fakeId}`)
      .expect(404);
  });

  it('should return 400 for invalid business ID format', async () => {
    await request(handler)
      .get('/businesses/invalid-id')
      .expect(400);
  });
});