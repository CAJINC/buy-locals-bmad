import { BaseRepository } from './BaseRepository.js';
import { Business, BusinessSearchQuery, CreateBusinessRequest } from '../types/Business.js';

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
    const { lat, lng, radius = 25, category, search, page = 1, limit = 10 } = searchQuery;
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
   * PostGIS-optimized business search with sub-1-second performance
   */
  private async searchBusinessesPostGIS(searchQuery: BusinessSearchQuery): Promise<{
    businesses: Business[];
    totalCount: number;
  }> {
    const startTime = process.hrtime.bigint();
    const { lat, lng, radius = 25, category, search, page = 1, limit = 10 } = searchQuery;
    const offset = (page - 1) * limit;

    try {
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

      const categoryArray = category ? [category] : null;
      const searchParams = [
        lat,
        lng,
        radius,
        categoryArray,
        search || null,
        limit,
        offset,
      ];

      const countParams = searchParams.slice(0, 5); // Remove limit and offset

      // Execute queries in parallel for maximum performance
      const [businessResult, countResult] = await Promise.all([
        this.query(searchSql, searchParams),
        this.query(countSql, countParams),
      ]);

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      // Log performance metrics for monitoring
      this.logQueryPerformance('searchBusinessesPostGIS', executionTimeMs, {
        lat, lng, radius, category, search, resultsCount: businessResult.rows.length
      });

      // Alert if performance degrades
      if (executionTimeMs > 200) {
        console.warn('PostGIS query performance warning:', {
          executionTimeMs,
          query: searchQuery,
          resultCount: businessResult.rows.length
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
      
      console.error('PostGIS query error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        query: searchQuery
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
      const polygonString = polygon
        .map(point => `${point.lng} ${point.lat}`)
        .join(', ');
      
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
        resultsCount: result.rows.length
      });

      return result.rows;
    } catch (error) {
      console.error('Get businesses in area error:', error);
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
        centerLat, centerLng, radiusKm, totalBusinesses
      });

      return {
        totalBusinesses,
        densityPerKm2: Math.round(densityPerKm2 * 100) / 100,
        categoryBreakdown: row.category_breakdown || [],
        averageDistance: parseFloat(row.avg_distance) || 0
      };
    } catch (error) {
      console.error('Business density analysis error:', error);
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
        lat, lng, limit, category, resultsCount: result.rows.length
      });

      return result.rows.map(row => ({
        ...row,
        distance: parseFloat(row.distance_km)
      }));
    } catch (error) {
      console.error('Find nearest businesses error:', error);
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
      performanceLevel: executionTimeMs < 50 ? 'excellent' : 
                       executionTimeMs < 200 ? 'good' : 
                       executionTimeMs < 500 ? 'acceptable' : 'poor'
    };

    // In production, this would go to a proper logging service
    console.log('Query Performance:', JSON.stringify(logEntry));
    
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
   * Get businesses by category
   */
  async findByCategory(category: string, limit: number = 10): Promise<Business[]> {
    const query = `
      SELECT * FROM businesses 
      WHERE $1 = ANY(categories) AND is_active = true
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await this.query(query, [category, limit]);
    return result.rows;
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const query = `
      SELECT DISTINCT unnest(categories) as category 
      FROM businesses 
      WHERE is_active = true
      ORDER BY category
    `;
    const result = await this.query(query);
    return result.rows.map(row => row.category);
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