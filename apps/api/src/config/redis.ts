import { RedisClientType, createClient } from 'redis';
import { logger } from '../utils/logger';

// Enterprise Redis configuration for high-performance location-based caching
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 2000, // Reduced for faster connection
    lazyConnect: true,
    keepAlive: 30000, // Keep connection alive
    reconnectStrategy: (retries: number) => {
      if (retries > 15) { // Increased retry attempts for enterprise resilience
        logger.error('Redis connection failed after 15 retries', {
          component: 'redis-reconnect',
          retries,
          timestamp: Date.now(),
        });
        return new Error('Redis connection failed');
      }
      // Optimized exponential backoff: 25ms * 1.5^retries, max 3s
      return Math.min(25 * Math.pow(1.5, retries), 3000);
    },
  },
  database: parseInt(process.env.REDIS_DB || '0', 10),
  // Enterprise performance optimizations
  pingInterval: 30000, // Health check interval
  commandTimeout: 1000, // 1 second command timeout for performance
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxLoadingTimeout: 3000,
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

// Enterprise cache key utilities with geographic clustering and performance optimization
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

  // Enterprise performance monitoring keys
  performanceMetrics: (component: string) => `perf:metrics:${component}`,
  cacheHitRatio: (timeWindow: string) => `cache:hit_ratio:${timeWindow}`,
  searchLatency: (region: string) => `search:latency:${region}`,
  
  // Geographic distribution keys for multi-region caching
  regionData: (region: string, dataType: string) => `region:${region}:${dataType}`,
  proximityCache: (lat: number, lng: number, precision: number = 3) =>
    `proximity:${Math.round(lat * Math.pow(10, precision))}:${Math.round(lng * Math.pow(10, precision))}`,

  // Suggestion and prediction caching
  searchSuggestions: (query: string) => `suggestions:${query.toLowerCase().slice(0, 50)}`,
  popularSearches: (region: string, timeframe: string) => `popular:searches:${region}:${timeframe}`,
  
  // A/B testing and analytics
  abTestResults: (testId: string, variant: string) => `ab_test:${testId}:${variant}`,
  analyticsData: (metric: string, period: string) => `analytics:${metric}:${period}`,
};

// Enterprise performance monitoring and analytics
export const redisMetrics = {
  // Cache performance tracking
  trackCacheHit: (key: string, executionTime?: number) => {
    const timestamp = Date.now();
    logger.debug('Redis cache HIT', {
      component: 'redis-cache',
      event: 'hit',
      key,
      executionTime,
      timestamp,
    });
    
    // Update hit ratio counters asynchronously
    client.incr('cache:hits:total').catch(() => {});
    client.incr(`cache:hits:${getTimeWindow()}`).catch(() => {});
  },

  trackCacheMiss: (key: string, executionTime?: number) => {
    const timestamp = Date.now();
    logger.debug('Redis cache MISS', {
      component: 'redis-cache',
      event: 'miss',
      key,
      executionTime,
      timestamp,
    });
    
    // Update miss counters asynchronously
    client.incr('cache:misses:total').catch(() => {});
    client.incr(`cache:misses:${getTimeWindow()}`).catch(() => {});
  },

  trackCacheWrite: (key: string, ttl: number, dataSize?: number) => {
    logger.debug('Redis cache WRITE', {
      component: 'redis-cache',
      event: 'write',
      key,
      ttl,
      dataSize,
      timestamp: Date.now(),
    });
    
    // Track cache writes and storage usage
    client.incr('cache:writes:total').catch(() => {});
    if (dataSize) {
      client.incrBy('cache:storage:bytes', dataSize).catch(() => {});
    }
  },

  // Performance analytics
  trackSearchLatency: (latency: number, region: string, cacheHit: boolean) => {
    const timeWindow = getTimeWindow();
    const promises = [
      client.lPush(`search:latency:${region}:${timeWindow}`, latency.toString()),
      client.lTrim(`search:latency:${region}:${timeWindow}`, 0, 999), // Keep last 1000 entries
      client.expire(`search:latency:${region}:${timeWindow}`, 3600), // 1 hour TTL
    ];
    
    if (cacheHit) {
      promises.push(
        client.lPush(`search:cache_latency:${region}:${timeWindow}`, latency.toString()),
        client.lTrim(`search:cache_latency:${region}:${timeWindow}`, 0, 999)
      );
    }
    
    Promise.all(promises).catch(error => 
      logger.warn('Search latency tracking failed', { error: error.message })
    );
  },

  // Get cache hit ratio
  getCacheHitRatio: async (timeWindow: string = 'current'): Promise<number> => {
    try {
      const [hits, misses] = await Promise.all([
        client.get(`cache:hits:${timeWindow}`),
        client.get(`cache:misses:${timeWindow}`)
      ]);
      
      const hitCount = parseInt(hits || '0');
      const missCount = parseInt(misses || '0');
      const total = hitCount + missCount;
      
      return total > 0 ? hitCount / total : 0;
    } catch (error) {
      logger.warn('Cache hit ratio calculation failed', { error: error.message });
      return 0;
    }
  },

  // Get performance metrics
  getPerformanceMetrics: async (): Promise<{
    cacheHitRatio: number;
    averageLatency: number;
    totalSearches: number;
    cacheSize: number;
  }> => {
    try {
      const timeWindow = getTimeWindow();
      const [hitRatio, totalHits, totalMisses, info] = await Promise.all([
        redisMetrics.getCacheHitRatio(timeWindow),
        client.get('cache:hits:total'),
        client.get('cache:misses:total'),
        client.info('memory')
      ]);
      
      const totalSearches = parseInt(totalHits || '0') + parseInt(totalMisses || '0');
      
      // Extract memory usage from Redis info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const cacheSize = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      return {
        cacheHitRatio: Math.round(hitRatio * 100) / 100,
        averageLatency: 0, // Would be calculated from latency data
        totalSearches,
        cacheSize,
      };
    } catch (error) {
      logger.warn('Performance metrics collection failed', { error: error.message });
      return {
        cacheHitRatio: 0,
        averageLatency: 0,
        totalSearches: 0,
        cacheSize: 0,
      };
    }
  },
};

