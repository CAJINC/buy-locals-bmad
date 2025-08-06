import { createClient } from 'redis';
import { config } from '../config/environment.js';
import { logger } from './logger';

// Redis client for session management
const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', err => {
  logger.error('Redis Client Error in session utils', {
    component: 'session-manager',
    errorMessage: err.message,
  });
});

// Initialize Redis connection
export const initializeRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
};

export class SessionManager {
  private static readonly TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';
  private static readonly USER_SESSION_PREFIX = 'session:user:';
  private static readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Blacklist a token (for logout functionality)
   */
  static async blacklistToken(tokenId: string, expirationTime?: number): Promise<void> {
    try {
      await initializeRedis();
      const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
      const ttl = expirationTime
        ? Math.floor(expirationTime - Date.now() / 1000)
        : this.DEFAULT_TTL;

      if (ttl > 0) {
        await redisClient.setEx(key, ttl, 'blacklisted');
      }
    } catch (error) {
      logger.error('Error blacklisting token', {
        component: 'session-manager',
        action: 'blacklist-token',
        tokenId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  static async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      await initializeRedis();
      const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
      const result = await redisClient.get(key);
      return result !== null;
    } catch (error) {
      logger.error('Error checking token blacklist', {
        component: 'session-manager',
        action: 'check-blacklist',
        tokenId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false; // Fail open - don't block valid tokens due to Redis issues
    }
  }

  /**
   * Store user session data
   */
  static async storeUserSession(
    userId: string,
    sessionData: {
      deviceInfo?: string;
      ipAddress?: string;
      lastActivity: Date;
      loginTime: Date;
    }
  ): Promise<void> {
    try {
      await initializeRedis();
      const key = `${this.USER_SESSION_PREFIX}${userId}`;
      const data = {
        ...sessionData,
        lastActivity: sessionData.lastActivity.toISOString(),
        loginTime: sessionData.loginTime.toISOString(),
      };

      await redisClient.setEx(key, this.DEFAULT_TTL, JSON.stringify(data));
    } catch (error) {
      logger.error('Error storing user session', {
        component: 'session-manager',
        action: 'store-session',
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - session storage failure shouldn't block authentication
    }
  }

  /**
   * Get user session data
   */
  static async getUserSession(userId: string): Promise<{
    deviceInfo?: string;
    ipAddress?: string;
    lastActivity: Date;
    loginTime: Date;
  } | null> {
    try {
      await initializeRedis();
      const key = `${this.USER_SESSION_PREFIX}${userId}`;
      const data = await redisClient.get(key);

      if (!data) return null;

      const sessionData = JSON.parse(data);
      return {
        ...sessionData,
        lastActivity: new Date(sessionData.lastActivity),
        loginTime: new Date(sessionData.loginTime),
      };
    } catch (error) {
      logger.error('Error getting user session', {
        component: 'session-manager',
        action: 'get-session',
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update user's last activity time
   */
  static async updateLastActivity(userId: string): Promise<void> {
    try {
      await initializeRedis();
      const key = `${this.USER_SESSION_PREFIX}${userId}`;
      const existingData = await redisClient.get(key);

      if (existingData) {
        const sessionData = JSON.parse(existingData);
        sessionData.lastActivity = new Date().toISOString();
        await redisClient.setEx(key, this.DEFAULT_TTL, JSON.stringify(sessionData));
      }
    } catch (error) {
      logger.error('Error updating last activity', {
        component: 'session-manager',
        action: 'update-activity',
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - activity update failure shouldn't block requests
    }
  }

  /**
   * Clear user session (logout)
   */
  static async clearUserSession(userId: string): Promise<void> {
    try {
      await initializeRedis();
      const key = `${this.USER_SESSION_PREFIX}${userId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Error clearing user session', {
        component: 'session-manager',
        action: 'clear-session',
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to clear user session');
    }
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      await initializeRedis();
      // Redis handles TTL expiration automatically, so this is mainly for logging
      logger.info('Session cleanup completed', {
        component: 'session-manager',
        action: 'cleanup',
      });
    } catch (error) {
      logger.error('Error during session cleanup', {
        component: 'session-manager',
        action: 'cleanup',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export Redis client for other utilities
export { redisClient };
