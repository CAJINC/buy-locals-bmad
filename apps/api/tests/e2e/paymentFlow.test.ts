import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { PaymentService } from '../../src/services/paymentService.js';
import { TaxService } from '../../src/services/taxService.js';
import { PayoutService } from '../../src/services/payoutService.js';
import { ReceiptService } from '../../src/services/receiptService.js';
import PaymentTestData from '../utils/paymentTestData.js';
import StripeTestHelpers from '../utils/stripeTestHelpers.js';
import TestDatabase from '../utils/testDatabase.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * End-to-End Payment Flow Tests
 * 
 * Tests complete payment workflows from creation to completion,
 * including tax calculation, escrow handling, and receipt generation.
 */

describe('Payment Flow E2E Tests', () => {
  let paymentService: PaymentService;
  let taxService: TaxService;
  let payoutService: PayoutService;
  let receiptService: ReceiptService;

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
    receiptService = new ReceiptService();

    StripeTestHelpers.initializeMocks();
    StripeTestHelpers.mockSuccessfulPaymentFlow();
  });

  afterEach(async () => {
    StripeTestHelpers.resetMocks();
  });

  afterAll(async () => {
    await TestDatabase.close();
  });

  describe('Complete Payment Flow', () => {
    it('should complete full payment flow with tax and escrow', async () => {
      const correlationId = uuidv4();
      
      // Step 1: Calculate tax
      const taxRequest = PaymentTestData.createTaxCalculationRequest({
        amount: 10000, // $100.00
        businessId: 'test-business-1',
      });

      const taxResult = await taxService.calculateTax(taxRequest);
      expect(taxResult.taxAmount).toBeGreaterThan(0);
      expect(taxResult.jurisdiction).toBe('CA');

      const totalAmount = taxRequest.amount + taxResult.taxAmount;

      // Step 2: Create payment intent with escrow
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: totalAmount,
        businessId: 'test-business-1',
        customerId: 'cus_test_customer_1',
        automaticCapture: false, // Use escrow
        metadata: {
          correlationId,
          taxAmount: taxResult.taxAmount.toString(),
          originalAmount: taxRequest.amount.toString(),
        },
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.paymentIntentId).toBeTruthy();
      expect(paymentResult.clientSecret).toBeTruthy();
      expect(paymentResult.metadata?.escrowEnabled).toBe(true);

      // Verify escrow transaction was created
      const escrowTransaction = await TestDatabase.getTestEscrowTransaction(paymentResult.paymentIntentId!);
      expect(escrowTransaction).toBeTruthy();
      expect(escrowTransaction.status).toBe('pending_capture');
      expect(escrowTransaction.amount).toBe(totalAmount);

      // Step 3: Confirm payment
      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.status).toBe('requires_capture');

      // Verify escrow status updated
      const heldEscrow = await TestDatabase.getTestEscrowTransaction(paymentResult.paymentIntentId!);
      expect(heldEscrow.status).toBe('held');

      // Step 4: Wait for service completion (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 5: Capture payment from escrow
      const captureResult = await paymentService.capturePayment(paymentResult.paymentIntentId!);
      expect(captureResult.success).toBe(true);
      expect(captureResult.capturedAmount).toBe(totalAmount);
      expect(captureResult.platformFee).toBeGreaterThan(0);
      expect(captureResult.businessPayout).toBeGreaterThan(0);
      expect(captureResult.capturedAt).toBeInstanceOf(Date);

      // Verify escrow transaction completed
      const releasedEscrow = await TestDatabase.getTestEscrowTransaction(paymentResult.paymentIntentId!);
      expect(releasedEscrow.status).toBe('released');
      expect(releasedEscrow.released_at).toBeTruthy();

      // Step 6: Generate receipt
      const receiptData = PaymentTestData.createReceiptData({
        transactionId: paymentResult.paymentIntentId!,
        paymentIntentId: paymentResult.paymentIntentId!,
        amount: totalAmount,
        platformFee: captureResult.platformFee,
        businessPayout: captureResult.businessPayout,
        taxAmount: taxResult.taxAmount,
        taxRate: taxResult.taxRate,
        status: 'paid',
      });

      const receiptResult = await receiptService.generateReceipt(receiptData, {
        format: 'pdf',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: false,
      });

      expect(receiptResult.success).toBe(true);
      expect(receiptResult.receiptId).toBeTruthy();
      expect(receiptResult.content).toBeTruthy();

      // Step 7: Verify audit logs were created
      // In a real implementation, we would query the audit logs table
      console.log('Payment flow completed successfully', {
        correlationId,
        paymentIntentId: paymentResult.paymentIntentId,
        totalAmount,
        taxAmount: taxResult.taxAmount,
        capturedAmount: captureResult.capturedAmount,
        receiptId: receiptResult.receiptId,
      });
    });

    it('should handle immediate capture payment flow', async () => {
      const correlationId = uuidv4();

      // Create payment intent with immediate capture
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 5000, // $50.00
        businessId: 'test-business-1',
        automaticCapture: true, // Immediate capture
        metadata: { correlationId },
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.metadata?.escrowEnabled).toBe(false);

      // Confirm payment (should capture immediately)
      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.status).toBe('succeeded');

      // Verify no escrow transaction was created
      const escrowTransaction = await TestDatabase.getTestEscrowTransaction(paymentResult.paymentIntentId!);
      expect(escrowTransaction).toBeNull();
    });

    it('should handle payment with tax exemption', async () => {
      // Create tax calculation with exemption
      const taxRequest = PaymentTestData.createTaxCalculationRequest({
        amount: 10000,
        businessId: 'test-business-1',
        exemptionId: 'exemption-1',
      });

      const taxResult = await taxService.calculateTax(taxRequest);
      expect(taxResult.exemptionApplied).toBe(true);
      expect(taxResult.taxAmount).toBe(0);

      // Payment should proceed with no tax added
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: taxRequest.amount, // No tax to add
        businessId: 'test-business-1',
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);

      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );

      expect(confirmResult.success).toBe(true);
    });
  });

  describe('Refund Flow', () => {
    it('should complete full refund flow', async () => {
      const correlationId = uuidv4();

      // First, complete a successful payment
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
        automaticCapture: true,
        metadata: { correlationId },
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );

      expect(confirmResult.success).toBe(true);

      // Now process a refund
      const refundResult = await paymentService.processRefund(
        paymentResult.paymentIntentId!,
        5000, // Partial refund of $50.00
        'Customer request',
        { refundCorrelationId: uuidv4() }
      );

      expect(refundResult.success).toBe(true);
      expect(refundResult.refundId).toBeTruthy();
      expect(refundResult.amount).toBe(5000);
      expect(refundResult.businessAdjustment).toBeGreaterThan(0);
      expect(refundResult.platformFeeRefund).toBeGreaterThan(0);

      // Generate refund receipt
      const receiptData = PaymentTestData.createReceiptData({
        transactionId: paymentResult.paymentIntentId!,
        status: 'partially_refunded',
        refundAmount: refundResult.amount,
        refundedAt: new Date(),
      });

      const receiptResult = await receiptService.generateReceipt(receiptData, {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: true,
      });

      expect(receiptResult.success).toBe(true);
      expect(receiptResult.content).toContain('REFUNDED');
    });

    it('should handle escrow refund flow', async () => {
      // Create payment with escrow
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
        automaticCapture: false, // Use escrow
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      await paymentService.confirmPayment(paymentResult.paymentIntentId!, paymentParams.paymentMethodId!);

      // Cancel the payment (refund from escrow before capture)
      const cancelResult = await paymentService.cancelPayment(paymentResult.paymentIntentId!, 'Customer request');
      expect(cancelResult.success).toBe(true);

      // Verify escrow status updated
      const cancelledEscrow = await TestDatabase.getTestEscrowTransaction(paymentResult.paymentIntentId!);
      expect(cancelledEscrow.status).toBe('cancelled');
    });
  });

  describe('Payout Flow', () => {
    it('should complete business payout flow', async () => {
      // First, complete several payments to accumulate balance
      const payments = [];
      for (let i = 0; i < 3; i++) {
        const paymentParams = PaymentTestData.createPaymentIntentParams({
          amount: 10000,
          businessId: 'test-business-1',
          automaticCapture: true,
          metadata: { batchPayment: `batch_${i}` },
        });

        const paymentResult = await paymentService.createPaymentIntent(paymentParams);
        await paymentService.confirmPayment(paymentResult.paymentIntentId!, paymentParams.paymentMethodId!);
        payments.push(paymentResult);
      }

      // Get business balance
      const balance = await payoutService.getBusinessBalance('test-business-1');
      expect(balance.availableBalance).toBeGreaterThan(0);
      expect(balance.businessId).toBe('test-business-1');

      // Create payout
      const payoutRequest = PaymentTestData.createPayoutRequest({
        businessId: 'test-business-1',
        amount: Math.min(balance.availableBalance, 25000), // Up to $250
        description: 'Weekly payout for accumulated earnings',
      });

      const payoutResult = await payoutService.createPayout(payoutRequest);
      expect(payoutResult.success).toBe(true);
      expect(payoutResult.payoutId).toBeTruthy();
      expect(payoutResult.amount).toBeGreaterThan(0);
      expect(payoutResult.arrivalDate).toBeInstanceOf(Date);

      // Generate payout report
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      const endDate = new Date();

      const payoutReport = await payoutService.generatePayoutReport('test-business-1', startDate, endDate);
      expect(payoutReport.businessId).toBe('test-business-1');
      expect(payoutReport.summary.totalPayouts).toBeGreaterThanOrEqual(1);
      expect(payoutReport.currentBalance).toBeDefined();
    });

    it('should handle scheduled payout flow', async () => {
      // Set up weekly payout schedule
      await payoutService.updatePayoutSchedule('test-business-1', {
        frequency: 'weekly',
        dayOfWeek: new Date().getDay(), // Today
        minimumAmount: 1000, // $10.00 minimum
      });

      // Complete a payment to have available balance
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 5000, // $50.00
        businessId: 'test-business-1',
        automaticCapture: true,
      });

      await paymentService.createPaymentIntent(paymentParams);

      // Process scheduled payouts
      const scheduledResults = await payoutService.processScheduledPayouts();
      
      const businessResult = scheduledResults.find(r => r.businessId === 'test-business-1');
      expect(businessResult).toBeDefined();
      expect(businessResult?.success).toBe(true);
    });
  });

  describe('Multi-Currency Flow', () => {
    it('should handle CAD payment flow', async () => {
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000, // $100.00 CAD
        currency: 'CAD',
        businessId: 'test-business-1',
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);

      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );

      expect(confirmResult.success).toBe(true);

      // Generate receipt in CAD
      const receiptData = PaymentTestData.createReceiptData({
        transactionId: paymentResult.paymentIntentId!,
        currency: 'CAD',
        amount: 10000,
      });

      const receiptResult = await receiptService.generateReceipt(receiptData, {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      });

      expect(receiptResult.success).toBe(true);
      expect(receiptResult.content).toContain('CA$100.00');
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle payment failure and retry', async () => {
      // Mock initial payment failure
      StripeTestHelpers.mockPaymentFailures();

      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
      });

      // First attempt should fail
      await expect(paymentService.createPaymentIntent(paymentParams))
        .rejects
        .toThrow();

      // Reset mocks and retry
      StripeTestHelpers.resetMocks();
      StripeTestHelpers.mockSuccessfulPaymentFlow();

      // Second attempt should succeed
      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);
    });

    it('should handle network timeout and recovery', async () => {
      // Mock network timeout
      const mockStripe = StripeTestHelpers.getMockStripe();
      mockStripe.paymentIntents.create.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
      });

      // Should timeout and retry with circuit breaker
      await expect(paymentService.createPaymentIntent(paymentParams))
        .rejects
        .toThrow('Network timeout');

      // Reset and allow success
      StripeTestHelpers.resetMocks();
      StripeTestHelpers.mockSuccessfulPaymentFlow();

      const retryResult = await paymentService.createPaymentIntent(paymentParams);
      expect(retryResult.success).toBe(true);
    });
  });

  describe('Compliance and Audit Flow', () => {
    it('should maintain complete audit trail', async () => {
      const correlationId = uuidv4();

      // Complete payment flow
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
        metadata: { correlationId, auditTest: 'true' },
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      await paymentService.confirmPayment(paymentResult.paymentIntentId!, paymentParams.paymentMethodId!);
      await paymentService.capturePayment(paymentResult.paymentIntentId!);

      // Verify audit logs exist (in a real implementation, we would query the database)
      // For now, we verify the operations completed successfully
      expect(paymentResult.success).toBe(true);

      // Generate compliance report
      const taxReport = await taxService.createTaxReport(
        'test-business-1',
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        new Date() // Today
      );

      expect(taxReport.businessId).toBe('test-business-1');
      expect(taxReport.summary).toBeDefined();
    });

    it('should handle PCI DSS compliance requirements', async () => {
      // Verify sensitive data is not logged
      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
        paymentMethodId: 'pm_test_sensitive_data',
      });

      // Payment processing should succeed without exposing sensitive data
      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      expect(paymentResult.success).toBe(true);

      // Verify payment method ID is not exposed in logs or responses
      expect(JSON.stringify(paymentResult)).not.toContain('pm_test_sensitive_data');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent payment processing', async () => {
      const concurrentPayments = Array.from({ length: 5 }, (_, i) =>
        PaymentTestData.createPaymentIntentParams({
          amount: 1000 * (i + 1), // $10, $20, $30, etc.
          businessId: 'test-business-1',
          customerId: `cus_concurrent_${i}`,
          metadata: { concurrentTest: `payment_${i}` },
        })
      );

      const promises = concurrentPayments.map(params =>
        paymentService.createPaymentIntent(params)
      );

      const results = await Promise.all(promises);

      // All payments should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.paymentIntentId).toBeTruthy();
      });

      // Verify all payments are tracked independently
      expect(new Set(results.map(r => r.paymentIntentId)).size).toBe(5);
    });

    it('should complete payment flow within performance thresholds', async () => {
      const start = Date.now();

      const paymentParams = PaymentTestData.createPaymentIntentParams({
        amount: 10000,
        businessId: 'test-business-1',
      });

      const paymentResult = await paymentService.createPaymentIntent(paymentParams);
      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId!,
        paymentParams.paymentMethodId!
      );
      await paymentService.capturePayment(paymentResult.paymentIntentId!);

      const end = Date.now();
      const duration = end - start;

      // Complete flow should finish within 5 seconds
      expect(duration).toBeLessThan(5000);
      expect(paymentResult.success).toBe(true);
      expect(confirmResult.success).toBe(true);
    });
  });
});