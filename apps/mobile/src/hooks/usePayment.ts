import { useState, useCallback } from 'react';
import {
  paymentService,
  PaymentIntent,
  CreatePaymentIntentParams,
  ConfirmPaymentParams,
  PaymentStatus,
} from '../services/paymentService';
import { logger } from '../utils/logger';

interface UsePaymentReturn {
  isLoading: boolean;
  error: string | null;
  createPaymentIntent: (params: CreatePaymentIntentParams) => Promise<PaymentIntent>;
  confirmPayment: (params: ConfirmPaymentParams) => Promise<PaymentIntent>;
  getPaymentStatus: (paymentIntentId: string) => Promise<PaymentStatus>;
  capturePayment: (paymentIntentId: string, amountToCapture?: number) => Promise<PaymentIntent>;
  clearError: () => void;
}

/**
 * usePayment Hook
 * 
 * Provides payment processing functionality including:
 * - Creating payment intents
 * - Confirming payments
 * - Getting payment status
 * - Capturing payments from escrow
 * - Error handling and loading states
 */
export const usePayment = (): UsePaymentReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any existing errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Create payment intent
  const createPaymentIntent = useCallback(async (params: CreatePaymentIntentParams): Promise<PaymentIntent> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Creating payment intent', {
        businessId: params.businessId,
        amount: params.amount,
        currency: params.currency,
        escrowEnabled: !params.automaticCapture,
      });

      const paymentIntent = await paymentService.createPaymentIntent(params);
      
      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        escrowEnabled: paymentIntent.escrowEnabled,
      });

      return paymentIntent;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create payment intent';
      setError(errorMessage);
      
      logger.error('Payment intent creation failed', {
        error: errorMessage,
        businessId: params.businessId,
        amount: params.amount,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Confirm payment
  const confirmPayment = useCallback(async (params: ConfirmPaymentParams): Promise<PaymentIntent> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Confirming payment', {
        paymentIntentId: params.paymentIntentId,
        paymentMethodId: params.paymentMethodId,
      });

      const confirmedPayment = await paymentService.confirmPayment(params);
      
      logger.info('Payment confirmed successfully', {
        paymentIntentId: confirmedPayment.id,
        status: confirmedPayment.status,
      });

      return confirmedPayment;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm payment';
      setError(errorMessage);
      
      logger.error('Payment confirmation failed', {
        error: errorMessage,
        paymentIntentId: params.paymentIntentId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get payment status
  const getPaymentStatus = useCallback(async (paymentIntentId: string): Promise<PaymentStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Getting payment status', { paymentIntentId });

      const status = await paymentService.getPaymentStatus(paymentIntentId);
      
      logger.debug('Payment status retrieved', {
        paymentIntentId,
        status: status.status,
      });

      return status;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get payment status';
      setError(errorMessage);
      
      logger.error('Failed to get payment status', {
        error: errorMessage,
        paymentIntentId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Capture payment from escrow
  const capturePayment = useCallback(async (paymentIntentId: string, amountToCapture?: number): Promise<PaymentIntent> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Capturing payment from escrow', {
        paymentIntentId,
        amountToCapture,
      });

      const capturedPayment = await paymentService.capturePayment(paymentIntentId, amountToCapture);
      
      logger.info('Payment captured successfully from escrow', {
        paymentIntentId: capturedPayment.id,
        status: capturedPayment.status,
      });

      return capturedPayment;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture payment';
      setError(errorMessage);
      
      logger.error('Payment capture failed', {
        error: errorMessage,
        paymentIntentId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createPaymentIntent,
    confirmPayment,
    getPaymentStatus,
    capturePayment,
    clearError,
  };
};