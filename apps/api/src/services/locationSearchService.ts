import { redisClient } from '../config/redis.js';
import { BaseRepository } from '../repositories/BaseRepository.js';
import { Business } from '../types/Business.js';

export interface LocationSearchQuery {
  lat: number;
  lng: number;
  radius?: number; // kilometers, default 25
  category?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'distance' | 'rating' | 'newest';
  priceRange?: [number, number];
  amenities?: string[];
  isOpen?: boolean; // filter by current operating hours
}

export interface LocationSearchResult {
  businesses: EnhancedBusinessResult[];
  totalCount: number;
  searchRadius: number;
  searchCenter: { lat: number; lng: number };
  executionTimeMs: number;
  cacheHit: boolean;
}

export interface EnhancedBusinessResult extends Business {
  distance: number; // kilometers
  bearing?: number; // degrees from north
  estimatedTravelTime?: number; // minutes
  isCurrentlyOpen?: boolean;
  popularTimes?: { [hour: string]: number }; // 0-100 popularity score
}

export class LocationSearchService extends BaseRepository<Business> {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'location_search';
  private readonly MAX_RADIUS = 100; // Maximum search radius in km
  private readonly DEFAULT_RADIUS = 25;
  private readonly DEFAULT_LIMIT = 10;

  constructor() {
    super('businesses');
  }

  /**
   * High-performance location-based business search with multi-layer caching
   */
  async searchByLocation(query: LocationSearchQuery): Promise<LocationSearchResult> {
    const startTime = Date.now();
    
    // Validate and normalize query parameters
    const normalizedQuery = this.normalizeQuery(query);
    
    // Generate cache key based on query parameters
    const cacheKey = this.generateCacheKey(normalizedQuery);
    
    try {
      // Try cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          executionTimeMs: Date.now() - startTime,
          cacheHit: true,
        };
      }

      // Execute spatial search with PostGIS
      const searchResult = await this.executeLocationSearch(normalizedQuery);
      
      // Enhance results with additional data
      const enhancedResult = await this.enhanceSearchResults(searchResult, normalizedQuery);
      
      // Cache the result
      await this.cacheResult(cacheKey, enhancedResult);
      
