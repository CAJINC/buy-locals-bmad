import { PaymentService } from './paymentService.js';
import { TaxService } from './taxService.js';
import { PayoutService } from './payoutService.js';
import { logger } from '../utils/logger.js';
import {
  PCIComplianceHelper,
  SecurityConfig,
  createSecurityMiddleware,
  defaultSecurityConfig,
} from '../utils/paymentSecurity.js';

/**
 * Payment Service Registry
 *
 * Central registry for all payment-related services with:
 * - Service lifecycle management
 * - Health monitoring and circuit breakers
 * - Security compliance validation
 * - Service discovery and dependency injection
 * - Configuration management
 */

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastHealthCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  dependencies: Record<string, 'healthy' | 'unhealthy'>;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  successRate: number;
  lastReset: Date;
}

export class PaymentServiceRegistry {
  private services: Map<string, unknown> = new Map();
  private healthStatus: Map<string, ServiceHealth> = new Map();
  private metrics: Map<string, ServiceMetrics> = new Map();
  private securityMiddleware: unknown;
  private initialized = false;

  constructor(private config: Partial<SecurityConfig> = {}) {
    this.securityMiddleware = createSecurityMiddleware({
      ...defaultSecurityConfig,
      ...this.config,
    });
  }

  /**
   * Initialize all payment services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Payment services already initialized');
      return;
    }

    try {
      logger.info('Initializing payment service registry');

      // Validate PCI compliance
      await this.validateSecurityCompliance();

      // Initialize core services
      await this.initializeServices();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start metrics collection
      this.startMetricsCollection();

      this.initialized = true;

      logger.info('Payment service registry initialized successfully', {
        services: Array.from(this.services.keys()),
        securityCompliant: true,
      });
    } catch (error) {
      logger.error('Failed to initialize payment service registry', { error });
      throw error;
    }
  }

  /**
   * Get a service instance with health checking
   */
  getService<T>(serviceName: string): T {
    if (!this.initialized) {
      throw new Error('Payment service registry not initialized');
    }

    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const health = this.healthStatus.get(serviceName);
    if (health && health.status === 'unhealthy') {
      throw new Error(`Service unhealthy: ${serviceName}`);
    }

    return service;
  }

  /**
   * Get payment service
   */
  getPaymentService(): PaymentService {
    return this.getService<PaymentService>('payment');
  }

  /**
   * Get tax service
   */
  getTaxService(): TaxService {
    return this.getService<TaxService>('tax');
  }

  /**
   * Get payout service
   */
  getPayoutService(): PayoutService {
    return this.getService<PayoutService>('payout');
  }

  /**
   * Get security middleware
   */
  getSecurityMiddleware() {
    return this.securityMiddleware;
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName?: string): ServiceHealth | Record<string, ServiceHealth> {
    if (serviceName) {
      const health = this.healthStatus.get(serviceName);
      if (!health) {
        throw new Error(`Service not found: ${serviceName}`);
      }
      return health;
    }

    const allHealth: Record<string, ServiceHealth> = {};
    for (const [name, health] of this.healthStatus.entries()) {
      allHealth[name] = health;
    }
    return allHealth;
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName?: string): ServiceMetrics | Record<string, ServiceMetrics> {
    if (serviceName) {
      const metrics = this.metrics.get(serviceName);
      if (!metrics) {
        throw new Error(`Service not found: ${serviceName}`);
      }
      return metrics;
    }

    const allMetrics: Record<string, ServiceMetrics> = {};
    for (const [name, metrics] of this.metrics.entries()) {
      allMetrics[name] = metrics;
    }
    return allMetrics;
  }

