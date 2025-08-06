import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { stripe } from '../config/stripe.js';
import { logger } from '../utils/logger.js';
import {
  PayoutRequest,
  PayoutResult,
  PayoutSchedule,
  BusinessBalance,
  PayoutServiceInterface,
  PaymentAuditLog,
  PaymentOperationType
} from '../types/Payment.js';
import {
  createPaymentErrorFromStripe,
  BasePaymentError,
  PaymentValidationError,
  PaymentProcessingError,
  InsufficientFundsError
} from '../errors/PaymentErrors.js';

/**
 * Comprehensive Payout Service for Buy Locals Platform
 * 
 * Features:
 * - Automated payout scheduling (daily, weekly, monthly)
 * - Manual payout processing
 * - Balance management and tracking
 * - Payout failure handling and retry logic
 * - Comprehensive reporting and analytics
 * - Integration with Stripe Connect for business accounts
 */
export class PayoutService implements PayoutServiceInterface {
  private readonly payoutSchedules: Map<string, PayoutSchedule> = new Map();
  private readonly businessBalances: Map<string, BusinessBalance> = new Map();
  private readonly failedPayouts: Map<string, { attempt: number; lastError: string; nextRetry: Date }> = new Map();

  constructor() {
    this.initializeScheduledPayouts();
    this.startPayoutScheduler();
    this.startFailureRetryProcessor();
  }

