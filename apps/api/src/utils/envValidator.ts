/**
 * SECURITY CRITICAL: Environment Variable Validation Utility
 * Validates and enforces security requirements for environment variables
 * Prevents application startup with insecure configurations
 */

export interface SecurityConfig {
  databaseUrl: string;
  jwtSecret: string;
  redisPassword: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  googleClientSecret: string;
  nodeEnv: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: SecurityConfig;
}

/**
 * SECURITY: Required environment variables for secure operation
 */
const REQUIRED_SECURITY_VARS: Record<
  string,
  {
    key: string;
    description: string;
    minLength?: number;
    pattern?: RegExp;
    validator?: (value: string) => { isValid: boolean; error?: string };
  }
> = {
  DATABASE_URL: {
    key: 'DATABASE_URL',
    description: 'Database connection string',
    minLength: 10,
    pattern: /^postgres:\/\/.+/,
  },
  JWT_SECRET: {
    key: 'JWT_SECRET',
    description: 'JWT signing secret',
    minLength: 32,
    validator: (value: string) => {
      if (value.length < 32) {
        return { isValid: false, error: 'JWT_SECRET must be at least 32 characters for security' };
      }
      if (value === 'your-secret-key' || value === 'secret' || value === 'change-me') {
        return { isValid: false, error: 'JWT_SECRET cannot be a default/example value' };
      }
      // Check for sufficient entropy (at least some variation in characters)
      const uniqueChars = new Set(value).size;
      if (uniqueChars < 10) {
        return {
          isValid: false,
          error: 'JWT_SECRET has insufficient entropy (too few unique characters)',
        };
      }
      return { isValid: true };
    },
  },
  REDIS_PASSWORD: {
    key: 'REDIS_PASSWORD',
    description: 'Redis authentication password',
    minLength: 8,
  },
  COGNITO_USER_POOL_ID: {
    key: 'COGNITO_USER_POOL_ID',
    description: 'AWS Cognito User Pool ID',
    pattern: /^[a-z0-9-]+_[A-Za-z0-9]+$/,
  },
  COGNITO_CLIENT_ID: {
    key: 'COGNITO_CLIENT_ID',
    description: 'AWS Cognito Client ID',
    minLength: 10,
  },
  GOOGLE_CLIENT_SECRET: {
    key: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret',
    minLength: 20,
  },
  NODE_ENV: {
    key: 'NODE_ENV',
    description: 'Node environment',
    validator: (value: string) => {
      const validEnvs = ['development', 'staging', 'production', 'test'];
      if (!validEnvs.includes(value)) {
        return {
          isValid: false,
          error: `NODE_ENV must be one of: ${validEnvs.join(', ')}`,
        };
      }
      return { isValid: true };
    },
  },
};

/**
 * SECURITY: Optional but recommended environment variables
 */
const RECOMMENDED_SECURITY_VARS = [
  'DATABASE_CA_CERT',
  'DATABASE_CLIENT_CERT',
  'DATABASE_CLIENT_KEY',
  'API_RATE_LIMIT_MAX',
  'SESSION_TIMEOUT',
  'PASSWORD_MIN_LENGTH',
  'CORS_ORIGINS',
];

/**
 * SECURITY: Environment variables that should never contain default values
 */
const INSECURE_DEFAULT_VALUES = [
  'password',
  'secret',
  'changeme',
  'change-me',
  'default',
  'example',
  'test',
  '123456',
  'admin',
  'root',
  'your-secret-key',
  'your-api-key',
  'localhost',
];

/**
 * Validate all security-critical environment variables
 */
