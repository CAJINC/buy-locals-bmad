import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { pool } from '../config/database.js';
import { badRequest, forbidden, internalServerError, unauthorized } from '../utils/lambdaResponseUtils.js';

export interface PaymentSecurityContext {
  userId: string;
  userRole: string;
  businessId?: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  timestamp: Date;
}

export interface PaymentRateLimit {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
  userBased: boolean;
  ipBased: boolean;
}

/**
 * Enhanced Payment Security Middleware
 * 
 * Provides comprehensive security controls for payment endpoints including
 * rate limiting, fraud detection, and audit logging.
 */
export class PaymentSecurityMiddleware {
  private static rateLimits: Map<string, PaymentRateLimit> = new Map([
    ['payment/createIntent', { endpoint: 'payment/createIntent', maxRequests: 10, windowMinutes: 1, userBased: true, ipBased: true }],
    ['payment/confirmPayment', { endpoint: 'payment/confirmPayment', maxRequests: 5, windowMinutes: 1, userBased: true, ipBased: true }],
    ['payment/capturePayment', { endpoint: 'payment/capturePayment', maxRequests: 10, windowMinutes: 5, userBased: true, ipBased: false }],
    ['refund/processRefund', { endpoint: 'refund/processRefund', maxRequests: 5, windowMinutes: 5, userBased: true, ipBased: true }],
    ['webhook/stripe', { endpoint: 'webhook/stripe', maxRequests: 100, windowMinutes: 1, userBased: false, ipBased: true }],
  ]);

  private static fraudPatterns: RegExp[] = [
    /script|javascript|vbscript|onload|onerror/i,
    /<[^>]*>/g,
    /union.*select|insert.*into|drop.*table|exec.*sp_/i,
    /\.\.\//g
  ];