      return {
        ...enhancedResult,
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
      };
    } catch (error) {
      console.error('Location search error:', {
        query: normalizedQuery,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get nearby businesses with distance-optimized queries
   */
  private async executeLocationSearch(query: LocationSearchQuery): Promise<{
    businesses: EnhancedBusinessResult[];
    totalCount: number;
  }> {
    const { lat, lng, radius, category, search, page, limit } = query;
    const offset = ((page || 1) - 1) * (limit || this.DEFAULT_LIMIT);

    // Use the optimized PostGIS search function
    const searchSql = `
      SELECT * FROM search_businesses_by_location(
        $1::FLOAT, $2::FLOAT, $3::FLOAT, $4::TEXT[], $5::TEXT, $6::INTEGER, $7::INTEGER
      )
    `;

    const countSql = `
      SELECT count_businesses_by_location(
        $1::FLOAT, $2::FLOAT, $3::FLOAT, $4::TEXT[], $5::TEXT
      ) as total_count
    `;

    const searchParams = [
      lat,
      lng,
      radius || this.DEFAULT_RADIUS,
      category || null,
      search || null,
      limit || this.DEFAULT_LIMIT,
      offset,
    ];

    const countParams = searchParams.slice(0, 5); // Remove limit and offset

    // Execute queries in parallel
    const [businessResult, countResult] = await Promise.all([
      this.query(searchSql, searchParams),
      this.query(countSql, countParams),
    ]);

    return {
      businesses: businessResult.rows.map(row => ({
        ...row,
        distance: parseFloat(row.distance_km),
      })),
      totalCount: parseInt(countResult.rows[0].total_count),
    };
  }

  /**
   * Enhance search results with additional computed data
   */
  private async enhanceSearchResults(
    result: { businesses: EnhancedBusinessResult[]; totalCount: number },
    query: LocationSearchQuery
  ): Promise<Omit<LocationSearchResult, 'executionTimeMs' | 'cacheHit'>> {
    const { businesses, totalCount } = result;
    const { lat, lng, radius } = query;

    // Add bearing calculations and business hours checks
    const enhancedBusinesses = await Promise.all(
      businesses.map(async (business) => {
        const enhanced: EnhancedBusinessResult = {
          ...business,
          bearing: this.calculateBearing(lat, lng, business.location.coordinates.lat, business.location.coordinates.lng),
          isCurrentlyOpen: this.isBusinessCurrentlyOpen(business.hours),
          estimatedTravelTime: this.estimateTravelTime(business.distance),
        };

        return enhanced;
      })
    );

    return {
      businesses: enhancedBusinesses,
      totalCount,
      searchRadius: radius || this.DEFAULT_RADIUS,
      searchCenter: { lat, lng },
    };
  }

  /**
   * Intelligent caching with hierarchical keys
   */
  private generateCacheKey(query: LocationSearchQuery): string {
    const { lat, lng, radius, category, search, page, limit, sortBy } = query;
    
    // Round coordinates to 4 decimal places (~11m precision) for better cache hits
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    
    const keyParts = [
      this.CACHE_PREFIX,
      `${roundedLat},${roundedLng}`,
      `r${radius || this.DEFAULT_RADIUS}`,
      category ? `c${category.sort().join(',')}` : 'c_all',
      search ? `s${search.toLowerCase().replace(/\s+/g, '_')}` : 's_all',
      `p${page || 1}`,
      `l${limit || this.DEFAULT_LIMIT}`,
      `sort${sortBy || 'distance'}`,
    ];
    
    return keyParts.join(':');
  }

  /**
   * Cache result with intelligent TTL based on data freshness
   */
  private async cacheResult(
    cacheKey: string,
    result: Omit<LocationSearchResult, 'executionTimeMs' | 'cacheHit'>
  ): Promise<void> {
    try {
      if (!redisClient.isReady) {
        console.warn('Redis not available, skipping cache');
        return;
      }

      // Dynamic TTL based on result density
      const dynamicTTL = this.calculateDynamicTTL(result.businesses.length, result.totalCount);
      
      await redisClient.setEx(
        cacheKey,
        dynamicTTL,
        JSON.stringify(result)
      );

      // Create geographic cache clusters for nearby queries
      await this.updateGeographicCache(result.searchCenter, result.businesses);
    } catch (error) {
      console.error('Cache write error:', error);
      // Continue without caching - don't break the search
    }
  }

  /**
   * Retrieve cached result with fallback handling
   */
  private async getCachedResult(cacheKey: string): Promise<Omit<LocationSearchResult, 'executionTimeMs' | 'cacheHit'> | null> {
    try {
      if (!redisClient.isReady) {
        return null;
      }

      const cached = await redisClient.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Update geographic clusters for related location searches
   */
  private async updateGeographicCache(
    center: { lat: number; lng: number },
    businesses: EnhancedBusinessResult[]
  ): Promise<void> {
    try {
      // Create a geographic cluster key for nearby searches
      const clusterKey = `${this.CACHE_PREFIX}:cluster:${Math.round(center.lat * 100)}:${Math.round(center.lng * 100)}`;
      
      const clusterData = {
        center,
        businessIds: businesses.map(b => b.id),
        timestamp: Date.now(),
      };

      await redisClient.setEx(clusterKey, 600, JSON.stringify(clusterData)); // 10 minutes
    } catch (error) {
      console.error('Geographic cache update error:', error);
    }
  }

  /**
   * Calculate dynamic TTL based on search result density
   */
  private calculateDynamicTTL(resultCount: number, totalCount: number): number {
    // Higher density areas change less frequently, can cache longer
    const density = resultCount / Math.max(totalCount, 1);
    
    if (density > 0.5) {
      return 600; // 10 minutes for high-density areas
    } else if (density > 0.2) {
      return 300; // 5 minutes for medium-density areas
    } else {
      return 120; // 2 minutes for sparse areas
    }
  }

  /**
   * Normalize and validate query parameters
   */
  private normalizeQuery(query: LocationSearchQuery): LocationSearchQuery {
    const { lat, lng, radius, limit, page } = query;

    // Validate coordinates
    if (!this.isValidCoordinate(lat, lng)) {
      throw new Error('Invalid coordinates provided');
    }

    return {
      ...query,
      radius: Math.min(radius || this.DEFAULT_RADIUS, this.MAX_RADIUS),
      limit: Math.min(limit || this.DEFAULT_LIMIT, 50), // Max 50 results per page
      page: Math.max(page || 1, 1),
    };
  }

  /**
   * Coordinate validation
   */
  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' && 
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !isNaN(lat) && !isNaN(lng)
    );
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Check if business is currently open
   */
  private isBusinessCurrentlyOpen(hours: any): boolean {
    if (!hours || typeof hours !== 'object') return false;

    const now = new Date();
    const currentDay = now.toLocaleLowerCase()
      .slice(0, 3); // 'mon', 'tue', etc.
    const currentTime = now.getHours() * 100 + now.getMinutes();

    const todayHours = hours[currentDay];
    if (!todayHours || todayHours.closed) return false;

    const openTime = this.parseTime(todayHours.open);
    const closeTime = this.parseTime(todayHours.close);

    if (closeTime < openTime) {
      // Handles overnight hours (e.g., 10PM - 2AM)
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Parse time string to numeric format (HHMM)
   */
  private parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n, 10));
    return hours * 100 + (minutes || 0);
  }

  /**
   * Estimate travel time based on distance
   */
  private estimateTravelTime(distanceKm: number): number {
    // Simple estimation: average 30 km/h in urban areas
    return Math.round((distanceKm / 30) * 60);
  }

  /**
   * Get categories available in a specific location
   */
  async getCategoriesInLocation(lat: number, lng: number, radius: number): Promise<string[]> {
    const cacheKey = `${this.CACHE_PREFIX}:categories:${Math.round(lat * 10000)}:${Math.round(lng * 10000)}:r${radius}`;
    
    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Query categories within the specified location
      const query = `
        SELECT DISTINCT unnest(categories) as category
        FROM businesses
        WHERE is_active = true
          AND location_point IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            location_point::geography,
            $3 * 1000
          )
        ORDER BY category
      `;

      const result = await this.query(query, [lat, lng, radius]);
      const categories = result.rows.map(row => row.category);

      // Cache for 1 hour
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(categories));
      }

      return categories;
    } catch (error) {
      console.error('Get categories in location error:', error);
      throw error;
    }
  }

  /**
   * Get popular areas with business density analysis
   */
  async getPopularAreas(lat: number, lng: number, radius: number): Promise<Array<{
    center: { lat: number; lng: number };
    businessCount: number;
    averageRating: number;
    topCategories: string[];
    name?: string;
  }>> {
    const cacheKey = `${this.CACHE_PREFIX}:popular:${Math.round(lat * 100)}:${Math.round(lng * 100)}:r${radius}`;
    
    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Grid-based density analysis
      const gridSize = 0.01; // Approximately 1km grid cells
      const query = `
        WITH business_grid AS (
          SELECT 
            FLOOR(ST_Y(location_point) / $4) * $4 + $4/2 as grid_lat,
            FLOOR(ST_X(location_point) / $4) * $4 + $4/2 as grid_lng,
            COUNT(*) as business_count,
            AVG(COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id), 4.0)) as avg_rating,
            array_agg(DISTINCT categories[1]) as top_categories
          FROM businesses
          WHERE is_active = true
            AND location_point IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              location_point::geography,
              $3 * 1000
            )
          GROUP BY grid_lat, grid_lng
          HAVING COUNT(*) >= 3
        )
        SELECT 
          grid_lat, grid_lng, business_count, 
          ROUND(avg_rating::numeric, 2) as avg_rating,
          (SELECT array_agg(cat) FROM unnest(top_categories) cat WHERE cat IS NOT NULL LIMIT 3) as top_categories
        FROM business_grid
        ORDER BY business_count DESC, avg_rating DESC
        LIMIT 10
      `;

      const result = await this.query(query, [lat, lng, radius, gridSize]);
      
      const popularAreas = result.rows.map(row => ({
        center: { 
          lat: parseFloat(row.grid_lat), 
          lng: parseFloat(row.grid_lng) 
        },
        businessCount: parseInt(row.business_count),
        averageRating: parseFloat(row.avg_rating),
        topCategories: row.top_categories || [],
        name: this.generateAreaName(parseFloat(row.grid_lat), parseFloat(row.grid_lng))
      }));

      // Cache for 30 minutes
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, 1800, JSON.stringify(popularAreas));
      }

      return popularAreas;
    } catch (error) {
      console.error('Get popular areas error:', error);
      throw error;
    }
  }

  /**
   * Generate area name based on coordinates (basic implementation)
   */
  private generateAreaName(lat: number, lng: number): string {
    // This could be enhanced with reverse geocoding
    return `Area ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }

  /**
   * Analyze search performance and cache efficiency
   */
  async getSearchAnalytics(): Promise<{
    totalSearches: number;
    cacheHitRate: number;
    averageExecutionTime: number;
    popularSearchAreas: Array<{ lat: number; lng: number; count: number }>;
  }> {
    try {
      if (!redisClient.isReady) {
        return {
          totalSearches: 0,
          cacheHitRate: 0,
          averageExecutionTime: 0,
          popularSearchAreas: [],
        };
      }

      // Get analytics from Redis (implementation would depend on tracking setup)
      const analytics = {
        totalSearches: 0,
        cacheHitRate: 0.85, // Example value
        averageExecutionTime: 150, // Example value in ms
        popularSearchAreas: [],
      };

      return analytics;
    } catch (error) {
      console.error('Get search analytics error:', error);
      throw error;
    }
  }

  /**
   * Invalidate location-based cache when businesses are updated
   */
  async invalidateLocationCache(businessId?: string, coordinates?: { lat: number; lng: number }): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      if (coordinates) {
        // Invalidate specific geographic area
        const clusterKey = `${this.CACHE_PREFIX}:cluster:${Math.round(coordinates.lat * 100)}:${Math.round(coordinates.lng * 100)}`;
        await redisClient.del(clusterKey);
        
        // Invalidate categories cache
        const categoriesKey = `${this.CACHE_PREFIX}:categories:${Math.round(coordinates.lat * 10000)}:${Math.round(coordinates.lng * 10000)}:*`;
        const categoryKeys = await redisClient.keys(categoriesKey);
        if (categoryKeys.length > 0) {
          await redisClient.del(...categoryKeys);
        }
        
        // Invalidate popular areas cache
        const popularKey = `${this.CACHE_PREFIX}:popular:${Math.round(coordinates.lat * 100)}:${Math.round(coordinates.lng * 100)}:*`;
        const popularKeys = await redisClient.keys(popularKey);
        if (popularKeys.length > 0) {
          await redisClient.del(...popularKeys);
        }
      }

      // For broader invalidation, use pattern matching
      if (businessId) {
        // This would require a more sophisticated cache tagging system
        // For now, we'll use expiration-based invalidation
        console.log(`Location cache invalidation requested for business: ${businessId}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

export const locationSearchService = new LocationSearchService();