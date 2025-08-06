// Stripe Types - using string literals to avoid direct dependency
// This allows the types to be used without requiring the Stripe SDK in shared package

// Payment Intent Types
export interface PaymentIntentCreateRequest {
  amount: number; // Amount in cents
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
  automatic_payment_methods?: {
    enabled: boolean;
    allow_redirects?: 'always' | 'never';
  };
}

export interface PaymentIntentResponse {
  id: string;
  client_secret: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  created: number;
  updated: number;
}

// Customer Types
export interface StripeCustomerCreateRequest {
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

export interface StripeCustomerResponse {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
  created: number;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

// Payment Method Types
export interface PaymentMethodResponse {
  id: string;
  type: string;
  card?: {
    brand: string;
    country?: string;
    exp_month: number;
    exp_year: number;
    funding: string;
    last4: string;
  };
  billing_details?: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
  created: number;
}

// Webhook Event Types
export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
}

// Common Stripe Error Types
export interface StripeErrorResponse {
  type:
    | 'card_error'
    | 'invalid_request_error'
    | 'api_error'
    | 'authentication_error'
    | 'rate_limit_error';
  code?: string;
  message: string;
  param?: string;
  decline_code?: string;
  charge?: string;
  payment_intent?: {
    id: string;
    status: string;
  };
}

// Buy Locals specific payment types
export interface ReservationPayment {
  id: string;
  reservationId: string;
  businessId: string;
  customerId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod?: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
}

export interface PaymentSummary {
  totalAmount: number;
  currency: string;
  fees?: {
    stripeFee: number;
    platformFee: number;
    businessPayout: number;
  };
  breakdown?: {
    basePrice: number;
    taxes: number;
    serviceFees: number;
    discounts: number;
  };
}

// Refund Types
export interface RefundRequest {
  paymentIntentId: string;
  amount?: number; // Optional for partial refunds
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface RefundResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  reason?: string;
  created: number;
  metadata?: Record<string, string>;
}

// Subscription Types (for future use)
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  trialEnd?: Date;
}

// Configuration Types
export interface StripeConfig {
  publishableKey: string;
  currency: string;
  supportedPaymentMethods: string[];
  appearance?: {
    theme: 'stripe' | 'night' | 'flat';
    variables?: Record<string, string>;
  };
}

// Security Types
export interface PaymentSecurityContext {
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  riskScore?: number;
  fraudFlags?: string[];
}

// Audit Types
export interface PaymentAuditLog {
  id: string;
  paymentId: string;
  action: 'created' | 'updated' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  userId?: string;
  businessId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  securityContext?: PaymentSecurityContext;
}
