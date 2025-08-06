import { redisClient, cacheKeys, redisMetrics, cacheManager } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { performanceMonitoringService } from './performanceMonitoringService.js';

/**
 * Intelligent Cache Manager
 * Enterprise multi-level caching architecture with geographic clustering
 * Target: >90% cache hit rate, <50ms cache response time
 */

export interface CacheConfig {
  ttl: number;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  compression: boolean;
  replication: boolean;
  geographicScope: 'local' | 'regional' | 'global';
}

export interface CacheEntry<T = any> {
  data: T;
  metadata: {
    created: number;
    accessed: number;
    hits: number;
    size: number;
    tags: string[];
    priority: number;
    compressed: boolean;
    region: string;
  };
}

export interface CacheStats {
  hitRatio: number;
  missRatio: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  evictionRate: number;
  regionDistribution: { [region: string]: number };
  tagDistribution: { [tag: string]: number };
}

export interface CacheInvalidationRule {
  pattern: string;
  triggers: string[];
  cascade: boolean;
  delay?: number;
}

class IntelligentCacheManager {
  private readonly L1_CACHE_SIZE = 100 * 1024 * 1024; // 100MB L1 cache
  private readonly L2_CACHE_SIZE = 500 * 1024 * 1024; // 500MB L2 cache
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private readonly CACHE_WARMING_BATCH_SIZE = 20;
  private readonly GEOGRAPHIC_REPLICATION_DELAY = 5000; // 5 seconds

  // Multi-level cache structure
  private l1Cache = new Map<string, CacheEntry>(); // In-memory hot cache
  private l2Cache = new Map<string, CacheEntry>(); // In-memory warm cache
  private cacheStats = new Map<string, { hits: number; misses: number; lastAccess: number }>();
  
  // Cache invalidation and management
  private invalidationRules: CacheInvalidationRule[] = [];
  private invalidationQueue: Array<{ key: string; delay: number }> = [];
  private cacheWarmingQueue: Array<{ key: string; priority: number; generator: () => Promise<any> }> = [];
  
  // Performance tracking
  private performanceMetrics: { [operation: string]: number[] } = {};
  private currentMemoryUsage = { l1: 0, l2: 0, redis: 0 };
  
  constructor() {
    this.initializeCacheManager();
  }

