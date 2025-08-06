import express from 'express';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { createError } from '../middleware/errorHandler.js';

const router = express.Router();
const businessRepository = new BusinessRepository();

/**
 * Get current business status
 * GET /api/businesses/:id/status
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return next(createError('Business ID is required', 400));
    }

    const result = await businessRepository.query(`
      SELECT * FROM calculate_business_status($1)
    `, [id]);

    if (result.rows.length === 0) {
      return next(createError('Business not found', 404));
    }

    const status = result.rows[0];

    res.json({
      businessId: id,
      isOpen: status.is_open,
      status: status.status,
      reason: status.reason,
      nextChange: status.next_change,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(createError('Failed to get business status', 500, error));
  }
});

/**
 * Get currently open businesses in location
 * GET /api/businesses/open
 */
router.get('/open', async (req, res, next) => {
  try {
    const {
      lat,
      lng,
      radius = 25,
      category,
      search,
      limit = 50
    } = req.query;

    if (!lat || !lng) {
      return next(createError('Latitude and longitude are required', 400));
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusKm = parseFloat(radius as string);
    const resultLimit = Math.min(parseInt(limit as string) || 50, 100);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return next(createError('Invalid coordinates or radius', 400));
    }

    const categoryFilter = category ? [category] : null;
    const searchTerm = search as string || null;

    const result = await businessRepository.query(`
      SELECT * FROM get_open_businesses($1, $2, $3, $4, $5, $6)
    `, [latitude, longitude, radiusKm, categoryFilter, searchTerm, resultLimit]);

    const businesses = result.rows.map(row => ({
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
      nextChange: row.next_change,
    }));

    res.json({
      data: businesses,
      count: businesses.length,
      location: { lat: latitude, lng: longitude, radius: radiusKm },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(createError('Failed to get open businesses', 500, error));
  }
});

/**
 * Get batch business statuses
 * POST /api/businesses/status/batch
 */
router.post('/status/batch', async (req, res, next) => {
  try {
    const { businessIds } = req.body;

    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return next(createError('Business IDs array is required', 400));
    }

    if (businessIds.length > 50) {
      return next(createError('Maximum 50 business IDs allowed per batch', 400));
    }

    const promises = businessIds.map(async (businessId: string) => {
      try {
        const result = await businessRepository.query(`
          SELECT * FROM calculate_business_status($1)
        `, [businessId]);

        if (result.rows.length > 0) {
          const status = result.rows[0];
          return {
            businessId,
            isOpen: status.is_open,
            status: status.status,
            reason: status.reason,
            nextChange: status.next_change,
            timestamp: new Date().toISOString(),
          };
        }
        return null;
      } catch (error) {
        console.error(`Error getting status for business ${businessId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(result => result !== null);

    res.json({
      data: validResults,
      count: validResults.length,
      requested: businessIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(createError('Failed to get batch business statuses', 500, error));
  }
});

/**
 * Update special hours for a business
 * POST /api/businesses/:id/special-hours
 */
router.post('/:id/special-hours', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      date,
      openTime,
      closeTime,
      isClosed = false,
      reason,
      note
    } = req.body;

    if (!id || !date) {
      return next(createError('Business ID and date are required', 400));
    }

    // Validate date format
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return next(createError('Invalid date format', 400));
    }

    // Validate times if not closed
    if (!isClosed && (!openTime || !closeTime)) {
      return next(createError('Open time and close time required when not closed', 400));
    }

    await businessRepository.query(`
      INSERT INTO special_hours (business_id, date, open_time, close_time, is_closed, reason, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (business_id, date) 
      DO UPDATE SET
        open_time = EXCLUDED.open_time,
        close_time = EXCLUDED.close_time,
        is_closed = EXCLUDED.is_closed,
        reason = EXCLUDED.reason,
        note = EXCLUDED.note,
        updated_at = CURRENT_TIMESTAMP
    `, [id, date, openTime || null, closeTime || null, isClosed, reason || null, note || null]);

    res.json({
      success: true,
      message: 'Special hours updated successfully',
      businessId: id,
      date,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(createError('Failed to update special hours', 500, error));
  }
});

/**
 * Add temporary closure
 * POST /api/businesses/:id/temporary-closure
 */
router.post('/:id/temporary-closure', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      reason,
      note
    } = req.body;

    if (!id || !startDate || !endDate || !reason) {
      return next(createError('Business ID, start date, end date, and reason are required', 400));
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(createError('Invalid date format', 400));
    }

    if (end < start) {
      return next(createError('End date must be after start date', 400));
    }

    await businessRepository.query(`
      INSERT INTO temporary_closures (business_id, start_date, end_date, reason, note)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, startDate, endDate, reason, note || null]);

    res.json({
      success: true,
      message: 'Temporary closure added successfully',
      businessId: id,
      startDate,
      endDate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(createError('Failed to add temporary closure', 500, error));
  }
});

/**
 * Health check endpoint
 * GET /api/businesses/status/health
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection with a simple query
    const result = await businessRepository.query('SELECT 1 as health_check');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result.rows.length > 0 ? 'connected' : 'error',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;