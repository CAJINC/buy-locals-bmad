import Stripe from 'stripe';

// Stripe Configuration Interface
interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  apiVersion: string;
}

// Stripe environment variables with security validation
const stripeConfig: StripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }
    return '';
  })(),
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_PUBLISHABLE_KEY is required in production');
    }
    return '';
  })(),
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_WEBHOOK_SECRET is required in production');
    }
    return '';
  })(),
  apiVersion: (process.env.STRIPE_API_VERSION || '2024-12-18.acacia') as Stripe.LatestApiVersion,
};

// Initialize Stripe client with security configurations
export const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: stripeConfig.apiVersion as Stripe.LatestApiVersion,
  typescript: true,
  telemetry: false, // Disable telemetry for security
  maxNetworkRetries: 3,
  timeout: 30000, // 30 second timeout
  host: 'api.stripe.com',
  protocol: 'https',
  appInfo: {
    name: 'BuyLocals Platform',
    version: '1.0.0',
    url: 'https://buylocals.com',
  },
});

// Webhook signature verification utility
export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
};

// PCI DSS Compliant Configuration
export const stripeSecurityConfig = {
  // Allowed payment methods (PCI DSS compliant)
  allowedPaymentMethods: [
    'card',
    'apple_pay',
    'google_pay',
  ] as const,
  
  // Security headers for Stripe requests
  securityHeaders: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
  
  // Rate limiting for payment endpoints
  rateLimits: {
    paymentIntents: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 requests per windowMs
    },
    webhooks: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
} as const;

// Validate Stripe configuration
export const validateStripeConfig = (): void => {
  const requiredKeys = ['secretKey', 'publishableKey', 'webhookSecret'] as const;
  
  for (const key of requiredKeys) {
    if (!stripeConfig[key]) {
      throw new Error(`Missing required Stripe configuration: ${key}`);
    }
  }
  
  // Validate key formats
  if (!stripeConfig.secretKey.startsWith('sk_')) {
    throw new Error('Invalid Stripe secret key format');
  }
  
  if (!stripeConfig.publishableKey.startsWith('pk_')) {
    throw new Error('Invalid Stripe publishable key format');
  }
  
  if (!stripeConfig.webhookSecret.startsWith('whsec_')) {
    throw new Error('Invalid Stripe webhook secret format');
  }
  
  // Environment-specific validations
  const isProduction = process.env.NODE_ENV === 'production';
  const hasLiveKeys = stripeConfig.secretKey.includes('_live_') || 
                     stripeConfig.publishableKey.includes('_live_');
  
  if (isProduction && !hasLiveKeys) {
    console.warn('WARNING: Using test keys in production environment');
  }
  
  if (!isProduction && hasLiveKeys) {
    throw new Error('SECURITY VIOLATION: Live keys detected in non-production environment');
  }
};

// Export configuration for external access (read-only)
export const getStripePublishableKey = (): string => stripeConfig.publishableKey;
export const getStripeApiVersion = (): string => stripeConfig.apiVersion;

// Security utilities for logging (never log sensitive data)
export const sanitizeStripeError = (error: unknown): Record<string, unknown> => {
  const sanitized = {
    type: error.type || 'unknown',
    code: error.code || 'unknown',
    message: error.message || 'Unknown error',
    status: error.status || 500,
  };
  
  // Never log sensitive information
  if (error.payment_intent) {
    (sanitized as any).payment_intent_id = error.payment_intent.id;
  }
  
  return sanitized;
};

// Initialize and validate configuration on module load
try {
  validateStripeConfig();
  console.log('Stripe configuration initialized successfully');
} catch (error) {
  console.error('Stripe configuration error:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}