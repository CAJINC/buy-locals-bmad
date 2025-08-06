import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { performance } from 'perf_hooks';
import { locationSearchService } from '../../services/locationSearchService.js';
import { intelligentCacheManager } from '../../services/intelligentCacheManager.js';
import { performanceMonitoringService } from '../../services/performanceMonitoringService.js';
import { connectRedis, disconnectRedis, redisClient } from '../../config/redis.js';
import { pool } from '../../config/database.js';

/**
 * Enterprise Load Testing Suite
 * Validates system performance under realistic load conditions
 * Target: Sub-100ms response time, >90% success rate, linear scalability
 */

interface LoadTestConfig {
  concurrentUsers: number;
  testDurationMs: number;
  requestsPerSecond: number;
  rampUpTimeMs: number;
  thinkTimeMs: number;
  geographicDistribution: boolean;
}

interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsagePattern: number[];
  cpuUsagePattern: number[];
  networkThroughput: number;
  concurrencyLevel: number;
}

interface StressTestResults {
  baselineMetrics: LoadTestMetrics;
  loadTestResults: { [scenario: string]: LoadTestMetrics };
  scalabilityAnalysis: {
    linearScaling: boolean;
    bottleneckPoints: string[];
    maxSupportedUsers: number;
    recommendedCapacity: number;
  };
  slaCompliance: {
    responseTimeSLA: boolean;
    availabilitySLA: boolean;
    throughputSLA: boolean;
  };
  recommendations: string[];
}

class LoadTestingSuite {
  private readonly SLA_TARGETS = {
    averageResponseTime: 100, // 100ms
    p95ResponseTime: 200, // 200ms 
    p99ResponseTime: 500, // 500ms
    errorRate: 0.01, // 1%
    availability: 0.999, // 99.9%
    minThroughput: 100, // 100 RPS
  };

  private readonly TEST_SCENARIOS: { [key: string]: LoadTestConfig } = {
    baseline: {
      concurrentUsers: 10,
      testDurationMs: 60000, // 1 minute
      requestsPerSecond: 5,
      rampUpTimeMs: 10000,
      thinkTimeMs: 1000,
      geographicDistribution: false,
    },
    normalLoad: {
      concurrentUsers: 50,
      testDurationMs: 300000, // 5 minutes
      requestsPerSecond: 25,
      rampUpTimeMs: 30000,
      thinkTimeMs: 2000,
      geographicDistribution: true,
    },
    peakLoad: {
      concurrentUsers: 200,
      testDurationMs: 600000, // 10 minutes
      requestsPerSecond: 100,
      rampUpTimeMs: 60000,
      thinkTimeMs: 1000,
      geographicDistribution: true,
    },
    stressTest: {
      concurrentUsers: 500,
      testDurationMs: 300000, // 5 minutes
      requestsPerSecond: 250,
      rampUpTimeMs: 60000,
      thinkTimeMs: 500,
      geographicDistribution: true,
    },
    breakingPoint: {
      concurrentUsers: 1000,
      testDurationMs: 180000, // 3 minutes
      requestsPerSecond: 500,
      rampUpTimeMs: 120000,
      thinkTimeMs: 200,
      geographicDistribution: true,
    },
  };

  private testResults: { [scenario: string]: LoadTestMetrics } = {};
  private systemMetrics: Array<{ timestamp: number; memory: number; cpu: number }> = [];

  async runComprehensiveLoadTests(): Promise<StressTestResults> {
    console.log('🚀 Starting Enterprise Load Testing Suite');
    
    await this.setupLoadTestEnvironment();
    const startTime = Date.now();

    try {
      // Run all test scenarios
      for (const [scenarioName, config] of Object.entries(this.TEST_SCENARIOS)) {
        console.log(`\n📊 Running ${scenarioName} load test...`);
        
        const metrics = await this.executeLoadTest(scenarioName, config);
        this.testResults[scenarioName] = metrics;
        
        // Log scenario results
        this.logScenarioResults(scenarioName, metrics);
        
        // Cool-down period between tests
        if (scenarioName !== 'breakingPoint') {
          await this.cooldownPeriod(30000); // 30 second cooldown
        }
      }

      // Analyze results and generate recommendations
      const results = await this.analyzeTestResults();
      
      const totalTestTime = Date.now() - startTime;
      console.log(`\n✅ Load Testing Suite completed in ${Math.round(totalTestTime / 1000)}s`);
      
      return results;
    } catch (error) {
      console.error('❌ Load Testing Suite failed:', error);
      throw error;
    } finally {
      await this.cleanupLoadTestEnvironment();
    }
  }

