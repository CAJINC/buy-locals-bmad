import { useEffect, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { deepLinkingService, PaymentDeepLinkParams } from '../services/deepLinkingService';
import { logger } from '../utils/logger';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface UsePaymentDeepLinkingOptions {
  onPaymentResult?: (params: PaymentDeepLinkParams) => void;
  autoNavigate?: boolean;
}

/**
 * usePaymentDeepLinking Hook
 * 
 * Handles payment-related deep linking including:
 * - Payment result handling from external sources (Stripe, etc.)
 * - Automatic navigation based on payment status
 * - Custom callback support for payment results
 */
export const usePaymentDeepLinking = (options: UsePaymentDeepLinkingOptions = {}) => {
  const navigation = useNavigation<NavigationProp>();
  const { onPaymentResult, autoNavigate = true } = options;
  const callbackRef = useRef(onPaymentResult);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onPaymentResult;
  }, [onPaymentResult]);

  // Handle payment result from deep link
  const handlePaymentResult = useCallback((params: PaymentDeepLinkParams) => {
    logger.info('Payment deep link result received', {
      status: params.status,
      transactionId: params.transactionId,
      paymentIntentId: params.paymentIntentId,
      autoNavigate,
    });

    // Call custom callback if provided
    if (callbackRef.current) {
      callbackRef.current(params);
    }

    // Auto-navigate based on payment status
    if (autoNavigate) {
      switch (params.status) {
        case 'success':
          // Navigate to success screen with payment details
          navigation.navigate('PaymentSuccess', {
            paymentResult: {
              amount: 0, // This would come from payment context or be passed in params
              currency: 'USD', // This would come from payment context or be passed in params
              paymentIntent: { id: params.paymentIntentId },
              paymentMethod: undefined,
              transactionId: params.transactionId,
              businessName: undefined,
              serviceName: undefined,
              confirmationCode: params.transactionId, // Use transaction ID as confirmation
              receiptUrl: params.redirectUrl,
            },
          });
          break;

        case 'failed':
          // Show error and navigate back
          logger.error('Payment failed via deep link', {
            errorCode: params.errorCode,
            errorMessage: params.errorMessage,
          });
          
          // You could show an alert here or navigate to an error screen
          navigation.goBack();
          break;

        case 'cancelled':
          // Navigate back to previous screen
          logger.info('Payment cancelled via deep link');
          navigation.goBack();
          break;

        default:
          logger.warn('Unknown payment status in deep link', {
            status: params.status,
          });
          break;
      }
    }
  }, [navigation, autoNavigate]);

  // Initialize deep linking when hook is used
  useEffect(() => {
    // Set up payment result callback
    deepLinkingService.setPaymentResultCallback(handlePaymentResult);

    // Check for any pending payment results
    const pendingResult = deepLinkingService.getAndClearLastPaymentResult();
    if (pendingResult) {
      handlePaymentResult(pendingResult);
    }

    // Initialize deep linking service if not already initialized
    deepLinkingService.initialize();

    // Cleanup function
    return () => {
      deepLinkingService.clearPaymentResultCallback();
    };
  }, [handlePaymentResult]);

  // Generate payment return URL for Stripe or other payment providers
  const generatePaymentReturnUrl = useCallback((
    transactionId?: string,
    paymentIntentId?: string
  ): string => {
    return deepLinkingService.generatePaymentResultUrl({
      transactionId,
      paymentIntentId,
      status: 'success', // Default to success, will be updated by actual result
    });
  }, []);

  // Generate payment success URL
  const generatePaymentSuccessUrl = useCallback((
    transactionId: string,
    paymentIntentId?: string
  ): string => {
    return deepLinkingService.generatePaymentSuccessUrl(transactionId, paymentIntentId);
  }, []);

  // Check if URL is a valid payment deep link
  const isPaymentDeepLink = useCallback((url: string): boolean => {
    return deepLinkingService.isValidDeepLink(url);
  }, []);

  return {
    generatePaymentReturnUrl,
    generatePaymentSuccessUrl,
    isPaymentDeepLink,
    handlePaymentResult,
  };
};

/**
 * Utility function to set up deep linking in App.tsx
 */
export const initializePaymentDeepLinking = (): (() => void) => {
  deepLinkingService.initialize();
  
  return () => {
    deepLinkingService.cleanup();
  };
};