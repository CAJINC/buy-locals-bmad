import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TabNavigator } from './TabNavigator';
import { BusinessFormScreen } from '../screens/BusinessFormScreen';
import { BusinessProfileScreen } from '../screens/BusinessProfileScreen';
import { BusinessDashboardScreen } from '../screens/BusinessDashboardScreen';
import { BusinessResponseDto } from '@buy-locals/shared';

export type RootStackParamList = {
  Main: undefined;
  BusinessForm: undefined;
  BusinessProfile: { businessId: string; business?: BusinessResponseDto };
  BusinessDashboard: undefined;
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
    </Stack.Navigator>
  );
};