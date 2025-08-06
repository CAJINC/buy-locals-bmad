import Stripe from 'stripe';
import { jest } from '@jest/globals';
import { PaymentIntentParams, PaymentResult, RefundResult, CaptureResult } from '../../src/types/Payment.js';

/**
 * Stripe Test Helpers
 * Comprehensive mock utilities for Stripe API testing
 */

export class StripeTestHelpers {
  private static mockStripe: any = null;

  /**
   * Initialize Stripe mocks with realistic responses
   */
  static initializeMocks(): void {
    const mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        confirm: jest.fn(),
        capture: jest.fn(),
        cancel: jest.fn(),
        retrieve: jest.fn(),
      },
      customers: {
        create: jest.fn(),
        update: jest.fn(),
        retrieve: jest.fn(),
        list: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
        detach: jest.fn(),
        list: jest.fn(),
        create: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      payouts: {
        create: jest.fn(),
        retrieve: jest.fn(),
        list: jest.fn(),
      },
      balance: {
        retrieve: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
      accounts: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      errors: {
        StripeError: class extends Error {
          type: string;
          code?: string;
          decline_code?: string;
          payment_intent?: any;
          
          constructor(message: string, type: string = 'StripeError', code?: string) {
            super(message);
            this.type = type;
            this.code = code;
            this.name = 'StripeError';
          }
        },
        StripeCardError: class extends Error {
          type = 'StripeCardError';
          code?: string;
          decline_code?: string;
          
          constructor(message: string, code?: string, decline_code?: string) {
            super(message);
            this.code = code;
            this.decline_code = decline_code;
            this.name = 'StripeCardError';
          }
        },
        StripeAPIError: class extends Error {
          type = 'StripeAPIError';
          constructor(message: string) {
            super(message);
            this.name = 'StripeAPIError';
          }
        },
        StripeRateLimitError: class extends Error {
          type = 'StripeRateLimitError';
          constructor(message: string) {
            super(message);
            this.name = 'StripeRateLimitError';
          }
        },
        StripeConnectionError: class extends Error {
          type = 'StripeConnectionError';
          constructor(message: string) {
            super(message);
            this.name = 'StripeConnectionError';
          }
        },
        StripeAuthenticationError: class extends Error {
          type = 'StripeAuthenticationError';
          constructor(message: string) {
            super(message);
            this.name = 'StripeAuthenticationError';
          }
        },
      },
    };

    this.mockStripe = mockStripe;
  }

  /**
   * Get mocked Stripe instance
   */
  static getMockStripe(): any {
    if (!this.mockStripe) {
      this.initializeMocks();
    }
    return this.mockStripe;
  }

