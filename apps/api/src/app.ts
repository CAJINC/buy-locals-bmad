import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApiError, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { sanitizeInput, securityHeaders } from './middleware/security.js';
import { validationErrorHandler } from './middleware/validation.js';

// Import route handlers
import { healthHandler } from './handlers/healthHandler.js';
import { userRoutes } from './routes/userRoutes.js';
import { businessRoutes } from './routes/businessRoutes.js';

const app = express();

// Security and CORS middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:19006',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  })
);

// Request parsing and logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(securityHeaders);
app.use(sanitizeInput);

// Health check endpoint
app.get('/health', healthHandler);

// API routes
app.use('/api/users', userRoutes);
app.use('/api/businesses', businessRoutes);

// 404 handler
app.use('*', (req, _res) => {
  const error: ApiError = new Error(`Route ${req.originalUrl} not found`) as ApiError;
  error.statusCode = 404;
  error.isOperational = true;
  throw error;
});

// Global error handlers
app.use(validationErrorHandler);
app.use(errorHandler);

export { app };
// Test comment for ESLint validation