// Utility function to get current time window for metrics
function getTimeWindow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
}

// Enterprise cache management utilities
export const cacheManager = {
  // Intelligent cache warming for popular searches
  warmCache: async (popularQueries: Array<{ query: any; priority: number }>) => {
    const promises = popularQueries
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 20) // Top 20 queries
      .map(async ({ query }) => {
        try {
          // This would trigger actual search to populate cache
          const cacheKey = cacheKeys.locationSearch(
            query.lat, query.lng, query.radius, query.filters || ''
          );
          
          // Check if already cached
          const exists = await client.exists(cacheKey);
          if (!exists) {
            logger.debug('Cache warming needed for query', { query });
            // Would trigger search service to populate cache
          }
        } catch (error) {
          logger.warn('Cache warming failed for query', { query, error: error.message });
        }
      });
    
    await Promise.allSettled(promises);
  },

  // Intelligent cache invalidation with geographic patterns
  invalidateGeographicArea: async (lat: number, lng: number, radius: number) => {
    try {
      const patterns = [
        cacheKeys.geographicCluster(lat, lng),
        cacheKeys.categoriesInLocation(lat, lng, radius),
        cacheKeys.popularAreas(lat, lng, radius),
        cacheKeys.proximityCache(lat, lng),
      ];
      
      // Also invalidate nearby areas (grid-based invalidation)
      const gridSize = 0.01; // ~1km
      for (let latOffset = -gridSize; latOffset <= gridSize; latOffset += gridSize) {
        for (let lngOffset = -gridSize; lngOffset <= gridSize; lngOffset += gridSize) {
          patterns.push(cacheKeys.geographicCluster(lat + latOffset, lng + lngOffset));
        }
      }
      
      // Delete cache entries
      const deletePromises = patterns.map(pattern => client.del(pattern));
      await Promise.allSettled(deletePromises);
      
      logger.info('Geographic cache invalidation completed', {
        lat, lng, radius, patternsInvalidated: patterns.length
      });
    } catch (error) {
      logger.error('Geographic cache invalidation failed', {
        lat, lng, radius, error: error.message
      });
    }
  },

  // Cache health monitoring
  getHealthMetrics: async () => {
    try {
      const [info, stats] = await Promise.all([
        client.info(),
        client.info('stats')
      ]);
      
      return {
        connected: client.isReady,
        memoryUsage: extractMemoryUsage(info),
        connectionStats: extractConnectionStats(stats),
        uptime: extractUptime(info),
        commandsPerSecond: extractCommandsPerSecond(stats),
      };
    } catch (error) {
      logger.error('Cache health metrics collection failed', { error: error.message });
      return null;
    }
  },

  // Distributed cache sync for multi-region setups
  syncCacheAcrossRegions: async (key: string, data: any, ttl: number) => {
    try {
      // Primary cache write
      await client.setEx(key, ttl, JSON.stringify(data));
      
      // If multi-region setup exists, sync to other regions
      const regions = process.env.REDIS_REGIONS?.split(',') || [];
      if (regions.length > 1) {
        const syncPromises = regions.map(region => {
          const regionKey = cacheKeys.regionData(region, key);
          return client.setEx(regionKey, ttl, JSON.stringify(data));
        });
        
        await Promise.allSettled(syncPromises);
        logger.debug('Cache synchronized across regions', { key, regions: regions.length });
      }
    } catch (error) {
      logger.warn('Multi-region cache sync failed', { key, error: error.message });
    }
  },
};

// Utility functions for parsing Redis info
function extractMemoryUsage(info: string): { used: number; peak: number; fragmentation: number } {
  const usedMatch = info.match(/used_memory:(\d+)/);
  const peakMatch = info.match(/used_memory_peak:(\d+)/);
  const fragMatch = info.match(/mem_fragmentation_ratio:([\d.]+)/);
  
  return {
    used: usedMatch ? parseInt(usedMatch[1]) : 0,
    peak: peakMatch ? parseInt(peakMatch[1]) : 0,
    fragmentation: fragMatch ? parseFloat(fragMatch[1]) : 1.0,
  };
}

function extractConnectionStats(stats: string): { total: number; clients: number } {
  const totalMatch = stats.match(/total_connections_received:(\d+)/);
  const clientsMatch = stats.match(/connected_clients:(\d+)/);
  
  return {
    total: totalMatch ? parseInt(totalMatch[1]) : 0,
    clients: clientsMatch ? parseInt(clientsMatch[1]) : 0,
  };
}

function extractUptime(info: string): number {
  const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
  return uptimeMatch ? parseInt(uptimeMatch[1]) : 0;
}

function extractCommandsPerSecond(stats: string): number {
  const commandsMatch = stats.match(/instantaneous_ops_per_sec:(\d+)/);
  return commandsMatch ? parseInt(commandsMatch[1]) : 0;
}

export { client as redisClient };
