import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';
import { availabilityService } from './availabilityService';
import type {
  AutoApprovalResult,
  ConflictCheck,
  CreateModificationRequestData,
  ModificationChangeType,
  ModificationHistory,
  ModificationImpact,
  ModificationPolicy,
  ModificationRequest,
  ModificationRequestResponse,
  ReviewModificationRequestData
} from '../types/ReservationModification';
import type { Reservation } from '../types/Reservation';

export class ReservationModificationService {
  // Redis connection would be properly initialized here
  // private readonly redis = redisClient;

  /**
   * Create a new modification request
   */
  async createModificationRequest(
    data: CreateModificationRequestData,
    requestedBy: 'customer' | 'business' = 'customer'
  ): Promise<ModificationRequestResponse> {
    try {
      // Get reservation
      const reservation = await this.getReservation(data.reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get modification policy
      const policy = await this.getModificationPolicy(
        reservation.businessId,
        reservation.serviceId
      );

      if (!policy || !policy.allowModification) {
        throw new Error('Modifications are not allowed for this reservation');
      }

      // Check modification eligibility
      await this.validateModificationEligibility(reservation, policy, data.type);

      // Get modification history
      const history = await this.getModificationHistory(data.reservationId);
      
      // Check modification limits
      if (history.remainingModifications <= 0) {
        throw new Error('Maximum number of modifications reached');
      }

      // Analyze modification impact
      const impact = await this.analyzeModificationImpact(
        reservation,
        data.proposedChanges,
        data.type
      );

      // Check for conflicts
      const conflicts = await this.checkModificationConflicts(
        reservation,
        data.proposedChanges,
        data.type
      );

      // Run auto-approval rules
      const autoApprovalResult = await this.evaluateAutoApproval(
        reservation,
        data,
        policy,
        impact
      );

      // Calculate modification fee
      const fee = this.calculateModificationFee(policy, impact, data.type);

      // Create modification request
      const modificationRequest: Omit<ModificationRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        reservationId: data.reservationId,
        businessId: reservation.businessId,
        requestedBy,
        requestedAt: new Date(),
        status: autoApprovalResult.canAutoApprove ? 'approved' : 
                policy.requiresApproval ? 'pending' : 'approved',
        type: data.type,
        originalData: this.extractReservationData(reservation, data.type),
        proposedChanges: data.proposedChanges,
        reason: data.reason,
        customerMessage: data.customerMessage,
        reviewedBy: autoApprovalResult.canAutoApprove ? 'auto-approval' : undefined,
        reviewedAt: autoApprovalResult.canAutoApproval ? new Date() : undefined,
        approvalDeadline: this.calculateApprovalDeadline(reservation, policy),
        fee,
        policyId: policy.id,
        modificationCount: history.totalModifications + 1,
        metadata: {
          impactAnalysis: impact,
          autoApprovalResult,
          conflictChecks: conflicts
        }
      };

      const [request] = await db('modification_requests')
        .insert({
          reservation_id: modificationRequest.reservationId,
          business_id: modificationRequest.businessId,
          requested_by: modificationRequest.requestedBy,
          requested_at: modificationRequest.requestedAt,
          status: modificationRequest.status,
          type: modificationRequest.type,
          original_data: JSON.stringify(modificationRequest.originalData),
          proposed_changes: JSON.stringify(modificationRequest.proposedChanges),
          reason: modificationRequest.reason,
          customer_message: modificationRequest.customerMessage,
          reviewed_by: modificationRequest.reviewedBy,
          reviewed_at: modificationRequest.reviewedAt,
          approval_deadline: modificationRequest.approvalDeadline,
          fee: modificationRequest.fee,
          policy_id: modificationRequest.policyId,
          modification_count: modificationRequest.modificationCount,
          metadata: JSON.stringify(modificationRequest.metadata)
        })
        .returning('*');

      const transformedRequest = this.transformModificationRequest(request);

      // Auto-approve if conditions are met
      if (autoApprovalResult.canAutoApprove) {
        await this.processApprovedModification(transformedRequest);
      } else if (policy.requiresApproval) {
        // Send notification to business for review
        await this.sendModificationNotification(transformedRequest, 'business_review_required');
      }

      // Send confirmation to customer
      await this.sendModificationNotification(transformedRequest, 'customer_confirmation');

      logger.info('Modification request created', {
        requestId: transformedRequest.id,
        reservationId: data.reservationId,
        type: data.type,
        status: transformedRequest.status
      });

      return {
        request: transformedRequest,
        impact,
        timeline: {
          submittedAt: transformedRequest.requestedAt,
          reviewDeadline: transformedRequest.approvalDeadline!,
          implementationDeadline: this.calculateImplementationDeadline(reservation)
        },
        nextSteps: this.generateNextSteps(transformedRequest, policy)
      };

    } catch (error) {
      logger.error('Error creating modification request', { error, data });
      throw new Error('Failed to create modification request');
    }
  }