  /**
   * Create a payout for a business
   */
  async createPayout(request: PayoutRequest): Promise<PayoutResult> {
    const correlationId = uuidv4();

    try {
      await this.validatePayoutRequest(request);
      await this.auditLog('payout_create', 'payout', '', request.businessId, correlationId);

      // Get business balance
      const balance = await this.getBusinessBalance(request.businessId);
      
      // Determine payout amount
      const payoutAmount = request.amount || balance.availableBalance;
      
      if (payoutAmount <= 0) {
        throw new PaymentValidationError('Payout amount must be greater than zero');
      }

      if (payoutAmount > balance.availableBalance) {
        throw new InsufficientFundsError(balance.availableBalance, payoutAmount, request.currency);
      }

      // Check minimum payout amount
      const minimumAmount = this.getMinimumPayoutAmount(request.currency);
      if (payoutAmount < minimumAmount) {
        throw new PaymentValidationError(
          `Minimum payout amount is ${this.formatCurrency(minimumAmount, request.currency)}`
        );
      }

      // Get business Stripe Connect account
      const stripeAccountId = await this.getBusinessStripeAccountId(request.businessId);
      
      // Create Stripe payout
      const payout = await stripe.payouts.create({
        amount: payoutAmount,
        currency: request.currency.toLowerCase(),
        method: 'instant', // or 'standard' based on business preference
        source_type: 'bank_account',
        destination: request.bankAccountId,
        description: request.description || `Payout for ${request.businessId}`,
        metadata: {
          businessId: request.businessId,
          correlationId,
          scheduleType: request.schedule.frequency
        }
      }, {
        stripeAccount: stripeAccountId
      });

      // Update business balance
      await this.updateBusinessBalance(request.businessId, {
        availableBalance: balance.availableBalance - payoutAmount,
        pendingBalance: balance.pendingBalance + payoutAmount
      });

      const result: PayoutResult = {
        success: true,
        payoutId: payout.id,
        amount: payoutAmount,
        currency: request.currency,
        arrivalDate: new Date(payout.arrival_date * 1000),
        status: payout.status
      };

      await this.auditLog('payout_create', 'payout', payout.id, request.businessId, correlationId, true);

      logger.info('Payout created successfully', {
        payoutId: payout.id,
        businessId: request.businessId,
        amount: payoutAmount,
        currency: request.currency,
        arrivalDate: result.arrivalDate,
        correlationId
      });

      // Clear any previous failure records
      this.failedPayouts.delete(payout.id);

      return result;

    } catch (error) {
      await this.auditLog('payout_create', 'payout', '', request.businessId, correlationId, false, error);

      logger.error('Payout creation failed', {
        businessId: request.businessId,
        amount: request.amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      if (error instanceof BasePaymentError) {
        throw error;
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw createPaymentErrorFromStripe(error);
      }

      throw new PaymentProcessingError(
        'Failed to create payout',
        true,
        error as Stripe.StripeError
      );
    }
  }

  /**
   * Get business balance
   */
  async getBusinessBalance(businessId: string): Promise<BusinessBalance> {
    try {
      // In a real implementation, this would fetch from your database
      let balance = this.businessBalances.get(businessId);

      if (!balance) {
        // Initialize balance from Stripe Connect account
        balance = await this.initializeBusinessBalance(businessId);
        this.businessBalances.set(businessId, balance);
      }

      // Update with latest Stripe data
      await this.syncBalanceWithStripe(businessId, balance);

      return balance;

    } catch (error) {
      logger.error('Failed to get business balance', {
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new PaymentProcessingError(
        'Failed to retrieve business balance',
        true,
        error as any
      );
    }
  }

  /**
   * Update payout schedule for a business
   */
  async updatePayoutSchedule(businessId: string, schedule: PayoutSchedule): Promise<void> {
    try {
      await this.validatePayoutSchedule(schedule);

      this.payoutSchedules.set(businessId, schedule);

      // In a real implementation, save to database
      await this.savePayoutSchedule(businessId, schedule);

      logger.info('Payout schedule updated', {
        businessId,
        frequency: schedule.frequency,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        minimumAmount: schedule.minimumAmount
      });

    } catch (error) {
      logger.error('Failed to update payout schedule', {
        businessId,
        schedule,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new PaymentProcessingError(
        'Failed to update payout schedule',
        false,
        error as any
      );
    }
  }

  /**
   * Handle payout failure with retry logic
   */
  async handlePayoutFailure(payoutId: string, reason: string): Promise<void> {
    const correlationId = uuidv4();

    try {
      await this.auditLog('payout_failure', 'payout', payoutId, '', correlationId);

      // Get payout details
      const payout = await stripe.payouts.retrieve(payoutId);
      const businessId = payout.metadata?.businessId;

      if (!businessId) {
        throw new PaymentValidationError('Business ID not found in payout metadata');
      }

      // Record failure
      const failureRecord = this.failedPayouts.get(payoutId) || { attempt: 0, lastError: '', nextRetry: new Date() };
      failureRecord.attempt++;
      failureRecord.lastError = reason;

      // Calculate next retry time (exponential backoff)
      const baseDelay = 60 * 60 * 1000; // 1 hour
      const delay = baseDelay * Math.pow(2, failureRecord.attempt - 1);
      failureRecord.nextRetry = new Date(Date.now() + delay);

      this.failedPayouts.set(payoutId, failureRecord);

      // Revert balance changes
      const balance = await this.getBusinessBalance(businessId);
      await this.updateBusinessBalance(businessId, {
        availableBalance: balance.availableBalance + payout.amount,
        pendingBalance: balance.pendingBalance - payout.amount
      });

      await this.auditLog('payout_failure', 'payout', payoutId, businessId, correlationId, true);

      logger.warn('Payout failure handled', {
        payoutId,
        businessId,
        reason,
        attempt: failureRecord.attempt,
        nextRetry: failureRecord.nextRetry,
        correlationId
      });

      // Send notification to business about payout failure
      await this.notifyPayoutFailure(businessId, payoutId, reason, failureRecord.nextRetry);

    } catch (error) {
      await this.auditLog('payout_failure', 'payout', payoutId, '', correlationId, false, error);

      logger.error('Failed to handle payout failure', {
        payoutId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw new PaymentProcessingError(
        'Failed to handle payout failure',
        true,
        error as any
      );
    }
  }

  /**
   * Generate payout report for a business
   */
  async generatePayoutReport(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    const correlationId = uuidv4();

    try {
      logger.info('Generating payout report', {
        businessId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        correlationId
      });

      // Get payout data for the period
      const payouts = await this.getPayoutsForPeriod(businessId, startDate, endDate);
      const balance = await this.getBusinessBalance(businessId);
      const schedule = this.payoutSchedules.get(businessId);

      const report = {
        businessId,
        reportPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: {
          totalPayouts: payouts.length,
          totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0),
          successfulPayouts: payouts.filter(p => p.status === 'paid').length,
          failedPayouts: payouts.filter(p => p.status === 'failed').length,
          pendingPayouts: payouts.filter(p => p.status === 'pending').length,
          averagePayoutAmount: payouts.length > 0 ? payouts.reduce((sum, p) => sum + p.amount, 0) / payouts.length : 0
        },
        currentBalance: balance,
        payoutSchedule: schedule,
        payouts: payouts.map(this.sanitizePayoutForReport),
        failureAnalysis: this.generateFailureAnalysis(payouts),
        generatedAt: new Date().toISOString(),
        correlationId
      };

      logger.info('Payout report generated successfully', {
        businessId,
        totalPayouts: report.summary.totalPayouts,
        totalAmount: report.summary.totalAmount,
        correlationId
      });

      return report;

    } catch (error) {
      logger.error('Payout report generation failed', {
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw new PaymentProcessingError(
        'Failed to generate payout report',
        true,
        error as any
      );
    }
  }

  // Private helper methods

  private async validatePayoutRequest(request: PayoutRequest): Promise<void> {
    if (!request.businessId) {
      throw new PaymentValidationError('Business ID is required');
    }

    if (!request.currency || !['USD', 'CAD', 'EUR', 'GBP'].includes(request.currency.toUpperCase())) {
      throw new PaymentValidationError('Valid currency is required (USD, CAD, EUR, GBP)');
    }

    if (request.amount !== undefined && request.amount <= 0) {
      throw new PaymentValidationError('Payout amount must be greater than zero');
    }

    await this.validatePayoutSchedule(request.schedule);
  }

  private async validatePayoutSchedule(schedule: PayoutSchedule): Promise<void> {
    const validFrequencies = ['daily', 'weekly', 'monthly', 'manual'];
    if (!validFrequencies.includes(schedule.frequency)) {
      throw new PaymentValidationError(`Invalid frequency. Valid options: ${validFrequencies.join(', ')}`);
    }

    if (schedule.frequency === 'weekly' && (schedule.dayOfWeek === undefined || schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6)) {
      throw new PaymentValidationError('Day of week must be 0-6 for weekly schedule');
    }

    if (schedule.frequency === 'monthly' && (schedule.dayOfMonth === undefined || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31)) {
      throw new PaymentValidationError('Day of month must be 1-31 for monthly schedule');
    }

    if (schedule.minimumAmount !== undefined && schedule.minimumAmount <= 0) {
      throw new PaymentValidationError('Minimum amount must be greater than zero');
    }
  }

  private getMinimumPayoutAmount(currency: string): number {
    // Minimum payout amounts by currency (in cents)
    const minimums: Record<string, number> = {
      'USD': 100, // $1.00
      'CAD': 100, // $1.00 CAD
      'EUR': 100, // €1.00
      'GBP': 100  // £1.00
    };

    return minimums[currency.toUpperCase()] || 100;
  }

  private formatCurrency(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'CAD': 'C$',
      'EUR': '€',
      'GBP': '£'
    };

    const symbol = symbols[currency.toUpperCase()] || currency;
    return `${symbol}${(amount / 100).toFixed(2)}`;
  }

  private async initializeBusinessBalance(businessId: string): Promise<BusinessBalance> {
    // In a real implementation, fetch from database and Stripe
    const balance: BusinessBalance = {
      businessId,
      availableBalance: 0,
      pendingBalance: 0,
      escrowHeld: 0,
      currency: 'USD', // Would be business-specific
      lastUpdated: new Date()
    };

    return balance;
  }

  private async syncBalanceWithStripe(businessId: string, balance: BusinessBalance): Promise<void> {
    try {
      const stripeAccountId = await this.getBusinessStripeAccountId(businessId);
      const stripeBalance = await stripe.balance.retrieve({
        stripeAccount: stripeAccountId
      });

      // Update balance with Stripe data
      if (stripeBalance.available.length > 0) {
        balance.availableBalance = stripeBalance.available[0].amount;
      }

      if (stripeBalance.pending.length > 0) {
        balance.pendingBalance = stripeBalance.pending.reduce((sum, p) => sum + p.amount, 0);
      }

      balance.lastUpdated = new Date();

    } catch (error) {
      logger.warn('Failed to sync balance with Stripe', {
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue with cached balance
    }
  }

  private async updateBusinessBalance(businessId: string, updates: Partial<BusinessBalance>): Promise<void> {
    const balance = this.businessBalances.get(businessId);
    if (balance) {
      Object.assign(balance, updates, { lastUpdated: new Date() });
      this.businessBalances.set(businessId, balance);

      // In a real implementation, save to database
      await this.saveBusinessBalance(balance);
    }
  }

  private initializeScheduledPayouts(): void {
    // Initialize default payout schedules for businesses
    // In a real implementation, load from database
    this.payoutSchedules.set('business-1', {
      frequency: 'weekly',
      dayOfWeek: 5, // Friday
      minimumAmount: 1000 // $10.00 minimum
    });

    this.payoutSchedules.set('business-2', {
      frequency: 'monthly',
      dayOfMonth: 1, // First of month
      minimumAmount: 5000 // $50.00 minimum
    });
  }

  private startPayoutScheduler(): void {
    // Run payout scheduler every hour
    setInterval(() => {
      this.processScheduledPayouts().catch(error => {
        logger.error('Scheduled payout processing failed', { error });
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  private startFailureRetryProcessor(): void {
    // Process failed payout retries every 30 minutes
    setInterval(() => {
      this.retryFailedPayouts().catch(error => {
        logger.error('Failed payout retry processing failed', { error });
      });
    }, 30 * 60 * 1000); // 30 minutes
  }

  private async processScheduledPayouts(): Promise<void> {
    const now = new Date();
    
    for (const [businessId, schedule] of this.payoutSchedules.entries()) {
      try {
        if (this.shouldProcessPayout(schedule, now)) {
          const balance = await this.getBusinessBalance(businessId);
          
          if (balance.availableBalance >= (schedule.minimumAmount || 0)) {
            await this.createPayout({
              businessId,
              currency: balance.currency,
              schedule
            });

            logger.info('Scheduled payout processed', { businessId, amount: balance.availableBalance });
          }
        }
      } catch (error) {
        logger.error('Scheduled payout failed', {
          businessId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async retryFailedPayouts(): Promise<void> {
    const now = new Date();

    for (const [payoutId, failureRecord] of this.failedPayouts.entries()) {
      if (failureRecord.nextRetry <= now && failureRecord.attempt <= 3) {
        try {
          // Attempt to retry the payout
          const payout = await stripe.payouts.retrieve(payoutId);
          const businessId = payout.metadata?.businessId;

          if (businessId) {
            await this.createPayout({
              businessId,
              amount: payout.amount,
              currency: payout.currency,
              schedule: { frequency: 'manual' }, // Manual retry
              description: `Retry of failed payout ${payoutId}`
            });

            // Remove from failed payouts on success
            this.failedPayouts.delete(payoutId);

            logger.info('Failed payout retry successful', { payoutId, businessId, attempt: failureRecord.attempt });
          }
        } catch (error) {
          logger.error('Payout retry failed', {
            payoutId,
            attempt: failureRecord.attempt,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Update failure record
          failureRecord.attempt++;
          if (failureRecord.attempt > 3) {
            // Max retries reached - require manual intervention
            logger.error('Payout max retries exceeded', { payoutId });
            await this.escalatePayoutFailure(payoutId, failureRecord);
          }
        }
      }
    }
  }

  private shouldProcessPayout(schedule: PayoutSchedule, now: Date): boolean {
    switch (schedule.frequency) {
      case 'daily':
        return true; // Process daily
      
      case 'weekly':
        return now.getDay() === schedule.dayOfWeek;
      
      case 'monthly':
        return now.getDate() === schedule.dayOfMonth;
      
      case 'manual':
        return false; // Never automatically process manual schedules
      
      default:
        return false;
    }
  }

  private sanitizePayoutForReport(payout: any): any {
    return {
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      createdAt: payout.created ? new Date(payout.created * 1000) : null,
      method: payout.method,
      type: payout.type
    };
  }

  private generateFailureAnalysis(payouts: any[]): any {
    const failedPayouts = payouts.filter(p => p.status === 'failed');
    
    const failureReasons: Record<string, number> = {};
    failedPayouts.forEach(payout => {
      const reason = payout.failure_code || 'unknown';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    });

    return {
      totalFailures: failedPayouts.length,
      failureRate: payouts.length > 0 ? failedPayouts.length / payouts.length : 0,
      failureReasons,
      recommendations: this.generateFailureRecommendations(failureReasons)
    };
  }

  private generateFailureRecommendations(failureReasons: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (failureReasons['insufficient_funds']) {
      recommendations.push('Consider implementing balance checks before payout attempts');
    }

    if (failureReasons['account_closed']) {
      recommendations.push('Verify bank account status before processing payouts');
    }

    if (failureReasons['debit_not_authorized']) {
      recommendations.push('Ensure proper authorization for bank account debits');
    }

    return recommendations;
  }

  private async auditLog(
    operation: PaymentOperationType,
    entityType: string,
    entityId: string,
    businessId?: string,
    correlationId?: string,
    success?: boolean,
    error?: any
  ): Promise<void> {
    try {
      const auditLog: PaymentAuditLog = {
        id: uuidv4(),
        operationType: operation,
        entityType,
        entityId,
        businessId,
        timestamp: new Date(),
        correlationId: correlationId || uuidv4(),
        success: success !== undefined ? success : true,
        ipAddress: 'system',
        userAgent: 'payout-service',
        errorCode: error?.code,
        errorMessage: error?.message
      };

      logger.info('Payout audit log', auditLog);

    } catch (logError) {
      logger.error('Failed to create payout audit log', { operation, entityId, error: logError });
    }
  }

  private async notifyPayoutFailure(businessId: string, payoutId: string, reason: string, nextRetry: Date): Promise<void> {
    // In a real implementation, send email/SMS notification
    logger.info('Payout failure notification sent', {
      businessId,
      payoutId,
      reason,
      nextRetry
    });
  }

  private async escalatePayoutFailure(payoutId: string, failureRecord: any): Promise<void> {
    // In a real implementation, create support ticket or alert
    logger.error('Payout failure escalated for manual intervention', {
      payoutId,
      attempts: failureRecord.attempt,
      lastError: failureRecord.lastError
    });
  }

  // Mock database operations (replace with actual database implementation)
  private async getBusinessStripeAccountId(businessId: string): Promise<string> {
    return `acct_${businessId}_stripe`;
  }

  private async savePayoutSchedule(businessId: string, schedule: PayoutSchedule): Promise<void> {
    logger.info('Saved payout schedule to database', { businessId, schedule });
  }

  private async saveBusinessBalance(balance: BusinessBalance): Promise<void> {
    logger.info('Saved business balance to database', { businessId: balance.businessId, balance });
  }

  private async getPayoutsForPeriod(businessId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Mock payout data - in real implementation, query from database/Stripe
    return [
      {
        id: 'po_1234567890',
        amount: 50000, // $500.00
        currency: 'usd',
        status: 'paid',
        created: Math.floor(new Date().getTime() / 1000),
        arrival_date: Math.floor(new Date().getTime() / 1000) + 86400, // +1 day
        method: 'standard',
        type: 'bank_account'
      }
    ];
  }
}