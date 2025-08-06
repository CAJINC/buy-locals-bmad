import request from 'supertest';
import { handler } from '../../../functions/business/update.js';
import { pool } from '../../../config/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/environment.js';

// Mock the Google Maps API calls
jest.mock('../../../services/geocodingService.ts', () => ({
  GeocodingService: jest.fn().mockImplementation(() => ({
    validateCoordinates: jest.fn().mockReturnValue(true)
  }))
}));

describe('PUT /businesses/:businessId', () => {
  let testBusinessId: string;
  let testUserId: string;
  let otherUserId: string;
  let authToken: string;
  let otherAuthToken: string;

  beforeAll(async () => {
    // Create test users
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, profile) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['test@example.com', 'hashedpassword', 'business_owner', '{}']
    );
    testUserId = userResult.rows[0].id;

    const otherUserResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, profile) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['other@example.com', 'hashedpassword', 'business_owner', '{}']
    );
    otherUserId = otherUserResult.rows[0].id;

    // Create auth tokens
    authToken = jwt.sign({ id: testUserId }, config.jwtSecret);
    otherAuthToken = jwt.sign({ id: otherUserId }, config.jwtSecret);

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
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, otherUserId]);
  });

  it('should update business successfully by owner', async () => {
    const updateData = {
      name: 'Updated Restaurant Name',
      description: 'Updated description',
      contact: {
        phone: '+1987654321',
        email: 'updated@example.com',
        website: 'https://updated.example.com'
      }
    };

    const response = await request(handler)
      .put(`/businesses/${testBusinessId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.business.name).toBe(updateData.name);
    expect(response.body.business.description).toBe(updateData.description);
    expect(response.body.business.contact.phone).toBe(updateData.contact.phone);
  });

  it('should fail to update business if not owner', async () => {
    const updateData = {
      name: 'Unauthorized Update'
    };

    await request(handler)
      .put(`/businesses/${testBusinessId}`)
      .set('Authorization', `Bearer ${otherAuthToken}`)
      .send(updateData)
      .expect(404);
  });

  it('should fail without authentication', async () => {
    const updateData = {
      name: 'Unauthorized Update'
    };

    await request(handler)
      .put(`/businesses/${testBusinessId}`)
      .send(updateData)
      .expect(401);
  });

  it('should fail with invalid business ID', async () => {
    const updateData = {
      name: 'Valid Update'
    };

    await request(handler)
      .put('/businesses/invalid-id')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should fail with empty update data', async () => {
    await request(handler)
      .put(`/businesses/${testBusinessId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({})
      .expect(400);
  });
});