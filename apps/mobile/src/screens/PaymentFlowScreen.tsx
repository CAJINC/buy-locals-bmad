import React, { useCallback } from 'react';
import { View, Alert } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { PaymentForm } from '../components/payment/PaymentForm';
import { logger } from '../utils/logger';

type PaymentFlowScreenProps = StackScreenProps<RootStackParamList, 'PaymentFlow'>;

/**
 * PaymentFlowScreen
 * 
 * Main payment processing screen that handles the complete payment flow
 * including payment method selection, processing, and navigation to success
 */
export const PaymentFlowScreen: React.FC<PaymentFlowScreenProps> = ({
  route,
  navigation,
}) => {
  const {
    amount,
    currency,
    businessId,
    reservationId,
    serviceId,
    description,
    escrowReleaseDate,
  } = route.params;

  // Handle successful payment
  const handlePaymentSuccess = useCallback((paymentResult: any) => {
    logger.info('Payment completed successfully, navigating to success screen', {
      amount,
      currency,
      businessId,
      transactionId: paymentResult?.paymentIntent?.id,
    });

    // Navigate to success screen with payment details
    navigation.replace('PaymentSuccess', {
      paymentResult: {
        paymentIntent: paymentResult.paymentIntent,
        amount,
        currency,
        paymentMethod: paymentResult.paymentMethod,
        transactionId: paymentResult?.paymentIntent?.id,
        businessName: paymentResult?.businessName,
        serviceName: paymentResult?.serviceName,
        confirmationCode: paymentResult?.confirmationCode,
        receiptUrl: paymentResult?.receiptUrl,
        estimatedDelivery: paymentResult?.estimatedDelivery,
      },
    });
  }, [navigation, amount, currency, businessId]);

  // Handle payment error
  const handlePaymentError = useCallback((error: string) => {
    logger.error('Payment failed', {
      error,
      amount,
      currency,
      businessId,
    });

    Alert.alert(
      'Payment Failed',
      error,
      [
        {
          text: 'Try Again',
          style: 'default',
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }, [navigation, amount, currency, businessId]);

  // Handle payment cancellation
  const handlePaymentCancel = useCallback(() => {
    logger.info('Payment cancelled by user', {
      amount,
      currency,
      businessId,
    });

    navigation.goBack();
  }, [navigation, amount, currency, businessId]);

  return (
    <View style={{ flex: 1 }}>
      <PaymentForm
        amount={amount}
        currency={currency}
        businessId={businessId}
        reservationId={reservationId}
        serviceId={serviceId}
        description={description}
        escrowReleaseDate={escrowReleaseDate}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        onCancel={handlePaymentCancel}
        theme="light" // You can make this dynamic based on app theme
        showPaymentMethods={true}
      />
    </View>
  );
};