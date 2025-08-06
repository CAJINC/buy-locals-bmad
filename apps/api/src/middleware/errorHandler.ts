import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: string[];
}

export const errorHandler = (err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  // Structured logging for better observability
  const errorLog = {
    level: 'error',
    message: err.message,
    statusCode: err.statusCode || 500,
    isOperational: err.isOperational || false,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    correlationId: req.get('X-Correlation-ID') || 'unknown',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Log using structured logger
  if (err.statusCode && err.statusCode >= 500) {
    logger.error('API Server Error', errorLog);
  } else {
    logger.warn('API Client Error', errorLog);
  }

  const statusCode = err.statusCode || 500;

  // Sanitize error messages - don't expose internal errors to client
  const message = err.statusCode && err.isOperational ? err.message : 'Internal server error';

  const errorResponse: {
    error: string;
    statusCode: number;
    timestamp: string;
    stack?: string;
    details?: string[];
  } = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

export const createError = (message: string, statusCode: number = 500): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
