import { Router } from 'express';
import { BusinessService } from '../services/businessService.js';
import { businessHoursService } from '../services/businessHoursService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { authMiddleware, requireBusinessOwner, requireRole } from '../middleware/auth.js';
import { performanceMonitoring } from '../middleware/performanceMonitoring.js';
import { locationSecurityMiddleware } from '../middleware/locationSecurity.js';
import {
  LocationSearchError,
  LocationSearchErrorType,
  advancedFilterSchema,
  advancedLocationSearchSchema,
  businessDensitySchema,
  businessMediaUploadSchema,
  businessSearchSchema,
  cacheInvalidationSchema,
  categoryAnalyticsSchema,
  categoryInteractionSchema,
  categoryQuerySchema,
  createBusinessSchema,
  filterPresetSchema,
  performanceThresholds,
  trendingCategoriesSchema,
  updateBusinessSchema,
} from '../schemas/businessSchemas.js';
import Joi from 'joi';
import { errorResponse, paginatedResponse, successResponse } from '../utils/responseUtils.js';
import {
  getCategoriesInLocation,
  getPopularAreas,
  handler as locationSearchHandler,
} from '../functions/business/locationSearch.js';
import { locationSearchService } from '../services/locationSearchService.js';
import { categoryService } from '../services/categoryService.js';
import { filterStateService } from '../services/filterStateService.js';
import { 
  BUSINESS_CATEGORY_OPTIONS, 
  getCategoryMetadata 
} from '../constants/businessCategories.js';
import { NextFunction, Request, Response } from 'express';

const router = Router();
const businessService = new BusinessService();

// Business Hours Schema Validation
const businessHoursUpdateSchema = Joi.object({
  timezone: Joi.string().optional(),
  hours: Joi.object().pattern(
    Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    Joi.object({
      open: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      close: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      closed: Joi.boolean().optional(),
    }).or('open', 'closed').and('open', 'close')
  ).optional(),
  specialHours: Joi.array().items(Joi.object({
    date: Joi.string().isoDate().required(),
    openTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    closeTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    isClosed: Joi.boolean().required(),
    reason: Joi.string().max(255).required(),
    note: Joi.string().max(500).optional(),
  })).optional(),
  temporaryClosures: Joi.array().items(Joi.object({
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().required(),
    reason: Joi.string().max(255).required(),
    note: Joi.string().max(500).optional(),
  })).optional(),
});

const businessStatusQuerySchema = Joi.object({
  timestamp: Joi.string().isoDate().optional(),
});

const openBusinessesQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).default(25),
  categories: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  search: Joi.string().max(255).optional(),
  limit: Joi.number().min(1).max(100).default(50),
});

// Apply performance monitoring to all routes
router.use(performanceMonitoring);

/**
 * POST /api/businesses
 * Create a new business (business owners and admins only)
 */
