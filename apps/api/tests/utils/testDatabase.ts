import { Pool, PoolClient } from 'pg';
import Redis from 'redis';
import { jest } from '@jest/globals';

/**
 * Test Database Utilities
 * Handles test database setup, teardown, and data management
 */

export class TestDatabase {
  private static pool: Pool | null = null;
  private static redisClient: any | null = null;
  private static isInitialized = false;

  /**
   * Initialize test database connections
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize PostgreSQL connection
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/buy_locals_test',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test PostgreSQL connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Initialize Redis connection (mocked for tests)
      this.redisClient = {
        isOpen: true,
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        ttl: jest.fn().mockResolvedValue(-1),
        incr: jest.fn().mockResolvedValue(1),
        zAdd: jest.fn().mockResolvedValue(1),
        zCard: jest.fn().mockResolvedValue(0),
        zRemRangeByScore: jest.fn().mockResolvedValue(0),
        zRemRangeByRank: jest.fn().mockResolvedValue(0),
        expire: jest.fn().mockResolvedValue(1),
      };

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL pool
   */
  static getPool(): Pool {
    if (!this.pool) {
      throw new Error('Test database not initialized. Call TestDatabase.initialize() first.');
    }
    return this.pool;
  }

  /**
   * Get Redis client (mocked)
   */
  static getRedisClient(): any {
    if (!this.redisClient) {
      throw new Error('Test database not initialized. Call TestDatabase.initialize() first.');
    }
    return this.redisClient;
  }

  /**
   * Execute a database query
   */
  static async query(text: string, params?: any[]): Promise<any> {
    const pool = this.getPool();
    return await pool.query(text, params);
  }

