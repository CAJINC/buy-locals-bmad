import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Extend Express Request interface to include correlationId
declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
    startTime: number;
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate correlation ID for request tracking
  req.correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);

  // Request logging handled by logger.request below

  logger.request(req.method, req.url, {
    correlationId: req.correlationId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Log response when request finishes
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    logger.response(req.method, req.url, res.statusCode, duration, {
      correlationId: req.correlationId,
    });
  });

  next();
};
