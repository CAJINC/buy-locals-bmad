import request from 'supertest';
import express from 'express';
import { handler as registerHandler } from '../../functions/auth/register';
import { handler as loginHandler } from '../../functions/auth/login';
import { handler as refreshHandler } from '../../functions/auth/refresh';
import { handler as logoutHandler } from '../../functions/auth/logout';
import { CreateUserRequest, LoginRequest } from '@buy-locals/shared';
import { CognitoService } from '../../services/cognitoService';
import { pool } from '../../config/database';
import { AccountLockout } from '../../middleware/rateLimiting';

// Mock the serverless handler wrapper for testing
const createTestApp = (handler: any) => {
  const app = express();
  app.use(express.json());
  app.use('/', async (req, res) => {
    const event = {
      httpMethod: req.method,
      path: req.path,
      headers: req.headers,
      body: JSON.stringify(req.body),
      queryStringParameters: req.query,
      pathParameters: req.params,
      requestContext: {
        requestId: 'test-request-id',
      },
    };

    try {
      const result = await handler(event, {});
      res.status(result.statusCode);

      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.set(key, value as string);
        });
      }

      res.send(result.body);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  return app;
};

// Mock external dependencies
jest.mock('../../services/cognitoService');
jest.mock('../../middleware/rateLimiting');
jest.mock('../../config/database');

describe('Authentication API Integration Tests', () => {
  let cognitoServiceMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CognitoService
    cognitoServiceMock = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      refreshToken: jest.fn(),
    };

    (CognitoService as jest.MockedClass<typeof CognitoService>).mockImplementation(
      () => cognitoServiceMock as any
    );

    // Mock database pool
    const mockPool = {
      query: jest.fn(),
    };
    (pool as any).query = mockPool.query;

    // Mock rate limiting to pass through
    const mockRateLimit = (req: any, res: any, next: any) => next();
    (authRateLimit as any) = mockRateLimit;
    (registrationRateLimit as any) = mockRateLimit;
    (AccountLockout as any).isAccountLocked = jest.fn().mockResolvedValue({ isLocked: false });
    (AccountLockout as any).clearFailedAttempts = jest.fn();
    (AccountLockout as any).recordFailedAttempt = jest
      .fn()
      .mockResolvedValue({ attempts: 1, isLocked: false });
  });

  describe('POST /auth/register', () => {
    const app = createTestApp(registerHandler);

    const validUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'Test123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    };

    it('should successfully register a new user', async () => {
      // Mock successful registration
      cognitoServiceMock.registerUser.mockResolvedValue({ userId: 'user-123' });
      cognitoServiceMock.loginUser.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const mockPool = pool as any;
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // User doesn't exist
        .mockResolvedValueOnce({
          // Insert user
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              role: 'consumer',
              profile: { firstName: 'John', lastName: 'Doe' },
              is_email_verified: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const response = await request(app).post('/').send(validUserData).expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(cognitoServiceMock.registerUser).toHaveBeenCalledWith(validUserData);
    });

    it('should reject registration with invalid email', async () => {
      const invalidUserData = { ...validUserData, email: 'invalid-email' };

      const response = await request(app).post('/').send(invalidUserData).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(cognitoServiceMock.registerUser).not.toHaveBeenCalled();
    });

    it('should reject registration with weak password', async () => {
      const weakPasswordData = { ...validUserData, password: '123' };

      const response = await request(app).post('/').send(weakPasswordData).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(cognitoServiceMock.registerUser).not.toHaveBeenCalled();
    });

    it('should handle existing user', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const response = await request(app).post('/').send(validUserData).expect(409);

      expect(response.body.error).toBe('User already exists');
      expect(cognitoServiceMock.registerUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    const app = createTestApp(loginHandler);

    const validCredentials: LoginRequest = {
      email: 'test@example.com',
      password: 'Test123!',
    };

    it('should successfully login user', async () => {
      cognitoServiceMock.loginUser.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const mockPool = pool as any;
      mockPool.query
        .mockResolvedValueOnce({
          // Get user
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              role: 'consumer',
              profile: { firstName: 'John', lastName: 'Doe' },
              is_email_verified: true,
              created_at: new Date(),
              updated_at: new Date(),
              last_login_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({}); // Update last login

      const response = await request(app).post('/').send(validCredentials).expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(cognitoServiceMock.loginUser).toHaveBeenCalledWith('test@example.com', 'Test123!');
    });

    it('should reject login with invalid credentials', async () => {
      cognitoServiceMock.loginUser.mockRejectedValue(new Error('Invalid credentials'));

      (AccountLockout as any).recordFailedAttempt.mockResolvedValue({
        attempts: 1,
        isLocked: false,
      });

      const response = await request(app).post('/').send(validCredentials).expect(401);

      expect(response.body.error).toBe('Invalid credentials');
      expect((AccountLockout as any).recordFailedAttempt).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle account lockout', async () => {
      (AccountLockout as any).isAccountLocked.mockResolvedValue({
        isLocked: true,
        lockoutExpires: new Date(Date.now() + 30 * 60 * 1000),
      });

      const response = await request(app).post('/').send(validCredentials).expect(423);

      expect(response.body.error).toBe('Account temporarily locked');
      expect(cognitoServiceMock.loginUser).not.toHaveBeenCalled();
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app).post('/').send({ email: 'test@example.com' }).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(cognitoServiceMock.loginUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    const app = createTestApp(refreshHandler);

    it('should successfully refresh token', async () => {
      cognitoServiceMock.refreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
      });

      const response = await request(app)
        .post('/')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('idToken');
      expect(cognitoServiceMock.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should reject invalid refresh token', async () => {
      cognitoServiceMock.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app).post('/').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(cognitoServiceMock.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    const app = createTestApp(logoutHandler);

    it('should successfully logout user', async () => {
      // Note: In real implementation, we'd need to properly mock the middleware chain
      const response = await request(app)
        .post('/')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without authentication', async () => {
      const response = await request(app).post('/').expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
