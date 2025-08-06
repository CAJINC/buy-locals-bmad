import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

/**
 * Payment Security Utilities
 * 
 * Provides comprehensive security features for payment operations:
 * - Request sanitization and validation
 * - PCI DSS compliance utilities
 * - Encryption/decryption for sensitive data
 * - Rate limiting helpers
 * - Audit trail generation
 */

export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  audit: {
    logLevel: string;
    retentionDays: number;
    sensitiveFields: string[];
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false
  },
  audit: {
    logLevel: 'info',
    retentionDays: 90,
    sensitiveFields: [
      'payment_method_id',
      'customer_id',
      'card_number',
      'cvv',
      'ssn',
      'bank_account',
      'routing_number'
    ]
  }
};

/**
 * Input sanitization and validation
 */
export class InputSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\$\([^)]*\)/gi,
    /(union|select|insert|update|delete|drop|create|alter)\s+/gi
  ];

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    let sanitized = input.trim();

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Encode HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Validate payment amount
   */
  static validateAmount(amount: any): number {
    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Prevent integer overflow
    if (amount > Number.MAX_SAFE_INTEGER) {
      throw new Error('Payment amount too large');
    }

    // Round to prevent floating point precision issues
    return Math.round(amount);
  }

  /**
   * Validate currency code
   */
  static validateCurrency(currency: string): string {
    const validCurrencies = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY'];
    const upperCurrency = currency.toUpperCase();

    if (!validCurrencies.includes(upperCurrency)) {
      throw new Error(`Invalid currency: ${currency}`);
    }

    return upperCurrency;
  }

  /**
   * Validate and sanitize metadata
   */
  static sanitizeMetadata(metadata: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const maxKeyLength = 40;
    const maxValueLength = 500;
    const maxKeys = 20;

    const keys = Object.keys(metadata);
    if (keys.length > maxKeys) {
      throw new Error(`Too many metadata keys (max: ${maxKeys})`);
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (key.length > maxKeyLength) {
        throw new Error(`Metadata key too long (max: ${maxKeyLength})`);
      }

      const stringValue = String(value);
      if (stringValue.length > maxValueLength) {
        throw new Error(`Metadata value too long (max: ${maxValueLength})`);
      }

      sanitized[this.sanitizeInput(key)] = this.sanitizeInput(stringValue);
    }

    return sanitized;
  }
}

/**
 * Data encryption utilities for sensitive payment data
 */
export class PaymentEncryption {
  private readonly config: SecurityConfig['encryption'];
  private readonly encryptionKey: Buffer;

  constructor(config: SecurityConfig['encryption'] = defaultSecurityConfig.encryption) {
    this.config = config;
    
    // In production, load from secure environment variable or key management service
    const keyString = process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-change-in-production';
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', this.config.keyLength);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipher(this.config.algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag() : Buffer.alloc(0);
      
      // Combine IV, auth tag, and encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      const iv = combined.slice(0, this.config.ivLength);
      const authTag = combined.slice(this.config.ivLength, this.config.ivLength + 16);
      const encrypted = combined.slice(this.config.ivLength + 16);
      
      const decipher = crypto.createDecipher(this.config.algorithm, this.encryptionKey);
      
      if ((decipher as any).setAuthTag) {
        (decipher as any).setAuthTag(authTag);
      }
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for storage (one-way)
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512');
    
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      const computedHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
      
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), computedHash);
    } catch (error) {
      return false;
    }
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  private readonly requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly config: SecurityConfig['rateLimit'];

  constructor(config: SecurityConfig['rateLimit'] = defaultSecurityConfig.rateLimit) {
    this.config = config;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request is rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return false;
    }

    if (entry.count >= this.config.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  /**
   * Get rate limit info for headers
   */
  getRateLimitInfo(identifier: string): { limit: number; remaining: number; resetTime: number } {
    const entry = this.requests.get(identifier);
    
    if (!entry || Date.now() > entry.resetTime) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        resetTime: Date.now() + this.config.windowMs
      };
    }

    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * Audit trail utilities
 */
