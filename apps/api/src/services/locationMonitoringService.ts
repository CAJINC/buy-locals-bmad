import { redisClient } from '../config/redis.js';

export interface LocationSearchMetrics {
  totalSearches: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  errorRate: number;
  performanceDistribution: {
    excellent: number; // <50ms
    good: number;      // 50-200ms
    acceptable: number; // 200-500ms
    poor: number;      // >500ms
  };
  popularSearchAreas: Array<{
    lat: number;
    lng: number;
    count: number;
    averageRadius: number;
  }>;
}

export interface LocationAlert {
  id: string;
  type: 'performance' | 'error' | 'cache' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  metadata: any;
  resolved: boolean;
}

export interface PerformanceThresholds {
  maxExecutionTimeMs: number;
  minCacheHitRate: number;
  maxErrorRate: number;
  maxConcurrentSearches: number;
}

class LocationMonitoringService {
  private readonly METRICS_PREFIX = 'location_metrics';
  private readonly ALERTS_PREFIX = 'location_alerts';
  private readonly THRESHOLDS: PerformanceThresholds = {
    maxExecutionTimeMs: 1000,
    minCacheHitRate: 0.7,
    maxErrorRate: 0.05,
    maxConcurrentSearches: 100
  };

  /**
   * Record a location search execution
   */
  async recordSearchExecution(
    executionTimeMs: number,
    cacheHit: boolean,
    error: boolean,
    searchParams: {
      lat: number;
      lng: number;
      radius?: number;
      category?: string[];
      search?: string;
    }
  ): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      const timestamp = Date.now();
      const hour = new Date().getHours();
      const date = new Date().toISOString().split('T')[0];

      // Update metrics
      const promises = [
        // Total searches counter
        redisClient.incr(`${this.METRICS_PREFIX}:total_searches:${date}`),
        redisClient.incr(`${this.METRICS_PREFIX}:total_searches:${date}:${hour}`),
        
        // Execution time tracking
        redisClient.lpush(
          `${this.METRICS_PREFIX}:execution_times:${date}`,
          executionTimeMs.toString()
        ),
        
        // Cache hit tracking
        redisClient.incr(
          `${this.METRICS_PREFIX}:${cacheHit ? 'cache_hits' : 'cache_misses'}:${date}`
        ),
        
        // Error tracking
        error && redisClient.incr(`${this.METRICS_PREFIX}:errors:${date}`),
        
        // Popular search locations
        this.recordPopularLocation(searchParams.lat, searchParams.lng, searchParams.radius || 25),
        
        // Performance distribution
        this.recordPerformanceBucket(executionTimeMs, date)
      ];

      await Promise.all(promises.filter(Boolean));

      // Set TTL on daily metrics (keep for 30 days)
      await Promise.all([
        redisClient.expire(`${this.METRICS_PREFIX}:total_searches:${date}`, 30 * 24 * 3600),
        redisClient.expire(`${this.METRICS_PREFIX}:execution_times:${date}`, 30 * 24 * 3600),
        redisClient.expire(`${this.METRICS_PREFIX}:cache_hits:${date}`, 30 * 24 * 3600),
        redisClient.expire(`${this.METRICS_PREFIX}:cache_misses:${date}`, 30 * 24 * 3600),
        redisClient.expire(`${this.METRICS_PREFIX}:errors:${date}`, 30 * 24 * 3600)
      ]);