  /**
   * Initialize intelligent cache manager
   */
  private async initializeCacheManager(): Promise<void> {
    logger.info('🏗️ Initializing Intelligent Cache Manager');
    
    try {
      await this.setupInvalidationRules();
      await this.startCacheWarmingService();
      await this.startPerformanceMonitoring();
      await this.startGeographicReplication();
      
      // Schedule maintenance tasks
      this.scheduleMaintenanceTasks();
      
      logger.info('✅ Intelligent Cache Manager initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Intelligent Cache Manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Get data with intelligent multi-level caching
   */
  async get<T>(
    key: string,
    options: {
      tags?: string[];
      region?: string;
      fallbackGenerator?: () => Promise<T>;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<T | null> {
    const startTime = Date.now();
    const { tags = [], region = 'default', fallbackGenerator, priority = 'medium' } = options;

    try {
      // 1. Check L1 cache (hottest data)
      const l1Result = await this.getFromL1<T>(key);
      if (l1Result !== null) {
        this.recordCacheHit(key, 'l1', Date.now() - startTime);
        return l1Result;
      }

      // 2. Check L2 cache (warm data)
      const l2Result = await this.getFromL2<T>(key);
      if (l2Result !== null) {
        // Promote to L1 if frequently accessed
        await this.promoteToL1(key, l2Result, { tags, region });
        this.recordCacheHit(key, 'l2', Date.now() - startTime);
        return l2Result;
      }

      // 3. Check Redis cache (distributed cache)
      const redisResult = await this.getFromRedis<T>(key);
      if (redisResult !== null) {
        // Store in L2 for faster future access
        await this.setInL2(key, redisResult, { tags, region, priority });
        this.recordCacheHit(key, 'redis', Date.now() - startTime);
        return redisResult;
      }

      // 4. Generate data if fallback provided
      if (fallbackGenerator) {
        const generatedData = await fallbackGenerator();
        if (generatedData !== null && generatedData !== undefined) {
          // Store in all cache levels
          await this.setIntelligent(key, generatedData, {
            tags,
            region,
            priority,
            ttl: this.calculateOptimalTTL(key, tags),
          });
          this.recordCacheMiss(key, 'generated', Date.now() - startTime);
          return generatedData;
        }
      }

      this.recordCacheMiss(key, 'not_found', Date.now() - startTime);
      return null;
    } catch (error) {
      logger.error('Cache get operation failed', { key, error: error.message });
      this.recordCacheMiss(key, 'error', Date.now() - startTime);
      
      // Try fallback generator even on cache errors
      if (fallbackGenerator) {
        try {
          return await fallbackGenerator();
        } catch (fallbackError) {
          logger.error('Fallback generator failed', { key, error: fallbackError.message });
        }
      }
      
      return null;
    }
  }

  /**
   * Set data with intelligent distribution across cache levels
   */
  async set<T>(
    key: string,
    data: T,
    config: CacheConfig & { region?: string } = {
      ttl: 300,
      tags: [],
      priority: 'medium',
      compression: false,
      replication: false,
      geographicScope: 'local',
      region: 'default'
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.setIntelligent(key, data, config);
      this.recordPerformanceMetric('set', Date.now() - startTime);
      
      // Trigger geographic replication if needed
      if (config.replication && config.geographicScope !== 'local') {
        this.scheduleGeographicReplication(key, data, config);
      }
      
      // Update cache warming queue if high priority
      if (config.priority === 'high') {
        this.addToCacheWarmingQueue(key, 10, async () => data);
      }
    } catch (error) {
      logger.error('Cache set operation failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Intelligent cache invalidation with pattern matching and cascading
   */
  async invalidate(
    pattern: string,
    options: {
      cascade?: boolean;
      delay?: number;
      reason?: string;
      region?: string;
    } = {}
  ): Promise<number> {
    const { cascade = false, delay = 0, reason = 'manual', region } = options;
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      const keysToInvalidate = await this.findMatchingKeys(pattern);
      
      if (delay > 0) {
        // Schedule delayed invalidation
        keysToInvalidate.forEach(key => {
          this.invalidationQueue.push({ key, delay });
        });
        this.scheduleDelayedInvalidation();
      } else {
        // Immediate invalidation
        for (const key of keysToInvalidate) {
          await this.invalidateKey(key, cascade, region);
          invalidatedCount++;
        }
      }

      logger.info('Cache invalidation completed', {
        pattern,
        keysInvalidated: invalidatedCount,
        cascade,
        delay,
        reason,
        executionTime: Date.now() - startTime,
      });

      // Record invalidation metrics
      performanceMonitoringService.recordMetric({
        timestamp: Date.now(),
        component: 'cache',
        operation: 'invalidation',
        executionTime: Date.now() - startTime,
        success: true,
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Cache invalidation failed', { pattern, error: error.message });
      throw error;
    }
  }

  /**
   * Intelligent cache warming based on usage patterns
   */
  async warmCache(
    entries: Array<{ key: string; generator: () => Promise<any>; priority?: number }>,
    options: {
      batchSize?: number;
      concurrency?: number;
      region?: string;
    } = {}
  ): Promise<void> {
    const { batchSize = this.CACHE_WARMING_BATCH_SIZE, concurrency = 3, region = 'default' } = options;
    
    logger.info('🔥 Starting intelligent cache warming', { 
      totalEntries: entries.length, 
      batchSize, 
      concurrency,
      region 
    });

    const sortedEntries = entries.sort((a, b) => (b.priority || 5) - (a.priority || 5));
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      // Process in batches with concurrency control
      for (let i = 0; i < sortedEntries.length; i += batchSize) {
        const batch = sortedEntries.slice(i, i + batchSize);
        const batchPromises = batch.slice(0, concurrency).map(async (entry) => {
          try {
            const data = await entry.generator();
            if (data !== null && data !== undefined) {
              await this.setIntelligent(entry.key, data, {
                ttl: this.calculateOptimalTTL(entry.key, []),
                tags: ['cache-warming'],
                priority: this.mapPriorityToLevel(entry.priority || 5),
                compression: this.shouldCompress(data),
                replication: false,
                geographicScope: 'local',
                region,
              });
              warmedCount++;
            }
          } catch (error) {
            logger.warn('Cache warming failed for key', { 
              key: entry.key, 
              error: error.message 
            });
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Add small delay between batches to prevent overwhelming
        if (i + batchSize < sortedEntries.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('✅ Cache warming completed', {
        warmedCount,
        totalEntries: entries.length,
        successRate: Math.round((warmedCount / entries.length) * 100),
        executionTime,
        region,
      });

    } catch (error) {
      logger.error('Cache warming failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const redisStats = await redisMetrics.getPerformanceMetrics();
      const l1Size = this.calculateCacheSize(this.l1Cache);
      const l2Size = this.calculateCacheSize(this.l2Cache);
      
      const totalHits = Array.from(this.cacheStats.values()).reduce((sum, stat) => sum + stat.hits, 0);
      const totalMisses = Array.from(this.cacheStats.values()).reduce((sum, stat) => sum + stat.misses, 0);
      const totalRequests = totalHits + totalMisses;

      // Calculate region distribution
      const regionDistribution: { [region: string]: number } = {};
      this.l1Cache.forEach(entry => {
        const region = entry.metadata.region;
        regionDistribution[region] = (regionDistribution[region] || 0) + 1;
      });

      // Calculate tag distribution
      const tagDistribution: { [tag: string]: number } = {};
      this.l1Cache.forEach(entry => {
        entry.metadata.tags.forEach(tag => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      });

      return {
        hitRatio: totalRequests > 0 ? totalHits / totalRequests : 0,
        missRatio: totalRequests > 0 ? totalMisses / totalRequests : 0,
        totalRequests,
        averageResponseTime: this.calculateAverageResponseTime(),
        memoryUsage: l1Size + l2Size,
        evictionRate: this.calculateEvictionRate(),
        regionDistribution,
        tagDistribution,
      };
    } catch (error) {
      logger.error('Failed to get cache statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async getFromL1<T>(key: string): Promise<T | null> {
    const entry = this.l1Cache.get(key);
    if (entry && this.isEntryValid(entry)) {
      entry.metadata.accessed = Date.now();
      entry.metadata.hits++;
      return entry.data as T;
    }
    
    if (entry && !this.isEntryValid(entry)) {
      this.l1Cache.delete(key);
    }
    
    return null;
  }

  private async getFromL2<T>(key: string): Promise<T | null> {
    const entry = this.l2Cache.get(key);
    if (entry && this.isEntryValid(entry)) {
      entry.metadata.accessed = Date.now();
      entry.metadata.hits++;
      return entry.data as T;
    }
    
    if (entry && !this.isEntryValid(entry)) {
      this.l2Cache.delete(key);
    }
    
    return null;
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      if (!redisClient.isReady) return null;
      
      const cached = await redisClient.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        
        // Check if data is compressed
        if (parsed.compressed) {
          return this.decompress(parsed.data) as T;
        }
        
        return parsed.data as T;
      }
    } catch (error) {
      logger.warn('Redis get operation failed', { key, error: error.message });
    }
    
    return null;
  }

  private async setInL1<T>(
    key: string, 
    data: T, 
    options: { tags?: string[]; region?: string; priority?: 'high' | 'medium' | 'low' }
  ): Promise<void> {
    const { tags = [], region = 'default', priority = 'medium' } = options;
    
    // Check L1 cache size limit
    const dataSize = this.estimateDataSize(data);
    if (this.currentMemoryUsage.l1 + dataSize > this.L1_CACHE_SIZE) {
      await this.evictFromL1();
    }

    const entry: CacheEntry<T> = {
      data,
      metadata: {
        created: Date.now(),
        accessed: Date.now(),
        hits: 0,
        size: dataSize,
        tags,
        priority: this.mapPriorityToNumber(priority),
        compressed: false,
        region,
      },
    };

    this.l1Cache.set(key, entry);
    this.currentMemoryUsage.l1 += dataSize;
  }

  private async setInL2<T>(
    key: string,
    data: T,
    options: { tags?: string[]; region?: string; priority?: 'high' | 'medium' | 'low' }
  ): Promise<void> {
    const { tags = [], region = 'default', priority = 'medium' } = options;
    
    // Check L2 cache size limit
    const dataSize = this.estimateDataSize(data);
    if (this.currentMemoryUsage.l2 + dataSize > this.L2_CACHE_SIZE) {
      await this.evictFromL2();
    }

    const entry: CacheEntry<T> = {
      data,
      metadata: {
        created: Date.now(),
        accessed: Date.now(),
        hits: 0,
        size: dataSize,
        tags,
        priority: this.mapPriorityToNumber(priority),
        compressed: false,
        region,
      },
    };

    this.l2Cache.set(key, entry);
    this.currentMemoryUsage.l2 += dataSize;
  }

  private async setIntelligent<T>(
    key: string,
    data: T,
    config: CacheConfig & { region?: string }
  ): Promise<void> {
    const { ttl, tags, priority, compression, region = 'default' } = config;
    const dataSize = this.estimateDataSize(data);
    
    // Determine cache level based on priority and size
    if (priority === 'high' || dataSize < 10000) { // Hot data or small data
      await this.setInL1(key, data, { tags, region, priority });
    } else if (priority === 'medium' || dataSize < 100000) { // Warm data or medium data
      await this.setInL2(key, data, { tags, region, priority });
    }

    // Always store in Redis for distribution
    await this.setInRedis(key, data, { ttl, compression, tags, region });
  }

  private async setInRedis<T>(
    key: string,
    data: T,
    options: { ttl: number; compression?: boolean; tags?: string[]; region?: string }
  ): Promise<void> {
    const { ttl, compression = false, tags = [], region = 'default' } = options;
    
    try {
      if (!redisClient.isReady) return;

      let processedData = data;
      let isCompressed = false;

      // Apply compression if needed
      if (compression && this.shouldCompress(data)) {
        processedData = this.compress(data);
        isCompressed = true;
      }

      const cacheData = {
        data: processedData,
        compressed: isCompressed,
        tags,
        region,
        created: Date.now(),
      };

      await redisClient.setEx(key, ttl, JSON.stringify(cacheData));
      redisMetrics.trackCacheWrite(key, ttl, this.estimateDataSize(cacheData));
    } catch (error) {
      logger.warn('Redis set operation failed', { key, error: error.message });
    }
  }

  private async promoteToL1<T>(
    key: string, 
    data: T, 
    options: { tags?: string[]; region?: string }
  ): Promise<void> {
    const entry = this.l2Cache.get(key);
    if (entry && entry.metadata.hits >= 3) { // Promote after 3 hits
      await this.setInL1(key, data, options);
    }
  }

  private async evictFromL1(): Promise<void> {
    // LRU eviction with priority consideration
    const entries = Array.from(this.l1Cache.entries());
    const sortedEntries = entries.sort((a, b) => {
      const aScore = a[1].metadata.accessed + (a[1].metadata.priority * 10000);
      const bScore = b[1].metadata.accessed + (b[1].metadata.priority * 10000);
      return aScore - bScore;
    });

    // Remove least recently used with lowest priority
    const toRemove = sortedEntries.slice(0, Math.ceil(sortedEntries.length * 0.1));
    toRemove.forEach(([key, entry]) => {
      this.l1Cache.delete(key);
      this.currentMemoryUsage.l1 -= entry.metadata.size;
    });

    logger.debug('L1 cache eviction completed', { evictedCount: toRemove.length });
  }

  private async evictFromL2(): Promise<void> {
    // Similar LRU eviction for L2
    const entries = Array.from(this.l2Cache.entries());
    const sortedEntries = entries.sort((a, b) => {
      const aScore = a[1].metadata.accessed + (a[1].metadata.priority * 10000);
      const bScore = b[1].metadata.accessed + (b[1].metadata.priority * 10000);
      return aScore - bScore;
    });

    const toRemove = sortedEntries.slice(0, Math.ceil(sortedEntries.length * 0.1));
    toRemove.forEach(([key, entry]) => {
      this.l2Cache.delete(key);
      this.currentMemoryUsage.l2 -= entry.metadata.size;
    });

    logger.debug('L2 cache eviction completed', { evictedCount: toRemove.length });
  }

  private isEntryValid(entry: CacheEntry): boolean {
    // Add TTL check if needed
    const now = Date.now();
    const maxAge = 300000; // 5 minutes default
    return now - entry.metadata.created < maxAge;
  }

  private calculateOptimalTTL(key: string, tags: string[]): number {
    // Intelligent TTL calculation based on key patterns and tags
    if (tags.includes('static')) return 3600; // 1 hour for static data
    if (tags.includes('dynamic')) return 300; // 5 minutes for dynamic data
    if (key.includes('search')) return 300; // 5 minutes for search results
    if (key.includes('user')) return 900; // 15 minutes for user data
    
    return 300; // Default 5 minutes
  }

  private shouldCompress(data: any): boolean {
    const size = this.estimateDataSize(data);
    return size > this.COMPRESSION_THRESHOLD;
  }

  private compress(data: any): any {
    // Simple compression simulation - in real implementation use gzip/brotli
    return JSON.stringify(data);
  }

  private decompress(data: any): any {
    // Simple decompression simulation
    return JSON.parse(data);
  }

  private estimateDataSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  private calculateCacheSize(cache: Map<string, CacheEntry>): number {
    return Array.from(cache.values()).reduce((total, entry) => total + entry.metadata.size, 0);
  }

  private mapPriorityToLevel(priority: number): 'high' | 'medium' | 'low' {
    if (priority >= 8) return 'high';
    if (priority >= 5) return 'medium';
    return 'low';
  }

  private mapPriorityToNumber(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 10;
      case 'medium': return 5;
      case 'low': return 1;
      default: return 5;
    }
  }

  private recordCacheHit(key: string, level: string, responseTime: number): void {
    const stats = this.cacheStats.get(key) || { hits: 0, misses: 0, lastAccess: 0 };
    stats.hits++;
    stats.lastAccess = Date.now();
    this.cacheStats.set(key, stats);

    redisMetrics.trackCacheHit(key, responseTime);
    this.recordPerformanceMetric(`hit_${level}`, responseTime);
  }

  private recordCacheMiss(key: string, reason: string, responseTime: number): void {
    const stats = this.cacheStats.get(key) || { hits: 0, misses: 0, lastAccess: 0 };
    stats.misses++;
    stats.lastAccess = Date.now();
    this.cacheStats.set(key, stats);

    redisMetrics.trackCacheMiss(key, responseTime);
    this.recordPerformanceMetric(`miss_${reason}`, responseTime);
  }

  private recordPerformanceMetric(operation: string, time: number): void {
    if (!this.performanceMetrics[operation]) {
      this.performanceMetrics[operation] = [];
    }
    
    this.performanceMetrics[operation].push(time);
    
    // Keep only recent metrics
    if (this.performanceMetrics[operation].length > 1000) {
      this.performanceMetrics[operation] = this.performanceMetrics[operation].slice(-1000);
    }
  }

  private calculateAverageResponseTime(): number {
    const allTimes = Object.values(this.performanceMetrics).flat();
    return allTimes.length > 0 ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length : 0;
  }

  private calculateEvictionRate(): number {
    // This would be calculated based on actual eviction events
    return 0.05; // 5% eviction rate example
  }

  private async findMatchingKeys(pattern: string): Promise<string[]> {
    const allKeys = new Set<string>();
    
    // Get keys from all cache levels
    this.l1Cache.forEach((_, key) => allKeys.add(key));
    this.l2Cache.forEach((_, key) => allKeys.add(key));
    
    // Get keys from Redis
    try {
      if (redisClient.isReady) {
        const redisKeys = await redisClient.keys(pattern);
        redisKeys.forEach(key => allKeys.add(key));
      }
    } catch (error) {
      logger.warn('Failed to get Redis keys for invalidation', { pattern, error: error.message });
    }

    // Filter by pattern (simple implementation - could use more sophisticated matching)
    return Array.from(allKeys).filter(key => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(key);
      }
      return key === pattern;
    });
  }

  private async invalidateKey(key: string, cascade: boolean, region?: string): Promise<void> {
    // Remove from all cache levels
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
    
    // Remove from Redis
    try {
      if (redisClient.isReady) {
        await redisClient.del(key);
      }
    } catch (error) {
      logger.warn('Failed to invalidate Redis key', { key, error: error.message });
    }

    // Handle cascading invalidation
    if (cascade) {
      const relatedKeys = await this.findRelatedKeys(key);
      for (const relatedKey of relatedKeys) {
        await this.invalidateKey(relatedKey, false, region);
      }
    }
  }

  private async findRelatedKeys(key: string): Promise<string[]> {
    // Find keys that are related to this key (by tags, patterns, etc.)
    const relatedKeys: string[] = [];
    
    // Check L1 cache for related entries
    this.l1Cache.forEach((entry, cacheKey) => {
      if (this.areKeysRelated(key, cacheKey, entry.metadata.tags)) {
        relatedKeys.push(cacheKey);
      }
    });

    return relatedKeys;
  }

  private areKeysRelated(key1: string, key2: string, tags: string[]): boolean {
    // Simple relation check - could be more sophisticated
    if (key1.startsWith('search:') && key2.startsWith('search:')) {
      return true;
    }
    
    if (tags.includes('user') && (key1.includes('user') || key2.includes('user'))) {
      return true;
    }

    return false;
  }

  private async setupInvalidationRules(): Promise<void> {
    this.invalidationRules = [
      {
        pattern: 'search:*',
        triggers: ['business_update', 'location_change'],
        cascade: true,
        delay: 0,
      },
      {
        pattern: 'user:*',
        triggers: ['user_update', 'profile_change'],
        cascade: false,
        delay: 5000, // 5 second delay for user data
      },
      {
        pattern: 'business:*',
        triggers: ['business_update', 'hours_change', 'location_change'],
        cascade: true,
        delay: 0,
      },
    ];
  }

  private async startCacheWarmingService(): Promise<void> {
    // Process cache warming queue every 30 seconds
    setInterval(() => {
      this.processCacheWarmingQueue();
    }, 30000);
  }

  private async processCacheWarmingQueue(): Promise<void> {
    if (this.cacheWarmingQueue.length === 0) return;

    const batch = this.cacheWarmingQueue.splice(0, this.CACHE_WARMING_BATCH_SIZE);
    const sortedBatch = batch.sort((a, b) => b.priority - a.priority);

    await this.warmCache(
      sortedBatch.map(item => ({
        key: item.key,
        generator: item.generator,
        priority: item.priority,
      }))
    );
  }

  private addToCacheWarmingQueue(
    key: string, 
    priority: number, 
    generator: () => Promise<any>
  ): void {
    this.cacheWarmingQueue.push({ key, priority, generator });
  }

  private async startPerformanceMonitoring(): Promise<void> {
    // Monitor performance metrics every minute
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60000);
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      
      logger.debug('Cache performance metrics', {
        hitRatio: Math.round(stats.hitRatio * 100),
        averageResponseTime: Math.round(stats.averageResponseTime * 100) / 100,
        memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024),
        totalRequests: stats.totalRequests,
      });

      // Alert on performance issues
      if (stats.hitRatio < 0.8) {
        logger.warn('Low cache hit ratio detected', { hitRatio: stats.hitRatio });
      }

      if (stats.averageResponseTime > 50) {
        logger.warn('High cache response time detected', { 
          averageResponseTime: stats.averageResponseTime 
        });
      }
    } catch (error) {
      logger.error('Performance metrics collection failed', { error: error.message });
    }
  }

  private async startGeographicReplication(): Promise<void> {
    // Implementation for multi-region cache replication
    // This would integrate with geographic distribution systems
  }

  private scheduleGeographicReplication<T>(
    key: string, 
    data: T, 
    config: CacheConfig
  ): void {
    // Schedule replication to other geographic regions
    setTimeout(async () => {
      try {
        await cacheManager.syncCacheAcrossRegions(key, data, config.ttl);
      } catch (error) {
        logger.warn('Geographic replication failed', { key, error: error.message });
      }
    }, this.GEOGRAPHIC_REPLICATION_DELAY);
  }

  private scheduleMaintenanceTasks(): void {
    // Cache cleanup every 5 minutes
    setInterval(() => {
      this.performMaintenance();
    }, 300000);
  }

  private async performMaintenance(): Promise<void> {
    logger.debug('🧹 Starting cache maintenance');
    
    try {
      // Clean expired entries
      await this.cleanExpiredEntries();
      
      // Optimize memory usage
      await this.optimizeMemoryUsage();
      
      // Update statistics
      await this.updateCacheStatistics();
      
      logger.debug('✅ Cache maintenance completed');
    } catch (error) {
      logger.error('Cache maintenance failed', { error: error.message });
    }
  }

  private async cleanExpiredEntries(): Promise<void> {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Clean L1 cache
    for (const [key, entry] of this.l1Cache) {
      if (now - entry.metadata.created > maxAge) {
        this.l1Cache.delete(key);
        this.currentMemoryUsage.l1 -= entry.metadata.size;
      }
    }
    
    // Clean L2 cache
    for (const [key, entry] of this.l2Cache) {
      if (now - entry.metadata.created > maxAge) {
        this.l2Cache.delete(key);
        this.currentMemoryUsage.l2 -= entry.metadata.size;
      }
    }
  }

  private async optimizeMemoryUsage(): Promise<void> {
    // Optimize memory usage based on current consumption
    if (this.currentMemoryUsage.l1 > this.L1_CACHE_SIZE * 0.8) {
      await this.evictFromL1();
    }
    
    if (this.currentMemoryUsage.l2 > this.L2_CACHE_SIZE * 0.8) {
      await this.evictFromL2();
    }
  }

  private async updateCacheStatistics(): Promise<void> {
    // Update internal statistics and send to monitoring
    const stats = await this.getCacheStats();
    
    performanceMonitoringService.recordMetric({
      timestamp: Date.now(),
      component: 'cache',
      operation: 'statistics',
      executionTime: 0,
      success: true,
      dataSize: stats.memoryUsage,
    });
  }

  private scheduleDelayedInvalidation(): void {
    // Process delayed invalidations
    setTimeout(() => {
      this.processDelayedInvalidations();
    }, 1000);
  }

  private async processDelayedInvalidations(): Promise<void> {
    const now = Date.now();
    const ready = this.invalidationQueue.filter(item => now >= item.delay);
    
    for (const item of ready) {
      await this.invalidateKey(item.key, false);
    }
    
    this.invalidationQueue = this.invalidationQueue.filter(item => now < item.delay);
  }
}

export const intelligentCacheManager = new IntelligentCacheManager();