import serverless from 'serverless-http';
import express from 'express';
import { validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { CognitoService } from '../../services/cognitoService.js';
import { refreshTokenSchema } from '../../schemas/authSchemas.js';
validateEnvironment();
const app = express();
const cognitoService = new CognitoService();
app.post('/auth/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const authResult = await cognitoService.refreshToken(refreshToken);
        res.json({
            token: authResult.accessToken,
            idToken: authResult.idToken,
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
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
export const handler = serverless(app);
//# sourceMappingURL=refresh.js.map