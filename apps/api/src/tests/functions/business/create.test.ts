import request from 'supertest';
import { handler } from '../../../functions/business/create.js';
import { pool } from '../../../config/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/environment.js';
import { GeocodingService } from '../../../services/geocodingService.js';

// Mock the Google Maps API calls
jest.mock('../../../services/geocodingService.ts', () => ({
  GeocodingService: jest.fn().mockImplementation(() => ({
    geocodeAddress: jest.fn().mockResolvedValue({
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      coordinates: { lat: 40.7128, lng: -74.006 },
      formattedAddress: '123 Main St, New York, NY 10001, USA',
    }),
    validateCoordinates: jest.fn().mockReturnValue(true),
  })),
}));

describe('POST /businesses', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, profile) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['test@example.com', 'hashedpassword', 'business_owner', '{}']
    );
    testUserId = userResult.rows[0].id;

    // Create auth token
    authToken = jwt.sign({ id: testUserId }, config.jwtSecret);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM businesses WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  it('should create a business successfully with complete data', async () => {
    const businessData = {
      name: 'Test Restaurant',
      description: 'A great place to eat',
      location: {
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
      },
      categories: ['restaurant', 'food'],
      hours: {
        monday: { open: '09:00', close: '21:00' },
        tuesday: { open: '09:00', close: '21:00' },
        wednesday: { open: '09:00', close: '21:00' },
        thursday: { open: '09:00', close: '21:00' },
        friday: { open: '09:00', close: '23:00' },
        saturday: { open: '10:00', close: '23:00' },
        sunday: { closed: true },
      },
      contact: {
        phone: '+1234567890',
        email: 'restaurant@example.com',
        website: 'https://restaurant.example.com',
      },
      services: [
        {
          name: 'Dine-in',
          description: 'Restaurant dining',
          price: 25.0,
          duration: 90,
        },
      ],
    };

    const response = await request(handler)
      .post('/businesses')
      .set('Authorization', `Bearer ${authToken}`)
      .send(businessData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.business).toBeDefined();
    expect(response.body.business.name).toBe(businessData.name);
    expect(response.body.business.location.coordinates).toBeDefined();
    expect(response.body.business.location.coordinates.lat).toBe(40.7128);
    expect(response.body.business.location.coordinates.lng).toBe(-74.006);
  });

  it('should fail without authentication', async () => {
    const businessData = {
      name: 'Test Business',
      location: { address: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001' },
      categories: ['retail'],
      hours: {},
      contact: {},
    };

    await request(handler).post('/businesses').send(businessData).expect(401);
  });

  it('should fail with invalid data', async () => {
    const invalidData = {
      name: '', // Empty name should fail
      location: { address: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001' },
      categories: [],
      hours: {},
      contact: {},
    };

    await request(handler)
      .post('/businesses')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidData)
      .expect(400);
  });

  it('should fail with invalid coordinates', async () => {
    const businessData = {
      name: 'Test Business',
      location: {
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        coordinates: { lat: 91, lng: -74.006 }, // Invalid latitude
      },
      categories: ['retail'],
      hours: {},
      contact: {},
    };

    // Mock invalid coordinates
    (GeocodingService as jest.MockedClass<typeof GeocodingService>).mockImplementation(
      () =>
        ({
          validateCoordinates: jest.fn().mockReturnValue(false),
        }) as any
    );

    await request(handler)
      .post('/businesses')
      .set('Authorization', `Bearer ${authToken}`)
      .send(businessData)
      .expect(400);
  });
});
