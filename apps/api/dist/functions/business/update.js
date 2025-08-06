import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import { BusinessService } from '../../services/businessService.js';
import { updateBusinessSchema, businessIdParamSchema } from '../../schemas/businessSchemas.js';
validateEnvironment();
const app = express();
const businessService = new BusinessService();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.put('/businesses/:businessId', authenticateToken, validateParams(businessIdParamSchema), validateBody(updateBusinessSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { businessId } = req.params;
        const updates = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const business = await businessService.updateBusiness(businessId, userId, updates);
        res.json({
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
//# sourceMappingURL=update.js.map