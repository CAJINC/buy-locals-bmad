import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from '../../config/database.js';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { LoginRequest } from '@buy-locals/shared';
import { loginSchema } from '../../schemas/authSchemas.js';
import { AccountLockout, authRateLimit } from '../../middleware/rateLimiting.js';
import { auditLogger, sanitizeInput, securityHeaders } from '../../middleware/security.js';

validateEnvironment();

const app = express();
const cognitoService = new CognitoService();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(auditLogger);

app.post('/auth/login', authRateLimit, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Check if account is locked due to failed attempts
    const lockoutStatus = await AccountLockout.isAccountLocked(email);
    if (lockoutStatus.isLocked) {
      return res.status(423).json({
        error: 'Account temporarily locked',
        message: 'Too many failed login attempts. Please try again later.',
        lockoutExpires: lockoutStatus.lockoutExpires,
      });
    }

    try {
      // Authenticate with AWS Cognito
      const authResult = await cognitoService.loginUser(email, password);
      
      // Clear failed attempts on successful login
      await AccountLockout.clearFailedAttempts(email);

      // Get user data from database
    const result = await pool.query(
      'SELECT id, email, role, profile, is_email_verified, created_at, updated_at, last_login_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found in database' });
    }

    const user = result.rows[0];

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE email = $1',
      [email]
    );

    // Return user data with Cognito tokens
    res.json({
      token: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isEmailVerified: user.is_email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: new Date(),
      },
    });
    } catch (authError) {
      // Record failed login attempt
      const lockoutResult = await AccountLockout.recordFailedAttempt(email);
      
      if (lockoutResult.isLocked) {
        return res.status(423).json({
          error: 'Account locked',
          message: 'Too many failed login attempts. Account has been temporarily locked.',
          lockoutExpires: lockoutResult.lockoutExpires,
        });
      }

      // Handle specific Cognito errors
      if (authError instanceof Error) {
        if (authError.message.includes('NotAuthorizedException') || 
            authError.message.includes('UserNotFoundException') ||
            authError.message.includes('Invalid credentials')) {
          return res.status(401).json({ 
            error: 'Invalid credentials',
            remainingAttempts: AccountLockout['MAX_ATTEMPTS'] - lockoutResult.attempts,
          });
        }
      }
      
      throw authError; // Re-throw for outer catch block
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific Cognito errors that weren't handled above
    if (error instanceof Error) {
      if (error.message.includes('UserNotConfirmedException')) {
        return res.status(401).json({ error: 'Email not verified. Please check your email.' });
      }
      if (error.message.includes('TooManyRequestsException')) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }
    }
    
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);