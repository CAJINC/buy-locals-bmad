import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
validateEnvironment();
const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.get('/auth/google', async (req, res, next) => {
    try {
        res.status(501).json({
            error: 'Social login not yet implemented',
            message: 'Google OAuth integration will be available in a future release',
            plannedFeatures: [
                'Google OAuth 2.0 integration',
                'Automatic user creation from Google profile',
                'Profile picture import from Google',
                'Email verification skip for Google users'
            ]
        });
    }
    catch (error) {
        console.error('Google OAuth error:', error);
        next(error);
    }
});
app.get('/auth/google/callback', async (req, res, next) => {
    try {
        res.status(501).json({
            error: 'Social login callback not yet implemented',
            message: 'Google OAuth callback will be available in a future release'
        });
    }
    catch (error) {
        console.error('Google OAuth callback error:', error);
        next(error);
    }
});
app.get('/auth/facebook', async (req, res, next) => {
    try {
        res.status(501).json({
            error: 'Social login not yet implemented',
            message: 'Facebook OAuth integration will be available in a future release',
            plannedFeatures: [
                'Facebook OAuth 2.0 integration',
                'Automatic user creation from Facebook profile',
                'Profile picture import from Facebook',
                'Email verification skip for Facebook users'
            ]
        });
    }
    catch (error) {
        console.error('Facebook OAuth error:', error);
        next(error);
    }
});
app.get('/auth/facebook/callback', async (req, res, next) => {
    try {
        res.status(501).json({
            error: 'Social login callback not yet implemented',
            message: 'Facebook OAuth callback will be available in a future release'
        });
    }
    catch (error) {
        console.error('Facebook OAuth callback error:', error);
        next(error);
    }
});
app.post('/auth/link-social', async (req, res, next) => {
    try {
        res.status(501).json({
            error: 'Account linking not yet implemented',
            message: 'Social account linking will be available in a future release',
            plannedFeatures: [
                'Link Google account to existing user',
                'Link Facebook account to existing user',
                'Multiple social provider support per user',
                'Social account unlinking'
            ]
        });
    }
    catch (error) {
        console.error('Social link error:', error);
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=socialLogin.js.map