import { BaseRepository } from './BaseRepository.js';
import { Business, BusinessSearchQuery, CreateBusinessRequest } from '../types/Business.js';
import { logger } from '../utils/logger.js';
import { categoryService } from '../services/categoryService.js';
import { expandCategoryFilter, CategoryFilter, getAllCategories } from '../constants/businessCategories.js';
import { AdvancedFilters, filterStateService } from '../services/filterStateService.js';

export class BusinessRepository extends BaseRepository<Business> {
  constructor() {
    super('businesses');
  }

  /**
   * Create a new business
   */
  async createBusiness(ownerId: string, businessData: CreateBusinessRequest): Promise<Business> {
    const query = `
      INSERT INTO businesses (
        owner_id, name, description, location, categories, 
        hours, contact, services, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      ownerId,
      businessData.name,
      businessData.description || null,
      JSON.stringify(businessData.location),
      businessData.categories,
      JSON.stringify(businessData.hours),
      JSON.stringify(businessData.contact),
      JSON.stringify(businessData.services || []),
      true, // Default to active
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Find businesses by owner ID
   */
  async findByOwnerId(ownerId: string): Promise<Business[]> {
    const query = 'SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC';
    const result = await this.query(query, [ownerId]);
    return result.rows;
  }

  /**
   * Search businesses with optimized PostGIS location-based filtering
   */
  async searchBusinesses(searchQuery: BusinessSearchQuery): Promise<{
    businesses: Business[];
    totalCount: number;
  }> {
    const { lat, lng, category, search, page = 1, limit = 10 } = searchQuery;
    const offset = (page - 1) * limit;

    // Use PostGIS if coordinates are provided, otherwise fall back to JSONB
    if (lat && lng) {
      return this.searchBusinessesPostGIS(searchQuery);
    }

    // Fallback to original JSONB-based search for non-location queries
    const whereConditions: string[] = ['is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;

    // Category filter
    if (category) {
      whereConditions.push(`$${paramIndex} = ANY(categories)`);
      params.push(category);
      paramIndex++;
    }

    // Text search in name and description
    if (search) {
      whereConditions.push(`
        (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})
      `);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Main query for businesses
    const businessQuery = `
      SELECT *
      FROM businesses 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM businesses 
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset

    const [businessResult, countResult] = await Promise.all([
      this.query(businessQuery, params),
      this.query(countQuery, countParams),
    ]);

