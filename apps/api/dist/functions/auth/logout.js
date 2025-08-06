import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { authenticateCognito } from '../../middleware/cognitoAuth.js';
validateEnvironment();
const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.post('/auth/logout', authenticateCognito, async (req, res, next) => {
    try {
        res.json({
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=logout.js.map