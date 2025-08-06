import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { securityHeaders, sanitizeInput } from './middleware/security.js';
import { validationErrorHandler } from './middleware/validation.js';
import { healthHandler } from './handlers/healthHandler.js';
import { userRoutes } from './routes/userRoutes.js';
import { businessRoutes } from './routes/businessRoutes.js';
const app = express();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(securityHeaders);
app.use(sanitizeInput);
app.get('/health', healthHandler);
app.use('/api/users', userRoutes);
app.use('/api/businesses', businessRoutes);
app.use('*', (req, res) => {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
});
app.use(validationErrorHandler);
app.use(errorHandler);
export { app };
//# sourceMappingURL=app.js.map