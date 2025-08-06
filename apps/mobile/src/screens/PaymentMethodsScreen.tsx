import React from 'react';
import { View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { SavedPaymentMethods } from '../components/payment/SavedPaymentMethods';
import { logger } from '../utils/logger';

type PaymentMethodsScreenProps = StackScreenProps<RootStackParamList, 'PaymentMethods'>;

/**
 * PaymentMethodsScreen
 * 
 * Screen for managing saved payment methods
 * Allows users to view, delete, and set default payment methods
 */
export const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({
  navigation,
}) => {
  React.useEffect(() => {
    logger.info('Payment methods screen accessed');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <SavedPaymentMethods
        theme="light" // You can make this dynamic based on app theme
        allowSelection={false}
        allowDeletion={true}
        allowDefault={true}
      />
    </View>
  );
};