import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  CardField,
  useStripe,
  useConfirmPayment,
  CardFieldInput,
} from '@stripe/stripe-react-native';
import { usePayment } from '../../hooks/usePayment';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentSummary } from './PaymentSummary';
import { styles } from './styles';
import { logger } from '../../utils/logger';

export interface PaymentFormProps {
  amount: number;
  currency: string;
  businessId: string;
  reservationId?: string;
  serviceId?: string;
  description?: string;
  escrowReleaseDate?: string;
  onSuccess: (paymentResult: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
  showPaymentMethods?: boolean;
}

interface PaymentFormData {
  paymentMethod: 'card' | 'apple_pay' | 'google_pay' | 'saved_card';
  selectedPaymentMethodId?: string;
  saveCard: boolean;
  billingDetails: {
    name: string;
    email: string;
    phone: string;
  };
}

/**
 * PaymentForm Component
 * 
 * Main payment form with Stripe Elements integration
 * Supports card payments, Apple Pay, Google Pay, and saved payment methods
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  currency,
  businessId,
  reservationId,
  serviceId,
  description,
  escrowReleaseDate,
  onSuccess,
  onError,
  onCancel,
  theme = 'light',
  showPaymentMethods = true,
}) => {
  const { createPaymentSheet, presentPaymentSheet } = useStripe();
  const { confirmPayment } = useConfirmPayment();
  const { createPaymentIntent, isLoading } = usePayment();

  const [formData, setFormData] = useState<PaymentFormData>({
    paymentMethod: 'card',
    saveCard: false,
    billingDetails: {
      name: '',
      email: '',
      phone: '',
    },
  });

  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [paymentSheetReady, setPaymentSheetReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Initialize payment sheet when component mounts
  useEffect(() => {
    initializePaymentSheet();
  }, [amount, currency, businessId]);

  const initializePaymentSheet = useCallback(async () => {
    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntent({
        businessId,
        amount,
        currency,
        description,
        reservationId,
        serviceId,
        escrowReleaseDate,
        automaticCapture: !escrowReleaseDate, // Use escrow if release date provided
      });

      // Initialize payment sheet
      const { error } = await createPaymentSheet({
        paymentIntentClientSecret: paymentIntent.clientSecret,
        merchantDisplayName: 'Buy Locals',
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: formData.billingDetails.name,
          email: formData.billingDetails.email,
          phone: formData.billingDetails.phone,
        },
        returnURL: 'buylocals://payment-result',
        applePay: {
          merchantCountryCode: 'US',
          currencyCode: currency.toUpperCase(),
        },
        googlePay: {
          merchantCountryCode: 'US',
          currencyCode: currency.toUpperCase(),
          testEnv: __DEV__,
        },
        style: theme,
        appearance: {
          colors: {
            primary: theme === 'dark' ? '#4F46E5' : '#3B82F6',
            background: theme === 'dark' ? '#1F2937' : '#FFFFFF',
            componentBackground: theme === 'dark' ? '#374151' : '#F9FAFB',
            componentText: theme === 'dark' ? '#F9FAFB' : '#111827',
            componentBorder: theme === 'dark' ? '#4B5563' : '#D1D5DB',
            primaryText: theme === 'dark' ? '#F9FAFB' : '#111827',
            secondaryText: theme === 'dark' ? '#9CA3AF' : '#6B7280',
            placeholderText: theme === 'dark' ? '#6B7280' : '#9CA3AF',
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setPaymentSheetReady(true);
      logger.info('Payment sheet initialized successfully', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment';
      logger.error('Payment sheet initialization failed', {
        error: errorMessage,
        businessId,
        amount,
      });
      onError(errorMessage);
    }
  }, [
    amount,
    currency,
    businessId,
    description,
    reservationId,
    serviceId,
    escrowReleaseDate,
    formData.billingDetails,
    theme,
    createPaymentIntent,
    createPaymentSheet,
    onError,
  ]);

  // Handle payment method selection
  const handlePaymentMethodChange = useCallback((method: PaymentFormData['paymentMethod'], paymentMethodId?: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethod: method,
      selectedPaymentMethodId: paymentMethodId,
    }));
  }, []);

  // Handle billing details change
  const handleBillingDetailsChange = useCallback((field: keyof PaymentFormData['billingDetails'], value: string) => {
    setFormData(prev => ({
      ...prev,
      billingDetails: {
        ...prev.billingDetails,
        [field]: value,
      },
    }));
  }, []);

  // Handle card details change
  const handleCardDetailsChange = useCallback((details: CardFieldInput.Details) => {
    setCardDetails(details);
  }, []);

  // Process payment using payment sheet (Apple Pay, Google Pay, saved cards)
  const processPaymentSheet = useCallback(async () => {
    if (!paymentSheetReady) {
      onError('Payment sheet not ready');
      return;
    }

    setProcessing(true);

    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code !== 'Canceled') {
          throw new Error(error.message);
        }
        // User canceled - not an error
        return;
      }

      logger.info('Payment completed successfully via payment sheet', {
        paymentMethod: formData.paymentMethod,
        amount,
        currency,
      });

      onSuccess({
        paymentMethod: formData.paymentMethod,
        amount,
        currency,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      logger.error('Payment sheet processing failed', {
        error: errorMessage,
        paymentMethod: formData.paymentMethod,
      });
      onError(errorMessage);
    } finally {
      setProcessing(false);
    }
  }, [paymentSheetReady, presentPaymentSheet, formData.paymentMethod, amount, currency, onSuccess, onError]);

  // Process manual card payment
  const processCardPayment = useCallback(async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Error', 'Please enter complete card details');
      return;
    }

    if (!formData.billingDetails.name || !formData.billingDetails.email) {
      Alert.alert('Error', 'Please enter billing details');
      return;
    }

    setProcessing(true);

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntent({
        businessId,
        amount,
        currency,
        description,
        reservationId,
        serviceId,
        escrowReleaseDate,
        automaticCapture: !escrowReleaseDate,
      });

      // Confirm payment with card
      const { error, paymentIntent: confirmedPayment } = await confirmPayment(
        paymentIntent.clientSecret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: formData.billingDetails,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (confirmedPayment) {
        logger.info('Card payment completed successfully', {
          paymentIntentId: confirmedPayment.id,
          amount,
          currency,
        });

        onSuccess({
          paymentIntent: confirmedPayment,
          paymentMethod: 'card',
          amount,
          currency,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      logger.error('Card payment processing failed', {
        error: errorMessage,
        businessId,
        amount,
      });
      onError(errorMessage);
    } finally {
      setProcessing(false);
    }
  }, [
    cardDetails,
    formData.billingDetails,
    businessId,
    amount,
    currency,
    description,
    reservationId,
    serviceId,
    escrowReleaseDate,
    createPaymentIntent,
    confirmPayment,
    onSuccess,
    onError,
  ]);

  // Handle payment submission
  const handlePayment = useCallback(async () => {
    if (processing) return;

    try {
      if (formData.paymentMethod === 'card') {
        await processCardPayment();
      } else {
        await processPaymentSheet();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      onError(errorMessage);
    }
  }, [formData.paymentMethod, processing, processCardPayment, processPaymentSheet, onError]);

  const isPaymentReady = 
    (formData.paymentMethod === 'card' && cardDetails?.complete && formData.billingDetails.name && formData.billingDetails.email) ||
    (formData.paymentMethod !== 'card' && paymentSheetReady);

  return (
    <KeyboardAvoidingView
      style={[styles.container, theme === 'dark' && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Summary */}
        <PaymentSummary
          amount={amount}
          currency={currency}
          description={description}
          theme={theme}
        />

        {/* Payment Method Selection */}
        {showPaymentMethods && (
          <PaymentMethodSelector
            selectedMethod={formData.paymentMethod}
            onMethodSelect={handlePaymentMethodChange}
            theme={theme}
          />
        )}

        {/* Card Input Field (only for manual card entry) */}
        {formData.paymentMethod === 'card' && (
          <View style={[styles.cardFieldContainer, theme === 'dark' && styles.cardFieldContainerDark]}>
            <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
              Card Details
            </Text>
            
            <CardField
              postalCodeEnabled={true}
              placeholder={{
                number: '4242 4242 4242 4242',
                expiration: 'MM/YY',
                cvc: 'CVC',
                postalCode: 'ZIP',
              }}
              cardStyle={{
                backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
                textColor: theme === 'dark' ? '#F9FAFB' : '#111827',
                borderColor: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                borderWidth: 1,
                borderRadius: 8,
                fontSize: 16,
                placeholderColor: theme === 'dark' ? '#6B7280' : '#9CA3AF',
              }}
              style={styles.cardField}
              onCardChange={handleCardDetailsChange}
              accessibilityLabel="Card input field"
              accessibilityHint="Enter your credit card information"
            />

            {!cardDetails?.complete && cardDetails?.validNumber === 'Invalid' && (
              <Text style={styles.errorText}>Please enter a valid card number</Text>
            )}

            {!cardDetails?.complete && cardDetails?.validExpiryDate === 'Invalid' && (
              <Text style={styles.errorText}>Please enter a valid expiry date</Text>
            )}

            {!cardDetails?.complete && cardDetails?.validCVC === 'Invalid' && (
              <Text style={styles.errorText}>Please enter a valid CVC</Text>
            )}
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme === 'dark' ? '#4F46E5' : '#3B82F6'} />
            <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
              Preparing payment...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, theme === 'dark' && styles.actionContainerDark]}>
        <TouchableOpacity
          style={[styles.cancelButton, theme === 'dark' && styles.cancelButtonDark]}
          onPress={onCancel}
          disabled={processing}
          accessibilityLabel="Cancel payment"
          accessibilityRole="button"
        >
          <Text style={[styles.cancelButtonText, theme === 'dark' && styles.cancelButtonTextDark]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.payButton,
            (!isPaymentReady || processing) && styles.payButtonDisabled,
            theme === 'dark' && styles.payButtonDark,
          ]}
          onPress={handlePayment}
          disabled={!isPaymentReady || processing}
          accessibilityLabel={`Pay ${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isPaymentReady || processing }}
        >
          {processing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.payButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.payButtonText}>
              Pay {currency.toUpperCase()} ${(amount / 100).toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};