import Stripe from 'stripe';
import { PaymentError, PaymentErrorType } from '../types/Payment.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Base Payment Error Class
 * Extends ApiError for consistent error handling across the application
 */
export class BasePaymentError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly isOperational: boolean = true;
  public readonly type: PaymentErrorType;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly suggestedAction?: string;
  public readonly stripeError?: Stripe.StripeRawError;
  public readonly details?: string[];

  constructor(
    type: PaymentErrorType,
    code: string,
    message: string,
    statusCode: number = 400,
    retryable: boolean = false,
    suggestedAction?: string,
    stripeError?: Stripe.StripeRawError,
    details?: string[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.suggestedAction = suggestedAction;
    this.stripeError = stripeError;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, BasePaymentError.prototype);
  }

  toJSON(): PaymentError {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      details: this.details?.join(', '),
      retryable: this.retryable,
      suggestedAction: this.suggestedAction,
      stripeError: this.stripeError
    };
  }
}

/**
 * Card-specific errors (declined, insufficient funds, etc.)
 */
export class CardError extends BasePaymentError {
  constructor(
    code: string,
    message: string,
    suggestedAction?: string,
    stripeError?: Stripe.StripeRawError
  ) {
    super(
      'card_error',
      code,
      message,
      402, // Payment Required
      false, // Card errors are typically not retryable
      suggestedAction,
      stripeError
    );
  }

  static fromStripeError(error: Stripe.StripeCardError): CardError {
    const suggestions = {
      'card_declined': 'Please try a different payment method or contact your bank.',
      'insufficient_funds': 'Please ensure sufficient funds are available or use a different card.',
      'expired_card': 'Please update your card expiration date.',
      'incorrect_cvc': 'Please check your card\'s security code.',
      'incorrect_number': 'Please check your card number.',
      'processing_error': 'Please try again or use a different payment method.'
    };

    return new CardError(
      error.code || 'card_error',
      error.message || 'Your card was declined.',
      suggestions[error.code as keyof typeof suggestions] || 'Please try a different payment method.',
      error
    );
  }
}

/**
 * API and connectivity errors
 */
export class PaymentApiError extends BasePaymentError {
  constructor(
    code: string,
    message: string,
    retryable: boolean = true,
    stripeError?: Stripe.StripeRawError
  ) {
    super(
      'api_error',
      code,
      message,
      502, // Bad Gateway
      retryable,
      retryable ? 'Please try again in a few moments.' : 'Please contact support if the issue persists.',
      stripeError
    );
  }

  static fromStripeError(error: Stripe.StripeAPIError): PaymentApiError {
    return new PaymentApiError(
      error.code || 'api_error',
      'Payment processing temporarily unavailable. Please try again.',
      true,
      error
    );
  }
}

/**
 * Authentication and authorization errors
 */
export class PaymentAuthenticationError extends BasePaymentError {
  constructor(
    message: string = 'Payment authentication failed',
    stripeError?: Stripe.StripeAuthenticationError
  ) {
    super(
      'authentication_error',
      'authentication_failed',
      message,
      401, // Unauthorized
      false,
      'Please verify your payment credentials.',
      stripeError
    );
  }
}

/**
 * Rate limiting errors
 */
export class PaymentRateLimitError extends BasePaymentError {
  public readonly retryAfter?: number;

