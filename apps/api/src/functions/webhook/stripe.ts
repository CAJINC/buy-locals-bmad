import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { success, badRequest, internalServerError } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { stripe } from '../../config/stripe.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface WebhookEventHandler {
  (event: Stripe.Event, correlationId: string): Promise<void>;
}

/**
 * Stripe Webhook Handler Lambda Function
 * 
 * Securely processes Stripe webhook events with signature verification,
 * idempotency handling, and comprehensive audit logging.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let stripeEvent: Stripe.Event | null = null;
  
  try {
    // Security input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract Stripe signature from headers
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    
    if (!signature) {
      await auditLogger({
        operation: 'webhook_stripe',
        entityType: 'webhook',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing Stripe signature header'
      });
      return badRequest('Missing Stripe signature header');
    }

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      return internalServerError('Webhook configuration error');
    }

    if (!event.body) {
      return badRequest('Request body is required');
    }

    try {
      // Construct and verify the Stripe event
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        webhookSecret
      );
    } catch (signatureError) {
      await auditLogger({
        operation: 'webhook_stripe',
        entityType: 'webhook',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: `Invalid signature: ${signatureError instanceof Error ? signatureError.message : 'Unknown error'}`
      });
      logger.warn('Invalid Stripe webhook signature', {
        error: signatureError instanceof Error ? signatureError.message : 'Unknown error',
        correlationId
      });
      return badRequest('Invalid signature');
    }

    // Check for idempotency - prevent duplicate processing
    const existingEvent = await pool.query(
      'SELECT id, processed FROM webhook_events WHERE stripe_event_id = $1',
      [stripeEvent.id]
    );

    if (existingEvent.rows.length > 0) {
      if (existingEvent.rows[0].processed) {
        logger.info('Webhook event already processed', {
          eventId: stripeEvent.id,
          eventType: stripeEvent.type,
          correlationId
        });
        return success({ processed: true }, 'Event already processed');
      }
    } else {
      // Store webhook event for idempotency
      await pool.query(
        `INSERT INTO webhook_events (id, stripe_event_id, event_type, processed, created_at, correlation_id)
         VALUES ($1, $2, $3, false, NOW(), $4)`,
        [uuidv4(), stripeEvent.id, stripeEvent.type, correlationId]
      );
    }

    // Log webhook event received
    logger.info('Processing Stripe webhook event', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      livemode: stripeEvent.livemode,
      correlationId
    });

    // Route to appropriate handler based on event type
    const handler = getEventHandler(stripeEvent.type);
    if (handler) {
      await handler(stripeEvent, correlationId);
    } else {
      logger.info('Unhandled webhook event type', {
        eventId: stripeEvent.id,
        eventType: stripeEvent.type,
        correlationId
      });
    }

    // Mark event as processed
    await pool.query(
      'UPDATE webhook_events SET processed = true, processed_at = NOW() WHERE stripe_event_id = $1',
      [stripeEvent.id]
    );

    // Audit log success
    await auditLogger({
      operation: 'webhook_stripe',
      entityType: 'webhook',
      entityId: stripeEvent.id,
      userId: '',
      correlationId,
      success: true,
      metadata: {
        eventType: stripeEvent.type,
        livemode: stripeEvent.livemode
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Stripe webhook processed successfully', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      correlationId,
      processingTimeMs: processingTime
    });

    return success({ processed: true }, 'Webhook event processed successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Mark event as failed if we have the event ID
    if (stripeEvent?.id) {
      try {
        await pool.query(
          'UPDATE webhook_events SET processed = false, error_message = $1, processed_at = NOW() WHERE stripe_event_id = $2',
          [error instanceof Error ? error.message : 'Unknown error', stripeEvent.id]
        );
      } catch (updateError) {
        logger.error('Failed to update webhook event status', {
          eventId: stripeEvent.id,
          updateError: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
      }
    }

    // Log detailed error information
    logger.error('Error processing Stripe webhook', {
      eventId: stripeEvent?.id,
      eventType: stripeEvent?.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime
    });

    await auditLogger({
      operation: 'webhook_stripe',
      entityType: 'webhook',
      entityId: stripeEvent?.id || '',
      userId: '',
      correlationId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return internalServerError('Webhook processing failed');
  }
};

/**
 * Get event handler for specific webhook event types
 */
