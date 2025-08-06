import { NextFunction, Request, Response } from 'express';
import { createClient } from 'redis';
import { config } from '../config/environment.js';

// Redis client for rate limiting
const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (err) => {
  console.error('Redis Rate Limiting Error:', err);
});

// Initialize Redis connection
const initializeRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Redis-based rate limiting middleware
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req: Request) => req.ip || 'unknown',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await initializeRedis();
      
      const key = `rate_limit:${keyGenerator(req)}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries and count current requests
      await redisClient.zRemRangeByScore(key, 0, windowStart);
      const currentRequests = await redisClient.zCard(key);

      if (currentRequests >= maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Add current request
      await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await redisClient.expire(key, Math.ceil(windowMs / 1000));

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - currentRequests - 1).toString(),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
      });

      // Store original status and json methods to track response
      const originalStatus = res.status;
      const originalJson = res.json;
      let responseStatus = 200;

      res.status = function(code: number) {
        responseStatus = code;
        return originalStatus.call(this, code);
      };

      res.json = function(body: any) {
        // Remove request from count if we should skip based on response
        if (
          (skipSuccessfulRequests && responseStatus >= 200 && responseStatus < 400) ||
          (skipFailedRequests && responseStatus >= 400)
        ) {
          // Remove the last added request
          redisClient.zRemRangeByRank(key, -1, -1).catch(err => 
            console.error('Error removing request from rate limit:', err)
          );
        }
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If Redis fails, don't block the request
      next();
    }
  };
};

// Predefined rate limiters for different endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

export const registrationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 registrations per hour
  message: 'Too many registration attempts. Please try again in an hour.',
});

export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset attempts per hour
  message: 'Too many password reset attempts. Please try again in an hour.',
});

export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many requests. Please slow down.',
});

/**
 * Account lockout functionality
 */
export class AccountLockout {
  private static readonly LOCKOUT_PREFIX = 'lockout:';
  private static readonly ATTEMPT_PREFIX = 'attempts:';
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds

  /**
   * Record a failed login attempt
   */
  static async recordFailedAttempt(identifier: string): Promise<{
    attempts: number;
    isLocked: boolean;
    lockoutExpires?: Date;
  }> {
    try {
      await initializeRedis();
      
      const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
      const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;

      // Check if account is already locked
      const isLocked = await redisClient.exists(lockoutKey);
      if (isLocked) {
        const ttl = await redisClient.ttl(lockoutKey);
        return {
          attempts: this.MAX_ATTEMPTS,
          isLocked: true,
          lockoutExpires: new Date(Date.now() + ttl * 1000),
        };
      }

      // Increment attempt count
      const attempts = await redisClient.incr(attemptKey);
      await redisClient.expire(attemptKey, this.LOCKOUT_DURATION);

      // Lock account if max attempts reached
      if (attempts >= this.MAX_ATTEMPTS) {
        await redisClient.setEx(lockoutKey, this.LOCKOUT_DURATION, 'locked');
        await redisClient.del(attemptKey);
        
        return {
          attempts,
          isLocked: true,
          lockoutExpires: new Date(Date.now() + this.LOCKOUT_DURATION * 1000),
        };
      }

      return {
        attempts,
        isLocked: false,
      };
    } catch (error) {
      console.error('Error recording failed attempt:', error);
      return { attempts: 0, isLocked: false };
    }
  }

  /**
   * Check if account is locked
   */
  static async isAccountLocked(identifier: string): Promise<{
    isLocked: boolean;
    lockoutExpires?: Date;
  }> {
    try {
      await initializeRedis();
      
      const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
      const isLocked = await redisClient.exists(lockoutKey);
      
      if (isLocked) {
        const ttl = await redisClient.ttl(lockoutKey);
        return {
          isLocked: true,
          lockoutExpires: new Date(Date.now() + ttl * 1000),
        };
      }

      return { isLocked: false };
    } catch (error) {
      console.error('Error checking account lockout:', error);
      return { isLocked: false };
    }
  }

  /**
   * Clear failed attempts (on successful login)
   */
  static async clearFailedAttempts(identifier: string): Promise<void> {
    try {
      await initializeRedis();
      
      const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
      const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
      
      await redisClient.del(attemptKey);
      await redisClient.del(lockoutKey);
    } catch (error) {
      console.error('Error clearing failed attempts:', error);
    }
  }

  /**
   * Manual account unlock (admin function)
   */
  static async unlockAccount(identifier: string): Promise<void> {
    try {
      await initializeRedis();
      
      const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
      const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
      
      await redisClient.del(attemptKey);
      await redisClient.del(lockoutKey);
    } catch (error) {
      console.error('Error unlocking account:', error);
      throw new Error('Failed to unlock account');
    }
  }
}

export { redisClient };