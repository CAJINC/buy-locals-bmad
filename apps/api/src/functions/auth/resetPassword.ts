import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { ResetPasswordRequest } from '@buy-locals/shared';
import { resetPasswordSchema } from '../../schemas/authSchemas.js';

validateEnvironment();

const app = express();
const cognitoService = new CognitoService();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.post('/auth/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, newPassword }: ResetPasswordRequest = req.body;
    
    // The token from Cognito forgot password flow contains both the username and confirmation code
    // For this implementation, we expect the client to pass email and code separately
    // In a production setup, you might encode this information in the token
    
    // For now, we need to extract email from the request or token
    // This is a simplified implementation - in production, you'd parse the reset token
    const { email, confirmationCode } = req.body; // Additional fields expected
    
    if (!email || !confirmationCode) {
      return res.status(400).json({ 
        error: 'Email and confirmation code are required' 
      });
    }

    // Confirm password reset with AWS Cognito
    await cognitoService.confirmForgotPassword(email, confirmationCode, newPassword);

    res.json({
      message: 'Password has been successfully reset. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    
    // Handle specific Cognito errors
    if (error instanceof Error) {
      if (error.message.includes('ExpiredCodeException')) {
        return res.status(400).json({ 
          error: 'Reset code has expired. Please request a new password reset.' 
        });
      }
      if (error.message.includes('InvalidParameterException')) {
        return res.status(400).json({ 
          error: 'Invalid reset code. Please check and try again.' 
        });
      }
      if (error.message.includes('CodeMismatchException')) {
        return res.status(400).json({ 
          error: 'Invalid reset code. Please check and try again.' 
        });
      }
      if (error.message.includes('UserNotFoundException')) {
        return res.status(404).json({ 
          error: 'User not found.' 
        });
      }
      if (error.message.includes('InvalidPasswordException')) {
        return res.status(400).json({ 
          error: 'Password does not meet requirements. Please choose a stronger password.' 
        });
      }
      if (error.message.includes('TooManyRequestsException')) {
        return res.status(429).json({ 
          error: 'Too many reset attempts. Please try again later.' 
        });
      }
    }
    
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);