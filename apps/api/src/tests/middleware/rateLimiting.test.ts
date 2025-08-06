import { Request, Response, NextFunction } from 'express';
import { createRateLimit, AccountLockout } from '../../middleware/rateLimiting';
import { createClient } from 'redis';

// Mock Redis client
jest.mock('redis');

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      ip: '192.168.1.1',
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock Redis client methods
    mockRedisClient = {
      isOpen: true,
      connect: jest.fn(),
      zRemRangeByScore: jest.fn(),
      zCard: jest.fn(),
      zAdd: jest.fn(),
      expire: jest.fn(),
      zRemRangeByRank: jest.fn(),
      incr: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);
  });

  describe('createRateLimit', () => {
    it('should allow request within rate limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 5,
      });

      mockRedisClient.zCard.mockResolvedValue(2); // Current request count

      await rateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedisClient.zRemRangeByScore).toHaveBeenCalled();
      expect(mockRedisClient.zCard).toHaveBeenCalled();
      expect(mockRedisClient.zAdd).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '2',
        'X-RateLimit-Reset': expect.any(String),
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block request when rate limit exceeded', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5,
        message: 'Too many requests',
      });

      mockRedisClient.zCard.mockResolvedValue(5); // At rate limit

      await rateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        message: 'Too many requests',
        retryAfter: 60,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: (req) => `user:${req.headers['user-id']}`,
      });

      mockReq.headers!['user-id'] = 'user123';
      mockRedisClient.zCard.mockResolvedValue(1);

      await rateLimit(mockReq as Request, mockRes as Response, mockNext);

      // Verify Redis operations used the custom key
      expect(mockRedisClient.zRemRangeByScore).toHaveBeenCalledWith('rate_limit:user:user123', expect.any(Number), expect.any(Number));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue on Redis errors', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5,
      });

      mockRedisClient.zRemRangeByScore.mockRejectedValue(new Error('Redis connection failed'));

      await rateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should not block on Redis failure
    });

    it('should handle skipSuccessfulRequests option', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5,
        skipSuccessfulRequests: true,
      });

      mockRedisClient.zCard.mockResolvedValue(1);

      // Mock response status tracking
      let responseStatus = 200;
      const originalStatus = mockRes.status;
      mockRes.status = jest.fn((code) => {
        responseStatus = code;
        return originalStatus?.call(mockRes, code);
      });

      await rateLimit(mockReq as Request, mockRes as Response, mockNext);

      // Simulate successful response
      const mockJsonSpy = jest.spyOn(mockRes, 'json' as any);
      mockRes.json!({ success: true });

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('AccountLockout', () => {
    describe('recordFailedAttempt', () => {
      it('should record failed attempt and not lock account initially', async () => {
        mockRedisClient.exists.mockResolvedValue(0); // Not locked
        mockRedisClient.incr.mockResolvedValue(1); // First attempt

        const result = await AccountLockout.recordFailedAttempt('test@example.com');

        expect(result.attempts).toBe(1);
        expect(result.isLocked).toBe(false);
        expect(mockRedisClient.incr).toHaveBeenCalledWith('attempts:test@example.com');
        expect(mockRedisClient.expire).toHaveBeenCalled();
      });

      it('should lock account after max attempts', async () => {
        mockRedisClient.exists.mockResolvedValue(0); // Not locked
        mockRedisClient.incr.mockResolvedValue(5); // Max attempts reached

        const result = await AccountLockout.recordFailedAttempt('test@example.com');

        expect(result.attempts).toBe(5);
        expect(result.isLocked).toBe(true);
        expect(result.lockoutExpires).toBeInstanceOf(Date);
        expect(mockRedisClient.setEx).toHaveBeenCalledWith('lockout:test@example.com', 1800, 'locked');
        expect(mockRedisClient.del).toHaveBeenCalledWith('attempts:test@example.com');
      });

      it('should return locked status if already locked', async () => {
        mockRedisClient.exists.mockResolvedValue(1); // Already locked
        mockRedisClient.ttl.mockResolvedValue(900); // 15 minutes remaining

        const result = await AccountLockout.recordFailedAttempt('test@example.com');

        expect(result.attempts).toBe(5);
        expect(result.isLocked).toBe(true);
        expect(result.lockoutExpires).toBeInstanceOf(Date);
        expect(mockRedisClient.incr).not.toHaveBeenCalled();
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

        const result = await AccountLockout.recordFailedAttempt('test@example.com');

        expect(result.attempts).toBe(0);
        expect(result.isLocked).toBe(false);
      });
    });

    describe('isAccountLocked', () => {
      it('should return locked status with expiration', async () => {
        mockRedisClient.exists.mockResolvedValue(1);
        mockRedisClient.ttl.mockResolvedValue(600); // 10 minutes remaining

        const result = await AccountLockout.isAccountLocked('test@example.com');

        expect(result.isLocked).toBe(true);
        expect(result.lockoutExpires).toBeInstanceOf(Date);
      });

      it('should return not locked status', async () => {
        mockRedisClient.exists.mockResolvedValue(0);

        const result = await AccountLockout.isAccountLocked('test@example.com');

        expect(result.isLocked).toBe(false);
        expect(result.lockoutExpires).toBeUndefined();
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

        const result = await AccountLockout.isAccountLocked('test@example.com');

        expect(result.isLocked).toBe(false);
      });
    });

    describe('clearFailedAttempts', () => {
      it('should clear attempts and lockout keys', async () => {
        await AccountLockout.clearFailedAttempts('test@example.com');

        expect(mockRedisClient.del).toHaveBeenCalledWith('attempts:test@example.com');
        expect(mockRedisClient.del).toHaveBeenCalledWith('lockout:test@example.com');
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

        await expect(AccountLockout.clearFailedAttempts('test@example.com'))
          .resolves.not.toThrow();
      });
    });

    describe('unlockAccount', () => {
      it('should unlock account manually', async () => {
        await AccountLockout.unlockAccount('test@example.com');

        expect(mockRedisClient.del).toHaveBeenCalledWith('attempts:test@example.com');
        expect(mockRedisClient.del).toHaveBeenCalledWith('lockout:test@example.com');
      });

      it('should throw error on Redis failure', async () => {
        mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

        await expect(AccountLockout.unlockAccount('test@example.com'))
          .rejects.toThrow('Failed to unlock account');
      });
    });
  });
});