export function validateSecurityEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Partial<SecurityConfig> = {};

  // Check required variables
  for (const [varName, requirements] of Object.entries(REQUIRED_SECURITY_VARS)) {
    const value = process.env[requirements.key];

    if (!value) {
      errors.push(
        `Missing required environment variable: ${requirements.key} (${requirements.description})`
      );
      continue;
    }

    // Check minimum length
    if (requirements.minLength && value.length < requirements.minLength) {
      errors.push(`${requirements.key} must be at least ${requirements.minLength} characters long`);
      continue;
    }

    // Check pattern
    if (requirements.pattern && !requirements.pattern.test(value)) {
      errors.push(`${requirements.key} does not match required format`);
      continue;
    }

    // Custom validator
    if (requirements.validator) {
      const validation = requirements.validator(value);
      if (!validation.isValid) {
        errors.push(`${requirements.key}: ${validation.error}`);
        continue;
      }
    }

    // Check for insecure default values
    const lowerValue = value.toLowerCase();
    if (INSECURE_DEFAULT_VALUES.some(insecure => lowerValue.includes(insecure))) {
      errors.push(`${requirements.key} appears to contain a default or insecure value`);
      continue;
    }

    // Store validated value
    const configKey = varName
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof SecurityConfig;
    (config as any)[configKey] = value;
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_SECURITY_VARS) {
    if (!process.env[varName]) {
      warnings.push(`Recommended security variable not set: ${varName}`);
    }
  }

  // Environment-specific validations
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    // Production-specific security checks
    if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
      errors.push(
        'CRITICAL: SSL certificate validation is disabled in production (DATABASE_SSL_REJECT_UNAUTHORIZED=false)'
      );
    }

    if (!process.env.DATABASE_CA_CERT && !process.env.DATABASE_URL?.includes('sslmode=require')) {
      warnings.push('Production database should use SSL with certificate validation');
    }

    if (!process.env.API_RATE_LIMIT_MAX) {
      warnings.push('API rate limiting not configured for production');
    }

    if (!process.env.CORS_ORIGINS) {
      warnings.push('CORS origins not explicitly configured for production');
    }
  }

  if (nodeEnv === 'development') {
    // Development environment warnings
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push(
        'Consider using a longer JWT secret in development to match production security'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: errors.length === 0 ? (config as SecurityConfig) : undefined,
  };
}

/**
 * Validate environment and throw error if invalid
 * Use this during application startup
 */
export function validateSecurityEnvironmentOrThrow(): SecurityConfig {
  const validation = validateSecurityEnvironment();

  if (!validation.isValid) {
    const errorMessage = [
      'SECURITY VALIDATION FAILED - Application cannot start with insecure configuration:',
      '',
      ...validation.errors.map(error => `❌ ${error}`),
      '',
      'Fix these issues before starting the application.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  if (validation.warnings.length > 0) {
    // Security warnings are intentionally logged to console as they are critical for deployment safety
    // eslint-disable-next-line no-console
    console.warn('SECURITY WARNINGS - Consider addressing these issues:');
    // eslint-disable-next-line no-console
    validation.warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
    // eslint-disable-next-line no-console
    console.warn('');
  }

  return validation.config!;
}

/**
 * Get current security configuration (assumes validation has passed)
 */
export function getSecurityConfig(): SecurityConfig {
  const validation = validateSecurityEnvironment();

  if (!validation.isValid) {
    throw new Error(
      'Security environment is not valid. Call validateSecurityEnvironmentOrThrow() during startup.'
    );
  }

  return validation.config!;
}

/**
 * Check if current environment is production
 */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if current environment requires strict security
 */
export function requiresStrictSecurity(): boolean {
  return ['production', 'staging'].includes(process.env.NODE_ENV || '');
}

/**
 * Sanitize environment variables for logging (remove sensitive values)
 */
export function sanitizeEnvironmentForLogging(): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveKeys = Object.keys(REQUIRED_SECURITY_VARS);

  for (const [key, value] of Object.entries(process.env)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'string') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export default {
  validateSecurityEnvironment,
  validateSecurityEnvironmentOrThrow,
  getSecurityConfig,
  isProductionEnvironment,
  requiresStrictSecurity,
  sanitizeEnvironmentForLogging,
};
