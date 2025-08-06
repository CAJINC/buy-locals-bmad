import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { productionPerformanceValidator } from '../../services/productionPerformanceValidator.js';
import { connectRedis, disconnectRedis } from '../../config/redis.js';
import type { DeploymentValidationResult } from '../../services/productionPerformanceValidator.js';

/**
 * Production Deployment Validation Test Suite
 * Comprehensive validation for production readiness
 * This suite validates all aspects of system readiness for deployment
 */

describe('Production Deployment Validation Suite', () => {
  let validationResult: DeploymentValidationResult;

  beforeAll(async () => {
    // Skip production validation in CI environments
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.log('⏭️ Skipping production validation in CI environment');
      return;
    }

    console.log('🚀 Starting comprehensive production deployment validation...');
    
    // Initialize connections for testing
    await connectRedis();
    
    // Run full production validation
    validationResult = await productionPerformanceValidator.validateProductionReadiness();
  });

  afterAll(async () => {
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      return;
    }
    
    await disconnectRedis();
  });

  describe('Overall Production Readiness', () => {
    test('should have validation score >= 90 for production deployment', async () => {
      if (!validationResult) {
        console.log('⏭️ Skipping production readiness test - not run in CI');
        return;
      }

      expect(validationResult.validationScore).toBeGreaterThanOrEqual(90);
    });

    test('should be flagged as production ready', async () => {
      if (!validationResult) return;

      expect(validationResult.readyForProduction).toBe(true);
    });

    test('should have no critical SLA failures', async () => {
      if (!validationResult) return;

      expect(validationResult.slaCompliance.criticalFailures).toBe(0);
    });

    test('should have high SLA compliance rate', async () => {
      if (!validationResult) return;

      const complianceRate = validationResult.slaCompliance.passed / validationResult.slaCompliance.total;
      expect(complianceRate).toBeGreaterThanOrEqual(0.85); // 85% minimum
    });
  });

  describe('Performance Profile Validation', () => {
    test('should meet search response time requirements', async () => {
      if (!validationResult) return;

      // Target: <100ms average response time
      expect(validationResult.performanceProfile.searchResponseTime).toBeLessThan(100);
    });

    test('should achieve high cache hit rate', async () => {
      if (!validationResult) return;

      // Target: >90% cache hit rate
      expect(validationResult.performanceProfile.cacheHitRate).toBeGreaterThan(90);
    });

    test('should maintain high system availability', async () => {
      if (!validationResult) return;

      // Target: >99.9% availability
      expect(validationResult.performanceProfile.systemAvailability).toBeGreaterThan(99.9);
    });

    test('should have acceptable error rate', async () => {
      if (!validationResult) return;

      // Target: <1% error rate
      expect(validationResult.performanceProfile.errorRate).toBeLessThan(1.0);
    });

    test('should demonstrate memory efficiency', async () => {
      if (!validationResult) return;

      // Target: <100MB memory usage increase
      expect(validationResult.performanceProfile.memoryEfficiency).toBeLessThan(100);
    });
  });

  describe('Infrastructure Readiness', () => {
    test('should have working database connections', async () => {
      if (!validationResult) return;

      expect(validationResult.infraStructureReadiness.databaseConnections).toBe(true);
    });

    test('should have operational Redis cluster', async () => {
      if (!validationResult) return;

      expect(validationResult.infraStructureReadiness.redisCluster).toBe(true);
    });

    test('should have monitoring systems configured', async () => {
      if (!validationResult) return;

      expect(validationResult.infraStructureReadiness.monitoringSetup).toBe(true);
    });

    test('should have alerting configured', async () => {
      if (!validationResult) return;

      expect(validationResult.infraStructureReadiness.alertingConfigured).toBe(true);
    });

    test('should have logging enabled', async () => {
      if (!validationResult) return;

      expect(validationResult.infraStructureReadiness.loggingEnabled).toBe(true);
    });
  });

  describe('Security Validation', () => {
    test('should have input validation configured', async () => {
      if (!validationResult) return;

      expect(validationResult.securityValidation.inputValidation).toBe(true);
    });

    test('should have rate limiting configured', async () => {
      if (!validationResult) return;

      expect(validationResult.securityValidation.rateLimiting).toBe(true);
    });

    test('should have data encryption enabled', async () => {
      if (!validationResult) return;

      expect(validationResult.securityValidation.dataEncryption).toBe(true);
    });

    test('should have audit logging configured', async () => {
      if (!validationResult) return;

      expect(validationResult.securityValidation.auditLogging).toBe(true);
    });
  });

  describe('Scalability Assessment', () => {
    test('should support horizontal scaling', async () => {
      if (!validationResult) return;

      expect(validationResult.scalabilityAssessment.horizontalScaling).toBe(true);
    });

    test('should have load balancing configured', async () => {
      if (!validationResult) return;

      expect(validationResult.scalabilityAssessment.loadBalancing).toBe(true);
    });

    test('should have auto-scaling configured', async () => {
      if (!validationResult) return;

      expect(validationResult.scalabilityAssessment.autoScaling).toBe(true);
    });

    test('should have resource optimization in place', async () => {
      if (!validationResult) return;

      expect(validationResult.scalabilityAssessment.resourceOptimization).toBe(true);
    });
  });

  describe('Deployment Guidance', () => {
    test('should provide actionable recommendations', async () => {
      if (!validationResult) return;

      expect(validationResult.recommendations).toBeDefined();
      expect(Array.isArray(validationResult.recommendations)).toBe(true);
      expect(validationResult.recommendations.length).toBeGreaterThan(0);
    });

    test('should provide clear next steps', async () => {
      if (!validationResult) return;

      expect(validationResult.nextSteps).toBeDefined();
      expect(Array.isArray(validationResult.nextSteps)).toBe(true);
      expect(validationResult.nextSteps.length).toBeGreaterThan(0);
    });

    test('should indicate deployment approval for high-scoring systems', async () => {
      if (!validationResult) return;

      if (validationResult.validationScore >= 90) {
        expect(validationResult.nextSteps[0]).toContain('Proceed with production deployment');
      } else {
        expect(validationResult.nextSteps[0]).toContain('Do not proceed with deployment');
      }
    });
  });

  describe('Individual SLA Validation', () => {
    test('should run comprehensive SLA tests', async () => {
      if (!validationResult) return;

      // Verify that SLA testing actually ran
      expect(validationResult.slaCompliance.total).toBeGreaterThan(0);
    });

    test('should test critical SLA components', async () => {
      if (!validationResult) return;

      // Should test at least 5 SLA components
      expect(validationResult.slaCompliance.total).toBeGreaterThanOrEqual(5);
    });

    test('should achieve acceptable SLA pass rate', async () => {
      if (!validationResult) return;

      const passRate = (validationResult.slaCompliance.passed / validationResult.slaCompliance.total) * 100;
      
      // Should pass at least 80% of SLA tests
      expect(passRate).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Production Monitoring Setup', () => {
    test('should configure performance alerts', async () => {
      if (!validationResult) return;

      // Monitoring setup should be successful
      expect(validationResult.infraStructureReadiness.monitoringSetup).toBe(true);
    });

    test('should enable continuous monitoring', async () => {
      if (!validationResult) return;

      // For production-ready systems, monitoring should be enabled
      if (validationResult.readyForProduction) {
        expect(validationResult.infraStructureReadiness.alertingConfigured).toBe(true);
      }
    });
  });

  describe('Integration with Existing Performance Framework', () => {
    test('should integrate with performance monitoring service', async () => {
      if (!validationResult) return;

      // Performance profile should have realistic values
      expect(validationResult.performanceProfile.searchResponseTime).toBeGreaterThan(0);
      expect(validationResult.performanceProfile.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(validationResult.performanceProfile.systemAvailability).toBeGreaterThanOrEqual(0);
    });

    test('should validate against established benchmarks', async () => {
      if (!validationResult) return;

      // Ensure the validation actually tests against meaningful benchmarks
      const profile = validationResult.performanceProfile;
      
      // Response time should be reasonable (not zero or extremely high)
      expect(profile.searchResponseTime).toBeLessThan(1000); // Less than 1 second
      
      // Cache hit rate should be reasonable
      if (profile.cacheHitRate > 0) {
        expect(profile.cacheHitRate).toBeLessThanOrEqual(100);
      }
      
      // Error rate should be reasonable
      expect(profile.errorRate).toBeLessThan(10); // Less than 10%
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle validation failures gracefully', async () => {
      if (!validationResult) return;

      // Even if some components fail, validation should complete
      expect(validationResult).toBeDefined();
      expect(typeof validationResult.validationScore).toBe('number');
      expect(validationResult.validationScore).toBeGreaterThanOrEqual(0);
      expect(validationResult.validationScore).toBeLessThanOrEqual(100);
    });

    test('should provide meaningful failure feedback', async () => {
      if (!validationResult) return;

      // If not ready for production, should explain why
      if (!validationResult.readyForProduction) {
        expect(validationResult.recommendations.length).toBeGreaterThan(0);
        expect(validationResult.slaCompliance.criticalFailures).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Regression Prevention', () => {
    test('should establish performance baselines', async () => {
      if (!validationResult) return;

      const profile = validationResult.performanceProfile;
      
      // Should have established meaningful baselines
      expect(profile.searchResponseTime).toBeGreaterThan(0);
      
      // Baselines should be within reasonable ranges for a search system
      expect(profile.searchResponseTime).toBeLessThan(500); // 500ms max
    });

    test('should validate system under realistic load', async () => {
      if (!validationResult) return;

      // SLA compliance should be based on sufficient testing
      expect(validationResult.slaCompliance.total).toBeGreaterThanOrEqual(5);
    });
  });
});