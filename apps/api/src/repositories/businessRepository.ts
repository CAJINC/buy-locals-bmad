import { BaseRepository } from './BaseRepository.js';
import { Business, CreateBusinessRequest, BusinessSearchQuery } from '../types/Business.js';

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
   * Search businesses with location-based filtering
   */
  async searchBusinesses(searchQuery: BusinessSearchQuery): Promise<{
    businesses: Business[];
    totalCount: number;
  }> {
    const { lat, lng, radius = 25, category, search, page = 1, limit = 10 } = searchQuery;
    const offset = (page - 1) * limit;

    let whereConditions: string[] = ['is_active = true'];
    let params: any[] = [];
    let paramIndex = 1;

    // Location-based search using distance calculation
    let selectFields = '*';
    let orderBy = 'created_at DESC';

    if (lat && lng) {
      // Calculate distance using Haversine formula
      selectFields = `
        *,
        (6371 * acos(
          cos(radians($${paramIndex})) * 
          cos(radians((location->>'coordinates'->>'lat')::float)) * 
          cos(radians((location->>'coordinates'->>'lng')::float) - radians($${paramIndex + 1})) + 
          sin(radians($${paramIndex})) * 
          sin(radians((location->>'coordinates'->>'lat')::float))
        )) AS distance
      `;
      params.push(lat, lng);
      paramIndex += 2;

      // Filter by radius
      whereConditions.push(`
        (6371 * acos(
          cos(radians($${paramIndex})) * 
          cos(radians((location->>'coordinates'->>'lat')::float)) * 
          cos(radians((location->>'coordinates'->>'lng')::float) - radians($${paramIndex + 1})) + 
          sin(radians($${paramIndex})) * 
          sin(radians((location->>'coordinates'->>'lat')::float))
        )) <= $${paramIndex + 2}
      `);
      params.push(lat, lng, radius);
      paramIndex += 3;

      orderBy = 'distance ASC, created_at DESC';
    }

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
      SELECT ${selectFields}
      FROM businesses 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    // Count query for pagination
    let countQuery = `
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