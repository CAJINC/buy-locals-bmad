import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PayoutService } from '../../src/services/payoutService.js';
import { BusinessBalance, PayoutRequest, PayoutResult } from '../../src/types/Payment.js';
import { InsufficientFundsError, PaymentValidationError } from '../../src/errors/PaymentErrors.js';
import PaymentTestData from '../utils/paymentTestData.js';
import StripeTestHelpers from '../utils/stripeTestHelpers.js';

// Mock Stripe
jest.mock('stripe', () => ({
  default: jest.fn(() => StripeTestHelpers.getMockStripe()),
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PayoutService', () => {
  let payoutService: PayoutService;
  let mockStripe: any;

  beforeEach(() => {
    StripeTestHelpers.initializeMocks();
    mockStripe = StripeTestHelpers.getMockStripe();
    payoutService = new PayoutService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    StripeTestHelpers.resetMocks();
    jest.resetAllMocks();
  });

  describe('createPayout', () => {
    it('should create payout successfully', async () => {
      const mockPayout = {
        id: 'po_test_payout',
        amount: 50000, // $500.00
        currency: 'usd',
        status: 'paid',
        arrival_date: Math.floor(Date.now() / 1000) + 86400, // +1 day
        metadata: {
          businessId: 'test-business-123',
        },
      };

      mockStripe.payouts.create.mockResolvedValue(mockPayout);
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 100000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const request: PayoutRequest = PaymentTestData.createPayoutRequest({
        amount: 50000,
      });

      const result = await payoutService.createPayout(request);

      expect(result.success).toBe(true);
      expect(result.payoutId).toBe('po_test_payout');
      expect(result.amount).toBe(50000);
      expect(result.currency).toBe('USD');
      expect(result.arrivalDate).toBeInstanceOf(Date);
      
      expect(mockStripe.payouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'USD',
          destination: expect.stringContaining('acct_'),
        })
      );
    });

    it('should handle automatic payout creation', async () => {
      const mockPayout = {
        id: 'po_auto_payout',
        amount: 25000, // $250.00
        currency: 'usd',
        status: 'in_transit',
        arrival_date: Math.floor(Date.now() / 1000) + 86400,
      };

      mockStripe.payouts.create.mockResolvedValue(mockPayout);
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 50000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const request: PayoutRequest = PaymentTestData.createPayoutRequest({
        amount: undefined, // Auto-calculate from available balance
        schedule: {
          frequency: 'automatic',
        },
      });

      const result = await payoutService.createPayout(request);

      expect(result.success).toBe(true);
      expect(result.payoutId).toBe('po_auto_payout');
      expect(result.amount).toBeGreaterThan(0);
    });

    it('should validate payout request', async () => {
      const invalidRequests = [
        // Invalid currency
        PaymentTestData.createPayoutRequest({ currency: 'INVALID' }),
        // Negative amount
        PaymentTestData.createPayoutRequest({ amount: -1000 }),
        // Missing business ID
        PaymentTestData.createPayoutRequest({ businessId: '' }),
      ];

      for (const request of invalidRequests) {
        await expect(payoutService.createPayout(request))
          .rejects
          .toThrow(PaymentValidationError);
      }
    });

    it('should handle insufficient funds', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 1000, currency: 'usd' }], // Only $10.00 available
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const request: PayoutRequest = PaymentTestData.createPayoutRequest({
        amount: 100000, // Requesting $1,000.00
      });

      await expect(payoutService.createPayout(request))
        .rejects
        .toThrow(InsufficientFundsError);
    });

    it('should respect minimum payout amounts', async () => {
      const request: PayoutRequest = PaymentTestData.createPayoutRequest({
        amount: 50, // $0.50 (below minimum)
      });

      await expect(payoutService.createPayout(request))
        .rejects
        .toThrow('Minimum payout amount is $1.00');
    });

    it('should handle Stripe payout errors', async () => {
      const stripeError = new Error('Insufficient funds in Stripe account');
      stripeError.type = 'StripeError';
      stripeError.code = 'balance_insufficient';

      mockStripe.payouts.create.mockRejectedValue(stripeError);
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 100000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const request: PayoutRequest = PaymentTestData.createPayoutRequest();

      await expect(payoutService.createPayout(request))
        .rejects
        .toThrow();
    });
  });

  describe('getBusinessBalance', () => {
    it('should retrieve business balance successfully', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [
          { amount: 50000, currency: 'usd' },
          { amount: 25000, currency: 'cad' },
        ],
        pending: [
          { amount: 10000, currency: 'usd' },
        ],
      });

      const balance = await payoutService.getBusinessBalance('test-business-123');

      expect(balance.businessId).toBe('test-business-123');
      expect(balance.availableBalance).toBe(50000);
      expect(balance.pendingBalance).toBe(10000);
      expect(balance.currency).toBe('USD');
      expect(balance.lastUpdated).toBeInstanceOf(Date);
      expect(balance.escrowHeld).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero balance', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 0, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const balance = await payoutService.getBusinessBalance('test-business-123');

      expect(balance.availableBalance).toBe(0);
      expect(balance.pendingBalance).toBe(0);
    });

    it('should handle multi-currency balances', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [
          { amount: 50000, currency: 'usd' },
          { amount: 65000, currency: 'cad' },
          { amount: 45000, currency: 'eur' },
        ],
        pending: [],
      });

      const balance = await payoutService.getBusinessBalance('test-business-123');

      expect(balance.multiCurrencyBalances).toBeDefined();
      expect(balance.multiCurrencyBalances).toHaveLength(3);
      expect(balance.multiCurrencyBalances).toContainEqual(
        expect.objectContaining({ currency: 'USD', amount: 50000 })
      );
      expect(balance.multiCurrencyBalances).toContainEqual(
        expect.objectContaining({ currency: 'CAD', amount: 65000 })
      );
      expect(balance.multiCurrencyBalances).toContainEqual(
        expect.objectContaining({ currency: 'EUR', amount: 45000 })
      );
    });

    it('should include reserved funds in balance calculation', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 50000, currency: 'usd' }],
        pending: [{ amount: 10000, currency: 'usd' }],
        connect_reserved: [{ amount: 5000, currency: 'usd' }],
      });

      const balance = await payoutService.getBusinessBalance('test-business-123');

      expect(balance.reservedFunds).toBe(5000);
      expect(balance.totalBalance).toBe(65000); // available + pending + reserved
    });
  });

  describe('updatePayoutSchedule', () => {
    it('should update payout schedule successfully', async () => {
      const schedule = {
        frequency: 'weekly' as const,
        dayOfWeek: 5, // Friday
        minimumAmount: 5000, // $50.00
      };

      await expect(payoutService.updatePayoutSchedule('test-business-123', schedule))
        .resolves
        .not.toThrow();

      // Verify schedule was stored
      const storedSchedule = await payoutService.getPayoutSchedule('test-business-123');
      expect(storedSchedule.frequency).toBe('weekly');
      expect(storedSchedule.dayOfWeek).toBe(5);
      expect(storedSchedule.minimumAmount).toBe(5000);
    });

    it('should validate payout schedule parameters', async () => {
      const invalidSchedules = [
        // Invalid day of week
        { frequency: 'weekly' as const, dayOfWeek: 8 },
        // Invalid minimum amount
        { frequency: 'weekly' as const, minimumAmount: -100 },
        // Invalid frequency
        { frequency: 'invalid' as any },
      ];

      for (const schedule of invalidSchedules) {
        await expect(payoutService.updatePayoutSchedule('test-business-123', schedule))
          .rejects
          .toThrow(PaymentValidationError);
      }
    });

    it('should handle daily schedule correctly', async () => {
      const schedule = {
        frequency: 'daily' as const,
        minimumAmount: 1000, // $10.00
      };

      await expect(payoutService.updatePayoutSchedule('test-business-123', schedule))
        .resolves
        .not.toThrow();

      const storedSchedule = await payoutService.getPayoutSchedule('test-business-123');
      expect(storedSchedule.frequency).toBe('daily');
      expect(storedSchedule.minimumAmount).toBe(1000);
    });

    it('should handle monthly schedule correctly', async () => {
      const schedule = {
        frequency: 'monthly' as const,
        dayOfMonth: 15, // 15th of each month
        minimumAmount: 10000, // $100.00
      };

      await expect(payoutService.updatePayoutSchedule('test-business-123', schedule))
        .resolves
        .not.toThrow();

      const storedSchedule = await payoutService.getPayoutSchedule('test-business-123');
      expect(storedSchedule.frequency).toBe('monthly');
      expect(storedSchedule.dayOfMonth).toBe(15);
    });
  });

  describe('generatePayoutReport', () => {
    it('should generate payout report successfully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock payout data
      mockStripe.payouts.list.mockResolvedValue({
        data: [
          {
            id: 'po_test_1',
            amount: 50000,
            currency: 'usd',
            status: 'paid',
            arrival_date: Math.floor(new Date('2024-01-15').getTime() / 1000),
            created: Math.floor(new Date('2024-01-14').getTime() / 1000),
            failure_code: null,
          },
          {
            id: 'po_test_2',
            amount: 75000,
            currency: 'usd',
            status: 'paid',
            arrival_date: Math.floor(new Date('2024-01-25').getTime() / 1000),
            created: Math.floor(new Date('2024-01-24').getTime() / 1000),
            failure_code: null,
          },
        ],
        has_more: false,
      });

      const report = await payoutService.generatePayoutReport('test-business-123', startDate, endDate);

      expect(report.businessId).toBe('test-business-123');
      expect(report.reportPeriod.startDate).toBe(startDate.toISOString());
      expect(report.reportPeriod.endDate).toBe(endDate.toISOString());
      expect(report.summary).toBeDefined();
      expect(report.summary.totalPayouts).toBe(2);
      expect(report.summary.totalAmount).toBe(125000); // $1,250.00
      expect(report.payouts).toHaveLength(2);
      expect(report.currentBalance).toBeDefined();
    });

    it('should include failure analysis in report', async () => {
      mockStripe.payouts.list.mockResolvedValue({
        data: [
          {
            id: 'po_success',
            amount: 50000,
            currency: 'usd',
            status: 'paid',
            arrival_date: Math.floor(new Date('2024-01-15').getTime() / 1000),
            created: Math.floor(new Date('2024-01-14').getTime() / 1000),
            failure_code: null,
          },
          {
            id: 'po_failed',
            amount: 25000,
            currency: 'usd',
            status: 'failed',
            arrival_date: null,
            created: Math.floor(new Date('2024-01-20').getTime() / 1000),
            failure_code: 'insufficient_funds',
            failure_message: 'Insufficient funds in Stripe account',
          },
        ],
        has_more: false,
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await payoutService.generatePayoutReport('test-business-123', startDate, endDate);

      expect(report.failureAnalysis).toBeDefined();
      expect(report.failureAnalysis.totalFailed).toBe(1);
      expect(report.failureAnalysis.failureRate).toBeCloseTo(0.5, 2); // 50% failure rate
      expect(report.failureAnalysis.commonFailureReasons).toContain('insufficient_funds');
      expect(report.failureAnalysis.recommendations).toBeInstanceOf(Array);
    });

    it('should handle empty date range gracefully', async () => {
      mockStripe.payouts.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01');

      const report = await payoutService.generatePayoutReport('test-business-123', startDate, endDate);

      expect(report.summary.totalPayouts).toBe(0);
      expect(report.summary.totalAmount).toBe(0);
      expect(report.payouts).toHaveLength(0);
    });

    it('should validate date range', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01'); // End before start

      await expect(payoutService.generatePayoutReport('test-business-123', startDate, endDate))
        .rejects
        .toThrow('End date must be after start date');
    });
  });

  describe('processScheduledPayouts', () => {
    it('should process scheduled payouts correctly', async () => {
      // Setup business with weekly payout schedule
      await payoutService.updatePayoutSchedule('test-business-123', {
        frequency: 'weekly',
        dayOfWeek: 5, // Friday
        minimumAmount: 5000, // $50.00
      });

      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 10000, currency: 'usd' }], // $100.00 available
        pending: [{ amount: 0, currency: 'usd' }],
      });

      mockStripe.payouts.create.mockResolvedValue({
        id: 'po_scheduled_payout',
        amount: 10000,
        currency: 'usd',
        status: 'in_transit',
        arrival_date: Math.floor(Date.now() / 1000) + 86400,
      });

      // Mock it being Friday
      const mockFriday = new Date('2024-01-05'); // A Friday
      jest.spyOn(Date, 'now').mockReturnValue(mockFriday.getTime());

      const results = await payoutService.processScheduledPayouts();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      const businessResult = results.find(r => r.businessId === 'test-business-123');
      expect(businessResult).toBeDefined();
      expect(businessResult?.success).toBe(true);
      expect(businessResult?.payoutId).toBe('po_scheduled_payout');
    });

    it('should skip payouts below minimum amount', async () => {
      await payoutService.updatePayoutSchedule('test-business-123', {
        frequency: 'daily',
        minimumAmount: 10000, // $100.00 minimum
      });

      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 5000, currency: 'usd' }], // Only $50.00 available
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const results = await payoutService.processScheduledPayouts();

      const businessResult = results.find(r => r.businessId === 'test-business-123');
      expect(businessResult).toBeDefined();
      expect(businessResult?.success).toBe(false);
      expect(businessResult?.reason).toContain('below minimum amount');
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors', async () => {
      const stripeError = new Error('API Error');
      stripeError.type = 'StripeAPIError';
      
      mockStripe.balance.retrieve.mockRejectedValue(stripeError);

      await expect(payoutService.getBusinessBalance('test-business-123'))
        .rejects
        .toThrow();
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      mockStripe.payouts.create.mockRejectedValue(timeoutError);
      
      const request = PaymentTestData.createPayoutRequest();

      await expect(payoutService.createPayout(request))
        .rejects
        .toThrow();
    });

    it('should sanitize error messages', async () => {
      const errorWithSensitiveData = new Error('Failed: account sk_live_123456789');
      
      mockStripe.payouts.create.mockRejectedValue(errorWithSensitiveData);
      
      const request = PaymentTestData.createPayoutRequest();

      try {
        await payoutService.createPayout(request);
        fail('Should have thrown an error');
      } catch (error) {
        // Should not include sensitive account information
        expect((error as Error).message).not.toContain('sk_live_');
      }
    });
  });

  describe('Performance', () => {
    it('should handle concurrent payout requests', async () => {
      mockStripe.payouts.create.mockResolvedValue({
        id: 'po_concurrent_test',
        amount: 10000,
        currency: 'usd',
        status: 'paid',
        arrival_date: Math.floor(Date.now() / 1000) + 86400,
      });

      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 100000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        PaymentTestData.createPayoutRequest({
          businessId: `business-${i}`,
          amount: 10000,
        })
      );

      const promises = requests.map(request => payoutService.createPayout(request));
      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.payoutId).toBe('po_concurrent_test');
      });
    });

    it('should complete payout operations within time limits', async () => {
      mockStripe.payouts.create.mockResolvedValue({
        id: 'po_performance_test',
        amount: 50000,
        currency: 'usd',
        status: 'paid',
        arrival_date: Math.floor(Date.now() / 1000) + 86400,
      });

      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 100000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      const request = PaymentTestData.createPayoutRequest();

      const start = Date.now();
      await payoutService.createPayout(request);
      const end = Date.now();

      // Should complete within 2 seconds
      expect(end - start).toBeLessThan(2000);
    });
  });
});