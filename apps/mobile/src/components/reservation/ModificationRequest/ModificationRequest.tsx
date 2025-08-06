import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { styles } from './styles';
import type {
  ModificationRequestProps,
  ModificationChangeType,
  ModificationStep,
  ImpactAnalysis
} from './types';

export const ModificationRequest: React.FC<ModificationRequestProps> = ({
  reservation,
  modificationPolicy,
  onSubmitRequest,
  onCancel,
  theme = 'light'
}) => {
  const [currentStep, setCurrentStep] = useState<ModificationStep>('select_type');
  const [selectedType, setSelectedType] = useState<ModificationChangeType | null>(null);
  const [proposedChanges, setProposedChanges] = useState<Record<string, any>>({});
  const [reason, setReason] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Check if modification type is allowed
  const isTypeAllowed = (type: ModificationChangeType): boolean => {
    return modificationPolicy?.allowedChanges.includes(type) || false;
  };

  // Get modification types with descriptions
  const getModificationTypes = () => {
    const types = [
      {
        type: 'date_time' as ModificationChangeType,
        title: 'Change Date/Time',
        description: 'Reschedule your reservation',
        icon: '📅',
        allowed: isTypeAllowed('date_time')
      },
      {
        type: 'service_type' as ModificationChangeType,
        title: 'Change Service',
        description: 'Switch to a different service',
        icon: '🔧',
        allowed: isTypeAllowed('service_type')
      },
      {
        type: 'duration' as ModificationChangeType,
        title: 'Change Duration',
        description: 'Extend or shorten your appointment',
        icon: '⏱',
        allowed: isTypeAllowed('duration')
      },
      {
        type: 'customer_info' as ModificationChangeType,
        title: 'Update Information',
        description: 'Change contact details or preferences',
        icon: '👤',
        allowed: isTypeAllowed('customer_info')
      },
      {
        type: 'party_size' as ModificationChangeType,
        title: 'Party Size',
        description: 'Change number of people',
        icon: '👥',
        allowed: isTypeAllowed('party_size')
      },
      {
        type: 'special_requests' as ModificationChangeType,
        title: 'Special Requests',
        description: 'Add or modify special requirements',
        icon: '✨',
        allowed: isTypeAllowed('special_requests')
      }
    ].filter(type => type.allowed);

    return types;
  };

  // Handle step navigation
  const nextStep = () => {
    switch (currentStep) {
      case 'select_type':
        if (selectedType) {
          setCurrentStep('make_changes');
        }
        break;
      case 'make_changes':
        if (Object.keys(proposedChanges).length > 0) {
          analyzeImpact();
        }
        break;
      case 'review_impact':
        setCurrentStep('confirm_request');
        break;
      case 'confirm_request':
        submitRequest();
        break;
    }
  };

  const previousStep = () => {
    switch (currentStep) {
      case 'make_changes':
        setCurrentStep('select_type');
        break;
      case 'review_impact':
        setCurrentStep('make_changes');
        break;
      case 'confirm_request':
        setCurrentStep('review_impact');
        break;
    }
  };

  // Analyze modification impact
  const analyzeImpact = async () => {
    if (!selectedType) return;

    setIsAnalyzing(true);
    try {
      // Mock impact analysis - would call actual API
      const mockImpact: ImpactAnalysis = {
        pricingImpact: {
          originalAmount: reservation.totalAmount,
          newAmount: reservation.totalAmount + (selectedType === 'service_type' ? 25 : 0),
          difference: selectedType === 'service_type' ? 25 : 0,
          modificationFee: modificationPolicy?.modificationFee || 0
        },
        availabilityImpact: {
          hasConflicts: selectedType === 'date_time' && Math.random() > 0.7,
          suggestedAlternatives: selectedType === 'date_time' ? [
            new Date(Date.now() + 24 * 60 * 60 * 1000),
            new Date(Date.now() + 48 * 60 * 60 * 1000)
          ] : []
        },
        approvalRequired: modificationPolicy?.requiresApproval || false,
        estimatedProcessingTime: '2-24 hours'
      };

      setImpactAnalysis(mockImpact);
      setCurrentStep('review_impact');
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze modification impact');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit modification request
  const submitRequest = async () => {
    if (!selectedType || !onSubmitRequest) return;

    try {
      await onSubmitRequest({
        type: selectedType,
        proposedChanges,
        reason,
        customerMessage
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit modification request');
    }
  };

  // Handle date/time change
  const handleDateTimeChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setProposedChanges(prev => ({
        ...prev,
        scheduledAt: selectedDate
      }));
    }
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = ['select_type', 'make_changes', 'review_impact', 'confirm_request'];
    const currentIndex = steps.indexOf(currentStep);

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <View key={step} style={styles.stepIndicatorItem}>
            <View style={[
              styles.stepCircle,
              index <= currentIndex && styles.stepCircleActive,
              theme === 'dark' && styles.stepCircleDark
            ]}>
              <Text style={[
                styles.stepNumber,
                index <= currentIndex && styles.stepNumberActive,
                theme === 'dark' && styles.stepNumberDark
              ]}>
                {index + 1}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepConnector,
                index < currentIndex && styles.stepConnectorActive
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render modification type selection
  const renderTypeSelection = () => {
    const types = getModificationTypes();

    return (
      <View style={styles.stepContent}>
        <Text style={[
          styles.stepTitle,
          theme === 'dark' && styles.stepTitleDark
        ]}>
          What would you like to modify?
        </Text>
        <Text style={[
          styles.stepDescription,
          theme === 'dark' && styles.stepDescriptionDark
        ]}>
          Select the type of change you'd like to make to your reservation.
        </Text>

        <View style={styles.typeGrid}>
          {types.map(type => (
            <TouchableOpacity
              key={type.type}
              style={[
                styles.typeCard,
                selectedType === type.type && styles.typeCardSelected,
                theme === 'dark' && styles.typeCardDark
              ]}
              onPress={() => setSelectedType(type.type)}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text style={[
                styles.typeTitle,
                theme === 'dark' && styles.typeTitleDark
              ]}>
                {type.title}
              </Text>
              <Text style={[
                styles.typeDescription,
                theme === 'dark' && styles.typeDescriptionDark
              ]}>
                {type.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render change form based on selected type
  const renderChangeForm = () => {
    if (!selectedType) return null;

    return (
      <View style={styles.stepContent}>
        <Text style={[
          styles.stepTitle,
          theme === 'dark' && styles.stepTitleDark
        ]}>
          Make Your Changes
        </Text>

        {selectedType === 'date_time' && (
          <View style={styles.formSection}>
            <Text style={[
              styles.formLabel,
              theme === 'dark' && styles.formLabelDark
            ]}>
              Current Date & Time
            </Text>
            <Text style={[
              styles.currentValue,
              theme === 'dark' && styles.currentValueDark
            ]}>
              {reservation.scheduledAt.toLocaleString()}
            </Text>

            <TouchableOpacity
              style={[
                styles.dateTimeButton,
                theme === 'dark' && styles.dateTimeButtonDark
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[
                styles.dateTimeButtonText,
                theme === 'dark' && styles.dateTimeButtonTextDark
              ]}>
                {proposedChanges.scheduledAt 
                  ? new Date(proposedChanges.scheduledAt).toLocaleString()
                  : 'Select New Date & Time'
                }
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedType === 'customer_info' && (
          <View style={styles.formSection}>
            <Text style={[
              styles.formLabel,
              theme === 'dark' && styles.formLabelDark
            ]}>
              Contact Information
            </Text>
            <TextInput
              style={[
                styles.textInput,
                theme === 'dark' && styles.textInputDark
              ]}
              placeholder="Phone number"
              placeholderTextColor={theme === 'dark' ? '#666' : '#999'}
              value={proposedChanges.phone || ''}
              onChangeText={(text) => setProposedChanges(prev => ({ ...prev, phone: text }))}
            />
            <TextInput
              style={[
                styles.textInput,
                theme === 'dark' && styles.textInputDark
              ]}
              placeholder="Email address"
              placeholderTextColor={theme === 'dark' ? '#666' : '#999'}
              value={proposedChanges.email || ''}
              onChangeText={(text) => setProposedChanges(prev => ({ ...prev, email: text }))}
            />
          </View>
        )}

        {selectedType === 'special_requests' && (
          <View style={styles.formSection}>
            <Text style={[
              styles.formLabel,
              theme === 'dark' && styles.formLabelDark
            ]}>
              Special Requests
            </Text>
            <TextInput
              style={[
                styles.textArea,
                theme === 'dark' && styles.textAreaDark
              ]}
              placeholder="Describe your special requirements or requests..."
              placeholderTextColor={theme === 'dark' ? '#666' : '#999'}
              value={proposedChanges.specialRequests || ''}
              onChangeText={(text) => setProposedChanges(prev => ({ ...prev, specialRequests: text }))}
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={[
            styles.formLabel,
            theme === 'dark' && styles.formLabelDark
          ]}>
            Reason for Change (Optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              theme === 'dark' && styles.textInputDark
            ]}
            placeholder="Brief reason for this modification"
            placeholderTextColor={theme === 'dark' ? '#666' : '#999'}
            value={reason}
            onChangeText={setReason}
          />
        </View>
      </View>
    );
  };

  // Render impact analysis
  const renderImpactAnalysis = () => {
    if (!impactAnalysis) return null;

    return (
      <View style={styles.stepContent}>
        <Text style={[
          styles.stepTitle,
          theme === 'dark' && styles.stepTitleDark
        ]}>
          Review Changes
        </Text>
        <Text style={[
          styles.stepDescription,
          theme === 'dark' && styles.stepDescriptionDark
        ]}>
          Here's what will happen with your modification:
        </Text>

        {/* Pricing Impact */}
        <View style={[
          styles.impactCard,
          theme === 'dark' && styles.impactCardDark
        ]}>
          <Text style={styles.impactCardTitle}>💰 Pricing Impact</Text>
          <View style={styles.pricingRow}>
            <Text style={[
              styles.pricingLabel,
              theme === 'dark' && styles.pricingLabelDark
            ]}>
              Original Amount:
            </Text>
            <Text style={[
              styles.pricingValue,
              theme === 'dark' && styles.pricingValueDark
            ]}>
              ${impactAnalysis.pricingImpact.originalAmount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={[
              styles.pricingLabel,
              theme === 'dark' && styles.pricingLabelDark
            ]}>
              New Amount:
            </Text>
            <Text style={[
              styles.pricingValue,
              theme === 'dark' && styles.pricingValueDark
            ]}>
              ${impactAnalysis.pricingImpact.newAmount.toFixed(2)}
            </Text>
          </View>
          {impactAnalysis.pricingImpact.modificationFee > 0 && (
            <View style={styles.pricingRow}>
              <Text style={[
                styles.pricingLabel,
                theme === 'dark' && styles.pricingLabelDark
              ]}>
                Modification Fee:
              </Text>
              <Text style={[
                styles.pricingValue,
                styles.feeText
              ]}>
                ${impactAnalysis.pricingImpact.modificationFee.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Availability Impact */}
        {impactAnalysis.availabilityImpact.hasConflicts && (
          <View style={[
            styles.impactCard,
            styles.warningCard
          ]}>
            <Text style={styles.impactCardTitle}>⚠️ Scheduling Conflict</Text>
            <Text style={styles.conflictText}>
              Your requested time may not be available. Consider these alternatives:
            </Text>
            {impactAnalysis.availabilityImpact.suggestedAlternatives?.map((date, index) => (
              <TouchableOpacity
                key={index}
                style={styles.alternativeButton}
                onPress={() => {
                  setProposedChanges(prev => ({ ...prev, scheduledAt: date }));
                  analyzeImpact();
                }}
              >
                <Text style={styles.alternativeButtonText}>
                  {date.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Approval Process */}
        <View style={[
          styles.impactCard,
          theme === 'dark' && styles.impactCardDark
        ]}>
          <Text style={styles.impactCardTitle}>🔍 Review Process</Text>
          <Text style={[
            styles.processText,
            theme === 'dark' && styles.processTextDark
          ]}>
            {impactAnalysis.approvalRequired 
              ? `Business review required. Estimated processing time: ${impactAnalysis.estimatedProcessingTime}`
              : 'Your modification will be processed automatically.'
            }
          </Text>
        </View>
      </View>
    );
  };

  // Render confirmation step
  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={[
        styles.stepTitle,
        theme === 'dark' && styles.stepTitleDark
      ]}>
        Confirm Request
      </Text>
      <Text style={[
        styles.stepDescription,
        theme === 'dark' && styles.stepDescriptionDark
      ]}>
        Add a message for the business (optional) and submit your modification request.
      </Text>

      <View style={styles.formSection}>
        <Text style={[
          styles.formLabel,
          theme === 'dark' && styles.formLabelDark
        ]}>
          Message to Business
        </Text>
        <TextInput
          style={[
            styles.textArea,
            theme === 'dark' && styles.textAreaDark
          ]}
          placeholder="Any additional information or special circumstances..."
          placeholderTextColor={theme === 'dark' ? '#666' : '#999'}
          value={customerMessage}
          onChangeText={setCustomerMessage}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={[
        styles.summaryCard,
        theme === 'dark' && styles.summaryCardDark
      ]}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={[
          styles.summaryText,
          theme === 'dark' && styles.summaryTextDark
        ]}>
          Modification Type: {selectedType?.replace('_', ' ').toUpperCase()}
        </Text>
        {impactAnalysis && (
          <>
            <Text style={[
              styles.summaryText,
              theme === 'dark' && styles.summaryTextDark
            ]}>
              Total Cost: ${(impactAnalysis.pricingImpact.newAmount + impactAnalysis.pricingImpact.modificationFee).toFixed(2)}
            </Text>
            <Text style={[
              styles.summaryText,
              theme === 'dark' && styles.summaryTextDark
            ]}>
              Processing: {impactAnalysis.approvalRequired ? 'Business Review Required' : 'Automatic'}
            </Text>
          </>
        )}
      </View>
    </View>
  );

  // Render step content
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select_type':
        return renderTypeSelection();
      case 'make_changes':
        return renderChangeForm();
      case 'review_impact':
        return isAnalyzing ? (
          <View style={styles.loadingContainer}>
            <Text style={[
              styles.loadingText,
              theme === 'dark' && styles.loadingTextDark
            ]}>
              Analyzing modification impact...
            </Text>
          </View>
        ) : renderImpactAnalysis();
      case 'confirm_request':
        return renderConfirmation();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      theme === 'dark' && styles.containerDark
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[
          styles.headerTitle,
          theme === 'dark' && styles.headerTitleDark
        ]}>
          Modify Reservation
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        {currentStep !== 'select_type' && (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.backButton,
              theme === 'dark' && styles.navButtonDark
            ]}
            onPress={previousStep}
          >
            <Text style={[
              styles.navButtonText,
              styles.backButtonText,
              theme === 'dark' && styles.navButtonTextDark
            ]}>
              Back
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextButton,
            (!selectedType && currentStep === 'select_type') && styles.navButtonDisabled
          ]}
          onPress={nextStep}
          disabled={!selectedType && currentStep === 'select_type'}
        >
          <Text style={[
            styles.navButtonText,
            styles.nextButtonText
          ]}>
            {currentStep === 'confirm_request' ? 'Submit Request' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="datetime"
          display="default"
          onChange={handleDateTimeChange}
          minimumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
};