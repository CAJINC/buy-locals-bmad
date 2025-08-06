import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { styles } from './styles';
import { DynamicFormField } from '../DynamicFormField/DynamicFormField';
import { PricingCalculator } from '../PricingCalculator/PricingCalculator';
import { ReservationSummary } from '../ReservationSummary/ReservationSummary';
import type { 
  AdaptiveReservationFormProps, 
  ReservationFormData, 
  FormValidationErrors,
  ServiceTypeConfig,
  BusinessInfo
} from './types';

export const AdaptiveReservationForm: React.FC<AdaptiveReservationFormProps> = ({
  businessInfo,
  serviceType,
  selectedTimeSlot,
  initialData,
  onSubmit,
  onCancel,
  onPriceChange,
  theme = 'light',
  allowPartialSave = false,
  showPricingBreakdown = true
}) => {
  const [formData, setFormData] = useState<ReservationFormData>(() => ({
    type: serviceType?.category === 'dining' ? 'table' : 'service',
    customerInfo: {
      name: '',
      email: '',
      phone: '',
      ...initialData?.customerInfo
    },
    items: initialData?.items || [],
    requirements: initialData?.requirements || {},
    notes: initialData?.notes || '',
    totalAmount: 0,
    formFields: {},
    ...initialData
  }));

  const [validationErrors, setValidationErrors] = useState<FormValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [pricingInfo, setPricingInfo] = useState<{
    basePrice: number;
    modifiers: Array<{ name: string; amount: number; type: string }>;
    addOns: Array<{ name: string; price: number; quantity: number }>;
    discounts: Array<{ name: string; amount: number; type: string }>;
    totalPrice: number;
  } | null>(null);

  // Get sorted form fields
  const sortedFormFields = useMemo(() => {
    if (!serviceType?.formFields) return [];
    
    return [...serviceType.formFields].sort((a, b) => a.order - b.order);
  }, [serviceType?.formFields]);

  // Calculate pricing when form data changes
  useEffect(() => {
    if (serviceType && showPricingBreakdown) {
      calculatePricing();
    }
  }, [formData.formFields, serviceType, showPricingBreakdown]);

  const calculatePricing = async () => {
    if (!serviceType) return;

    try {
      const response = await fetch(`/api/service-types/${serviceType.id}/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData.formFields),
      });

      if (response.ok) {
        const pricing = await response.json();
        setPricingInfo(pricing);
        
        const newTotalAmount = pricing.totalPrice;
        setFormData(prev => ({ ...prev, totalAmount: newTotalAmount }));
        onPriceChange?.(newTotalAmount, pricing);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    }
  };

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      formFields: {
        ...prev.formFields,
        [fieldName]: value
      }
    }));

    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const { [fieldName]: removed, ...rest } = prev;
        return rest;
      });
    }
  }, [validationErrors]);

  const handleCustomerInfoChange = useCallback((field: keyof ReservationFormData['customerInfo'], value: string) => {
    setFormData(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        [field]: value
      }
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: FormValidationErrors = {};

    // Validate customer info
    if (!formData.customerInfo.name.trim()) {
      errors['customerInfo.name'] = 'Name is required';
    }
    if (!formData.customerInfo.email.trim()) {
      errors['customerInfo.email'] = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.customerInfo.email)) {
      errors['customerInfo.email'] = 'Please enter a valid email address';
    }
    if (!formData.customerInfo.phone.trim()) {
      errors['customerInfo.phone'] = 'Phone number is required';
    }

    // Validate dynamic form fields
    if (serviceType?.formFields) {
      for (const field of serviceType.formFields) {
        const value = formData.formFields[field.fieldName];
        
        // Check if field should be displayed based on conditional logic
        if (field.conditionalDisplay) {
          const shouldShow = evaluateConditionalDisplay(field.conditionalDisplay, formData.formFields);
          if (!shouldShow) continue;
        }

        // Required field validation
        if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
          errors[field.fieldName] = `${field.displayLabel} is required`;
          continue;
        }

        // Custom validation rules
        if (value && field.validation) {
          for (const rule of field.validation) {
            const errorMessage = validateFieldRule(rule, value, field.displayLabel);
            if (errorMessage) {
              errors[field.fieldName] = errorMessage;
              break;
            }
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, serviceType]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please correct the errors in the form.');
      return;
    }

    if (!selectedTimeSlot) {
      Alert.alert('Missing Information', 'Please select a time slot.');
      return;
    }

    setLoading(true);
    
    try {
      const reservationData = {
        businessId: businessInfo.id,
        type: formData.type,
        serviceTypeId: serviceType?.id,
        scheduledAt: selectedTimeSlot.startTime,
        duration: serviceType?.bookingRules.duration || selectedTimeSlot.duration || 60,
        customerInfo: formData.customerInfo,
        items: formData.items,
        requirements: formData.requirements,
        notes: formData.notes,
        totalAmount: formData.totalAmount,
        formFields: formData.formFields,
        holdDurationMinutes: 30 // Hold inventory for 30 minutes
      };

      await onSubmit(reservationData);
    } catch (error) {
      Alert.alert('Reservation Error', 'Failed to create reservation. Please try again.');
      console.error('Submission error:', error);
    } finally {
      setLoading(false);
    }
  }, [validateForm, selectedTimeSlot, businessInfo, serviceType, formData, onSubmit]);

  const handlePartialSave = useCallback(async () => {
    if (!allowPartialSave) return;

    try {
      // Save form state to local storage or API
      const savedData = {
        businessId: businessInfo.id,
        serviceTypeId: serviceType?.id,
        formData,
        savedAt: new Date().toISOString()
      };

      // For now, save to local storage
      // In production, you might want to save to API
      const savedForms = JSON.parse(localStorage.getItem('savedReservationForms') || '[]');
      savedForms.push(savedData);
      localStorage.setItem('savedReservationForms', JSON.stringify(savedForms));

      Alert.alert('Progress Saved', 'Your reservation progress has been saved.');
    } catch (error) {
      console.error('Error saving form progress:', error);
      Alert.alert('Save Error', 'Failed to save progress.');
    }
  }, [allowPartialSave, businessInfo, serviceType, formData]);

  if (!serviceType) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading service configuration...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, theme === 'dark' && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Service Information */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            Service Details
          </Text>
          
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceName, theme === 'dark' && styles.serviceNameDark]}>
              {serviceType.name}
            </Text>
            {serviceType.description && (
              <Text style={[styles.serviceDescription, theme === 'dark' && styles.serviceDescriptionDark]}>
                {serviceType.description}
              </Text>
            )}
            
            <View style={styles.serviceDetails}>
              <Text style={[styles.detailText, theme === 'dark' && styles.detailTextDark]}>
                Duration: {serviceType.bookingRules.duration} minutes
              </Text>
              {serviceType.pricingModel.basePrice > 0 && (
                <Text style={[styles.detailText, theme === 'dark' && styles.detailTextDark]}>
                  Base Price: ${serviceType.pricingModel.basePrice.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Time Slot Summary */}
        {selectedTimeSlot && (
          <ReservationSummary
            timeSlot={selectedTimeSlot}
            businessInfo={businessInfo}
            serviceType={serviceType}
            theme={theme}
          />
        )}

        {/* Dynamic Form Fields */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            Service Requirements
          </Text>

          {sortedFormFields.map((field) => {
            const shouldShow = field.conditionalDisplay
              ? evaluateConditionalDisplay(field.conditionalDisplay, formData.formFields)
              : true;

            if (!shouldShow) return null;

            return (
              <DynamicFormField
                key={field.id}
                config={field}
                value={formData.formFields[field.fieldName]}
                onChange={(value) => handleFieldChange(field.fieldName, value)}
                error={validationErrors[field.fieldName]}
                theme={theme}
                allFormData={formData.formFields}
              />
            );
          })}
        </View>

        {/* Customer Information */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            Your Information
          </Text>

          <DynamicFormField
            config={{
              id: 'customer_name',
              fieldName: 'name',
              displayLabel: 'Full Name',
              fieldType: 'text',
              required: true,
              placeholder: 'Enter your full name',
              order: 1
            }}
            value={formData.customerInfo.name}
            onChange={(value) => handleCustomerInfoChange('name', value as string)}
            error={validationErrors['customerInfo.name']}
            theme={theme}
          />

          <DynamicFormField
            config={{
              id: 'customer_email',
              fieldName: 'email',
              displayLabel: 'Email Address',
              fieldType: 'email',
              required: true,
              placeholder: 'your@email.com',
              order: 2
            }}
            value={formData.customerInfo.email}
            onChange={(value) => handleCustomerInfoChange('email', value as string)}
            error={validationErrors['customerInfo.email']}
            theme={theme}
          />

          <DynamicFormField
            config={{
              id: 'customer_phone',
              fieldName: 'phone',
              displayLabel: 'Phone Number',
              fieldType: 'phone',
              required: true,
              placeholder: '(555) 123-4567',
              order: 3
            }}
            value={formData.customerInfo.phone}
            onChange={(value) => handleCustomerInfoChange('phone', value as string)}
            error={validationErrors['customerInfo.phone']}
            theme={theme}
          />
        </View>

        {/* Additional Notes */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <DynamicFormField
            config={{
              id: 'notes',
              fieldName: 'notes',
              displayLabel: 'Special Requests or Notes',
              fieldType: 'textarea',
              required: false,
              placeholder: 'Any special requests or additional information...',
              order: 999
            }}
            value={formData.notes}
            onChange={(value) => setFormData(prev => ({ ...prev, notes: value as string }))}
            theme={theme}
          />
        </View>

        {/* Pricing Breakdown */}
        {showPricingBreakdown && pricingInfo && (
          <PricingCalculator
            pricingInfo={pricingInfo}
            theme={theme}
          />
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, theme === 'dark' && styles.actionContainerDark]}>
        {allowPartialSave && (
          <TouchableOpacity
            style={[styles.saveButton, theme === 'dark' && styles.saveButtonDark]}
            onPress={handlePartialSave}
            disabled={loading}
          >
            <Text style={[styles.saveButtonText, theme === 'dark' && styles.saveButtonTextDark]}>
              Save Progress
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.cancelButton, theme === 'dark' && styles.cancelButtonDark]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, theme === 'dark' && styles.cancelButtonTextDark]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.submitButtonDisabled,
              theme === 'dark' && styles.submitButtonDark,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.submitButtonText}>Creating...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {formData.totalAmount > 0 
                  ? `Reserve - $${formData.totalAmount.toFixed(2)}` 
                  : 'Create Reservation'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Helper functions
function evaluateConditionalDisplay(
  condition: any,
  formData: Record<string, unknown>
): boolean {
  const fieldValue = formData[condition.field];
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'notEquals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);
    case 'isEmpty':
      return !fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim());
    case 'isNotEmpty':
      return fieldValue && (typeof fieldValue !== 'string' || fieldValue.trim());
    default:
      return true;
  }
}

function validateFieldRule(
  rule: any,
  value: unknown,
  fieldLabel: string
): string | null {
  const stringValue = String(value);
  const numberValue = Number(value);

  switch (rule.type) {
    case 'required':
      return !value || (typeof value === 'string' && !value.trim()) 
        ? rule.message || `${fieldLabel} is required` 
        : null;
    case 'minLength':
      return stringValue.length < rule.value 
        ? rule.message || `${fieldLabel} must be at least ${rule.value} characters`
        : null;
    case 'maxLength':
      return stringValue.length > rule.value 
        ? rule.message || `${fieldLabel} must be less than ${rule.value} characters`
        : null;
    case 'min':
      return numberValue < rule.value 
        ? rule.message || `${fieldLabel} must be at least ${rule.value}`
        : null;
    case 'max':
      return numberValue > rule.value 
        ? rule.message || `${fieldLabel} must be less than ${rule.value}`
        : null;
    case 'email':
      return !/\S+@\S+\.\S+/.test(stringValue) 
        ? rule.message || 'Please enter a valid email address'
        : null;
    case 'phone':
      return !/^[\+]?[\d\s\-\(\)]{10,}$/.test(stringValue) 
        ? rule.message || 'Please enter a valid phone number'
        : null;
    case 'pattern':
      const regex = new RegExp(rule.value);
      return !regex.test(stringValue) 
        ? rule.message || `${fieldLabel} format is invalid`
        : null;
    default:
      return null;
  }
}