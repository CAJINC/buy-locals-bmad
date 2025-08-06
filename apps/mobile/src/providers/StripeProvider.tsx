import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { StripeProvider as StripeSDKProvider } from '@stripe/stripe-react-native';
import { logger } from '../utils/logger';

interface StripeContextType {
  publishableKey: string | null;
  merchantIdentifier?: string;
  isInitialized: boolean;
  error: string | null;
}

const StripeContext = createContext<StripeContextType>({
  publishableKey: null,
  isInitialized: false,
  error: null,
});

interface StripeProviderProps {
  children: React.ReactNode;
}

/**
 * Stripe Provider Component
 * 
 * Initializes Stripe SDK with publishable key and configures
 * Apple Pay and Google Pay merchant information
 */
export const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [merchantIdentifier, setMerchantIdentifier] = useState<string>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeStripe();
  }, []);

  const initializeStripe = async () => {
    try {
      // Get publishable key from environment or config
      const stripePublishableKey = await getStripePublishableKey();
      
      if (!stripePublishableKey) {
        throw new Error('Stripe publishable key not configured');
      }

      // Validate key format
      if (!stripePublishableKey.startsWith('pk_')) {
        throw new Error('Invalid Stripe publishable key format');
      }

      setPublishableKey(stripePublishableKey);

      // Set merchant identifier for Apple Pay (iOS only)
      if (Platform.OS === 'ios') {
        const merchantId = await getMerchantIdentifier();
        setMerchantIdentifier(merchantId);
      }

      setIsInitialized(true);
      logger.info('Stripe SDK initialized successfully', {
        platform: Platform.OS,
        merchantIdentifier: Platform.OS === 'ios' ? merchantIdentifier : undefined,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Stripe';
      setError(errorMessage);
      logger.error('Stripe initialization failed', {
        error: errorMessage,
        platform: Platform.OS,
      });
    }
  };

  const getStripePublishableKey = async (): Promise<string | null> => {
    // In production, this would fetch from your backend or secure config
    // For now, using environment variable approach
    return process.env.STRIPE_PUBLISHABLE_KEY || null;
  };

  const getMerchantIdentifier = async (): Promise<string> => {
    // Apple Pay merchant identifier
    return process.env.APPLE_PAY_MERCHANT_ID || 'merchant.com.buylocals.app';
  };

  const contextValue: StripeContextType = {
    publishableKey,
    merchantIdentifier,
    isInitialized,
    error,
  };

  if (error) {
    logger.error('Stripe provider error', { error });
    // In production, you might want to show an error component
    // For now, we'll still render children but Stripe functionality won't work
  }

  if (!publishableKey) {
    // Still loading, render children but Stripe won't be available yet
    return (
      <StripeContext.Provider value={contextValue}>
        {children}
      </StripeContext.Provider>
    );
  }

  return (
    <StripeSDKProvider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
      // Configure additional settings
      stripeAccountId={undefined} // Use for Connect platforms
      threeDSecureParams={{
        timeout: 5, // 5 minutes timeout for 3D Secure
      }}
      // Enable Google Pay for Android
      googlePay={{
        testEnv: __DEV__, // Use test environment in development
        merchantName: 'Buy Locals',
        merchantCountryCode: 'US',
        billingAddressConfig: {
          format: 'FULL',
          isPhoneNumberRequired: true,
          isRequired: false,
        },
        shippingAddressConfig: {
          allowedCountryCodes: ['US', 'CA'],
          isPhoneNumberRequired: false,
        },
        isEmailRequired: true,
      }}
      // Enable Apple Pay for iOS
      applePay={{
        merchantCountryCode: 'US',
        currencyCode: 'USD',
        supportedNetworks: [
          'Visa',
          'MasterCard',
          'AmericanExpress',
          'Discover',
        ],
        requiredBillingContactFields: [
          'PhoneNumber',
          'Name',
        ],
        requiredShippingContactFields: [],
      }}
    >
      <StripeContext.Provider value={contextValue}>
        {children}
      </StripeContext.Provider>
    </StripeSDKProvider>
  );
};

/**
 * Hook to access Stripe context
 */
export const useStripe = (): StripeContextType => {
  const context = useContext(StripeContext);
  if (!context) {
    throw new Error('useStripe must be used within a StripeProvider');
  }
  return context;
};

export default StripeProvider;