import React from 'react';
import {
  HStack,
  VStack,
  Box,
  Text,
  Icon,
  Circle,
  Progress,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { FormStep } from '../types';

interface StepIndicatorProps {
  steps: FormStep[];
  currentStepIndex: number;
  completedSteps: string[];
  onStepPress?: (stepId: string, stepIndex: number) => void;
  isNavigationDisabled?: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStepIndex,
  completedSteps,
  onStepPress,
  isNavigationDisabled = false,
}) => {
  const getStepStatus = (step: FormStep, index: number): 'completed' | 'current' | 'upcoming' => {
    if (completedSteps.includes(step.id)) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (step: FormStep, status: string) => {
    if (status === 'completed') {
      return <Icon as={MaterialIcons} name="check" size="sm" color="white" />;
    }
    
    // Return step-specific icons
    const stepIcons: { [key: string]: string } = {
      'basic-info': 'business',
      'location': 'location-on',
      'contact': 'contact-phone',
      'hours': 'schedule',
      'review': 'preview',
    };
    
    return (
      <Icon 
        as={MaterialIcons} 
        name={stepIcons[step.id] || 'circle'} 
        size="sm" 
        color={status === 'current' ? 'white' : 'gray.400'} 
      />
    );
  };

  const getStepColors = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: 'green.500', borderColor: 'green.500', textColor: 'green.600' };
      case 'current':
        return { bg: 'blue.500', borderColor: 'blue.500', textColor: 'blue.600' };
      default:
        return { bg: 'gray.200', borderColor: 'gray.300', textColor: 'gray.500' };
    }
  };

  return (
    <VStack space={3}>
      {/* Progress Bar */}
      <Box>
        <Progress 
          value={((currentStepIndex + 1) / steps.length) * 100} 
          colorScheme="blue" 
          size="sm"
          bg="gray.200"
        />
      </Box>

      {/* Step Indicators */}
      <HStack space={2} justifyContent="space-between" alignItems="center">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const colors = getStepColors(status);
          const isClickable = !isNavigationDisabled && (status === 'completed' || index <= currentStepIndex);

          return (
            <VStack key={step.id} alignItems="center" flex={1} space={1}>
              {/* Step Circle */}
              <Box
                as={isClickable ? 'Pressable' : 'Box'}
                onPress={isClickable ? () => onStepPress?.(step.id, index) : undefined}
              >
                <Circle
                  size={10}
                  bg={colors.bg}
                  borderWidth={2}
                  borderColor={colors.borderColor}
                  shadow={status === 'current' ? 2 : 0}
                >
                  {getStepIcon(step, status)}
                </Circle>
              </Box>

              {/* Step Label */}
              <VStack alignItems="center" space={0}>
                <Text
                  fontSize="xs"
                  fontWeight={status === 'current' ? 'bold' : 'medium'}
                  color={colors.textColor}
                  textAlign="center"
                  numberOfLines={2}
                >
                  {step.title}
                </Text>
                
                {/* Status Badge */}
                {status === 'completed' && (
                  <Text fontSize="2xs" color="green.600">
                    Complete
                  </Text>
                )}
                {status === 'current' && (
                  <Text fontSize="2xs" color="blue.600">
                    Current
                  </Text>
                )}
              </VStack>

              {/* Connection Line */}
              {index < steps.length - 1 && (
                <Box
                  position="absolute"
                  top={5}
                  left="50%"
                  width="100%"
                  height={0.5}
                  bg={status === 'completed' ? 'green.300' : 'gray.300'}
                  zIndex={-1}
                />
              )}
            </VStack>
          );
        })}
      </HStack>

      {/* Current Step Info */}
      <Box bg="blue.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="blue.500">
        <VStack space={1}>
          <Text fontSize="sm" fontWeight="semibold" color="blue.800">
            Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].title}
          </Text>
          <Text fontSize="xs" color="blue.700">
            {steps[currentStepIndex].description}
          </Text>
        </VStack>
      </Box>
    </VStack>
  );
};