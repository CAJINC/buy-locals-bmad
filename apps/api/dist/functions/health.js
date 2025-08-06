import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { config, validateEnvironment } from '../config/environment.js';
import { errorHandler } from '../middleware/errorHandler.js';
validateEnvironment();
const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.get('/health', async (req, res, next) => {
    try {
        const healthCheck = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.stage,
            services: {
                database: 'unknown',
                redis: 'unknown',
            },
        };
        try {
            await pool.query('SELECT 1');
            healthCheck.services.database = 'healthy';
        }
        catch (error) {
            healthCheck.services.database = 'unhealthy';
            healthCheck.status = 'degraded';
        }
        try {
            if (!redisClient.isOpen) {
                await redisClient.connect();
            }
            await redisClient.ping();
            healthCheck.services.redis = 'healthy';
        }
        catch (error) {
            healthCheck.services.redis = 'unhealthy';
            healthCheck.status = 'degraded';
        }
        res.json(healthCheck);
    }
    catch (error) {
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=health.js.map