function getEventHandler(eventType: string): WebhookEventHandler | null {
  const handlers: Record<string, WebhookEventHandler> = {
    'payment_intent.succeeded': handlePaymentIntentSucceeded,
    'payment_intent.payment_failed': handlePaymentIntentFailed,
    'payment_intent.requires_action': handlePaymentIntentRequiresAction,
    'payment_intent.canceled': handlePaymentIntentCanceled,
    'payment_intent.amount_capturable_updated': handlePaymentIntentAmountCapturableUpdated,
    'charge.succeeded': handleChargeSucceeded,
    'charge.failed': handleChargeFailed,
    'charge.captured': handleChargeCaptured,
    'charge.dispute.created': handleChargeDisputeCreated,
    'refund.created': handleRefundCreated,
    'refund.updated': handleRefundUpdated,
    'customer.created': handleCustomerCreated,
    'customer.updated': handleCustomerUpdated,
    'payment_method.attached': handlePaymentMethodAttached,
    'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
    'invoice.payment_failed': handleInvoicePaymentFailed,
    'account.updated': handleAccountUpdated,
    'payout.created': handlePayoutCreated,
    'payout.paid': handlePayoutPaid,
    'payout.failed': handlePayoutFailed
  };

  return handlers[eventType] || null;
}

/**
 * Handle payment_intent.succeeded events
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    correlationId
  });

  // Update payment transaction status
  await pool.query(
    `UPDATE payment_transactions 
     SET status = 'succeeded', stripe_webhook_processed_at = NOW(), updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );

  // Update reservation status if applicable
  const reservationResult = await pool.query(
    'SELECT id FROM reservations WHERE payment_intent_id = $1',
    [paymentIntent.id]
  );

  if (reservationResult.rows.length > 0) {
    await pool.query(
      `UPDATE reservations 
       SET payment_status = 'completed', confirmed_at = NOW(), updated_at = NOW()
       WHERE payment_intent_id = $1`,
      [paymentIntent.id]
    );
  }
}

/**
 * Handle payment_intent.payment_failed events
 */
async function handlePaymentIntentFailed(event: Stripe.Event, correlationId: string): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.payment_failed', {
    paymentIntentId: paymentIntent.id,
    lastPaymentError: paymentIntent.last_payment_error?.message,
    correlationId
  });

  // Update payment transaction status
  await pool.query(
    `UPDATE payment_transactions 
     SET status = 'failed', 
         failure_reason = $2,
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id, paymentIntent.last_payment_error?.message || 'Payment failed']
  );

  // Update reservation status if applicable
  await pool.query(
    `UPDATE reservations 
     SET payment_status = 'failed', updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );
}

/**
 * Handle payment_intent.requires_action events
 */
async function handlePaymentIntentRequiresAction(event: Stripe.Event, correlationId: string): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.requires_action', {
    paymentIntentId: paymentIntent.id,
    nextAction: paymentIntent.next_action?.type,
    correlationId
  });

  // Update payment transaction status
  await pool.query(
    `UPDATE payment_transactions 
     SET status = 'requires_action', 
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );

  // Update reservation status if applicable
  await pool.query(
    `UPDATE reservations 
     SET payment_status = 'requires_action', updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );
}

/**
 * Handle payment_intent.canceled events
 */
