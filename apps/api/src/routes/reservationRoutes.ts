import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ReservationService } from '../services/reservationService';
import { inventoryService } from '../services/inventoryService';
import { reservationModificationService } from '../services/reservationModificationService';
import { reservationExpirationService } from '../services/reservationExpirationService';
import { logger } from '../utils/logger';
import type {
  CreateReservationInput,
  ModificationRequest,
  ReservationFilters
} from '../types/Reservation';

const router = Router();
const reservationService = new ReservationService();

// Validation middleware
const validateReservationCreation = [
  body('businessId').isUUID().withMessage('Valid business ID required'),
  body('type').isIn(['service', 'product', 'table', 'consultation', 'event']).withMessage('Valid reservation type required'),
  body('scheduledAt').isISO8601().withMessage('Valid scheduled date/time required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be positive integer'),
  body('customerInfo.name').trim().isLength({ min: 1 }).withMessage('Customer name required'),
  body('customerInfo.phone').isMobilePhone().withMessage('Valid phone number required'),
  body('customerInfo.email').isEmail().withMessage('Valid email required'),
  body('totalAmount').isNumeric().withMessage('Total amount must be numeric'),
  body('items').optional().isArray().withMessage('Items must be array if provided'),
  body('holdDuration').optional().isInt({ min: 1, max: 1440 }).withMessage('Hold duration must be 1-1440 minutes')
];

const validateReservationModification = [
  param('id').isUUID().withMessage('Valid reservation ID required'),
  body('changes').isObject().withMessage('Changes object required'),
  body('reason').optional().isString().withMessage('Reason must be string'),
  body('requestedBy').isUUID().withMessage('Valid requester ID required')
];

const validateBusinessInventory = [
  param('id').isUUID().withMessage('Valid business ID required'),
  query('productIds').optional().isString().withMessage('Product IDs must be comma-separated string')
];

// POST /reservations - Create new reservation
router.post('/reservations', validateReservationCreation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservationData: CreateReservationInput = req.body;

    // Check inventory availability if items are included
    if (reservationData.items && reservationData.items.length > 0) {
      const isAvailable = await inventoryService.checkAvailability(reservationData.items);
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'Insufficient inventory for requested items',
          code: 'INSUFFICIENT_INVENTORY'
        });
      }
    }

    const reservation = await reservationService.createReservation(reservationData);

    logger.info('Reservation created successfully', {
      reservationId: reservation.id,
      businessId: reservationData.businessId,
      type: reservationData.type
    });

    res.status(201).json({
      success: true,
      data: reservation,
      message: 'Reservation created successfully'
    });
  } catch (error) {
    logger.error('Error creating reservation', { error, body: req.body });
    
    if (error instanceof Error && error.message.includes('Insufficient inventory')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: 'INSUFFICIENT_INVENTORY'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create reservation',
      code: 'RESERVATION_CREATION_FAILED'
    });
  }
});

// GET /businesses/:id/inventory - Get business inventory status
router.get('/businesses/:id/inventory', validateBusinessInventory, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const businessId = req.params.id;
    const productIds = req.query.productIds as string;

    let inventory;
    
    if (productIds) {
      const productIdArray = productIds.split(',').filter(id => id.trim());
      inventory = await Promise.all(
        productIdArray.map(productId => inventoryService.getInventory(productId))
      );
      inventory = inventory.filter(item => item !== null);
    } else {
      // Get low stock alerts for business overview
      inventory = await inventoryService.getLowStockAlerts(businessId);
    }

    res.json({
      success: true,
      data: inventory,
      message: 'Inventory retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving business inventory', { error, businessId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory',
      code: 'INVENTORY_RETRIEVAL_FAILED'
    });
  }
});