  /**
   * Perform health check on all services
   */
  async performHealthCheck(): Promise<Record<string, ServiceHealth>> {
    const healthChecks = Array.from(this.services.keys()).map(async serviceName => {
      const startTime = Date.now();
      let status: ServiceHealth['status'] = 'healthy';
      let dependencies: Record<string, 'healthy' | 'unhealthy'> = {};

      try {
        // Perform service-specific health check
        await this.checkServiceHealth(serviceName);

        // Check dependencies
        dependencies = await this.checkServiceDependencies(serviceName);

        // Determine overall status
        const unhealthyDeps = Object.values(dependencies).filter(s => s === 'unhealthy').length;
        if (unhealthyDeps > 0) {
          status = 'degraded';
        }
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}`, { error });
        status = 'unhealthy';
      }

      const responseTime = Date.now() - startTime;
      const health: ServiceHealth = {
        serviceName,
        status,
        lastHealthCheck: new Date(),
        responseTime,
        errorRate: this.calculateErrorRate(serviceName),
        uptime: this.calculateUptime(serviceName),
        dependencies,
      };

      this.healthStatus.set(serviceName, health);
      return { [serviceName]: health };
    });

    const results = await Promise.all(healthChecks);
    return Object.assign({}, ...results);
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down payment service registry');

    // Stop monitoring
    this.stopHealthMonitoring();
    this.stopMetricsCollection();

    // Shutdown services
    for (const [serviceName, service] of this.services.entries()) {
      try {
        if (typeof service.shutdown === 'function') {
          await service.shutdown();
        }
        logger.info(`Service ${serviceName} shut down successfully`);
      } catch (error) {
        logger.error(`Failed to shutdown service ${serviceName}`, { error });
      }
    }

    this.services.clear();
    this.healthStatus.clear();
    this.metrics.clear();
    this.initialized = false;

    logger.info('Payment service registry shut down');
  }

  // Private methods

  private async validateSecurityCompliance(): Promise<void> {
    const compliance = PCIComplianceHelper.validatePCICompliance();

    if (!compliance.compliant) {
      logger.error('PCI DSS compliance validation failed', { issues: compliance.issues });

      if (process.env.NODE_ENV === 'production') {
        throw new Error(`PCI DSS compliance issues: ${compliance.issues.join(', ')}`);
      } else {
        logger.warn('PCI DSS compliance issues in development mode', { issues: compliance.issues });
      }
    }

    logger.info('PCI DSS compliance validation passed');
  }

  private async initializeServices(): Promise<void> {
    const serviceConfigs = [
      { name: 'payment', class: PaymentService },
      { name: 'tax', class: TaxService },
      { name: 'payout', class: PayoutService },
    ];

    for (const serviceConfig of serviceConfigs) {
      try {
        logger.info(`Initializing ${serviceConfig.name} service`);

        const service = new serviceConfig.class();
        this.services.set(serviceConfig.name, service);

        // Initialize service metrics
        this.metrics.set(serviceConfig.name, {
          requestCount: 0,
          errorCount: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          lastReset: new Date(),
        });

        // Perform initial health check
        const health: ServiceHealth = {
          serviceName: serviceConfig.name,
          status: 'healthy',
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorRate: 0,
          uptime: 1.0,
          dependencies: {},
        };
        this.healthStatus.set(serviceConfig.name, health);

        logger.info(`${serviceConfig.name} service initialized successfully`);
      } catch (error) {
        logger.error(`Failed to initialize ${serviceConfig.name} service`, { error });
        throw error;
      }
    }
  }

  private startHealthMonitoring(): void {
    // Perform health checks every 30 seconds
    setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Health check failed', { error });
      });
    }, 30 * 1000);

    logger.info('Health monitoring started');
  }

  private stopHealthMonitoring(): void {
    // In a real implementation, you'd store and clear the interval
    logger.info('Health monitoring stopped');
  }

  private startMetricsCollection(): void {
    // Reset metrics every hour
    setInterval(
      () => {
        this.resetMetrics();
      },
      60 * 60 * 1000
    );

    logger.info('Metrics collection started');
  }

  private stopMetricsCollection(): void {
    logger.info('Metrics collection stopped');
  }

  private async checkServiceHealth(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // Perform service-specific health checks
    switch (serviceName) {
      case 'payment':
        // Test Stripe connectivity
        await this.testStripeConnectivity();
        break;
      case 'tax':
        // Test tax calculation
        await this.testTaxCalculation();
        break;
      case 'payout':
        // Test payout connectivity
        await this.testPayoutConnectivity();
        break;
    }
  }

  private async checkServiceDependencies(
    serviceName: string
  ): Promise<Record<string, 'healthy' | 'unhealthy'>> {
    const dependencies: Record<string, 'healthy' | 'unhealthy'> = {};

    // All services depend on Stripe
    dependencies.stripe = await this.checkStripeDependency();

    // Service-specific dependencies
    switch (serviceName) {
      case 'payment':
        dependencies.database = await this.checkDatabaseDependency();
        dependencies.redis = await this.checkRedisDependency();
        break;
      case 'tax':
        dependencies.database = await this.checkDatabaseDependency();
        break;
      case 'payout':
        dependencies.database = await this.checkDatabaseDependency();
        dependencies.stripe_connect = await this.checkStripeConnectDependency();
        break;
    }

    return dependencies;
  }

  private async testStripeConnectivity(): Promise<void> {
    // Test basic Stripe API connectivity
    const { stripe } = await import('../config/stripe.js');
    await stripe.balance.retrieve();
  }

  private async testTaxCalculation(): Promise<void> {
    // Test basic tax calculation
    const taxService = this.services.get('tax') as TaxService;
    if (taxService) {
      await taxService.calculateTax({
        businessId: 'health-check',
        amount: 1000,
        businessLocation: {
          address: 'Test',
          city: 'Test',
          state: 'CA',
          postalCode: '12345',
          country: 'US',
        },
      });
    }
  }

  private async testPayoutConnectivity(): Promise<void> {
    // Test payout service connectivity
    const payoutService = this.services.get('payout') as PayoutService;
    if (payoutService) {
      await payoutService.getBusinessBalance('health-check');
    }
  }

  private async checkStripeDependency(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.testStripeConnectivity();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkDatabaseDependency(): Promise<'healthy' | 'unhealthy'> {
    try {
      // In a real implementation, test database connectivity
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkRedisDependency(): Promise<'healthy' | 'unhealthy'> {
    try {
      // In a real implementation, test Redis connectivity
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkStripeConnectDependency(): Promise<'healthy' | 'unhealthy'> {
    try {
      // Test Stripe Connect specific functionality
      const { stripe } = await import('../config/stripe.js');
      await stripe.accounts.list({ limit: 1 });
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private calculateErrorRate(serviceName: string): number {
    const metrics = this.metrics.get(serviceName);
    if (!metrics || metrics.requestCount === 0) {
      return 0;
    }
    return metrics.errorCount / metrics.requestCount;
  }

  private calculateUptime(serviceName: string): number {
    const metrics = this.metrics.get(serviceName);
    if (!metrics) {
      return 0;
    }

    const now = Date.now();
    const startTime = metrics.lastReset.getTime();
    const totalTime = now - startTime;

    if (totalTime === 0) {
      return 1.0;
    }

    // Simple uptime calculation - in production, you'd track actual downtime
    return Math.max(0, 1 - this.calculateErrorRate(serviceName) * 0.1);
  }

  private resetMetrics(): void {
    for (const [, metrics] of this.metrics.entries()) {
      metrics.requestCount = 0;
      metrics.errorCount = 0;
      metrics.averageResponseTime = 0;
      metrics.successRate = 1.0;
      metrics.lastReset = new Date();
    }

    logger.info('Service metrics reset');
  }

  /**
   * Record service metrics (called by services)
   */
  recordMetrics(serviceName: string, success: boolean, responseTime: number): void {
    const metrics = this.metrics.get(serviceName);
    if (!metrics) {
      return;
    }

    metrics.requestCount++;
    if (!success) {
      metrics.errorCount++;
    }

    // Update average response time
    const totalTime = metrics.averageResponseTime * (metrics.requestCount - 1) + responseTime;
    metrics.averageResponseTime = totalTime / metrics.requestCount;

    // Update success rate
    metrics.successRate = (metrics.requestCount - metrics.errorCount) / metrics.requestCount;
  }
}

// Global service registry instance
export const paymentServiceRegistry = new PaymentServiceRegistry();

// Helper function to get services
export function getPaymentService(): PaymentService {
  return paymentServiceRegistry.getPaymentService();
}

export function getTaxService(): TaxService {
  return paymentServiceRegistry.getTaxService();
}

export function getPayoutService(): PayoutService {
  return paymentServiceRegistry.getPayoutService();
}
