import { pool } from '../config/database.js';
import { successResponse, errorResponse } from '../utils/responseUtils.js';
export const healthHandler = async (req, res, next) => {
    try {
        const dbCheck = await pool.query('SELECT 1');
        const isDbHealthy = dbCheck.rows.length > 0;
        let isRedisHealthy = true;
        try {
            const redis = await import('../config/redis.js');
            if (redis.redisClient) {
                await redis.redisClient.ping();
            }
        }
        catch (redisError) {
            isRedisHealthy = false;
        }
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            stage: process.env.STAGE || 'dev',
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            services: {
                database: isDbHealthy ? 'healthy' : 'unhealthy',
                redis: isRedisHealthy ? 'healthy' : 'unhealthy',
            },
        };
        if (!isDbHealthy) {
            return errorResponse(res, 503, 'Service unavailable - database connection failed');
        }
        return successResponse(res, 200, healthData, 'Buy Locals API is healthy');
    }
    catch (error) {
        console.error('Health check failed:', error);
        return errorResponse(res, 503, 'Service unavailable');
    }
};
//# sourceMappingURL=healthHandler.js.map