import { FormStep } from './types';
import { BusinessFormData } from '../../../services/businessService';

export const FORM_STEPS: FormStep[] = [
  {
    id: 'basic-info',
    title: 'Basic Information',
    description: 'Tell us about your business',
    requiredFields: ['name', 'categories'],
    isValid: (data: Partial<BusinessFormData>) => {
      return !!(
        data.name?.trim() &&
        data.categories?.length &&
        data.categories.length > 0
      );
    },
  },
  {
    id: 'location',
    title: 'Location Details',
    description: 'Where is your business located?',
    requiredFields: ['location'],
    isValid: (data: Partial<BusinessFormData>) => {
      const { location } = data;
      return !!(
        location?.address?.trim() &&
        location?.city?.trim() &&
        location?.state?.trim() &&
        location?.zipCode?.trim()
      );
    },
  },
  {
    id: 'contact',
    title: 'Contact Information',
    description: 'How can customers reach you?',
    requiredFields: ['contact'],
    isValid: (data: Partial<BusinessFormData>) => {
      const { contact } = data;
      // At least one contact method is required
      return !!(
        contact?.phone?.trim() ||
        contact?.email?.trim() ||
        contact?.website?.trim()
      );
    },
  },
  {
    id: 'hours',
    title: 'Business Hours',
    description: 'When are you open?',
    requiredFields: ['hours'],
    isValid: (data: Partial<BusinessFormData>) => {
      const { hours } = data;
      if (!hours) return false;
      
      // At least one day should have hours set
      const hasAtLeastOneDay = Object.values(hours).some(dayHours => 
        dayHours.closed === true || (dayHours.open && dayHours.close)
      );
      
      return hasAtLeastOneDay;
    },
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Review your business information',
    requiredFields: [],
    isValid: () => true, // Review step is always valid
  },
];

export const getCurrentStepIndex = (stepId: string): number => {
  return FORM_STEPS.findIndex(step => step.id === stepId);
};

export const getStepById = (stepId: string): FormStep | undefined => {
  return FORM_STEPS.find(step => step.id === stepId);
};

export const getNextStep = (currentStepId: string): FormStep | null => {
  const currentIndex = getCurrentStepIndex(currentStepId);
  if (currentIndex === -1 || currentIndex >= FORM_STEPS.length - 1) {
    return null;
  }
  return FORM_STEPS[currentIndex + 1];
};

export const getPreviousStep = (currentStepId: string): FormStep | null => {
  const currentIndex = getCurrentStepIndex(currentStepId);
  if (currentIndex <= 0) {
    return null;
  }
  return FORM_STEPS[currentIndex - 1];
};

export const validateFormData = (data: Partial<BusinessFormData>): {
  isValid: boolean;
  invalidSteps: string[];
} => {
  const invalidSteps: string[] = [];
  
  for (const step of FORM_STEPS) {
    if (step.id !== 'review' && !step.isValid(data)) {
      invalidSteps.push(step.id);
    }
  }
  
  return {
    isValid: invalidSteps.length === 0,
    invalidSteps,
  };
};