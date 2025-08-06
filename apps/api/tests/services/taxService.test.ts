import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TaxService } from '../../src/services/taxService.js';
import { TaxCalculationRequest, TaxCalculationResult } from '../../src/types/Payment.js';
import { PaymentValidationError } from '../../src/errors/PaymentErrors.js';
import PaymentTestData from '../utils/paymentTestData.js';

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TaxService', () => {
  let taxService: TaxService;

  beforeEach(() => {
    taxService = new TaxService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('calculateTax', () => {
    it('should calculate tax for California successfully', async () => {
      const request: TaxCalculationRequest = PaymentTestData.createTaxCalculationRequest({
        businessLocation: {
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        customerLocation: {
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'US',
        },
      });

      const result = await taxService.calculateTax(request);

      expect(result.taxAmount).toBeGreaterThan(0);
      expect(result.taxRate).toBeGreaterThan(0);
      expect(result.jurisdiction).toBe('CA');
      expect(result.breakdown).toHaveLength(2); // State and local tax
      expect(result.breakdown[0].jurisdiction).toBe('CA');
      expect(result.breakdown[1].jurisdiction).toBe('CA_LOCAL');
      expect(result.exemptionApplied).toBe(false);
    });

    it('should calculate correct tax amounts for different amounts', async () => {
      const baseRequest = PaymentTestData.createTaxCalculationRequest();
      
      // Test $50.00 payment
      const result50 = await taxService.calculateTax({
        ...baseRequest,
        amount: 5000,
      });

      // Test $100.00 payment  
      const result100 = await taxService.calculateTax({
        ...baseRequest,
        amount: 10000,
      });

      // Tax should scale proportionally
      expect(result100.taxAmount).toBe(result50.taxAmount * 2);
      expect(result100.taxRate).toBeCloseTo(result50.taxRate, 4);
    });

    it('should handle tax exemptions', async () => {
      const exemptRequest = PaymentTestData.createTaxCalculationRequest({
        exemptionId: 'exemption-1',
      });

      const result = await taxService.calculateTax(exemptRequest);

      expect(result.exemptionApplied).toBe(true);
      expect(result.exemptionReason).toBeDefined();
      expect(result.taxAmount).toBe(0); // Should be exempt
    });

    it('should apply reduced tax rate for food products', async () => {
      const baseRequest = PaymentTestData.createTaxCalculationRequest();
      const foodRequest = PaymentTestData.createTaxCalculationRequest({
        productType: 'food',
      });

      const baseResult = await taxService.calculateTax(baseRequest);
      const foodResult = await taxService.calculateTax(foodRequest);

      // Food should have reduced tax rate
      expect(foodResult.taxAmount).toBeLessThan(baseResult.taxAmount);
      expect(foodResult.taxRate).toBeLessThan(baseResult.taxRate);
    });

    it('should handle different jurisdictions', async () => {
      // California to California
      const caRequest = PaymentTestData.createTaxCalculationRequest({
        businessLocation: {
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        customerLocation: {
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'US',
        },
      });

      // California to Oregon (different state)
      const crossStateRequest = PaymentTestData.createTaxCalculationRequest({
        businessLocation: {
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        customerLocation: {
          city: 'Portland',
          state: 'OR',
          postalCode: '97201',
          country: 'US',
        },
      });

      const caResult = await taxService.calculateTax(caRequest);
      const crossStateResult = await taxService.calculateTax(crossStateRequest);

      expect(caResult.jurisdiction).toBe('CA');
      expect(crossStateResult.jurisdiction).toBe('OR'); // Should use customer location for destination-based tax
      expect(caResult.taxRate).not.toBe(crossStateResult.taxRate);
    });

    it('should validate tax calculation request', async () => {
      const invalidRequests = PaymentTestData.getErrorTestCases();

      await expect(taxService.calculateTax(invalidRequests.invalidTaxRequest.request))
        .rejects
        .toThrow(PaymentValidationError);
    });

    it('should handle zero amount correctly', async () => {
      const zeroAmountRequest = PaymentTestData.createTaxCalculationRequest({
        amount: 0,
      });

      const result = await taxService.calculateTax(zeroAmountRequest);

      expect(result.taxAmount).toBe(0);
      expect(result.taxRate).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should provide detailed tax breakdown', async () => {
      const request = PaymentTestData.createTaxCalculationRequest();
      const result = await taxService.calculateTax(request);

      expect(result.breakdown).toBeInstanceOf(Array);
      expect(result.breakdown.length).toBeGreaterThan(0);

      result.breakdown.forEach(breakdown => {
        expect(breakdown).toHaveProperty('jurisdiction');
        expect(breakdown).toHaveProperty('taxType');
        expect(breakdown).toHaveProperty('rate');
        expect(breakdown).toHaveProperty('amount');
        expect(breakdown.rate).toBeGreaterThan(0);
        expect(breakdown.amount).toBeGreaterThan(0);
      });
    });

    it('should handle international transactions', async () => {
      const internationalRequest = PaymentTestData.createTaxCalculationRequest({
        businessLocation: {
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        customerLocation: {
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V 3A8',
          country: 'CA',
        },
      });

      const result = await taxService.calculateTax(internationalRequest);

      // Should handle cross-border transactions
      expect(result).toBeDefined();
      expect(result.jurisdiction).toBeDefined();
    });
  });

  describe('validateTaxExemption', () => {
    it('should validate active tax exemption', async () => {
      const isValid = await taxService.validateTaxExemption('exemption-1', 'test-business-1');
      expect(isValid).toBe(true);
    });

    it('should reject invalid exemption ID', async () => {
      const isValid = await taxService.validateTaxExemption('invalid-exemption', 'test-business-1');
      expect(isValid).toBe(false);
    });

    it('should reject expired exemption', async () => {
      const isValid = await taxService.validateTaxExemption('expired-exemption', 'test-business-1');
      expect(isValid).toBe(false);
    });

    it('should validate exemption belongs to correct business', async () => {
      const isValid = await taxService.validateTaxExemption('exemption-1', 'wrong-business');
      expect(isValid).toBe(false);
    });
  });

  describe('createTaxReport', () => {
    it('should generate tax report successfully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await taxService.createTaxReport('test-business-1', startDate, endDate);

      expect(report.businessId).toBe('test-business-1');
      expect(report.reportPeriod.startDate).toBe(startDate.toISOString());
      expect(report.reportPeriod.endDate).toBe(endDate.toISOString());
      expect(report.summary).toBeDefined();
      expect(report.summary.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(report.summary.totalTaxCollected).toBeGreaterThanOrEqual(0);
      expect(report.summary.totalSales).toBeGreaterThanOrEqual(0);
      expect(report.transactions).toBeInstanceOf(Array);
      expect(report.exemptions).toBeInstanceOf(Array);
    });

    it('should include jurisdiction breakdown in report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await taxService.createTaxReport('test-business-1', startDate, endDate);

      expect(report.jurisdictionBreakdown).toBeInstanceOf(Array);
      
      if (report.jurisdictionBreakdown.length > 0) {
        report.jurisdictionBreakdown.forEach(jurisdiction => {
          expect(jurisdiction).toHaveProperty('jurisdiction');
          expect(jurisdiction).toHaveProperty('totalTax');
          expect(jurisdiction).toHaveProperty('transactionCount');
          expect(jurisdiction).toHaveProperty('taxRate');
        });
      }
    });

    it('should validate date range', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01'); // End before start

      await expect(taxService.createTaxReport('test-business-1', startDate, endDate))
        .rejects
        .toThrow('End date must be after start date');
    });

    it('should handle empty date range gracefully', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01'); // Same day

      const report = await taxService.createTaxReport('test-business-1', startDate, endDate);

      expect(report).toBeDefined();
      expect(report.transactions).toHaveLength(0);
      expect(report.summary.totalTransactions).toBe(0);
    });
  });

  describe('getTaxRates', () => {
    it('should retrieve current tax rates for jurisdiction', async () => {
      const rates = await taxService.getTaxRates('CA', '94105');

      expect(rates).toBeInstanceOf(Array);
      expect(rates.length).toBeGreaterThan(0);
      
      rates.forEach(rate => {
        expect(rate).toHaveProperty('jurisdiction');
        expect(rate).toHaveProperty('taxType');
        expect(rate).toHaveProperty('rate');
        expect(rate.rate).toBeGreaterThan(0);
      });
    });

    it('should handle unknown jurisdiction', async () => {
      const rates = await taxService.getTaxRates('XX', '00000');
      expect(rates).toHaveLength(0);
    });

    it('should cache tax rates for performance', async () => {
      const jurisdiction = 'CA';
      const postalCode = '94105';

      // First call
      const start1 = Date.now();
      const rates1 = await taxService.getTaxRates(jurisdiction, postalCode);
      const end1 = Date.now();

      // Second call (should be cached)
      const start2 = Date.now();
      const rates2 = await taxService.getTaxRates(jurisdiction, postalCode);
      const end2 = Date.now();

      expect(rates1).toEqual(rates2);
      expect(end2 - start2).toBeLessThan(end1 - start1); // Cached call should be faster
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network failure
      const originalGetTaxBreakdown = (taxService as any).getTaxBreakdown;
      (taxService as any).getTaxBreakdown = jest.fn().mockRejectedValue(new Error('Network error'));

      const request = PaymentTestData.createTaxCalculationRequest();

      await expect(taxService.calculateTax(request))
        .rejects
        .toThrow('Tax calculation failed');

      // Restore original method
      (taxService as any).getTaxBreakdown = originalGetTaxBreakdown;
    });

    it('should validate required fields', async () => {
      const incompleteRequest = {
        businessId: 'test-business-1',
        amount: 10000,
        // Missing required location fields
      } as TaxCalculationRequest;

      await expect(taxService.calculateTax(incompleteRequest))
        .rejects
        .toThrow(PaymentValidationError);
    });

    it('should handle invalid postal codes', async () => {
      const invalidRequest = PaymentTestData.createTaxCalculationRequest({
        businessLocation: {
          city: 'San Francisco',
          state: 'CA',
          postalCode: 'INVALID',
          country: 'US',
        },
      });

      // Should not throw but return default tax rates
      const result = await taxService.calculateTax(invalidRequest);
      expect(result).toBeDefined();
      expect(result.taxAmount).toBeGreaterThanOrEqual(0);
    });

    it('should sanitize input data', async () => {
      const maliciousRequest = PaymentTestData.createTaxCalculationRequest({
        businessId: '<script>alert("xss")</script>',
      });

      // Should process without throwing security errors
      const result = await taxService.calculateTax(maliciousRequest);
      expect(result).toBeDefined();
    });
  });

  describe('Product Type Tax Handling', () => {
    it('should apply correct tax rates for different product types', async () => {
      const baseRequest = PaymentTestData.createTaxCalculationRequest();

      const productTypes = ['service', 'food', 'retail', 'digital'];
      const results = [];

      for (const productType of productTypes) {
        const request = { ...baseRequest, productType };
        const result = await taxService.calculateTax(request);
        results.push({ productType, result });
      }

      // Verify different product types have appropriate tax treatment
      const foodResult = results.find(r => r.productType === 'food')!.result;
      const serviceResult = results.find(r => r.productType === 'service')!.result;
      const retailResult = results.find(r => r.productType === 'retail')!.result;

      // Food typically has reduced tax rates
      expect(foodResult.taxRate).toBeLessThanOrEqual(serviceResult.taxRate);
      expect(foodResult.taxRate).toBeLessThanOrEqual(retailResult.taxRate);
    });

    it('should handle tax-free products', async () => {
      const taxFreeRequest = PaymentTestData.createTaxCalculationRequest({
        productType: 'prescription_medicine', // Typically tax-free
      });

      const result = await taxService.calculateTax(taxFreeRequest);

      // Should have zero or minimal tax
      expect(result.taxAmount).toBeLessThanOrEqual(100); // Less than $1.00 tax
    });
  });

  describe('Performance', () => {
    it('should calculate tax within reasonable time limits', async () => {
      const request = PaymentTestData.createTaxCalculationRequest();

      const start = Date.now();
      await taxService.calculateTax(request);
      const end = Date.now();

      // Should complete within 500ms
      expect(end - start).toBeLessThan(500);
    });

    it('should handle concurrent tax calculations', async () => {
      const request = PaymentTestData.createTaxCalculationRequest();
      
      // Run 10 concurrent calculations
      const promises = Array.from({ length: 10 }, () => 
        taxService.calculateTax({ ...request, businessId: `business-${Math.random()}` })
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.taxAmount).toBeGreaterThanOrEqual(0);
        expect(result.jurisdiction).toBeDefined();
      });
    });
  });
});