  /**
   * Begin a transaction
   */
  static async beginTransaction(): Promise<PoolClient> {
    const pool = this.getPool();
    const client = await pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit a transaction
   */
  static async commitTransaction(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rollback a transaction
   */
  static async rollbackTransaction(client: PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(): Promise<void> {
    if (!this.pool) {
      return;
    }

    const tablesToClean = [
      'payment_audit_logs',
      'escrow_transactions',
      'payment_methods',
      'tax_exemptions',
      'payouts',
      'receipts',
      'payment_intents',
      'stripe_customers',
      'reservations',
      'businesses',
      'users',
    ];

    try {
      // Use transaction to ensure all tables are cleaned or none are
      const client = await this.beginTransaction();
      
      try {
        // Disable foreign key checks temporarily
        await client.query('SET session_replication_role = replica;');
        
        // Clean tables in reverse dependency order
        for (const table of tablesToClean) {
          await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        }
        
        // Re-enable foreign key checks
        await client.query('SET session_replication_role = DEFAULT;');
        
        await this.commitTransaction(client);
      } catch (error) {
        await this.rollbackTransaction(client);
        throw error;
      }
    } catch (error) {
      console.warn(`Warning: Could not clean test data from some tables: ${error}`);
      // Continue with tests even if cleanup fails
    }
  }

  /**
   * Seed test data
   */
  static async seedTestData(): Promise<void> {
    const client = await this.beginTransaction();

    try {
      // Insert test users
      await client.query(`
        INSERT INTO users (id, email, role, profile, status, created_at, updated_at)
        VALUES 
          ('test-user-1', 'test1@example.com', 'consumer', '{"firstName": "John", "lastName": "Doe", "phone": "+1234567890"}', 'active', NOW(), NOW()),
          ('test-user-2', 'test2@example.com', 'business_owner', '{"firstName": "Jane", "lastName": "Smith", "phone": "+1234567891"}', 'active', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert test businesses
      await client.query(`
        INSERT INTO businesses (id, name, description, category, owner_id, location, contact, status, created_at, updated_at)
        VALUES 
          ('test-business-1', 'Test Restaurant', 'A test restaurant for payment testing', 'restaurant', 'test-user-2', 
           '{"address": "123 Main St", "city": "San Francisco", "state": "CA", "postalCode": "94105", "country": "US", "coordinates": {"lat": 37.7749, "lng": -122.4194}}',
           '{"phone": "+1234567890", "email": "restaurant@example.com"}', 'active', NOW(), NOW()),
          ('test-business-2', 'Test Retail Store', 'A test retail store for payment testing', 'retail', 'test-user-2',
           '{"address": "456 Business Ave", "city": "Los Angeles", "state": "CA", "postalCode": "90210", "country": "US", "coordinates": {"lat": 34.0522, "lng": -118.2437}}',
           '{"phone": "+1234567891", "email": "retail@example.com"}', 'active', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert test Stripe customers
      await client.query(`
        INSERT INTO stripe_customers (id, user_id, stripe_customer_id, email, name, created_at, updated_at)
        VALUES 
          ('stripe-customer-1', 'test-user-1', 'cus_test_customer_1', 'test1@example.com', 'John Doe', NOW(), NOW()),
          ('stripe-customer-2', 'test-user-2', 'cus_test_customer_2', 'test2@example.com', 'Jane Smith', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert test tax exemptions
      await client.query(`
        INSERT INTO tax_exemptions (id, business_id, exemption_type, certificate_number, jurisdiction, status, expires_at, created_at)
        VALUES 
          ('exemption-1', 'test-business-1', 'nonprofit', 'EX123456', 'CA', 'active', '2025-12-31', NOW()),
          ('exemption-2', 'test-business-2', 'resale', 'RS789012', 'CA', 'active', '2025-12-31', NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      await this.commitTransaction(client);
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    }
  }

  /**
   * Create test payment intent record
   */
  static async createTestPaymentIntent(data: {
    id: string;
    stripePaymentIntentId: string;
    businessId: string;
    customerId: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: any;
  }): Promise<void> {
    await this.query(`
      INSERT INTO payment_intents (
        id, stripe_payment_intent_id, business_id, customer_id, amount, currency, status, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `, [
      data.id,
      data.stripePaymentIntentId,
      data.businessId,
      data.customerId,
      data.amount,
      data.currency,
      data.status,
      JSON.stringify(data.metadata || {}),
    ]);
  }

  /**
   * Create test escrow transaction
   */
  static async createTestEscrowTransaction(data: {
    id: string;
    paymentIntentId: string;
    businessId: string;
    customerId: string;
    amount: number;
    platformFee: number;
    businessPayout: number;
    status: string;
    scheduledReleaseAt?: Date;
    metadata?: any;
  }): Promise<void> {
    await this.query(`
      INSERT INTO escrow_transactions (
        id, payment_intent_id, business_id, customer_id, amount, platform_fee, business_payout, 
        status, scheduled_release_at, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `, [
      data.id,
      data.paymentIntentId,
      data.businessId,
      data.customerId,
      data.amount,
      data.platformFee,
      data.businessPayout,
      data.status,
      data.scheduledReleaseAt || null,
      JSON.stringify(data.metadata || {}),
    ]);
  }

  /**
   * Create test payout record
   */
  static async createTestPayout(data: {
    id: string;
    businessId: string;
    stripePayoutId: string;
    amount: number;
    currency: string;
    status: string;
    arrivalDate?: Date;
    metadata?: any;
  }): Promise<void> {
    await this.query(`
      INSERT INTO payouts (
        id, business_id, stripe_payout_id, amount, currency, status, arrival_date, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `, [
      data.id,
      data.businessId,
      data.stripePayoutId,
      data.amount,
      data.currency,
      data.status,
      data.arrivalDate || null,
      JSON.stringify(data.metadata || {}),
    ]);
  }

  /**
   * Create test audit log
   */
  static async createTestAuditLog(data: {
    id: string;
    operationType: string;
    entityType: string;
    entityId: string;
    businessId?: string;
    correlationId: string;
    success: boolean;
    ipAddress: string;
    userAgent: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.query(`
      INSERT INTO payment_audit_logs (
        id, operation_type, entity_type, entity_id, business_id, correlation_id,
        success, ip_address, user_agent, error_code, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET timestamp = NOW()
    `, [
      data.id,
      data.operationType,
      data.entityType,
      data.entityId,
      data.businessId || null,
      data.correlationId,
      data.success,
      data.ipAddress,
      data.userAgent,
      data.errorCode || null,
      data.errorMessage || null,
    ]);
  }

  /**
   * Get test payment intent
   */
  static async getTestPaymentIntent(id: string): Promise<any> {
    const result = await this.query(
      'SELECT * FROM payment_intents WHERE id = $1 OR stripe_payment_intent_id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get test escrow transaction
   */
  static async getTestEscrowTransaction(paymentIntentId: string): Promise<any> {
    const result = await this.query(
      'SELECT * FROM escrow_transactions WHERE payment_intent_id = $1',
      [paymentIntentId]
    );
    return result.rows[0];
  }

  /**
   * Reset Redis mocks
   */
  static resetRedisMocks(): void {
    if (this.redisClient) {
      Object.values(this.redisClient).forEach((method: any) => {
        if (jest.isMockFunction(method)) {
          method.mockReset();
          
          // Reset default behaviors
          if (method === this.redisClient.get) {
            method.mockResolvedValue(null);
          } else if (method === this.redisClient.set || method === this.redisClient.setEx) {
            method.mockResolvedValue('OK');
          } else if (method === this.redisClient.del) {
            method.mockResolvedValue(1);
          } else if (method === this.redisClient.exists) {
            method.mockResolvedValue(0);
          } else if (method === this.redisClient.ttl) {
            method.mockResolvedValue(-1);
          } else if (method === this.redisClient.incr) {
            method.mockResolvedValue(1);
          }
        }
      });
    }
  }

  /**
   * Setup test database schema (run this before tests if needed)
   */
  static async setupSchema(): Promise<void> {
    const createTablesSQL = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        profile JSONB,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Businesses table  
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        owner_id VARCHAR(255) REFERENCES users(id),
        location JSONB,
        contact JSONB,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Stripe customers
      CREATE TABLE IF NOT EXISTS stripe_customers (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Payment intents
      CREATE TABLE IF NOT EXISTS payment_intents (
        id VARCHAR(255) PRIMARY KEY,
        stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
        business_id VARCHAR(255) REFERENCES businesses(id),
        customer_id VARCHAR(255),
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Escrow transactions
      CREATE TABLE IF NOT EXISTS escrow_transactions (
        id VARCHAR(255) PRIMARY KEY,
        payment_intent_id VARCHAR(255) REFERENCES payment_intents(stripe_payment_intent_id),
        business_id VARCHAR(255) REFERENCES businesses(id),
        customer_id VARCHAR(255),
        amount INTEGER NOT NULL,
        platform_fee INTEGER NOT NULL,
        business_payout INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        scheduled_release_at TIMESTAMP WITH TIME ZONE,
        released_at TIMESTAMP WITH TIME ZONE,
        disputed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Tax exemptions
      CREATE TABLE IF NOT EXISTS tax_exemptions (
        id VARCHAR(255) PRIMARY KEY,
        business_id VARCHAR(255) REFERENCES businesses(id),
        exemption_type VARCHAR(100) NOT NULL,
        certificate_number VARCHAR(255),
        jurisdiction VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        expires_at DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Payouts
      CREATE TABLE IF NOT EXISTS payouts (
        id VARCHAR(255) PRIMARY KEY,
        business_id VARCHAR(255) REFERENCES businesses(id),
        stripe_payout_id VARCHAR(255) UNIQUE NOT NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        arrival_date TIMESTAMP WITH TIME ZONE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Audit logs
      CREATE TABLE IF NOT EXISTS payment_audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        operation_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        business_id VARCHAR(255),
        correlation_id VARCHAR(255) NOT NULL,
        success BOOLEAN NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        error_code VARCHAR(100),
        error_message TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Receipts
      CREATE TABLE IF NOT EXISTS receipts (
        id VARCHAR(255) PRIMARY KEY,
        receipt_number VARCHAR(100) UNIQUE NOT NULL,
        transaction_id VARCHAR(255),
        payment_intent_id VARCHAR(255),
        business_id VARCHAR(255) REFERENCES businesses(id),
        customer_id VARCHAR(255),
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        receipt_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await this.query(createTablesSQL);
  }

  /**
   * Close all database connections
   */
  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    
    if (this.redisClient && typeof this.redisClient.disconnect === 'function') {
      await this.redisClient.disconnect();
    }
    this.redisClient = null;
    this.isInitialized = false;
  }
}

export default TestDatabase;