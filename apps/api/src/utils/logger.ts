/**
 * Production-grade logging utility for Buy Locals API
 * Replaces console.log statements with structured, secure logging
 * Features: Environment-based levels, JSON formatting, sensitive data filtering
 */
import winston, { Logger } from 'winston';

// SECURITY CRITICAL: Comprehensive sensitive data patterns for sanitization
const SENSITIVE_KEY_PATTERNS = [
  // Authentication and authorization
  /password/i,
  /passwd/i,
  /pass/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /authorization/i,
  /bearer/i,
  /session/i,
  /cookie/i,
  /jwt/i,

  // API and service credentials
  /api_key/i,
  /apikey/i,
  /access_token/i,
  /refresh_token/i,
  /client_secret/i,
  /client_id/i,
  /app_secret/i,
  /app_key/i,

  // Database and connection strings
  /connection_string/i,
  /connectionstring/i,
  /database_url/i,
  /db_password/i,
  /db_pass/i,
  /db_user/i,
  /redis_password/i,
  /mongo_password/i,

  // Cloud provider credentials
  /aws_secret_access_key/i,
  /aws_access_key_id/i,
  /aws_session_token/i,
  /azure_client_secret/i,
  /google_client_secret/i,
  /gcp_service_account/i,

  // Third-party service keys
  /stripe_secret/i,
  /stripe_key/i,
  /paypal_secret/i,
  /sendgrid_key/i,
  /twilio_auth/i,
  /facebook_secret/i,
  /github_token/i,
  /gitlab_token/i,

  // SSL/TLS and certificates
  /private_key/i,
  /cert_key/i,
  /ssl_key/i,
  /tls_key/i,
  /certificate/i,
  /ca_cert/i,

  // Encryption and hashing
  /encryption_key/i,
  /hash_key/i,
  /salt/i,
  /iv/i,
  /nonce/i,
];

