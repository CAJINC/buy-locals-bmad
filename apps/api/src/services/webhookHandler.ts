import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { verifyWebhookSignature } from '../config/stripe.js';
import { logger } from '../utils/logger.js';
import { getPaymentService, getPayoutService, paymentServiceRegistry } from './paymentServiceRegistry.js';
import { WebhookEvent } from '../types/Payment.js';
import {
  PaymentProcessingError,
  createPaymentErrorFromStripe
} from '../errors/PaymentErrors.js';

/**
 * Comprehensive Webhook Handler for Stripe Events
 * 
 * Features:
 * - Secure webhook signature verification
 * - Idempotent event processing
 * - Comprehensive event handling for all payment flows
 * - Retry mechanism for failed webhook processing
 * - Event auditing and monitoring
 */

export interface WebhookConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableDuplicateDetection: boolean;
  auditAllEvents: boolean;
}

export const defaultWebhookConfig: WebhookConfig = {
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
  timeoutMs: 30000, // 30 seconds
  enableDuplicateDetection: true,
  auditAllEvents: true
};

export class WebhookHandler {
  private processedEvents: Set<string> = new Set();
  private failedEvents: Map<string, { attempts: number; lastError: string; nextRetry: Date }> = new Map();
  private readonly config: WebhookConfig;

  constructor(config: Partial<WebhookConfig> = {}) {
    this.config = { ...defaultWebhookConfig, ...config };
    this.startRetryProcessor();
    this.startCleanupTask();
  }

  /**
   * Handle incoming webhook from Stripe
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string,
    correlationId?: string
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const requestId = correlationId || uuidv4();

    try {
      logger.info('Processing webhook', { signature: signature.substring(0, 20), requestId });

      // Verify webhook signature
      const event = this.verifyWebhook(payload, signature);
      
      // Check for duplicate events
      if (this.config.enableDuplicateDetection && this.isDuplicateEvent(event.id)) {
        logger.warn('Duplicate webhook event detected', { eventId: event.id, requestId });
        return { success: true, eventId: event.id };
      }

      // Audit the webhook event
      if (this.config.auditAllEvents) {
        await this.auditWebhookEvent(event, requestId);
      }

      // Process the event
      await this.processWebhookEvent(event, requestId);

      // Mark as processed
      this.markEventProcessed(event.id);

      logger.info('Webhook processed successfully', { 
        eventId: event.id, 
        eventType: event.type, 
        requestId 
      });

      return { success: true, eventId: event.id };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Webhook processing failed', { 
        error: errorMessage, 
        signature: signature.substring(0, 20),
        requestId 
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process a specific webhook event
   */
  private async processWebhookEvent(event: Stripe.Event, correlationId: string): Promise<void> {
    const startTime = Date.now();

    try {
      switch (event.type) {
        // Payment Intent Events
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event, correlationId);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event, correlationId);
          break;

        case 'payment_intent.requires_action':
          await this.handlePaymentIntentRequiresAction(event, correlationId);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event, correlationId);
          break;

