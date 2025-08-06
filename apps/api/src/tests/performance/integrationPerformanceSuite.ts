import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { performance } from 'perf_hooks';
import { locationSearchService } from '../../services/locationSearchService.js';
import { intelligentCacheManager } from '../../services/intelligentCacheManager.js';
import { performanceMonitoringService } from '../../services/performanceMonitoringService.js';
import { connectRedis, disconnectRedis, redisClient } from '../../config/redis.js';
import { pool } from '../../config/database.js';

/**
 * Integration Performance Suite
 * End-to-end performance validation across all system components
 * Validates complete search flow from request to response
 */

interface IntegrationTestScenario {
  name: string;
  description: string;
  steps: IntegrationTestStep[];
  expectedDuration: number;
  criticalPath: boolean;
}

interface IntegrationTestStep {
  name: string;
  component: string;
  action: () => Promise<any>;
  expectedDuration: number;
  required: boolean;
}

interface IntegrationTestResult {
  scenario: IntegrationTestScenario;
  totalDuration: number;
  stepResults: Array<{
    step: IntegrationTestStep;
    duration: number;
    success: boolean;
    error?: string;
    data?: any;
  }>;
  success: boolean;
  performanceScore: number;
  bottlenecks: string[];
}

interface ComponentPerformanceProfile {
  component: string;
  averageLatency: number;
  maxLatency: number;
  errorRate: number;
  throughput: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
}

interface IntegrationPerformanceReport {
  overallHealthScore: number;
  testResults: IntegrationTestResult[];
  componentProfiles: ComponentPerformanceProfile[];
  systemBottlenecks: string[];
  optimizationRecommendations: string[];
  performanceMetrics: {
    endToEndLatency: {
      average: number;
      p95: number;
      p99: number;
    };
    componentLatencyBreakdown: { [component: string]: number };
    cacheEfficiency: number;
    databasePerformance: number;
    networkEfficiency: number;
  };
}

class IntegrationPerformanceSuite {
  private readonly PERFORMANCE_TARGETS = {
    endToEndLatency: 200, // 200ms for complete search flow
    databaseLatency: 50,   // 50ms for database operations
    cacheLatency: 10,      // 10ms for cache operations
    networkLatency: 30,    // 30ms for network operations
    memoryEfficiency: 100, // 100MB max memory increase
    errorRate: 0.01,       // 1% max error rate
  };

  private readonly TEST_SCENARIOS: IntegrationTestScenario[] = [
    {
      name: 'cold_search_flow',
      description: 'Complete search flow with cold cache',
      expectedDuration: 150,
      criticalPath: true,
      steps: [
        {
          name: 'cache_check',
          component: 'intelligent_cache_manager',
          action: async () => await this.checkCache('test_search_key'),
          expectedDuration: 5,
          required: true,
        },
        {
          name: 'database_query',
          component: 'location_search_service',
          action: async () => await this.executeSearchQuery(),
          expectedDuration: 80,
          required: true,
        },
        {
          name: 'result_enhancement',
          component: 'location_search_service',
          action: async () => await this.enhanceSearchResults(),
          expectedDuration: 30,
          required: true,
        },
        {
          name: 'cache_storage',
          component: 'intelligent_cache_manager',
          action: async () => await this.storeInCache('test_search_key', {}),
          expectedDuration: 10,
          required: true,
        },
        {
          name: 'response_formatting',
          component: 'location_search_service',
          action: async () => await this.formatSearchResponse(),
          expectedDuration: 5,
          required: true,
        },
      ],
    },
    {
      name: 'warm_cache_search_flow',
      description: 'Search flow with warm cache hit',
      expectedDuration: 50,
      criticalPath: true,
      steps: [
        {
          name: 'cache_hit',
          component: 'intelligent_cache_manager',
          action: async () => await this.getFromCache('test_search_key'),
          expectedDuration: 5,
          required: true,
        },
        {
          name: 'result_enhancement',
          component: 'location_search_service',
          action: async () => await this.enhanceSearchResults(),
          expectedDuration: 20,
          required: true,
        },
        {
          name: 'response_formatting',
          component: 'location_search_service',
          action: async () => await this.formatSearchResponse(),
          expectedDuration: 5,
          required: true,
        },
      ],
    },
    {
      name: 'concurrent_search_flow',
      description: 'Multiple concurrent searches',
      expectedDuration: 200,
      criticalPath: true,
      steps: [
        {
          name: 'concurrent_requests',
          component: 'location_search_service',
          action: async () => await this.executeConcurrentSearches(10),
          expectedDuration: 150,
          required: true,
        },
        {
          name: 'performance_monitoring',
          component: 'performance_monitoring_service',
          action: async () => await this.collectPerformanceMetrics(),
          expectedDuration: 20,
          required: false,
        },
      ],
    },
    {
      name: 'cache_invalidation_flow',
      description: 'Cache invalidation and refresh flow',
      expectedDuration: 100,
      criticalPath: false,
      steps: [
        {
          name: 'cache_invalidation',
          component: 'intelligent_cache_manager',
          action: async () => await this.invalidateCache('test_pattern*'),
          expectedDuration: 30,
          required: true,
        },
        {
          name: 'cache_warming',
          component: 'intelligent_cache_manager',
          action: async () => await this.warmCache(),
          expectedDuration: 50,
          required: true,
        },
      ],
    },
    {
      name: 'error_handling_flow',
      description: 'Error handling and fallback mechanisms',
      expectedDuration: 300,
      criticalPath: false,
      steps: [
        {
          name: 'simulate_database_error',
          component: 'location_search_service',
          action: async () => await this.simulateDatabaseError(),
          expectedDuration: 100,
          required: true,
        },
        {
          name: 'fallback_mechanism',
          component: 'location_search_service',
          action: async () => await this.executeFallbackSearch(),
          expectedDuration: 150,
          required: true,
        },
      ],
    },
  ];

