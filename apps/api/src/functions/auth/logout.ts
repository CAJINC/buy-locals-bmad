import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { authenticateCognito, CognitoAuthenticatedRequest } from '../../middleware/cognitoAuth.js';

validateEnvironment();

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.post('/auth/logout', authenticateCognito, async (req: CognitoAuthenticatedRequest, res, next) => {
  try {
    // Note: AWS Cognito doesn't have a direct "logout" API call for access tokens
    // The tokens will naturally expire, but we can invalidate refresh tokens
    // In a production setup, you might want to maintain a token blacklist in Redis
    
    // For now, we'll just return success
    // The client should remove tokens from local storage
    
    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);