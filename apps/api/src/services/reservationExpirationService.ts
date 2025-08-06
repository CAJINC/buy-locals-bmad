import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';
import { inventoryService } from './inventoryService';
import type { Reservation } from '../types/Reservation';

export interface ExpirationPolicy {
  id: string;
  businessId: string;
  name: string;
  defaultTTLMinutes: number;
  warningIntervals: number[]; // Minutes before expiry to send warnings
  gracePeriodMinutes: number;
  autoCleanup: boolean;
  notificationSettings: {
    sendWarnings: boolean;
    sendExpiredNotices: boolean;
    sendBusinessNotifications: boolean;
  };
  serviceTypeIds?: string[];
  isActive: boolean;
}

export interface ReservationTTL {
  reservationId: string;
  expiresAt: Date;
  warningsSent: number[];
  gracePeriodEndsAt?: Date;
  status: 'active' | 'warned' | 'expired' | 'cleaned';
}

export class ReservationExpirationService {
  // Redis connection would be properly initialized here
  // private readonly redis = redisClient;
  private readonly processInterval = 60000; // Check every minute
  private intervalHandle?: NodeJS.Timeout;

  /**
   * Initialize the expiration service with background processing
   */
  initialize(): void {
    this.startPeriodicProcessing();
    logger.info('Reservation expiration service initialized');
  }

  /**
   * Stop the expiration service
   */
  shutdown(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    logger.info('Reservation expiration service shutdown');
  }