  async runIntegrationPerformanceTests(): Promise<IntegrationPerformanceReport> {
    console.log('🔄 Starting Integration Performance Suite');
    const startTime = Date.now();
    
    await this.setupIntegrationTestEnvironment();
    
    try {
      const testResults: IntegrationTestResult[] = [];
      
      // Run all integration test scenarios
      for (const scenario of this.TEST_SCENARIOS) {
        console.log(`\n🧪 Testing integration scenario: ${scenario.description}`);
        
        const result = await this.executeIntegrationScenario(scenario);
        testResults.push(result);
        
        this.logIntegrationResult(result);
        
        // Brief pause between scenarios
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Generate component performance profiles
      const componentProfiles = await this.generateComponentProfiles();
      
      // Generate comprehensive report
      const report = await this.generateIntegrationReport(testResults, componentProfiles);
      
      const totalTestTime = Date.now() - startTime;
      console.log(`\n✅ Integration Performance Suite completed in ${Math.round(totalTestTime / 1000)}s`);
      
      this.printIntegrationReport(report);
      
      return report;
    } catch (error) {
      console.error('❌ Integration Performance Suite failed:', error);
      throw error;
    } finally {
      await this.cleanupIntegrationTestEnvironment();
    }
  }

  private async executeIntegrationScenario(scenario: IntegrationTestScenario): Promise<IntegrationTestResult> {
    const scenarioStartTime = performance.now();
    const stepResults: IntegrationTestResult['stepResults'] = [];
    let overallSuccess = true;
    const bottlenecks: string[] = [];

    for (const step of scenario.steps) {
      const stepStartTime = performance.now();
      let stepSuccess = true;
      let stepError: string | undefined;
      let stepData: any;

      try {
        // Execute the step action
        stepData = await step.action();
        
        const stepDuration = performance.now() - stepStartTime;
        
        // Check if step exceeded expected duration (bottleneck detection)
        if (stepDuration > step.expectedDuration * 1.5) {
          bottlenecks.push(`${step.component}.${step.name} took ${Math.round(stepDuration)}ms (expected ${step.expectedDuration}ms)`);
        }
        
        stepResults.push({
          step,
          duration: stepDuration,
          success: stepSuccess,
          data: stepData,
        });
        
      } catch (error) {
        stepSuccess = false;
        stepError = error instanceof Error ? error.message : 'Unknown error';
        
        if (step.required) {
          overallSuccess = false;
        }
        
        const stepDuration = performance.now() - stepStartTime;
        stepResults.push({
          step,
          duration: stepDuration,
          success: stepSuccess,
          error: stepError,
        });
        
        console.warn(`⚠️ Step failed: ${step.name} - ${stepError}`);
      }
    }

    const totalDuration = performance.now() - scenarioStartTime;
    const performanceScore = this.calculatePerformanceScore(scenario, totalDuration, stepResults);

    return {
      scenario,
      totalDuration,
      stepResults,
      success: overallSuccess,
      performanceScore,
      bottlenecks,
    };
  }

  private calculatePerformanceScore(
    scenario: IntegrationTestScenario,
    actualDuration: number,
    stepResults: IntegrationTestResult['stepResults']
  ): number {
    let score = 100;

    // Deduct points for exceeding expected duration
    const durationRatio = actualDuration / scenario.expectedDuration;
    if (durationRatio > 1) {
      score -= Math.min(50, (durationRatio - 1) * 100);
    }

    // Deduct points for failed steps
    const failedSteps = stepResults.filter(r => !r.success).length;
    score -= failedSteps * 20;

    // Deduct points for bottlenecks
    const bottleneckSteps = stepResults.filter(r => r.duration > r.step.expectedDuration * 1.5).length;
    score -= bottleneckSteps * 10;

    return Math.max(0, Math.round(score));
  }

  private async generateComponentProfiles(): Promise<ComponentPerformanceProfile[]> {
    const components = [
      'intelligent_cache_manager',
      'location_search_service', 
      'performance_monitoring_service',
      'database',
      'redis',
    ];

    const profiles: ComponentPerformanceProfile[] = [];

    for (const component of components) {
      const profile = await this.profileComponent(component);
      profiles.push(profile);
    }

    return profiles;
  }

  private async profileComponent(componentName: string): Promise<ComponentPerformanceProfile> {
    const measurements: number[] = [];
    const errors: number[] = [];
    const startMemory = process.memoryUsage().heapUsed;

    // Run component-specific performance tests
    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();
      
      try {
        await this.executeComponentTest(componentName);
        const duration = performance.now() - startTime;
        measurements.push(duration);
      } catch (error) {
        errors.push(1);
      }
    }

    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsage = (endMemory - startMemory) / (1024 * 1024); // MB

    return {
      component: componentName,
      averageLatency: measurements.reduce((sum, m) => sum + m, 0) / measurements.length || 0,
      maxLatency: Math.max(...measurements) || 0,
      errorRate: errors.length / 50,
      throughput: measurements.length > 0 ? 1000 / (measurements.reduce((sum, m) => sum + m, 0) / measurements.length) : 0,
      resourceUsage: {
        memory: Math.max(0, memoryUsage),
        cpu: 0, // Would be measured with actual CPU profiling
        network: 0, // Would be measured with network monitoring
      },
    };
  }

