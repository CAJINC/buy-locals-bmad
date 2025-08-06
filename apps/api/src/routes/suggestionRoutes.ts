import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { searchSuggestionService } from '../services/searchSuggestionService.js';
import { redisClient } from '../config/redis.js';

const router = Router();

// Performance monitoring middleware
const performanceMiddleware = (targetMs: number = 200) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      if (responseTime > targetMs) {
        console.warn(`Slow suggestion response: ${responseTime}ms for ${req.path}`, {
          query: req.query,
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 50),
        });
      }
    });
    
    next();
  };
};

// Input validation middleware
const validateSuggestionQuery = [
  query('q')
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape()
    .withMessage('Query must be between 1-100 characters'),
    
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
    
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
    
  query('radius')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Radius must be between 1-100 km'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1-20'),
];

const validateAnalyticsRequest = [
  body('suggestionId')
    .notEmpty()
    .isLength({ max: 100 })
    .trim()
    .escape()
    .withMessage('Suggestion ID is required and must be under 100 characters'),
    
  body('query')
    .notEmpty()
    .isLength({ max: 100 })
    .trim()
    .escape()
    .withMessage('Query is required and must be under 100 characters'),
    
  body('action')
    .isIn(['click', 'conversion', 'impression'])
    .withMessage('Action must be click, conversion, or impression'),
];

/**
 * GET /api/suggestions/autocomplete
 * High-performance autocomplete endpoint with sub-200ms target response time
 */
router.get(
  '/autocomplete',
  performanceMiddleware(200),
  rateLimitMiddleware({
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: 'Too many autocomplete requests, please try again later',
  }),
  validateSuggestionQuery,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input parameters',
          errors: errors.array(),
          responseTime: Date.now() - startTime,
        });
      }

      const {
        q: query,
        lat,
        lng,
        radius = 10,
        limit = 8,
        includeHistory = 'true',
        includeTrending = 'true',
        includePopular = 'true',
      } = req.query as any;

      // Early exit for empty queries
      if (!query || query.trim().length === 0) {
        return res.json({
          success: true,
          data: {
            suggestions: [],
            totalCount: 0,
            responseTime: Date.now() - startTime,
            cacheHit: false,
            metadata: {
              query: '',
              sources: [],
              confidence: 0,
              hasMore: false,
            },
          },
        });
      }

      // Build suggestion query
      const suggestionQuery = {
        query: query.trim(),
        location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        radius: parseInt(radius),
        limit: Math.min(parseInt(limit), 10), // Cap at 10 for performance
        includeHistory: includeHistory === 'true',
        includeTrending: includeTrending === 'true',
        includePopular: includePopular === 'true',
        userContext: {
          sessionId: req.sessionID,
          previousSearches: [], // Could be extracted from session
        },
        performanceOptions: {
          maxResponseTime: 200,
          cacheOnly: false,
          minConfidence: 0.1,
        },
      };

      // Get suggestions
      const result = await searchSuggestionService.getSuggestions(suggestionQuery);

      // Set performance headers
      res.setHeader('X-Cache-Hit', result.cacheHit ? 'true' : 'false');
      res.setHeader('X-Suggestion-Count', result.suggestions.length.toString());
      res.setHeader('X-Total-Count', result.totalCount.toString());

      // Success response
      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      console.error('Autocomplete endpoint error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
        executionTime: Date.now() - startTime,
      });
      
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/business-names
 * Fast business name autocomplete with fuzzy matching
 */
