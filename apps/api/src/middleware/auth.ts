import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { errorResponse } from '../utils/responseUtils.js';
import { UserService } from '../services/userService.js';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const userService = new UserService();

/**
 * Middleware to authenticate JWT tokens
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return errorResponse(res, 401, 'Access token required');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Validate that user still exists and is active
    const user = await userService.getUserProfile(decoded.id);
    if (!user) {
      return errorResponse(res, 401, 'User not found or inactive');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse(res, 403, 'Invalid or expired token');
    }
    next(error);
  }
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 403, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Middleware to require business owner role or admin
 */
export const requireBusinessOwner = (req: Request, res: Response, next: NextFunction) => {
  return requireRole(['business_owner', 'admin'])(req, res, next);
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  return requireRole(['admin'])(req, res, next);
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    {
      expiresIn: '24h',
      issuer: 'buy-locals-api',
    }
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    `${config.jwtSecret  }_refresh`,
    {
      expiresIn: '7d',
      issuer: 'buy-locals-api',
    }
  );
};

// Legacy export for backward compatibility
export const authenticateToken = authMiddleware;