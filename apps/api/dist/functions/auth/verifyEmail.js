import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Joi from 'joi';
import { pool } from '../../config/database.js';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
validateEnvironment();
const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
const verifyEmailSchema = Joi.object({
    email: Joi.string().email().required(),
    confirmationCode: Joi.string().required(),
});
app.post('/auth/verify-email', validateBody(verifyEmailSchema), async (req, res, next) => {
    try {
        const { email, confirmationCode } = req.body;
        const result = await pool.query('UPDATE users SET is_email_verified = true, updated_at = NOW() WHERE email = $1 RETURNING id', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'Email successfully verified.',
        });
    }
    catch (error) {
        console.error('Email verification error:', error);
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=verifyEmail.js.map