  /**
   * Create mock payment intent responses
   */
  static createMockPaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
    return {
      id: 'pi_test_1234567890',
      object: 'payment_intent',
      amount: 10000,
      amount_capturable: 0,
      amount_details: {},
      amount_received: 0,
      application: null,
      application_fee_amount: 290,
      automatic_payment_methods: null,
      canceled_at: null,
      cancellation_reason: null,
      capture_method: 'manual',
      client_secret: 'pi_test_1234567890_secret_test',
      confirmation_method: 'manual',
      created: Math.floor(Date.now() / 1000),
      currency: 'usd',
      customer: 'cus_test_customer',
      description: 'Test payment intent',
      invoice: null,
      last_payment_error: null,
      latest_charge: null,
      livemode: false,
      metadata: {
        businessId: 'test-business-123',
        platformFee: '290',
        businessAmount: '9710',
        correlationId: 'test-correlation-123',
      },
      next_action: null,
      on_behalf_of: null,
      payment_method: 'pm_test_payment_method',
      payment_method_options: {},
      payment_method_types: ['card'],
      processing: null,
      receipt_email: null,
      review: null,
      setup_future_usage: null,
      shipping: null,
      source: null,
      statement_descriptor: null,
      statement_descriptor_suffix: null,
      status: 'requires_confirmation',
      transfer_data: {
        destination: 'acct_test_business_123',
      },
      transfer_group: null,
      ...overrides,
    } as Stripe.PaymentIntent;
  }

  /**
   * Create mock customer response
   */
  static createMockCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
    return {
      id: 'cus_test_customer',
      object: 'customer',
      address: null,
      balance: 0,
      created: Math.floor(Date.now() / 1000),
      currency: null,
      default_source: null,
      delinquent: false,
      description: null,
      discount: null,
      email: 'test@example.com',
      invoice_prefix: 'INVOICE',
      invoice_settings: {
        custom_fields: null,
        default_payment_method: null,
        footer: null,
        rendering_options: null,
      },
      livemode: false,
      metadata: {
        userId: 'user-123',
        role: 'consumer',
      },
      name: 'John Doe',
      next_invoice_sequence: 1,
      phone: '+1234567890',
      preferred_locales: ['en'],
      shipping: null,
      tax_exempt: 'none',
      test_clock: null,
      ...overrides,
    } as Stripe.Customer;
  }

  /**
   * Create mock payment method response
   */
  static createMockPaymentMethod(overrides: Partial<Stripe.PaymentMethod> = {}): Stripe.PaymentMethod {
    return {
      id: 'pm_test_payment_method',
      object: 'payment_method',
      billing_details: {
        address: {
          city: 'San Francisco',
          country: 'US',
          line1: '123 Main St',
          line2: null,
          postal_code: '94105',
          state: 'CA',
        },
        email: 'test@example.com',
        name: 'John Doe',
        phone: '+1234567890',
      },
      card: {
        brand: 'visa',
        checks: {
          address_line1_check: 'pass',
          address_postal_code_check: 'pass',
          cvc_check: 'pass',
        },
        country: 'US',
        exp_month: 12,
        exp_year: 2025,
        fingerprint: 'test_fingerprint',
        funding: 'credit',
        generated_from: null,
        last4: '4242',
        networks: {
          available: ['visa'],
          preferred: null,
        },
        three_d_secure_usage: {
          supported: true,
        },
        wallet: null,
      },
      created: Math.floor(Date.now() / 1000),
      customer: 'cus_test_customer',
      livemode: false,
      metadata: {},
      type: 'card',
      ...overrides,
    } as Stripe.PaymentMethod;
  }

  /**
   * Create mock refund response
   */
  static createMockRefund(overrides: Partial<Stripe.Refund> = {}): Stripe.Refund {
    return {
      id: 'ref_test_refund',
      object: 'refund',
      amount: 5000,
      charge: 'ch_test_charge',
      created: Math.floor(Date.now() / 1000),
      currency: 'usd',
      metadata: {
        correlationId: 'test-correlation-123',
        businessAdjustment: '4855',
        platformFeeRefund: '145',
      },
      payment_intent: 'pi_test_1234567890',
      reason: 'requested_by_customer',
      receipt_number: null,
      source_transfer_reversal: null,
      status: 'succeeded',
      transfer_reversal: null,
      ...overrides,
    } as Stripe.Refund;
  }

  /**
   * Create mock webhook event
   */
  static createMockWebhookEvent(eventType: string, data: any = {}): Stripe.Event {
    return {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: data,
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: `req_test_${Date.now()}`,
        idempotency_key: null,
      },
      type: eventType as any,
    } as Stripe.Event;
  }

  /**
   * Mock successful payment flow
   */
  static mockSuccessfulPaymentFlow(): void {
    const mockStripe = this.getMockStripe();
    
    // Mock payment intent creation
    mockStripe.paymentIntents.create.mockResolvedValue(
      this.createMockPaymentIntent({
        status: 'requires_confirmation',
      })
    );

    // Mock payment confirmation
    mockStripe.paymentIntents.confirm.mockResolvedValue(
      this.createMockPaymentIntent({
        status: 'requires_capture',
      })
    );

    // Mock payment capture
    mockStripe.paymentIntents.capture.mockResolvedValue(
      this.createMockPaymentIntent({
        status: 'succeeded',
        amount_received: 10000,
      })
    );

    // Mock customer creation
    mockStripe.customers.create.mockResolvedValue(this.createMockCustomer());
  }

  /**
   * Mock payment failure scenarios
   */
  static mockPaymentFailures(): void {
    const mockStripe = this.getMockStripe();

    // Card declined
    mockStripe.paymentIntents.confirm.mockRejectedValueOnce(
      new mockStripe.errors.StripeCardError(
        'Your card was declined.',
        'card_declined',
        'generic_decline'
      )
    );

    // Insufficient funds
    mockStripe.paymentIntents.confirm.mockRejectedValueOnce(
      new mockStripe.errors.StripeCardError(
        'Your card has insufficient funds.',
        'card_declined',
        'insufficient_funds'
      )
    );

    // Rate limit error
    mockStripe.paymentIntents.create.mockRejectedValueOnce(
      new mockStripe.errors.StripeRateLimitError(
        'Too many requests made to the API too quickly'
      )
    );

    // API error
    mockStripe.paymentIntents.create.mockRejectedValueOnce(
      new mockStripe.errors.StripeAPIError(
        'An error occurred while processing your request'
      )
    );
  }

  /**
   * Mock webhook signature verification
   */
  static mockWebhookVerification(eventType: string = 'payment_intent.succeeded'): void {
    const mockStripe = this.getMockStripe();
    const mockEvent = this.createMockWebhookEvent(eventType, {
      id: 'pi_test_1234567890',
      status: 'succeeded',
      amount: 10000,
    });

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
  }

  /**
   * Mock invalid webhook signature
   */
  static mockInvalidWebhookSignature(): void {
    const mockStripe = this.getMockStripe();
    
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new mockStripe.errors.StripeError(
        'Invalid signature',
        'StripeSignatureVerificationError'
      );
    });
  }

  /**
   * Reset all mocks
   */
  static resetMocks(): void {
    if (this.mockStripe) {
      Object.values(this.mockStripe).forEach((service: any) => {
        if (typeof service === 'object') {
          Object.values(service).forEach((method: any) => {
            if (jest.isMockFunction(method)) {
              method.mockReset();
            }
          });
        }
      });
    }
  }

  /**
   * Create test payment parameters
   */
  static createTestPaymentParams(overrides: Partial<PaymentIntentParams> = {}): PaymentIntentParams {
    return {
      amount: 10000, // $100.00
      currency: 'USD',
      businessId: 'test-business-123',
      customerId: 'cus_test_customer',
      paymentMethodId: 'pm_test_payment_method',
      description: 'Test payment',
      automaticCapture: false,
      platformFeePercent: 2.9,
      metadata: {
        testTransaction: 'true',
        environment: 'test',
      },
      ...overrides,
    };
  }

  /**
   * Verify payment result structure
   */
  static verifyPaymentResult(result: PaymentResult): void {
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('paymentIntentId');
    expect(result).toHaveProperty('status');
    
    if (result.success) {
      expect(result.paymentIntentId).toBeTruthy();
      expect(result.status).toBeTruthy();
      
      if (result.metadata) {
        expect(result.metadata).toHaveProperty('platformFee');
        expect(result.metadata).toHaveProperty('businessAmount');
        expect(result.metadata.platformFee).toBeGreaterThan(0);
        expect(result.metadata.businessAmount).toBeGreaterThan(0);
      }
    }
  }

  /**
   * Verify refund result structure
   */
  static verifyRefundResult(result: RefundResult): void {
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('refundId');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('businessAdjustment');
    expect(result).toHaveProperty('platformFeeRefund');
    
    if (result.success) {
      expect(result.refundId).toBeTruthy();
      expect(result.amount).toBeGreaterThan(0);
      expect(result.businessAdjustment).toBeGreaterThan(0);
      expect(result.platformFeeRefund).toBeGreaterThan(0);
    }
  }

  /**
   * Verify capture result structure
   */
  static verifyCaptureResult(result: CaptureResult): void {
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('paymentIntentId');
    expect(result).toHaveProperty('capturedAmount');
    expect(result).toHaveProperty('platformFee');
    expect(result).toHaveProperty('businessPayout');
    expect(result).toHaveProperty('capturedAt');
    
    if (result.success) {
      expect(result.paymentIntentId).toBeTruthy();
      expect(result.capturedAmount).toBeGreaterThan(0);
      expect(result.platformFee).toBeGreaterThan(0);
      expect(result.businessPayout).toBeGreaterThan(0);
      expect(result.capturedAt).toBeInstanceOf(Date);
    }
  }
}

// Export commonly used mock data
export const mockStripeResponses = {
  paymentIntent: StripeTestHelpers.createMockPaymentIntent(),
  customer: StripeTestHelpers.createMockCustomer(),
  paymentMethod: StripeTestHelpers.createMockPaymentMethod(),
  refund: StripeTestHelpers.createMockRefund(),
};

export default StripeTestHelpers;