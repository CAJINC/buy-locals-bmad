import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { styles } from './styles';
import { BookingConfirmation } from '../BookingConfirmation/BookingConfirmation';
import type { BookingFormProps, BookingFormData, ValidationErrors } from './types';

export const BookingForm: React.FC<BookingFormProps> = ({
  selectedTimeSlot,
  businessInfo,
  serviceInfo,
  onSubmit,
  onCancel,
  onSuccess,
  onError,
  theme = 'light',
  prefillUserData,
}) => {
  const [formData, setFormData] = useState<BookingFormData>({
    customerInfo: {
      name: prefillUserData?.name || '',
      phone: prefillUserData?.phone || '',
      email: prefillUserData?.email || '',
    },
    notes: '',
    totalAmount: serviceInfo?.price || selectedTimeSlot?.price || 0,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<Record<string, unknown> | null>(null);

  // Real-time validation
  const validateField = useCallback((field: string, value: string): string | null => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 100) return 'Name cannot exceed 100 characters';
        return null;

      case 'phone': {
        if (!value.trim()) return 'Phone number is required';
        const phoneRegex = /^\+?[\d\s-().]{10,20}$/;
        if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
        return null;
      }

      case 'email': {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        if (value.length > 255) return 'Email cannot exceed 255 characters';
        return null;
      }

      case 'notes':
        if (value.length > 1000) return 'Notes cannot exceed 1000 characters';
        return null;

      default:
        return null;
    }
  }, []);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    
    // Validate customer info
    const nameError = validateField('name', formData.customerInfo.name);
    const phoneError = validateField('phone', formData.customerInfo.phone);
    const emailError = validateField('email', formData.customerInfo.email);
    const notesError = validateField('notes', formData.notes);

    if (nameError) newErrors.name = nameError;
    if (phoneError) newErrors.phone = phoneError;
    if (emailError) newErrors.email = emailError;
    if (notesError) newErrors.notes = notesError;

    // Check if time slot is still valid
    if (!selectedTimeSlot) {
      newErrors.timeSlot = 'Please select a time slot';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedTimeSlot, validateField]);

  // Handle field changes with validation
  const handleFieldChange = useCallback((field: keyof BookingFormData['customerInfo'] | 'notes', value: string) => {
    if (field === 'notes') {
      setFormData(prev => ({ ...prev, notes: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        customerInfo: {
          ...prev.customerInfo,
          [field]: value,
        },
      }));
    }

    // Clear error for this field and validate
    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
  }, [validateField]);

  // Format time display
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  // Format date display
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Calculate total amount
  const totalAmount = serviceInfo?.price || selectedTimeSlot?.price || 0;

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Please correct the errors', 'Check your information and try again.');
      return;
    }

    if (!selectedTimeSlot || !businessInfo) {
      Alert.alert('Missing Information', 'Please ensure all booking details are selected.');
      return;
    }

    setLoading(true);
    
    try {
      const bookingData = {
        businessId: businessInfo.id,
        serviceId: serviceInfo?.id || selectedTimeSlot.serviceId || 'default-service',
        scheduledAt: selectedTimeSlot.startTime,
        duration: serviceInfo?.duration || 60,
        customerInfo: formData.customerInfo,
        notes: formData.notes,
        totalAmount,
      };

      // Submit booking
      const booking = await onSubmit(bookingData);
      
      if (booking) {
        setSubmittedBooking(booking);
        setShowConfirmation(true);
        onSuccess?.(booking);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create booking. Please try again.';
      Alert.alert('Booking Failed', errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    validateForm,
    selectedTimeSlot,
    businessInfo,
    serviceInfo,
    formData,
    totalAmount,
    onSubmit,
    onSuccess,
    onError,
  ]);

  // Handle confirmation close
  const handleConfirmationClose = useCallback(() => {
    setShowConfirmation(false);
    // Could navigate back or reset form here
  }, []);

  if (showConfirmation && submittedBooking) {
    return (
      <BookingConfirmation
        booking={submittedBooking}
        businessInfo={businessInfo}
        serviceInfo={serviceInfo}
        onClose={handleConfirmationClose}
        theme={theme}
      />
    );
  }

  if (!selectedTimeSlot || !businessInfo) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Please select a time slot to continue</Text>
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Summary */}
        <View style={[styles.summaryContainer, theme === 'dark' && styles.summaryContainerDark]}>
          <Text style={[styles.summaryTitle, theme === 'dark' && styles.summaryTitleDark]}>
            Booking Summary
          </Text>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
              Business:
            </Text>
            <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
              {businessInfo.name}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
              Service:
            </Text>
            <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
              {serviceInfo?.name || 'Standard Service'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
              Date:
            </Text>
            <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
              {formatDate(selectedTimeSlot.startTime)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
              Time:
            </Text>
            <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
              {formatTime(selectedTimeSlot.startTime)} - {formatTime(selectedTimeSlot.endTime)}
            </Text>
          </View>

          {totalAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Price:
              </Text>
              <Text style={[styles.summaryPrice, theme === 'dark' && styles.summaryPriceDark]}>
                ${totalAmount.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Customer Information Form */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            Your Information
          </Text>

          {/* Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, theme === 'dark' && styles.fieldLabelDark]}>
              Full Name *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                theme === 'dark' && styles.textInputDark,
                errors.name && styles.textInputError,
              ]}
              value={formData.customerInfo.name}
              onChangeText={(value) => handleFieldChange('name', value)}
              placeholder="Enter your full name"
              placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel="Full name input"
              accessibilityHint="Enter your full name for the booking"
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
          </View>

          {/* Phone Field */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, theme === 'dark' && styles.fieldLabelDark]}>
              Phone Number *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                theme === 'dark' && styles.textInputDark,
                errors.phone && styles.textInputError,
              ]}
              value={formData.customerInfo.phone}
              onChangeText={(value) => handleFieldChange('phone', value)}
              placeholder="(555) 123-4567"
              placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
              keyboardType="phone-pad"
              returnKeyType="next"
              accessibilityLabel="Phone number input"
              accessibilityHint="Enter your phone number for booking contact"
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          {/* Email Field */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, theme === 'dark' && styles.fieldLabelDark]}>
              Email Address *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                theme === 'dark' && styles.textInputDark,
                errors.email && styles.textInputError,
              ]}
              value={formData.customerInfo.email}
              onChangeText={(value) => handleFieldChange('email', value)}
              placeholder="your@email.com"
              placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="Email address input"
              accessibilityHint="Enter your email address for booking confirmation"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Notes Field */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, theme === 'dark' && styles.fieldLabelDark]}>
              Special Requests (Optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMultiline,
                theme === 'dark' && styles.textInputDark,
                errors.notes && styles.textInputError,
              ]}
              value={formData.notes}
              onChangeText={(value) => handleFieldChange('notes', value)}
              placeholder="Any special requests or notes..."
              placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
              multiline
              numberOfLines={4}
              maxLength={1000}
              returnKeyType="done"
              accessibilityLabel="Special requests input"
              accessibilityHint="Enter any special requests for your booking"
            />
            <Text style={[styles.characterCount, theme === 'dark' && styles.characterCountDark]}>
              {formData.notes.length}/1000
            </Text>
            {errors.notes && (
              <Text style={styles.errorText}>{errors.notes}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, theme === 'dark' && styles.actionContainerDark]}>
        <TouchableOpacity
          style={[styles.cancelButton, theme === 'dark' && styles.cancelButtonDark]}
          onPress={onCancel}
          disabled={loading}
          accessibilityLabel="Cancel booking"
          accessibilityRole="button"
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
          accessibilityLabel="Confirm booking"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.submitButtonText}>Creating Booking...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>
              {totalAmount > 0 ? `Book Now - $${totalAmount.toFixed(2)}` : 'Book Now'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};