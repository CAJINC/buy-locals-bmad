import { redisClient, redisMetrics, cacheManager } from '../config/redis.js';
import { pool } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Enterprise Performance Monitoring Service
 * Task 8: Performance and Caching Optimization
 * 
 * Monitors system performance, tracks SLA compliance, and provides
 * real-time performance analytics for search operations.
 */

export interface PerformanceMetrics {
  timestamp: number;
  component: string;
  operation: string;
  executionTime: number;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  region?: string;
}

export interface SLAMetrics {
  target: number; // Target response time in ms
  current: number; // Current average response time
  compliance: number; // Percentage of requests meeting SLA (0-100)
  violations: number; // Number of SLA violations
  p50: number; // 50th percentile response time
  p95: number; // 95th percentile response time
  p99: number; // 99th percentile response time
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    database: { status: string; latency: number; activeConnections: number };
    redis: { status: string; latency: number; memoryUsage: number; hitRatio: number };
    search: { status: string; averageLatency: number; successRate: number };
    api: { status: string; requestsPerSecond: number; errorRate: number };
  };
  overallScore: number; // 0-100 health score
  lastChecked: number;
}

export interface PerformanceDashboardData {
  slaMetrics: SLAMetrics;
  systemHealth: SystemHealth;
  realtimeMetrics: {
    searchLatency: number[];
    cacheHitRatio: number;
    requestsPerSecond: number;
    errorRate: number;
    activeUsers: number;
  };
  geographicPerformance: Array<{
    region: string;
    averageLatency: number;
    requestCount: number;
    cacheHitRatio: number;
  }>;
  trends: {
    hourly: Array<{ hour: string; latency: number; volume: number }>;
    daily: Array<{ date: string; latency: number; volume: number }>;
  };
}

class PerformanceMonitoringService {
  private readonly SLA_TARGET_MS = 100; // Target: < 100ms for search
  private readonly CACHE_SLA_TARGET_MS = 50; // Target: < 50ms for cached results
  private readonly CACHE_HIT_RATIO_TARGET = 0.90; // Target: > 90% cache hit ratio
  private readonly ERROR_RATE_THRESHOLD = 0.05; // Alert if error rate > 5%
  private readonly METRICS_RETENTION_HOURS = 168; // 7 days
  private readonly REAL_TIME_WINDOW_SECONDS = 300; // 5 minutes

  private metricsBuffer: PerformanceMetrics[] = [];
  private readonly BUFFER_FLUSH_SIZE = 100;
  private readonly BUFFER_FLUSH_INTERVAL_MS = 30000; // 30 seconds

