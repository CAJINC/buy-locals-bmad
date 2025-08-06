import { useState, useCallback } from 'react';
import {
  paymentService,
  RefundRequest,
  RefundResult,
} from '../services/paymentService';
import { logger } from '../utils/logger';

interface UseRefundReturn {
  isLoading: boolean;
  error: string | null;
  processRefund: (request: RefundRequest) => Promise<RefundResult>;
  getRefundStatus: (refundId: string) => Promise<RefundResult>;
  clearError: () => void;
}

/**
 * useRefund Hook
 * 
 * Manages refund operations including:
 * - Processing refunds
 * - Getting refund status
 * - Error handling and loading states
 */
export const useRefund = (): UseRefundReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any existing errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Process a refund
  const processRefund = useCallback(async (request: RefundRequest): Promise<RefundResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Processing refund', {
        transactionId: request.transactionId,
        amount: request.amount,
        reason: request.reason,
      });

      // Validate refund request
      if (!request.transactionId) {
        throw new Error('Transaction ID is required for refund');
      }

      if (request.amount && request.amount <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      const refundResult = await paymentService.processRefund(request);
      
      logger.info('Refund processed successfully', {
        refundId: refundResult.id,
        transactionId: request.transactionId,
        amount: refundResult.amount,
        status: refundResult.status,
        businessAdjustment: refundResult.businessAdjustment,
        platformFeeRefund: refundResult.platformFeeRefund,
      });

      return refundResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process refund';
      setError(errorMessage);
      
      logger.error('Refund processing failed', {
        error: errorMessage,
        transactionId: request.transactionId,
        amount: request.amount,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get refund status
  const getRefundStatus = useCallback(async (refundId: string): Promise<RefundResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Getting refund status', { refundId });

      if (!refundId) {
        throw new Error('Refund ID is required');
      }

      const refundStatus = await paymentService.getRefundStatus(refundId);
      
      logger.debug('Refund status retrieved', {
        refundId,
        status: refundStatus.status,
        amount: refundStatus.amount,
      });

      return refundStatus;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get refund status';
      setError(errorMessage);
      
      logger.error('Failed to get refund status', {
        error: errorMessage,
        refundId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    processRefund,
    getRefundStatus,
    clearError,
  };
};