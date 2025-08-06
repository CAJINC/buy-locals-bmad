import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Joi from 'joi';
import { pool } from '../../config/database.js';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateQuery } from '../../middleware/validation.js';
validateEnvironment();
const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
const listBusinessSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    category: Joi.string().optional(),
    city: Joi.string().optional(),
    search: Joi.string().optional(),
});
app.get('/business', validateQuery(listBusinessSchema), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, category, city, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let query = `
      SELECT b.*, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM businesses b
      JOIN users u ON b.owner_id = u.id
      WHERE b.is_active = true
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (category) {
            query += ` AND b.category ILIKE $${paramIndex}`;
            queryParams.push(`%${category}%`);
            paramIndex++;
        }
        if (city) {
            query += ` AND b.city ILIKE $${paramIndex}`;
            queryParams.push(`%${city}%`);
            paramIndex++;
        }
        if (search) {
            query += ` AND (b.name ILIKE $${paramIndex} OR b.description ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(Number(limit), offset);
        const result = await pool.query(query, queryParams);
        let countQuery = `
      SELECT COUNT(*) as total
      FROM businesses b
      WHERE b.is_active = true
    `;
        const countParams = [];
        let countParamIndex = 1;
        if (category) {
            countQuery += ` AND b.category ILIKE $${countParamIndex}`;
            countParams.push(`%${category}%`);
            countParamIndex++;
        }
        if (city) {
            countQuery += ` AND b.city ILIKE $${countParamIndex}`;
            countParams.push(`%${city}%`);
            countParamIndex++;
        }
        if (search) {
            countQuery += ` AND (b.name ILIKE $${countParamIndex} OR b.description ILIKE $${countParamIndex})`;
            countParams.push(`%${search}%`);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        res.json({
            businesses: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=list.js.map