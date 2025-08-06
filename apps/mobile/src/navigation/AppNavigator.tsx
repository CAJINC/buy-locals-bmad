import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TabNavigator } from './TabNavigator';
import { BusinessFormScreen } from '../screens/BusinessFormScreen';
import { BusinessProfileScreen } from '../screens/BusinessProfileScreen';
import { BusinessDashboardScreen } from '../screens/BusinessDashboardScreen';
import { PaymentFlowScreen } from '../screens/PaymentFlowScreen';
import { PaymentSuccessScreen } from '../screens/PaymentSuccessScreen';
import { PaymentMethodsScreen } from '../screens/PaymentMethodsScreen';
import { BusinessResponseDto } from '@buy-locals/shared';

export type RootStackParamList = {
  Main: undefined;
  BusinessForm: undefined;
  BusinessProfile: { businessId: string; business?: BusinessResponseDto };
  BusinessDashboard: undefined;
  PaymentFlow: {
    amount: number;
    currency: string;
    businessId: string;
    reservationId?: string;
    serviceId?: string;
    description?: string;
    escrowReleaseDate?: string;
  };
  PaymentSuccess: {
    paymentResult: {
      paymentIntent?: any;
      amount: number;
      currency: string;
      paymentMethod?: string;
      transactionId?: string;
      businessName?: string;
      serviceName?: string;
      confirmationCode?: string;
      receiptUrl?: string;
      estimatedDelivery?: string;
    };
  };
  PaymentMethods: undefined;
  // Add other screens here as needed
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen 
        name="BusinessForm" 
        component={BusinessFormScreen}
        options={{
          headerShown: true,
          title: 'Create Business Profile',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="BusinessProfile" 
        component={BusinessProfileScreen}
        options={{
          headerShown: true,
          title: 'Business Profile',
        }}
      />
      <Stack.Screen 
        name="BusinessDashboard" 
        component={BusinessDashboardScreen}
        options={{
          headerShown: true,
          title: 'Business Dashboard',
        }}
      />
      <Stack.Screen 
        name="PaymentFlow" 
        component={PaymentFlowScreen}
        options={{
          headerShown: true,
          title: 'Payment',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="PaymentSuccess" 
        component={PaymentSuccessScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="PaymentMethods" 
        component={PaymentMethodsScreen}
        options={{
          headerShown: true,
          title: 'Payment Methods',
        }}
      />
    </Stack.Navigator>
  );
};