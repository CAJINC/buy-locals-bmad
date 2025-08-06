import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate correlation ID for request tracking
  req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);

  // Log request details
  const requestLog = {
    level: 'info',
    type: 'request',
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(requestLog));
  } else {
    console.log(`[${requestLog.timestamp}] ${requestLog.method} ${requestLog.url} - ${requestLog.correlationId}`);
  }

  // Log response when request finishes
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const responseLog = {
      level: 'info',
      type: 'response',
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(responseLog));
    } else {
      console.log(`[${responseLog.timestamp}] ${responseLog.method} ${responseLog.url} - ${responseLog.statusCode} (${responseLog.duration})`);
    }
  });

  next();
};