// PUT /reservations/:id/modify - Modify existing reservation
router.put('/reservations/:id/modify', validateReservationModification, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservationId = req.params.id;
    const modificationRequest: ModificationRequest = {
      reservationId,
      changes: req.body.changes,
      reason: req.body.reason,
      requestedBy: req.body.requestedBy
    };

    const result = await reservationModificationService.requestModification(modificationRequest);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason || 'Modification not allowed',
        code: 'MODIFICATION_NOT_ALLOWED'
      });
    }

    logger.info('Reservation modification processed', {
      reservationId,
      requestedBy: modificationRequest.requestedBy,
      changes: modificationRequest.changes
    });

    res.json({
      success: true,
      data: result,
      message: 'Reservation modification processed successfully'
    });
  } catch (error) {
    logger.error('Error modifying reservation', { error, reservationId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to modify reservation',
      code: 'RESERVATION_MODIFICATION_FAILED'
    });
  }
});

// DELETE /reservations/:id/cancel - Cancel reservation
router.delete('/reservations/:id/cancel', [
  param('id').isUUID().withMessage('Valid reservation ID required'),
  body('reason').optional().isString().withMessage('Reason must be string'),
  body('cancelledBy').isUUID().withMessage('Valid canceller ID required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservationId = req.params.id;
    const { reason, cancelledBy } = req.body;

    const result = await reservationService.cancelReservation(reservationId, cancelledBy, reason);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Cannot cancel reservation',
        code: 'CANCELLATION_NOT_ALLOWED'
      });
    }

    logger.info('Reservation cancelled', {
      reservationId,
      cancelledBy,
      reason
    });

    res.json({
      success: true,
      data: result,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling reservation', { error, reservationId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel reservation',
      code: 'RESERVATION_CANCELLATION_FAILED'
    });
  }
});

// GET /reservations/:id/extend - Extend reservation expiration
router.get('/reservations/:id/extend', [
  param('id').isUUID().withMessage('Valid reservation ID required'),
  query('additionalMinutes').isInt({ min: 1, max: 1440 }).withMessage('Additional minutes must be 1-1440')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservationId = req.params.id;
    const additionalMinutes = parseInt(req.query.additionalMinutes as string);

    const result = await reservationExpirationService.extendReservation(reservationId, additionalMinutes);

    if (!result) {
      return res.status(400).json({
        success: false,
        message: 'Cannot extend reservation',
        code: 'EXTENSION_NOT_ALLOWED'
      });
    }

    logger.info('Reservation extended', {
      reservationId,
      additionalMinutes
    });

    res.json({
      success: true,
      data: { reservationId, additionalMinutes },
      message: 'Reservation extended successfully'
    });
  } catch (error) {
    logger.error('Error extending reservation', { error, reservationId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to extend reservation',
      code: 'RESERVATION_EXTENSION_FAILED'
    });
  }
});

// GET /reservations - Get reservations with filtering
router.get('/reservations', [
  query('businessId').optional().isUUID().withMessage('Business ID must be valid UUID'),
  query('customerId').optional().isUUID().withMessage('Customer ID must be valid UUID'),
  query('status').optional().isString().withMessage('Status must be string'),
  query('type').optional().isIn(['service', 'product', 'table', 'consultation', 'event']).withMessage('Valid reservation type required'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const filters: ReservationFilters = {
      status: req.query.status ? [req.query.status as string] : undefined,
      type: req.query.type ? [req.query.type as any] : undefined,
      dateRange: req.query.startDate && req.query.endDate ? 
        [new Date(req.query.startDate as string), new Date(req.query.endDate as string)] : undefined,
      customerId: req.query.customerId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      sortBy: 'scheduledAt',
      sortOrder: 'asc'
    };

    const businessId = req.query.businessId as string;
    const reservations = await reservationService.getReservations(businessId, filters);

    res.json({
      success: true,
      data: reservations,
      message: 'Reservations retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving reservations', { error, query: req.query });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reservations',
      code: 'RESERVATIONS_RETRIEVAL_FAILED'
    });
  }
});

export default router;