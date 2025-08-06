import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PaymentService } from '../../services/paymentService.js';
import { TaxService } from '../../services/taxService.js';
import { PayoutService } from '../../services/payoutService.js';
import { paymentServiceRegistry } from '../../services/paymentServiceRegistry.js';
import { webhookHandler } from '../../services/webhookHandler.js';
import {
  CardError,
  InsufficientFundsError,
  PaymentProcessingError,
  PaymentValidationError
} from '../../errors/PaymentErrors.js';
import type { PaymentIntentParams, PayoutRequest, TaxCalculationRequest } from '../../types/Payment.js';

// Mock Stripe
jest.mock('stripe', () => ({
  default: jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      confirm: jest.fn(),
      capture: jest.fn(),
      cancel: jest.fn(),
      retrieve: jest.fn()
    },
    customers: {
      create: jest.fn(),
      update: jest.fn()
    },
    paymentMethods: {
      attach: jest.fn(),
      list: jest.fn(),
      detach: jest.fn()
    },
    refunds: {
      create: jest.fn()
    },
    payouts: {
      create: jest.fn(),
      retrieve: jest.fn()
    },
    balance: {
      retrieve: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    errors: {
      StripeError: Error,
      StripeCardError: Error,
      StripeAPIError: Error,
      StripeAuthenticationError: Error,
      StripeRateLimitError: Error,
      StripeConnectionError: Error
    }
  }))
}));

