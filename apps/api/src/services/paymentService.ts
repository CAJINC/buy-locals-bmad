import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { stripe } from '../config/stripe.js';
import { logger } from '../utils/logger.js';
import { 
  CaptureResult,
  CircuitBreakerState,
  EscrowTransaction,
  IdempotencyKeyRecord,
  PaymentAuditLog,
  PaymentIntentParams,
  PaymentOperationType,
  PaymentResult,
  PaymentServiceInterface,
  RefundResult,
  RetryConfig
} from '../types/Payment.js';
import { User } from '../types/User.js';
import { 
  BasePaymentError,
  EscrowError,
  PaymentProcessingError,
  PaymentValidationError,
  createPaymentErrorFromStripe
} from '../errors/PaymentErrors.js';

/**
 * Comprehensive Payment Service for Buy Locals Platform
 * 
 * Features:
 * - Stripe integration with security best practices
 * - Escrow system with manual capture
 * - Comprehensive error handling and retry logic
 * - Circuit breaker pattern for resilience
 * - Audit logging for all operations
 * - Idempotency key management
 */
export class PaymentService implements PaymentServiceInterface {
  private readonly circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly idempotencyCache: Map<string, IdempotencyKeyRecord> = new Map();
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: ['rate_limit_error', 'api_error', 'connection_error']
  };

  constructor() {
    this.initializeCircuitBreakers();
    this.startIdempotencyCleanup();
  }

  /**
   * Create a payment intent with escrow capabilities
   */
  async createPaymentIntent(params: PaymentIntentParams): Promise<PaymentResult> {
    const correlationId = uuidv4();
    const idempotencyKey = this.generateIdempotencyKey('payment_intent_create', params);

    try {
      // Check for existing operation with same idempotency key
      const existingResult = this.getIdempotentResult(idempotencyKey);
      if (existingResult) {
        return existingResult;
      }

      await this.validatePaymentParams(params);
      await this.auditLog('payment_intent_create', 'payment_intent', '', params.businessId, correlationId);

      // Calculate amounts
      const platformFee = this.calculatePlatformFee(params.amount, params.platformFeePercent);
      const businessAmount = params.amount - platformFee;

      const stripeParams: Stripe.PaymentIntentCreateParams = {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        description: params.description || `Payment for ${params.businessId}`,
        metadata: {
          ...params.metadata,
          businessId: params.businessId,
          platformFee: platformFee.toString(),
          businessAmount: businessAmount.toString(),
          correlationId,
          ...(params.serviceId && { serviceId: params.serviceId }),
          ...(params.reservationId && { reservationId: params.reservationId })
        },
        // Use manual capture for escrow functionality
        capture_method: params.automaticCapture ? 'automatic' : 'manual',
        confirmation_method: 'manual',
        confirm: !!params.paymentMethodId,
        application_fee_amount: platformFee,
        transfer_data: {
          destination: await this.getBusinessStripeAccountId(params.businessId)
        }
      };

      const paymentIntent = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentIntents.create(stripeParams, { idempotencyKey })
      );

      // Store escrow transaction if manual capture
      if (!params.automaticCapture) {
        await this.createEscrowTransaction({
          id: uuidv4(),
          paymentIntentId: paymentIntent.id,
          businessId: params.businessId,
          customerId: params.customerId || '',
          amount: params.amount,
          platformFee,
          businessPayout: businessAmount,
          status: 'pending_capture',
          createdAt: new Date(),
          scheduledReleaseAt: params.escrowReleaseDate,
          metadata: params.metadata
        });
      }

      const result: PaymentResult = {
        success: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret || undefined,
        metadata: {
          platformFee,
          businessAmount,
          escrowEnabled: !params.automaticCapture
        }
      };

      // Cache result for idempotency
      this.cacheIdempotentResult(idempotencyKey, 'payment_intent_create', result);

      await this.auditLog('payment_intent_create', 'payment_intent', paymentIntent.id, 
        params.businessId, correlationId, true);

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        amount: params.amount,
        currency: params.currency,
        businessId: params.businessId,
        correlationId
      });

      return result;

    } catch (error) {
      await this.auditLog('payment_intent_create', 'payment_intent', '', 
        params.businessId, correlationId, false, error);

      if (error instanceof BasePaymentError) {
        throw error;
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError(
        'Failed to create payment intent',
        true,
        error as Stripe.StripeError
      );
    }
  }

  /**
   * Confirm a payment with proper error handling
   */
  async confirmPayment(intentId: string, paymentMethodId: string): Promise<PaymentResult> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('payment_confirm', 'payment_intent', intentId, '', correlationId);

      const paymentIntent = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentIntents.confirm(intentId, {
          payment_method: paymentMethodId,
          return_url: `${process.env.APP_URL}/payment-result`
        })
      );

      const result: PaymentResult = {
        success: paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret || undefined
      };

      await this.auditLog('payment_confirm', 'payment_intent', intentId, '', correlationId, result.success);

      // Update escrow status if applicable
      if (paymentIntent.capture_method === 'manual' && result.success) {
        await this.updateEscrowStatus(intentId, 'held');
      }

      return result;

    } catch (error) {
      await this.auditLog('payment_confirm', 'payment_intent', intentId, '', correlationId, false, error);

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError('Failed to confirm payment', false, error as Stripe.StripeError);
    }
  }

  /**
   * Capture payment from escrow
   */
  async capturePayment(paymentIntentId: string, amountToCapture?: number): Promise<CaptureResult> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('payment_capture', 'payment_intent', paymentIntentId, '', correlationId);

      // Get escrow transaction
      const escrowTransaction = await this.getEscrowTransaction(paymentIntentId);
      if (!escrowTransaction) {
        throw new EscrowError(paymentIntentId, 'capture', 'Transaction not found in escrow');
      }

      if (escrowTransaction.status !== 'held') {
        throw new EscrowError(paymentIntentId, 'capture', `Invalid status: ${escrowTransaction.status}`);
      }

      const captureAmount = amountToCapture || escrowTransaction.amount;
      
      await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentIntents.capture(paymentIntentId, {
          amount_to_capture: captureAmount
        })
      );

      // Calculate final amounts
      const platformFee = this.calculatePlatformFee(captureAmount, undefined);
      const businessPayout = captureAmount - platformFee;

      // Update escrow transaction
      await this.updateEscrowTransaction(paymentIntentId, {
        status: 'released',
        releasedAt: new Date(),
        businessPayout,
        platformFee
      });

      const result: CaptureResult = {
        success: true,
        paymentIntentId,
        capturedAmount: captureAmount,
        platformFee,
        businessPayout,
        capturedAt: new Date()
      };

      await this.auditLog('payment_capture', 'payment_intent', paymentIntentId, 
        escrowTransaction.businessId, correlationId, true);

      logger.info('Payment captured from escrow', {
        paymentIntentId,
        capturedAmount,
        platformFee,
        businessPayout,
        correlationId
      });

      return result;

    } catch (error) {
      await this.auditLog('payment_capture', 'payment_intent', paymentIntentId, '', correlationId, false, error);

      if (error instanceof BasePaymentError) {
        throw error;
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError('Failed to capture payment', false, error as Stripe.StripeError);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPayment(paymentIntentId: string, _reason?: string): Promise<PaymentResult> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('payment_cancel', 'payment_intent', paymentIntentId, '', correlationId);

      const paymentIntent = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentIntents.cancel(paymentIntentId, {
          cancellation_reason: 'requested_by_customer'
        })
      );

      // Update escrow status
      await this.updateEscrowStatus(paymentIntentId, 'cancelled');

      const result: PaymentResult = {
        success: true,
        paymentIntentId,
        status: paymentIntent.status
      };

      await this.auditLog('payment_cancel', 'payment_intent', paymentIntentId, '', correlationId, true);

      return result;

    } catch (error) {
      await this.auditLog('payment_cancel', 'payment_intent', paymentIntentId, '', correlationId, false, error);

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError('Failed to cancel payment', false, error as Stripe.StripeError);
    }
  }

  /**
   * Process a refund with business payout adjustment
   */
  async processRefund(
    transactionId: string, 
    amount?: number, 
    reason?: string,
    metadata?: Record<string, string>
  ): Promise<RefundResult> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('refund_create', 'refund', '', '', correlationId);

      // Get the original payment intent
      const paymentIntent = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentIntents.retrieve(transactionId)
      );

      if (!paymentIntent) {
        throw new PaymentValidationError('Payment intent not found');
      }

      const refundAmount = amount || paymentIntent.amount_received;
      const platformFeeRefund = this.calculatePlatformFee(refundAmount, undefined);
      const businessAdjustment = refundAmount - platformFeeRefund;

      const refund = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.refunds.create({
          payment_intent: transactionId,
          amount: refundAmount,
          reason: (reason as Stripe.RefundCreateParams.Reason) || 'requested_by_customer',
          metadata: {
            ...metadata,
            correlationId,
            businessAdjustment: businessAdjustment.toString(),
            platformFeeRefund: platformFeeRefund.toString()
          }
        })
      );

      // Update escrow status if applicable
      await this.updateEscrowStatus(transactionId, 'refunded');

      const result: RefundResult = {
        success: true,
        refundId: refund.id,
        amount: refundAmount,
        reason,
        status: refund.status,
        businessAdjustment,
        platformFeeRefund
      };

      await this.auditLog('refund_create', 'refund', refund.id, 
        paymentIntent.metadata?.businessId || '', correlationId, true);

      logger.info('Refund processed successfully', {
        refundId: refund.id,
        paymentIntentId: transactionId,
        amount: refundAmount,
        reason,
        correlationId
      });

      return result;

    } catch (error) {
      await this.auditLog('refund_create', 'refund', '', '', correlationId, false, error);

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError('Failed to process refund', false, error as Stripe.StripeError);
    }
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(user: User): Promise<string> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('customer_create', 'customer', '', '', correlationId);

      const customer = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.customers.create({
          email: user.email,
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          phone: user.profile.phone,
          metadata: {
            userId: user.id,
            role: user.role,
            correlationId
          }
        })
      );

      await this.auditLog('customer_create', 'customer', customer.id, '', correlationId, true);

      return customer.id;

    } catch (error) {
      await this.auditLog('customer_create', 'customer', '', '', correlationId, false, error);

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError('Failed to create customer', true, error as Stripe.StripeError);
    }
  }

  /**
   * Update a Stripe customer
   */
  async updateCustomer(customerId: string, updates: Partial<User>): Promise<void> {

    try {
      const updateParams: Stripe.CustomerUpdateParams = {};

      if (updates.email) updateParams.email = updates.email;
      if (updates.profile?.firstName || updates.profile?.lastName) {
        updateParams.name = `${updates.profile?.firstName || ''} ${updates.profile?.lastName || ''}`.trim();
      }
      if (updates.profile?.phone) updateParams.phone = updates.profile.phone;

      await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.customers.update(customerId, updateParams)
      );

    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }
      throw new PaymentProcessingError('Failed to update customer', true, error as Stripe.StripeError);
    }
  }

  /**
   * Add payment method to customer
   */
  async addPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('payment_method_attach', 'payment_method', paymentMethodId, '', correlationId);

      await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId
        })
      );

      await this.auditLog('payment_method_attach', 'payment_method', paymentMethodId, '', correlationId, true);

    } catch (error) {
      await this.auditLog('payment_method_attach', 'payment_method', paymentMethodId, '', correlationId, false, error);

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }
      throw new PaymentProcessingError('Failed to add payment method', false, error as Stripe.StripeError);
    }
  }

  /**
   * List customer payment methods
   */
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentMethods.list({
          customer: customerId,
          type: 'card'
        })
      );

      return paymentMethods.data;

    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }
      throw new PaymentProcessingError('Failed to list payment methods', true, error as Stripe.StripeError);
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.executeWithCircuitBreaker(
        'stripe_api',
        () => stripe.paymentMethods.detach(paymentMethodId)
      );

    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }
      throw new PaymentProcessingError('Failed to delete payment method', false, error as Stripe.StripeError);
    }
  }

  /**
   * Process escrow release
   */
  async processEscrowRelease(transactionId: string): Promise<void> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('escrow_release', 'escrow_transaction', transactionId, '', correlationId);

      const escrowTransaction = await this.getEscrowTransaction(transactionId);
      if (!escrowTransaction) {
        throw new EscrowError(transactionId, 'release', 'Transaction not found');
      }

      if (escrowTransaction.status !== 'held') {
        throw new EscrowError(transactionId, 'release', `Cannot release transaction with status: ${escrowTransaction.status}`);
      }

      // Capture the payment
      await this.capturePayment(transactionId);

      await this.auditLog('escrow_release', 'escrow_transaction', transactionId, 
        escrowTransaction.businessId, correlationId, true);

    } catch (error) {
      await this.auditLog('escrow_release', 'escrow_transaction', transactionId, '', correlationId, false, error);
      throw error;
    }
  }

  /**
   * Schedule escrow release
   */
  async scheduleEscrowRelease(transactionId: string, releaseDate: Date): Promise<void> {
    try {
      await this.updateEscrowTransaction(transactionId, {
        status: 'scheduled_release',
        scheduledReleaseAt: releaseDate
      });

      // In a real implementation, you would schedule this with a job queue
      logger.info('Escrow release scheduled', {
        transactionId,
        releaseDate,
        scheduledFor: releaseDate.toISOString()
      });

    } catch (error) {
      throw new EscrowError(transactionId, 'schedule', 'Failed to schedule release');
    }
  }

  /**
   * Handle escrow dispute
   */
  async handleEscrowDispute(transactionId: string, reason: string): Promise<void> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('escrow_dispute', 'escrow_transaction', transactionId, '', correlationId);

      await this.updateEscrowTransaction(transactionId, {
        status: 'disputed',
        disputedAt: new Date(),
        metadata: { disputeReason: reason }
      });

      await this.auditLog('escrow_dispute', 'escrow_transaction', transactionId, '', correlationId, true);

      logger.warn('Escrow dispute initiated', {
        transactionId,
        reason,
        correlationId
      });

    } catch (error) {
      await this.auditLog('escrow_dispute', 'escrow_transaction', transactionId, '', correlationId, false, error);
      throw new EscrowError(transactionId, 'dispute', 'Failed to initiate dispute');
    }
  }

  // Private helper methods

  private async validatePaymentParams(params: PaymentIntentParams): Promise<void> {
    if (!params.amount || params.amount <= 0) {
      throw PaymentValidationError.invalidAmount(params.amount);
    }

    if (!params.currency || !['USD', 'CAD', 'EUR', 'GBP'].includes(params.currency.toUpperCase())) {
      throw PaymentValidationError.invalidCurrency(params.currency);
    }

    if (!params.businessId) {
      throw new PaymentValidationError('Business ID is required');
    }

    // Validate minimum amount (e.g., $0.50 minimum)
    if (params.amount < 50) {
      throw new PaymentValidationError('Minimum payment amount is $0.50');
    }

    // Validate maximum amount (e.g., $10,000 maximum)
    if (params.amount > 1000000) {
      throw new PaymentValidationError('Maximum payment amount is $10,000');
    }
  }

  private calculatePlatformFee(amount: number, feePercent?: number): number {
    const defaultFeePercent = 2.9; // 2.9% default platform fee
    const feePercentage = feePercent || defaultFeePercent;
    return Math.round(amount * (feePercentage / 100));
  }

  private generateIdempotencyKey(operation: PaymentOperationType, params: unknown): string {
    // Create a deterministic key based on operation and critical parameters
    const keyData = {
      operation,
      ...params,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute window
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 64);
  }

  private getIdempotentResult(key: string): unknown | null {
    const cached = this.idempotencyCache.get(key);
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }
    return null;
  }

  private cacheIdempotentResult(key: string, operation: PaymentOperationType, result: unknown): void {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    this.idempotencyCache.set(key, {
      key,
      operationType: operation,
      result,
      createdAt: new Date(),
      expiresAt
    });
  }

  private async executeWithCircuitBreaker<T>(
    service: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(service);

    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      const now = new Date();
      if (circuitBreaker.nextRetryTime && now < circuitBreaker.nextRetryTime) {
        throw new PaymentProcessingError(
          `Service ${service} is temporarily unavailable`,
          true
        );
      } else {
        // Move to half-open state
        circuitBreaker.state = 'half-open';
      }
    }

    try {
      const result = await this.retryOperation(operation);
      
      // Success - update circuit breaker
      circuitBreaker.successCount++;
      circuitBreaker.totalRequests++;
      
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
      }

      return result;

    } catch (error) {
      // Failure - update circuit breaker
      circuitBreaker.failureCount++;
      circuitBreaker.totalRequests++;
      circuitBreaker.lastFailureTime = new Date();

      const failureRate = circuitBreaker.failureCount / circuitBreaker.totalRequests;
      
      if (failureRate >= 0.5 && circuitBreaker.failureCount >= 5) {
        circuitBreaker.state = 'open';
        const nextRetryTime = new Date();
        nextRetryTime.setSeconds(nextRetryTime.getSeconds() + 30); // 30 second cooldown
        circuitBreaker.nextRetryTime = nextRetryTime;
      }

      throw error;
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (attempt === this.retryConfig.maxAttempts || !this.isRetryableError(error)) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof BasePaymentError) {
      return error.retryable;
    }

    if (error instanceof Stripe.errors.StripeError) {
      return this.retryConfig.retryableErrors.includes(error.type);
    }

    return false;
  }

  private getCircuitBreaker(service: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, {
        service,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0
      });
    }
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      throw new PaymentProcessingError(`Circuit breaker not found for service: ${service}`, false);
    }
    return breaker;
  }

  private initializeCircuitBreakers(): void {
    this.circuitBreakers.set('stripe_api', {
      service: 'stripe_api',
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      totalRequests: 0
    });
  }

  private startIdempotencyCleanup(): void {
    // Clean up expired idempotency keys every hour
    setInterval(() => {
      const now = new Date();
      for (const [key, record] of this.idempotencyCache.entries()) {
        if (record.expiresAt <= now) {
          this.idempotencyCache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  private async auditLog(
    operation: PaymentOperationType,
    entityType: string,
    entityId: string,
    businessId?: string,
    correlationId?: string,
    success?: boolean,
    error?: unknown
  ): Promise<void> {
    try {
      const auditLog: PaymentAuditLog = {
        id: uuidv4(),
        operationType: operation,
        entityType,
        entityId,
        businessId,
        timestamp: new Date(),
        correlationId: correlationId || uuidv4(),
        success: success !== undefined ? success : true,
        ipAddress: 'system', // This would come from request in real implementation
        userAgent: 'payment-service',
        errorCode: error?.code,
        errorMessage: error?.message
      };

      // In a real implementation, this would be stored in a database
      logger.info('Payment audit log', auditLog);

    } catch (logError) {
      logger.error('Failed to create audit log', { operation, entityId, error: logError });
    }
  }

  // Mock database operations (replace with actual database implementation)
  private async getBusinessStripeAccountId(businessId: string): Promise<string> {
    // This would fetch from your business database
    return `acct_${businessId}_stripe`;
  }

  private async createEscrowTransaction(transaction: EscrowTransaction): Promise<void> {
    // Store in database
    logger.info('Created escrow transaction', { transactionId: transaction.id, amount: transaction.amount });
  }

  private async getEscrowTransaction(paymentIntentId: string): Promise<EscrowTransaction | null> {
    // Fetch from database
    return {
      id: uuidv4(),
      paymentIntentId,
      businessId: 'mock-business',
      customerId: 'mock-customer',
      amount: 1000,
      platformFee: 29,
      businessPayout: 971,
      status: 'held',
      createdAt: new Date()
    };
  }

  private async updateEscrowTransaction(paymentIntentId: string, updates: Partial<EscrowTransaction>): Promise<void> {
    // Update in database
    logger.info('Updated escrow transaction', { paymentIntentId, updates });
  }

  private async updateEscrowStatus(paymentIntentId: string, status: EscrowTransaction['status']): Promise<void> {
    await this.updateEscrowTransaction(paymentIntentId, { status });
  }
}