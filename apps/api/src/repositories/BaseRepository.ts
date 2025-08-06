import { Pool, PoolClient } from 'pg';
import { pool } from '../config/database.js';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface WhereClause {
  [key: string]: any;
}

export abstract class BaseRepository<T> {
  protected pool: Pool;
  protected tableName: string;

  constructor(tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Execute a query with connection pooling and error handling
   */
  protected async query(text: string, params?: any[]): Promise<any> {
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      console.error(`Database query error in ${this.tableName}:`, {
        error: error instanceof Error ? error.message : String(error),
        query: text.substring(0, 200), // Log first 200 chars of query for debugging
        table: this.tableName,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  protected async transaction(queries: Array<{ text: string; params?: any[] }>): Promise<any[]> {
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      
      const results = [];
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error(`Transaction error in ${this.tableName}:`, error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all records with optional filtering and pagination
   */
  async findAll(options: QueryOptions = {}): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    if (options.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Count total records
   */
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const result = await this.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data as any);
    const values = Object.values(data as any);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data as any);
    const values = Object.values(data as any);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Find records by custom where clause
   */
  async findWhere(whereClause: WhereClause, options: QueryOptions = {}): Promise<T[]> {
    const whereKeys = Object.keys(whereClause);
    const whereValues = Object.values(whereClause);
    const whereConditions = whereKeys.map((key, index) => `${key} = $${index + 1}`);

    let query = `SELECT * FROM ${this.tableName} WHERE ${whereConditions.join(' AND ')}`;
    const params = whereValues;

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    if (options.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Check if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}