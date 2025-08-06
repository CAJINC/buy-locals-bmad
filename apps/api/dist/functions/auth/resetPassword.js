import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { resetPasswordSchema } from '../../schemas/authSchemas.js';
validateEnvironment();
const app = express();
const cognitoService = new CognitoService();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.post('/auth/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const { email, confirmationCode } = req.body;
        if (!email || !confirmationCode) {
            return res.status(400).json({
                error: 'Email and confirmation code are required'
            });
        }
        await cognitoService.confirmForgotPassword(email, confirmationCode, newPassword);
        res.json({
            message: 'Password has been successfully reset. You can now log in with your new password.',
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
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
export const handler = serverless(app);
//# sourceMappingURL=resetPassword.js.map