router.post(
  '/',
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
router.get(
  '/search/location',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Convert Express request to Lambda-compatible event for handler
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${Date.now()}` },
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
router.get(
  '/search/location/categories',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${Date.now()}` },
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
router.get(
  '/search/location/popular-areas',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = {
        queryStringParameters: req.query as { [key: string]: string },
        headers: req.headers,
        requestContext: { requestId: `express-${Date.now()}` },
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
 * GET /api/businesses/search/location/advanced
 * Advanced location-based search with multiple filters and sorting options
 */
router.get(
  '/search/location/advanced',
  locationSecurityMiddleware,
  validateQuery(advancedLocationSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const {
        lat,
        lng,
        radius,
        category,
        search,
        page,
        limit,
        sortBy,
        priceRange,
        amenities,
        isOpen,
        rating,
        verified,
      } = req.query;

      const searchQuery = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
        radius: radius ? parseFloat(radius as string) : undefined,
        category: category ? (category as string).split(',') : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        sortBy: sortBy as 'distance' | 'rating' | 'newest' | 'popular' | 'price',
        priceRange: priceRange ? JSON.parse(priceRange as string) : undefined,
        amenities: amenities ? (amenities as string).split(',') : undefined,
        isOpen: isOpen === 'true',
        rating: rating ? parseFloat(rating as string) : undefined,
        verified: verified === 'true',
      };

      // Additional business logic validation
      if (searchQuery.radius && searchQuery.radius > 100) {
        throw new LocationSearchError(
          LocationSearchErrorType.RADIUS_TOO_LARGE,
          'Search radius cannot exceed 100 km for optimal performance',
          400,
          { requestedRadius: searchQuery.radius, maxRadius: 100 }
        );
      }

      const result = await locationSearchService.advancedLocationSearch(searchQuery);
      const executionTime = Date.now() - startTime;

      // Add performance headers
      res.set({
        'X-Execution-Time': executionTime.toString(),
        'X-Cache': result.cacheHit ? 'HIT' : 'MISS',
        'Cache-Control': result.cacheHit ? 'public, max-age=300' : 'public, max-age=60',
      });

      // Performance monitoring and warnings
      const performanceLevel = 
        executionTime <= performanceThresholds.EXCELLENT ? 'excellent' :
        executionTime <= performanceThresholds.GOOD ? 'good' :
        executionTime <= performanceThresholds.ACCEPTABLE ? 'acceptable' : 'poor';

      if (executionTime > performanceThresholds.ACCEPTABLE) {
        console.warn('Advanced location search performance warning:', {
          executionTime,
          performanceLevel,
          query: searchQuery,
          resultCount: result.businesses.length,
          threshold: performanceThresholds.ACCEPTABLE,
        });

        // Add performance degradation warning if over 1 second
        if (executionTime > performanceThresholds.ACCEPTABLE) {
          res.set('X-Performance-Warning', 'Search execution time exceeded optimal threshold');
        }
      }

      // Check for no results and provide helpful response
      if (result.businesses.length === 0) {
        return errorResponse(res, 404, 'No businesses found within the specified search criteria', {
          searchQuery: {
            center: { lat: searchQuery.lat, lng: searchQuery.lng },
            radius: searchQuery.radius || 25,
            categories: searchQuery.category,
            search: searchQuery.search,
          },
          suggestions: [
            'Try increasing the search radius',
            'Remove some category filters',
            'Try a different search term',
            'Search in a different location',
          ],
        });
      }

      return successResponse(res, 200, {
        businesses: result.businesses,
        pagination: {
          page: searchQuery.page || 1,
          limit: searchQuery.limit || 10,
          totalCount: result.totalCount,
          totalPages: Math.ceil(result.totalCount / (searchQuery.limit || 10)),
          hasNext: (searchQuery.page || 1) * (searchQuery.limit || 10) < result.totalCount,
          hasPrevious: (searchQuery.page || 1) > 1,
        },
        searchMetadata: {
          searchRadius: result.searchRadius,
          searchCenter: result.searchCenter,
          executionTimeMs: executionTime,
          performanceLevel,
          cacheHit: result.cacheHit,
          resultsWithinRadius: result.businesses.length,
        },
      }, 'Advanced location search completed successfully');
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Handle specific location search errors
      if (error instanceof LocationSearchError) {
        console.error('Location search error:', {
          type: error.type,
          message: error.message,
          statusCode: error.statusCode,
          metadata: error.metadata,
          executionTime,
        });
        
        return errorResponse(res, error.statusCode, error.message, {
          errorType: error.type,
          executionTime,
          ...error.metadata,
        });
      }
      
      // Handle database connection errors
      if (error instanceof Error && error.message.includes('connection')) {
        console.error('Database connection error during location search:', {
          message: error.message,
          executionTime,
          query: req.query,
        });
        
        return errorResponse(res, 503, 'Location search service temporarily unavailable', {
          errorType: 'DATABASE_CONNECTION_ERROR',
          retryAfter: 30, // seconds
          executionTime,
        });
      }
      
      // Handle timeout errors
      if (error instanceof Error && (error.message.includes('timeout') || executionTime > 10000)) {
        console.error('Location search timeout:', {
          message: error.message,
          executionTime,
          query: req.query,
        });
        
        return errorResponse(res, 408, 'Location search timed out', {
          errorType: LocationSearchErrorType.SEARCH_TIMEOUT,
          executionTime,
          suggestion: 'Try reducing the search radius or simplifying filters',
        });
      }
      
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/analytics
 * Get search analytics and performance metrics (admin only)
 */
router.get(
  '/search/analytics',
  authMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await locationSearchService.getSearchAnalytics();
      
      res.set({
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute for admin
      });

      return successResponse(res, 200, {
        analytics,
        timestamp: new Date().toISOString(),
        dataRetention: '7 days for detailed metrics, 30 days for aggregated data',
      }, 'Search analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/businesses/search/location/invalidate-cache
 * Invalidate location-based cache (admin only - for maintenance)
 */
router.post(
  '/search/location/invalidate-cache',
  authMiddleware,
  requireRole(['admin']),
  validateBody(cacheInvalidationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId, coordinates } = req.body;

      await locationSearchService.invalidateLocationCache(businessId, coordinates);

      return successResponse(res, 200, {
        invalidated: true,
        businessId,
        coordinates,
        timestamp: new Date().toISOString(),
      }, 'Location cache invalidated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/location/density
 * Get business density analysis for an area (for heatmaps and analytics)
 */
router.get(
  '/search/location/density',
  locationSecurityMiddleware,
  validateQuery(businessDensitySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng, radius, gridSize } = req.query;

      // Validation already handled by middleware

      const centerLat = parseFloat(lat as string);
      const centerLng = parseFloat(lng as string);
      const radiusKm = radius ? parseFloat(radius as string) : 25;
      const gridSizeKm = gridSize ? parseFloat(gridSize as string) : 1.0;

      // Get density data using PostGIS function
      const densityQuery = `
        SELECT * FROM get_business_density_grid($1, $2, $3, $4)
      `;

      const result = await locationSearchService.query(densityQuery, [
        centerLat,
        centerLng,
        radiusKm,
        gridSizeKm,
      ]);

      const densityData = result.rows.map(row => ({
        center: {
          lat: parseFloat(row.grid_lat),
          lng: parseFloat(row.grid_lng),
        },
        businessCount: parseInt(row.business_count),
        averageRating: parseFloat(row.avg_rating),
        topCategories: row.top_categories || [],
        density: row.business_count / (gridSizeKm * gridSizeKm), // businesses per km²
      }));

      res.set({
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
        'Content-Type': 'application/json',
      });

      return successResponse(res, 200, {
        densityGrid: densityData,
        searchParams: {
          center: { lat: centerLat, lng: centerLng },
          radius: radiusKm,
          gridSize: gridSizeKm,
        },
        metadata: {
          totalGridCells: densityData.length,
          maxDensity: Math.max(...densityData.map(d => d.density)),
          avgDensity: densityData.reduce((sum, d) => sum + d.density, 0) / densityData.length,
        },
      }, 'Business density analysis completed');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses/search/location/nearest/:count
 * Get nearest businesses to a specific point (optimized for mobile apps)
 */
router.get(
  '/search/location/nearest/:count',
  locationSecurityMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { count } = req.params;
      const { lat, lng, category } = req.query;

      if (!lat || !lng) {
        return errorResponse(res, 400, 'Latitude and longitude are required');
      }

      const businessCount = Math.min(parseInt(count, 10) || 5, 20); // Max 20 for performance
      const centerLat = parseFloat(lat as string);
      const centerLng = parseFloat(lng as string);

      // Use optimized PostGIS nearest neighbor query
      const nearestQuery = `
        SELECT *,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                 location_point::geography
               ) / 1000.0 AS distance_km
        FROM businesses
        WHERE is_active = true
          AND location_point IS NOT NULL
          ${category ? 'AND $4 = ANY(categories)' : ''}
        ORDER BY location_point <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
        LIMIT $3
      `;

      const params = category 
        ? [centerLat, centerLng, businessCount, category]
        : [centerLat, centerLng, businessCount];

      const result = await locationSearchService.query(nearestQuery, params);

      const businesses = result.rows.map(row => ({
        ...row,
        distance: parseFloat(row.distance_km),
      }));

      res.set({
        'Cache-Control': 'public, max-age=180', // Cache for 3 minutes
        'X-Business-Count': businesses.length.toString(),
      });

      return successResponse(res, 200, {
        businesses,
        searchCenter: { lat: centerLat, lng: centerLng },
        requestedCount: businessCount,
        actualCount: businesses.length,
        maxDistance: businesses.length > 0 ? Math.max(...businesses.map(b => b.distance)) : 0,
      }, 'Nearest businesses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/businesses
 * Search businesses with traditional filtering and pagination (fallback)
 */
router.get(
  '/',
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
router.get(
  '/my',
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
 * Get all available business categories with enhanced metadata and location filtering
 */
router.get('/categories', validateQuery(categoryQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius, includeSubcategories, includeCounts, limit } = req.query;
    
    let categories;
    
    if (lat && lng && includeCounts) {
      // Location-based categories with business counts
      categories = await categoryService.getCategoryResultCounts(
        parseFloat(lat as string),
        parseFloat(lng as string),
        radius ? parseFloat(radius as string) : 25,
        includeSubcategories !== false
      );
    } else {
      // Enhanced static categories with metadata
      categories = BUSINESS_CATEGORY_OPTIONS.map(option => ({
        category: option.value,
        label: option.label,
        icon: option.icon,
        description: option.description,
        businessCount: 0, // Would need DB query for accurate counts
        averageRating: 4.0,
        popularityScore: option.popularity,
        subcategories: includeSubcategories !== false ? option.subcategories.map(sub => ({
          category: sub,
          label: sub.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          businessCount: 0
        })) : undefined
      })).sort((a, b) => b.popularityScore - a.popularityScore);
    }
    
    const limitedCategories = categories.slice(0, parseInt(limit as string) || 20);
    
    return successResponse(res, 200, {
      categories: limitedCategories,
      total: categories.length,
      metadata: {
        location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string), radius } : undefined,
        includeSubcategories: includeSubcategories !== false,
        includeCounts: includeCounts === true
      }
    }, 'Categories retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/categories/trending
 * Get trending categories based on recent activity
 */
router.get('/categories/trending', validateQuery(trendingCategoriesSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius, limit, timeframe } = req.query;
    
    let trendingCategories;
    
    if (lat && lng) {
      // Location-based trending (would use PostGIS function)
      trendingCategories = await categoryService.getTrendingCategories(parseInt(limit as string) || 10);
    } else {
      // Global trending categories
      trendingCategories = await categoryService.getTrendingCategories(parseInt(limit as string) || 10);
    }
    
    return successResponse(res, 200, {
      categories: trendingCategories,
      metadata: {
        location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string), radius } : undefined,
        timeframe: timeframe || '24h',
        limit: parseInt(limit as string) || 10
      }
    }, 'Trending categories retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/categories/analytics
 * Get category analytics and popularity data
 */
router.get('/categories/analytics', validateQuery(categoryAnalyticsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius, timeframe, categories } = req.query;
    
    // Get category aggregation for location
    let aggregationData = null;
    if (lat && lng) {
      aggregationData = await categoryService.getCategoryAggregation(
        parseFloat(lat as string),
        parseFloat(lng as string),
        radius ? parseFloat(radius as string) : 25,
        categories ? (categories as string).split(',') : undefined
      );
    }
    
    // Get popularity data
    const popularityData = await categoryService.getCategoryPopularityData(
      undefined, // All categories
      (timeframe as '24h' | '7d' | '30d') || '7d'
    );
    
    return successResponse(res, 200, {
      aggregation: aggregationData,
      popularity: popularityData,
      metadata: {
        location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string), radius } : undefined,
        timeframe: timeframe || '7d',
        categories: categories ? (categories as string).split(',') : undefined
      }
    }, 'Category analytics retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/businesses/categories/interactions
 * Track category interaction for analytics
 */
router.post('/categories/interactions', validateBody(categoryInteractionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, interactionType, metadata } = req.body;
    
    await categoryService.trackCategoryInteraction(category, interactionType, {
      ...metadata,
      userId: req.user?.id // Add user ID if authenticated
    });
    
    return successResponse(res, 201, { tracked: true }, 'Category interaction tracked successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/categories/:category
 * Get businesses by category with enhanced filtering
 */
router.get('/categories/:category', validateQuery(categoryQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    const { lat, lng, radius, includeSubcategories, limit } = req.query;
    
    // Get category metadata
    const categoryMetadata = getCategoryMetadata(category);
    if (!categoryMetadata) {
      return errorResponse(res, 404, 'Category not found');
    }
    
    // Get businesses using enhanced repository method
    const businesses = await businessService.getBusinessesByCategory(
      category,
      parseInt(limit as string) || 10,
      {
        includeSubcategories: includeSubcategories !== false,
        location: lat && lng ? {
          lat: parseFloat(lat as string),
          lng: parseFloat(lng as string),
          radius: radius ? parseFloat(radius as string) : 25
        } : undefined
      }
    );
    
    return successResponse(res, 200, {
      businesses,
      category: {
        value: category,
        label: categoryMetadata.label,
        icon: categoryMetadata.icon,
        description: categoryMetadata.description
      },
      total: businesses.length,
      metadata: {
        location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string), radius } : undefined,
        includeSubcategories: includeSubcategories !== false
      }
    }, 'Businesses retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/:businessId
 * Get business by ID
 */
router.get('/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const business = await businessService.getBusinessById(businessId);
    return successResponse(res, 200, business, 'Business retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/businesses/:businessId
 * Update business (owner or admin only)
 */
router.put(
  '/:businessId',
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
router.delete(
  '/:businessId',
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
router.get(
  '/:businessId/stats',
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
router.put(
  '/:businessId/media',
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

// Advanced Filtering Endpoints

/**
 * POST /api/businesses/search/advanced
 * Advanced business search with complex filter combinations
 */
router.post('/search/advanced', validateBody(advancedFilterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = req.body;
    
    // Validate filters
    const validation = filterStateService.validateFilters(filters);
    if (!validation.isValid) {
      return errorResponse(res, 400, 
        'Filter validation failed', 
        validation.conflicts.map(c => c.message)
      );
    }
    
    // Execute advanced search
    const searchResult = await businessService.searchBusinessesAdvanced(validation.normalizedFilters);
    
    // Generate filter state analysis
    const filterState = filterStateService.analyzeFilterState(validation.normalizedFilters);
    const breadcrumbs = filterStateService.generateFilterBreadcrumbs(validation.normalizedFilters);
    
    return successResponse(res, 200, {
      businesses: searchResult.businesses,
      pagination: {
        total: searchResult.totalCount,
        page: validation.normalizedFilters.page || 1,
        limit: validation.normalizedFilters.limit || 10,
        totalPages: Math.ceil(searchResult.totalCount / (validation.normalizedFilters.limit || 10))
      },
      filters: {
        applied: searchResult.appliedFilters,
        state: filterState,
        breadcrumbs,
        urlParams: filterStateService.filtersToUrlParams(validation.normalizedFilters).toString()
      },
      metadata: searchResult.metadata
    }, 'Advanced search completed successfully');
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/search/filters/presets
 * Get available filter presets
 */
router.get('/search/filters/presets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultPresets = filterStateService.getDefaultPresets();
    
    // TODO: Add user custom presets from database
    const customPresets: any[] = [];
    
    return successResponse(res, 200, {
      default: defaultPresets,
      custom: customPresets,
      total: defaultPresets.length + customPresets.length
    }, 'Filter presets retrieved successfully');
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/businesses/search/filters/presets
 * Create custom filter preset
 */
router.post('/search/filters/presets', authMiddleware, validateBody(filterPresetSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, filters } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    
    if (!name || !filters) {
      return errorResponse(res, 400, 'Name and filters are required');
    }
    
    try {
      const preset = filterStateService.createCustomPreset(name, filters, description);
      
      // TODO: Save to database with user ID
      // await businessService.saveFilterPreset(userId, preset);
      
      return successResponse(res, 201, preset, 'Filter preset created successfully');
      
    } catch (validationError) {
      return errorResponse(res, 400, 
        'Invalid filter preset', 
        validationError instanceof Error ? validationError.message : 'Unknown validation error'
      );
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/businesses/search/filters/apply-preset/:presetId
 * Apply filter preset with optional location override
 */
router.post('/search/filters/apply-preset/:presetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { presetId } = req.params;
    const { location } = req.body; // Optional location override
    
    // Get preset (first check defaults, then user presets)
    const defaultPresets = filterStateService.getDefaultPresets();
    const preset = defaultPresets.find(p => p.id === presetId);
    
    // TODO: Check user custom presets from database
    if (!preset) {
      return errorResponse(res, 404, 'Filter preset not found');
    }
    
    // Apply preset with optional location override
    const appliedFilters = filterStateService.applyPreset(preset, location);
    
    // Validate the applied filters
    const validation = filterStateService.validateFilters(appliedFilters);
    if (!validation.isValid) {
      return errorResponse(res, 400, 
        'Preset application failed', 
        validation.conflicts.map(c => c.message)
      );
    }
    
    // Generate filter state analysis
    const filterState = filterStateService.analyzeFilterState(validation.normalizedFilters);
    const breadcrumbs = filterStateService.generateFilterBreadcrumbs(validation.normalizedFilters);
    
    return successResponse(res, 200, {
      filters: validation.normalizedFilters,
      state: filterState,
      breadcrumbs,
      urlParams: filterStateService.filtersToUrlParams(validation.normalizedFilters).toString(),
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description
      }
    }, 'Filter preset applied successfully');
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/businesses/search/filters/validate
 * Validate filter combination and get suggestions
 */
router.post('/search/filters/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = req.body;
    
    const validation = filterStateService.validateFilters(filters);
    const filterState = filterStateService.analyzeFilterState(
      validation.isValid ? validation.normalizedFilters : filters
    );
    const breadcrumbs = filterStateService.generateFilterBreadcrumbs(
      validation.isValid ? validation.normalizedFilters : filters
    );
    
    return successResponse(res, 200, {
      validation,
      state: filterState,
      breadcrumbs,
      urlParams: validation.isValid 
        ? filterStateService.filtersToUrlParams(validation.normalizedFilters).toString()
        : null
    }, validation.isValid ? 'Filters are valid' : 'Filter validation completed with issues');
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/search/filters/parse-url
 * Parse URL parameters into filter object
 */
router.get('/search/filters/parse-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const filters = filterStateService.urlParamsToFilters(urlParams);
    
    // Validate parsed filters
    const validation = filterStateService.validateFilters(filters);
    const filterState = filterStateService.analyzeFilterState(
      validation.isValid ? validation.normalizedFilters : filters
    );
    const breadcrumbs = filterStateService.generateFilterBreadcrumbs(
      validation.isValid ? validation.normalizedFilters : filters
    );
    
    return successResponse(res, 200, {
      filters: validation.isValid ? validation.normalizedFilters : filters,
      validation,
      state: filterState,
      breadcrumbs
    }, 'URL parameters parsed successfully');
    
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/businesses/search/filters/clear/:filterPath
 * Clear specific filter or all filters
 */
router.delete('/search/filters/clear/:filterPath?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filterPath } = req.params;
    const currentFilters = req.body; // Current filter state
    
    let updatedFilters;
    if (filterPath === 'all' || !filterPath) {
      updatedFilters = filterStateService.clearAllFilters();
    } else {
      updatedFilters = filterStateService.clearFilter(currentFilters, filterPath);
    }
    
    // Analyze updated filter state
    const filterState = filterStateService.analyzeFilterState(updatedFilters);
    const breadcrumbs = filterStateService.generateFilterBreadcrumbs(updatedFilters);
    
    return successResponse(res, 200, {
      filters: updatedFilters,
      state: filterState,
      breadcrumbs,
      urlParams: filterStateService.filtersToUrlParams(updatedFilters).toString(),
      cleared: filterPath || 'all'
    }, `Filter ${filterPath || 'all'} cleared successfully`);
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/search/suggestions
 * Get search suggestions based on partial input and current filters
 */
router.get('/search/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, location, categories, limit = 10 } = req.query;
    
    if (!query || (query as string).length < 2) {
      return errorResponse(res, 400, 'Query must be at least 2 characters');
    }
    
    // TODO: Implement search suggestions
    // This would typically involve:
    // 1. Business name suggestions
    // 2. Category suggestions
    // 3. Service suggestions
    // 4. Location-based suggestions
    
    const suggestions = {
      businesses: [], // Top matching business names
      categories: [], // Matching categories
      services: [],   // Matching services
      locations: []   // Nearby location suggestions
    };
    
    return successResponse(res, 200, {
      suggestions,
      query,
      metadata: {
        location: location ? JSON.parse(location as string) : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        limit: parseInt(limit as string)
      }
    }, 'Search suggestions retrieved successfully');
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/businesses/:id/hours
 * Get business hours with special hours and temporary closures
 */
router.get(
  '/:id/hours',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.params.id;
      
      if (!businessId || businessId.length !== 36) {
        return errorResponse(res, 400, 'Invalid business ID format');
      }
      
      const hoursData = await businessHoursService.getBusinessHours(businessId);
      return successResponse(res, 200, hoursData, 'Business hours retrieved successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 404, 'Business not found');
      }
      next(error);
    }
  }
);

/**
 * PUT /api/businesses/:id/hours
 * Update business hours (business owners only)
 */
router.put(
  '/:id/hours',
  authMiddleware,
  requireRole(['business_owner', 'admin']),
  validateBody(businessHoursUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.params.id;
      const ownerId = req.user?.id;
      
      if (!businessId || businessId.length !== 36) {
        return errorResponse(res, 400, 'Invalid business ID format');
      }
      
      if (!ownerId) {
        return errorResponse(res, 401, 'User not authenticated');
      }
      
      await businessHoursService.updateBusinessHours(businessId, ownerId, req.body);
      return successResponse(res, 200, null, 'Business hours updated successfully');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Business not found') {
          return errorResponse(res, 404, 'Business not found');
        }
        if (error.message.includes('Unauthorized')) {
          return errorResponse(res, 403, 'Unauthorized: Not business owner');
        }
      }
      next(error);
    }
  }
);

/**
 * GET /api/businesses/:id/status
 * Get current business status (open/closed)
 */
router.get(
  '/:id/status',
  validateQuery(businessStatusQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.params.id;
      const timestamp = req.query.timestamp ? new Date(req.query.timestamp as string) : undefined;
      
      if (!businessId || businessId.length !== 36) {
        return errorResponse(res, 400, 'Invalid business ID format');
      }
      
      const status = await businessHoursService.getBusinessStatus(businessId, timestamp);
      return successResponse(res, 200, status, 'Business status retrieved successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 404, 'Business not found');
      }
      next(error);
    }
  }
);

/**
 * GET /api/businesses/open
 * Get currently open businesses with location filtering
 * Used by Story 2.3 "Open Now" filter integration
 */
router.get(
  '/open',
  validateQuery(openBusinessesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        lat,
        lng,
        radius = 25,
        categories,
        search,
        limit = 50
      } = req.query as any;
      
      // Parse categories parameter
      let categoryArray: string[] | undefined;
      if (categories) {
        if (Array.isArray(categories)) {
          categoryArray = categories;
        } else if (typeof categories === 'string') {
          categoryArray = categories.split(',').map(c => c.trim());
        }
      }
      
      const openBusinesses = await businessHoursService.getOpenBusinesses(
        lat ? parseFloat(lat) : undefined,
        lng ? parseFloat(lng) : undefined,
        parseFloat(radius),
        categoryArray,
        search,
        parseInt(limit)
      );
      
      return successResponse(
        res,
        200,
        {
          businesses: openBusinesses,
          totalCount: openBusinesses.length,
          metadata: {
            location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
            radius: parseFloat(radius),
            categories: categoryArray,
            searchTerm: search,
            timestamp: new Date().toISOString(),
          }
        },
        'Open businesses retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

export { router as businessRoutes };