export class AuditLogger {
  private readonly config: SecurityConfig['audit'];

  constructor(config: SecurityConfig['audit'] = defaultSecurityConfig.audit) {
    this.config = config;
  }

  /**
   * Create audit log entry
   */
  log(
    operation: string,
    userId?: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const auditEntry = {
      id: uuidv4(),
      operation,
      userId,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      metadata: this.sanitizeAuditMetadata(metadata || {}),
      correlationId: this.generateCorrelationId()
    };

    // Log based on configured level
    switch (this.config.logLevel) {
      case 'debug':
        logger.debug('Payment Audit', auditEntry);
        break;
      case 'info':
        logger.info('Payment Audit', auditEntry);
        break;
      case 'warn':
        logger.warn('Payment Audit', auditEntry);
        break;
      default:
        logger.info('Payment Audit', auditEntry);
    }

    // In production, also store in secure audit database
    this.persistAuditLog(auditEntry);
  }

  /**
   * Sanitize audit metadata to remove sensitive information
   */
  private sanitizeAuditMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field contains sensitive data
      const isSensitive = this.config.sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        if (typeof value === 'string' && value.length > 4) {
          // Mask sensitive data, showing only last 4 characters
          sanitized[key] = `***${value.slice(-4)}`;
        } else {
          sanitized[key] = '***';
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private generateCorrelationId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private async persistAuditLog(auditEntry: any): Promise<void> {
    // In production, save to secure audit database
    // This could be a separate database with restricted access
    logger.debug('Audit log would be persisted to secure storage', { 
      id: auditEntry.id,
      operation: auditEntry.operation 
    });
  }
}

/**
 * PCI DSS compliance utilities
 */
export class PCIComplianceHelper {
  /**
   * Validate card number format (without storing actual number)
   */
  static validateCardNumberFormat(cardNumber: string): boolean {
    // Remove spaces and hyphens
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    
    // Check if it's all digits
    if (!/^\d+$/.test(cleaned)) {
      return false;
    }

    // Check length (13-19 digits)
    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }

    // Luhn algorithm check
    return this.luhnCheck(cleaned);
  }

  /**
   * Luhn algorithm for card number validation
   */
  private static luhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let alternate = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i], 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit = Math.floor(digit / 10) + (digit % 10);
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }

  /**
   * Mask sensitive payment data for display
   */
  static maskPaymentData(data: string, type: 'card' | 'bank' | 'ssn'): string {
    if (!data || data.length <= 4) {
      return '***';
    }

    switch (type) {
      case 'card':
        return `****-****-****-${data.slice(-4)}`;
      case 'bank':
        return `***${data.slice(-4)}`;
      case 'ssn':
        return `***-**-${data.slice(-4)}`;
      default:
        return `***${data.slice(-4)}`;
    }
  }

  /**
   * Generate secure random string for tokens
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * Validate PCI DSS compliance requirements
   */
  static validatePCICompliance(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check environment variables
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('test')) {
      issues.push('Production Stripe keys not configured');
    }

    if (!process.env.PAYMENT_ENCRYPTION_KEY) {
      issues.push('Payment encryption key not configured');
    }

    if (process.env.NODE_ENV !== 'production') {
      issues.push('Not running in production mode');
    }

    // Check HTTPS enforcement
    if (!process.env.FORCE_HTTPS) {
      issues.push('HTTPS enforcement not enabled');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }
}

/**
 * Security middleware factory
 */
export function createSecurityMiddleware(config: Partial<SecurityConfig> = {}) {
  const fullConfig = { ...defaultSecurityConfig, ...config };
  const rateLimiter = new RateLimiter(fullConfig.rateLimit);
  const auditLogger = new AuditLogger(fullConfig.audit);
  const encryption = new PaymentEncryption(fullConfig.encryption);

  return {
    rateLimiter,
    auditLogger,
    encryption,
    config: fullConfig
  };
}