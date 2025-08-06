import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: string[];
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

  // Log to structured logger in production, console in dev
  if (process.env.NODE_ENV === 'production') {
    // In production, you'd use a proper logger like Winston/Pino
    console.log(JSON.stringify(errorLog));
  } else {
    console.error('API Error:', errorLog);
  }

  const statusCode = err.statusCode || 500;
  
  // Sanitize error messages - don't expose internal errors to client
  const message = err.statusCode && err.isOperational 
    ? err.message 
    : 'Internal server error';

  const errorResponse: any = {
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