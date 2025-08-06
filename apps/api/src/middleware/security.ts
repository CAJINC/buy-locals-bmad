import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https:; " +
    "font-src 'self' https:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // HSTS (HTTP Strict Transport Security)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (Feature Policy)
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
  );

  next();
};

/**
 * Request sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize object properties
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters and scripts
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize both key and value
        const cleanKey = key.replace(/[<>]/g, '');
        sanitized[cleanKey] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * IP-based suspicious activity detection
 */
export class SuspiciousActivityDetector {
  private static readonly SUSPICIOUS_PREFIX = 'suspicious:';
  private static readonly BLOCK_PREFIX = 'blocked_ip:';
  private static readonly SUSPICIOUS_THRESHOLD = 10; // Suspicious requests per hour
  private static readonly BLOCK_DURATION = 60 * 60; // 1 hour in seconds

  /**
   * Track suspicious activity patterns
   */
  static async trackActivity(ip: string, activity: string): Promise<{
    isSuspicious: boolean;
    isBlocked: boolean;
  }> {
    // This would integrate with Redis in production
    // For now, return default values
    console.log(`Tracking suspicious activity: ${ip} - ${activity}`);
    return { isSuspicious: false, isBlocked: false };
  }

  /**
   * Check if IP is blocked
   */
  static async isIPBlocked(ip: string): Promise<boolean> {
    // This would integrate with Redis in production
    console.log(`Checking if IP is blocked: ${ip}`);
    return false;
  }

  /**
   * Block suspicious IP
   */
  static async blockIP(ip: string, reason: string): Promise<void> {
    console.log(`Blocking IP ${ip}: ${reason}`);
    // Implementation would use Redis to store blocked IPs
  }
}

/**
 * Audit logging middleware
 */
export const auditLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Generate correlation ID for request tracking
  const correlationId = crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request details (without sensitive data)
  const logData = {
    correlationId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    // Don't log request body for security - it might contain passwords
  };

  console.log('AUTH_REQUEST:', JSON.stringify(logData));

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Log response (without sensitive data)
    const responseLog = {
      correlationId,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      duration,
      // Don't log response body for security
    };

    console.log('AUTH_RESPONSE:', JSON.stringify(responseLog));
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Password complexity validation
 */
export const passwordComplexity = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Made optional for better UX
  
  validate(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }
    
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check for common weak patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
    ];
    
    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns and is not secure');
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
};

/**
 * CSRF protection (for cookie-based auth if used)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // For JWT-based auth, CSRF is less of a concern
  // But we can still validate origin headers
  const origin = req.get('Origin');
  const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:3001', // Mobile dev server
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid origin',
    });
  }

  next();
};