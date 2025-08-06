import { useState, useCallback, useEffect } from 'react';
import {
  paymentService,
  PaymentMethod,
} from '../services/paymentService';
import { logger } from '../utils/logger';

interface UsePaymentMethodsReturn {
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  error: string | null;
  loadPaymentMethods: () => Promise<void>;
  addPaymentMethod: (paymentMethodId: string) => Promise<PaymentMethod>;
  deletePaymentMethod: (paymentMethodId: string) => Promise<void>;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<void>;
  clearError: () => void;
  refreshMethods: () => Promise<void>;
}

/**
 * usePaymentMethods Hook
 * 
 * Manages saved payment methods including:
 * - Loading saved payment methods
 * - Adding new payment methods
 * - Deleting payment methods
 * - Setting default payment method
 * - Error handling and loading states
 */
export const usePaymentMethods = (): UsePaymentMethodsReturn => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any existing errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load payment methods from API
  const loadPaymentMethods = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Loading payment methods');

      const methods = await paymentService.getPaymentMethods();
      
      setPaymentMethods(methods);
      
      logger.info('Payment methods loaded successfully', {
        count: methods.length,
        defaultMethodExists: methods.some(method => method.isDefault),
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment methods';
      setError(errorMessage);
      
      logger.error('Failed to load payment methods', {
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add new payment method
  const addPaymentMethod = useCallback(async (paymentMethodId: string): Promise<PaymentMethod> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Adding payment method', { paymentMethodId });

      const newMethod = await paymentService.addPaymentMethod(paymentMethodId);
      
      // Update local state
      setPaymentMethods(prev => {
        const updated = [...prev, newMethod];
        return updated.sort((a, b) => {
          // Sort by default first, then by creation date
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return new Date(b.created).getTime() - new Date(a.created).getTime();
        });
      });
      
      logger.info('Payment method added successfully', {
        paymentMethodId: newMethod.id,
        type: newMethod.type,
        cardBrand: newMethod.card?.brand,
        last4: newMethod.card?.last4,
      });

      return newMethod;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add payment method';
      setError(errorMessage);
      
      logger.error('Failed to add payment method', {
        error: errorMessage,
        paymentMethodId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete payment method
  const deletePaymentMethod = useCallback(async (paymentMethodId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Deleting payment method', { paymentMethodId });

      await paymentService.deletePaymentMethod(paymentMethodId);
      
      // Update local state
      setPaymentMethods(prev => prev.filter(method => method.id !== paymentMethodId));
      
      logger.info('Payment method deleted successfully', {
        paymentMethodId,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete payment method';
      setError(errorMessage);
      
      logger.error('Failed to delete payment method', {
        error: errorMessage,
        paymentMethodId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set default payment method
  const setDefaultPaymentMethod = useCallback(async (paymentMethodId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Setting default payment method', { paymentMethodId });

      await paymentService.setDefaultPaymentMethod(paymentMethodId);
      
      // Update local state
      setPaymentMethods(prev => prev.map(method => ({
        ...method,
        isDefault: method.id === paymentMethodId,
      })));
      
      logger.info('Default payment method set successfully', {
        paymentMethodId,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default payment method';
      setError(errorMessage);
      
      logger.error('Failed to set default payment method', {
        error: errorMessage,
        paymentMethodId,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh payment methods (alias for loadPaymentMethods)
  const refreshMethods = useCallback(async (): Promise<void> => {
    await loadPaymentMethods();
  }, [loadPaymentMethods]);

  // Auto-load payment methods on mount
  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  return {
    paymentMethods,
    isLoading,
    error,
    loadPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    clearError,
    refreshMethods,
  };
};