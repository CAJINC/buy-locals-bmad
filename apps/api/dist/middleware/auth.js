import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { errorResponse } from '../utils/responseUtils.js';
import { UserService } from '../services/userService.js';
const userService = new UserService();
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return errorResponse(res, 401, 'Access token required');
        }
        const decoded = jwt.verify(token, config.jwtSecret);
        const user = await userService.getUserProfile(decoded.id);
        if (!user) {
            return errorResponse(res, 401, 'User not found or inactive');
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return errorResponse(res, 403, 'Invalid or expired token');
        }
        next(error);
    }
};
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 401, 'Authentication required');
        }
        if (!allowedRoles.includes(req.user.role)) {
            return errorResponse(res, 403, 'Insufficient permissions');
        }
        next();
    };
};
export const requireBusinessOwner = (req, res, next) => {
    return requireRole(['business_owner', 'admin'])(req, res, next);
};
export const requireAdmin = (req, res, next) => {
    return requireRole(['admin'])(req, res, next);
};
export const generateToken = (user) => {
    return jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
    }, config.jwtSecret, {
        expiresIn: '24h',
        issuer: 'buy-locals-api',
    });
};
export const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, config.jwtSecret + '_refresh', {
        expiresIn: '7d',
        issuer: 'buy-locals-api',
    });
};
export const authenticateToken = authMiddleware;
//# sourceMappingURL=auth.js.map