        // Charge Events
        case 'charge.succeeded':
          await this.handleChargeSucceeded(event, correlationId);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event, correlationId);
          break;

        case 'charge.dispute.created':
          await this.handleChargeDisputeCreated(event, correlationId);
          break;

        // Refund Events
        case 'refund.created':
          await this.handleRefundCreated(event, correlationId);
          break;

        case 'refund.updated':
          await this.handleRefundUpdated(event, correlationId);
          break;

        // Payout Events
        case 'payout.created':
          await this.handlePayoutCreated(event, correlationId);
          break;

        case 'payout.updated':
          await this.handlePayoutUpdated(event, correlationId);
          break;

        case 'payout.failed':
          await this.handlePayoutFailed(event, correlationId);
          break;

        // Account Events
        case 'account.updated':
          await this.handleAccountUpdated(event, correlationId);
          break;

        case 'account.external_account.created':
          await this.handleExternalAccountCreated(event, correlationId);
          break;

        // Customer Events
        case 'customer.created':
          await this.handleCustomerCreated(event, correlationId);
          break;

        case 'customer.updated':
          await this.handleCustomerUpdated(event, correlationId);
          break;

        case 'customer.deleted':
          await this.handleCustomerDeleted(event, correlationId);
          break;

        // Invoice Events (for subscription billing if needed)
        case 'invoice.created':
          await this.handleInvoiceCreated(event, correlationId);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event, correlationId);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event, correlationId);
          break;

        // Default case for unhandled events
        default:
          logger.info('Unhandled webhook event type', { 
            eventType: event.type, 
            eventId: event.id,
            correlationId 
          });
      }

      // Record successful processing metrics
      const processingTime = Date.now() - startTime;
      paymentServiceRegistry.recordMetrics('webhook', true, processingTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      paymentServiceRegistry.recordMetrics('webhook', false, processingTime);
      
      // Schedule retry if possible
      await this.scheduleEventRetry(event, error, correlationId);
      throw error;
    }
  }

  // Payment Intent Event Handlers

  private async handlePaymentIntentSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    logger.info('Payment intent succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      correlationId
    });

    // Update internal records
    await this.updatePaymentStatus(paymentIntent.id, 'succeeded', correlationId);

    // Handle escrow if manual capture
    if (paymentIntent.capture_method === 'manual') {
      await this.handleEscrowPayment(paymentIntent, correlationId);
    }

    // Send confirmation notifications
    await this.sendPaymentConfirmation(paymentIntent, correlationId);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event, correlationId: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    logger.warn('Payment intent failed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
      correlationId
    });

    // Update internal records
    await this.updatePaymentStatus(paymentIntent.id, 'failed', correlationId);

    // Handle failure notifications
    await this.sendPaymentFailureNotification(paymentIntent, correlationId);

    // Clean up any reserved inventory or services
    await this.cleanupFailedPayment(paymentIntent, correlationId);
  }

  private async handlePaymentIntentRequiresAction(event: Stripe.Event, correlationId: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    logger.info('Payment intent requires action', {
      paymentIntentId: paymentIntent.id,
      nextAction: paymentIntent.next_action,
      correlationId
    });

    // Send action required notification to customer
    await this.sendActionRequiredNotification(paymentIntent, correlationId);
  }

  private async handlePaymentIntentCanceled(event: Stripe.Event, correlationId: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    logger.info('Payment intent canceled', {
      paymentIntentId: paymentIntent.id,
      cancellationReason: paymentIntent.cancellation_reason,
      correlationId
    });

    // Update internal records
    await this.updatePaymentStatus(paymentIntent.id, 'canceled', correlationId);

    // Release any held inventory or services
    await this.releaseReservedResources(paymentIntent, correlationId);
  }

  // Charge Event Handlers

  private async handleChargeSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    
    logger.info('Charge succeeded', {
      chargeId: charge.id,
      amount: charge.amount,
      paymentIntentId: charge.payment_intent,
      correlationId
    });

    // Update charge status
    await this.updateChargeStatus(charge.id, 'succeeded', correlationId);
  }

  private async handleChargeFailed(event: Stripe.Event, correlationId: string): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    
    logger.warn('Charge failed', {
      chargeId: charge.id,
      failureCode: charge.failure_code,
      failureMessage: charge.failure_message,
      correlationId
    });

    // Update charge status and handle failure
    await this.updateChargeStatus(charge.id, 'failed', correlationId);
  }

  private async handleChargeDisputeCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const dispute = event.data.object as Stripe.Dispute;
    
    logger.warn('Charge dispute created', {
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
      correlationId
    });

    // Handle dispute process
    await this.handleChargeDispute(dispute, correlationId);
  }

  // Refund Event Handlers

  private async handleRefundCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const refund = event.data.object as Stripe.Refund;
    
    logger.info('Refund created', {
      refundId: refund.id,
      chargeId: refund.charge,
      amount: refund.amount,
      reason: refund.reason,
      correlationId
    });

    // Update internal records and handle business payout adjustment
    await this.processRefundAccounting(refund, correlationId);
  }

  private async handleRefundUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
    const refund = event.data.object as Stripe.Refund;
    
    logger.info('Refund updated', {
      refundId: refund.id,
      status: refund.status,
      correlationId
    });

    // Update refund status
    await this.updateRefundStatus(refund.id, refund.status, correlationId);
  }

  // Payout Event Handlers

  private async handlePayoutCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    
    logger.info('Payout created', {
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: payout.arrival_date,
      correlationId
    });

    // Update payout status
    await this.updatePayoutStatus(payout.id, 'created', correlationId);
  }

  private async handlePayoutUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    
    logger.info('Payout updated', {
      payoutId: payout.id,
      status: payout.status,
      correlationId
    });

    // Update payout status
    await this.updatePayoutStatus(payout.id, payout.status, correlationId);

    // Send notification if payout completed
    if (payout.status === 'paid') {
      await this.sendPayoutCompletedNotification(payout, correlationId);
    }
  }

  private async handlePayoutFailed(event: Stripe.Event, correlationId: string): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    
    logger.error('Payout failed', {
      payoutId: payout.id,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
      correlationId
    });

    // Handle payout failure
    const payoutService = getPayoutService();
    await payoutService.handlePayoutFailure(
      payout.id, 
      payout.failure_message || 'Unknown error'
    );
  }

  // Customer Event Handlers

  private async handleCustomerCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    
    logger.info('Customer created', {
      customerId: customer.id,
      email: customer.email,
      correlationId
    });

    // Update customer records
    await this.updateCustomerRecord(customer, 'created', correlationId);
  }

  private async handleCustomerUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    
    logger.info('Customer updated', {
      customerId: customer.id,
      email: customer.email,
      correlationId
    });

    // Update customer records
    await this.updateCustomerRecord(customer, 'updated', correlationId);
  }

  private async handleCustomerDeleted(event: Stripe.Event, correlationId: string): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    
    logger.info('Customer deleted', {
      customerId: customer.id,
      correlationId
    });

    // Handle customer deletion
    await this.updateCustomerRecord(customer, 'deleted', correlationId);
  }

  // Account Event Handlers

  private async handleAccountUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
    const account = event.data.object as Stripe.Account;
    
    logger.info('Account updated', {
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      correlationId
    });

    // Update business account status
    await this.updateBusinessAccountStatus(account, correlationId);
  }

  private async handleExternalAccountCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const externalAccount = event.data.object as Stripe.ExternalAccount;
    
    logger.info('External account created', {
      accountId: externalAccount.account,
      bankAccountId: externalAccount.id,
      correlationId
    });

    // Update business banking information
    await this.updateBusinessBankAccount(externalAccount, correlationId);
  }

  // Invoice Event Handlers (for future subscription features)

  private async handleInvoiceCreated(event: Stripe.Event, correlationId: string): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    logger.info('Invoice created', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
      correlationId
    });
  }

  private async handleInvoicePaymentSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    logger.info('Invoice payment succeeded', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_paid,
      correlationId
    });
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event, correlationId: string): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    logger.warn('Invoice payment failed', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
      correlationId
    });
  }

  // Helper Methods

  private verifyWebhook(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return verifyWebhookSignature(payload, signature);
    } catch (error) {
      throw new PaymentProcessingError(
        'Webhook signature verification failed',
        false,
        error as Stripe.StripeError
      );
    }
  }

  private isDuplicateEvent(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  private markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // Keep only last 1000 events in memory
    if (this.processedEvents.size > 1000) {
      const iterator = this.processedEvents.values();
      this.processedEvents.delete(iterator.next().value);
    }
  }

  private async scheduleEventRetry(event: Stripe.Event, error: any, correlationId: string): Promise<void> {
    const existing = this.failedEvents.get(event.id) || { attempts: 0, lastError: '', nextRetry: new Date() };
    
    existing.attempts++;
    existing.lastError = error instanceof Error ? error.message : 'Unknown error';
    existing.nextRetry = new Date(Date.now() + this.config.retryDelayMs * existing.attempts);

    this.failedEvents.set(event.id, existing);

    logger.warn('Webhook event scheduled for retry', {
      eventId: event.id,
      attempt: existing.attempts,
      nextRetry: existing.nextRetry,
      correlationId
    });
  }

  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetries().catch(error => {
        logger.error('Retry processor failed', { error });
      });
    }, this.config.retryDelayMs);
  }

  private async processRetries(): Promise<void> {
    const now = new Date();
    
    for (const [eventId, retryInfo] of this.failedEvents.entries()) {
      if (retryInfo.nextRetry <= now && retryInfo.attempts <= this.config.maxRetries) {
        try {
          // Re-fetch and process the event
          const { stripe } = await import('../config/stripe.js');
          const event = await stripe.events.retrieve(eventId);
          
          await this.processWebhookEvent(event, `retry-${uuidv4()}`);
          
          // Remove from failed events on success
          this.failedEvents.delete(eventId);
          this.markEventProcessed(eventId);
          
          logger.info('Webhook retry successful', { eventId, attempt: retryInfo.attempts });
          
        } catch (error) {
          logger.error('Webhook retry failed', {
            eventId,
            attempt: retryInfo.attempts,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Update retry info
          retryInfo.attempts++;
          retryInfo.lastError = error instanceof Error ? error.message : 'Unknown error';
          retryInfo.nextRetry = new Date(Date.now() + this.config.retryDelayMs * retryInfo.attempts);
          
          if (retryInfo.attempts > this.config.maxRetries) {
            logger.error('Webhook max retries exceeded', { eventId });
            // In production, send to dead letter queue or alert admins
          }
        }
      }
    }
  }

  private startCleanupTask(): void {
    // Clean up processed events and failed events older than 24 hours
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      // Clean up old failed events
      for (const [eventId, retryInfo] of this.failedEvents.entries()) {
        if (retryInfo.nextRetry < cutoff) {
          this.failedEvents.delete(eventId);
        }
      }
      
      logger.debug('Webhook cleanup completed');
    }, 60 * 60 * 1000); // Run every hour
  }

  private async auditWebhookEvent(event: Stripe.Event, correlationId: string): Promise<void> {
    try {
      const webhookEvent: WebhookEvent = {
        id: event.id,
        type: event.type,
        data: event.data,
        created: new Date(event.created * 1000),
        processed: false,
        retryCount: 0
      };

      // In production, store in audit database
      logger.info('Webhook event audited', {
        eventId: event.id,
        eventType: event.type,
        correlationId
      });

    } catch (error) {
      logger.error('Failed to audit webhook event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });
    }
  }

  // Mock database operations (replace with actual implementations)
  
  private async updatePaymentStatus(paymentIntentId: string, status: string, correlationId: string): Promise<void> {
    logger.info('Updated payment status', { paymentIntentId, status, correlationId });
  }

  private async updateChargeStatus(chargeId: string, status: string, correlationId: string): Promise<void> {
    logger.info('Updated charge status', { chargeId, status, correlationId });
  }

  private async updateRefundStatus(refundId: string, status: string, correlationId: string): Promise<void> {
    logger.info('Updated refund status', { refundId, status, correlationId });
  }

  private async updatePayoutStatus(payoutId: string, status: string, correlationId: string): Promise<void> {
    logger.info('Updated payout status', { payoutId, status, correlationId });
  }

  private async updateCustomerRecord(customer: Stripe.Customer, action: string, correlationId: string): Promise<void> {
    logger.info('Updated customer record', { customerId: customer.id, action, correlationId });
  }

  private async updateBusinessAccountStatus(account: Stripe.Account, correlationId: string): Promise<void> {
    logger.info('Updated business account status', { accountId: account.id, correlationId });
  }

  private async updateBusinessBankAccount(externalAccount: Stripe.ExternalAccount, correlationId: string): Promise<void> {
    logger.info('Updated business bank account', { accountId: externalAccount.account, correlationId });
  }

  private async handleEscrowPayment(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Handling escrow payment', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async sendPaymentConfirmation(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Sending payment confirmation', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async sendPaymentFailureNotification(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Sending payment failure notification', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async sendActionRequiredNotification(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Sending action required notification', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async sendPayoutCompletedNotification(payout: Stripe.Payout, correlationId: string): Promise<void> {
    logger.info('Sending payout completed notification', { payoutId: payout.id, correlationId });
  }

  private async cleanupFailedPayment(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Cleaning up failed payment', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async releaseReservedResources(paymentIntent: Stripe.PaymentIntent, correlationId: string): Promise<void> {
    logger.info('Releasing reserved resources', { paymentIntentId: paymentIntent.id, correlationId });
  }

  private async processRefundAccounting(refund: Stripe.Refund, correlationId: string): Promise<void> {
    logger.info('Processing refund accounting', { refundId: refund.id, correlationId });
  }

  private async handleChargeDispute(dispute: Stripe.Dispute, correlationId: string): Promise<void> {
    logger.info('Handling charge dispute', { disputeId: dispute.id, correlationId });
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandler();