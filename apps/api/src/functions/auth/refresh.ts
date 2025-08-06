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
import { RefreshTokenRequest } from '@buy-locals/shared';
import { refreshTokenSchema } from '../../schemas/authSchemas.js';

validateEnvironment();

const app = express();
const cognitoService = new CognitoService();

app.post('/auth/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;

    // Refresh tokens with AWS Cognito
    const authResult = await cognitoService.refreshToken(refreshToken);

    // The new access token will contain updated user info
    // For now, we'll return the new tokens without additional user data
    // In a full implementation, we might decode the ID token to get user info
    
    res.json({
      token: authResult.accessToken,
      idToken: authResult.idToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Handle specific Cognito errors
    if (error instanceof Error) {
      if (error.message.includes('NotAuthorizedException') ||
          error.message.includes('Invalid refresh token')) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      if (error.message.includes('TokenExpiredException')) {
        return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
      }
    }
    
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);