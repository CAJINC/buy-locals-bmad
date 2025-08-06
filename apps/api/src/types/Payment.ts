import Stripe from 'stripe';
import { User } from './User.js';

// Core Payment Types
export interface PaymentIntentParams {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  businessId: string;
  serviceId?: string;
  reservationId?: string;
  automaticCapture?: boolean;
  escrowReleaseDate?: Date;
  platformFeePercent?: number;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  clientSecret?: string;
  error?: PaymentError;
  metadata?: Record<string, any>;
}

export interface CaptureResult {
  success: boolean;
  paymentIntentId: string;
  capturedAmount: number;
  platformFee: number;
  businessPayout: number;
  capturedAt: Date;
  error?: PaymentError;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  reason?: string;
  status: string;
  error?: PaymentError;
  businessAdjustment?: number;
  platformFeeRefund?: number;
}

export interface EscrowTransaction {
  id: string;
  paymentIntentId: string;
  businessId: string;
  customerId: string;
  amount: number;
  platformFee: number;
  businessPayout: number;
  status: EscrowStatus;
  createdAt: Date;
  scheduledReleaseAt?: Date;
  releasedAt?: Date;
  disputedAt?: Date;
  metadata?: Record<string, any>;
}

export type EscrowStatus = 
  | 'pending_capture'
  | 'held'
  | 'scheduled_release' 
  | 'released'
  | 'disputed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'requires_capture'
  | 'canceled'
  | 'failed';

// Tax Calculation Types
export interface TaxCalculationRequest {
  businessId: string;
  amount: number; // in cents
  businessLocation: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  customerLocation?: {
    address?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  productType?: string;
  serviceType?: string;
  exemptionId?: string;
}

export interface TaxCalculationResult {
  taxAmount: number; // in cents
  taxRate: number;
  jurisdiction: string;
  exemptionApplied: boolean;
  exemptionReason?: string;
  breakdown: TaxJurisdictionBreakdown[];
}

export interface TaxJurisdictionBreakdown {
  jurisdiction: string;
  taxType: string;
  rate: number;
  amount: number;
}

export interface TaxExemption {
  id: string;
  businessId: string;
  exemptionType: string;
  jurisdiction: string;
  certificateNumber?: string;
  validFrom: Date;
  validTo?: Date;
  isActive: boolean;
}

// Payout Types
export interface PayoutRequest {
  businessId: string;
  amount?: number; // if not provided, pay out available balance
  currency: string;
  schedule: PayoutSchedule;
  bankAccountId?: string;
  description?: string;
}

export interface PayoutResult {
  success: boolean;
  payoutId: string;
  amount: number;
  currency: string;
  arrivalDate: Date;
  status: string;
  error?: PaymentError;
}

export interface PayoutSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  minimumAmount?: number; // minimum payout amount in cents
}

export interface BusinessBalance {
  businessId: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  lastUpdated: Date;
  nextPayoutDate?: Date;
  escrowHeld: number;
}

// Error Handling Types
export interface PaymentError {
  type: PaymentErrorType;
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
  suggestedAction?: string;
  stripeError?: Stripe.StripeRawError;
}

export type PaymentErrorType = 
  | 'card_error'
  | 'api_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'validation_error'
  | 'idempotency_error'
  | 'permission_error'
  | 'insufficient_funds'
  | 'processing_error';

// Security and Audit Types
export interface PaymentAuditLog {
  id: string;
  operationType: PaymentOperationType;
  entityType: string;
  entityId: string;
  userId?: string;
  businessId?: string;
  amount?: number;
  currency?: string;
  status: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  correlationId: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export type PaymentOperationType = 
  | 'payment_intent_create'
  | 'payment_confirm'
  | 'payment_capture'
  | 'payment_cancel'
  | 'refund_create'
  | 'customer_create'
  | 'payment_method_attach'
  | 'payout_create'
  | 'webhook_received'
  | 'escrow_release';

export interface IdempotencyKeyRecord {
  key: string;
  operationType: PaymentOperationType;
  userId?: string;
  businessId?: string;
  result: any;
  createdAt: Date;
  expiresAt: Date;
}

// Circuit Breaker Types
export interface CircuitBreakerState {
  service: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  successCount: number;
  totalRequests: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: Date;
  processed: boolean;
  processedAt?: Date;
  retryCount: number;
  lastError?: string;
}

// Service Interfaces
export interface PaymentServiceInterface {
  // Core payment operations
  createPaymentIntent(params: PaymentIntentParams): Promise<PaymentResult>;
  confirmPayment(intentId: string, paymentMethodId: string): Promise<PaymentResult>;
  capturePayment(paymentIntentId: string, amountToCapture?: number): Promise<CaptureResult>;
  cancelPayment(paymentIntentId: string, reason?: string): Promise<PaymentResult>;
  
  // Refund operations
  processRefund(
    transactionId: string, 
    amount?: number, 
    reason?: string,
    metadata?: Record<string, string>
  ): Promise<RefundResult>;
  
  // Customer management
  createCustomer(user: User): Promise<string>;
  updateCustomer(customerId: string, updates: Partial<User>): Promise<void>;
  
  // Payment methods
  addPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]>;
  deletePaymentMethod(paymentMethodId: string): Promise<void>;
  
  // Escrow operations
  processEscrowRelease(transactionId: string): Promise<void>;
  scheduleEscrowRelease(transactionId: string, releaseDate: Date): Promise<void>;
  handleEscrowDispute(transactionId: string, reason: string): Promise<void>;
}

export interface TaxServiceInterface {
  calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;
  validateTaxExemption(exemptionId: string, businessId: string): Promise<boolean>;
  createTaxReport(businessId: string, startDate: Date, endDate: Date): Promise<any>;
  updateTaxExemption(exemption: TaxExemption): Promise<void>;
}

export interface PayoutServiceInterface {
  createPayout(request: PayoutRequest): Promise<PayoutResult>;
  getBusinessBalance(businessId: string): Promise<BusinessBalance>;
  updatePayoutSchedule(businessId: string, schedule: PayoutSchedule): Promise<void>;
  handlePayoutFailure(payoutId: string, reason: string): Promise<void>;
  generatePayoutReport(businessId: string, startDate: Date, endDate: Date): Promise<any>;
}