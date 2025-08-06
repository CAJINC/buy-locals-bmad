import { BaseRepository } from '../repositories/BaseRepository.js';
import { logger } from '../utils/logger.js';
import { Business } from '../types/Business.js';

interface BusinessStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'unknown';
  reason?: string;
  nextChange: Date | null;
}

interface SpecialHours {
  id?: string;
  businessId: string;
  date: string;
  openTime?: string;
  closeTime?: string;
  isClosed: boolean;
  reason: string;
  note?: string;
}

interface TemporaryClosure {
  id?: string;
  businessId: string;
  startDate: string;
  endDate: string;
  reason: string;
  note?: string;
}

interface BusinessHoursUpdate {
  timezone?: string;
  hours?: Business['hours'];
  specialHours?: SpecialHours[];
  temporaryClosures?: TemporaryClosure[];
}

/**
 * Business Hours Service for Story 2.4 Phase 1
 * Handles timezone-aware business hours calculation and management
 * BMAD Implementation: Core service for real-time status calculation
 */
export class BusinessHoursService extends BaseRepository<any> {
  constructor() {
    super('businesses');
  }

  /**
   * Get current business status with timezone support
   * Performance target: <100ms response time
   */
  async getBusinessStatus(businessId: string, currentTime?: Date): Promise<BusinessStatus> {
    const startTime = process.hrtime.bigint();
    
    try {
      const timestamp = currentTime || new Date();
      
      const query = `
        SELECT is_open, status, reason, next_change
        FROM calculate_business_status($1, $2)
      `;
      
      const result = await this.query(query, [businessId, timestamp.toISOString()]);
      
      if (result.rows.length === 0) {
        throw new Error(`Business not found: ${businessId}`);
      }
      
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      // Log performance warning if over target
      if (executionTimeMs > 100) {
        logger.performance('Business status query performance warning', {
          component: 'business-hours-service',
          operation: 'get-business-status',
          duration: executionTimeMs,
          businessId,
        });
      }
      
      const row = result.rows[0];
      return {
        isOpen: row.is_open,
        status: row.status as 'open' | 'closed' | 'unknown',
        reason: row.reason,
        nextChange: row.next_change ? new Date(row.next_change) : null,
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      logger.error('Business status calculation error', {
        component: 'business-hours-service',
        operation: 'get-business-status',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        businessId,
      });
      
      return {
        isOpen: false,
        status: 'unknown',
        reason: 'Unable to determine status',
        nextChange: null,
      };
    }
  }

  /**
   * Get all currently open businesses with location filtering
   * Used by Story 2.3 "Open Now" filter integration
   */
  async getOpenBusinesses(
    latitude?: number,
    longitude?: number,
    radiusKm: number = 25,
    categories?: string[],
    searchTerm?: string,
    limit: number = 50
  ): Promise<(Business & { distance?: number; isOpen: boolean; status: string })[]> {
    const startTime = process.hrtime.bigint();
    
    try {
      const query = `
        SELECT *
        FROM get_open_businesses($1, $2, $3, $4, $5, $6)
      `;
      
      const result = await this.query(query, [
        latitude,
        longitude,
        radiusKm,
        categories,
        searchTerm,
        limit,
      ]);
      
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      // Log performance metrics
      this.logQueryPerformance('getOpenBusinesses', executionTimeMs, {
        latitude,
        longitude,
        radiusKm,
        categories,
        searchTerm,
        resultsCount: result.rows.length,
      });
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        location: row.location,
        categories: row.categories,
        hours: row.hours,
        contact: row.contact,
        timezone: row.timezone,
        isActive: row.is_active,
        distance: row.distance_km,
        isOpen: row.is_open,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      logger.error('Get open businesses error', {
        component: 'business-hours-service',
        operation: 'get-open-businesses',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        parameters: { latitude, longitude, radiusKm, categories, searchTerm, limit },
      });
      
      throw error;
    }
  }

  /**
   * Update business hours and timezone
   * For business owner management interface
   */
  async updateBusinessHours(
    businessId: string,
    ownerId: string,
    updates: BusinessHoursUpdate
  ): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      await this.query('BEGIN', []);
      
      // Verify ownership
      const ownershipCheck = await this.query(
        'SELECT owner_id FROM businesses WHERE id = $1',
        [businessId]
      );
      
      if (ownershipCheck.rows.length === 0) {
        throw new Error('Business not found');
      }
      
      if (ownershipCheck.rows[0].owner_id !== ownerId) {
        throw new Error('Unauthorized: Not business owner');
      }
      
      // Update business timezone and regular hours
      if (updates.timezone || updates.hours) {
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        if (updates.timezone) {
          updateFields.push(`timezone = $${paramIndex}`);
          updateValues.push(updates.timezone);
          paramIndex++;
        }
        
        if (updates.hours) {
          updateFields.push(`hours = $${paramIndex}`);
          updateValues.push(JSON.stringify(updates.hours));
          paramIndex++;
        }
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(businessId);
        
        const updateQuery = `
          UPDATE businesses 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `;
        
        await this.query(updateQuery, updateValues);
      }
      
      // Handle special hours updates
      if (updates.specialHours) {
        // Delete existing special hours for this business
        await this.query(
          'DELETE FROM special_hours WHERE business_id = $1',
          [businessId]
        );
        
        // Insert new special hours
        for (const specialHour of updates.specialHours) {
          await this.query(
            `INSERT INTO special_hours 
             (business_id, date, open_time, close_time, is_closed, reason, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              businessId,
              specialHour.date,
              specialHour.openTime || null,
              specialHour.closeTime || null,
              specialHour.isClosed,
              specialHour.reason,
              specialHour.note || null,
            ]
          );
        }
      }
      
      // Handle temporary closures updates
      if (updates.temporaryClosures) {
        // Delete existing temporary closures for this business
        await this.query(
          'DELETE FROM temporary_closures WHERE business_id = $1',
          [businessId]
        );
        
        // Insert new temporary closures
        for (const closure of updates.temporaryClosures) {
          await this.query(
            `INSERT INTO temporary_closures 
             (business_id, start_date, end_date, reason, note)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              businessId,
              closure.startDate,
              closure.endDate,
              closure.reason,
              closure.note || null,
            ]
          );
        }
      }
      
