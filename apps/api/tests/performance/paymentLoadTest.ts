import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { PaymentService } from '../../src/services/paymentService.js';
import { TaxService } from '../../src/services/taxService.js';
import { PayoutService } from '../../src/services/payoutService.js';
import PaymentTestData from '../utils/paymentTestData.js';
import StripeTestHelpers from '../utils/stripeTestHelpers.js';
import TestDatabase from '../utils/testDatabase.js';

/**
 * Payment Performance and Load Tests
 * 
 * Tests system performance under various load conditions:
 * - Concurrent payment processing
 * - High-volume transaction handling
 * - Memory usage and resource management
 * - Response time benchmarks
 * - Stress testing with failure scenarios
 */

describe('Payment Performance Tests', () => {
  let paymentService: PaymentService;
  let taxService: TaxService;
  let payoutService: PayoutService;

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    PAYMENT_CREATION_MAX_TIME: 2000, // 2 seconds
    PAYMENT_CONFIRMATION_MAX_TIME: 3000, // 3 seconds
    CONCURRENT_REQUESTS_MAX_TIME: 5000, // 5 seconds
    TAX_CALCULATION_MAX_TIME: 500, // 500ms
    RECEIPT_GENERATION_MAX_TIME: 3000, // 3 seconds
    MEMORY_LEAK_THRESHOLD: 50 * 1024 * 1024, // 50MB
    MAX_CPU_USAGE: 80, // 80%
  };

  beforeAll(async () => {
    await TestDatabase.initialize();
    await TestDatabase.setupSchema();
  });

  beforeEach(async () => {
    await TestDatabase.cleanupTestData();
    await TestDatabase.seedTestData();

    paymentService = new PaymentService();
    taxService = new TaxService();
    payoutService = new PayoutService();

    StripeTestHelpers.initializeMocks();
    StripeTestHelpers.mockSuccessfulPaymentFlow();
  });

  afterEach(async () => {
    StripeTestHelpers.resetMocks();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    await TestDatabase.close();
  });

  describe('Payment Creation Performance', () => {
    it('should create payment intent within performance threshold', async () => {
      const paymentParams = PaymentTestData.createPaymentIntentParams();

      const start = process.hrtime.bigint();
      const result = await paymentService.createPaymentIntent(paymentParams);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME);

      console.log(`Payment creation took ${duration.toFixed(2)}ms`);
    });

    it('should handle payment confirmation within threshold', async () => {
      const paymentParams = PaymentTestData.createPaymentIntentParams();
      const createResult = await paymentService.createPaymentIntent(paymentParams);

      const start = process.hrtime.bigint();
      const confirmResult = await paymentService.confirmPayment(
        createResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;

      expect(confirmResult.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CONFIRMATION_MAX_TIME);

      console.log(`Payment confirmation took ${duration.toFixed(2)}ms`);
    });

    it('should calculate tax within performance threshold', async () => {
      const taxRequest = PaymentTestData.createTaxCalculationRequest();

      const start = process.hrtime.bigint();
      const result = await taxService.calculateTax(taxRequest);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;

      expect(result.taxAmount).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TAX_CALCULATION_MAX_TIME);

      console.log(`Tax calculation took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Payment Processing', () => {
    it('should handle concurrent payment intents efficiently', async () => {
      const concurrency = 10;
      const payments = Array.from({ length: concurrency }, (_, i) =>
        PaymentTestData.createPaymentIntentParams({
          amount: 1000 * (i + 1),
          customerId: `cus_concurrent_${i}`,
          metadata: { concurrentTest: `payment_${i}` },
        })
      );

      const start = process.hrtime.bigint();
      const promises = payments.map(params => 
        paymentService.createPaymentIntent(params)
      );
      
      const results = await Promise.all(promises);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Total time should be reasonable
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS_MAX_TIME);

      // Average time per request should be efficient
      const avgTimePerRequest = duration / concurrency;
      expect(avgTimePerRequest).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME);

      console.log(`${concurrency} concurrent payments took ${duration.toFixed(2)}ms (${avgTimePerRequest.toFixed(2)}ms avg)`);
    });

    it('should handle high concurrency without degradation', async () => {
      const concurrency = 50;
      const payments = Array.from({ length: concurrency }, (_, i) =>
        PaymentTestData.createPaymentIntentParams({
          amount: 5000,
          customerId: `cus_high_concurrency_${i}`,
          businessId: `business_${i % 5}`, // Spread across 5 businesses
        })
      );

      const start = process.hrtime.bigint();
      const promises = payments.map(params => 
        paymentService.createPaymentIntent(params)
      );
      
      const results = await Promise.allSettled(promises);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successCount / concurrency;

      // Should maintain high success rate under load
      expect(successRate).toBeGreaterThanOrEqual(0.9); // 90% success rate minimum

      // Should complete within reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS_MAX_TIME * 2);

      console.log(`${concurrency} high-concurrency payments: ${successCount}/${concurrency} succeeded (${(successRate * 100).toFixed(1)}%) in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent operations across different services', async () => {
      const concurrency = 20;
      const operations = [];

      // Mix different operations
      for (let i = 0; i < concurrency; i++) {
        switch (i % 4) {
          case 0:
            operations.push(
              paymentService.createPaymentIntent(
                PaymentTestData.createPaymentIntentParams({ customerId: `cus_mixed_${i}` })
              )
            );
            break;
          case 1:
            operations.push(
              taxService.calculateTax(
                PaymentTestData.createTaxCalculationRequest({ businessId: `biz_mixed_${i}` })
              )
            );
            break;
          case 2:
            operations.push(
              payoutService.getBusinessBalance(`business_mixed_${i}`)
            );
            break;
          case 3:
            // Simulate payment confirmation
            operations.push(
              paymentService.confirmPayment(`pi_mixed_${i}`, 'pm_test_card').catch(() => ({ success: false }))
            );
            break;
        }
      }

      const start = process.hrtime.bigint();
      const results = await Promise.allSettled(operations);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      expect(successCount).toBeGreaterThan(concurrency * 0.5); // At least 50% success (some operations expected to fail in test)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS_MAX_TIME);

      console.log(`${concurrency} mixed operations: ${successCount}/${concurrency} succeeded in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();

      for (let i = 0; i < iterations; i++) {
        const paymentParams = PaymentTestData.createPaymentIntentParams({
          customerId: `cus_memory_test_${i}`,
        });
        
        await paymentService.createPaymentIntent(paymentParams);
        
        // Periodically trigger garbage collection
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);

      console.log(`Memory increase after ${iterations} operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle large payloads efficiently', async () => {
      const largeMetadata = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key_${i}`] = `value_${'x'.repeat(100)}_${i}`;
      }

      const paymentParams = PaymentTestData.createPaymentIntentParams({
        metadata: largeMetadata,
        description: 'x'.repeat(1000), // 1KB description
      });

      const start = process.hrtime.bigint();
      const result = await paymentService.createPaymentIntent(paymentParams);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME * 2);

      console.log(`Large payload processing took ${duration.toFixed(2)}ms`);
    });

    it('should cleanup resources properly after errors', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate errors intentionally
      const failingOperations = Array.from({ length: 50 }, (_, i) =>
        paymentService.createPaymentIntent({
          ...PaymentTestData.createPaymentIntentParams(),
          amount: -100, // Invalid amount to cause error
          customerId: `cus_error_test_${i}`,
        }).catch(() => ({ success: false }))
      );

      await Promise.all(failingOperations);

      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal even with errors
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD / 2);

      console.log(`Memory increase after error handling: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle sustained load without degradation', async () => {
      const duration = 10000; // 10 seconds
      const intervalMs = 100; // Request every 100ms
      const expectedRequests = duration / intervalMs;
      
      const results: Array<{ success: boolean; duration: number }> = [];
      const startTime = Date.now();

      const stressTest = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime >= duration) {
            clearInterval(interval);
            resolve();
            return;
          }

          const requestStart = process.hrtime.bigint();
          
          try {
            const result = await paymentService.createPaymentIntent(
              PaymentTestData.createPaymentIntentParams({
                customerId: `cus_stress_${Date.now()}_${Math.random()}`,
              })
            );
            
            const requestEnd = process.hrtime.bigint();
            const requestDuration = Number(requestEnd - requestStart) / 1000000;
            
            results.push({
              success: result.success,
              duration: requestDuration,
            });
          } catch (error) {
            const requestEnd = process.hrtime.bigint();
            const requestDuration = Number(requestEnd - requestStart) / 1000000;
            
            results.push({
              success: false,
              duration: requestDuration,
            });
          }
        }, intervalMs);
      });

      await stressTest;

      const successCount = results.filter(r => r.success).length;
      const successRate = successCount / results.length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));

      // Should maintain good performance under sustained load
      expect(successRate).toBeGreaterThanOrEqual(0.8); // 80% success rate minimum
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME);
      expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME * 3);

      console.log(`Stress test: ${successCount}/${results.length} requests succeeded (${(successRate * 100).toFixed(1)}%)`);
      console.log(`Average duration: ${avgDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`);
    });

    it('should recover gracefully from overload conditions', async () => {
      // Simulate overload with burst traffic
      const burstSize = 100;
      const burstPromises = Array.from({ length: burstSize }, (_, i) =>
        paymentService.createPaymentIntent(
          PaymentTestData.createPaymentIntentParams({
            customerId: `cus_burst_${i}`,
          })
        ).catch(() => ({ success: false }))
      );

      const burstStart = process.hrtime.bigint();
      const burstResults = await Promise.all(burstPromises);
      const burstEnd = process.hrtime.bigint();

      const burstDuration = Number(burstEnd - burstStart) / 1000000;
      const burstSuccessCount = burstResults.filter(r => r.success).length;

      // Wait for system to recover
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test normal operations after burst
      const normalStart = process.hrtime.bigint();
      const normalResult = await paymentService.createPaymentIntent(
        PaymentTestData.createPaymentIntentParams()
      );
      const normalEnd = process.hrtime.bigint();

      const normalDuration = Number(normalEnd - normalStart) / 1000000;

      // System should recover and process normal requests efficiently
      expect(normalResult.success).toBe(true);
      expect(normalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME);

      console.log(`Burst test: ${burstSuccessCount}/${burstSize} succeeded in ${burstDuration.toFixed(2)}ms`);
      console.log(`Recovery test: Normal request took ${normalDuration.toFixed(2)}ms after burst`);
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Simulate resource exhaustion
      const resourceIntensiveOperations = Array.from({ length: 200 }, (_, i) => {
        const largePayload = PaymentTestData.createPaymentIntentParams({
          customerId: `cus_resource_${i}`,
          metadata: {
            // Large metadata to consume memory
            data: 'x'.repeat(10000),
            index: i.toString(),
          },
        });

        return paymentService.createPaymentIntent(largePayload)
          .catch(() => ({ success: false, error: 'resource_exhausted' }));
      });

      const results = await Promise.allSettled(resourceIntensiveOperations);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      // System should handle resource exhaustion without crashing
      expect(fulfilled + rejected).toBe(200);
      
      // At least some operations should succeed
      expect(fulfilled).toBeGreaterThan(0);

      console.log(`Resource exhaustion test: ${fulfilled} fulfilled, ${rejected} rejected`);

      // System should recover after resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (global.gc) {
        global.gc();
      }

      const recoveryResult = await paymentService.createPaymentIntent(
        PaymentTestData.createPaymentIntentParams()
      );

      expect(recoveryResult.success).toBe(true);
    });
  });

  describe('Database Performance', () => {
    it('should handle database operations efficiently', async () => {
      const operations = 50;
      const paymentParams = Array.from({ length: operations }, (_, i) =>
        PaymentTestData.createPaymentIntentParams({
          customerId: `cus_db_test_${i}`,
          businessId: `biz_db_test_${i % 10}`, // 10 different businesses
        })
      );

      const start = process.hrtime.bigint();
      
      // Create payments (involves database writes)
      const createPromises = paymentParams.map(params =>
        paymentService.createPaymentIntent(params)
      );
      
      const results = await Promise.all(createPromises);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;
      const avgTimePerOperation = duration / operations;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Database operations should be efficient
      expect(avgTimePerOperation).toBeLessThan(1000); // Less than 1 second per operation

      console.log(`${operations} database operations took ${duration.toFixed(2)}ms (${avgTimePerOperation.toFixed(2)}ms avg)`);
    });

    it('should handle concurrent database access', async () => {
      const concurrency = 25;
      const businessId = 'concurrent-db-test-business';

      // Mix of read and write operations
      const operations = Array.from({ length: concurrency }, (_, i) => {
        if (i % 3 === 0) {
          // Read operation (get balance)
          return payoutService.getBusinessBalance(businessId);
        } else if (i % 3 === 1) {
          // Write operation (create payment)
          return paymentService.createPaymentIntent(
            PaymentTestData.createPaymentIntentParams({
              businessId,
              customerId: `cus_concurrent_db_${i}`,
            })
          );
        } else {
          // Read operation (tax calculation)
          return taxService.calculateTax(
            PaymentTestData.createTaxCalculationRequest({
              businessId,
              amount: 1000 * (i + 1),
            })
          );
        }
      });

      const start = process.hrtime.bigint();
      const results = await Promise.allSettled(operations);
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000;
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Most operations should succeed
      expect(successCount).toBeGreaterThan(concurrency * 0.8);
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds

      console.log(`${concurrency} concurrent DB operations: ${successCount}/${concurrency} succeeded in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet SLA requirements for response times', async () => {
      const testCases = [
        {
          operation: 'create_payment_intent',
          threshold: PERFORMANCE_THRESHOLDS.PAYMENT_CREATION_MAX_TIME,
          fn: () => paymentService.createPaymentIntent(PaymentTestData.createPaymentIntentParams()),
        },
        {
          operation: 'calculate_tax',
          threshold: PERFORMANCE_THRESHOLDS.TAX_CALCULATION_MAX_TIME,
          fn: () => taxService.calculateTax(PaymentTestData.createTaxCalculationRequest()),
        },
        {
          operation: 'get_business_balance',
          threshold: 1000, // 1 second
          fn: () => payoutService.getBusinessBalance('test-business-1'),
        },
      ];

      const benchmarkResults = [];

      for (const testCase of testCases) {
        const iterations = 10;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const start = process.hrtime.bigint();
          await testCase.fn();
          const end = process.hrtime.bigint();
          
          durations.push(Number(end - start) / 1000000);
        }

        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        benchmarkResults.push({
          operation: testCase.operation,
          threshold: testCase.threshold,
          avgDuration,
          maxDuration,
          minDuration,
          passesThreshold: avgDuration < testCase.threshold,
        });

        expect(avgDuration).toBeLessThan(testCase.threshold);
      }

      console.log('Performance Benchmarks:');
      benchmarkResults.forEach(result => {
        console.log(`${result.operation}: avg=${result.avgDuration.toFixed(2)}ms, max=${result.maxDuration.toFixed(2)}ms, min=${result.minDuration.toFixed(2)}ms (threshold: ${result.threshold}ms) ${result.passesThreshold ? '✅' : '❌'}`);
      });
    });
  });
});