import { v4 as uuidv4 } from 'uuid';
import {
  PaymentIntentParams,
  TaxCalculationRequest,
  PayoutRequest,
  EscrowTransaction,
  PaymentAuditLog,
  PaymentOperationType,
} from '../../src/types/Payment.js';
import { User } from '../../src/types/User.js';
import { Business } from '../../src/types/Business.js';
import { ReceiptData, ReceiptItem } from '../../src/services/receiptService.js';

/**
 * Payment Test Data Generators
 * Comprehensive test data factory for payment system testing
 */

export class PaymentTestData {
  /**
   * Generate test user data
   */
  static createTestUser(overrides: Partial<User> = {}): User {
    return {
      id: uuidv4(),
      email: 'test.user@example.com',
      role: 'consumer',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
      },
      preferences: {
        currency: 'USD',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
      },
      stripeCustomerId: 'cus_test_customer',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Generate test business data
   */
  static createTestBusiness(overrides: Partial<Business> = {}): Business {
    return {
      id: uuidv4(),
      name: 'Test Local Business',
      description: 'A test business for payment processing',
      category: 'restaurant',
      subcategory: 'casual_dining',
      ownerId: uuidv4(),
      location: {
        address: '456 Business Ave',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US',
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
      contact: {
        phone: '+1234567890',
        email: 'business@example.com',
        website: 'https://testbusiness.com',
      },
      hours: {
        monday: { open: '09:00', close: '17:00', isOpen: true },
        tuesday: { open: '09:00', close: '17:00', isOpen: true },
        wednesday: { open: '09:00', close: '17:00', isOpen: true },
        thursday: { open: '09:00', close: '17:00', isOpen: true },
        friday: { open: '09:00', close: '17:00', isOpen: true },
        saturday: { open: '10:00', close: '16:00', isOpen: true },
        sunday: { open: '12:00', close: '16:00', isOpen: true },
      },
      stripeAccountId: 'acct_test_business_123',
      paymentSettings: {
        acceptsCash: true,
        acceptsCards: true,
        acceptsDigital: true,
        processingFee: 2.9,
        minimumOrder: 1000, // $10.00
      },
      status: 'active',
      verified: true,
      rating: 4.5,
      reviewCount: 150,
      images: ['https://example.com/business-image.jpg'],
      tags: ['local', 'family-owned', 'eco-friendly'],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Generate valid payment intent parameters
   */
  static createPaymentIntentParams(overrides: Partial<PaymentIntentParams> = {}): PaymentIntentParams {
    return {
      amount: 10000, // $100.00
      currency: 'USD',
      businessId: 'test-business-123',
      customerId: 'cus_test_customer',
      paymentMethodId: 'pm_test_card',
      description: 'Test payment for local service',
      automaticCapture: false,
      platformFeePercent: 2.9,
      serviceId: 'service_test_123',
      reservationId: 'reservation_test_123',
      escrowReleaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      metadata: {
        testTransaction: 'true',
        environment: 'test',
        source: 'mobile_app',
        customerNote: 'Test order notes',
      },
      ...overrides,
    };
  }

  /**
   * Generate tax calculation request
   */
  static createTaxCalculationRequest(overrides: Partial<TaxCalculationRequest> = {}): TaxCalculationRequest {
    return {
      businessId: 'test-business-123',
      amount: 10000, // $100.00
      businessLocation: {
        address: '456 Business Ave',
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
      productType: 'service',
      exemptionId: undefined,
      ...overrides,
    };
  }

  /**
   * Generate payout request
   */
  static createPayoutRequest(overrides: Partial<PayoutRequest> = {}): PayoutRequest {
    return {
      businessId: 'test-business-123',
      amount: 50000, // $500.00
      currency: 'USD',
      schedule: {
        frequency: 'manual',
      },
      description: 'Test payout for business earnings',
      metadata: {
        payoutType: 'earnings',
        period: 'weekly',
      },
      ...overrides,
    };
  }

  /**
   * Generate escrow transaction
   */
  static createEscrowTransaction(overrides: Partial<EscrowTransaction> = {}): EscrowTransaction {
    return {
      id: uuidv4(),
      paymentIntentId: 'pi_test_1234567890',
      businessId: 'test-business-123',
      customerId: 'cus_test_customer',
      amount: 10000,
      platformFee: 290,
      businessPayout: 9710,
      status: 'pending_capture',
      createdAt: new Date(),
      scheduledReleaseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: {
        serviceType: 'reservation',
        reservationId: 'reservation_test_123',
      },
      ...overrides,
    };
  }

  /**
   * Generate payment audit log
   */
  static createPaymentAuditLog(overrides: Partial<PaymentAuditLog> = {}): PaymentAuditLog {
    return {
      id: uuidv4(),
      operationType: 'payment_intent_create',
      entityType: 'payment_intent',
      entityId: 'pi_test_1234567890',
      businessId: 'test-business-123',
      timestamp: new Date(),
      correlationId: uuidv4(),
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'BuyLocals/1.0.0 (iOS 15.0)',
      errorCode: undefined,
      errorMessage: undefined,
      ...overrides,
    };
  }

  /**
   * Generate receipt data
   */
  static createReceiptData(overrides: Partial<ReceiptData> = {}): ReceiptData {
    const business = this.createTestBusiness();
    const customer = this.createTestUser();
    const items = this.createReceiptItems();

    return {
      id: uuidv4(),
      receiptNumber: `RCP-${Date.now()}`,
      transactionId: uuidv4(),
      paymentIntentId: 'pi_test_1234567890',
      businessId: business.id,
      customerId: customer.id,
      amount: 10000,
      currency: 'USD',
      platformFee: 290,
      businessPayout: 9710,
      taxAmount: 875,
      taxRate: 0.0875,
      status: 'paid',
      createdAt: new Date(),
      items,
      business,
      customer,
      metadata: {
        paymentMethod: 'card',
        cardLast4: '4242',
        receiptEmail: customer.email,
      },
      ...overrides,
    };
  }

  /**
   * Generate receipt items
   */
  static createReceiptItems(count: number = 2): ReceiptItem[] {
    return Array.from({ length: count }, (_, index) => ({
      id: uuidv4(),
      name: `Test Item ${index + 1}`,
      description: `Description for test item ${index + 1}`,
      quantity: 1 + index,
      unitPrice: 2500 + (index * 500), // $25.00, $30.00, etc.
      totalPrice: (2500 + (index * 500)) * (1 + index),
      taxRate: 0.0875,
      taxAmount: Math.round(((2500 + (index * 500)) * (1 + index)) * 0.0875),
      category: index === 0 ? 'service' : 'product',
    }));
  }

  /**
   * Generate test scenarios for different payment states
   */
  static getTestScenarios() {
    return {
      // Successful payment flow
      successfulPayment: {
        params: this.createPaymentIntentParams(),
        expectedAmount: 10000,
        expectedPlatformFee: 290,
        expectedBusinessAmount: 9710,
      },

      // Small amount payment
      smallPayment: {
        params: this.createPaymentIntentParams({ amount: 500 }), // $5.00
        expectedAmount: 500,
        expectedPlatformFee: 15, // 2.9% of $5.00
        expectedBusinessAmount: 485,
      },

      // Large amount payment
      largePayment: {
        params: this.createPaymentIntentParams({ amount: 500000 }), // $5,000.00
        expectedAmount: 500000,
        expectedPlatformFee: 14500, // 2.9% of $5,000.00
        expectedBusinessAmount: 485500,
      },

      // International payment
      internationalPayment: {
        params: this.createPaymentIntentParams({
          currency: 'CAD',
          amount: 10000, // $100.00 CAD
        }),
        expectedAmount: 10000,
        expectedCurrency: 'CAD',
      },

      // Immediate capture payment
      immediateCapturePayment: {
        params: this.createPaymentIntentParams({ automaticCapture: true }),
        expectedAutomaticCapture: true,
      },

      // Tax-exempt transaction
      taxExemptTransaction: {
        taxRequest: this.createTaxCalculationRequest({
          exemptionId: 'exemption_test_123',
        }),
        expectedExemption: true,
      },

      // Food product (reduced tax rate)
      foodProductTransaction: {
        taxRequest: this.createTaxCalculationRequest({
          productType: 'food',
        }),
        expectedReducedTax: true,
      },

      // Cross-state transaction (different tax jurisdictions)
      crossStateTransaction: {
        taxRequest: this.createTaxCalculationRequest({
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
        }),
        expectedDifferentJurisdiction: true,
      },

      // Weekly payout schedule
      weeklyPayout: {
        request: this.createPayoutRequest({
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 5, // Friday
            minimumAmount: 5000, // $50.00
          },
        }),
        expectedFrequency: 'weekly',
      },
    };
  }

  /**
   * Generate error test cases
   */
  static getErrorTestCases() {
    return {
      // Invalid amount
      invalidAmount: {
        params: this.createPaymentIntentParams({ amount: -100 }),
        expectedError: 'PaymentValidationError',
      },

      // Amount too small
      amountTooSmall: {
        params: this.createPaymentIntentParams({ amount: 25 }), // $0.25 (below $0.50 minimum)
        expectedError: 'Minimum payment amount is $0.50',
      },

      // Amount too large
      amountTooLarge: {
        params: this.createPaymentIntentParams({ amount: 1000001 }), // Above $10,000 maximum
        expectedError: 'Maximum payment amount is $10,000',
      },

      // Invalid currency
      invalidCurrency: {
        params: this.createPaymentIntentParams({ currency: 'INVALID' }),
        expectedError: 'PaymentValidationError',
      },

      // Missing business ID
      missingBusinessId: {
        params: this.createPaymentIntentParams({ businessId: '' }),
        expectedError: 'Business ID is required',
      },

      // Invalid payout schedule
      invalidPayoutSchedule: {
        request: this.createPayoutRequest({
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 8, // Invalid day (should be 0-6)
          },
        }),
        expectedError: 'PaymentValidationError',
      },

      // Invalid tax request
      invalidTaxRequest: {
        request: this.createTaxCalculationRequest({ amount: -100 }),
        expectedError: 'PaymentValidationError',
      },
    };
  }

  /**
   * Generate security test cases
   */
  static getSecurityTestCases() {
    return {
      // XSS attempt in business ID
      xssBusinessId: {
        params: this.createPaymentIntentParams({
          businessId: '<script>alert("xss")</script>',
        }),
        shouldBeSanitized: true,
      },

      // SQL injection attempt in description
      sqlInjectionDescription: {
        params: this.createPaymentIntentParams({
          description: "'; DROP TABLE payments; --",
        }),
        shouldBeSanitized: true,
      },

      // Dangerous metadata
      dangerousMetadata: {
        params: this.createPaymentIntentParams({
          metadata: {
            'dangerous-key': '<img src=x onerror=alert(1)>',
            'script': 'javascript:void(0)',
          },
        }),
        shouldBeSanitized: true,
      },

      // Extremely long strings
      longStringAttack: {
        params: this.createPaymentIntentParams({
          description: 'A'.repeat(10000), // 10KB string
        }),
        shouldBeTruncated: true,
      },
    };
  }
}

export default PaymentTestData;