  /**
   * Main security middleware for Lambda payment endpoints
   */
  static async securePaymentEndpoint(
    event: APIGatewayProxyEvent,
    endpointName: string
  ): Promise<PaymentSecurityContext | APIGatewayProxyResult> {
    const correlationId = uuidv4();
    const timestamp = new Date();
    
    try {
      // Extract security context from event
      const ipAddress = event.requestContext.identity?.sourceIp || 'unknown';
      const userAgent = event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown';
      const userId = event.requestContext.authorizer?.userId;
      const userRole = event.requestContext.authorizer?.userRole;
      
      // Basic authentication check
      if (!userId && !endpointName.includes('webhook')) {
        return unauthorized('Authentication required');
      }

      const context: PaymentSecurityContext = {
        userId: userId || 'system',
        userRole: userRole || 'system',
        correlationId,
        ipAddress,
        userAgent,
        requestPath: event.path || endpointName,
        timestamp
      };

      // Rate limiting check
      const rateLimitResult = await this.checkRateLimit(context, endpointName);
      if (rateLimitResult !== true) {
        return rateLimitResult;
      }

      // Input validation and fraud detection
      if (event.body) {
        const fraudCheckResult = await this.checkForFraud(event.body, context);
        if (fraudCheckResult !== true) {
          return fraudCheckResult;
        }
      }

      // IP geolocation and suspicious activity check
      const geoSecurityResult = await this.checkGeoSecurity(ipAddress, context);
      if (geoSecurityResult !== true) {
        return geoSecurityResult;
      }

      // Log security event
      await this.logSecurityEvent({
        operation: 'security_check',
        endpointName,
        context,
        result: 'passed',
        details: {
          rateLimitPassed: true,
          fraudCheckPassed: true,
          geoSecurityPassed: true
        }
      });

      return context;

    } catch (error) {
      logger.error('Payment security middleware error', {
        endpointName,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      await this.logSecurityEvent({
        operation: 'security_check',
        endpointName,
        context: {
          userId: 'unknown',
          userRole: 'unknown',
          correlationId,
          ipAddress: event.requestContext.identity?.sourceIp || 'unknown',
          userAgent: 'unknown',
          requestPath: event.path || endpointName,
          timestamp
        },
        result: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return internalServerError('Security validation failed');
    }
  }

  /**
   * Check rate limits for payment endpoints
   */
  private static async checkRateLimit(
    context: PaymentSecurityContext,
    endpointName: string
  ): Promise<true | APIGatewayProxyResult> {
    const rateLimit = this.rateLimits.get(endpointName);
    if (!rateLimit) {
      return true; // No rate limit configured
    }

    const windowStart = new Date(Date.now() - (rateLimit.windowMinutes * 60 * 1000));
    const rateLimitChecks: Array<Promise<any>> = [];

    // Check user-based rate limiting
    if (rateLimit.userBased && context.userId !== 'system') {
      rateLimitChecks.push(
        pool.query(
          `SELECT COUNT(*) as count FROM payment_audit_logs 
           WHERE operation_type LIKE $1 AND user_id = $2 AND timestamp > $3`,
          [`%${endpointName.split('/')[0]}%`, context.userId, windowStart]
        )
      );
    }

    // Check IP-based rate limiting
    if (rateLimit.ipBased) {
      rateLimitChecks.push(
        pool.query(
          `SELECT COUNT(*) as count FROM payment_audit_logs 
           WHERE operation_type LIKE $1 AND ip_address = $2 AND timestamp > $3`,
          [`%${endpointName.split('/')[0]}%`, context.ipAddress, windowStart]
        )
      );
    }

    try {
      const results = await Promise.all(rateLimitChecks);
      
      for (const result of results) {
        const count = parseInt(result.rows[0].count) || 0;
        if (count >= rateLimit.maxRequests) {
          await this.logSecurityEvent({
            operation: 'rate_limit_exceeded',
            endpointName,
            context,
            result: 'blocked',
            details: {
              limit: rateLimit.maxRequests,
              window: rateLimit.windowMinutes,
              currentCount: count
            }
          });

          return badRequest(`Rate limit exceeded. Maximum ${rateLimit.maxRequests} requests per ${rateLimit.windowMinutes} minute(s).`);
        }
      }

      return true;
    } catch (error) {
      logger.error('Rate limit check failed', {
        endpointName,
        correlationId: context.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fail open for rate limiting errors to avoid blocking legitimate requests
      return true;
    }
  }

  /**
   * Check for fraud patterns and malicious input
   */
  private static async checkForFraud(
    requestBody: string,
    context: PaymentSecurityContext
  ): Promise<true | APIGatewayProxyResult> {
    // Check for malicious patterns
    for (const pattern of this.fraudPatterns) {
      if (pattern.test(requestBody)) {
        await this.logSecurityEvent({
          operation: 'fraud_detection',
          endpointName: context.requestPath,
          context,
          result: 'blocked',
          details: {
            pattern: pattern.source,
            matchedContent: requestBody.substring(0, 100) // Log first 100 chars only
          }
        });

        return badRequest('Request contains potentially malicious content');
      }
    }

    // Check for suspicious patterns specific to payments
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch {
      return badRequest('Invalid JSON format');
    }

    // Check for unusually large amounts
    if (parsedBody.amount && typeof parsedBody.amount === 'number') {
      if (parsedBody.amount > 1000000) { // $10,000 limit
        await this.logSecurityEvent({
          operation: 'fraud_detection',
          endpointName: context.requestPath,
          context,
          result: 'blocked',
          details: {
            reason: 'excessive_amount',
            amount: parsedBody.amount
          }
        });

        return badRequest('Transaction amount exceeds maximum limit');
      }

      if (parsedBody.amount <= 0) {
        return badRequest('Transaction amount must be positive');
      }
    }

    // Check for suspicious email patterns
    if (parsedBody.email && typeof parsedBody.email === 'string') {
      const suspiciousEmailPatterns = [
        /\+.*\+/g, // Multiple plus signs
        /\.{2,}/g, // Multiple consecutive dots
        /@.*@/g,   // Multiple @ signs
      ];

      for (const pattern of suspiciousEmailPatterns) {
        if (pattern.test(parsedBody.email)) {
          return badRequest('Invalid email format');
        }
      }
    }

    return true;
  }

  /**
   * Check IP geolocation and suspicious activity
   */
  private static async checkGeoSecurity(
    ipAddress: string,
    context: PaymentSecurityContext
  ): Promise<true | APIGatewayProxyResult> {
    try {
      // Check if IP is in blocked list
      const blockedIpQuery = `
        SELECT COUNT(*) as count FROM blocked_ips 
        WHERE ip_address = $1 AND expires_at > NOW()
      `;
      
      const blockedIpResult = await pool.query(blockedIpQuery, [ipAddress]);
      const blockedCount = parseInt(blockedIpResult.rows[0].count) || 0;
      
      if (blockedCount > 0) {
        await this.logSecurityEvent({
          operation: 'geo_security',
          endpointName: context.requestPath,
          context,
          result: 'blocked',
          details: {
            reason: 'blocked_ip',
            ipAddress
          }
        });

        return forbidden('Access denied from this IP address');
      }

      // Check for too many failed attempts from this IP
      const failedAttemptsQuery = `
        SELECT COUNT(*) as count FROM payment_audit_logs 
        WHERE ip_address = $1 AND success = false AND timestamp > NOW() - INTERVAL '1 hour'
      `;
      
      const failedAttemptsResult = await pool.query(failedAttemptsQuery, [ipAddress]);
      const failedCount = parseInt(failedAttemptsResult.rows[0].count) || 0;
      
      if (failedCount >= 10) {
        // Temporarily block this IP
        await pool.query(
          `INSERT INTO blocked_ips (id, ip_address, reason, expires_at, created_at) 
           VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', NOW())
           ON CONFLICT (ip_address) DO UPDATE SET expires_at = NOW() + INTERVAL '1 hour'`,
          [uuidv4(), ipAddress, 'excessive_failed_attempts']
        );

        await this.logSecurityEvent({
          operation: 'geo_security',
          endpointName: context.requestPath,
          context,
          result: 'blocked',
          details: {
            reason: 'excessive_failed_attempts',
            failedCount,
            blockDuration: '1 hour'
          }
        });

        return forbidden('Too many failed attempts. IP temporarily blocked.');
      }

      return true;
    } catch (error) {
      logger.error('Geo security check failed', {
        ipAddress,
        correlationId: context.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fail open for geo security errors
      return true;
    }
  }

  /**
   * Log security events for audit and monitoring
   */
  private static async logSecurityEvent(eventData: {
    operation: string;
    endpointName: string;
    context: PaymentSecurityContext;
    result: 'passed' | 'blocked' | 'error';
    details?: any;
    error?: string;
  }): Promise<void> {
    try {
      const securityLogQuery = `
        INSERT INTO security_audit_logs (
          id, operation, endpoint_name, user_id, ip_address, user_agent,
          result, details, error_message, created_at, correlation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      const securityLogValues = [
        uuidv4(),
        eventData.operation,
        eventData.endpointName,
        eventData.context.userId,
        eventData.context.ipAddress,
        eventData.context.userAgent,
        eventData.result,
        JSON.stringify(eventData.details || {}),
        eventData.error,
        eventData.context.timestamp,
        eventData.context.correlationId
      ];

      await pool.query(securityLogQuery, securityLogValues);

      // Also log to application logger for immediate monitoring
      const logLevel = eventData.result === 'blocked' ? 'warn' : 
                      eventData.result === 'error' ? 'error' : 'info';
      
      logger[logLevel]('Payment security event', {
        operation: eventData.operation,
        endpoint: eventData.endpointName,
        result: eventData.result,
        userId: eventData.context.userId,
        ipAddress: eventData.context.ipAddress,
        correlationId: eventData.context.correlationId,
        details: eventData.details,
        error: eventData.error
      });

    } catch (logError) {
      logger.error('Failed to log security event', {
        operation: eventData.operation,
        endpoint: eventData.endpointName,
        correlationId: eventData.context.correlationId,
        logError: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }
  }

  /**
   * Extract business ID from request for authorization
   */
  static extractBusinessId(event: APIGatewayProxyEvent): string | null {
    // Try path parameters first
    if (event.pathParameters?.businessId) {
      return event.pathParameters.businessId;
    }

    // Try query parameters
    if (event.queryStringParameters?.businessId) {
      return event.queryStringParameters.businessId;
    }

    // Try request body
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        return body.businessId || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Verify business ownership for authorization
   */
  static async verifyBusinessAuthorization(
    businessId: string,
    userId: string,
    userRole: string,
    allowedRoles: string[] = ['business_owner', 'admin']
  ): Promise<boolean> {
    try {
      if (allowedRoles.includes(userRole) && userRole === 'admin') {
        return true; // Admins have access to all businesses
      }

      const businessQuery = `
        SELECT owner_id FROM businesses WHERE id = $1
      `;
      
      const businessResult = await pool.query(businessQuery, [businessId]);
      
      if (businessResult.rows.length === 0) {
        return false; // Business not found
      }

      const business = businessResult.rows[0];
      
      // Check if user is the business owner
      if (business.owner_id === userId && allowedRoles.includes('business_owner')) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Business authorization check failed', {
        businessId,
        userId,
        userRole,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}