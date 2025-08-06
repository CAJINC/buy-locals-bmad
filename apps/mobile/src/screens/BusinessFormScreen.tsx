import React from 'react';
import { Box, useToast } from 'native-base';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BusinessFormWizard } from '../components/forms/BusinessForm/BusinessFormWizard';
import { BusinessFormData } from '../services/businessService';
import { useBusinessStore } from '../stores/businessStore';

type BusinessFormScreenRouteProp = RouteProp<RootStackParamList, 'BusinessForm'>;
type BusinessFormScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessForm'>;

interface BusinessFormScreenProps {}

export const BusinessFormScreen: React.FC<BusinessFormScreenProps> = () => {
  const navigation = useNavigation<BusinessFormScreenNavigationProp>();
  const route = useRoute<BusinessFormScreenRouteProp>();
  const toast = useToast();
  
  const { createBusiness, isLoading, error } = useBusinessStore();

  const handleSubmit = async (formData: BusinessFormData) => {
    try {
      const result = await createBusiness(formData);
      
      // Navigation will be handled by the BusinessFormWizard component
      // after showing the success screen
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create business';
      toast.show({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
      throw error;
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <Box flex={1} bg="white">
      <BusinessFormWizard
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditing={false}
      />
    </Box>
  );
};