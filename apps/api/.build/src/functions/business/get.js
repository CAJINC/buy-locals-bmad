import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateParams } from '../../middleware/validation.js';
import { BusinessService } from '../../services/businessService.js';
import { businessIdParamSchema } from '../../schemas/businessSchemas.js';
validateEnvironment();
const app = express();
const businessService = new BusinessService();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.get('/businesses/:businessId', validateParams(businessIdParamSchema), async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const business = await businessService.getBusinessById(businessId);
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
//# sourceMappingURL=get.js.map