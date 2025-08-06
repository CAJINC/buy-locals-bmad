import { createClient } from 'redis';
import { config } from '../config/environment.js';
const redisClient = createClient({
    url: config.redisUrl,
});
redisClient.on('error', (err) => {
    console.error('Redis Rate Limiting Error:', err);
});
const initializeRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
    return redisClient;
};
export const createRateLimit = (options) => {
    const { windowMs, maxRequests, message = 'Too many requests, please try again later', skipSuccessfulRequests = false, skipFailedRequests = false, keyGenerator = (req) => req.ip || 'unknown', } = options;
    return async (req, res, next) => {
        try {
            await initializeRedis();
            const key = `rate_limit:${keyGenerator(req)}`;
            const now = Date.now();
            const windowStart = now - windowMs;
            await redisClient.zRemRangeByScore(key, 0, windowStart);
            const currentRequests = await redisClient.zCard(key);
            if (currentRequests >= maxRequests) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message,
                    retryAfter: Math.ceil(windowMs / 1000),
                });
            }
            await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
            await redisClient.expire(key, Math.ceil(windowMs / 1000));
            res.set({
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': (maxRequests - currentRequests - 1).toString(),
                'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
            });
            const originalStatus = res.status;
            const originalJson = res.json;
            let responseStatus = 200;
            res.status = function (code) {
                responseStatus = code;
                return originalStatus.call(this, code);
            };
            res.json = function (body) {
                if ((skipSuccessfulRequests && responseStatus >= 200 && responseStatus < 400) ||
                    (skipFailedRequests && responseStatus >= 400)) {
                    redisClient.zRemRangeByRank(key, -1, -1).catch(err => console.error('Error removing request from rate limit:', err));
                }
                return originalJson.call(this, body);
            };
            next();
        }
        catch (error) {
            console.error('Rate limiting error:', error);
            next();
        }
    };
};
export const authRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true,
});
export const registrationRateLimit = createRateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message: 'Too many registration attempts. Please try again in an hour.',
});
export const passwordResetRateLimit = createRateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again in an hour.',
});
export const generalRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
});
export class AccountLockout {
    static async recordFailedAttempt(identifier) {
        try {
            await initializeRedis();
            const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
            const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
            const isLocked = await redisClient.exists(lockoutKey);
            if (isLocked) {
                const ttl = await redisClient.ttl(lockoutKey);
                return {
                    attempts: this.MAX_ATTEMPTS,
                    isLocked: true,
                    lockoutExpires: new Date(Date.now() + ttl * 1000),
                };
            }
            const attempts = await redisClient.incr(attemptKey);
            await redisClient.expire(attemptKey, this.LOCKOUT_DURATION);
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
        }
        catch (error) {
            console.error('Error recording failed attempt:', error);
            return { attempts: 0, isLocked: false };
        }
    }
    static async isAccountLocked(identifier) {
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
        }
        catch (error) {
            console.error('Error checking account lockout:', error);
            return { isLocked: false };
        }
    }
    static async clearFailedAttempts(identifier) {
        try {
            await initializeRedis();
            const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
            const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
            await redisClient.del(attemptKey);
            await redisClient.del(lockoutKey);
        }
        catch (error) {
            console.error('Error clearing failed attempts:', error);
        }
    }
    static async unlockAccount(identifier) {
        try {
            await initializeRedis();
            const attemptKey = `${this.ATTEMPT_PREFIX}${identifier}`;
            const lockoutKey = `${this.LOCKOUT_PREFIX}${identifier}`;
            await redisClient.del(attemptKey);
            await redisClient.del(lockoutKey);
        }
        catch (error) {
            console.error('Error unlocking account:', error);
            throw new Error('Failed to unlock account');
        }
    }
}
AccountLockout.LOCKOUT_PREFIX = 'lockout:';
AccountLockout.ATTEMPT_PREFIX = 'attempts:';
AccountLockout.MAX_ATTEMPTS = 5;
AccountLockout.LOCKOUT_DURATION = 30 * 60;
export { redisClient };
//# sourceMappingURL=rateLimiting.js.map