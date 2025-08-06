import { pool } from '../config/database.js';
export class BaseRepository {
    constructor(tableName) {
        this.pool = pool;
        this.tableName = tableName;
    }
    async query(text, params) {
        let client;
        try {
            client = await this.pool.connect();
            const result = await client.query(text, params);
            return result;
        }
        catch (error) {
            console.error(`Database query error in ${this.tableName}:`, {
                error: error instanceof Error ? error.message : String(error),
                query: text.substring(0, 200),
                table: this.tableName,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async transaction(queries) {
        let client;
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
        }
        catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error(`Transaction error in ${this.tableName}:`, error);
            throw error;
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }
    async findAll(options = {}) {
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
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
    async count() {
        const query = `SELECT COUNT(*) FROM ${this.tableName}`;
        const result = await this.query(query);
        return parseInt(result.rows[0].count);
    }
    async create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
        const result = await this.query(query, values);
        return result.rows[0];
    }
    async update(id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
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
    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
        const result = await this.query(query, [id]);
        return result.rowCount > 0;
    }
    async findWhere(whereClause, options = {}) {
        const whereKeys = Object.keys(whereClause);
        const whereValues = Object.values(whereClause);
        const whereConditions = whereKeys.map((key, index) => `${key} = $${index + 1}`);
        let query = `SELECT * FROM ${this.tableName} WHERE ${whereConditions.join(' AND ')}`;
        let params = whereValues;
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
    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
//# sourceMappingURL=BaseRepository.js.map