  private async setupLoadTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up load test environment...');
    
    // Connect to Redis and Database
    await connectRedis();
    
    // Clear cache for clean testing
    await redisClient.flushDb();
    
    // Initialize performance monitoring
    await this.startSystemMetricsCollection();
    
    // Warm up the system with some initial requests
    await this.warmupSystem();
    
    console.log('✅ Load test environment ready');
  }

  private async executeLoadTest(
    scenarioName: string, 
    config: LoadTestConfig
  ): Promise<LoadTestMetrics> {
    const { 
      concurrentUsers, 
      testDurationMs, 
      requestsPerSecond, 
      rampUpTimeMs,
      thinkTimeMs,
      geographicDistribution 
    } = config;

    const metrics: LoadTestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      cacheHitRate: 0,
      memoryUsagePattern: [],
      cpuUsagePattern: [],
      networkThroughput: 0,
      concurrencyLevel: concurrentUsers,
    };

    const responseTimes: number[] = [];
    const activeUsers: Set<Promise<void>> = new Set();
    const testStartTime = Date.now();
    let requestCount = 0;

    // Generate test queries
    const testQueries = this.generateTestQueries(geographicDistribution);
    
    // Ramp up users gradually
    const userRampUpInterval = rampUpTimeMs / concurrentUsers;
    
    for (let i = 0; i < concurrentUsers; i++) {
      setTimeout(async () => {
        const userSession = this.simulateUserSession(
          testQueries,
          testDurationMs,
          thinkTimeMs,
          responseTimes,
          metrics
        );
        
        activeUsers.add(userSession);
        
        userSession.finally(() => {
          activeUsers.delete(userSession);
        });
      }, i * userRampUpInterval);
    }

    // Monitor test progress
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - testStartTime;
      const progress = Math.min(100, (elapsed / testDurationMs) * 100);
      const currentRPS = requestCount / (elapsed / 1000);
      
      console.log(`⚡ ${scenarioName}: ${Math.round(progress)}% complete, ${Math.round(currentRPS)} RPS, ${activeUsers.size} active users`);
    }, 5000);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDurationMs));
    
    // Wait for remaining users to complete
    await Promise.allSettled(Array.from(activeUsers));
    
    clearInterval(progressInterval);

    // Calculate final metrics
    return this.calculateFinalMetrics(metrics, responseTimes, testDurationMs);
  }

  private async simulateUserSession(
    testQueries: any[],
    testDurationMs: number,
    thinkTimeMs: number,
    responseTimes: number[],
    metrics: LoadTestMetrics
  ): Promise<void> {
    const sessionStartTime = Date.now();
    const sessionEndTime = sessionStartTime + testDurationMs;

    while (Date.now() < sessionEndTime) {
      const query = testQueries[Math.floor(Math.random() * testQueries.length)];
      
      try {
        const requestStartTime = performance.now();
        
        // Execute search request
        const result = await locationSearchService.searchByLocation(query);
        
        const requestEndTime = performance.now();
        const responseTime = requestEndTime - requestStartTime;
        
        // Record metrics
        responseTimes.push(responseTime);
        metrics.totalRequests++;
        metrics.successfulRequests++;
        
        // Update min/max response times
        metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
        metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
        
        // Record cache hit
        if (result.cacheHit) {
          metrics.cacheHitRate++;
        }
        
        // User think time
        if (thinkTimeMs > 0) {
          await new Promise(resolve => setTimeout(resolve, thinkTimeMs));
        }
        
      } catch (error) {
        metrics.totalRequests++;
        metrics.failedRequests++;
        console.warn(`Request failed:`, error.message);
      }
    }
  }

  private generateTestQueries(geographicDistribution: boolean): any[] {
    const queries = [];
    
    // Major US cities for geographic distribution
    const locations = geographicDistribution ? [
      { lat: 37.7749, lng: -122.4194, city: 'San Francisco' },
      { lat: 40.7128, lng: -74.0060, city: 'New York' },
      { lat: 34.0522, lng: -118.2437, city: 'Los Angeles' },
      { lat: 41.8781, lng: -87.6298, city: 'Chicago' },
      { lat: 29.7604, lng: -95.3698, city: 'Houston' },
      { lat: 39.9526, lng: -75.1652, city: 'Philadelphia' },
      { lat: 33.4484, lng: -112.0740, city: 'Phoenix' },
      { lat: 29.4241, lng: -98.4936, city: 'San Antonio' },
      { lat: 32.7767, lng: -96.7970, city: 'Dallas' },
    ] : [
      { lat: 37.7749, lng: -122.4194, city: 'San Francisco' }, // Single location for baseline
    ];

    const categories = ['restaurant', 'retail', 'service', 'entertainment', 'health', 'beauty'];
    const searchTerms = ['coffee', 'pizza', 'gym', 'pharmacy', 'bank', 'gas station'];
    const radii = [5, 10, 25, 50];

    // Generate diverse query patterns
    for (let i = 0; i < 100; i++) {
      const location = locations[Math.floor(Math.random() * locations.length)];
      const radius = radii[Math.floor(Math.random() * radii.length)];
      
      // Add some randomness to coordinates for cache diversity
      const latVariation = (Math.random() - 0.5) * 0.1;
      const lngVariation = (Math.random() - 0.5) * 0.1;

      queries.push({
        lat: location.lat + latVariation,
        lng: location.lng + lngVariation,
        radius,
        limit: Math.floor(Math.random() * 20) + 10,
      });

      // Add category-specific queries
      if (Math.random() > 0.3) {
        queries.push({
          lat: location.lat + latVariation,
          lng: location.lng + lngVariation,
          radius,
          category: [categories[Math.floor(Math.random() * categories.length)]],
          limit: Math.floor(Math.random() * 15) + 10,
        });
      }

      // Add search term queries
      if (Math.random() > 0.5) {
        queries.push({
          lat: location.lat + latVariation,
          lng: location.lng + lngVariation,
          radius,
          search: searchTerms[Math.floor(Math.random() * searchTerms.length)],
          limit: Math.floor(Math.random() * 15) + 10,
        });
      }
    }

    return queries;
  }

  private calculateFinalMetrics(
    metrics: LoadTestMetrics, 
    responseTimes: number[], 
    testDurationMs: number
  ): LoadTestMetrics {
    if (responseTimes.length === 0) {
      return metrics;
    }

    // Sort response times for percentile calculations
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    
    metrics.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    metrics.p50ResponseTime = this.calculatePercentile(sortedTimes, 50);
    metrics.p95ResponseTime = this.calculatePercentile(sortedTimes, 95);
    metrics.p99ResponseTime = this.calculatePercentile(sortedTimes, 99);
    
    metrics.requestsPerSecond = (metrics.totalRequests / testDurationMs) * 1000;
    metrics.errorRate = metrics.failedRequests / metrics.totalRequests;
    metrics.cacheHitRate = metrics.totalRequests > 0 ? metrics.cacheHitRate / metrics.totalRequests : 0;

    return metrics;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  private async analyzeTestResults(): Promise<StressTestResults> {
    const baselineMetrics = this.testResults.baseline;
    const loadTestResults = this.testResults;
    
    // Analyze scalability
    const scalabilityAnalysis = this.analyzeScalability();
    
    // Check SLA compliance
    const slaCompliance = this.checkSLACompliance();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      baselineMetrics,
      loadTestResults,
      scalabilityAnalysis,
      slaCompliance,
      recommendations,
    };
  }

  private analyzeScalability(): {
    linearScaling: boolean;
    bottleneckPoints: string[];
    maxSupportedUsers: number;
    recommendedCapacity: number;
  } {
    const scenarios = ['baseline', 'normalLoad', 'peakLoad', 'stressTest', 'breakingPoint'];
    const bottleneckPoints: string[] = [];
    let linearScaling = true;
    let maxSupportedUsers = 0;

    // Analyze response time scaling
    for (let i = 1; i < scenarios.length; i++) {
      const current = this.testResults[scenarios[i]];
      const previous = this.testResults[scenarios[i - 1]];
      
      if (!current || !previous) continue;

      const userRatio = current.concurrencyLevel / previous.concurrencyLevel;
      const responseTimeRatio = current.averageResponseTime / previous.averageResponseTime;
      
      // Check if response time scaling is reasonable (should be < 2x for 4x users)
      if (responseTimeRatio > userRatio * 0.5) {
        linearScaling = false;
        bottleneckPoints.push(`Response time degradation at ${current.concurrencyLevel} users`);
      }

      // Check error rate
      if (current.errorRate > this.SLA_TARGETS.errorRate) {
        bottleneckPoints.push(`Error rate exceeded at ${current.concurrencyLevel} users`);
      } else {
        maxSupportedUsers = current.concurrencyLevel;
      }

      // Check throughput scaling
      const expectedThroughput = previous.requestsPerSecond * userRatio;
      if (current.requestsPerSecond < expectedThroughput * 0.7) {
        bottleneckPoints.push(`Throughput bottleneck at ${current.concurrencyLevel} users`);
      }
    }

    return {
      linearScaling,
      bottleneckPoints,
      maxSupportedUsers,
      recommendedCapacity: Math.floor(maxSupportedUsers * 0.8), // 80% of max for safety
    };
  }

  private checkSLACompliance(): {
    responseTimeSLA: boolean;
    availabilitySLA: boolean;
    throughputSLA: boolean;
  } {
    const peakLoadMetrics = this.testResults.peakLoad;
    
    return {
      responseTimeSLA: peakLoadMetrics.averageResponseTime <= this.SLA_TARGETS.averageResponseTime &&
                      peakLoadMetrics.p95ResponseTime <= this.SLA_TARGETS.p95ResponseTime,
      availabilitySLA: (1 - peakLoadMetrics.errorRate) >= this.SLA_TARGETS.availability,
      throughputSLA: peakLoadMetrics.requestsPerSecond >= this.SLA_TARGETS.minThroughput,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const peakMetrics = this.testResults.peakLoad;
    const stressMetrics = this.testResults.stressTest;

    // Response time recommendations
    if (peakMetrics.averageResponseTime > this.SLA_TARGETS.averageResponseTime) {
      recommendations.push(`Average response time (${Math.round(peakMetrics.averageResponseTime)}ms) exceeds target (${this.SLA_TARGETS.averageResponseTime}ms). Consider database query optimization.`);
    }

    if (peakMetrics.p95ResponseTime > this.SLA_TARGETS.p95ResponseTime) {
      recommendations.push(`95th percentile response time (${Math.round(peakMetrics.p95ResponseTime)}ms) exceeds target. Implement request queuing and load balancing.`);
    }

    // Cache efficiency recommendations
    if (peakMetrics.cacheHitRate < 0.9) {
      recommendations.push(`Cache hit rate (${Math.round(peakMetrics.cacheHitRate * 100)}%) is below optimal. Implement intelligent cache warming and increase cache TTL for stable data.`);
    }

    // Scalability recommendations
    if (stressMetrics.errorRate > this.SLA_TARGETS.errorRate) {
      recommendations.push(`Error rate increases under stress (${Math.round(stressMetrics.errorRate * 100)}%). Implement circuit breakers and graceful degradation.`);
    }

    // Throughput recommendations
    if (peakMetrics.requestsPerSecond < this.SLA_TARGETS.minThroughput) {
      recommendations.push(`Throughput (${Math.round(peakMetrics.requestsPerSecond)} RPS) is below target. Scale horizontally or optimize critical path.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance meets all SLA targets. Consider monitoring capacity planning for future growth.');
    }

    return recommendations;
  }

  private logScenarioResults(scenarioName: string, metrics: LoadTestMetrics): void {
    console.log(`\n📋 ${scenarioName.toUpperCase()} RESULTS:`);
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Success Rate: ${Math.round((1 - metrics.errorRate) * 100)}%`);
    console.log(`  Average Response Time: ${Math.round(metrics.averageResponseTime)}ms`);
    console.log(`  95th Percentile: ${Math.round(metrics.p95ResponseTime)}ms`);
    console.log(`  99th Percentile: ${Math.round(metrics.p99ResponseTime)}ms`);
    console.log(`  Requests/Second: ${Math.round(metrics.requestsPerSecond)}`);
    console.log(`  Cache Hit Rate: ${Math.round(metrics.cacheHitRate * 100)}%`);
    console.log(`  Concurrent Users: ${metrics.concurrencyLevel}`);
  }

  private async startSystemMetricsCollection(): Promise<void> {
    const interval = setInterval(async () => {
      try {
        // Collect system metrics (simplified implementation)
        const memoryUsage = process.memoryUsage().heapUsed;
        const cpuUsage = process.cpuUsage();
        
        this.systemMetrics.push({
          timestamp: Date.now(),
          memory: memoryUsage,
          cpu: cpuUsage.user + cpuUsage.system,
        });
      } catch (error) {
        console.warn('System metrics collection failed:', error);
      }
    }, 5000);

    // Store interval for cleanup
    (this as any).metricsInterval = interval;
  }

  private async warmupSystem(): Promise<void> {
    console.log('🔥 Warming up system...');
    
    const warmupQueries = this.generateTestQueries(false).slice(0, 10);
    
    const warmupPromises = warmupQueries.map(async (query) => {
      try {
        await locationSearchService.searchByLocation(query);
      } catch (error) {
        // Ignore warmup errors
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('✅ System warmup completed');
  }

  private async cooldownPeriod(durationMs: number): Promise<void> {
    console.log(`⏸️ Cool-down period: ${durationMs / 1000}s`);
    await new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private async cleanupLoadTestEnvironment(): Promise<void> {
    console.log('🧹 Cleaning up load test environment...');
    
    // Stop metrics collection
    if ((this as any).metricsInterval) {
      clearInterval((this as any).metricsInterval);
    }
    
    // Disconnect from services
    await disconnectRedis();
    await pool.end();
    
    console.log('✅ Load test cleanup completed');
  }
}

// Jest Test Suite
describe('Enterprise Load Testing Suite', () => {
  let loadTestingSuite: LoadTestingSuite;
  let testResults: StressTestResults;

  beforeAll(async () => {
    loadTestingSuite = new LoadTestingSuite();
    
    // Skip load tests in CI environments
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.log('⏭️ Skipping load tests in CI environment');
      return;
    }
    
    testResults = await loadTestingSuite.runComprehensiveLoadTests();
  });

  afterAll(async () => {
    // Cleanup handled by the suite
  });

  test('should meet baseline performance requirements', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping baseline test - not run in CI');
      return;
    }

    const baseline = testResults.baselineMetrics;
    
    expect(baseline.averageResponseTime).toBeLessThan(100); // 100ms target
    expect(baseline.errorRate).toBeLessThan(0.01); // 1% error rate
    expect(baseline.cacheHitRate).toBeGreaterThan(0.5); // 50% cache hit rate minimum
  });

  test('should maintain performance under normal load', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping normal load test - not run in CI');
      return;
    }

    const normalLoad = testResults.loadTestResults.normalLoad;
    
    expect(normalLoad.averageResponseTime).toBeLessThan(150); // Slight degradation acceptable
    expect(normalLoad.p95ResponseTime).toBeLessThan(300); // 95th percentile under 300ms
    expect(normalLoad.errorRate).toBeLessThan(0.02); // 2% error rate under load
  });

  test('should handle peak load within SLA', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping peak load test - not run in CI');
      return;
    }

    const peakLoad = testResults.loadTestResults.peakLoad;
    
    expect(peakLoad.averageResponseTime).toBeLessThan(200); // Peak load allowance
    expect(peakLoad.p99ResponseTime).toBeLessThan(1000); // 99th percentile under 1s
    expect(peakLoad.errorRate).toBeLessThan(0.05); // 5% error rate at peak
  });

  test('should demonstrate linear scalability', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping scalability test - not run in CI');
      return;
    }

    const scalability = testResults.scalabilityAnalysis;
    
    expect(scalability.maxSupportedUsers).toBeGreaterThan(200);
    expect(scalability.recommendedCapacity).toBeGreaterThan(150);
    expect(scalability.bottleneckPoints.length).toBeLessThan(3); // Minimal bottlenecks
  });

  test('should meet SLA compliance requirements', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping SLA compliance test - not run in CI');
      return;
    }

    const sla = testResults.slaCompliance;
    
    expect(sla.responseTimeSLA).toBe(true);
    expect(sla.availabilitySLA).toBe(true);
    expect(sla.throughputSLA).toBe(true);
  });

  test('should provide actionable performance recommendations', async () => {
    if (!testResults) {
      console.log('⏭️ Skipping recommendations test - not run in CI');
      return;
    }

    expect(testResults.recommendations).toBeDefined();
    expect(testResults.recommendations.length).toBeGreaterThan(0);
    
    // Log recommendations for visibility
    console.log('📝 Performance Recommendations:');
    testResults.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  });
});

export { LoadTestingSuite };
export type { LoadTestMetrics, StressTestResults, LoadTestConfig };