  /**
   * Set TTL for a reservation
   */
  async setReservationTTL(
    reservationId: string,
    ttlMinutes?: number,
    businessId?: string
  ): Promise<void> {
    try {
      let ttl = ttlMinutes;
      
      if (!ttl && businessId) {
        const policy = await this.getExpirationPolicyByBusiness(businessId);
        ttl = policy?.defaultTTLMinutes || 30; // Default 30 minutes
      }

      if (!ttl) {
        ttl = 30; // Fallback default
      }

      const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
      
      // Store in database
      await db('reservation_ttl').insert({
        reservation_id: reservationId,
        expires_at: expiresAt,
        warnings_sent: JSON.stringify([]),
        status: 'active'
      }).onConflict('reservation_id').merge({
        expires_at: expiresAt,
        status: 'active',
        updated_at: new Date()
      });

      // Cache in Redis for quick lookup
      const cacheKey = `reservation_ttl:${reservationId}`;
      await this.redis?.setEx(cacheKey, ttl * 60, JSON.stringify({
        reservationId,
        expiresAt: expiresAt.toISOString(),
        status: 'active'
      }));

      logger.info('Reservation TTL set', {
        reservationId,
        ttlMinutes: ttl,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      logger.error('Error setting reservation TTL', { error, reservationId, ttlMinutes });
      throw new Error('Failed to set reservation TTL');
    }
  }

  /**
   * Extend reservation expiration time
   */
  async extendReservation(
    reservationId: string,
    additionalMinutes: number
  ): Promise<boolean> {
    try {
      const ttlRecord = await db('reservation_ttl')
        .where('reservation_id', reservationId)
        .first();

      if (!ttlRecord || ttlRecord.status === 'expired' || ttlRecord.status === 'cleaned') {
        logger.warn('Cannot extend expired or cleaned reservation', { reservationId });
        return false;
      }

      const currentExpiry = new Date(ttlRecord.expires_at);
      const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

      await db('reservation_ttl')
        .where('reservation_id', reservationId)
        .update({
          expires_at: newExpiry,
          updated_at: new Date()
        });

      // Update cache
      const cacheKey = `reservation_ttl:${reservationId}`;
      await this.redis?.setEx(cacheKey, Math.ceil((newExpiry.getTime() - Date.now()) / 1000), JSON.stringify({
        reservationId,
        expiresAt: newExpiry.toISOString(),
        status: ttlRecord.status
      }));

      logger.info('Reservation extended', {
        reservationId,
        additionalMinutes,
        newExpiry: newExpiry.toISOString()
      });

      return true;
    } catch (error) {
      logger.error('Error extending reservation', { error, reservationId, additionalMinutes });
      return false;
    }
  }

  /**
   * Get reservations expiring within specified minutes
   */
  async getExpiringReservations(withinMinutes: number = 60): Promise<Reservation[]> {
    try {
      const expiryThreshold = new Date(Date.now() + withinMinutes * 60 * 1000);
      
      const expiringTTLs = await db('reservation_ttl as rt')
        .select(
          'rt.*',
          'r.*',
          'b.name as business_name',
          'st.name as service_name'
        )
        .join('bookings as r', 'rt.reservation_id', 'r.id')
        .leftJoin('businesses as b', 'r.business_id', 'b.id')
        .leftJoin('service_types as st', 'r.service_type_id', 'st.id')
        .where('rt.expires_at', '<=', expiryThreshold)
        .where('rt.status', 'active')
        .where('r.status', '!=', 'cancelled');

      return expiringTTLs.map(record => this.transformReservationRecord(record));
    } catch (error) {
      logger.error('Error getting expiring reservations', { error, withinMinutes });
      return [];
    }
  }

  /**
   * Get expired reservations
   */
  async getExpiredReservations(): Promise<Reservation[]> {
    try {
      const now = new Date();
      
      const expiredTTLs = await db('reservation_ttl as rt')
        .select(
          'rt.*',
          'r.*',
          'b.name as business_name',
          'st.name as service_name'
        )
        .join('bookings as r', 'rt.reservation_id', 'r.id')
        .leftJoin('businesses as b', 'r.business_id', 'b.id')
        .leftJoin('service_types as st', 'r.service_type_id', 'st.id')
        .where('rt.expires_at', '<', now)
        .whereIn('rt.status', ['active', 'warned'])
        .where('r.status', '!=', 'cancelled');

      return expiredTTLs.map(record => this.transformReservationRecord(record));
    } catch (error) {
      logger.error('Error getting expired reservations', { error });
      return [];
    }
  }

  /**
   * Process expiration warnings
   */
  async sendExpirationWarnings(): Promise<void> {
    try {
      const policies = await this.getActiveExpirationPolicies();
      
      for (const policy of policies) {
        for (const warningInterval of policy.warningIntervals) {
          const warningThreshold = new Date(Date.now() + warningInterval * 60 * 1000);
          
          const reservationsNeedingWarning = await db('reservation_ttl as rt')
            .select(
              'rt.*',
              'r.*',
              'b.name as business_name',
              'st.name as service_name'
            )
            .join('bookings as r', 'rt.reservation_id', 'r.id')
            .leftJoin('businesses as b', 'r.business_id', 'b.id')
            .leftJoin('service_types as st', 'r.service_type_id', 'st.id')
            .where('rt.expires_at', '<=', warningThreshold)
            .where('rt.expires_at', '>', new Date())
            .where('r.business_id', policy.businessId)
            .whereRaw(`NOT JSON_EXTRACT(rt.warnings_sent, '$[*]') LIKE '%${warningInterval}%'`)
            .where('rt.status', 'active');

          for (const record of reservationsNeedingWarning) {
            await this.sendWarningNotification(record, warningInterval, policy);
            
            // Update warnings sent
            const warningsSent = JSON.parse(record.warnings_sent || '[]');
            warningsSent.push(warningInterval);
            
            await db('reservation_ttl')
              .where('reservation_id', record.reservation_id)
              .update({
                warnings_sent: JSON.stringify(warningsSent),
                status: 'warned',
                updated_at: new Date()
              });
          }
        }
      }
    } catch (error) {
      logger.error('Error sending expiration warnings', { error });
    }
  }

  /**
   * Process expired reservations
   */
  async processExpiredReservations(): Promise<void> {
    try {
      const expiredReservations = await this.getExpiredReservations();
      
      logger.info(`Processing ${expiredReservations.length} expired reservations`);

      for (const reservation of expiredReservations) {
        await this.processExpiredReservation(reservation);
      }
    } catch (error) {
      logger.error('Error processing expired reservations', { error });
    }
  }

  /**
   * Create expiration policy
   */
  async createExpirationPolicy(policyData: Omit<ExpirationPolicy, 'id'>): Promise<ExpirationPolicy> {
    try {
      const [policy] = await db('expiration_policies')
        .insert({
          business_id: policyData.businessId,
          name: policyData.name,
          default_ttl_minutes: policyData.defaultTTLMinutes,
          warning_intervals: JSON.stringify(policyData.warningIntervals),
          grace_period_minutes: policyData.gracePeriodMinutes,
          auto_cleanup: policyData.autoCleanup,
          notification_settings: JSON.stringify(policyData.notificationSettings),
          service_type_ids: policyData.serviceTypeIds ? JSON.stringify(policyData.serviceTypeIds) : null,
          is_active: policyData.isActive
        })
        .returning('*');

      logger.info('Expiration policy created', {
        policyId: policy.id,
        businessId: policyData.businessId,
        name: policyData.name
      });

      return this.transformExpirationPolicy(policy);
    } catch (error) {
      logger.error('Error creating expiration policy', { error, policyData });
      throw new Error('Failed to create expiration policy');
    }
  }

  /**
   * Update expiration policy
   */
  async updateExpirationPolicy(policyId: string, updates: Partial<Omit<ExpirationPolicy, 'id' | 'businessId'>>): Promise<ExpirationPolicy> {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.defaultTTLMinutes !== undefined) updateData.default_ttl_minutes = updates.defaultTTLMinutes;
      if (updates.warningIntervals !== undefined) updateData.warning_intervals = JSON.stringify(updates.warningIntervals);
      if (updates.gracePeriodMinutes !== undefined) updateData.grace_period_minutes = updates.gracePeriodMinutes;
      if (updates.autoCleanup !== undefined) updateData.auto_cleanup = updates.autoCleanup;
      if (updates.notificationSettings !== undefined) updateData.notification_settings = JSON.stringify(updates.notificationSettings);
      if (updates.serviceTypeIds !== undefined) updateData.service_type_ids = updates.serviceTypeIds ? JSON.stringify(updates.serviceTypeIds) : null;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      updateData.updated_at = new Date();

      const [policy] = await db('expiration_policies')
        .where('id', policyId)
        .update(updateData)
        .returning('*');

      if (!policy) {
        throw new Error('Expiration policy not found');
      }

      // Clear cache
      const cacheKeys = [
        `expiration_policy:${policy.business_id}`,
        `expiration_policy:id:${policyId}`
      ];
      
      for (const key of cacheKeys) {
        await this.redis?.del(key);
      }

      logger.info('Expiration policy updated', {
        policyId,
        businessId: policy.business_id,
        updates: Object.keys(updates)
      });

      return this.transformExpirationPolicy(policy);
    } catch (error) {
      logger.error('Error updating expiration policy', { error, policyId, updates });
      throw new Error('Failed to update expiration policy');
    }
  }

