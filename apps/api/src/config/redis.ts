import { RedisClientType, createClient } from 'redis';
import { logger } from '../utils/logger';

// Enhanced Redis configuration for location-based caching
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('Redis connection failed after 10 retries', {
          component: 'redis-reconnect',
          retries,
        });
        return new Error('Redis connection failed');
      }
      // Exponential backoff: 50ms * 2^retries, max 5s
      return Math.min(50 * Math.pow(2, retries), 5000);
    },
  },
  database: parseInt(process.env.REDIS_DB || '0', 10),
};

const client: RedisClientType = createClient(redisConfig);

// Enhanced error handling and monitoring
client.on('error', err => {
  logger.redis('Redis Client Error', {
    component: 'redis-client',
    event: 'error',
    errorMessage: err.message,
    code: err.code,
  });
});

client.on('connect', () => {
  logger.redis('Redis client connected', {
    component: 'redis-client',
    event: 'connect',
  });
});

client.on('ready', () => {
  logger.redis('Redis client ready for commands', {
    component: 'redis-client',
    event: 'ready',
  });
});

client.on('reconnecting', () => {
  logger.redis('Redis client reconnecting', {
    component: 'redis-client',
    event: 'reconnecting',
  });
});

client.on('end', () => {
  logger.redis('Redis client connection ended', {
    component: 'redis-client',
    event: 'end',
  });
});

// Connection management
let isConnecting = false;

export const connectRedis = async (): Promise<void> => {
  if (client.isReady || isConnecting) {
    return;
  }

  isConnecting = true;
  try {
    await client.connect();
    logger.redis('Redis connected successfully', {
      component: 'redis-connection',
      success: true,
    });
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      component: 'redis-connection',
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Graceful shutdown
export const disconnectRedis = async (): Promise<void> => {
  if (client.isOpen) {
    await client.disconnect();
    logger.redis('Redis disconnected', {
      component: 'redis-connection',
      event: 'disconnect',
    });
  }
};

// Health check
export const isRedisHealthy = async (): Promise<boolean> => {
  try {
    if (!client.isReady) return false;
    await client.ping();
    return true;
  } catch {
    return false;
  }
};

// Cache key utilities for location-based caching
export const cacheKeys = {
  locationSearch: (lat: number, lng: number, radius: number, filters: string = '') =>
    `location:search:${Math.round(lat * 10000)}:${Math.round(lng * 10000)}:${radius}:${filters}`,

  businessLocation: (businessId: string) => `business:location:${businessId}`,

  geographicCluster: (lat: number, lng: number) =>
    `geo:cluster:${Math.round(lat * 100)}:${Math.round(lng * 100)}`,

  categoriesInLocation: (lat: number, lng: number, radius: number) =>
    `categories:location:${Math.round(lat * 100)}:${Math.round(lng * 100)}:${radius}`,

  popularAreas: (lat: number, lng: number, radius: number) =>
    `popular:areas:${Math.round(lat * 100)}:${Math.round(lng * 100)}:${radius}`,
};

// Performance monitoring
export const redisMetrics = {
  trackCacheHit: (key: string) => {
    logger.debug('Redis cache HIT', {
      component: 'redis-cache',
      event: 'hit',
      key,
      timestamp: Date.now(),
    });
  },

  trackCacheMiss: (key: string) => {
    logger.debug('Redis cache MISS', {
      component: 'redis-cache',
      event: 'miss',
      key,
      timestamp: Date.now(),
    });
  },

  trackCacheWrite: (key: string, ttl: number) => {
    logger.debug('Redis cache WRITE', {
      component: 'redis-cache',
      event: 'write',
      key,
      ttl,
      timestamp: Date.now(),
    });
  },
};

export { client as redisClient };
