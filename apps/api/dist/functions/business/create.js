import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import { BusinessService } from '../../services/businessService.js';
import { createBusinessSchema } from '../../schemas/businessSchemas.js';
validateEnvironment();
const app = express();
const businessService = new BusinessService();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.post('/businesses', authenticateToken, validateBody(createBusinessSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const businessData = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const business = await businessService.createBusiness(userId, businessData);
        res.status(201).json({
            success: true,
            business,
        });
    }
    catch (error) {
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=create.js.map