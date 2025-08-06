import { Pool, PoolClient } from 'pg';

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

  // SSL configuration based on environment
  if (process.env.NODE_ENV === 'production') {
    return {
      ...baseConfig,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  } else {
    return {
      ...baseConfig,
      ssl: false,
    };
  }
};

// Create connection pool
const pool = new Pool(getDatabaseConfig());

// Connection health checking and retry logic
pool.on('connect', (client: PoolClient) => {
  console.log('New database connection established');
});

pool.on('error', (err: Error) => {
  console.error('Database connection error:', err);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
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
    console.log('Database connection test successful');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

/**
 * Execute a transaction with automatic rollback on error
 */
export const executeTransaction = async (
  queries: Array<{ text: string; params?: any[] }>
): Promise<any[]> => {
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