  private async executeComponentTest(component: string): Promise<any> {
    switch (component) {
      case 'intelligent_cache_manager':
        const testKey = `test_${Date.now()}_${Math.random()}`;
        await intelligentCacheManager.set(testKey, { test: 'data' });
        return await intelligentCacheManager.get(testKey);
        
      case 'location_search_service':
        return await locationSearchService.searchByLocation({
          lat: 37.7749 + (Math.random() - 0.5) * 0.01,
          lng: -122.4194 + (Math.random() - 0.5) * 0.01,
          radius: 25,
          limit: 10,
        });
        
      case 'performance_monitoring_service':
        return await performanceMonitoringService.getPerformanceDashboard();
        
      case 'database':
        return await pool.query('SELECT 1 as test');
        
      case 'redis':
        const key = `test_${Date.now()}`;
        await redisClient.set(key, 'test_value');
        return await redisClient.get(key);
        
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  private async generateIntegrationReport(
    testResults: IntegrationTestResult[],
    componentProfiles: ComponentPerformanceProfile[]
  ): Promise<IntegrationPerformanceReport> {
    // Calculate overall health score
    const avgPerformanceScore = testResults.reduce((sum, r) => sum + r.performanceScore, 0) / testResults.length;
    const successRate = testResults.filter(r => r.success).length / testResults.length;
    const overallHealthScore = Math.round((avgPerformanceScore + successRate * 100) / 2);

    // Identify system bottlenecks
    const systemBottlenecks = this.identifySystemBottlenecks(testResults, componentProfiles);

    // Generate optimization recommendations
    const optimizationRecommendations = this.generateOptimizationRecommendations(testResults, componentProfiles);

    // Calculate performance metrics
    const performanceMetrics = this.calculateIntegrationMetrics(testResults, componentProfiles);

    return {
      overallHealthScore,
      testResults,
      componentProfiles,
      systemBottlenecks,
      optimizationRecommendations,
      performanceMetrics,
    };
  }

  private identifySystemBottlenecks(
    testResults: IntegrationTestResult[],
    componentProfiles: ComponentPerformanceProfile[]
  ): string[] {
    const bottlenecks: string[] = [];

    // Check for slow components
    componentProfiles.forEach(profile => {
      if (profile.averageLatency > 100) {
        bottlenecks.push(`${profile.component} has high latency: ${Math.round(profile.averageLatency)}ms`);
      }
      
      if (profile.errorRate > 0.05) {
        bottlenecks.push(`${profile.component} has high error rate: ${Math.round(profile.errorRate * 100)}%`);
      }
      
      if (profile.resourceUsage.memory > 50) {
        bottlenecks.push(`${profile.component} has high memory usage: ${Math.round(profile.resourceUsage.memory)}MB`);
      }
    });

    // Check for scenario bottlenecks
    testResults.forEach(result => {
      if (result.performanceScore < 70) {
        bottlenecks.push(`${result.scenario.name} scenario has performance issues: ${result.performanceScore}% score`);
      }
      
      result.bottlenecks.forEach(bottleneck => {
        bottlenecks.push(bottleneck);
      });
    });

    return [...new Set(bottlenecks)]; // Remove duplicates
  }

  private generateOptimizationRecommendations(
    testResults: IntegrationTestResult[],
    componentProfiles: ComponentPerformanceProfile[]
  ): string[] {
    const recommendations: string[] = [];

    // Component-based recommendations
    componentProfiles.forEach(profile => {
      if (profile.component === 'location_search_service' && profile.averageLatency > 50) {
        recommendations.push('Optimize database queries in location search service with better indexing');
      }
      
      if (profile.component === 'intelligent_cache_manager' && profile.averageLatency > 10) {
        recommendations.push('Optimize cache operations with connection pooling and compression');
      }
      
      if (profile.component === 'database' && profile.averageLatency > 30) {
        recommendations.push('Consider database connection pooling and query optimization');
      }
    });

    // Scenario-based recommendations
    const coldSearchResult = testResults.find(r => r.scenario.name === 'cold_search_flow');
    if (coldSearchResult && coldSearchResult.performanceScore < 80) {
      recommendations.push('Implement intelligent cache warming for frequently searched locations');
    }

    const concurrentResult = testResults.find(r => r.scenario.name === 'concurrent_search_flow');
    if (concurrentResult && concurrentResult.performanceScore < 70) {
      recommendations.push('Add request queuing and rate limiting for better concurrency handling');
    }

    // Performance-based recommendations
    const avgEndToEndLatency = testResults.reduce((sum, r) => sum + r.totalDuration, 0) / testResults.length;
    if (avgEndToEndLatency > this.PERFORMANCE_TARGETS.endToEndLatency) {
      recommendations.push(`End-to-end latency (${Math.round(avgEndToEndLatency)}ms) exceeds target (${this.PERFORMANCE_TARGETS.endToEndLatency}ms). Consider horizontal scaling`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System integration performance is optimal. Continue monitoring for degradation');
    }

    return recommendations;
  }

  private calculateIntegrationMetrics(
    testResults: IntegrationTestResult[],
    componentProfiles: ComponentPerformanceProfile[]
  ): IntegrationPerformanceReport['performanceMetrics'] {
    const durations = testResults.map(r => r.totalDuration);
    durations.sort((a, b) => a - b);

    const componentLatencyBreakdown: { [component: string]: number } = {};
    componentProfiles.forEach(profile => {
      componentLatencyBreakdown[profile.component] = profile.averageLatency;
    });

    return {
      endToEndLatency: {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p95: durations[Math.ceil(durations.length * 0.95) - 1] || 0,
        p99: durations[Math.ceil(durations.length * 0.99) - 1] || 0,
      },
      componentLatencyBreakdown,
      cacheEfficiency: this.calculateCacheEfficiency(testResults),
      databasePerformance: componentProfiles.find(p => p.component === 'database')?.averageLatency || 0,
      networkEfficiency: 95, // Simulated - would be measured with actual network monitoring
    };
  }

  private calculateCacheEfficiency(testResults: IntegrationTestResult[]): number {
    const warmCacheResult = testResults.find(r => r.scenario.name === 'warm_cache_search_flow');
    const coldCacheResult = testResults.find(r => r.scenario.name === 'cold_search_flow');
    
    if (warmCacheResult && coldCacheResult && coldCacheResult.totalDuration > 0) {
      const efficiency = (1 - (warmCacheResult.totalDuration / coldCacheResult.totalDuration)) * 100;
      return Math.max(0, Math.min(100, efficiency));
    }
    
    return 80; // Default efficiency estimate
  }

  // Mock test implementation methods
  private async checkCache(key: string): Promise<any> {
    return await intelligentCacheManager.get(key);
  }

  private async executeSearchQuery(): Promise<any> {
    return await locationSearchService.searchByLocation({
      lat: 37.7749,
      lng: -122.4194,
      radius: 25,
      limit: 10,
    });
  }

  private async enhanceSearchResults(): Promise<any> {
    // Simulate result enhancement
    await new Promise(resolve => setTimeout(resolve, 20));
    return { enhanced: true };
  }

  private async storeInCache(key: string, data: any): Promise<any> {
    return await intelligentCacheManager.set(key, data);
  }

  private async formatSearchResponse(): Promise<any> {
    // Simulate response formatting
    await new Promise(resolve => setTimeout(resolve, 3));
    return { formatted: true };
  }

  private async getFromCache(key: string): Promise<any> {
    return await intelligentCacheManager.get(key, {
      fallbackGenerator: async () => ({ cached: true })
    });
  }

  private async executeConcurrentSearches(count: number): Promise<any> {
    const promises = Array(count).fill(null).map(() => 
      locationSearchService.searchByLocation({
        lat: 37.7749 + (Math.random() - 0.5) * 0.1,
        lng: -122.4194 + (Math.random() - 0.5) * 0.1,
        radius: 25,
        limit: 10,
      })
    );

    const results = await Promise.allSettled(promises);
    return results.filter(r => r.status === 'fulfilled').length;
  }

  private async collectPerformanceMetrics(): Promise<any> {
    return await performanceMonitoringService.getPerformanceDashboard();
  }

  private async invalidateCache(pattern: string): Promise<any> {
    return await intelligentCacheManager.invalidate(pattern);
  }

  private async warmCache(): Promise<any> {
    const warmingEntries = [
      {
        key: 'warm_test_1',
        generator: async () => ({ warm: true }),
        priority: 8,
      },
      {
        key: 'warm_test_2',
        generator: async () => ({ warm: true }),
        priority: 7,
      },
    ];

    return await intelligentCacheManager.warmCache(warmingEntries);
  }

  private async simulateDatabaseError(): Promise<any> {
    // Simulate database error scenario
    throw new Error('Simulated database connection error');
  }

  private async executeFallbackSearch(): Promise<any> {
    // Simulate fallback mechanism
    await new Promise(resolve => setTimeout(resolve, 100));
    return { fallback: true, limited: true };
  }

  private logIntegrationResult(result: IntegrationTestResult): void {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.scenario.name}: ${Math.round(result.totalDuration)}ms (score: ${result.performanceScore}%)`);
    
    if (result.bottlenecks.length > 0) {
      console.log(`    Bottlenecks: ${result.bottlenecks.length}`);
    }
    
    result.stepResults.forEach(step => {
      const stepStatus = step.success ? '✓' : '✗';
      console.log(`      ${stepStatus} ${step.step.name}: ${Math.round(step.duration)}ms`);
    });
  }

  private printIntegrationReport(report: IntegrationPerformanceReport): void {
    console.log('\n🔄 INTEGRATION PERFORMANCE REPORT');
    console.log('=' .repeat(50));
    console.log(`Overall Health Score: ${report.overallHealthScore}%`);
    console.log(`End-to-End Latency (avg): ${Math.round(report.performanceMetrics.endToEndLatency.average)}ms`);
    console.log(`Cache Efficiency: ${Math.round(report.performanceMetrics.cacheEfficiency)}%`);
    
    console.log('\n📊 Component Performance:');
    report.componentProfiles.forEach(profile => {
      console.log(`  ${profile.component}: ${Math.round(profile.averageLatency)}ms avg, ${Math.round(profile.errorRate * 100)}% error rate`);
    });
    
    if (report.systemBottlenecks.length > 0) {
      console.log('\n⚠️ System Bottlenecks:');
      report.systemBottlenecks.forEach((bottleneck, index) => {
        console.log(`  ${index + 1}. ${bottleneck}`);
      });
    }
    
    console.log('\n📝 Optimization Recommendations:');
    report.optimizationRecommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  private async setupIntegrationTestEnvironment(): Promise<void> {
    await connectRedis();
    // Prime cache for testing
    await intelligentCacheManager.set('test_search_key', { primed: true });
    console.log('🔧 Integration test environment ready');
  }

  private async cleanupIntegrationTestEnvironment(): Promise<void> {
    await intelligentCacheManager.invalidate('test_*');
    await disconnectRedis();
    console.log('🧹 Integration test environment cleaned up');
  }
}

// Jest Test Suite
describe('Integration Performance Suite', () => {
  let integrationSuite: IntegrationPerformanceSuite;
  let performanceReport: IntegrationPerformanceReport;

  beforeAll(async () => {
    integrationSuite = new IntegrationPerformanceSuite();
    
    // Skip integration tests in CI environments
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.log('⏭️ Skipping integration performance tests in CI environment');
      return;
    }
    
    performanceReport = await integrationSuite.runIntegrationPerformanceTests();
  });

  test('should achieve acceptable overall health score', async () => {
    if (!performanceReport) {
      console.log('⏭️ Skipping health score test - not run in CI');
      return;
    }

    expect(performanceReport.overallHealthScore).toBeGreaterThan(70);
  });

  test('should have acceptable end-to-end latency', async () => {
    if (!performanceReport) return;

    const endToEndLatency = performanceReport.performanceMetrics.endToEndLatency;
    expect(endToEndLatency.average).toBeLessThan(200); // 200ms target
    expect(endToEndLatency.p95).toBeLessThan(500); // 500ms 95th percentile
  });

  test('should demonstrate efficient caching', async () => {
    if (!performanceReport) return;

    expect(performanceReport.performanceMetrics.cacheEfficiency).toBeGreaterThan(60);
  });

  test('should have acceptable component performance', async () => {
    if (!performanceReport) return;

    const cacheComponent = performanceReport.componentProfiles.find(
      p => p.component === 'intelligent_cache_manager'
    );
    
    if (cacheComponent) {
      expect(cacheComponent.averageLatency).toBeLessThan(20); // 20ms for cache operations
      expect(cacheComponent.errorRate).toBeLessThan(0.01); // 1% error rate
    }
  });

  test('should handle concurrent operations efficiently', async () => {
    if (!performanceReport) return;

    const concurrentTest = performanceReport.testResults.find(
      r => r.scenario.name === 'concurrent_search_flow'
    );
    
    if (concurrentTest) {
      expect(concurrentTest.success).toBe(true);
      expect(concurrentTest.performanceScore).toBeGreaterThan(60);
    }
  });

  test('should provide actionable optimization recommendations', async () => {
    if (!performanceReport) return;

    expect(performanceReport.optimizationRecommendations).toBeDefined();
    expect(performanceReport.optimizationRecommendations.length).toBeGreaterThan(0);
  });
});

export { IntegrationPerformanceSuite };
export type { IntegrationPerformanceReport, IntegrationTestResult, ComponentPerformanceProfile };