  /**
   * Review and approve/reject a modification request
   */
  async reviewModificationRequest(
    requestId: string,
    reviewData: ReviewModificationRequestData,
    reviewerId: string
  ): Promise<ModificationRequest> {
    try {
      const request = await this.getModificationRequestById(requestId);
      if (!request) {
        throw new Error('Modification request not found');
      }

      if (request.status !== 'pending' && request.status !== 'review_required') {
        throw new Error('Modification request is not pending review');
      }

      // Update request status
      const updatedRequest = await db('modification_requests')
        .where('id', requestId)
        .update({
          status: reviewData.action === 'approve' ? 'approved' : 'rejected',
          business_message: reviewData.businessMessage,
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          fee: reviewData.fee || request.fee,
          updated_at: new Date()
        })
        .returning('*');

      const transformedRequest = this.transformModificationRequest(updatedRequest[0]);

      if (reviewData.action === 'approve') {
        await this.processApprovedModification(transformedRequest);
        await this.sendModificationNotification(transformedRequest, 'customer_approved');
      } else {
        await this.sendModificationNotification(transformedRequest, 'customer_rejected');
      }

      logger.info('Modification request reviewed', {
        requestId,
        action: reviewData.action,
        reviewerId
      });

      return transformedRequest;

    } catch (error) {
      logger.error('Error reviewing modification request', { error, requestId, reviewData });
      throw new Error('Failed to review modification request');
    }
  }

  /**
   * Get modification requests for a business
   */
  async getBusinessModificationRequests(
    businessId: string,
    status?: string,
    limit: number = 50
  ): Promise<ModificationRequest[]> {
    try {
      let query = db('modification_requests')
        .where('business_id', businessId)
        .orderBy('requested_at', 'desc')
        .limit(limit);

      if (status) {
        query = query.where('status', status);
      }

      const requests = await query;
      return requests.map(request => this.transformModificationRequest(request));

    } catch (error) {
      logger.error('Error getting business modification requests', { error, businessId });
      return [];
    }
  }

  /**
   * Get modification requests for a specific reservation
   */
  async getReservationModificationRequests(reservationId: string): Promise<ModificationRequest[]> {
    try {
      const requests = await db('modification_requests')
        .where('reservation_id', reservationId)
        .orderBy('requested_at', 'desc');

      return requests.map(request => this.transformModificationRequest(request));

    } catch (error) {
      logger.error('Error getting reservation modification requests', { error, reservationId });
      return [];
    }
  }

