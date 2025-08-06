import { bandwidthManager } from '../../bandwidthManager';
import NetInfo from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('BandwidthManager Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup default network mock
    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: {}
    });
    
    mockNetInfo.addEventListener.mockReturnValue(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    bandwidthManager.cleanup();
  });

  describe('Request Throughput Performance', () => {
    test('should handle high-frequency request checks efficiently', () => {
      const startTime = performance.now();
      
      // Make many rapid request checks
      const results = [];
      for (let i = 0; i < 10000; i++) {
        results.push(bandwidthManager.canMakeRequest(1024, 'normal'));
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should process checks very quickly
      expect(processingTime).toBeLessThan(500); // Under 500ms for 10k checks
      expect(results).toHaveLength(10000);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
    });

    test('should queue and process requests efficiently', () => {
      const startTime = performance.now();
      
      // Queue many requests
      const queueResults = [];
      for (let i = 0; i < 1000; i++) {
        queueResults.push(
          bandwidthManager.queueRequest(`req-${i}`, 1024 + i, 'normal', 3)
        );
      }
      
      const endTime = performance.now();
      const queueTime = endTime - startTime;
      
      // Should queue efficiently
      expect(queueTime).toBeLessThan(200);
      expect(queueResults.filter(Boolean)).toHaveLength(queueResults.length);
    });

    test('should handle request completion updates efficiently', async () => {
      // Queue some requests first
      for (let i = 0; i < 100; i++) {
        bandwidthManager.queueRequest(`req-${i}`, 1024, 'normal', 3);
        bandwidthManager.startRequest(`req-${i}`, 1024);
      }
      
      const startTime = performance.now();
      
      // Complete all requests
      for (let i = 0; i < 100; i++) {
        bandwidthManager.completeRequest(`req-${i}`, 2048, true);
      }
      
      const endTime = performance.now();
      const completionTime = endTime - startTime;
      
      // Should handle completions efficiently
      expect(completionTime).toBeLessThan(100);
    });
  });

  describe('Network Condition Adaptation Performance', () => {
    test('should adapt to network changes quickly', () => {
      const networkConditions = [
        { type: 'wifi', details: {} },
        { type: 'cellular', details: { cellularGeneration: '5g' } },
        { type: 'cellular', details: { cellularGeneration: '4g' } },
        { type: 'cellular', details: { cellularGeneration: '3g' } },
        { type: 'cellular', details: { cellularGeneration: '2g' } },
        { type: 'none', details: {} }
      ];
      
      const startTime = performance.now();
      
      // Simulate rapid network changes
      networkConditions.forEach(condition => {
        const mockCallback = mockNetInfo.addEventListener.mock.calls[0]?.[0];
        if (mockCallback) {
          mockCallback({
            ...condition,
            isConnected: condition.type !== 'none',
            isInternetReachable: condition.type !== 'none'
          });
        }
      });
      
      const endTime = performance.now();
      const adaptationTime = endTime - startTime;
      
      // Should adapt quickly to all network changes
      expect(adaptationTime).toBeLessThan(100);
      
      // Verify final strategy was set correctly
      const finalStrategy = bandwidthManager.getCurrentStrategy();
      expect(finalStrategy.name).toBeDefined();
    });

    test('should maintain performance during strategy switches', () => {
      // Start with WiFi
      mockNetInfo.addEventListener.mockImplementation((callback) => {
        // Simulate rapid network switching
        const conditions = [
          { type: 'wifi', isConnected: true, details: {} },
          { type: 'cellular', isConnected: true, details: { cellularGeneration: '4g' } },
          { type: 'cellular', isConnected: true, details: { cellularGeneration: '2g' } },
          { type: 'wifi', isConnected: true, details: {} }
        ];
        
        let index = 0;
        const interval = setInterval(() => {
          if (index < conditions.length) {
            callback(conditions[index]);
            index++;
          } else {
            clearInterval(interval);
          }
        }, 10);
        
        return () => clearInterval(interval);
      });
      
      const startTime = performance.now();
      
      // Let network changes occur
      jest.advanceTimersByTime(100);
      
      // Test performance during changes
      const testResults = [];
      for (let i = 0; i < 100; i++) {
        testResults.push(bandwidthManager.canMakeRequest(1024, 'normal'));
      }
      
      const endTime = performance.now();
      const testTime = endTime - startTime;
      
      // Should maintain performance during network switches
      expect(testTime).toBeLessThan(200);
      expect(testResults).toHaveLength(100);
    });
  });

  describe('Data Usage Metrics Performance', () => {
    test('should update metrics efficiently under high load', () => {
      const startTime = performance.now();
      
      // Simulate many request completions with metrics updates
      for (let i = 0; i < 1000; i++) {
        bandwidthManager.queueRequest(`req-${i}`, 1024, 'normal');
        bandwidthManager.startRequest(`req-${i}`, 1024);
        bandwidthManager.completeRequest(`req-${i}`, 2048, true);
      }
      
      const endTime = performance.now();
      const metricsTime = endTime - startTime;
      
      // Should handle metrics updates efficiently
      expect(metricsTime).toBeLessThan(500);
      
      const metrics = bandwidthManager.getDataUsageMetrics();
      expect(metrics.totalRequestsToday).toBe(1000);
      expect(metrics.totalDataUsedToday).toBeGreaterThan(0);
    });

    test('should calculate usage statistics efficiently', () => {
      // Add test data
      for (let i = 0; i < 500; i++) {
        bandwidthManager.queueRequest(`req-${i}`, 1000 + i, 'normal');
        bandwidthManager.startRequest(`req-${i}`, 1000 + i);
        bandwidthManager.completeRequest(`req-${i}`, 2000 + i, true);
      }
      
      const startTime = performance.now();
      
      // Calculate statistics multiple times
      const stats = [];
      for (let i = 0; i < 100; i++) {
        stats.push(bandwidthManager.getStatistics());
      }
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;
      
      // Should calculate stats efficiently
      expect(calculationTime).toBeLessThan(100);
      expect(stats).toHaveLength(100);
      
      stats.forEach(stat => {
        expect(stat.dataUsage).toBeDefined();
        expect(stat.currentStrategy).toBeDefined();
        expect(stat.averageSpeed).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Optimization Algorithm Performance', () => {
    test('should analyze usage patterns efficiently', () => {
      // Setup usage data
      const networkTypes = ['wifi', 'cellular', '5g', '4g', '3g'];
      
      for (let i = 0; i < 1000; i++) {
        bandwidthManager.queueRequest(`req-${i}`, 1024, 'normal');
        bandwidthManager.startRequest(`req-${i}`, 1024);
        
        // Mock network type rotation
        const networkType = networkTypes[i % networkTypes.length];
        bandwidthManager.completeRequest(`req-${i}`, 2048, true);
      }
      
      const startTime = performance.now();
      
      // Run optimization analysis
      const recommendation = bandwidthManager.getDataUsageRecommendation();
      
      const endTime = performance.now();
      const analysisTime = endTime - startTime;
      
      // Should analyze efficiently
      expect(analysisTime).toBeLessThan(200);
      expect(recommendation.shouldOptimize).toBeDefined();
      expect(recommendation.recommendations).toBeInstanceOf(Array);
    });

    test('should determine optimal update frequency quickly', () => {
      // Setup speed samples
      for (let i = 0; i < 100; i++) {
        bandwidthManager.queueRequest(`req-${i}`, 1024, 'normal');
        bandwidthManager.startRequest(`req-${i}`, 1024);
        bandwidthManager.completeRequest(`req-${i}`, 2048, true);
      }
      
      const startTime = performance.now();
      
      // Calculate optimal frequency multiple times
      const frequencies = [];
      for (let i = 0; i < 1000; i++) {
        frequencies.push(bandwidthManager.getOptimalUpdateFrequency());
      }
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;
      
      // Should calculate efficiently
      expect(calculationTime).toBeLessThan(100);
      expect(frequencies).toHaveLength(1000);
      expect(frequencies.every(freq => freq > 0)).toBe(true);
    });
  });

  describe('Rate Limiting Performance', () => {
    test('should enforce rate limits efficiently', () => {
      // Configure strict rate limits
      const startTime = performance.now();
      
      let allowedRequests = 0;
      let deniedRequests = 0;
      
      // Test rate limiting under load
      for (let i = 0; i < 10000; i++) {
        if (bandwidthManager.canMakeRequest(1024, 'normal')) {
          allowedRequests++;
          bandwidthManager.queueRequest(`req-${i}`, 1024, 'normal');
        } else {
          deniedRequests++;
        }
      }
      
      const endTime = performance.now();
      const limitingTime = endTime - startTime;
      
      // Should enforce limits efficiently
      expect(limitingTime).toBeLessThan(1000);
      expect(allowedRequests + deniedRequests).toBe(10000);
      expect(allowedRequests).toBeGreaterThan(0);
      expect(deniedRequests).toBeGreaterThan(0); // Some should be denied
    });

    test('should handle burst allowances correctly', () => {
      const startTime = performance.now();
      
      // Test burst handling
      const burstResults = [];
      for (let i = 0; i < 100; i++) {
        const canMake = bandwidthManager.canMakeRequest(10240, 'high'); // Large requests
        burstResults.push(canMake);
        
        if (canMake) {
          bandwidthManager.queueRequest(`burst-${i}`, 10240, 'high');
          bandwidthManager.startRequest(`burst-${i}`, 10240);
          bandwidthManager.completeRequest(`burst-${i}`, 20480, true);
        }
      }
      
      const endTime = performance.now();
      const burstTime = endTime - startTime;
      
      // Should handle bursts efficiently
      expect(burstTime).toBeLessThan(200);
      expect(burstResults.some(result => result)).toBe(true);
      expect(burstResults.some(result => !result)).toBe(true);
    });
  });

  describe('Memory and Resource Performance', () => {
    test('should maintain efficient memory usage', () => {
      const initialStats = bandwidthManager.getStatistics();
      
      // Generate lots of data
      for (let i = 0; i < 5000; i++) {
        bandwidthManager.queueRequest(`memory-test-${i}`, 1024 + i, 'normal');
        bandwidthManager.startRequest(`memory-test-${i}`, 1024 + i);
        bandwidthManager.completeRequest(`memory-test-${i}`, 2048 + i, true);
      }
      
      const afterDataStats = bandwidthManager.getStatistics();
      
      // Memory usage should be controlled
      expect(afterDataStats.queuedRequests).toBeLessThanOrEqual(1000);
      expect(afterDataStats.activeRequests).toBeLessThanOrEqual(100);
    });

    test('should cleanup resources efficiently', () => {
      // Add lots of active requests and data
      for (let i = 0; i < 1000; i++) {
        bandwidthManager.queueRequest(`cleanup-${i}`, 1024, 'normal');
        bandwidthManager.startRequest(`cleanup-${i}`, 1024);
      }
      
      const startTime = performance.now();
      bandwidthManager.cleanup();
      const endTime = performance.now();
      
      const cleanupTime = endTime - startTime;
      
      // Should cleanup efficiently
      expect(cleanupTime).toBeLessThan(100);
    });
  });

  describe('Event Performance', () => {
    test('should emit events efficiently under load', () => {
      let eventCount = 0;
      const eventHandler = jest.fn(() => eventCount++);
      
      bandwidthManager.on('request_completed', eventHandler);
      bandwidthManager.on('optimization_recommended', eventHandler);
      bandwidthManager.on('strategy_changed', eventHandler);
      
      const startTime = performance.now();
      
      // Generate many events
      for (let i = 0; i < 1000; i++) {
        bandwidthManager.queueRequest(`event-${i}`, 1024, 'normal');
        bandwidthManager.startRequest(`event-${i}`, 1024);
        bandwidthManager.completeRequest(`event-${i}`, 2048, true);
      }
      
      const endTime = performance.now();
      const eventTime = endTime - startTime;
      
      // Should handle events efficiently
      expect(eventTime).toBeLessThan(500);
      expect(eventCount).toBeGreaterThan(0);
    });

    test('should handle event listener management efficiently', () => {
      const handlers = [];
      
      // Add many listeners
      for (let i = 0; i < 1000; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        bandwidthManager.on('request_completed', handler);
      }
      
      const startTime = performance.now();
      
      // Remove all listeners
      bandwidthManager.removeAllListeners('request_completed');
      
      const endTime = performance.now();
      const removalTime = endTime - startTime;
      
      // Should manage listeners efficiently
      expect(removalTime).toBeLessThan(100);
      expect(bandwidthManager.listenerCount('request_completed')).toBe(0);
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('should handle concurrent request operations efficiently', async () => {
      const concurrentOperations = [];
      const operationCount = 100;
      
      const startTime = performance.now();
      
      // Start many concurrent operations
      for (let i = 0; i < operationCount; i++) {
        concurrentOperations.push(
          Promise.resolve().then(() => {
            const canMake = bandwidthManager.canMakeRequest(1024, 'normal');
            if (canMake) {
              bandwidthManager.queueRequest(`concurrent-${i}`, 1024, 'normal');
              bandwidthManager.startRequest(`concurrent-${i}`, 1024);
              bandwidthManager.completeRequest(`concurrent-${i}`, 2048, true);
            }
            return canMake;
          })
        );
      }
      
      const results = await Promise.all(concurrentOperations);
      const endTime = performance.now();
      
      const concurrentTime = endTime - startTime;
      
      // Should handle concurrent operations efficiently
      expect(concurrentTime).toBeLessThan(500);
      expect(results).toHaveLength(operationCount);
      expect(results.some(result => result)).toBe(true);
    });

    test('should maintain performance with mixed operation types', async () => {
      const mixedOperations = [];
      const startTime = performance.now();
      
      // Mix different operation types
      for (let i = 0; i < 500; i++) {
        if (i % 5 === 0) {
          mixedOperations.push(() => bandwidthManager.getStatistics());
        } else if (i % 5 === 1) {
          mixedOperations.push(() => bandwidthManager.getCurrentStrategy());
        } else if (i % 5 === 2) {
          mixedOperations.push(() => bandwidthManager.getOptimalUpdateFrequency());
        } else if (i % 5 === 3) {
          mixedOperations.push(() => bandwidthManager.canMakeRequest(1024, 'normal'));
        } else {
          mixedOperations.push(() => bandwidthManager.getDataUsageRecommendation());
        }
      }
      
      // Execute all operations
      const results = mixedOperations.map(op => op());
      
      const endTime = performance.now();
      const mixedTime = endTime - startTime;
      
      // Should handle mixed operations efficiently
      expect(mixedTime).toBeLessThan(300);
      expect(results).toHaveLength(500);
      expect(results.every(result => result !== undefined)).toBe(true);
    });
  });
});