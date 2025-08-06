import { Router } from 'express';
import { BusinessService } from '../services/businessService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { authMiddleware, requireRole, requireBusinessOwner } from '../middleware/auth.js';
import { createBusinessSchema, updateBusinessSchema, businessSearchSchema, businessMediaUploadSchema } from '../schemas/businessSchemas.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responseUtils.js';
const router = Router();
const businessService = new BusinessService();
router.post('/', authMiddleware, requireRole(['business_owner', 'admin']), validateBody(createBusinessSchema), async (req, res, next) => {
    try {
        const ownerId = req.user?.id;
        if (!ownerId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        const business = await businessService.createBusiness(ownerId, req.body);
        return successResponse(res, 201, business, 'Business created successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/', validateQuery(businessSearchSchema), async (req, res, next) => {
    try {
        const searchQuery = req.query;
        const { businesses, totalCount } = await businessService.searchBusinesses(searchQuery);
        return paginatedResponse(res, businesses, totalCount, parseInt(searchQuery.page) || 1, parseInt(searchQuery.limit) || 10);
    }
    catch (error) {
        next(error);
    }
});
router.get('/my', authMiddleware, requireBusinessOwner, async (req, res, next) => {
    try {
        const ownerId = req.user?.id;
        if (!ownerId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        const businesses = await businessService.getBusinessesByOwner(ownerId);
        return successResponse(res, 200, businesses, 'Businesses retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/categories', async (req, res, next) => {
    try {
        const categories = await businessService.getCategories();
        return successResponse(res, 200, categories, 'Categories retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const business = await businessService.getBusinessById(businessId);
        return successResponse(res, 200, business, 'Business retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.put('/:businessId', authMiddleware, validateBody(updateBusinessSchema), async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        let ownerId = userId;
        if (userRole !== 'admin') {
            ownerId = userId;
        }
        else {
            const business = await businessService.getBusinessById(businessId);
            ownerId = business.owner_id;
        }
        const updatedBusiness = await businessService.updateBusiness(businessId, ownerId, req.body);
        return successResponse(res, 200, updatedBusiness, 'Business updated successfully');
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:businessId', authMiddleware, async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        let ownerId = userId;
        if (userRole === 'admin') {
            const business = await businessService.getBusinessById(businessId);
            ownerId = business.owner_id;
        }
        await businessService.deleteBusiness(businessId, ownerId);
        return successResponse(res, 200, undefined, 'Business deleted successfully');
    }
    catch (error) {
        next(error);
    }
});
router.get('/:businessId/stats', authMiddleware, async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        let ownerId = userId;
        if (userRole === 'admin') {
            const business = await businessService.getBusinessById(businessId);
            ownerId = business.owner_id;
        }
        const stats = await businessService.getBusinessStats(businessId, ownerId);
        return successResponse(res, 200, stats, 'Business statistics retrieved successfully');
    }
    catch (error) {
        next(error);
    }
});
router.put('/:businessId/media', authMiddleware, validateBody(businessMediaUploadSchema), async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const { media } = req.body;
        if (!userId) {
            return errorResponse(res, 401, 'User not authenticated');
        }
        let ownerId = userId;
        if (userRole === 'admin') {
            const business = await businessService.getBusinessById(businessId);
            ownerId = business.owner_id;
        }
        const updatedBusiness = await businessService.updateBusiness(businessId, ownerId, { media });
        return successResponse(res, 200, updatedBusiness, 'Business media updated successfully');
    }
    catch (error) {
        next(error);
    }
});
export { router as businessRoutes };
//# sourceMappingURL=businessRoutes.js.map