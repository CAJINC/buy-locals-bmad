import React from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Icon,
  Alert,
  Pressable,
  Collapse,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { FormFieldError } from '../types';
import { FORM_STEPS } from '../formSteps';

interface ValidationSummaryProps {
  errors: FormFieldError[];
  onErrorPress?: (field: string) => void;
  isCollapsible?: boolean;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  onErrorPress,
  isCollapsible = false,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(!isCollapsible);

  if (errors.length === 0) {
    return null;
  }

  // Group errors by step
  const errorsByStep = errors.reduce((acc, error) => {
    // Find which step this field belongs to
    const step = FORM_STEPS.find(s => s.requiredFields.includes(error.field));
    const stepId = step?.id || 'unknown';
    
    if (!acc[stepId]) {
      acc[stepId] = [];
    }
    acc[stepId].push(error);
    return acc;
  }, {} as Record<string, FormFieldError[]>);

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: Record<string, string> = {
      'name': 'Business Name',
      'categories': 'Business Categories',
      'description': 'Business Description',
      'location.address': 'Street Address',
      'location.city': 'City',
      'location.state': 'State',
      'location.zipCode': 'ZIP Code',
      'contact.phone': 'Phone Number',
      'contact.email': 'Email Address',
      'contact.website': 'Website URL',
      'hours': 'Business Hours',
    };
    
    return fieldNames[field] || field.charAt(0).toUpperCase() + field.slice(1);
  };

  const getStepDisplayName = (stepId: string): string => {
    const step = FORM_STEPS.find(s => s.id === stepId);
    return step?.title || 'Unknown Step';
  };

  const handleErrorPress = (field: string) => {
    if (onErrorPress) {
      onErrorPress(field);
    }
  };

  return (
    <Alert status="error" colorScheme="red" variant="left-accent">
      <VStack space={2} flex={1}>
        {/* Header */}
        <HStack space={2} alignItems="center">
          <Alert.Icon />
          <VStack flex={1}>
            <Text fontSize="sm" fontWeight="bold" color="red.800">
              Please fix the following errors:
            </Text>
            <Text fontSize="xs" color="red.600">
              {errors.length} field{errors.length > 1 ? 's' : ''} need{errors.length === 1 ? 's' : ''} attention
            </Text>
          </VStack>
          
          {isCollapsible && (
            <Pressable onPress={() => setIsExpanded(!isExpanded)}>
              <Icon
                as={MaterialIcons}
                name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size="sm"
                color="red.600"
              />
            </Pressable>
          )}
        </HStack>

        {/* Error Details */}
        <Collapse isOpen={isExpanded}>
          <VStack space={3} mt={2}>
            {Object.entries(errorsByStep).map(([stepId, stepErrors]) => (
              <Box key={stepId}>
                <Text fontSize="xs" fontWeight="semibold" color="red.700" mb={1}>
                  {getStepDisplayName(stepId)}
                </Text>
                
                <VStack space={1} ml={2}>
                  {stepErrors.map((error, index) => (
                    <Pressable
                      key={`${error.field}-${index}`}
                      onPress={() => handleErrorPress(error.field)}
                    >
                      <HStack space={2} alignItems="center" py={1}>
                        <Icon
                          as={MaterialIcons}
                          name="error-outline"
                          size="xs"
                          color="red.500"
                        />
                        <VStack flex={1}>
                          <Text fontSize="xs" color="red.700">
                            {getFieldDisplayName(error.field)}
                          </Text>
                          <Text fontSize="2xs" color="red.600">
                            {error.message}
                          </Text>
                        </VStack>
                        {onErrorPress && (
                          <Icon
                            as={MaterialIcons}
                            name="chevron-right"
                            size="xs"
                            color="red.400"
                          />
                        )}
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        </Collapse>
      </VStack>
    </Alert>
  );
};