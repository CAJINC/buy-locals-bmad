import { NextFunction, Request, Response } from 'express';
import { redisClient, redisMetrics } from '../config/redis.js';
import { performanceMonitoringService } from '../services/performanceMonitoringService.js';
import { logger } from '../utils/logger.js';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
  cacheHit?: boolean;
  queryCount?: number;
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
}

export class PerformanceMonitor {
  private static readonly PERFORMANCE_KEY_PREFIX = 'perf:metrics';
  private static readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private static readonly METRICS_RETENTION = 86400; // 24 hours

  /**
   * Express middleware for performance monitoring
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Store start time in request for downstream middleware
      (req as any).performanceStartTime = startTime;

      // Override end method to capture metrics
      const originalEnd = res.end;
      res.end = function (chunk?: any, encoding?: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Capture performance metrics
        const metrics: PerformanceMetrics = {
          endpoint: req.path,
          method: req.method,
          duration,
          timestamp: endTime,
          statusCode: res.statusCode,
          cacheHit: (res as any).cacheHit,
          queryCount: (req as any).queryCount,
          location: PerformanceMonitor.extractLocationFromRequest(req),
        };

        // Enhanced performance tracking
        const isSearchOperation = req.path.includes('/search') || req.path.includes('/location');
        const success = res.statusCode >= 200 && res.statusCode < 400;
        
        // Record in performance monitoring service
        performanceMonitoringService.recordMetric({
          timestamp: endTime,
          component: isSearchOperation ? 'search' : 'api',
          operation: `${req.method} ${req.path}`,
          executionTime: duration,
          success,
          cacheHit: (res as any).cacheHit === true,
          dataSize: JSON.stringify((res as any).responseBody || {}).length,
          userId: (req as any).user?.id,
          sessionId: req.sessionID,
          userAgent: req.get('User-Agent'),
          region: PerformanceMonitor.extractRegionFromRequest(req),
        });
        
        // Track specific search performance
        if (isSearchOperation && success && (res as any).responseBody?.businesses) {
          performanceMonitoringService.recordSearchPerformance(
            duration,
            (res as any).cacheHit === true,
            (res as any).responseBody.businesses.length || 0,
            (req as any).user?.id,
            req.query
          );
        }
        
        // Log slow queries with enhanced details
        if (duration > PerformanceMonitor.SLOW_QUERY_THRESHOLD) {
          logger.warn('Slow query detected', {
            ...metrics,
            threshold: PerformanceMonitor.SLOW_QUERY_THRESHOLD,
            requestId: (req as any).requestId,
            isSearchOperation,
            performanceScore: PerformanceMonitor.calculatePerformanceScore(duration, metrics.cacheHit || false),
          });
        }
        
        // Add performance headers
        res.setHeader('X-Response-Time', duration.toString());
        res.setHeader('X-Cache-Hit', (metrics.cacheHit || false).toString());
        res.setHeader('X-Performance-Score', PerformanceMonitor.calculatePerformanceScore(duration, metrics.cacheHit || false).toString());

        // Store metrics asynchronously
        PerformanceMonitor.recordMetrics(metrics).catch(error => {
          logger.error('Failed to record performance metrics', { error: error.message, requestId: (req as any).requestId });
        });

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Record performance metrics to Redis
   */
  private static async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      const key = `${this.PERFORMANCE_KEY_PREFIX}:${Date.now()}`;

