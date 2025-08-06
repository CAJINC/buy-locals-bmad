import { Pool } from 'pg';
const getDatabaseConfig = () => {
    const baseConfig = {
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
    };
    if (process.env.NODE_ENV === 'production') {
        return {
            ...baseConfig,
            ssl: {
                rejectUnauthorized: false,
            },
        };
    }
    else {
        return {
            ...baseConfig,
            ssl: false,
        };
    }
};
const pool = new Pool(getDatabaseConfig());
pool.on('connect', (client) => {
    console.log('New database connection established');
});
pool.on('error', (err) => {
    console.error('Database connection error:', err);
});
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
export const testConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('Database connection test successful');
        return true;
    }
    catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
};
export const executeTransaction = async (queries) => {
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
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
};
export { pool };
//# sourceMappingURL=database.js.map