  /**
   * Create or update modification policy
   */
  async createModificationPolicy(policyData: Omit<ModificationPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModificationPolicy> {
    try {
      const [policy] = await db('modification_policies')
        .insert({
          business_id: policyData.businessId,
          name: policyData.name,
          description: policyData.description,
          allow_modification: policyData.allowModification,
          modification_deadline: policyData.modificationDeadline,
          modification_fee: policyData.modificationFee,
          allowed_changes: JSON.stringify(policyData.allowedChanges),
          requires_approval: policyData.requiresApproval,
          max_modifications: policyData.maxModifications,
          auto_approval_rules: policyData.autoApprovalRules ? JSON.stringify(policyData.autoApprovalRules) : null,
          is_active: policyData.isActive,
          service_type_ids: policyData.serviceTypeIds ? JSON.stringify(policyData.serviceTypeIds) : null
        })
        .returning('*');

      logger.info('Modification policy created', {
        policyId: policy.id,
        businessId: policyData.businessId,
        name: policyData.name
      });

      return this.transformModificationPolicy(policy);

    } catch (error) {
      logger.error('Error creating modification policy', { error, policyData });
      throw new Error('Failed to create modification policy');
    }
  }

  /**
   * Get modification policy for business and service type
   */
  async getModificationPolicy(businessId: string, serviceTypeId?: string): Promise<ModificationPolicy | null> {
    try {
      const cacheKey = `modification_policy:${businessId}:${serviceTypeId || 'default'}`;
      const cached = await this.redis?.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      let policy = null;

      // First try to find service-specific policy
      if (serviceTypeId) {
        const servicePolicy = await db('modification_policies')
          .where('business_id', businessId)
          .where('is_active', true)
          .whereRaw(`JSON_CONTAINS(service_type_ids, '"${serviceTypeId}"')`)
          .first();

        if (servicePolicy) {
          policy = this.transformModificationPolicy(servicePolicy);
        }
      }

      // Fall back to default business policy
      if (!policy) {
        const defaultPolicy = await db('modification_policies')
          .where('business_id', businessId)
          .where('is_active', true)
          .whereNull('service_type_ids')
          .first();

        if (defaultPolicy) {
          policy = this.transformModificationPolicy(defaultPolicy);
        }
      }

      if (policy) {
        await this.redis?.setEx(cacheKey, 3600, JSON.stringify(policy));
      }

      return policy;

    } catch (error) {
      logger.error('Error getting modification policy', { error, businessId, serviceTypeId });
      return null;
    }
  }

  /**
   * Analyze the impact of a proposed modification
   */
  private async analyzeModificationImpact(
    reservation: Reservation,
    proposedChanges: Record<string, any>,
    type: ModificationChangeType
  ): Promise<ModificationImpact> {
    const impact: ModificationImpact = {
      availabilityImpact: {
        hasConflicts: false,
        conflictingReservations: []
      },
      pricingImpact: {
        originalAmount: reservation.totalAmount,
        newAmount: reservation.totalAmount,
        difference: 0,
        additionalFees: 0
      },
      resourceImpact: {
        staffingChanges: false,
        equipmentChanges: false,
        inventoryChanges: false,
        affectedResources: []
      },
      customerImpact: {
        notificationRequired: true,
        confirmationRequired: true,
        compensationSuggested: false
      }
    };

    try {
      // Analyze availability impact
      if (type === 'date_time' && proposedChanges.scheduledAt) {
        const newDate = new Date(proposedChanges.scheduledAt);
        const conflictingReservations = await this.checkSchedulingConflicts(
          reservation.businessId,
          newDate,
          reservation.duration,
          reservation.id
        );

        impact.availabilityImpact.hasConflicts = conflictingReservations.length > 0;
        impact.availabilityImpact.conflictingReservations = conflictingReservations;

        if (conflictingReservations.length > 0) {
          const alternatives = await this.suggestAlternativeTimeSlots(
            reservation.businessId,
            newDate,
            reservation.duration
          );
          impact.availabilityImpact.suggestedAlternatives = alternatives;
        }
      }

      // Analyze pricing impact
      if (type === 'service_type' || type === 'duration' || type === 'add_services') {
        const newAmount = await this.calculateNewAmount(reservation, proposedChanges, type);
        impact.pricingImpact.newAmount = newAmount;
        impact.pricingImpact.difference = newAmount - reservation.totalAmount;
      }

      // Analyze resource impact
      if (['service_type', 'duration', 'date_time'].includes(type)) {
        impact.resourceImpact.staffingChanges = true;
        impact.resourceImpact.affectedResources.push('staff_schedule');
      }

    } catch (error) {
      logger.error('Error analyzing modification impact', { error, reservation: reservation.id });
    }

    return impact;
  }

  /**
   * Process an approved modification
   */
  private async processApprovedModification(request: ModificationRequest): Promise<void> {
    try {
      const reservation = await this.getReservation(request.reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Apply the changes to the reservation
      const updates = this.buildReservationUpdates(request.proposedChanges, request.type);
      
      await db('bookings')
        .where('id', request.reservationId)
        .update({
          ...updates,
          updated_at: new Date()
        });

      // Record the modification in history
      await this.recordModificationHistory(request);

      // Handle pricing changes
      if (request.metadata.impactAnalysis?.pricingImpact.difference !== 0) {
        await this.processPricingChanges(request);
      }

      // Update availability if time changed
      if (request.type === 'date_time') {
        await this.updateAvailability(reservation, request.proposedChanges);
      }

      logger.info('Modification processed successfully', {
        requestId: request.id,
        reservationId: request.reservationId
      });

    } catch (error) {
      logger.error('Error processing approved modification', { error, requestId: request.id });
      throw error;
    }
  }

  // Helper methods

  private async getReservation(reservationId: string): Promise<Reservation | null> {
    const reservation = await db('bookings').where('id', reservationId).first();
    return reservation ? this.transformReservation(reservation) : null;
  }

  private async getModificationRequestById(requestId: string): Promise<ModificationRequest | null> {
    const request = await db('modification_requests').where('id', requestId).first();
    return request ? this.transformModificationRequest(request) : null;
  }

  private async getModificationHistory(reservationId: string): Promise<ModificationHistory> {
    const modifications = await db('modification_requests')
      .where('reservation_id', reservationId)
      .where('status', 'approved');

    const policy = await db('modification_policies')
      .join('bookings', 'modification_policies.business_id', 'bookings.business_id')
      .where('bookings.id', reservationId)
      .first();

    return {
      reservationId,
      modifications: modifications.map(m => ({
        id: m.id,
        requestId: m.id,
        timestamp: m.reviewed_at || m.created_at,
        type: m.type,
        changes: JSON.parse(m.proposed_changes),
        fee: m.fee || 0,
        approvedBy: m.reviewed_by,
        notes: m.business_message
      })),
      totalModifications: modifications.length,
      lastModifiedAt: modifications.length > 0 ? new Date(Math.max(...modifications.map(m => new Date(m.reviewed_at || m.created_at).getTime()))) : undefined,
      modificationLimit: policy?.max_modifications || 3,
      remainingModifications: Math.max(0, (policy?.max_modifications || 3) - modifications.length)
    };
  }

  private async validateModificationEligibility(
    reservation: Reservation,
    policy: ModificationPolicy,
    type: ModificationChangeType
  ): Promise<void> {
    // Check if modification type is allowed
    if (!policy.allowedChanges.includes(type)) {
      throw new Error(`${type} modifications are not allowed`);
    }

    // Check deadline
    const deadline = new Date(reservation.scheduledAt.getTime() - policy.modificationDeadline * 60 * 60 * 1000);
    if (new Date() > deadline) {
      throw new Error('Modification deadline has passed');
    }

    // Check reservation status
    if (reservation.status === 'completed' || reservation.status === 'cancelled') {
      throw new Error('Cannot modify completed or cancelled reservations');
    }
  }

  private async checkModificationConflicts(
    reservation: Reservation,
    proposedChanges: Record<string, any>,
    type: ModificationChangeType
  ): Promise<ConflictCheck[]> {
    const conflicts: ConflictCheck[] = [];

    // Check scheduling conflicts for date/time changes
    if (type === 'date_time' && proposedChanges.scheduledAt) {
      const newDate = new Date(proposedChanges.scheduledAt);
      const conflictingReservations = await this.checkSchedulingConflicts(
        reservation.businessId,
        newDate,
        reservation.duration,
        reservation.id
      );

      if (conflictingReservations.length > 0) {
        conflicts.push({
          type: 'scheduling',
          hasConflict: true,
          description: `Time slot conflicts with ${conflictingReservations.length} existing reservation(s)`,
          severity: 'blocking',
          resolution: 'Choose a different time slot or contact business to resolve conflicts'
        });
      }
    }

    return conflicts;
  }

  private async evaluateAutoApproval(
    reservation: Reservation,
    data: CreateModificationRequestData,
    policy: ModificationPolicy,
    impact: ModificationImpact
  ): Promise<AutoApprovalResult> {
    // Simple auto-approval logic - can be expanded
    let canAutoApprove = false;
    let action: 'approve' | 'reject' | 'review' = 'review';
    let reason = 'Requires manual review';
    const matchedRules: string[] = [];

    // Auto-approve if no conflicts and low impact
    if (!impact.availabilityImpact.hasConflicts && 
        Math.abs(impact.pricingImpact.difference) < 50 &&
        !policy.requiresApproval) {
      canAutoApprove = true;
      action = 'approve';
      reason = 'Low impact modification with no conflicts';
      matchedRules.push('low_impact_auto_approval');
    }

    return {
      canAutoApprove,
      matchedRules,
      action,
      reason,
      confidence: canAutoApprove ? 0.9 : 0.1
    };
  }

  private calculateModificationFee(
    policy: ModificationPolicy,
    impact: ModificationImpact,
    type: ModificationChangeType
  ): number {
    let fee = policy.modificationFee;

    // Add additional fees based on impact
    if (impact.availabilityImpact.hasConflicts) {
      fee += 25; // Conflict resolution fee
    }

    if (Math.abs(impact.pricingImpact.difference) > 100) {
      fee += 15; // High-value change fee
    }

    return fee;
  }

  private calculateApprovalDeadline(reservation: Reservation, policy: ModificationPolicy): Date {
    // Give 48 hours for approval, but not past the modification deadline
    const defaultDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const modificationDeadline = new Date(reservation.scheduledAt.getTime() - policy.modificationDeadline * 60 * 60 * 1000);
    
    return defaultDeadline < modificationDeadline ? defaultDeadline : modificationDeadline;
  }

  private calculateImplementationDeadline(reservation: Reservation): Date {
    // Must be implemented at least 2 hours before the scheduled time
    return new Date(reservation.scheduledAt.getTime() - 2 * 60 * 60 * 1000);
  }

  private generateNextSteps(request: ModificationRequest, policy: ModificationPolicy): string[] {
    const steps: string[] = [];

    if (request.status === 'pending') {
      steps.push('Business review required');
      steps.push(`Review deadline: ${request.approvalDeadline?.toLocaleString()}`);
    } else if (request.status === 'approved') {
      steps.push('Modification approved and applied');
      if (request.fee && request.fee > 0) {
        steps.push(`Modification fee: $${request.fee.toFixed(2)}`);
      }
    } else if (request.status === 'rejected') {
      steps.push('Modification was rejected');
      if (request.businessMessage) {
        steps.push(`Reason: ${request.businessMessage}`);
      }
    }

    return steps;
  }

  // Notification methods
  private async sendModificationNotification(
    request: ModificationRequest,
    type: 'customer_confirmation' | 'business_review_required' | 'customer_approved' | 'customer_rejected'
  ): Promise<void> {
    // Implementation would send appropriate notifications
    logger.info('Sending modification notification', { requestId: request.id, type });
  }

  // Transformation methods
  private transformModificationRequest(dbRecord: any): ModificationRequest {
    return {
      id: dbRecord.id,
      reservationId: dbRecord.reservation_id,
      businessId: dbRecord.business_id,
      requestedBy: dbRecord.requested_by,
      requestedAt: new Date(dbRecord.requested_at),
      status: dbRecord.status,
      type: dbRecord.type,
      originalData: JSON.parse(dbRecord.original_data),
      proposedChanges: JSON.parse(dbRecord.proposed_changes),
      reason: dbRecord.reason,
      customerMessage: dbRecord.customer_message,
      businessMessage: dbRecord.business_message,
      reviewedBy: dbRecord.reviewed_by,
      reviewedAt: dbRecord.reviewed_at ? new Date(dbRecord.reviewed_at) : undefined,
      approvalDeadline: dbRecord.approval_deadline ? new Date(dbRecord.approval_deadline) : undefined,
      fee: dbRecord.fee,
      policyId: dbRecord.policy_id,
      modificationCount: dbRecord.modification_count,
      metadata: JSON.parse(dbRecord.metadata || '{}'),
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    };
  }

  private transformModificationPolicy(dbRecord: any): ModificationPolicy {
    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      name: dbRecord.name,
      description: dbRecord.description,
      allowModification: dbRecord.allow_modification,
      modificationDeadline: dbRecord.modification_deadline,
      modificationFee: dbRecord.modification_fee,
      allowedChanges: JSON.parse(dbRecord.allowed_changes),
      requiresApproval: dbRecord.requires_approval,
      maxModifications: dbRecord.max_modifications,
      autoApprovalRules: dbRecord.auto_approval_rules ? JSON.parse(dbRecord.auto_approval_rules) : undefined,
      isActive: dbRecord.is_active,
      serviceTypeIds: dbRecord.service_type_ids ? JSON.parse(dbRecord.service_type_ids) : undefined,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    };
  }

  private transformReservation(dbRecord: any): Reservation {
    // Implementation would transform database record to Reservation type
    return dbRecord as Reservation;
  }

  // Placeholder methods - would be implemented based on specific requirements
  private async checkSchedulingConflicts(businessId: string, newDate: Date, duration: number, excludeId: string): Promise<string[]> {
    return [];
  }

  private async suggestAlternativeTimeSlots(businessId: string, preferredDate: Date, duration: number): Promise<Date[]> {
    return [];
  }

  private async calculateNewAmount(reservation: Reservation, changes: Record<string, any>, type: ModificationChangeType): Promise<number> {
    return reservation.totalAmount;
  }

  private buildReservationUpdates(changes: Record<string, any>, type: ModificationChangeType): Record<string, any> {
    const updates: Record<string, any> = {};
    
    if (type === 'date_time' && changes.scheduledAt) {
      updates.scheduled_at = new Date(changes.scheduledAt);
    }
    
    if (type === 'duration' && changes.duration) {
      updates.duration = changes.duration;
    }

    return updates;
  }

  private async recordModificationHistory(request: ModificationRequest): Promise<void> {
    // Implementation would record the modification in history
  }

  private async processPricingChanges(request: ModificationRequest): Promise<void> {
    // Implementation would handle payment adjustments
  }

  private async updateAvailability(reservation: Reservation, changes: Record<string, any>): Promise<void> {
    // Implementation would update availability slots
  }

  private extractReservationData(reservation: Reservation, type: ModificationChangeType): Record<string, any> {
    const data: Record<string, any> = {};

    switch (type) {
      case 'date_time':
        data.scheduledAt = reservation.scheduledAt;
        data.duration = reservation.duration;
        break;
      case 'customer_info':
        data.customerInfo = reservation.customerInfo;
        break;
      case 'service_type':
        data.serviceId = reservation.serviceId;
        break;
      default:
        data.allFields = { ...reservation };
    }

    return data;
  }

  /**
   * Simple modification request method for API compatibility
   */
  async requestModification(request: ModificationRequest): Promise<{ success: boolean; reason?: string }> {
    try {
      // Simplified implementation for immediate API compatibility
      logger.info('Processing modification request', { 
        reservationId: request.reservationId,
        changes: request.changes 
      });
      
      // For now, return success - full implementation would handle business logic
      return { success: true };
    } catch (error) {
      logger.error('Error processing modification request', { error, request });
      return { success: false, reason: 'Failed to process modification request' };
    }
  }
}

export const reservationModificationService = new ReservationModificationService();