  /**
   * Get expiration policy by ID
   */
  async getExpirationPolicy(policyId: string): Promise<ExpirationPolicy | null> {
    try {
      const cacheKey = `expiration_policy:id:${policyId}`;
      const cached = await this.redis?.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const policy = await db('expiration_policies')
        .where('id', policyId)
        .first();

      if (policy) {
        const transformed = this.transformExpirationPolicy(policy);
        await this.redis?.setEx(cacheKey, 3600, JSON.stringify(transformed));
        return transformed;
      }

      return null;
    } catch (error) {
      logger.error('Error getting expiration policy by ID', { error, policyId });
      return null;
    }
  }

  /**
   * Get all expiration policies for a business
   */
  async getBusinessExpirationPolicies(businessId: string): Promise<ExpirationPolicy[]> {
    try {
      const policies = await db('expiration_policies')
        .where('business_id', businessId)
        .orderBy('created_at', 'desc');

      return policies.map(policy => this.transformExpirationPolicy(policy));
    } catch (error) {
      logger.error('Error getting business expiration policies', { error, businessId });
      return [];
    }
  }

  /**
   * Deactivate expiration policy
   */
  async deactivateExpirationPolicy(policyId: string): Promise<void> {
    try {
      await db('expiration_policies')
        .where('id', policyId)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      // Clear cache
      const policy = await db('expiration_policies').where('id', policyId).first();
      if (policy) {
        const cacheKeys = [
          `expiration_policy:${policy.business_id}`,
          `expiration_policy:id:${policyId}`
        ];
        
        for (const key of cacheKeys) {
          await this.redis?.del(key);
        }
      }

      logger.info('Expiration policy deactivated', { policyId });
    } catch (error) {
      logger.error('Error deactivating expiration policy', { error, policyId });
      throw new Error('Failed to deactivate expiration policy');
    }
  }

  /**
   * Get policies currently in use by active reservations
   */
  async getPoliciesInUse(businessId: string): Promise<string[]> {
    try {
      const policiesInUse = await db('reservation_ttl as rt')
        .join('bookings as b', 'rt.reservation_id', 'b.id')
        .join('expiration_policies as ep', 'b.business_id', 'ep.business_id')
        .where('b.business_id', businessId)
        .where('b.status', 'confirmed')
        .whereIn('rt.status', ['active', 'warned'])
        .distinct('ep.id')
        .pluck('ep.id');

      return policiesInUse;
    } catch (error) {
      logger.error('Error getting policies in use', { error, businessId });
      return [];
    }
  }

