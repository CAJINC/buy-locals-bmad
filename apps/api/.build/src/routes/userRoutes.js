import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { updateUserProfileSchema, getUsersQuerySchema, updatePasswordSchema } from '../schemas/userSchemas.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responseUtils.js';
const router = Router();
const userService = new UserService();
router.get('/profile', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        const userProfile = await userService.getUserProfile(userId);
        return successResponse(res, 200, userProfile, 'User profile retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.put('/profile', authMiddleware, validateBody(updateUserProfileSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        const updatedProfile = await userService.updateUserProfile(userId, req.body);
        return successResponse(res, 200, updatedProfile, 'Profile updated successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/:userId', authMiddleware, requireRole(['admin']), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const userProfile = await userService.getUserProfile(userId);
        return successResponse(res, 200, userProfile, 'User retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/', authMiddleware, requireRole(['admin']), validateQuery(getUsersQuerySchema), async (req, res, next) => {
    try {
        const { page, limit, role } = req.query;
        const { users, totalCount } = await userService.getUsers(parseInt(page) || 1, parseInt(limit) || 10, role);
        return paginatedResponse(res, users, totalCount, parseInt(page) || 1, parseInt(limit) || 10);
    }
    catch (error) {
        next(error);
    }
});
router.put('/password', authMiddleware, validateBody(updatePasswordSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        if (!userId || !userEmail) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        const { currentPassword, newPassword } = req.body;
        const user = await userService.verifyUserPassword(userEmail, currentPassword);
        if (!user) {
            return errorResponse(res, 400, 'Current password is incorrect');
        }
        await userService.updatePassword(userId, newPassword);
        return successResponse(res, 200, undefined, 'Password updated successfully');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:userId', authMiddleware, requireRole(['admin']), async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (userId === req.user?.id) {
            return errorResponse(res, 400, 'Cannot delete your own account');
        }
        await userService.deleteUser(userId);
        return successResponse(res, 200, undefined, 'User deleted successfully');
    }
    catch (error) {
        next(error);
    }
});
export { router as userRoutes };
//# sourceMappingURL=userRoutes.js.map