      await Promise.all([
        // Store individual metric
        redisClient.setEx(key, this.METRICS_RETENTION, JSON.stringify(metrics)),

        // Update endpoint performance statistics
        this.updateEndpointStats(metrics),

        // Update location-based performance stats
        this.updateLocationStats(metrics),
      ]);
    } catch (error) {
      console.error('Performance metrics recording error:', error);
    }
  }

  /**
   * Update endpoint-specific performance statistics
   */
  private static async updateEndpointStats(metrics: PerformanceMetrics): Promise<void> {
    const endpointKey = `${this.PERFORMANCE_KEY_PREFIX}:endpoint:${metrics.method}:${metrics.endpoint}`;

    try {
      // Use Redis pipeline for atomic updates
      const pipeline = redisClient.multi();

      // Update running averages and counters
      pipeline.hIncrBy(endpointKey, 'total_requests', 1);
      pipeline.hIncrBy(endpointKey, 'total_duration', metrics.duration);

      if (metrics.statusCode >= 200 && metrics.statusCode < 300) {
        pipeline.hIncrBy(endpointKey, 'success_count', 1);
      } else {
        pipeline.hIncrBy(endpointKey, 'error_count', 1);
      }

      if (metrics.cacheHit) {
        pipeline.hIncrBy(endpointKey, 'cache_hits', 1);
      } else {
        pipeline.hIncrBy(endpointKey, 'cache_misses', 1);
      }

      // Track slow queries
      if (metrics.duration > this.SLOW_QUERY_THRESHOLD) {
        pipeline.hIncrBy(endpointKey, 'slow_queries', 1);
      }

      // Set expiration
      pipeline.expire(endpointKey, this.METRICS_RETENTION);

      await pipeline.exec();
    } catch (error) {
      console.error('Endpoint stats update error:', error);
    }
  }

  /**
   * Update location-based performance statistics for spatial queries
   */
  private static async updateLocationStats(metrics: PerformanceMetrics): Promise<void> {
    if (!metrics.location) return;

    const { lat, lng, radius } = metrics.location;

    // Create geographic grid key for regional performance tracking
    const gridLat = Math.round(lat * 10) / 10; // 0.1 degree precision (~11km)
    const gridLng = Math.round(lng * 10) / 10;
    const locationKey = `${this.PERFORMANCE_KEY_PREFIX}:location:${gridLat}:${gridLng}`;

    try {
      const pipeline = redisClient.multi();

      pipeline.hIncrBy(locationKey, 'total_searches', 1);
      pipeline.hIncrBy(locationKey, 'total_duration', metrics.duration);
      pipeline.hSet(locationKey, 'avg_radius', radius);
      pipeline.hSet(locationKey, 'last_search', metrics.timestamp);

      if (metrics.cacheHit) {
        pipeline.hIncrBy(locationKey, 'cache_hits', 1);
      }

      pipeline.expire(locationKey, this.METRICS_RETENTION);

      await pipeline.exec();
    } catch (error) {
      console.error('Location stats update error:', error);
    }
  }

  /**
   * Extract location parameters from request for location-based endpoints
   */
  private static extractLocationFromRequest(
    req: Request
  ): { lat: number; lng: number; radius: number } | undefined {
    const { lat, lng, radius } = req.query;

    if (typeof lat === 'string' && typeof lng === 'string') {
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: typeof radius === 'string' ? parseFloat(radius) : 25,
      };
    }

    return undefined;
  }
  
  /**
   * Extract region from request headers and coordinates
   */
  private static extractRegionFromRequest(req: Request): string {
    // Extract region from various sources
    const cloudflareCountry = req.headers['cf-ipcountry'] as string;
    const awsRegion = req.headers['cloudfront-viewer-country'] as string;
    const geoIP = req.headers['x-geo-country'] as string;
    
    // Use query parameters for location-based requests
    if (req.query.lat && req.query.lng) {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Simple US region detection
        if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
          if (lat >= 40 && lng >= -125 && lng <= -95) return 'us-west';
          if (lat >= 40 && lng >= -95 && lng <= -66) return 'us-east';
          if (lat < 40 && lng >= -125 && lng <= -95) return 'us-southwest';
          if (lat < 40 && lng >= -95 && lng <= -66) return 'us-southeast';
        }
        return 'international';
      }
    }
    
    // Fallback to header-based detection
    const country = cloudflareCountry || awsRegion || geoIP;
    if (country === 'US') {
      return 'us-unknown';
    } else if (country) {
      return country.toLowerCase();
    }
    
    return 'unknown';
  }
  
  /**
   * Calculate performance score (0-100)
   */
  private static calculatePerformanceScore(responseTime: number, cacheHit: boolean): number {
    let score = 100;
    
    // Deduct points for slow response
    if (responseTime > 100) score -= Math.min(50, (responseTime - 100) / 10);
    
    // Bonus points for cache hits
    if (cacheHit) score += 10;
    
    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get performance statistics for monitoring dashboard
   */
  static async getPerformanceStats(_timeWindow: number = 3600): Promise<{
    overallStats: {
      totalRequests: number;
      averageResponseTime: number;
      errorRate: number;
      cacheHitRate: number;
      slowQueryRate: number;
    };
    endpointStats: Array<{
      endpoint: string;
      method: string;
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
      cacheHitRate: number;
    }>;
    locationStats: Array<{
      location: { lat: number; lng: number };
      searchCount: number;
      averageResponseTime: number;
      cacheHitRate: number;
    }>;
  }> {
    try {
      if (!redisClient.isReady) {
        throw new Error('Redis not available');
      }

      // Get all endpoint keys
      const endpointKeys = await redisClient.keys(`${this.PERFORMANCE_KEY_PREFIX}:endpoint:*`);
      const locationKeys = await redisClient.keys(`${this.PERFORMANCE_KEY_PREFIX}:location:*`);

      // Get endpoint statistics
      const endpointStats = await Promise.all(
        endpointKeys.map(async key => {
          const stats = await redisClient.hGetAll(key);
          const [, , method, ...endpointParts] = key.split(':');
          const endpoint = endpointParts.join(':');

          const totalRequests = parseInt(stats.total_requests || '0');
          const totalDuration = parseInt(stats.total_duration || '0');
          // Success count parsing for future use
          const errorCount = parseInt(stats.error_count || '0');
          const cacheHits = parseInt(stats.cache_hits || '0');
          const cacheMisses = parseInt(stats.cache_misses || '0');

          return {
            endpoint,
            method,
            requestCount: totalRequests,
            averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
            errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
            cacheHitRate: cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0,
          };
        })
      );

      // Get location statistics
      const locationStats = await Promise.all(
        locationKeys.map(async key => {
          const stats = await redisClient.hGetAll(key);
          const [, , lat, lng] = key.split(':');

          const totalSearches = parseInt(stats.total_searches || '0');
          const totalDuration = parseInt(stats.total_duration || '0');
          const cacheHits = parseInt(stats.cache_hits || '0');

          return {
            location: { lat: parseFloat(lat), lng: parseFloat(lng) },
            searchCount: totalSearches,
            averageResponseTime: totalSearches > 0 ? totalDuration / totalSearches : 0,
            cacheHitRate: totalSearches > 0 ? cacheHits / totalSearches : 0,
          };
        })
      );

      // Calculate overall statistics
      const overallStats = endpointStats.reduce(
        (acc, stat) => ({
          totalRequests: acc.totalRequests + stat.requestCount,
          totalDuration: acc.totalDuration + stat.averageResponseTime * stat.requestCount,
          totalErrors: acc.totalErrors + stat.errorRate * stat.requestCount,
          totalCacheHits: acc.totalCacheHits + stat.cacheHitRate * stat.requestCount,
        }),
        { totalRequests: 0, totalDuration: 0, totalErrors: 0, totalCacheHits: 0 }
      );

      return {
        overallStats: {
          totalRequests: overallStats.totalRequests,
          averageResponseTime:
            overallStats.totalRequests > 0
              ? overallStats.totalDuration / overallStats.totalRequests
              : 0,
          errorRate:
            overallStats.totalRequests > 0
              ? overallStats.totalErrors / overallStats.totalRequests
              : 0,
          cacheHitRate:
            overallStats.totalRequests > 0
              ? overallStats.totalCacheHits / overallStats.totalRequests
              : 0,
          slowQueryRate: 0, // Would need additional calculation
        },
        endpointStats: endpointStats.sort((a, b) => b.requestCount - a.requestCount),
        locationStats: locationStats.sort((a, b) => b.searchCount - a.searchCount),
      };
    } catch (error) {
      console.error('Performance stats retrieval error:', error);
      throw error;
    }
  }

  /**
   * Alert on performance thresholds
   */
  static async checkPerformanceAlerts(): Promise<void> {
    try {
      const stats = await this.getPerformanceStats();

      // Check overall performance
      if (stats.overallStats.averageResponseTime > this.SLOW_QUERY_THRESHOLD) {
        logger.warn('System performance alert', {
          averageResponseTime: stats.overallStats.averageResponseTime,
          threshold: this.SLOW_QUERY_THRESHOLD,
          errorRate: stats.overallStats.errorRate,
          cacheHitRate: stats.overallStats.cacheHitRate,
          component: 'performance-monitor',
          alertType: 'system-degradation',
        });
      }

      // Check endpoint-specific performance
      stats.endpointStats.forEach(endpoint => {
        if (endpoint.averageResponseTime > this.SLOW_QUERY_THRESHOLD) {
          logger.warn('Endpoint performance alert', {
            endpoint: `${endpoint.method} ${endpoint.endpoint}`,
            averageResponseTime: endpoint.averageResponseTime,
            requestCount: endpoint.requestCount,
            errorRate: endpoint.errorRate,
            component: 'performance-monitor',
            alertType: 'endpoint-degradation',
          });
        }
      });
      
      // Check cache hit rate
      if (stats.overallStats.cacheHitRate < 0.8) {
        logger.warn('Low cache hit rate alert', {
          cacheHitRate: stats.overallStats.cacheHitRate,
          threshold: 0.8,
          component: 'performance-monitor',
          alertType: 'cache-degradation',
        });
      }
    } catch (error) {
      console.error('Performance alert check error:', error);
    }
  }
}

// Export middleware function
export const performanceMonitoring = PerformanceMonitor.middleware();