      // Check if we need to trigger alerts
      await this.checkAndTriggerAlerts({
        executionTimeMs,
        cacheHit,
        error,
        timestamp
      });

    } catch (monitoringError) {
      console.error('Failed to record search metrics:', monitoringError);
      // Don't let monitoring errors affect the main functionality
    }
  }

  /**
   * Record performance bucket distribution
   */
  private async recordPerformanceBucket(executionTimeMs: number, date: string): Promise<void> {
    let bucket: string;
    
    if (executionTimeMs < 50) {
      bucket = 'excellent';
    } else if (executionTimeMs < 200) {
      bucket = 'good';
    } else if (executionTimeMs < 500) {
      bucket = 'acceptable';
    } else {
      bucket = 'poor';
    }

    await redisClient.incr(`${this.METRICS_PREFIX}:perf_${bucket}:${date}`);
    await redisClient.expire(`${this.METRICS_PREFIX}:perf_${bucket}:${date}`, 30 * 24 * 3600);
  }

  /**
   * Record popular search locations
   */
  private async recordPopularLocation(lat: number, lng: number, radius: number): Promise<void> {
    try {
      // Round coordinates to create location clusters
      const roundedLat = Math.round(lat * 100) / 100; // ~1km precision
      const roundedLng = Math.round(lng * 100) / 100;
      const locationKey = `${roundedLat},${roundedLng}`;
      
      const date = new Date().toISOString().split('T')[0];
      
      await Promise.all([
        redisClient.zincrby(`${this.METRICS_PREFIX}:popular_locations:${date}`, 1, locationKey),
        redisClient.hset(
          `${this.METRICS_PREFIX}:location_radii:${date}`,
          locationKey,
          radius.toString()
        ),
        redisClient.expire(`${this.METRICS_PREFIX}:popular_locations:${date}`, 30 * 24 * 3600),
        redisClient.expire(`${this.METRICS_PREFIX}:location_radii:${date}`, 30 * 24 * 3600)
      ]);
    } catch (error) {
      console.error('Failed to record popular location:', error);
    }
  }

  /**
   * Get current location search metrics
   */
  async getLocationSearchMetrics(days: number = 7): Promise<LocationSearchMetrics> {
    try {
      if (!redisClient.isReady) {
        return this.getEmptyMetrics();
      }

      const dates = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const metrics = await this.aggregateMetrics(dates);
      return metrics;
    } catch (error) {
      console.error('Failed to get location metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Aggregate metrics across multiple dates
   */
  private async aggregateMetrics(dates: string[]): Promise<LocationSearchMetrics> {
    const promises = dates.map(date => this.getMetricsForDate(date));
    const dailyMetrics = await Promise.all(promises);

    // Aggregate all metrics
    let totalSearches = 0;
    let totalExecutionTime = 0;
    let totalExecutionSamples = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    let totalErrors = 0;
    const performanceDistribution = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0
    };
    const locationCounts = new Map<string, number>();

    for (const dayMetrics of dailyMetrics) {
      totalSearches += dayMetrics.totalSearches;
      totalExecutionTime += dayMetrics.totalExecutionTime;
      totalExecutionSamples += dayMetrics.executionSamples;
      totalCacheHits += dayMetrics.cacheHits;
      totalCacheMisses += dayMetrics.cacheMisses;
      totalErrors += dayMetrics.errors;

      performanceDistribution.excellent += dayMetrics.performanceDistribution.excellent;
      performanceDistribution.good += dayMetrics.performanceDistribution.good;
      performanceDistribution.acceptable += dayMetrics.performanceDistribution.acceptable;
      performanceDistribution.poor += dayMetrics.performanceDistribution.poor;

      // Merge location counts
      for (const [location, count] of dayMetrics.popularLocations) {
        locationCounts.set(location, (locationCounts.get(location) || 0) + count);
      }
    }

    // Calculate derived metrics
    const averageExecutionTime = totalExecutionSamples > 0 
      ? totalExecutionTime / totalExecutionSamples 
      : 0;
    
    const cacheHitRate = (totalCacheHits + totalCacheMisses) > 0
      ? totalCacheHits / (totalCacheHits + totalCacheMisses)
      : 0;
    
    const errorRate = totalSearches > 0
      ? totalErrors / totalSearches
      : 0;

    // Top popular search areas
    const popularSearchAreas = Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => {
        const [lat, lng] = location.split(',').map(Number);
        return {
          lat,
          lng,
          count,
          averageRadius: 25 // Default, could be calculated from stored radii
        };
      });

    return {
      totalSearches,
      averageExecutionTime,
      cacheHitRate,
      errorRate,
      performanceDistribution,
      popularSearchAreas
    };
  }

  /**
   * Get metrics for a specific date
   */
  private async getMetricsForDate(date: string): Promise<{
    totalSearches: number;
    totalExecutionTime: number;
    executionSamples: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
    performanceDistribution: {
      excellent: number;
      good: number;
      acceptable: number;
      poor: number;
    };
    popularLocations: Map<string, number>;
  }> {
    try {
      const [
        totalSearches,
        executionTimes,
        cacheHits,
        cacheMisses,
        errors,
        perfExcellent,
        perfGood,
        perfAcceptable,
        perfPoor,
        popularLocations
      ] = await Promise.all([
        redisClient.get(`${this.METRICS_PREFIX}:total_searches:${date}`).then(val => parseInt(val || '0')),
        redisClient.lrange(`${this.METRICS_PREFIX}:execution_times:${date}`, 0, -1),
        redisClient.get(`${this.METRICS_PREFIX}:cache_hits:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:cache_misses:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:errors:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:perf_excellent:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:perf_good:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:perf_acceptable:${date}`).then(val => parseInt(val || '0')),
        redisClient.get(`${this.METRICS_PREFIX}:perf_poor:${date}`).then(val => parseInt(val || '0')),
        redisClient.zrevrange(`${this.METRICS_PREFIX}:popular_locations:${date}`, 0, 9, 'WITHSCORES')
      ]);

      const totalExecutionTime = executionTimes.reduce((sum, time) => sum + parseInt(time), 0);
      const popularLocationsMap = new Map<string, number>();
      
      for (let i = 0; i < popularLocations.length; i += 2) {
        const location = popularLocations[i];
        const count = parseInt(popularLocations[i + 1]);
        popularLocationsMap.set(location, count);
      }

      return {
        totalSearches,
        totalExecutionTime,
        executionSamples: executionTimes.length,
        cacheHits,
        cacheMisses,
        errors,
        performanceDistribution: {
          excellent: perfExcellent,
          good: perfGood,
          acceptable: perfAcceptable,
          poor: perfPoor
        },
        popularLocations: popularLocationsMap
      };
    } catch (error) {
      console.error(`Failed to get metrics for date ${date}:`, error);
      return {
        totalSearches: 0,
        totalExecutionTime: 0,
        executionSamples: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        performanceDistribution: { excellent: 0, good: 0, acceptable: 0, poor: 0 },
        popularLocations: new Map()
      };
    }
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  private async checkAndTriggerAlerts(params: {
    executionTimeMs: number;
    cacheHit: boolean;
    error: boolean;
    timestamp: number;
  }): Promise<void> {
    const { executionTimeMs, cacheHit, error, timestamp } = params;

    // Performance alert
    if (executionTimeMs > this.THRESHOLDS.maxExecutionTimeMs) {
      await this.createAlert({
        type: 'performance',
        severity: executionTimeMs > 2000 ? 'high' : 'medium',
        title: 'Location Search Performance Degraded',
        description: `Search execution time ${executionTimeMs}ms exceeds threshold ${this.THRESHOLDS.maxExecutionTimeMs}ms`,
        metadata: { executionTimeMs, threshold: this.THRESHOLDS.maxExecutionTimeMs }
      });
    }

    // Error alert
    if (error) {
      await this.createAlert({
        type: 'error',
        severity: 'medium',
        title: 'Location Search Error',
        description: 'Location search request failed',
        metadata: { timestamp }
      });
    }

    // Check aggregated metrics for system-wide issues
    await this.checkAggregatedAlerts();
  }

  /**
   * Check for system-wide performance issues
   */
  private async checkAggregatedAlerts(): Promise<void> {
    try {
      const recentMetrics = await this.getLocationSearchMetrics(1); // Last day

      // Cache hit rate alert
      if (recentMetrics.cacheHitRate < this.THRESHOLDS.minCacheHitRate && recentMetrics.totalSearches > 10) {
        await this.createAlert({
          type: 'cache',
          severity: 'medium',
          title: 'Low Cache Hit Rate',
          description: `Cache hit rate ${(recentMetrics.cacheHitRate * 100).toFixed(1)}% is below threshold ${(this.THRESHOLDS.minCacheHitRate * 100)}%`,
          metadata: { 
            cacheHitRate: recentMetrics.cacheHitRate,
            threshold: this.THRESHOLDS.minCacheHitRate,
            totalSearches: recentMetrics.totalSearches
          }
        });
      }

      // Error rate alert
      if (recentMetrics.errorRate > this.THRESHOLDS.maxErrorRate && recentMetrics.totalSearches > 10) {
        await this.createAlert({
          type: 'error',
          severity: recentMetrics.errorRate > 0.1 ? 'high' : 'medium',
          title: 'High Error Rate',
          description: `Error rate ${(recentMetrics.errorRate * 100).toFixed(1)}% is above threshold ${(this.THRESHOLDS.maxErrorRate * 100)}%`,
          metadata: {
            errorRate: recentMetrics.errorRate,
            threshold: this.THRESHOLDS.maxErrorRate,
            totalSearches: recentMetrics.totalSearches
          }
        });
      }

      // Average performance alert
      if (recentMetrics.averageExecutionTime > this.THRESHOLDS.maxExecutionTimeMs && recentMetrics.totalSearches > 10) {
        await this.createAlert({
          type: 'performance',
          severity: 'medium',
          title: 'Average Performance Degraded',
          description: `Average execution time ${recentMetrics.averageExecutionTime.toFixed(0)}ms exceeds threshold`,
          metadata: {
            averageExecutionTime: recentMetrics.averageExecutionTime,
            threshold: this.THRESHOLDS.maxExecutionTimeMs,
            totalSearches: recentMetrics.totalSearches
          }
        });
      }

    } catch (error) {
      console.error('Failed to check aggregated alerts:', error);
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(alert: Omit<LocationAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const alertWithId: LocationAlert = {
        ...alert,
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        resolved: false
      };

      // Store alert in Redis
      await redisClient.hset(
        `${this.ALERTS_PREFIX}:active`,
        alertWithId.id,
        JSON.stringify(alertWithId)
      );

      // Add to alerts timeline
      await redisClient.zadd(
        `${this.ALERTS_PREFIX}:timeline`,
        Date.now(),
        alertWithId.id
      );

      // Set TTL on timeline (keep for 90 days)
      await redisClient.expire(`${this.ALERTS_PREFIX}:timeline`, 90 * 24 * 3600);

      // Log alert
      console.warn('Location Search Alert:', {
        id: alertWithId.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description
      });

      // In production, this would integrate with alerting systems like:
      // - PagerDuty
      // - Slack notifications
      // - Email alerts
      // - DataDog alerts
      await this.sendToExternalAlertingSystems(alertWithId);

    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Send alert to external systems
   */
  private async sendToExternalAlertingSystems(alert: LocationAlert): Promise<void> {
    // This would integrate with your alerting infrastructure
    // For now, we'll just log the alert
    
    if (alert.severity === 'high' || alert.severity === 'critical') {
      // High severity alerts would trigger immediate notifications
      console.error('HIGH SEVERITY ALERT:', alert);
    }

    // Could integrate with:
    // - Webhook to Slack
    // - PagerDuty API
    // - Email service
    // - Push notifications
    // - CloudWatch alarms
    // - DataDog alerts
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<LocationAlert[]> {
    try {
      if (!redisClient.isReady) return [];

      const alertData = await redisClient.hgetall(`${this.ALERTS_PREFIX}:active`);
      
      return Object.values(alertData)
        .map(data => JSON.parse(data) as LocationAlert)
        .filter(alert => !alert.resolved)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      if (!redisClient.isReady) return false;

      const alertData = await redisClient.hget(`${this.ALERTS_PREFIX}:active`, alertId);
      if (!alertData) return false;

      const alert: LocationAlert = JSON.parse(alertData);
      alert.resolved = true;

      await redisClient.hset(
        `${this.ALERTS_PREFIX}:active`,
        alertId,
        JSON.stringify(alert)
      );

      return true;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      return false;
    }
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics(): LocationSearchMetrics {
    return {
      totalSearches: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      performanceDistribution: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        poor: 0
      },
      popularSearchAreas: []
    };
  }
}

export const locationMonitoringService = new LocationMonitoringService();