  /**
   * Get reservation analytics including expiration stats
   */
  async getExpirationAnalytics(
    businessId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{
    totalReservations: number;
    expiredReservations: number;
    expirationRate: number;
    averageTimeToExpiry: number;
    warningsEffective: number;
    topExpirationReasons: Array<{
      reason: string;
      count: number;
    }>;
  }> {
    try {
      let baseQuery = db('reservation_ttl as rt')
        .join('bookings as r', 'rt.reservation_id', 'r.id')
        .where('r.business_id', businessId);

      if (dateRange) {
        baseQuery = baseQuery
          .where('r.created_at', '>=', dateRange.startDate)
          .where('r.created_at', '<=', dateRange.endDate);
      }

      const totalReservations = await baseQuery.clone().count('* as count').first();
      const expiredReservations = await baseQuery.clone().where('rt.status', 'expired').count('* as count').first();
      
      const total = parseInt(totalReservations?.count as string) || 0;
      const expired = parseInt(expiredReservations?.count as string) || 0;

      return {
        totalReservations: total,
        expiredReservations: expired,
        expirationRate: total > 0 ? (expired / total) * 100 : 0,
        averageTimeToExpiry: 0, // Would calculate actual average
        warningsEffective: 0, // Would calculate how many warnings led to confirmations
        topExpirationReasons: [] // Would analyze expiration patterns
      };
    } catch (error) {
      logger.error('Error getting expiration analytics', { error, businessId });
      throw new Error('Failed to get expiration analytics');
    }
  }

  private startPeriodicProcessing(): void {
    this.intervalHandle = setInterval(async () => {
      try {
        await this.sendExpirationWarnings();
        await this.processExpiredReservations();
        await this.cleanupOldRecords();
      } catch (error) {
        logger.error('Error in periodic expiration processing', { error });
      }
    }, this.processInterval);
  }

  private async processExpiredReservation(reservation: Reservation): Promise<void> {
    try {
      // Check if grace period applies
      const policy = await this.getExpirationPolicyByBusiness(reservation.businessId);
      const gracePeriodMinutes = policy?.gracePeriodMinutes || 0;

      if (gracePeriodMinutes > 0) {
        const gracePeriodEnd = new Date(reservation.expiresAt!.getTime() + gracePeriodMinutes * 60 * 1000);
        
        if (new Date() < gracePeriodEnd) {
          // Still in grace period
          return;
        }
      }

      // Mark as expired
      await db('reservation_ttl')
        .where('reservation_id', reservation.id)
        .update({
          status: 'expired',
          grace_period_ends_at: gracePeriodMinutes > 0 ? 
            new Date(reservation.expiresAt!.getTime() + gracePeriodMinutes * 60 * 1000) : null,
          updated_at: new Date()
        });

      // Release inventory holds
      if (reservation.inventoryHolds && reservation.inventoryHolds.length > 0) {
        const holdIds = reservation.inventoryHolds.map(hold => hold.id);
        await inventoryService.releaseHolds(holdIds);
        
        logger.info('Inventory holds released for expired reservation', {
          reservationId: reservation.id,
          holdIds
        });
      }

      // Send expiration notification
      if (policy?.notificationSettings.sendExpiredNotices) {
        await this.sendExpirationNotification(reservation, policy);
      }

      // Auto cleanup if enabled
      if (policy?.autoCleanup) {
        await this.cleanupExpiredReservation(reservation.id);
      }

      logger.info('Reservation expired and processed', {
        reservationId: reservation.id,
        businessId: reservation.businessId
      });
    } catch (error) {
      logger.error('Error processing expired reservation', { 
        error, 
        reservationId: reservation.id 
      });
    }
  }

  private async sendWarningNotification(
    record: any,
    warningInterval: number,
    policy: ExpirationPolicy
  ): Promise<void> {
    try {
      if (!policy.notificationSettings.sendWarnings) {
        return;
      }

      const reservation = this.transformReservationRecord(record);
      const minutesUntilExpiry = Math.ceil((new Date(record.expires_at).getTime() - Date.now()) / (60 * 1000));

      await notificationService.send({
        type: 'booking_reminder',
        recipient: 'consumer',
        channels: ['email', 'push'],
        template: 'reservation-expiry-warning',
        data: {
          booking: reservation,
          businessName: record.business_name,
          consumerName: reservation.customerInfo.name,
          minutesUntilExpiry,
          warningInterval
        }
      });

      logger.info('Expiration warning sent', {
        reservationId: reservation.id,
        warningInterval,
        minutesUntilExpiry
      });
    } catch (error) {
      logger.error('Error sending warning notification', { error, reservationId: record.reservation_id });
    }
  }

  private async sendExpirationNotification(
    reservation: Reservation,
    policy: ExpirationPolicy
  ): Promise<void> {
    try {
      await notificationService.send({
        type: 'booking_cancelled',
        recipient: policy.notificationSettings.sendBusinessNotifications ? 'both' : 'consumer',
        channels: ['email'],
        template: 'reservation-expired',
        data: {
          booking: reservation,
          businessName: reservation.businessId, // Would get actual business name
          consumerName: reservation.customerInfo.name,
          reason: 'Reservation expired due to inactivity'
        }
      });

      logger.info('Expiration notification sent', {
        reservationId: reservation.id
      });
    } catch (error) {
      logger.error('Error sending expiration notification', { 
        error, 
        reservationId: reservation.id 
      });
    }
  }

  private async cleanupExpiredReservation(reservationId: string): Promise<void> {
    try {
      // Mark reservation as cancelled
      await db('bookings')
        .where('id', reservationId)
        .update({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancellation_reason: 'Automatic cancellation due to expiration'
        });

      // Mark TTL record as cleaned
      await db('reservation_ttl')
        .where('reservation_id', reservationId)
        .update({
          status: 'cleaned',
          updated_at: new Date()
        });

      logger.info('Expired reservation cleaned up', { reservationId });
    } catch (error) {
      logger.error('Error cleaning up expired reservation', { error, reservationId });
    }
  }

  private async cleanupOldRecords(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const deleted = await db('reservation_ttl')
        .where('status', 'cleaned')
        .where('updated_at', '<', cutoffDate)
        .del();

      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} old TTL records`);
      }
    } catch (error) {
      logger.error('Error cleaning up old records', { error });
    }
  }

  private async getExpirationPolicyByBusiness(businessId: string): Promise<ExpirationPolicy | null> {
    try {
      const cacheKey = `expiration_policy:${businessId}`;
      const cached = await this.redis?.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const policy = await db('expiration_policies')
        .where('business_id', businessId)
        .where('is_active', true)
        .first();

      if (policy) {
        const transformed = this.transformExpirationPolicy(policy);
        await this.redis?.setEx(cacheKey, 3600, JSON.stringify(transformed));
        return transformed;
      }

      return null;
    } catch (error) {
      logger.error('Error getting expiration policy', { error, businessId });
      return null;
    }
  }

  private async getActiveExpirationPolicies(): Promise<ExpirationPolicy[]> {
    try {
      const policies = await db('expiration_policies')
        .where('is_active', true);

      return policies.map(policy => this.transformExpirationPolicy(policy));
    } catch (error) {
      logger.error('Error getting active expiration policies', { error });
      return [];
    }
  }

  private transformReservationRecord(record: any): Reservation {
    // Transform database record to Reservation object
    // Implementation would depend on exact schema structure
    return {
      id: record.id || record.reservation_id,
      businessId: record.business_id,
      type: record.type || 'service',
      scheduledAt: new Date(record.scheduled_at),
      duration: record.duration,
      status: record.status,
      customerInfo: JSON.parse(record.customer_info),
      totalAmount: record.total_amount,
      items: record.items ? JSON.parse(record.items) : [],
      requirements: record.requirements ? JSON.parse(record.requirements) : {},
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
      inventoryHolds: record.inventory_holds ? JSON.parse(record.inventory_holds) : [],
      modificationPolicy: record.modification_policy ? JSON.parse(record.modification_policy) : {
        allowModification: true,
        modificationDeadline: 24,
        modificationFee: 0,
        allowedChanges: [],
        requiresApproval: false,
        maxModifications: 3
      },
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      consumerId: record.consumer_id,
      serviceId: record.service_id || '',
      notes: record.notes
    };
  }

  private transformExpirationPolicy(record: any): ExpirationPolicy {
    return {
      id: record.id,
      businessId: record.business_id,
      name: record.name,
      defaultTTLMinutes: record.default_ttl_minutes,
      warningIntervals: JSON.parse(record.warning_intervals),
      gracePeriodMinutes: record.grace_period_minutes,
      autoCleanup: record.auto_cleanup,
      notificationSettings: JSON.parse(record.notification_settings),
      serviceTypeIds: record.service_type_ids ? JSON.parse(record.service_type_ids) : undefined,
      isActive: record.is_active
    };
  }
}

export const reservationExpirationService = new ReservationExpirationService();