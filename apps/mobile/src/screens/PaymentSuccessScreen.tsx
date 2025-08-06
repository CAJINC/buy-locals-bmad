import React, { useCallback } from 'react';
import { View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { PaymentSuccessScreen as PaymentSuccessComponent } from '../components/payment/PaymentSuccessScreen';
import { logger } from '../utils/logger';

type PaymentSuccessScreenProps = StackScreenProps<RootStackParamList, 'PaymentSuccess'>;

/**
 * PaymentSuccessScreen
 * 
 * Screen wrapper for the PaymentSuccessScreen component
 * Handles navigation after successful payment completion
 */
export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  route,
  navigation,
}) => {
  const { paymentResult } = route.params;

  // Handle continue shopping
  const handleContinueShopping = useCallback(() => {
    logger.info('User continuing shopping after payment success', {
      transactionId: paymentResult.transactionId,
    });

    // Navigate back to main app flow
    navigation.popToTop();
  }, [navigation, paymentResult.transactionId]);

  // Handle view receipt
  const handleViewReceipt = useCallback(() => {
    logger.info('User viewing receipt', {
      transactionId: paymentResult.transactionId,
      receiptUrl: paymentResult.receiptUrl,
    });

    // In a real app, you might navigate to a dedicated receipt screen
    // or open the receipt URL in a web view
    // For now, we'll just log the action
  }, [paymentResult]);

  // Handle contact business
  const handleContactBusiness = useCallback(() => {
    logger.info('User contacting business', {
      transactionId: paymentResult.transactionId,
      businessName: paymentResult.businessName,
    });

    // Navigate to business profile or contact screen
    // For now, we'll just log the action
  }, [paymentResult]);

  return (
    <View style={{ flex: 1 }}>
      <PaymentSuccessComponent
        paymentResult={paymentResult}
        onContinueShopping={handleContinueShopping}
        onViewReceipt={handleViewReceipt}
        onContactBusiness={handleContactBusiness}
        theme="light" // You can make this dynamic based on app theme
        showActions={true}
      />
    </View>
  );
};