// SECURITY CRITICAL: Regex patterns to detect sensitive values in strings
const SENSITIVE_VALUE_PATTERNS = [
  // Passwords and secrets in JSON/URL format
  /(["']?(?:password|pass|pwd|secret|token|key|auth)["']?\s*[:=]\s*["'])([^"'\s,}]+)(["']?)/gi,

  // API keys and tokens
  /(["']?(?:api_key|apikey|access_token|refresh_token|client_secret)["']?\s*[:=]\s*["'])([^"'\s,}]+)(["']?)/gi,

  // Connection strings
  /(["']?(?:connection_string|connectionstring|database_url)["']?\s*[:=]\s*["'])([^"'\s,}]+)(["']?)/gi,

  // AWS credentials
  /(["']?(?:aws_secret_access_key|aws_access_key_id|aws_session_token)["']?\s*[:=]\s*["'])([^"'\s,}]+)(["']?)/gi,

  // Bearer tokens in headers
  /(Bearer\s+)([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*)/gi,

  // Basic auth
  /(Basic\s+)([A-Za-z0-9+/=]+)/gi,

  // Common credential formats
  /([a-zA-Z0-9]{20,})/g, // Long alphanumeric strings (potential tokens)
];

// SECURITY CRITICAL: PII patterns that should be masked
const PII_PATTERNS = [
  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{9}\b/g,

  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{13,19}\b/g,

  // Phone numbers
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\+\d{1,3}[-.\s]?\d{1,14}\b/g,

  // Email addresses (in sensitive contexts)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // IP addresses (internal networks)
  /\b(?:10|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
];

// SECURITY CRITICAL: Keys that are always considered sensitive regardless of pattern matching
const ALWAYS_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pass',
  'pwd',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
  'authorization',
  'bearer',
  'session',
  'cookie',
  'jwt',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'client_secret',
  'connection_string',
  'connectionstring',
  'database_url',
  'db_password',
  'aws_secret_access_key',
  'aws_access_key_id',
  'aws_session_token',
  'private_key',
  'cert_key',
  'ssl_key',
  'encryption_key',
  'hash_key',
  'salt',
  'iv',
  'nonce',
]);

// Production: Log levels based on environment
const LOG_LEVELS = {
  development: 'debug',
  staging: 'info',
  production: 'warn',
  test: 'error',
} as const;

type Environment = keyof typeof LOG_LEVELS;
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  userId?: string;
  requestId?: string;
  businessId?: string;
  component?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

interface SecurityAuditContext extends LogContext {
  action: string;
  resource: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

class ProductionLogger {
  private logger: Logger;
  private environment: Environment;
  private logLevel: LogLevel;

  constructor() {
    this.environment = (process.env.NODE_ENV as Environment) || 'development';
    this.logLevel = LOG_LEVELS[this.environment] as LogLevel;

    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatMessage.bind(this))
      ),
      transports: this.createTransports(),
      exitOnError: false,
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(new winston.transports.File({ filename: 'exceptions.log' }));

    this.logger.rejections.handle(new winston.transports.File({ filename: 'rejections.log' }));
  }

  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    if (this.environment === 'development') {
      // Development: Console output with colors
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        })
      );
    } else {
      // Production: File-based logging with rotation
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );

      // Production: Also log to console for serverless environments
      transports.push(
        new winston.transports.Console({
          format: winston.format.json(),
        })
      );
    }

    return transports;
  }

  private formatMessage(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message, ...meta } = info;

    // Security: Sanitize sensitive data
    const sanitizedMeta = this.sanitizeData(meta);

    const logEntry = {
      timestamp,
      level,
      message,
      environment: this.environment,
      service: 'buy-locals-api',
      ...sanitizedMeta,
    };

    return JSON.stringify(logEntry);
  }

  /**
   * SECURITY CRITICAL: Comprehensive data sanitization to prevent sensitive data exposure
   * This function implements defense-in-depth to catch sensitive data in multiple formats
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitizeValue = (key: string, value: unknown, depth: number = 0): unknown => {
      // Prevent infinite recursion
      if (depth > 10) {
        return '***MAX_DEPTH_REACHED***';
      }

      // Check if key is always sensitive
      const keyLower = key.toLowerCase();
      if (ALWAYS_SENSITIVE_KEYS.has(keyLower)) {
        return '***REDACTED***';
      }

      // Check key against sensitive patterns
      const isKeySensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
      if (isKeySensitive) {
        return '***REDACTED***';
      }

      if (typeof value === 'string') {
        // First sanitize the string against value patterns
        let sanitizedString = value;

        // Apply sensitive value patterns
        SENSITIVE_VALUE_PATTERNS.forEach(pattern => {
          sanitizedString = sanitizedString.replace(pattern, (match, ...groups) => {
            if (groups.length >= 3) {
              // Format: prefix + sensitive_value + suffix
              return `${groups[0]}***REDACTED***${groups[2] || ''}`;
            } else if (groups.length >= 2) {
              // Format: prefix + sensitive_value
              return `${groups[0]}***REDACTED***`;
            } else {
              // Entire match is sensitive
              return '***REDACTED***';
            }
          });
        });

        // Apply PII patterns
        PII_PATTERNS.forEach(pattern => {
          sanitizedString = sanitizedString.replace(pattern, '***PII_REDACTED***');
        });

        // Special handling for potential tokens/keys (long alphanumeric strings)
        if (sanitizedString.length > 20 && /^[A-Za-z0-9+/=-]+$/.test(sanitizedString)) {
          // Likely a token or encoded credential
          if (sanitizedString.length > 100) {
            return `***TOKEN_REDACTED_${sanitizedString.length}_CHARS***`;
          } else if (sanitizedString.length > 50) {
            return `***KEY_REDACTED_${sanitizedString.length}_CHARS***`;
          }
        }

        // Partial masking for emails in non-sensitive contexts
        if (sanitizedString.includes('@') && sanitizedString === value) {
          const emailParts = sanitizedString.split('@');
          if (emailParts.length === 2 && emailParts[0].length > 2) {
            return `${emailParts[0].substring(0, 2)}***@${emailParts[1]}`;
          }
        }

        return sanitizedString;
      }

      if (Array.isArray(value)) {
        return value.map((item, index) => sanitizeValue(`${key}[${index}]`, item, depth + 1));
      }

      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const sanitizedObj: Record<string, unknown> = {};

        for (const [nestedKey, nestedValue] of Object.entries(obj)) {
          sanitizedObj[nestedKey] = sanitizeValue(nestedKey, nestedValue, depth + 1);
        }

        return sanitizedObj;
      }

      // Handle other types (numbers, booleans, etc.)
      return value;
    };

    // Handle the case where data might be an array
    if (Array.isArray(data)) {
      return data.map((item, index) =>
        typeof item === 'object' ? sanitizeValue(`item[${index}]`, item) : item
      ) as unknown as Record<string, unknown>;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeValue(key, value);
    }

    return sanitized;
  }

  // Core logging methods
  public error(message: string, context?: LogContext): void {
    this.logger.error(message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  // Specialized logging methods
  public database(
    message: string,
    context?: LogContext & { query?: string; duration?: number }
  ): void {
    this.info(`[DATABASE] ${message}`, {
      component: 'database',
      ...context,
    });
  }

  public redis(message: string, context?: LogContext & { command?: string; key?: string }): void {
    this.info(`[REDIS] ${message}`, {
      component: 'redis',
      ...context,
    });
  }

  public auth(message: string, context?: LogContext & { userId?: string; action?: string }): void {
    this.info(`[AUTH] ${message}`, {
      component: 'authentication',
      ...context,
    });
  }

  public api(
    message: string,
    context?: LogContext & {
      method?: string;
      path?: string;
      statusCode?: number;
      duration?: number;
    }
  ): void {
    this.info(`[API] ${message}`, {
      component: 'api',
      ...context,
    });
  }

  public business(
    message: string,
    context?: LogContext & { businessId?: string; operation?: string }
  ): void {
    this.info(`[BUSINESS] ${message}`, {
      component: 'business-service',
      ...context,
    });
  }

  public security(message: string, context: SecurityAuditContext): void {
    this.warn(`[SECURITY] ${message}`, {
      component: 'security-audit',
      ...context,
    });
  }

  // Performance monitoring
  public performance(
    message: string,
    context: LogContext & { duration: number; operation: string }
  ): void {
    const level = context.duration > 1000 ? 'warn' : 'info';
    this.logger.log(level, `[PERFORMANCE] ${message}`, {
      component: 'performance',
      ...context,
    });
  }

  // Error tracking with stack traces
  public exception(error: Error, context?: LogContext): void {
    this.error(`[EXCEPTION] ${error.message}`, {
      component: 'error-handler',
      stack: error.stack,
      errorName: error.name,
      ...context,
    });
  }

  // Request/Response logging
  public request(method: string, path: string, context?: LogContext): void {
    this.info(`[REQUEST] ${method} ${path}`, {
      component: 'request-logger',
      method,
      path,
      ...context,
    });
  }

  public response(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, `[RESPONSE] ${method} ${path} ${statusCode} (${duration}ms)`, {
      component: 'response-logger',
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }

  // Health check logging
  public health(service: string, status: 'healthy' | 'unhealthy', context?: LogContext): void {
    const level = status === 'healthy' ? 'info' : 'error';
    this.logger.log(level, `[HEALTH] ${service}: ${status}`, {
      component: 'health-check',
      service,
      status,
      ...context,
    });
  }

  // Migration and deployment logging
  public deployment(message: string, context?: LogContext): void {
    this.info(`[DEPLOYMENT] ${message}`, {
      component: 'deployment',
      ...context,
    });
  }

  public migration(
    message: string,
    context?: LogContext & { migration?: string; direction?: 'up' | 'down' }
  ): void {
    this.info(`[MIGRATION] ${message}`, {
      component: 'database-migration',
      ...context,
    });
  }

  // Environment-specific helpers
  public isDebugEnabled(): boolean {
    return this.logger.isDebugEnabled();
  }

  public isDevelopment(): boolean {
    return this.environment === 'development';
  }

  public isProduction(): boolean {
    return this.environment === 'production';
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    this.logger.close();
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Export types for use in other modules
export type { LogContext, SecurityAuditContext };

// Legacy console replacement (for gradual migration)
export const console = {
  log: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.info(message, { args });
    } else {
      logger.info(message);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.error(message, { args });
    } else {
      logger.error(message);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.warn(message, { args });
    } else {
      logger.warn(message);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.info(message, { args });
    } else {
      logger.info(message);
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      logger.debug(message, { args });
    } else {
      logger.debug(message);
    }
  },
};

export default logger;
