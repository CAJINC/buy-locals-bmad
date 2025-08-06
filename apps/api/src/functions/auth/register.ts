import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database.js';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { CreateUserRequest } from '@buy-locals/shared';
import { registerSchema } from '../../schemas/authSchemas.js';
import { registrationRateLimit } from '../../middleware/rateLimiting.js';
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

app.post('/auth/register', registrationRateLimit, validateBody(registerSchema), async (req, res, next) => {
  try {
    const userData: CreateUserRequest = req.body;

    // Check if user already exists in database
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Register user in AWS Cognito
    const { userId } = await cognitoService.registerUser(userData);

    // Create user record in database with JSONB profile
    const dbUserId = uuidv4();
    const profile = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone || undefined,
    };

    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, role, profile, is_email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, email, role, profile, is_email_verified, created_at, updated_at`,
      [dbUserId, userData.email, '', userData.role || 'consumer', JSON.stringify(profile), false]
    );

    const user = result.rows[0];

    // Authenticate the newly created user to get tokens
    const authResult = await cognitoService.loginUser(userData.email, userData.password);

    // Return success response with tokens
    res.status(201).json({
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
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific Cognito errors
    if (error instanceof Error) {
      if (error.message.includes('UsernameExistsException')) {
        return res.status(409).json({ error: 'User already exists' });
      }
      if (error.message.includes('InvalidPasswordException')) {
        return res.status(400).json({ error: 'Password does not meet requirements' });
      }
    }
    
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);