    return {
      businesses: businessResult.rows,
      totalCount: parseInt(countResult.rows[0].count),
    };
  }

  /**
   * PostGIS-optimized business search with enhanced category filtering
   */
  private async searchBusinessesPostGIS(searchQuery: BusinessSearchQuery): Promise<{
    businesses: Business[];
    totalCount: number;
  }> {
    const startTime = process.hrtime.bigint();
    const { lat, lng, radius = 25, category, search, page = 1, limit = 10 } = searchQuery;
    const offset = (page - 1) * limit;

    try {
      // Enhanced category filtering with OR logic support
      let categoryArray: string[] | null = null;
      if (category) {
        if (Array.isArray(category)) {
          // Multiple category selection with OR logic
          categoryArray = expandCategoryFilter({ 
            categories: category, 
            includeSubcategories: true 
          });
        } else {
          // Single category (backward compatibility)
          categoryArray = expandCategoryFilter({ 
            categories: [category], 
            includeSubcategories: true 
          });
        }
      }

      // Use the optimized PostGIS search function with enhanced category filtering
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

      const searchParams = [lat, lng, radius, categoryArray, search || null, limit, offset];

      const countParams = searchParams.slice(0, 5); // Remove limit and offset

      // Execute queries in parallel for maximum performance
      const [businessResult, countResult] = await Promise.all([
        this.query(searchSql, searchParams),
        this.query(countSql, countParams),
      ]);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      // Track category interactions for popularity analytics
      if (categoryArray && categoryArray.length > 0) {
        for (const cat of categoryArray) {
          categoryService.trackCategoryInteraction(cat, 'search', {
            location: { lat, lng },
            searchQuery: search || undefined
          }).catch(error => 
            logger.error('Category tracking error', { category: cat, error })
          );
        }
      }

      // Log performance metrics for monitoring
      this.logQueryPerformance('searchBusinessesPostGIS', executionTimeMs, {
        lat,
        lng,
        radius,
        categories: categoryArray,
        search,
        resultsCount: businessResult.rows.length,
      });

      // Alert if performance degrades
      if (executionTimeMs > 200) {
        logger.performance('PostGIS query performance warning', {
          component: 'business-repository',
          operation: 'postgis-query',
          duration: executionTimeMs,
          query: searchQuery,
          resultCount: businessResult.rows.length,
        });
      }

      return {
        businesses: businessResult.rows.map(row => ({
          ...row,
          // Add distance to the business object for client use
          distance: parseFloat(row.distance_km),
        })),
        totalCount: parseInt(countResult.rows[0].total_count),
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      logger.error('PostGIS query error', {
        component: 'business-repository',
        operation: 'postgis-query',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        query: searchQuery,
      });

      throw error;
    }
  }

  /**
   * Get businesses within a specific geometric area (polygon)
   */
  async getBusinessesInArea(polygon: { lat: number; lng: number }[]): Promise<Business[]> {
    const startTime = process.hrtime.bigint();

    try {
      // Convert polygon coordinates to PostGIS format
      const polygonString = polygon.map(point => `${point.lng} ${point.lat}`).join(', ');

      const query = `
        SELECT *, 
               ST_X(location_point) as longitude,
               ST_Y(location_point) as latitude
        FROM businesses
        WHERE is_active = true
          AND location_point IS NOT NULL
          AND ST_Contains(
            ST_GeomFromText('POLYGON((${polygonString}, ${polygon[0].lng} ${polygon[0].lat}))', 4326),
            location_point
          )
        ORDER BY created_at DESC
      `;

      const result = await this.query(query, []);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      this.logQueryPerformance('getBusinessesInArea', executionTimeMs, {
        polygonPoints: polygon.length,
        resultsCount: result.rows.length,
      });

      return result.rows;
    } catch (error) {
      logger.error('Get businesses in area error', {
        component: 'business-repository',
        operation: 'get-businesses-in-area',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get business density analysis for an area
   */
  async getBusinessDensityAnalysis(
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<{
    totalBusinesses: number;
    densityPerKm2: number;
    categoryBreakdown: { category: string; count: number }[];
    averageDistance: number;
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const query = `
        WITH area_businesses AS (
          SELECT 
            categories,
            ST_Distance(
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              location_point::geography
            ) / 1000.0 AS distance_km
          FROM businesses
          WHERE is_active = true
            AND location_point IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              location_point::geography,
              $3 * 1000
            )
        ),
        category_counts AS (
          SELECT unnest(categories) as category, COUNT(*) as count
          FROM area_businesses
          GROUP BY category
          ORDER BY count DESC
        )
        SELECT 
          (SELECT COUNT(*) FROM area_businesses) as total_businesses,
          (SELECT ROUND(AVG(distance_km)::numeric, 2) FROM area_businesses) as avg_distance,
          (SELECT json_agg(json_build_object('category', category, 'count', count)) 
           FROM category_counts) as category_breakdown
      `;

      const result = await this.query(query, [centerLat, centerLng, radiusKm]);
      const row = result.rows[0];

      const totalBusinesses = parseInt(row.total_businesses) || 0;
      const areaKm2 = Math.PI * radiusKm * radiusKm;
      const densityPerKm2 = totalBusinesses / areaKm2;

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      this.logQueryPerformance('getBusinessDensityAnalysis', executionTimeMs, {
        centerLat,
        centerLng,
        radiusKm,
        totalBusinesses,
      });

      return {
        totalBusinesses,
        densityPerKm2: Math.round(densityPerKm2 * 100) / 100,
        categoryBreakdown: row.category_breakdown || [],
        averageDistance: parseFloat(row.avg_distance) || 0,
      };
    } catch (error) {
      logger.error('Business density analysis error', {
        component: 'business-repository',
        operation: 'density-analysis',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find nearest businesses to a point
   */
  async findNearestBusinesses(
    lat: number,
    lng: number,
    limit: number = 5,
    category?: string
  ): Promise<(Business & { distance: number })[]> {
    const startTime = process.hrtime.bigint();

    try {
      let categoryFilter = '';
      const params: any[] = [lat, lng, limit];

      if (category) {
        categoryFilter = 'AND $4 = ANY(categories)';
        params.push(category);
      }

      const query = `
        SELECT *,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                 location_point::geography
               ) / 1000.0 AS distance_km
        FROM businesses
        WHERE is_active = true
          AND location_point IS NOT NULL
          ${categoryFilter}
        ORDER BY location_point <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
        LIMIT $3
      `;

      const result = await this.query(query, params);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      this.logQueryPerformance('findNearestBusinesses', executionTimeMs, {
        lat,
        lng,
        limit,
        category,
        resultsCount: result.rows.length,
      });

      return result.rows.map(row => ({
        ...row,
        distance: parseFloat(row.distance_km),
      }));
    } catch (error) {
      logger.error('Find nearest businesses error', {
        component: 'business-repository',
        operation: 'find-nearest',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Log query performance for monitoring
   */
  private logQueryPerformance(queryType: string, executionTimeMs: number, metadata: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      queryType,
      executionTimeMs: Math.round(executionTimeMs * 100) / 100,
      metadata,
      performanceLevel:
        executionTimeMs < 50
          ? 'excellent'
          : executionTimeMs < 200
            ? 'good'
            : executionTimeMs < 500
              ? 'acceptable'
              : 'poor',
    };

    logger.performance('Query Performance', {
      component: 'business-repository',
      operation: logEntry.operation,
      duration: logEntry.executionTimeMs,
      query: logEntry.query,
      timestamp: logEntry.timestamp,
    });

    // Could also send to metrics service like DataDog, New Relic, etc.
    // metricsService.recordQueryPerformance(logEntry);
  }

  /**
   * Update business information
   */
  async updateBusiness(businessId: string, updates: Partial<Business>): Promise<Business | null> {
    const updateFields: string[] = [];
    const values: any[] = [businessId];
    let paramIndex = 2;

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'owner_id' && key !== 'created_at' && key !== 'updated_at') {
        if (typeof value === 'object' && value !== null) {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return this.findById(businessId);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE businesses 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Get businesses by category with enhanced filtering
   */
  async findByCategory(
    category: string | string[], 
    limit: number = 10,
    options?: {
      includeSubcategories?: boolean;
      sortBy?: 'created_at' | 'rating' | 'popularity';
      location?: { lat: number; lng: number; radius?: number };
    }
  ): Promise<Business[]> {
    const startTime = process.hrtime.bigint();

    try {
      // Expand categories for hierarchical filtering
      const categories = Array.isArray(category) ? category : [category];
      const expandedCategories = expandCategoryFilter({
        categories,
        includeSubcategories: options?.includeSubcategories ?? true
      });

      // Build query with optional location filtering
      let locationFilter = '';
      let orderBy = 'created_at DESC';
      const params: any[] = [expandedCategories, limit];
      let paramIndex = 3;

      if (options?.location) {
        locationFilter = `
          AND location_point IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
            location_point::geography,
            $${paramIndex + 2} * 1000
          )
        `;
        params.push(options.location.lng, options.location.lat, options.location.radius || 25);
        paramIndex += 3;
      }

      // Dynamic ordering
      if (options?.sortBy === 'rating') {
        orderBy = '(SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id) DESC NULLS LAST, created_at DESC';
      } else if (options?.sortBy === 'popularity') {
        orderBy = '(SELECT COUNT(*) FROM reviews WHERE business_id = businesses.id) DESC, created_at DESC';
      }

      if (options?.location && options.sortBy !== 'rating' && options.sortBy !== 'popularity') {
        orderBy = `location_point <-> ST_SetSRID(ST_MakePoint($${paramIndex - 2}, $${paramIndex - 1}), 4326), created_at DESC`;
      }

      const query = `
        SELECT businesses.*, 
               ${options?.location ? `
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($${paramIndex - 2}, $${paramIndex - 1}), 4326)::geography,
                 location_point::geography
               ) / 1000.0 AS distance_km,
               ` : ''}
               COALESCE(
                 (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = businesses.id), 
                 4.0
               )::numeric(3,2) as avg_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.business_id = businesses.id) as review_count
        FROM businesses 
        WHERE categories && $1 AND is_active = true
        ${locationFilter}
        ORDER BY ${orderBy}
        LIMIT $2
      `;

      const result = await this.query(query, params);
      const businesses = result.rows.map(row => ({
        ...row,
        distance: row.distance_km ? parseFloat(row.distance_km) : undefined,
        averageRating: parseFloat(row.avg_rating),
        reviewCount: parseInt(row.review_count)
      }));

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      // Track category interactions
      for (const cat of expandedCategories) {
        categoryService.trackCategoryInteraction(cat, 'search', {
          location: options?.location,
        }).catch(error => 
          logger.error('Category tracking error', { category: cat, error })
        );
      }

      this.logQueryPerformance('findByCategory', executionTimeMs, {
        categories: expandedCategories,
        options,
        resultsCount: businesses.length,
      });

      return businesses;
    } catch (error) {
      logger.error('Find by category error', {
        component: 'business-repository',
        operation: 'find-by-category',
        category,
        options,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all unique categories with business counts and metadata
   */
  async getCategories(includeSubcategories: boolean = false): Promise<{
    category: string;
    businessCount: number;
    averageRating: number;
    isSubcategory: boolean;
  }[]> {
    const startTime = process.hrtime.bigint();

    try {
      const query = `
        WITH category_stats AS (
          SELECT 
            unnest(categories) as category,
            COUNT(*) as business_count,
            AVG(COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id), 4.0)) as avg_rating
          FROM businesses 
          WHERE is_active = true
          GROUP BY category
        )
        SELECT 
          category,
          business_count::int,
          ROUND(avg_rating::numeric, 2) as avg_rating
        FROM category_stats
        WHERE business_count > 0
        ORDER BY business_count DESC, category
      `;

      const result = await this.query(query);
      const categories = result.rows.map(row => ({
        category: row.category,
        businessCount: parseInt(row.business_count),
        averageRating: parseFloat(row.avg_rating),
        isSubcategory: !getAllCategories().includes(row.category)
      }));

      // Filter subcategories if not requested
      const filteredCategories = includeSubcategories 
        ? categories 
        : categories.filter(cat => !cat.isSubcategory);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      this.logQueryPerformance('getCategories', executionTimeMs, {
        includeSubcategories,
        categoriesFound: filteredCategories.length,
      });

      return filteredCategories;
    } catch (error) {
      logger.error('Get categories error', {
        component: 'business-repository',
        operation: 'get-categories',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get business statistics for owner
   */
  async getBusinessStats(businessId: string): Promise<{
    totalViews: number;
    totalBookings: number;
    averageRating: number;
    totalReviews: number;
  }> {
    const query = `
      SELECT 
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_reviews,
        COUNT(DISTINCT b.id) as total_bookings
      FROM businesses bus
      LEFT JOIN reviews r ON bus.id = r.business_id
      LEFT JOIN bookings b ON bus.id = b.business_id
      WHERE bus.id = $1
      GROUP BY bus.id
    `;

    const result = await this.query(query, [businessId]);
    const stats = result.rows[0] || {
      average_rating: 0,
      total_reviews: 0,
      total_bookings: 0,
    };

    return {
      totalViews: 0, // This would need to be tracked separately
      totalBookings: parseInt(stats.total_bookings),
      averageRating: parseFloat(stats.average_rating),
      totalReviews: parseInt(stats.total_reviews),
    };
  }

  /**
   * Advanced business search with complex filter combinations
   */
  async searchBusinessesAdvanced(filters: AdvancedFilters): Promise<{
    businesses: Business[];
    totalCount: number;
    appliedFilters: string[];
    metadata: {
      searchTime: number;
      filterValidation: any;
      queryComplexity: 'simple' | 'moderate' | 'complex';
      cacheHit: boolean;
    };
  }> {
    const startTime = process.hrtime.bigint();

    try {
      // Validate and normalize filters
      const validation = filterStateService.validateFilters(filters);
      if (!validation.isValid) {
        throw new Error(`Filter validation failed: ${validation.conflicts.map(c => c.message).join(', ')}`);
      }

      const normalizedFilters = validation.normalizedFilters;
      const whereConditions: string[] = ['businesses.is_active = true'];
      const params: any[] = [];
      let paramIndex = 1;
      let joins: string[] = [];
      let selectFields = `
        businesses.*,
        COALESCE(
          (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = businesses.id), 
          4.0
        )::numeric(3,2) as avg_rating,
        (SELECT COUNT(*) FROM reviews r WHERE r.business_id = businesses.id) as review_count
      `;

      // Location filtering with distance calculation
      if (normalizedFilters.location) {
        const { lat, lng, radius = 25 } = normalizedFilters.location;
        
        whereConditions.push(`
          businesses.location_point IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
            businesses.location_point::geography,
            $${paramIndex + 2} * 1000
          )
        `);
        
        selectFields += `,
          ST_Distance(
            ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
            businesses.location_point::geography
          ) / 1000.0 AS distance_km
        `;
        
        params.push(lng, lat, radius);
        paramIndex += 3;
      }

      // Category filtering with hierarchical support
      if (normalizedFilters.categories && normalizedFilters.categories.length > 0) {
        const expandedCategories = expandCategoryFilter({
          categories: normalizedFilters.categories,
          includeSubcategories: normalizedFilters.includeSubcategories ?? true
        });
        
        whereConditions.push(`businesses.categories && $${paramIndex}`);
        params.push(expandedCategories);
        paramIndex++;
      }

      // Text search with ranking
      if (normalizedFilters.search) {
        const searchTerms = normalizedFilters.search.trim().split(/\s+/);
        const searchConditions = searchTerms.map(term => {
          const condition = `(
            businesses.name ILIKE $${paramIndex} OR 
            businesses.description ILIKE $${paramIndex} OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(businesses.services) AS service_name
              WHERE service_name ILIKE $${paramIndex}
            )
          )`;
          params.push(`%${term}%`);
          paramIndex++;
          return condition;
        });
        
        whereConditions.push(`(${searchConditions.join(' AND ')})`);
        
        // Add text search ranking
        selectFields += `,
          CASE 
            WHEN businesses.name ILIKE $${paramIndex} THEN 3
            WHEN businesses.description ILIKE $${paramIndex} THEN 2
            ELSE 1
          END as search_rank
        `;
        params.push(`%${normalizedFilters.search}%`);
        paramIndex++;
      }

      // Price range filtering
      if (normalizedFilters.priceRange) {
        const { min, max } = normalizedFilters.priceRange;
        
        if (min !== undefined || max !== undefined) {
          // Get average service price
          const priceConditions: string[] = [];
          
          if (min !== undefined) {
            priceConditions.push(`(
              SELECT AVG((service->>'price')::numeric) 
              FROM jsonb_array_elements(businesses.services) AS service
              WHERE service->>'price' IS NOT NULL
            ) >= $${paramIndex}`);
            params.push(min);
            paramIndex++;
          }
          
          if (max !== undefined) {
            priceConditions.push(`(
              SELECT AVG((service->>'price')::numeric) 
              FROM jsonb_array_elements(businesses.services) AS service
              WHERE service->>'price' IS NOT NULL
            ) <= $${paramIndex}`);
            params.push(max);
            paramIndex++;
          }
          
          if (priceConditions.length > 0) {
            whereConditions.push(`(${priceConditions.join(' AND ')})`);
          }
        }
      }

      // Rating filtering
      if (normalizedFilters.minRating !== undefined) {
        whereConditions.push(`
          COALESCE(
            (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = businesses.id), 
            4.0
          ) >= $${paramIndex}
        `);
        params.push(normalizedFilters.minRating);
        paramIndex++;
      }

      // Review count filtering
      if (normalizedFilters.minReviewCount !== undefined && normalizedFilters.minReviewCount > 0) {
        whereConditions.push(`
          (SELECT COUNT(*) FROM reviews r WHERE r.business_id = businesses.id) >= $${paramIndex}
        `);
        params.push(normalizedFilters.minReviewCount);
        paramIndex++;
      }

      // Business hours filtering
      if (normalizedFilters.businessHours) {
        if (normalizedFilters.businessHours.openNow) {
          // Check if business is currently open
          const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
          const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
          
          whereConditions.push(`
            businesses.hours ? $${paramIndex}
            AND NOT COALESCE((businesses.hours->$${paramIndex}->>'closed')::boolean, false)
            AND businesses.hours->$${paramIndex}->>'open' IS NOT NULL
            AND businesses.hours->$${paramIndex}->>'close' IS NOT NULL
            AND (
              (businesses.hours->$${paramIndex}->>'open' <= $${paramIndex + 1} 
               AND businesses.hours->$${paramIndex}->>'close' >= $${paramIndex + 1})
              OR
              (businesses.hours->$${paramIndex}->>'close' < businesses.hours->$${paramIndex}->>'open'
               AND (businesses.hours->$${paramIndex}->>'open' <= $${paramIndex + 1}
                    OR businesses.hours->$${paramIndex}->>'close' >= $${paramIndex + 1}))
            )
          `);
          params.push(currentDay, currentTime);
          paramIndex += 2;
        }
        
        if (normalizedFilters.businessHours.is24x7) {
          // Check if business is open 24/7
          whereConditions.push(`
            EXISTS (
              SELECT 1 FROM jsonb_each(businesses.hours) AS day_hours(day, hours)
              WHERE (hours->>'open' = '00:00' AND hours->>'close' = '23:59')
              OR (hours->>'open' = '00:00' AND hours->>'close' = '00:00')
            )
          `);
        }
        
        if (normalizedFilters.businessHours.specificHours) {
          const { day, startTime, endTime } = normalizedFilters.businessHours.specificHours;
          whereConditions.push(`
            businesses.hours ? $${paramIndex}
            AND NOT COALESCE((businesses.hours->$${paramIndex}->>'closed')::boolean, false)
            AND businesses.hours->$${paramIndex}->>'open' <= $${paramIndex + 1}
            AND businesses.hours->$${paramIndex}->>'close' >= $${paramIndex + 2}
          `);
          params.push(day.toLowerCase(), startTime, endTime);
          paramIndex += 3;
        }
      }

      // Maximum distance filtering (additional to location radius)
      if (normalizedFilters.maxDistance !== undefined && normalizedFilters.location) {
        // This is handled in the location filtering above, but we can add a stricter filter
        whereConditions.push(`
          ST_Distance(
            ST_SetSRID(ST_MakePoint($${normalizedFilters.location.lng}, $${normalizedFilters.location.lat}), 4326)::geography,
            businesses.location_point::geography
          ) / 1000.0 <= $${paramIndex}
        `);
        params.push(normalizedFilters.maxDistance);
        paramIndex++;
      }

      // Photo availability filtering
      if (normalizedFilters.hasPhotos) {
        whereConditions.push(`
          businesses.media IS NOT NULL 
          AND jsonb_array_length(businesses.media) > 0
        `);
      }

      // Recently added filtering (within last 30 days)
      if (normalizedFilters.recentlyAdded) {
        whereConditions.push(`businesses.created_at >= NOW() - INTERVAL '30 days'`);
      }

      // Verified businesses filtering
      if (normalizedFilters.verifiedOnly) {
        whereConditions.push(`businesses.verified = true`);
      }

      // Build ORDER BY clause
      let orderBy = 'businesses.created_at DESC';
      
      if (normalizedFilters.sortBy) {
        switch (normalizedFilters.sortBy) {
          case 'distance':
            if (normalizedFilters.location) {
              orderBy = 'distance_km ASC, businesses.created_at DESC';
            }
            break;
          case 'rating':
            orderBy = 'avg_rating DESC, review_count DESC, businesses.created_at DESC';
            break;
          case 'price':
            orderBy = `(
              SELECT AVG((service->>'price')::numeric) 
              FROM jsonb_array_elements(businesses.services) AS service
              WHERE service->>'price' IS NOT NULL
            ) ${normalizedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC'}, businesses.created_at DESC`;
            break;
          case 'newest':
            orderBy = 'businesses.created_at DESC';
            break;
          case 'popularity':
            orderBy = 'review_count DESC, avg_rating DESC, businesses.created_at DESC';
            break;
          case 'reviewCount':
            orderBy = 'review_count DESC, avg_rating DESC, businesses.created_at DESC';
            break;
        }
      }

      // Add search ranking to order if text search is present
      if (normalizedFilters.search && normalizedFilters.sortBy !== 'distance') {
        orderBy = 'search_rank DESC, ' + orderBy;
      }

      // Pagination
      const page = normalizedFilters.page || 1;
      const limit = Math.min(normalizedFilters.limit || 10, 100);
      const offset = (page - 1) * limit;

      // Build final queries
      const baseQuery = `
        FROM businesses
        ${joins.length > 0 ? joins.join(' ') : ''}
        WHERE ${whereConditions.join(' AND ')}
      `;

      const businessQuery = `
        SELECT ${selectFields}
        ${baseQuery}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const countQuery = `
        SELECT COUNT(DISTINCT businesses.id) as total_count
        ${baseQuery}
      `;
      const countParams = params.slice(0, -2); // Remove limit and offset

      // Execute queries in parallel
      const [businessResult, countResult] = await Promise.all([
        this.query(businessQuery, params),
        this.query(countQuery, countParams),
      ]);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      // Determine query complexity
      const complexityScore = 
        (normalizedFilters.location ? 1 : 0) +
        (normalizedFilters.categories?.length || 0) +
        (normalizedFilters.search ? 2 : 0) +
        (normalizedFilters.priceRange ? 1 : 0) +
        (normalizedFilters.minRating ? 1 : 0) +
        (normalizedFilters.businessHours ? 2 : 0) +
        (normalizedFilters.hasPhotos ? 1 : 0) +
        (normalizedFilters.verifiedOnly ? 1 : 0);

      const queryComplexity = 
        complexityScore <= 2 ? 'simple' :
        complexityScore <= 5 ? 'moderate' : 'complex';

      // Track category interactions
      if (normalizedFilters.categories) {
        for (const category of normalizedFilters.categories) {
          categoryService.trackCategoryInteraction(category, 'search', {
            location: normalizedFilters.location,
            searchQuery: normalizedFilters.search,
          }).catch(error => 
            logger.error('Category tracking error', { category, error })
          );
        }
      }

      // Log performance metrics
      this.logQueryPerformance('searchBusinessesAdvanced', executionTimeMs, {
        filters: normalizedFilters,
        resultsCount: businessResult.rows.length,
        totalCount: parseInt(countResult.rows[0].total_count),
        queryComplexity,
      });

      // Performance warning for complex queries
      if (executionTimeMs > 500) {
        logger.performance('Advanced search performance warning', {
          component: 'business-repository',
          operation: 'advanced-search',
          duration: executionTimeMs,
          queryComplexity,
          filterCount: Object.keys(normalizedFilters).length,
          resultCount: businessResult.rows.length,
        });
      }

      return {
        businesses: businessResult.rows.map(row => ({
          ...row,
          distance: row.distance_km ? parseFloat(row.distance_km) : undefined,
          averageRating: parseFloat(row.avg_rating),
          reviewCount: parseInt(row.review_count),
          searchRank: row.search_rank ? parseInt(row.search_rank) : undefined,
        })),
        totalCount: parseInt(countResult.rows[0].total_count),
        appliedFilters: validation.appliedFilters,
        metadata: {
          searchTime: Math.round(executionTimeMs * 100) / 100,
          filterValidation: validation,
          queryComplexity,
          cacheHit: false, // TODO: Implement caching
        },
      };

    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      logger.error('Advanced business search error', {
        component: 'business-repository',
        operation: 'advanced-search',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        filters,
      });

      throw error;
    }
  }

  /**
   * Check if user owns business
   */
  async isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM businesses WHERE id = $1 AND owner_id = $2';
    const result = await this.query(query, [businessId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Deactivate business (soft delete)
   */
  async deactivateBusiness(businessId: string): Promise<boolean> {
    const query = `
      UPDATE businesses 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    const result = await this.query(query, [businessId]);
    return result.rowCount > 0;
  }
}