async function handlePaymentIntentCanceled(event: Stripe.Event, correlationId: string): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.canceled', {
    paymentIntentId: paymentIntent.id,
    cancellationReason: paymentIntent.cancellation_reason,
    correlationId
  });

  // Update payment transaction status
  await pool.query(
    `UPDATE payment_transactions 
     SET status = 'canceled', 
         cancellation_reason = $2,
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id, paymentIntent.cancellation_reason]
  );

  // Update reservation status if applicable
  await pool.query(
    `UPDATE reservations 
     SET payment_status = 'canceled', updated_at = NOW()
     WHERE payment_intent_id = $1`,
    [paymentIntent.id]
  );
}

/**
 * Handle payment_intent.amount_capturable_updated events
 */
async function handlePaymentIntentAmountCapturableUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.amount_capturable_updated', {
    paymentIntentId: paymentIntent.id,
    amountCapturable: paymentIntent.amount_capturable,
    correlationId
  });

  // Update escrow transaction amount if applicable
  await pool.query(
    `UPDATE payment_transactions 
     SET capturable_amount = $2,
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE payment_intent_id = $1 AND escrow_enabled = true`,
    [paymentIntent.id, paymentIntent.amount_capturable]
  );
}

/**
 * Handle charge.captured events
 */
async function handleChargeCaptured(event: Stripe.Event, correlationId: string): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  
  logger.info('Processing charge.captured', {
    chargeId: charge.id,
    paymentIntentId: charge.payment_intent,
    amountCaptured: charge.amount_captured,
    correlationId
  });

  if (charge.payment_intent) {
    // Update payment transaction with capture details
    await pool.query(
      `UPDATE payment_transactions 
       SET captured_amount = $2, 
           captured_at = NOW(),
           stripe_webhook_processed_at = NOW(), 
           updated_at = NOW()
       WHERE payment_intent_id = $1`,
      [charge.payment_intent, charge.amount_captured]
    );
  }
}

/**
 * Handle refund.created events
 */
async function handleRefundCreated(event: Stripe.Event, correlationId: string): Promise<void> {
  const refund = event.data.object as Stripe.Refund;
  
  logger.info('Processing refund.created', {
    refundId: refund.id,
    paymentIntentId: refund.payment_intent,
    amount: refund.amount,
    status: refund.status,
    correlationId
  });

  // Update refund status in database
  await pool.query(
    `UPDATE refunds 
     SET status = $2, 
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE refund_id = $1`,
    [refund.id, refund.status]
  );
}

/**
 * Handle refund.updated events
 */
async function handleRefundUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
  const refund = event.data.object as Stripe.Refund;
  
  logger.info('Processing refund.updated', {
    refundId: refund.id,
    status: refund.status,
    correlationId
  });

  // Update refund status in database
  await pool.query(
    `UPDATE refunds 
     SET status = $2,
         processed_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE processed_at END,
         stripe_webhook_processed_at = NOW(), 
         updated_at = NOW()
     WHERE refund_id = $1`,
    [refund.id, refund.status]
  );
}

/**
 * Handle charge.dispute.created events
 */
async function handleChargeDisputeCreated(event: Stripe.Event, correlationId: string): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  
  logger.warn('Processing charge.dispute.created', {
    disputeId: dispute.id,
    chargeId: dispute.charge,
    amount: dispute.amount,
    reason: dispute.reason,
    correlationId
  });

  // Create dispute record
  await pool.query(
    `INSERT INTO payment_disputes (
       id, dispute_id, charge_id, amount, reason, status, 
       evidence_due_by, created_at, correlation_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
    [
      uuidv4(),
      dispute.id,
      dispute.charge,
      dispute.amount,
      dispute.reason,
      dispute.status,
      dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
      correlationId
    ]
  );
}

/**
 * Handle customer.created events
 */
async function handleCustomerCreated(event: Stripe.Event, correlationId: string): Promise<void> {
  const customer = event.data.object as Stripe.Customer;
  
  logger.info('Processing customer.created', {
    customerId: customer.id,
    email: customer.email,
    correlationId
  });

  // Update user with Stripe customer ID if not already set
  if (customer.email) {
    await pool.query(
      `UPDATE users 
       SET stripe_customer_id = $1, updated_at = NOW()
       WHERE email = $2 AND stripe_customer_id IS NULL`,
      [customer.id, customer.email]
    );
  }
}

/**
 * Handle payout.paid events
 */
async function handlePayoutPaid(event: Stripe.Event, correlationId: string): Promise<void> {
  const payout = event.data.object as Stripe.Payout;
  
  logger.info('Processing payout.paid', {
    payoutId: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    arrivalDate: payout.arrival_date,
    correlationId
  });

  // Update payout records
  await pool.query(
    `UPDATE business_payouts 
     SET status = 'paid', 
         paid_at = $2,
         stripe_webhook_processed_at = NOW(),
         updated_at = NOW()
     WHERE stripe_payout_id = $1`,
    [payout.id, new Date(payout.arrival_date * 1000)]
  );
}

/**
 * Handle payout.failed events
 */
async function handlePayoutFailed(event: Stripe.Event, correlationId: string): Promise<void> {
  const payout = event.data.object as Stripe.Payout;
  
  logger.warn('Processing payout.failed', {
    payoutId: payout.id,
    amount: payout.amount,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
    correlationId
  });

  // Update payout records
  await pool.query(
    `UPDATE business_payouts 
     SET status = 'failed', 
         failure_reason = $2,
         stripe_webhook_processed_at = NOW(),
         updated_at = NOW()
     WHERE stripe_payout_id = $1`,
    [payout.id, payout.failure_message || payout.failure_code]
  );
}

// Additional handlers for other events (simplified for brevity)
async function handleChargeSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle charge.succeeded
}

async function handleChargeFailed(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle charge.failed
}

async function handleCustomerUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle customer.updated
}

async function handlePaymentMethodAttached(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle payment_method.attached
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle invoice.payment_succeeded
}

async function handleInvoicePaymentFailed(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle invoice.payment_failed
}

async function handleAccountUpdated(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle account.updated
}

async function handlePayoutCreated(event: Stripe.Event, correlationId: string): Promise<void> {
  // Handle payout.created
}