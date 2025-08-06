import React, { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Progress, Button, useToast, ScrollView } from 'native-base';
import { BusinessFormProps, FormFieldError, FormStepId } from './types';
import { BusinessFormData } from '../../../services/businessService';
import { useBusinessStore } from '../../../stores/businessStore';
import { navigationService } from '../../../services/navigationService';
import {
  FORM_STEPS,
  getCurrentStepIndex,
  getNextStep,
  getPreviousStep,
  validateFormData,
} from './formSteps';

// Enhanced components

// Step Components
import { BasicInfoStep } from './steps/BasicInfoStep';
import { LocationStep } from './steps/LocationStep';
import { ContactStep } from './steps/ContactStep';
import { BusinessHoursStep } from './steps/BusinessHoursStep';
import { ReviewStep } from './steps/ReviewStep';

export const BusinessFormWizard: React.FC<BusinessFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  isEditing = false,
  businessId: _businessId,
}) => {
  const [currentStepId, setCurrentStepId] = useState<FormStepId>('basic-info');
  const [formData, setFormData] = useState<Partial<BusinessFormData>>(initialData);
  const [errors, setErrors] = useState<FormFieldError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isLoading, error, saveDraft, loadDraft, clearDraft } = useBusinessStore();
  const toast = useToast();

  const currentStepIndex = getCurrentStepIndex(currentStepId);
  const currentStep = FORM_STEPS[currentStepIndex];
  const totalSteps = FORM_STEPS.length;
  const progressValue = ((currentStepIndex + 1) / totalSteps) * 100;

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

      // Store the result for success screen
      setSubmittedBusiness(result);
      setShowSuccess(true);

      toast.show({
        title: 'Success',
        description: isEditing ? 'Business updated successfully' : 'Business created successfully',
        status: 'success',
      });

      // Navigate to business profile after a short delay to show success message
      setTimeout(() => {
        if (result && result.id) {
          navigationService.navigateToBusinessProfile(result.id, result);
        }
      }, 2000);
    } catch (error) {
      // Handle form submission error silently or log to error service
    } finally {
      setIsSubmitting(false);
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

  return (
    <Box flex={1} bg="white" safeArea>
      {/* Header with Progress */}
      <VStack space={4} px={6} py={4} bg="gray.50">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="lg" fontWeight="bold">
            {isEditing ? 'Edit Business' : 'Create Business'}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {currentStepIndex + 1} of {totalSteps}
          </Text>
        </HStack>

        <Progress value={progressValue} colorScheme="blue" />

        <VStack space={1}>
          <Text fontSize="md" fontWeight="semibold">
            {currentStep.title}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {currentStep.description}
          </Text>
        </VStack>
      </VStack>

      {/* Form Content */}
      <ScrollView flex={1} px={6} py={4}>
        {renderCurrentStep()}
      </ScrollView>

      {/* Navigation Footer */}
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
          onPress={currentStepIndex === 0 ? onCancel : handlePrevious}
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
          >
            {isEditing ? 'Update Business' : 'Create Business'}
          </Button>
        ) : (
          <Button onPress={handleNext} isDisabled={isLoading} colorScheme="blue">
            Next
          </Button>
        )}
      </HStack>
    </Box>
  );
};

// Helper function to get nested field values
function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => (current as Record<string, unknown>)?.[key], obj);
}
