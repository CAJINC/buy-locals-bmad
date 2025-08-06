import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

// SECURITY: Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// SECURITY: Validate SSL configuration in production
if (process.env.NODE_ENV === 'production') {
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    logger.error('CRITICAL SECURITY RISK: SSL certificate validation is disabled in production', {
      component: 'database-security',
      severity: 'critical',
      action_required: 'Enable SSL certificate validation immediately',
    });
  }
}

// Database configuration with environment-specific settings
const getDatabaseConfig = () => {
  const baseConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
  };

  // SECURITY FIX: Proper SSL configuration with certificate validation
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    // Production SSL configuration with proper certificate validation
    const sslConfig: any = {
      require: true,
      rejectUnauthorized: true, // SECURITY: Enable certificate validation
    };

    // Add CA certificate if provided
    if (process.env.DATABASE_CA_CERT) {
      sslConfig.ca = process.env.DATABASE_CA_CERT;
    }

    // Add client certificate if provided (for mutual TLS)
    if (process.env.DATABASE_CLIENT_CERT) {
      sslConfig.cert = process.env.DATABASE_CLIENT_CERT;
    }

    // Add client key if provided (for mutual TLS)
    if (process.env.DATABASE_CLIENT_KEY) {
      sslConfig.key = process.env.DATABASE_CLIENT_KEY;
    }

    // Allow override only for specific development/testing scenarios
    // This should NEVER be used in production
    if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
      logger.warn('SECURITY WARNING: SSL certificate validation disabled', {
        component: 'database-config',
        security_risk: 'high',
        environment: process.env.NODE_ENV,
      });
      sslConfig.rejectUnauthorized = false;
    }

    return {
      ...baseConfig,
      ssl: sslConfig,
    };
  } else if (process.env.NODE_ENV === 'development') {
    // Development: SSL can be disabled for local development
    return {
      ...baseConfig,
      ssl:
        process.env.DATABASE_SSL_ENABLED === 'true'
          ? {
              require: true,
              rejectUnauthorized: true,
            }
          : false,
    };
  } else {
    // Test environment: no SSL by default
    return {
      ...baseConfig,
      ssl: false,
    };
  }
};

// Create connection pool
const pool = new Pool(getDatabaseConfig());

// Connection health checking and retry logic
pool.on('connect', (_client: PoolClient) => {
  logger.database('New database connection established', {
    component: 'connection-pool',
    event: 'connect',
  });
});

pool.on('error', (err: Error) => {
  logger.error('Database connection error', {
    component: 'connection-pool',
    event: 'error',
    errorMessage: err.message,
    errorStack: err.stack,
  });
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.database('Closing database pool due to SIGINT', {
    component: 'connection-pool',
    event: 'shutdown',
    signal: 'SIGINT',
  });
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.database('Closing database pool due to SIGTERM', {
    component: 'connection-pool',
    event: 'shutdown',
    signal: 'SIGTERM',
  });
  await pool.end();
  process.exit(0);
});

/**
 * Test database connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.database('Database connection test successful', {
      component: 'connection-test',
      success: true,
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', {
      component: 'connection-test',
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Execute a transaction with automatic rollback on error
 */
export const executeTransaction = async (
  queries: Array<{ text: string; params?: unknown[] }>
): Promise<QueryResult<unknown>[]> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const results = [];
    for (const query of queries) {
      const result = await client.query(query.text, query.params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { pool };
