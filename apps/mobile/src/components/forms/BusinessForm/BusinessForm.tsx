import React from 'react';
import { BusinessFormWizard } from './BusinessFormWizard';
import { BusinessFormProps } from './types';
import { useBusinessStore } from '../../../stores/businessStore';
import { BusinessFormData } from '../../../services/businessService';

export const BusinessForm: React.FC<BusinessFormProps> = (props) => {
  const { createBusiness, updateBusiness, clearDraft } = useBusinessStore();

  const handleSubmit = async (formData: BusinessFormData) => {
    try {
      if (props.isEditing && props.businessId) {
        await updateBusiness(props.businessId, formData);
      } else {
        await createBusiness(formData);
        // Clear draft after successful creation
        clearDraft();
      }
      
      // Call the onSubmit prop if provided for additional handling
      if (props.onSubmit) {
        await props.onSubmit(formData);
      }
    } catch (error) {
      // Error handling is managed by the store and displayed in the UI
      throw error;
    }
  };

  return (
    <BusinessFormWizard
      {...props}
      onSubmit={handleSubmit}
    />
  );
};