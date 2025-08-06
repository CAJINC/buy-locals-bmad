/**
 * Payment Services Export Module
 * 
 * Centralized exports for all payment-related services and utilities
 * providing a clean API for integration with the Buy Locals platform.
 */

// Core Services
export { PaymentService } from './paymentService.js';
export { TaxService } from './taxService.js';
export { PayoutService } from './payoutService.js';

// Service Registry and Management
export { 
  PaymentServiceRegistry,
  paymentServiceRegistry,
  getPaymentService,
  getTaxService,
  getPayoutService
} from './paymentServiceRegistry.js';

// Webhook Handling
export { WebhookHandler, webhookHandler, type WebhookConfig } from './webhookHandler.js';

// Error Classes
export {
  BasePaymentError,
  CardError,
  PaymentApiError,
  PaymentAuthenticationError,
  PaymentRateLimitError,
  PaymentValidationError,
  PaymentIdempotencyError,
  PaymentPermissionError,
  InsufficientFundsError,
  PaymentProcessingError,
  EscrowError,
  createPaymentErrorFromStripe,
  sanitizePaymentError
} from '../errors/PaymentErrors.js';

// Security Utilities
export {
  InputSanitizer,
  PaymentEncryption,
  RateLimiter,
  AuditLogger,
  PCIComplianceHelper,
  createSecurityMiddleware,
  type SecurityConfig,
  defaultSecurityConfig
} from '../utils/paymentSecurity.js';

// Type Definitions
export type {
  // Core Payment Types
  PaymentIntentParams,
  PaymentResult,
  CaptureResult,
  RefundResult,
  EscrowTransaction,
  EscrowStatus,
  PaymentStatus,
  
  // Tax Types
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxExemption,
  TaxJurisdictionBreakdown,
  
  // Payout Types
  PayoutRequest,
  PayoutResult,
  PayoutSchedule,
  BusinessBalance,
  
  // Error Types
  PaymentError,
  PaymentErrorType,
  
  // Security and Audit Types
  PaymentAuditLog,
  PaymentOperationType,
  IdempotencyKeyRecord,
  CircuitBreakerState,
  RetryConfig,
  WebhookEvent,
  
  // Service Interfaces
  PaymentServiceInterface,
  TaxServiceInterface,
  PayoutServiceInterface
} from '../types/Payment.js';

// Service Health and Metrics
export type {
  ServiceHealth,
  ServiceMetrics
} from './paymentServiceRegistry.js';

// Configuration
export { stripe, verifyWebhookSignature, stripeSecurityConfig } from '../config/stripe.js';