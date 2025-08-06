import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useToast,
  ScrollView,
} from 'native-base';
import { BusinessFormProps, FormFieldError, FormStepId } from './types';
import { BusinessFormData } from '../../../services/businessService';
import { useBusinessStore } from '../../../stores/businessStore';
import { FORM_STEPS, getCurrentStepIndex, getNextStep, getPreviousStep, validateFormData } from './formSteps';

// Enhanced components
import { StepIndicator } from './components/StepIndicator';
import { ValidationSummary } from './components/ValidationSummary';
import { ConfirmationDialog, useConfirmationDialog, DialogConfigs } from './components/ConfirmationDialog';
import { SuccessScreen } from './components/SuccessScreen';

// Step Components
import { BasicInfoStep } from './steps/BasicInfoStep';
import { LocationStep } from './steps/LocationStep';
import { ContactStep } from './steps/ContactStep';
import { BusinessHoursStep } from './steps/BusinessHoursStep';
import { ReviewStep } from './steps/ReviewStep';

export const EnhancedBusinessFormWizard: React.FC<BusinessFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  isEditing = false,
  businessId,
}) => {
  const [currentStepId, setCurrentStepId] = useState<FormStepId>('basic-info');
  const [formData, setFormData] = useState<Partial<BusinessFormData>>(initialData);
  const [errors, setErrors] = useState<FormFieldError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedBusiness, setSubmittedBusiness] = useState<any>(null);
  
  const { isLoading, error, saveDraft, loadDraft, clearDraft } = useBusinessStore();
  const toast = useToast();
  const { dialog, showDialog } = useConfirmationDialog();

  const currentStepIndex = getCurrentStepIndex(currentStepId);
  const currentStep = FORM_STEPS[currentStepIndex];
  const totalSteps = FORM_STEPS.length;

  // Load draft on component mount
  useEffect(() => {
    if (!isEditing && !initialData.name) {
      const draft = loadDraft();
      if (draft) {
        setFormData(draft);
        toast.show({
          title: 'Draft Loaded',
          description: 'We restored your previous progress',
          status: 'info',
        });
      }
    }
  }, [isEditing, initialData.name, loadDraft, toast]);

  // Auto-save draft when form data changes
  useEffect(() => {
    if (!isEditing && Object.keys(formData).length > 0) {
      saveDraft(formData);
    }
  }, [formData, isEditing, saveDraft]);

  // Show error toast when API error occurs
  useEffect(() => {
    if (error) {
      toast.show({
        title: 'Error',
        description: error,
        status: 'error',
      });
    }
  }, [error, toast]);

  const handleDataChange = (updates: Partial<BusinessFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors(prev => prev.filter(error => !updatedFields.includes(error.field)));
  };

  const validateCurrentStep = (): boolean => {
    const stepErrors: FormFieldError[] = [];
    
    if (!currentStep.isValid(formData)) {
      // Add specific validation errors based on step
      for (const field of currentStep.requiredFields) {
        if (!getFieldValue(formData, field)) {
          stepErrors.push({
            field,
            message: `${field} is required`,
          });
        }
      }
    }

    setErrors(stepErrors);
    return stepErrors.length === 0;
  };

  const markStepCompleted = (stepId: string) => {
    setCompletedSteps(prev => {
      if (!prev.includes(stepId)) {
        return [...prev, stepId];
      }
      return prev;
    });
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    // Mark current step as completed
    markStepCompleted(currentStepId);

    const nextStep = getNextStep(currentStepId);
    if (nextStep) {
      setCurrentStepId(nextStep.id as FormStepId);
    }
  };

  const handleStepPress = (stepId: string, stepIndex: number) => {
    // Allow navigation to completed steps or the current step
    if (completedSteps.includes(stepId) || stepIndex <= currentStepIndex) {
      setCurrentStepId(stepId as FormStepId);
    }
  };

  const handlePrevious = () => {
    const previousStep = getPreviousStep(currentStepId);
    if (previousStep) {
      setCurrentStepId(previousStep.id as FormStepId);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps before submission
    const validation = validateFormData(formData);
    if (!validation.isValid) {
      toast.show({
        title: 'Validation Error',
        description: 'Please complete all required fields',
        status: 'error',
      });
      // Navigate to first invalid step
      if (validation.invalidSteps.length > 0) {
        setCurrentStepId(validation.invalidSteps[0] as FormStepId);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await onSubmit(formData as BusinessFormData);
      
      // Clear draft after successful submission
      if (!isEditing) {
        clearDraft();
      }
      
      // Show success screen
      setSubmittedBusiness(result);
      setShowSuccess(true);
      
      toast.show({
        title: 'Success',
        description: isEditing ? 'Business updated successfully' : 'Business created successfully',
        status: 'success',
      });
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (Object.keys(formData).length > 0) {
      showDialog(DialogConfigs.CANCEL_FORM, () => {
        onCancel();
      });
    } else {
      onCancel();
    }
  };

  const renderCurrentStep = () => {
    const stepProps = {
      data: formData,
      onDataChange: handleDataChange,
      onNext: handleNext,
      onPrevious: handlePrevious,
      errors,
      isLoading: isLoading || isSubmitting,
    };

    switch (currentStepId) {
      case 'basic-info':
        return <BasicInfoStep {...stepProps} />;
      case 'location':
        return <LocationStep {...stepProps} />;
      case 'contact':
        return <ContactStep {...stepProps} />;
      case 'hours':
        return <BusinessHoursStep {...stepProps} />;
      case 'review':
        return <ReviewStep {...stepProps} onSubmit={handleSubmit} isEditing={isEditing} />;
      default:
        return null;
    }
  };

  // Show success screen after successful submission
  if (showSuccess && submittedBusiness) {
    return (
      <SuccessScreen
        business={submittedBusiness}
        isEditing={isEditing}
        onViewProfile={() => {
          // Handle view profile navigation
          console.log('Navigate to business profile');
        }}
        onGoToDashboard={() => {
          // Handle dashboard navigation
          console.log('Navigate to dashboard');
        }}
        onShareBusiness={() => {
          // Handle business sharing
          console.log('Share business');
        }}
        onCreateAnother={() => {
          setShowSuccess(false);
          setSubmittedBusiness(null);
          setFormData({});
          setCompletedSteps([]);
          setCurrentStepId('basic-info');
        }}
      />
    );
  }

  return (
    <>
      <Box flex={1} bg="white" safeArea>
        {/* Enhanced Header with Step Indicator */}
        <VStack space={4} px={6} py={4} bg="gray.50">
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="lg" fontWeight="bold">
              {isEditing ? 'Edit Business' : 'Create Business'}
            </Text>
            <Text fontSize="sm" color="gray.600">
              {currentStepIndex + 1} of {totalSteps}
            </Text>
          </HStack>
          
          <StepIndicator
            steps={FORM_STEPS}
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            onStepPress={handleStepPress}
            isNavigationDisabled={isSubmitting}
          />
        </VStack>

        {/* Validation Summary */}
        {errors.length > 0 && (
          <Box px={6} py={2}>
            <ValidationSummary
              errors={errors}
              isCollapsible={true}
              onErrorPress={(field) => {
                // Focus on error field - implementation depends on step component
                console.log('Focus on field:', field);
              }}
            />
          </Box>
        )}

        {/* Form Content */}
        <ScrollView flex={1} px={6} py={4}>
          {renderCurrentStep()}
        </ScrollView>

        {/* Enhanced Navigation Footer */}
        <HStack 
          justifyContent="space-between" 
          alignItems="center" 
          px={6} 
          py={4} 
          bg="gray.50"
          borderTopWidth={1}
          borderTopColor="gray.200"
        >
          <Button
            variant="ghost"
            onPress={currentStepIndex === 0 ? handleCancel : handlePrevious}
            isDisabled={isLoading || isSubmitting}
          >
            {currentStepIndex === 0 ? 'Cancel' : 'Previous'}
          </Button>

          {currentStepId === 'review' ? (
            <Button
              onPress={handleSubmit}
              isLoading={isSubmitting}
              loadingText={isEditing ? 'Updating...' : 'Creating...'}
              colorScheme="blue"
              size="lg"
            >
              {isEditing ? 'Update Business' : 'Create Business'}
            </Button>
          ) : (
            <Button
              onPress={handleNext}
              isDisabled={isLoading}
              colorScheme="blue"
              size="lg"
            >
              Next
            </Button>
          )}
        </HStack>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmationDialog {...dialog} />
    </>
  );
};

// Helper function to get nested field values
function getFieldValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}