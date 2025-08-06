import { pool, testConnection } from '../config/database.js';
import { UserRepository } from '../repositories/userRepository.js';
import { BusinessRepository } from '../repositories/businessRepository.js';

describe('Database Connection and Repositories', () => {
  let userRepository: UserRepository;
  let businessRepository: BusinessRepository;

  beforeAll(async () => {
    userRepository = new UserRepository();
    businessRepository = new BusinessRepository();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Database Connection', () => {
    it('should establish a connection to the database', async () => {
      const isConnected = await testConnection();
      expect(isConnected).toBe(true);
    });

    it('should execute a simple query', async () => {
      const result = await pool.query('SELECT 1 as test_value');
      expect(result.rows[0].test_value).toBe(1);
    });
  });

  describe('User Repository', () => {
    it('should have health check functionality', async () => {
      const isHealthy = await userRepository.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should be able to count users', async () => {
      const count = await userRepository.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Business Repository', () => {
    it('should have health check functionality', async () => {
      const isHealthy = await businessRepository.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should be able to count businesses', async () => {
      const count = await businessRepository.count();
      expect(typeof count).toBe('number');  
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should be able to get categories', async () => {
      const categories = await businessRepository.getCategories();
      expect(Array.isArray(categories)).toBe(true);
    });
  });
});