router.get(
  '/business-names',
  performanceMiddleware(150),
  rateLimitMiddleware({
    windowMs: 60000,
    max: 150, // Higher limit for business names
    message: 'Too many business name requests, please try again later',
  }),
  [
    query('q')
      .isLength({ min: 2, max: 50 })
      .trim()
      .escape()
      .withMessage('Query must be between 2-50 characters'),
      
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 50 }),
    query('limit').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input parameters',
          errors: errors.array(),
        });
      }

      const {
        q: query,
        lat,
        lng,
        radius = 10,
        limit = 5,
      } = req.query as any;

      const suggestions = await searchSuggestionService.getBusinessNameAutocomplete(
        query.trim(),
        lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        parseInt(radius),
        parseInt(limit)
      );

      res.setHeader('X-Business-Count', suggestions.length.toString());
      
      res.json({
        success: true,
        data: {
          suggestions,
          responseTime: Date.now() - startTime,
          query: query.trim(),
        },
      });

    } catch (error) {
      console.error('Business names endpoint error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/categories
 * Category suggestions based on location and popularity
 */
router.get(
  '/categories',
  performanceMiddleware(100),
  rateLimitMiddleware({
    windowMs: 60000,
    max: 200,
    message: 'Too many category requests, please try again later',
  }),
  [
    query('q')
      .optional()
      .isLength({ min: 1, max: 30 })
      .trim()
      .escape(),
      
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 15 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input parameters',
          errors: errors.array(),
        });
      }

      const {
        q: query = '',
        lat,
        lng,
        radius = 25,
        limit = 10,
      } = req.query as any;

      const suggestions = await searchSuggestionService.getCategorySuggestions(
        query.trim(),
        lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        parseInt(radius),
        parseInt(limit)
      );

      res.setHeader('X-Category-Count', suggestions.length.toString());
      
      res.json({
        success: true,
        data: {
          suggestions,
          responseTime: Date.now() - startTime,
          query: query.trim(),
        },
      });

    } catch (error) {
      console.error('Categories endpoint error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/trending
 * Trending search suggestions
 */
router.get(
  '/trending',
  performanceMiddleware(300),
  rateLimitMiddleware({
    windowMs: 300000, // 5 minutes
    max: 50,
    message: 'Too many trending requests, please try again later',
  }),
  [
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input parameters',
          errors: errors.array(),
        });
      }

      const {
        lat,
        lng,
        radius = 50,
        limit = 5,
      } = req.query as any;

      const suggestions = await searchSuggestionService.getTrendingSuggestions(
        lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        parseInt(radius),
        parseInt(limit)
      );

      res.setHeader('X-Trending-Count', suggestions.length.toString());
      
      res.json({
        success: true,
        data: {
          suggestions,
          responseTime: Date.now() - startTime,
          location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
        },
      });

    } catch (error) {
      console.error('Trending endpoint error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/popular
 * Popular search suggestions
 */
router.get(
  '/popular',
  performanceMiddleware(250),
  rateLimitMiddleware({
    windowMs: 300000, // 5 minutes
    max: 60,
    message: 'Too many popular requests, please try again later',
  }),
  [
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input parameters',
          errors: errors.array(),
        });
      }

      const {
        lat,
        lng,
        radius = 25,
        limit = 5,
      } = req.query as any;

      const suggestions = await searchSuggestionService.getPopularSuggestions(
        lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        parseInt(radius),
        parseInt(limit)
      );

      res.setHeader('X-Popular-Count', suggestions.length.toString());
      
      res.json({
        success: true,
        data: {
          suggestions,
          responseTime: Date.now() - startTime,
          location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
        },
      });

    } catch (error) {
      console.error('Popular endpoint error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/suggestions/analytics/track
 * Track suggestion interactions for analytics
 */
router.post(
  '/analytics/track',
  performanceMiddleware(100),
  rateLimitMiddleware({
    windowMs: 60000,
    max: 300, // Higher limit for analytics
    message: 'Too many analytics requests, please try again later',
  }),
  validateAnalyticsRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid analytics data',
          errors: errors.array(),
        });
      }

      const {
        suggestionId,
        query,
        action,
        conversionType = 'view',
        userContext,
      } = req.body;

      // Track different types of analytics events
      switch (action) {
        case 'click':
          await searchSuggestionService.trackSuggestionClick(
            suggestionId,
            query,
            userContext
          );
          break;
          
        case 'conversion':
          await searchSuggestionService.trackSuggestionConversion(
            suggestionId,
            query,
            conversionType
          );
          break;
          
        case 'impression':
          // Impressions are tracked automatically in getSuggestions
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action type',
          });
      }

      res.json({
        success: true,
        data: {
          tracked: true,
          action,
          suggestionId,
          responseTime: Date.now() - startTime,
        },
      });

    } catch (error) {
      console.error('Analytics tracking error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/analytics
 * Get suggestion analytics and performance metrics
 */
router.get(
  '/analytics',
  performanceMiddleware(500),
  rateLimitMiddleware({
    windowMs: 300000, // 5 minutes
    max: 20, // Limited analytics access
    message: 'Too many analytics requests, please try again later',
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const analytics = await searchSuggestionService.getSuggestionAnalytics();

      res.json({
        success: true,
        data: {
          ...analytics,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/health
 * Health check endpoint for suggestion service
 */
router.get(
  '/health',
  performanceMiddleware(50),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Check Redis connection
      const redisHealthy = redisClient.isReady;
      
      // Check database connection (simplified)
      const dbHealthy = true; // Would perform actual DB health check
      
      // Performance metrics
      const health = {
        status: redisHealthy && dbHealthy ? 'healthy' : 'degraded',
        services: {
          redis: redisHealthy ? 'up' : 'down',
          database: dbHealthy ? 'up' : 'down',
        },
        performance: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        features: {
          autocomplete: redisHealthy && dbHealthy,
          trending: redisHealthy,
          popular: redisHealthy,
          analytics: redisHealthy,
        },
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json({
        success: health.status === 'healthy',
        data: health,
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        success: false,
        message: 'Service unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      });
    }
  }
);

/**
 * DELETE /api/suggestions/cache/clear
 * Clear suggestion cache (admin endpoint)
 */
router.delete(
  '/cache/clear',
  performanceMiddleware(1000),
  rateLimitMiddleware({
    windowMs: 3600000, // 1 hour
    max: 5, // Very limited cache clearing
    message: 'Cache clearing rate limited',
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      if (!redisClient.isReady) {
        return res.status(503).json({
          success: false,
          message: 'Redis not available',
        });
      }

      // Clear suggestion caches
      const patterns = [
        'suggestions:*',
        'trending:*',
        'popular:*',
        'autocomplete:*',
      ];

      let totalCleared = 0;
      
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
          totalCleared += keys.length;
        }
      }

      res.json({
        success: true,
        data: {
          keysCleared: totalCleared,
          patterns,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('Cache clear error:', error);
      next(error);
    }
  }
);

// Error handling middleware for suggestion routes
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  const responseTime = Date.now() - (req as any).startTime;
  
  console.error('Suggestion route error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    responseTime,
  });

  // Set error response headers
  res.setHeader('X-Error', 'true');
  res.setHeader('X-Response-Time', `${responseTime}ms`);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid request data',
      error: error.message,
      responseTime,
    });
  }

  if (error.name === 'TimeoutError') {
    return res.status(408).json({
      success: false,
      message: 'Request timeout',
      error: 'The suggestion request took too long to process',
      responseTime,
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    responseTime,
  });
});

export default router;