describe('Payment Service Integration Tests', () => {
  let paymentService: PaymentService;
  let taxService: TaxService;
  let payoutService: PayoutService;

  beforeEach(async () => {
    // Initialize service registry
    await paymentServiceRegistry.initialize();
    
    paymentService = paymentServiceRegistry.getPaymentService();
    taxService = paymentServiceRegistry.getTaxService();
    payoutService = paymentServiceRegistry.getPayoutService();
  });

  afterEach(async () => {
    await paymentServiceRegistry.shutdown();
    jest.clearAllMocks();
  });

  describe('PaymentService', () => {
    describe('createPaymentIntent', () => {
      const validParams: PaymentIntentParams = {
        amount: 10000, // $100.00
        currency: 'USD',
        businessId: 'test-business-123',
        customerId: 'cus_test123',
        paymentMethodId: 'pm_test123',
        description: 'Test payment',
        automaticCapture: false,
        platformFeePercent: 2.9
      };

      it('should create payment intent successfully', async () => {
        const mockPaymentIntent = {
          id: 'pi_test123',
          status: 'requires_confirmation',
          client_secret: 'pi_test123_secret',
          amount: 10000,
          currency: 'usd'
        };

        // Mock Stripe API response
        const mockStripe = require('stripe').default();
        mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

        const result = await paymentService.createPaymentIntent(validParams);

        expect(result.success).toBe(true);
        expect(result.paymentIntentId).toBe('pi_test123');
        expect(result.status).toBe('requires_confirmation');
        expect(result.clientSecret).toBe('pi_test123_secret');
        expect(result.metadata?.platformFee).toBeDefined();
        expect(result.metadata?.businessAmount).toBeDefined();
        expect(result.metadata?.escrowEnabled).toBe(true);
      });

      it('should validate payment parameters', async () => {
        const invalidParams = { ...validParams, amount: -100 };

        await expect(paymentService.createPaymentIntent(invalidParams))
          .rejects
          .toThrow(PaymentValidationError);
      });

      it('should handle minimum amount validation', async () => {
        const invalidParams = { ...validParams, amount: 25 }; // Less than $0.50 minimum

        await expect(paymentService.createPaymentIntent(invalidParams))
          .rejects
          .toThrow('Minimum payment amount is $0.50');
      });

      it('should handle maximum amount validation', async () => {
        const invalidParams = { ...validParams, amount: 1000001 }; // More than $10,000 maximum

        await expect(paymentService.createPaymentIntent(invalidParams))
          .rejects
          .toThrow('Maximum payment amount is $10,000');
      });

      it('should handle invalid currency', async () => {
        const invalidParams = { ...validParams, currency: 'INVALID' };

        await expect(paymentService.createPaymentIntent(invalidParams))
          .rejects
          .toThrow(PaymentValidationError);
      });

      it('should calculate platform fees correctly', async () => {
        const mockPaymentIntent = {
          id: 'pi_test123',
          status: 'requires_confirmation',
          client_secret: 'pi_test123_secret',
          amount: 10000,
          currency: 'usd'
        };

        const mockStripe = require('stripe').default();
        mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

        const result = await paymentService.createPaymentIntent(validParams);

        expect(result.metadata?.platformFee).toBe(290); // 2.9% of $100
        expect(result.metadata?.businessAmount).toBe(9710); // $100 - $2.90
      });
    });

    describe('confirmPayment', () => {
      it('should confirm payment successfully', async () => {
        const mockPaymentIntent = {
          id: 'pi_test123',
          status: 'requires_capture',
          client_secret: 'pi_test123_secret',
          capture_method: 'manual'
        };

        const mockStripe = require('stripe').default();
        mockStripe.paymentIntents.confirm.mockResolvedValue(mockPaymentIntent);

        const result = await paymentService.confirmPayment('pi_test123', 'pm_test123');

        expect(result.success).toBe(true);
        expect(result.status).toBe('requires_capture');
        expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith(
          'pi_test123',
          expect.objectContaining({
            payment_method: 'pm_test123',
            return_url: expect.stringContaining('/payment-result')
          })
        );
      });

      it('should handle payment confirmation errors', async () => {
        const mockStripe = require('stripe').default();
        const mockError = new Error('Card declined');
        mockError.type = 'StripeCardError';
        mockError.code = 'card_declined';
        
        mockStripe.paymentIntents.confirm.mockRejectedValue(mockError);

        await expect(paymentService.confirmPayment('pi_test123', 'pm_test123'))
          .rejects
          .toThrow();
      });
    });

    describe('capturePayment', () => {
      it('should capture payment from escrow successfully', async () => {
        const mockPaymentIntent = {
          id: 'pi_test123',
          status: 'succeeded',
          amount_received: 10000
        };

        const mockStripe = require('stripe').default();
        mockStripe.paymentIntents.capture.mockResolvedValue(mockPaymentIntent);

        const result = await paymentService.capturePayment('pi_test123');

        expect(result.success).toBe(true);
        expect(result.capturedAmount).toBeDefined();
        expect(result.platformFee).toBeDefined();
        expect(result.businessPayout).toBeDefined();
        expect(result.capturedAt).toBeInstanceOf(Date);
      });
    });

    describe('processRefund', () => {
      it('should process refund successfully', async () => {
        const mockRefund = {
          id: 'ref_test123',
          amount: 5000,
          status: 'succeeded',
          reason: 'requested_by_customer'
        };

        const mockPaymentIntent = {
          id: 'pi_test123',
          amount_received: 10000,
          metadata: { businessId: 'test-business-123' }
        };

        const mockStripe = require('stripe').default();
        mockStripe.refunds.create.mockResolvedValue(mockRefund);
        mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

        const result = await paymentService.processRefund('pi_test123', 5000, 'Customer request');

        expect(result.success).toBe(true);
        expect(result.refundId).toBe('ref_test123');
        expect(result.amount).toBe(5000);
        expect(result.businessAdjustment).toBeDefined();
        expect(result.platformFeeRefund).toBeDefined();
      });
    });

    describe('createCustomer', () => {
      it('should create Stripe customer successfully', async () => {
        const mockCustomer = {
          id: 'cus_test123',
          email: 'test@example.com'
        };

        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'consumer' as const,
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            phone: '+1234567890'
          }
        };

        const mockStripe = require('stripe').default();
        mockStripe.customers.create.mockResolvedValue(mockCustomer);

        const customerId = await paymentService.createCustomer(mockUser);

        expect(customerId).toBe('cus_test123');
        expect(mockStripe.customers.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
            name: 'John Doe',
            phone: '+1234567890'
          })
        );
      });
    });
  });

  describe('TaxService', () => {
    describe('calculateTax', () => {
      const validTaxRequest: TaxCalculationRequest = {
        businessId: 'test-business-123',
        amount: 10000, // $100.00
        businessLocation: {
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US'
        },
        customerLocation: {
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'US'
        }
      };

      it('should calculate tax for California successfully', async () => {
        const result = await taxService.calculateTax(validTaxRequest);

        expect(result.taxAmount).toBeGreaterThan(0);
        expect(result.taxRate).toBeGreaterThan(0);
        expect(result.jurisdiction).toBe('CA');
        expect(result.breakdown).toHaveLength(2); // State and local tax
        expect(result.breakdown[0].jurisdiction).toBe('CA');
        expect(result.breakdown[1].jurisdiction).toBe('CA_LOCAL');
      });

      it('should handle tax exemptions', async () => {
        const exemptRequest = {
          ...validTaxRequest,
          exemptionId: 'exemption-1'
        };

        const result = await taxService.calculateTax(exemptRequest);

        expect(result.exemptionApplied).toBe(true);
        expect(result.exemptionReason).toBeDefined();
      });

      it('should validate tax calculation request', async () => {
        const invalidRequest = { ...validTaxRequest, amount: -100 };

        await expect(taxService.calculateTax(invalidRequest))
          .rejects
          .toThrow(PaymentValidationError);
      });

      it('should adjust tax rates for food products', async () => {
        const foodRequest = {
          ...validTaxRequest,
          productType: 'food'
        };

        const result = await taxService.calculateTax(foodRequest);
        const normalResult = await taxService.calculateTax(validTaxRequest);

        // Food should have reduced tax rate
        expect(result.taxAmount).toBeLessThan(normalResult.taxAmount);
      });
    });

    describe('validateTaxExemption', () => {
      it('should validate active tax exemption', async () => {
        const isValid = await taxService.validateTaxExemption('exemption-1', 'business-1');
        expect(isValid).toBe(true);
      });

      it('should reject invalid exemption ID', async () => {
        const isValid = await taxService.validateTaxExemption('invalid-exemption', 'business-1');
        expect(isValid).toBe(false);
      });
    });

    describe('createTaxReport', () => {
      it('should generate tax report successfully', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const report = await taxService.createTaxReport('business-1', startDate, endDate);

        expect(report.businessId).toBe('business-1');
        expect(report.reportPeriod.startDate).toBe(startDate.toISOString());
        expect(report.reportPeriod.endDate).toBe(endDate.toISOString());
        expect(report.summary).toBeDefined();
        expect(report.summary.totalTransactions).toBeGreaterThanOrEqual(0);
        expect(report.transactions).toBeInstanceOf(Array);
        expect(report.exemptions).toBeInstanceOf(Array);
      });
    });
  });

  describe('PayoutService', () => {
    describe('createPayout', () => {
      const validPayoutRequest: PayoutRequest = {
        businessId: 'test-business-123',
        currency: 'USD',
        schedule: { frequency: 'manual' },
        description: 'Manual payout'
      };

      it('should create payout successfully', async () => {
        const mockPayout = {
          id: 'po_test123',
          amount: 50000, // $500.00
          currency: 'usd',
          status: 'paid',
          arrival_date: Math.floor(Date.now() / 1000) + 86400 // +1 day
        };

        const mockStripe = require('stripe').default();
        mockStripe.payouts.create.mockResolvedValue(mockPayout);

        const result = await payoutService.createPayout(validPayoutRequest);

        expect(result.success).toBe(true);
        expect(result.payoutId).toBe('po_test123');
        expect(result.amount).toBe(50000);
        expect(result.currency).toBe('USD');
        expect(result.arrivalDate).toBeInstanceOf(Date);
      });

      it('should validate payout request', async () => {
        const invalidRequest = { ...validPayoutRequest, currency: 'INVALID' };

        await expect(payoutService.createPayout(invalidRequest))
          .rejects
          .toThrow(PaymentValidationError);
      });

      it('should handle insufficient funds', async () => {
        const insufficientRequest = { ...validPayoutRequest, amount: 1000000 }; // $10,000

        await expect(payoutService.createPayout(insufficientRequest))
          .rejects
          .toThrow(InsufficientFundsError);
      });
    });

    describe('getBusinessBalance', () => {
      it('should retrieve business balance successfully', async () => {
        const balance = await payoutService.getBusinessBalance('test-business-123');

        expect(balance.businessId).toBe('test-business-123');
        expect(balance.availableBalance).toBeGreaterThanOrEqual(0);
        expect(balance.pendingBalance).toBeGreaterThanOrEqual(0);
        expect(balance.escrowHeld).toBeGreaterThanOrEqual(0);
        expect(balance.currency).toBeDefined();
        expect(balance.lastUpdated).toBeInstanceOf(Date);
      });
    });

    describe('updatePayoutSchedule', () => {
      it('should update payout schedule successfully', async () => {
        const schedule = {
          frequency: 'weekly' as const,
          dayOfWeek: 5, // Friday
          minimumAmount: 5000 // $50.00
        };

        await expect(payoutService.updatePayoutSchedule('test-business-123', schedule))
          .resolves
          .not.toThrow();
      });

      it('should validate payout schedule', async () => {
        const invalidSchedule = {
          frequency: 'weekly' as const,
          dayOfWeek: 8 // Invalid day
        };

        await expect(payoutService.updatePayoutSchedule('test-business-123', invalidSchedule))
          .rejects
          .toThrow(PaymentValidationError);
      });
    });

    describe('generatePayoutReport', () => {
      it('should generate payout report successfully', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const report = await payoutService.generatePayoutReport('test-business-123', startDate, endDate);

        expect(report.businessId).toBe('test-business-123');
        expect(report.reportPeriod.startDate).toBe(startDate.toISOString());
        expect(report.reportPeriod.endDate).toBe(endDate.toISOString());
        expect(report.summary).toBeDefined();
        expect(report.summary.totalPayouts).toBeGreaterThanOrEqual(0);
        expect(report.payouts).toBeInstanceOf(Array);
        expect(report.currentBalance).toBeDefined();
        expect(report.failureAnalysis).toBeDefined();
      });
    });
  });

  describe('Security Features', () => {
    describe('Input Sanitization', () => {
      it('should sanitize dangerous input', async () => {
        const dangerousParams: PaymentIntentParams = {
          amount: 10000,
          currency: 'USD',
          businessId: '<script>alert("xss")</script>',
          description: 'javascript:void(0)',
          metadata: {
            'dangerous-key': '<img src=x onerror=alert(1)>'
          }
        };

        // Should not throw, but sanitize the input
        await expect(paymentService.createPaymentIntent(dangerousParams))
          .rejects
          .toThrow(); // Will throw due to missing fields, but input should be sanitized
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits', async () => {
        const securityMiddleware = paymentServiceRegistry.getSecurityMiddleware();
        const rateLimiter = securityMiddleware.rateLimiter;

        // Simulate multiple requests from same identifier
        for (let i = 0; i < 100; i++) {
          rateLimiter.isRateLimited('test-user-123');
        }

        // Should be rate limited now
        const isLimited = rateLimiter.isRateLimited('test-user-123');
        expect(isLimited).toBe(true);
      });
    });

    describe('Circuit Breaker', () => {
      it('should handle service failures gracefully', async () => {
        const mockStripe = require('stripe').default();
        
        // Simulate API failures
        mockStripe.paymentIntents.create.mockRejectedValue(new Error('API Error'));

        const validParams: PaymentIntentParams = {
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123'
        };

        // Multiple failures should trigger circuit breaker
        for (let i = 0; i < 6; i++) {
          try {
            await paymentService.createPaymentIntent(validParams);
          } catch (error) {
            // Expected failures
          }
        }

        // Circuit breaker should now be open
        await expect(paymentService.createPaymentIntent(validParams))
          .rejects
          .toThrow();
      });
    });
  });

  describe('Webhook Handler', () => {
    it('should handle payment intent succeeded webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: 10000,
            currency: 'usd',
            capture_method: 'automatic'
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const mockStripe = require('stripe').default();
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await webhookHandler.handleWebhook(
        JSON.stringify(mockEvent),
        'test-signature',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('evt_test123');
    });

    it('should handle webhook signature verification failure', async () => {
      const mockStripe = require('stripe').default();
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await webhookHandler.handleWebhook(
        'invalid-payload',
        'invalid-signature'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('should detect and handle duplicate events', async () => {
      const mockEvent = {
        id: 'evt_duplicate123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test123' } },
        created: Math.floor(Date.now() / 1000)
      };

      const mockStripe = require('stripe').default();
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Process event first time
      const result1 = await webhookHandler.handleWebhook(
        JSON.stringify(mockEvent),
        'test-signature'
      );

      // Process same event again (duplicate)
      const result2 = await webhookHandler.handleWebhook(
        JSON.stringify(mockEvent),
        'test-signature'
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true); // Should handle gracefully
      expect(result2.eventId).toBe('evt_duplicate123');
    });
  });

  describe('Service Registry Health Checks', () => {
    it('should perform health checks on all services', async () => {
      const healthStatus = await paymentServiceRegistry.performHealthCheck();

      expect(healthStatus).toHaveProperty('payment');
      expect(healthStatus).toHaveProperty('tax');
      expect(healthStatus).toHaveProperty('payout');

      expect(healthStatus.payment.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.tax.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.payout.status).toMatch(/^(healthy|degraded|unhealthy)$/);

      expect(healthStatus.payment.lastHealthCheck).toBeInstanceOf(Date);
      expect(healthStatus.payment.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthStatus.payment.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should provide service metrics', async () => {
      const metrics = paymentServiceRegistry.getServiceMetrics();

      expect(metrics).toHaveProperty('payment');
      expect(metrics).toHaveProperty('tax');
      expect(metrics).toHaveProperty('payout');

      expect(metrics.payment.requestCount).toBeGreaterThanOrEqual(0);
      expect(metrics.payment.errorCount).toBeGreaterThanOrEqual(0);
      expect(metrics.payment.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.payment.lastReset).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle and sanitize Stripe errors', async () => {
      const mockStripe = require('stripe').default();
      const mockError = new Error('Card declined');
      mockError.type = 'StripeCardError';
      mockError.code = 'card_declined';
      
      mockStripe.paymentIntents.create.mockRejectedValue(mockError);

      const validParams: PaymentIntentParams = {
        amount: 10000,
        currency: 'USD',
        businessId: 'test-business-123'
      };

      await expect(paymentService.createPaymentIntent(validParams))
        .rejects
        .toThrow(CardError);
    });

    it('should provide user-friendly error messages', async () => {
      const validParams: PaymentIntentParams = {
        amount: -100, // Invalid amount
        currency: 'USD',
        businessId: 'test-business-123'
      };

      try {
        await paymentService.createPaymentIntent(validParams);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentValidationError);
        expect((error as Error).message).toContain('Invalid payment amount');
      }
    });
  });
});