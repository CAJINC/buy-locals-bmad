import { createClient, RedisClientType } from 'redis';

// Enhanced Redis configuration for location-based caching
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        console.error('Redis connection failed after 10 retries');
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
client.on('error', (err) => {
  console.error('Redis Client Error:', {
    error: err.message,
    timestamp: new Date().toISOString(),
    code: err.code,
  });
});

client.on('connect', () => {
  console.log('Redis client connected');
});

client.on('ready', () => {
  console.log('Redis client ready for commands');
});

client.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

client.on('end', () => {
  console.log('Redis client connection ended');
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
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Graceful shutdown
export const disconnectRedis = async (): Promise<void> => {
  if (client.isOpen) {
    await client.disconnect();
    console.log('Redis disconnected');
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
  
  businessLocation: (businessId: string) => 
    `business:location:${businessId}`,
  
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
    console.debug('Redis cache HIT:', { key, timestamp: Date.now() });
  },
  
  trackCacheMiss: (key: string) => {
    console.debug('Redis cache MISS:', { key, timestamp: Date.now() });
  },
  
  trackCacheWrite: (key: string, ttl: number) => {
    console.debug('Redis cache WRITE:', { key, ttl, timestamp: Date.now() });
  },
};

export { client as redisClient };