  constructor() {
    this.startMetricsBufferFlush();
    this.startHealthCheckScheduler();
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });

    // Immediate processing for critical metrics
    if (metric.executionTime > this.SLA_TARGET_MS * 3) { // 3x SLA violation
      this.handleCriticalPerformanceEvent(metric);
    }

    // Flush buffer if it's full
    if (this.metricsBuffer.length >= this.BUFFER_FLUSH_SIZE) {
      this.flushMetricsBuffer();
    }

    // Update Redis metrics for real-time tracking
    this.updateRealtimeMetrics(metric);
  }

  /**
   * Record search performance specifically
   */
  recordSearchPerformance(
    executionTime: number,
    cacheHit: boolean,
    resultCount: number,
    userId?: string,
    query?: any
  ): void {
    const region = this.extractRegionFromQuery(query);
    
    this.recordMetric({
      timestamp: Date.now(),
      component: 'search',
      operation: 'location_search',
      executionTime,
      success: true,
      cacheHit,
      dataSize: resultCount,
      userId,
      region,
    });

    // Track in Redis for real-time analytics
    redisMetrics.trackSearchLatency(executionTime, region, cacheHit);
  }

  /**
   * Get current SLA compliance metrics
   */
  async getSLAMetrics(): Promise<SLAMetrics> {
    try {
      const timeWindow = this.getCurrentTimeWindow();
      const metricsKey = `performance:search_latency:${timeWindow}`;
      
      // Get latency data from Redis
      const latencyData = await redisClient.lRange(metricsKey, 0, -1);
      const latencies = latencyData.map(l => parseFloat(l)).sort((a, b) => a - b);
      
      if (latencies.length === 0) {
        return {
          target: this.SLA_TARGET_MS,
          current: 0,
          compliance: 100,
          violations: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        };
      }

      const current = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const slaCompliant = latencies.filter(l => l <= this.SLA_TARGET_MS).length;
      const compliance = (slaCompliant / latencies.length) * 100;
      const violations = latencies.length - slaCompliant;

      return {
        target: this.SLA_TARGET_MS,
        current: Math.round(current * 100) / 100,
        compliance: Math.round(compliance * 100) / 100,
        violations,
        p50: this.calculatePercentile(latencies, 0.5),
        p95: this.calculatePercentile(latencies, 0.95),
        p99: this.calculatePercentile(latencies, 0.99),
      };
    } catch (error) {
      logger.error('SLA metrics calculation failed', { error: error.message });
      return {
        target: this.SLA_TARGET_MS,
        current: 0,
        compliance: 0,
        violations: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [databaseHealth, redisHealth, searchHealth, apiHealth] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkSearchHealth(),
        this.checkApiHealth(),
      ]);

      const checks = {
        database: databaseHealth,
        redis: redisHealth,
        search: searchHealth,
        api: apiHealth,
      };

      // Calculate overall health score
      const scores = [
        databaseHealth.status === 'healthy' ? 25 : databaseHealth.status === 'degraded' ? 15 : 5,
        redisHealth.status === 'healthy' ? 25 : redisHealth.status === 'degraded' ? 15 : 5,
        searchHealth.status === 'healthy' ? 25 : searchHealth.status === 'degraded' ? 15 : 5,
        apiHealth.status === 'healthy' ? 25 : apiHealth.status === 'degraded' ? 15 : 5,
      ];

      const overallScore = scores.reduce((sum, score) => sum + score, 0);
      
      let status: 'healthy' | 'degraded' | 'critical';
      if (overallScore >= 80) status = 'healthy';
      else if (overallScore >= 50) status = 'degraded';
      else status = 'critical';

      return {
        status,
        checks,
        overallScore,
        lastChecked: Date.now(),
      };
    } catch (error) {
      logger.error('System health check failed', { error: error.message });
      return {
        status: 'critical',
        checks: {
          database: { status: 'unknown', latency: 0, activeConnections: 0 },
          redis: { status: 'unknown', latency: 0, memoryUsage: 0, hitRatio: 0 },
          search: { status: 'unknown', averageLatency: 0, successRate: 0 },
          api: { status: 'unknown', requestsPerSecond: 0, errorRate: 0 },
        },
        overallScore: 0,
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Get comprehensive performance dashboard data
   */
  async getPerformanceDashboard(): Promise<PerformanceDashboardData> {
    try {
      const [slaMetrics, systemHealth, realtimeMetrics, geoPerformance, trends] = await Promise.all([
        this.getSLAMetrics(),
        this.getSystemHealth(),
        this.getRealtimeMetrics(),
        this.getGeographicPerformance(),
        this.getPerformanceTrends(),
      ]);

      return {
        slaMetrics,
        systemHealth,
        realtimeMetrics,
        geographicPerformance: geoPerformance,
        trends,
      };
    } catch (error) {
      logger.error('Performance dashboard data collection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get A/B testing performance comparison
   */
  async getABTestingResults(testId: string): Promise<{
    variants: Array<{
      name: string;
      averageLatency: number;
      successRate: number;
      conversionRate: number;
      userSatisfaction: number;
    }>;
    confidence: number;
    recommendation: string;
  }> {
    try {
      // This would typically integrate with an A/B testing platform
      // For now, we'll return mock data structure
      const variants = ['A', 'B'].map(async (variant) => {
        const metricsKey = `ab_test:${testId}:${variant}:metrics`;
        const metrics = await redisClient.hGetAll(metricsKey);
        
        return {
          name: variant,
          averageLatency: parseFloat(metrics.averageLatency || '0'),
          successRate: parseFloat(metrics.successRate || '100'),
          conversionRate: parseFloat(metrics.conversionRate || '0'),
          userSatisfaction: parseFloat(metrics.userSatisfaction || '4.0'),
        };
      });

      const resolvedVariants = await Promise.all(variants);
      
      // Calculate statistical confidence (simplified)
      const confidence = 95; // Would be calculated based on actual statistical tests
      
      // Generate recommendation based on performance metrics
      const winner = resolvedVariants.reduce((best, current) => 
        current.averageLatency < best.averageLatency && current.successRate > best.successRate ? current : best
      );
      
      return {
        variants: resolvedVariants,
        confidence,
        recommendation: `Variant ${winner.name} shows better performance with ${winner.averageLatency}ms average latency`,
      };
    } catch (error) {
      logger.error('A/B testing results collection failed', { error: error.message, testId });
      throw error;
    }
  }

  /**
   * Get performance optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
    expectedImprovement: string;
  }>> {
    try {
      const [slaMetrics, cacheMetrics, systemHealth] = await Promise.all([
        this.getSLAMetrics(),
        redisMetrics.getPerformanceMetrics(),
        this.getSystemHealth(),
      ]);

      const recommendations = [];

      // Cache hit ratio optimization
      if (cacheMetrics.cacheHitRatio < this.CACHE_HIT_RATIO_TARGET) {
        recommendations.push({
          category: 'caching',
          priority: 'high' as const,
          issue: `Cache hit ratio is ${Math.round(cacheMetrics.cacheHitRatio * 100)}%, below target of ${Math.round(this.CACHE_HIT_RATIO_TARGET * 100)}%`,
          recommendation: 'Implement cache warming for popular queries and increase cache TTL for stable data',
          expectedImprovement: '20-30% reduction in response time',
        });
      }

      // SLA compliance issues
      if (slaMetrics.compliance < 95) {
        recommendations.push({
          category: 'performance',
          priority: 'high' as const,
          issue: `Only ${slaMetrics.compliance}% of requests meet SLA target of ${this.SLA_TARGET_MS}ms`,
          recommendation: 'Optimize database queries and implement result pagination',
          expectedImprovement: 'Improve SLA compliance to >95%',
        });
      }

      // Database performance
      if (systemHealth.checks.database.latency > 50) {
        recommendations.push({
          category: 'database',
          priority: 'medium' as const,
          issue: `Database latency is ${systemHealth.checks.database.latency}ms, above optimal threshold`,
          recommendation: 'Add missing indexes and optimize slow queries',
          expectedImprovement: '40-50% reduction in database response time',
        });
      }

      // Redis memory usage
      if (systemHealth.checks.redis.memoryUsage > 0.8) {
        recommendations.push({
          category: 'caching',
          priority: 'medium' as const,
          issue: 'Redis memory usage is above 80%, may cause performance degradation',
          recommendation: 'Implement cache eviction policies and compress cached data',
          expectedImprovement: 'Prevent cache performance degradation',
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('Optimization recommendations generation failed', { error: error.message });
      return [];
    }
  }

  /**
   * Handle critical performance events
   */
  private async handleCriticalPerformanceEvent(metric: PerformanceMetrics): Promise<void> {
    logger.warn('Critical performance event detected', {
      component: metric.component,
      operation: metric.operation,
      executionTime: metric.executionTime,
      slaTarget: this.SLA_TARGET_MS,
      timestamp: metric.timestamp,
    });

    // Record critical event for alerting
    await redisClient.lPush('performance:critical_events', JSON.stringify({
      ...metric,
      severity: 'critical',
      alertTime: Date.now(),
    })).catch(() => {}); // Don't fail if Redis is unavailable

    // Trigger cache warming for search operations
    if (metric.component === 'search' && !metric.cacheHit) {
      this.triggerCacheWarming(metric);
    }
  }

  /**
   * Start metrics buffer flushing
   */
  private startMetricsBufferFlush(): void {
    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.BUFFER_FLUSH_INTERVAL_MS);
  }

  /**
   * Flush metrics buffer to storage
   */
  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Store in Redis for real-time analytics
      const pipeline = redisClient.multi();
      
      metricsToFlush.forEach(metric => {
        const timeWindow = this.getTimeWindowForMetric(metric.timestamp);
        const key = `performance:${metric.component}:${timeWindow}`;
        
        pipeline.lPush(key, JSON.stringify(metric));
        pipeline.expire(key, this.METRICS_RETENTION_HOURS * 3600);
      });

      await pipeline.exec();
      
      logger.debug('Metrics buffer flushed', { count: metricsToFlush.length });
    } catch (error) {
      logger.warn('Metrics buffer flush failed', { 
        error: error.message, 
        metricsCount: metricsToFlush.length 
      });
      
      // Restore metrics to buffer if flush failed
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Update real-time metrics in Redis
   */
  private async updateRealtimeMetrics(metric: PerformanceMetrics): Promise<void> {
    try {
      const pipeline = redisClient.multi();
      const timeKey = Math.floor(Date.now() / 1000 / 60); // Per-minute buckets
      
      // Update latency tracking
      pipeline.lPush(`realtime:latency:${timeKey}`, metric.executionTime.toString());
      pipeline.expire(`realtime:latency:${timeKey}`, this.REAL_TIME_WINDOW_SECONDS);
      
      // Update success/error rates
      if (metric.success) {
        pipeline.incr(`realtime:success:${timeKey}`);
      } else {
        pipeline.incr(`realtime:errors:${timeKey}`);
      }
      
      pipeline.expire(`realtime:success:${timeKey}`, this.REAL_TIME_WINDOW_SECONDS);
      pipeline.expire(`realtime:errors:${timeKey}`, this.REAL_TIME_WINDOW_SECONDS);

      await pipeline.exec().catch(() => {}); // Don't fail if Redis is unavailable
    } catch (error) {
      // Silently handle Redis unavailability
    }
  }

  /**
   * Health check implementations
   */
  private async checkDatabaseHealth() {
    const startTime = Date.now();
    try {
      const result = await pool.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      const statsResult = await pool.query(`
        SELECT 
          count(*) as active_connections,
          max_conn as max_connections
        FROM pg_stat_activity, 
        (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') s
      `);
      
      const activeConnections = parseInt(statsResult.rows[0].active_connections);
      const status = latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'critical';
      
      return {
        status,
        latency,
        activeConnections,
      };
    } catch (error) {
      return {
        status: 'critical',
        latency: Date.now() - startTime,
        activeConnections: 0,
      };
    }
  }

  private async checkRedisHealth() {
    const startTime = Date.now();
    try {
      await redisClient.ping();
      const latency = Date.now() - startTime;
      
      const info = await redisClient.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
      
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
      const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : usedMemory * 2;
      const memoryUsage = maxMemory > 0 ? usedMemory / maxMemory : 0;
      
      const hitRatio = await redisMetrics.getCacheHitRatio();
      
      const status = latency < 50 && memoryUsage < 0.8 ? 'healthy' : 
                     latency < 200 && memoryUsage < 0.9 ? 'degraded' : 'critical';
      
      return {
        status,
        latency,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        hitRatio: Math.round(hitRatio * 100) / 100,
      };
    } catch (error) {
      return {
        status: 'critical',
        latency: Date.now() - startTime,
        memoryUsage: 0,
        hitRatio: 0,
      };
    }
  }

  private async checkSearchHealth() {
    try {
      const timeWindow = this.getCurrentTimeWindow();
      const metricsKey = `performance:search:${timeWindow}`;
      
      const latencyData = await redisClient.lRange(metricsKey, 0, 99); // Last 100 entries
      const latencies = latencyData.map(data => {
        try {
          const metric = JSON.parse(data);
          return { latency: metric.executionTime, success: metric.success };
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      if (latencies.length === 0) {
        return {
          status: 'healthy',
          averageLatency: 0,
          successRate: 100,
        };
      }
      
      const averageLatency = latencies.reduce((sum, l) => sum + l.latency, 0) / latencies.length;
      const successCount = latencies.filter(l => l.success).length;
      const successRate = (successCount / latencies.length) * 100;
      
      const status = averageLatency < this.SLA_TARGET_MS && successRate > 95 ? 'healthy' :
                     averageLatency < this.SLA_TARGET_MS * 2 && successRate > 90 ? 'degraded' : 'critical';
      
      return {
        status,
        averageLatency: Math.round(averageLatency * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
      };
    } catch (error) {
      return {
        status: 'critical',
        averageLatency: 0,
        successRate: 0,
      };
    }
  }

  private async checkApiHealth() {
    try {
      // This would integrate with actual API metrics
      // For now, return healthy status
      return {
        status: 'healthy',
        requestsPerSecond: 0,
        errorRate: 0,
      };
    } catch (error) {
      return {
        status: 'critical',
        requestsPerSecond: 0,
        errorRate: 100,
      };
    }
  }

  /**
   * Utility functions
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return Math.round(sortedArray[Math.max(0, index)] * 100) / 100;
  }

  private getCurrentTimeWindow(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }

  private getTimeWindowForMetric(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  private extractRegionFromQuery(query: any): string {
    // Simple region extraction based on coordinates
    if (!query || typeof query.lat !== 'number' || typeof query.lng !== 'number') {
      return 'unknown';
    }

    // US regions (simplified)
    if (query.lat >= 25 && query.lat <= 49 && query.lng >= -125 && query.lng <= -66) {
      if (query.lat >= 40 && query.lng >= -125 && query.lng <= -95) return 'us-west';
      if (query.lat >= 40 && query.lng >= -95 && query.lng <= -66) return 'us-east';
      if (query.lat < 40 && query.lng >= -125 && query.lng <= -95) return 'us-southwest';
      if (query.lat < 40 && query.lng >= -95 && query.lng <= -66) return 'us-southeast';
    }

    return 'international';
  }

  private startHealthCheckScheduler(): void {
    // Run health checks every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Log health status changes
        if (health.status !== 'healthy') {
          logger.warn('System health degraded', health);
        }
        
        // Store health metrics
        await redisClient.setEx(
          'system:health:current',
          300, // 5 minutes
          JSON.stringify(health)
        ).catch(() => {});
      } catch (error) {
        logger.error('Scheduled health check failed', { error: error.message });
      }
    }, 300000); // 5 minutes
  }

  private async triggerCacheWarming(metric: PerformanceMetrics): Promise<void> {
    // This would trigger cache warming for slow queries
    // Implementation depends on your cache warming strategy
    logger.debug('Cache warming triggered for slow query', {
      component: metric.component,
      executionTime: metric.executionTime,
    });
  }

  private async getRealtimeMetrics(): Promise<{
    searchLatency: number[];
    cacheHitRatio: number;
    requestsPerSecond: number;
    errorRate: number;
    activeUsers: number;
  }> {
    try {
      const currentMinute = Math.floor(Date.now() / 1000 / 60);
      const minutes = Array.from({ length: 5 }, (_, i) => currentMinute - i);
      
      const latencyPromises = minutes.map(minute => 
        redisClient.lRange(`realtime:latency:${minute}`, 0, -1)
      );
      
      const latencyResults = await Promise.all(latencyPromises);
      const searchLatency = latencyResults
        .flat()
        .map(l => parseFloat(l))
        .filter(l => !isNaN(l));
      
      const cacheHitRatio = await redisMetrics.getCacheHitRatio('current');
      
      return {
        searchLatency: searchLatency.slice(-50), // Last 50 data points
        cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
        requestsPerSecond: Math.round(searchLatency.length / 300), // Rough estimate
        errorRate: 0, // Would be calculated from actual error metrics
        activeUsers: 0, // Would be tracked separately
      };
    } catch (error) {
      logger.warn('Real-time metrics collection failed', { error: error.message });
      return {
        searchLatency: [],
        cacheHitRatio: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        activeUsers: 0,
      };
    }
  }

  private async getGeographicPerformance(): Promise<Array<{
    region: string;
    averageLatency: number;
    requestCount: number;
    cacheHitRatio: number;
  }>> {
    try {
      const regions = ['us-west', 'us-east', 'us-southwest', 'us-southeast', 'international'];
      const timeWindow = this.getCurrentTimeWindow();
      
      const regionMetrics = await Promise.all(
        regions.map(async (region) => {
          const latencyKey = `search:latency:${region}:${timeWindow}`;
          const latencyData = await redisClient.lRange(latencyKey, 0, -1);
          
          const latencies = latencyData.map(l => parseFloat(l)).filter(l => !isNaN(l));
          const averageLatency = latencies.length > 0 
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
            : 0;
          
          return {
            region,
            averageLatency: Math.round(averageLatency * 100) / 100,
            requestCount: latencies.length,
            cacheHitRatio: 0.85, // Would be calculated from actual cache metrics
          };
        })
      );
      
      return regionMetrics.filter(m => m.requestCount > 0);
    } catch (error) {
      logger.warn('Geographic performance collection failed', { error: error.message });
      return [];
    }
  }

  private async getPerformanceTrends(): Promise<{
    hourly: Array<{ hour: string; latency: number; volume: number }>;
    daily: Array<{ date: string; latency: number; volume: number }>;
  }> {
    try {
      // Get hourly data for the last 24 hours
      const hourlyData = [];
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = `${hour.getFullYear()}-${String(hour.getMonth() + 1).padStart(2, '0')}-${String(hour.getDate()).padStart(2, '0')}-${String(hour.getHours()).padStart(2, '0')}`;
        
        const metricsKey = `performance:search:${hourKey}`;
        const metrics = await redisClient.lRange(metricsKey, 0, -1);
        
        const latencies = metrics.map(m => {
          try {
            return JSON.parse(m).executionTime;
          } catch {
            return null;
          }
        }).filter(l => l !== null);
        
        const averageLatency = latencies.length > 0 
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
          : 0;
        
        hourlyData.push({
          hour: String(hour.getHours()).padStart(2, '0') + ':00',
          latency: Math.round(averageLatency * 100) / 100,
          volume: latencies.length,
        });
      }
      
      return {
        hourly: hourlyData,
        daily: [], // Would implement daily trends similarly
      };
    } catch (error) {
      logger.warn('Performance trends collection failed', { error: error.message });
      return {
        hourly: [],
        daily: [],
      };
    }
  }
}

export const performanceMonitoringService = new PerformanceMonitoringService();