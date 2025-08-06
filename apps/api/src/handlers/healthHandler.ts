import { NextFunction, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { errorResponse, successResponse } from '../utils/responseUtils.js';

export const healthHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check database connection
    const dbCheck = await pool.query('SELECT 1');
    const isDbHealthy = dbCheck.rows.length > 0;

    // Check Redis connection if configured
    let isRedisHealthy = true;
    try {
      const redis = await import('../config/redis.js');
      if (redis.redisClient) {
        await redis.redisClient.ping();
      }
    } catch (redisError) {
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

    // Return 503 if critical services are down
    if (!isDbHealthy) {
      return errorResponse(res, 503, 'Service unavailable - database connection failed');
    }

    return successResponse(res, 200, healthData, 'Buy Locals API is healthy');
  } catch (error) {
    console.error('Health check failed:', error);
    return errorResponse(res, 503, 'Service unavailable');
  }
};