import { apiService, ApiResponse } from './apiService';
import { logger } from '../utils/logger';

// Payment-related types
export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  escrowEnabled: boolean;
  platformFee: number;
  businessAmount: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  created: string;
}

export interface CreatePaymentIntentParams {
  businessId: string;
  reservationId?: string;
  serviceId?: string;
  amount: number;
  currency: string;
  description?: string;
  automaticCapture?: boolean;
  escrowReleaseDate?: string;
  metadata?: Record<string, string>;
}

export interface ConfirmPaymentParams {
  paymentIntentId: string;
  paymentMethodId: string;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  id: string;
  amount: number;
  reason?: string;
  status: string;
  businessAdjustment: number;
  platformFeeRefund: number;
}

export interface PaymentStatus {
  id: string;
  status: string;
  amount: number;
  currency: string;
  created: string;
  lastUpdated: string;
  escrowStatus?: string;
  refunds?: RefundResult[];
}

/**
 * Payment Service
 * 
 * Handles all payment-related API operations including:
 * - Payment intent creation and confirmation
 * - Payment method management
 * - Refund processing
 * - Payment status tracking
 */
export class PaymentService {
  private readonly baseUrl = '/payment';

  /**
   * Create a payment intent
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    try {
      logger.info('Creating payment intent', {
        businessId: params.businessId,
        amount: params.amount,
        currency: params.currency,
        escrowEnabled: !params.automaticCapture,
      });

      const response = await apiService.post<PaymentIntent>(
        `${this.baseUrl}/create-intent`,
        params,
        { timeout: 15000 } // 15 second timeout for payment operations
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create payment intent');
      }

      logger.info('Payment intent created successfully', {
        paymentIntentId: response.data.id,
        amount: response.data.amount,
        escrowEnabled: response.data.escrowEnabled,
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params: {
          ...params,
          // Don't log sensitive data
          metadata: params.metadata ? Object.keys(params.metadata) : undefined,
        },
      });
      throw error;
    }
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntent> {
    try {
      logger.info('Confirming payment', {
        paymentIntentId: params.paymentIntentId,
        paymentMethodId: params.paymentMethodId,
      });

      const response = await apiService.post<PaymentIntent>(
        `${this.baseUrl}/confirm-payment`,
        params,
        { timeout: 30000 } // 30 second timeout for confirmation
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to confirm payment');
      }

      logger.info('Payment confirmed successfully', {
        paymentIntentId: response.data.id,
        status: response.data.status,
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to confirm payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId: params.paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
    try {
      const response = await apiService.get<PaymentStatus>(
        `${this.baseUrl}/status/${paymentIntentId}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get payment status');
      }

      return response.data;

    } catch (error) {
      logger.error('Failed to get payment status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Capture payment from escrow
   */
  async capturePayment(paymentIntentId: string, amountToCapture?: number): Promise<PaymentIntent> {
    try {
      logger.info('Capturing payment from escrow', {
        paymentIntentId,
        amountToCapture,
      });

      const response = await apiService.post<PaymentIntent>(
        `${this.baseUrl}/capture-payment`,
        {
          paymentIntentId,
          amountToCapture,
        },
        { timeout: 15000 }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to capture payment');
      }

      logger.info('Payment captured successfully', {
        paymentIntentId: response.data.id,
        status: response.data.status,
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to capture payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      logger.info('Processing refund', {
        transactionId: request.transactionId,
        amount: request.amount,
        reason: request.reason,
      });

      const response = await apiService.post<RefundResult>(
        `${this.baseUrl}/process-refund`,
        request,
        { timeout: 15000 }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to process refund');
      }

      logger.info('Refund processed successfully', {
        refundId: response.data.id,
        amount: response.data.amount,
        status: response.data.status,
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to process refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: request.transactionId,
      });
      throw error;
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<RefundResult> {
    try {
      const response = await apiService.get<RefundResult>(
        `${this.baseUrl}/refund-status/${refundId}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get refund status');
      }

      return response.data;

    } catch (error) {
      logger.error('Failed to get refund status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        refundId,
      });
      throw error;
    }
  }

  /**
   * List customer payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await apiService.get<PaymentMethod[]>(
        `${this.baseUrl}/payment-methods`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get payment methods');
      }

      return response.data;

    } catch (error) {
      logger.error('Failed to get payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add a payment method
   */
  async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    try {
      logger.info('Adding payment method', { paymentMethodId });

      const response = await apiService.post<PaymentMethod>(
        `${this.baseUrl}/payment-methods`,
        { paymentMethodId }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to add payment method');
      }

      logger.info('Payment method added successfully', {
        paymentMethodId: response.data.id,
        type: response.data.type,
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to add payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      logger.info('Deleting payment method', { paymentMethodId });

      const response = await apiService.delete(
        `${this.baseUrl}/payment-methods/${paymentMethodId}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete payment method');
      }

      logger.info('Payment method deleted successfully', { paymentMethodId });

    } catch (error) {
      logger.error('Failed to delete payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      logger.info('Setting default payment method', { paymentMethodId });

      const response = await apiService.put(
        `${this.baseUrl}/payment-methods/${paymentMethodId}/default`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to set default payment method');
      }

      logger.info('Default payment method set successfully', { paymentMethodId });

    } catch (error) {
      logger.error('Failed to set default payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;