import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  createUserSchema, 
  getUsersQuerySchema, 
  updatePasswordSchema, 
  updateUserProfileSchema 
} from '../schemas/userSchemas.js';
import { errorResponse, paginatedResponse, successResponse } from '../utils/responseUtils.js';
import { NextFunction, Request, Response } from 'express';

const router = Router();
const userService = new UserService();

/**
 * GET /api/users/profile
 * Get authenticated user's profile
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'User not authenticated');
    }

    const userProfile = await userService.getUserProfile(userId);
    return successResponse(res, 200, userProfile, 'User profile retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/profile
 * Update authenticated user's profile
 */
router.put('/profile', 
  authMiddleware, 
  validateBody(updateUserProfileSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      const updatedProfile = await userService.updateUserProfile(userId, req.body);
      return successResponse(res, 200, updatedProfile, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:userId
 * Get user by ID (admin only)
 */
router.get('/:userId', 
  authMiddleware, 
  requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const userProfile = await userService.getUserProfile(userId);
      return successResponse(res, 200, userProfile, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users
 * Get all users with pagination (admin only)
 */
router.get('/', 
  authMiddleware, 
  requireRole(['admin']), 
  validateQuery(getUsersQuerySchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, role } = req.query as any;
      const { users, totalCount } = await userService.getUsers(
        parseInt(page) || 1,
        parseInt(limit) || 10,
        role
      );
      
      return paginatedResponse(res, users, totalCount, parseInt(page) || 1, parseInt(limit) || 10);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/users/password
 * Update authenticated user's password
 */
router.put('/password', 
  authMiddleware, 
  validateBody(updatePasswordSchema), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId || !userEmail) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await userService.verifyUserPassword(userEmail, currentPassword);
      if (!user) {
        return errorResponse(res, 400, 'Current password is incorrect');
      }

      await userService.updatePassword(userId, newPassword);
      return successResponse(res, 200, undefined, 'Password updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/:userId
 * Delete user (admin only)
 */
router.delete('/:userId', 
  authMiddleware, 
  requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      // Prevent admin from deleting themselves
      if (userId === req.user?.id) {
        return errorResponse(res, 400, 'Cannot delete your own account');
      }

      await userService.deleteUser(userId);
      return successResponse(res, 200, undefined, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRoutes };