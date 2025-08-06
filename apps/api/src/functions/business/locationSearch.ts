import { APIGatewayProxyHandler } from 'aws-lambda';
import { locationSearchService } from '../../services/locationSearchService.js';
import { locationMonitoringService } from '../../services/locationMonitoringService.js';
import { validateRequest } from '../../middleware/validation.js';
import { LocationSearchQuery } from '../../services/locationSearchService.js';
import { z } from 'zod';

// Request validation schema
const locationSearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(1).max(100).optional().default(25),
  category: z.array(z.string()).optional(),
  search: z.string().max(100).optional(),
  page: z.number().min(1).max(100).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(10),
  sortBy: z.enum(['distance', 'rating', 'newest']).optional().default('distance'),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  amenities: z.array(z.string()).optional(),
  isOpen: z.boolean().optional(),
});

/**
 * Location-based business search with sub-1-second performance
 * GET /api/v1/businesses/search/location
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Convert query string parameters to proper types
    const searchQuery: Partial<LocationSearchQuery> = {
      lat: queryParams.lat ? parseFloat(queryParams.lat) : undefined,
      lng: queryParams.lng ? parseFloat(queryParams.lng) : undefined,
      radius: queryParams.radius ? parseFloat(queryParams.radius) : undefined,
      category: queryParams.category ? queryParams.category.split(',') : undefined,
      search: queryParams.search || undefined,
      page: queryParams.page ? parseInt(queryParams.page, 10) : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
      sortBy: queryParams.sortBy as 'distance' | 'rating' | 'newest' || undefined,
      priceRange: queryParams.priceRange 
        ? JSON.parse(queryParams.priceRange) 
        : undefined,
      amenities: queryParams.amenities ? queryParams.amenities.split(',') : undefined,
      isOpen: queryParams.isOpen ? queryParams.isOpen === 'true' : undefined,
    };

    // Validate the search query
    const validatedQuery = locationSearchSchema.parse(searchQuery);

    // Execute location search
    const result = await locationSearchService.searchByLocation(validatedQuery);

    // Record metrics for monitoring
    await locationMonitoringService.recordSearchExecution(
      result.executionTimeMs,
      result.cacheHit,
      false, // no error since we got here
      {
        lat: validatedQuery.lat,
        lng: validatedQuery.lng,
        radius: validatedQuery.radius,
        category: validatedQuery.category,
        search: validatedQuery.search
      }
    );

    // Performance monitoring
    if (result.executionTimeMs > 1000) {
      console.warn('Location search exceeded 1s target:', {
        executionTime: result.executionTimeMs,
        query: validatedQuery,
        resultCount: result.businesses.length,
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': result.cacheHit ? 'public, max-age=300' : 'public, max-age=60',
        'X-Cache': result.cacheHit ? 'HIT' : 'MISS',
        'X-Execution-Time': result.executionTimeMs.toString(),
      },
      body: JSON.stringify({
        success: true,
        data: {
          businesses: result.businesses,
          pagination: {
            page: validatedQuery.page,
            limit: validatedQuery.limit,
            totalCount: result.totalCount,
            totalPages: Math.ceil(result.totalCount / validatedQuery.limit),
            hasNext: (validatedQuery.page * validatedQuery.limit) < result.totalCount,
            hasPrevious: validatedQuery.page > 1,
          },
          searchMetadata: {
            searchRadius: result.searchRadius,
            searchCenter: result.searchCenter,
            executionTimeMs: result.executionTimeMs,
            cacheHit: result.cacheHit,
            resultsWithinRadius: result.businesses.length,
          },
        },
      }),
    };
  } catch (error) {
    console.error('Location search error:', error);

    // Record error metrics
    if (!(error instanceof z.ZodError)) {
      const queryParams = event.queryStringParameters || {};
      const lat = queryParams.lat ? parseFloat(queryParams.lat) : 0;
      const lng = queryParams.lng ? parseFloat(queryParams.lng) : 0;
      
      await locationMonitoringService.recordSearchExecution(
        0, // no execution time on error
        false,
        true, // error occurred
        {
          lat,
          lng,
          radius: queryParams.radius ? parseFloat(queryParams.radius) : 25,
          category: queryParams.category ? queryParams.category.split(',') : undefined,
          search: queryParams.search
        }
      );
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid search parameters',
          details: error.errors,
        }),
      };
    }

    // Handle other errors
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Location search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Get business categories available in a location
 * GET /api/v1/businesses/search/location/categories
 */
export const getCategoriesInLocation: APIGatewayProxyHandler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    
    const lat = queryParams.lat ? parseFloat(queryParams.lat) : undefined;
    const lng = queryParams.lng ? parseFloat(queryParams.lng) : undefined;
    const radius = queryParams.radius ? parseFloat(queryParams.radius) : 25;

    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Latitude and longitude are required',
        }),
      };
    }

    // Get categories available in this location
    const categories = await locationSearchService.getCategoriesInLocation(lat, lng, radius);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify({
        success: true,
        data: {
          categories,
          location: { lat, lng, radius },
        },
      }),
    };
  } catch (error) {
    console.error('Categories in location error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Get popular search areas and business density
 * GET /api/v1/businesses/search/location/popular-areas
 */
export const getPopularAreas: APIGatewayProxyHandler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    
    const lat = queryParams.lat ? parseFloat(queryParams.lat) : undefined;
    const lng = queryParams.lng ? parseFloat(queryParams.lng) : undefined;
    const radius = queryParams.radius ? parseFloat(queryParams.radius) : 50;

    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Latitude and longitude are required',
        }),
      };
    }

    // Get popular areas with business density
    const popularAreas = await locationSearchService.getPopularAreas(lat, lng, radius);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
      },
      body: JSON.stringify({
        success: true,
        data: {
          popularAreas,
          searchCenter: { lat, lng, radius },
        },
      }),
    };
  } catch (error) {
    console.error('Popular areas error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to get popular areas',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};