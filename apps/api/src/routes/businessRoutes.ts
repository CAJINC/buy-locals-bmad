import { Router } from 'express';
import { BusinessService } from '../services/businessService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { authMiddleware, requireBusinessOwner, requireRole } from '../middleware/auth.js';
import { performanceMonitoring } from '../middleware/performanceMonitoring.js';
import { locationSecurityMiddleware } from '../middleware/locationSecurity.js';
import {
  businessMediaUploadSchema,
  businessSearchSchema,
  categoryQuerySchema,
  createBusinessSchema,
  updateBusinessSchema
} from '../schemas/businessSchemas.js';
import { errorResponse, paginatedResponse, successResponse } from '../utils/responseUtils.js';
import { getCategoriesInLocation, getPopularAreas, handler as locationSearchHandler } from '../functions/business/locationSearch.js';
import { NextFunction, Request, Response } from 'express';

const router = Router();
const businessService = new BusinessService();

// Apply performance monitoring to all routes
router.use(performanceMonitoring);

/**
 * POST /api/businesses
 * Create a new business (business owners and admins only)
 */
router.post('/',
  authMiddleware,
  requireRole(['business_owner', 'admin']),
  validateBody(createBusinessSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user?.id;
      if (!ownerId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      const business = await businessService.createBusiness(ownerId, req.body);
      return successResponse(res, 201, business, 'Business created successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/location
 * Location-based business search with sub-1-second performance
 */
router.get('/search/location',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Convert Express request to Lambda-compatible event for handler
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${  Date.now()}` },
      } as any;

      const result = await locationSearchHandler(event, {} as any, {} as any);
      
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        res.set(result.headers || {});
        return res.status(200).json(body);
      } else {
        const errorBody = JSON.parse(result.body);
        return res.status(result.statusCode).json(errorBody);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/location/categories
 * Get categories available in a specific location
 */
router.get('/search/location/categories',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${  Date.now()}` },
      } as any;

      const result = await getCategoriesInLocation(event, {} as any, {} as any);
      
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        res.set(result.headers || {});
        return res.status(200).json(body);
      } else {
        const errorBody = JSON.parse(result.body);
        return res.status(result.statusCode).json(errorBody);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/location/popular-areas
 * Get popular business areas near a location
 */
router.get('/search/location/popular-areas',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${  Date.now()}` },
      } as any;

      const result = await getPopularAreas(event, {} as any, {} as any);
      
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        res.set(result.headers || {});
        return res.status(200).json(body);
      } else {
        const errorBody = JSON.parse(result.body);
        return res.status(result.statusCode).json(errorBody);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses
 * Search businesses with traditional filtering and pagination (fallback)
 */
router.get('/',
  validateQuery(businessSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = req.query as any;
      const { businesses, totalCount } = await businessService.searchBusinesses(searchQuery);
      
      return paginatedResponse(
        res,
        businesses,
        totalCount,
        parseInt(searchQuery.page) || 1,
        parseInt(searchQuery.limit) || 10
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/my
 * Get all businesses owned by the authenticated user
 */
router.get('/my',
  authMiddleware,
  requireBusinessOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user?.id;
      if (!ownerId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      const businesses = await businessService.getBusinessesByOwner(ownerId);
      return successResponse(res, 200, businesses, 'Businesses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/categories
 * Get all available business categories
 */
router.get('/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await businessService.getCategories();
      return successResponse(res, 200, categories, 'Categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/:businessId
 * Get business by ID
 */
router.get('/:businessId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.params;
      const business = await businessService.getBusinessById(businessId);
      return successResponse(res, 200, business, 'Business retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/businesses/:businessId
 * Update business (owner or admin only)
 */
router.put('/:businessId',
  authMiddleware,
  validateBody(updateBusinessSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      // Allow admin to update any business, others only their own
      let ownerId = userId;
      if (userRole !== 'admin') {
        // For non-admins, the service will verify ownership
        ownerId = userId;
      } else {
        // For admins, we need to get the actual owner ID
        const business = await businessService.getBusinessById(businessId);
        ownerId = business.owner_id;
      }

      const updatedBusiness = await businessService.updateBusiness(businessId, ownerId, req.body);
      return successResponse(res, 200, updatedBusiness, 'Business updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/businesses/:businessId
 * Delete business (deactivate - owner or admin only)
 */
router.delete('/:businessId',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      // Allow admin to delete any business, others only their own
      let ownerId = userId;
      if (userRole === 'admin') {
        // For admins, we need to get the actual owner ID
        const business = await businessService.getBusinessById(businessId);
        ownerId = business.owner_id;
      }

      await businessService.deleteBusiness(businessId, ownerId);
      return successResponse(res, 200, undefined, 'Business deleted successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/:businessId/stats
 * Get business statistics (owner or admin only)
 */
router.get('/:businessId/stats',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return errorResponse(res, 401, 'User not authenticated');
      }

      // Allow admin to view any business stats, others only their own
      let ownerId = userId;
      if (userRole === 'admin') {
        const business = await businessService.getBusinessById(businessId);
        ownerId = business.owner_id;
      }

      const stats = await businessService.getBusinessStats(businessId, ownerId);
      return successResponse(res, 200, stats, 'Business statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/businesses/:businessId/media
 * Update business media (owner or admin only)
 */
router.put('/:businessId/media',
  authMiddleware,
  validateBody(businessMediaUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error) {
      next(error);
    }
  }
);

export { router as businessRoutes };