      await this.query('COMMIT', []);
      
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      logger.info('Business hours updated successfully', {
        component: 'business-hours-service',
        operation: 'update-business-hours',
        executionTimeMs,
        businessId,
        ownerId,
        hasSpecialHours: !!updates.specialHours,
        hasTemporaryClosures: !!updates.temporaryClosures,
      });
    } catch (error) {
      await this.query('ROLLBACK', []);
      
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      logger.error('Update business hours error', {
        component: 'business-hours-service',
        operation: 'update-business-hours',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        businessId,
        ownerId,
      });
      
      throw error;
    }
  }

  /**
   * Get business hours with special hours and temporary closures
   */
  async getBusinessHours(businessId: string): Promise<{
    business: Pick<Business, 'id' | 'name' | 'hours' | 'timezone'>;
    specialHours: SpecialHours[];
    temporaryClosures: TemporaryClosure[];
  }> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Get business basic info
      const businessQuery = `
        SELECT id, name, hours, timezone
        FROM businesses
        WHERE id = $1 AND is_active = true
      `;
      
      // Get special hours
      const specialHoursQuery = `
        SELECT id, business_id, date, open_time, close_time, is_closed, reason, note
        FROM special_hours
        WHERE business_id = $1
        ORDER BY date
      `;
      
      // Get temporary closures
      const temporaryClosuresQuery = `
        SELECT id, business_id, start_date, end_date, reason, note
        FROM temporary_closures
        WHERE business_id = $1
        ORDER BY start_date
      `;
      
      const [businessResult, specialHoursResult, temporaryClosuresResult] = await Promise.all([
        this.query(businessQuery, [businessId]),
        this.query(specialHoursQuery, [businessId]),
        this.query(temporaryClosuresQuery, [businessId]),
      ]);
      
      if (businessResult.rows.length === 0) {
        throw new Error(`Business not found: ${businessId}`);
      }
      
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      this.logQueryPerformance('getBusinessHours', executionTimeMs, {
        businessId,
        specialHoursCount: specialHoursResult.rows.length,
        temporaryClosuresCount: temporaryClosuresResult.rows.length,
      });
      
      return {
        business: {
          id: businessResult.rows[0].id,
          name: businessResult.rows[0].name,
          hours: businessResult.rows[0].hours,
          timezone: businessResult.rows[0].timezone,
        },
        specialHours: specialHoursResult.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          date: row.date,
          openTime: row.open_time,
          closeTime: row.close_time,
          isClosed: row.is_closed,
          reason: row.reason,
          note: row.note,
        })),
        temporaryClosures: temporaryClosuresResult.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          startDate: row.start_date,
          endDate: row.end_date,
          reason: row.reason,
          note: row.note,
        })),
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      logger.error('Get business hours error', {
        component: 'business-hours-service',
        operation: 'get-business-hours',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        businessId,
      });
      
      throw error;
    }
  }

  /**
   * Performance logging helper
   */
  private logQueryPerformance(
    operation: string,
    executionTimeMs: number,
    metadata: Record<string, any>
  ): void {
    if (executionTimeMs > 100) {
      logger.performance(`Business hours ${operation} performance warning`, {
        component: 'business-hours-service',
        operation,
        duration: executionTimeMs,
        ...metadata,
      });
    } else {
      logger.debug(`Business hours ${operation} completed`, {
        component: 'business-hours-service',
        operation,
        duration: executionTimeMs,
        ...metadata,
      });
    }
  }
}

// Export singleton instance
export const businessHoursService = new BusinessHoursService();