  constructor(
    retryAfter?: number,
    stripeError?: Stripe.StripeRateLimitError
  ) {
    super(
      'rate_limit_error',
      'rate_limit_exceeded',
      'Too many payment requests. Please try again later.',
      429, // Too Many Requests
      true,
      retryAfter ? `Please wait ${retryAfter} seconds before trying again.` : 'Please wait before trying again.',
      stripeError
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * Validation errors for payment data
 */
export class PaymentValidationError extends BasePaymentError {
  constructor(
    message: string,
    details?: string[]
  ) {
    super(
      'validation_error',
      'validation_failed',
      message,
      400, // Bad Request
      false,
      'Please check your payment information and try again.',
      undefined,
      details
    );
  }

  static invalidAmount(amount: number): PaymentValidationError {
    return new PaymentValidationError(
      `Invalid payment amount: ${amount}. Amount must be positive and in cents.`,
      ['Amount must be a positive integer in cents (e.g., 1000 for $10.00)']
    );
  }

  static invalidCurrency(currency: string): PaymentValidationError {
    return new PaymentValidationError(
      `Unsupported currency: ${currency}`,
      ['Supported currencies: USD, CAD, EUR, GBP']
    );
  }

  static missingPaymentMethod(): PaymentValidationError {
    return new PaymentValidationError(
      'Payment method is required',
      ['Please provide a valid payment method']
    );
  }
}

/**
 * Idempotency-related errors
 */
export class PaymentIdempotencyError extends BasePaymentError {
  constructor(message: string) {
    super(
      'idempotency_error',
      'idempotency_conflict',
      message,
      409, // Conflict
      false,
      'Please use a unique idempotency key for this operation.'
    );
  }
}

/**
 * Permission and authorization errors
 */
export class PaymentPermissionError extends BasePaymentError {
  constructor(
    operation: string,
    resource: string
  ) {
    super(
      'permission_error',
      'insufficient_permissions',
      `Insufficient permissions to ${operation} ${resource}`,
      403, // Forbidden
      false,
      'Please ensure you have the necessary permissions for this operation.'
    );
  }
}

/**
 * Insufficient funds errors
 */
export class InsufficientFundsError extends BasePaymentError {
  public readonly availableBalance: number;
  public readonly requestedAmount: number;

  constructor(
    availableBalance: number,
    requestedAmount: number,
    currency: string = 'USD'
  ) {
    const availableFormatted = (availableBalance / 100).toFixed(2);
    const requestedFormatted = (requestedAmount / 100).toFixed(2);

    super(
      'insufficient_funds',
      'insufficient_funds',
      `Insufficient funds: Available ${currency} ${availableFormatted}, requested ${currency} ${requestedFormatted}`,
      402, // Payment Required
      false,
      'Please add funds to your account or reduce the payment amount.'
    );

    this.availableBalance = availableBalance;
    this.requestedAmount = requestedAmount;
  }
}

/**
 * Generic processing errors
 */
export class PaymentProcessingError extends BasePaymentError {
  constructor(
    message: string,
    retryable: boolean = false,
    stripeError?: Stripe.StripeError
  ) {
    super(
      'processing_error',
      'processing_failed',
      message,
      500, // Internal Server Error
      retryable,
      retryable ? 'Please try again.' : 'Please contact support.',
      stripeError
    );
  }
}

/**
 * Escrow-specific errors
 */
export class EscrowError extends BasePaymentError {
  public readonly transactionId: string;

  constructor(
    transactionId: string,
    operation: string,
    reason: string
  ) {
    super(
      'processing_error',
      'escrow_error',
      `Escrow ${operation} failed: ${reason}`,
      400,
      false,
      'Please contact support for assistance with this transaction.'
    );
    this.transactionId = transactionId;
  }
}

/**
 * Factory function to create appropriate error from Stripe errors
 */
export function createPaymentErrorFromStripe(error: Stripe.StripeError): BasePaymentError {
  switch (error.type) {
    case 'StripeCardError':
      return CardError.fromStripeError(error as Stripe.StripeCardError);
    
    case 'StripeRateLimitError':
      return new PaymentRateLimitError(
        (error as any).retryAfter,
        error as Stripe.StripeRateLimitError
      );
    
    case 'StripeInvalidRequestError':
      return new PaymentValidationError(
        error.message || 'Invalid payment request',
        error.message ? [error.message] : undefined
      );
    
    case 'StripeAPIError':
      return PaymentApiError.fromStripeError(error as Stripe.StripeAPIError);
    
    case 'StripeConnectionError':
      return new PaymentApiError(
        'connection_error',
        'Unable to connect to payment processor',
        true,
        error
      );
    
    case 'StripeAuthenticationError':
      return new PaymentAuthenticationError(
        error.message,
        error as Stripe.StripeAuthenticationError
      );
    
    default:
      return new PaymentProcessingError(
        error.message || 'Payment processing failed',
        false,
        error
      );
  }
}

/**
 * Error sanitization for logging (removes sensitive data)
 */
export function sanitizePaymentError(error: BasePaymentError): Record<string, any> {
  const sanitized: Record<string, any> = {
    type: error.type,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    timestamp: new Date().toISOString(),
  };

  // Add non-sensitive details
  if (error.suggestedAction) {
    sanitized.suggestedAction = error.suggestedAction;
  }

  if (error.details) {
    sanitized.details = error.details;
  }

  // Add specific error properties without sensitive data
  if (error instanceof InsufficientFundsError) {
    sanitized.availableBalance = error.availableBalance;
    sanitized.requestedAmount = error.requestedAmount;
  }

  if (error instanceof PaymentRateLimitError) {
    sanitized.retryAfter = error.retryAfter;
  }

  if (error instanceof EscrowError) {
    sanitized.transactionId = error.transactionId;
  }

  // Include Stripe error code but not sensitive details
  if (error.stripeError) {
    sanitized.stripeErrorType = error.stripeError.type;
    sanitized.stripeErrorCode = error.stripeError.code;
    // Never include raw Stripe error details for security
  }

  return sanitized;
}