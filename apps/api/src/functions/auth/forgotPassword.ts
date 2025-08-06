import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { ForgotPasswordRequest } from '@buy-locals/shared';
import { forgotPasswordSchema } from '../../schemas/authSchemas.js';

validateEnvironment();

const app = express();
const cognitoService = new CognitoService();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.post('/auth/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    // Initiate password reset with AWS Cognito
    await cognitoService.forgotPassword(email);

    // Always return success to prevent email enumeration attacks
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Handle specific Cognito errors but don't expose them to prevent enumeration
    if (error instanceof Error) {
      if (error.message.includes('UserNotFoundException')) {
        // Still return success to prevent email enumeration
        return res.json({
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      }
      if (error.message.includes('TooManyRequestsException')) {
        return res.status(429).json({ 
          error: 'Too many password reset requests. Please try again later.' 
        });
      }
      if (error.message.includes('LimitExceededException')) {
        return res.status(429).json({ 
          error: 'Password reset limit exceeded. Please try again later.' 
        });
      }
    }
    
    // For any other error, return generic success message
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);