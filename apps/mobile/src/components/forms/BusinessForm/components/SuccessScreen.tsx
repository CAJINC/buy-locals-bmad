import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Center,
  Badge,
  Divider,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from 'packages/shared/src/types/business';
import { BusinessCard } from '../../../business/BusinessProfile/BusinessCard';
import { navigationService } from '../../../../services/navigationService';

interface SuccessScreenProps {
  business: Business;
  isEditing?: boolean;
  onViewProfile?: () => void;
  onCreateAnother?: () => void;
  onGoToDashboard?: () => void;
  onShareBusiness?: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  business,
  isEditing = false,
  onViewProfile,
  onCreateAnother,
  onGoToDashboard,
  onShareBusiness,
}) => {
  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile();
    } else if (business?.id) {
      navigationService.navigateToBusinessProfile(business.id, business);
    }
  };

  const handleGoToDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      navigationService.navigateToBusinessDashboard();
    }
  };

  const handleCreateAnother = () => {
    if (onCreateAnother) {
      onCreateAnother();
    } else {
      navigationService.navigateToBusinessForm();
    }
  };
  const getSuccessMessage = () => {
    if (isEditing) {
      return {
        title: 'Business Updated Successfully!',
        subtitle: 'Your changes have been saved and are now live.',
        icon: 'check-circle',
        color: 'green.500',
      };
    } else {
      return {
        title: 'Business Created Successfully!',
        subtitle: 'Your business is now live and visible to customers.',
        icon: 'celebration',
        color: 'green.500',
      };
    }
  };

  const message = getSuccessMessage();

  const nextSteps = [
    {
      icon: 'visibility',
      title: 'Your business is now discoverable',
      description: 'Customers can find you through search and location-based browsing',
    },
    {
      icon: 'share',
      title: 'Share your profile',
      description: 'Let customers know about your new online presence',
    },
    {
      icon: 'dashboard',
      title: 'Manage your business',
      description: 'Update information, respond to reviews, and track engagement',
    },
  ];

  return (
    <Box flex={1} bg="white" safeArea>
      <Center flex={1} px={6}>
        <VStack space={8} alignItems="center" width="100%">
          {/* Success Icon and Message */}
          <VStack space={4} alignItems="center">
            <Icon
              as={MaterialIcons}
              name={message.icon}
              size="6xl"
              color={message.color}
            />
            
            <VStack space={2} alignItems="center">
              <Text fontSize="2xl" fontWeight="bold" textAlign="center" color="gray.800">
                {message.title}
              </Text>
              <Text fontSize="md" textAlign="center" color="gray.600" maxWidth="280px">
                {message.subtitle}
              </Text>
            </VStack>
          </VStack>

          {/* Business Preview */}
          <VStack space={3} width="100%">
            <Text fontSize="md" fontWeight="semibold" color="gray.700" textAlign="center">
              How your business appears:
            </Text>
            
            <Box bg="gray.50" p={4} borderRadius="lg">
              <BusinessCard 
                business={business} 
                compact={false}
                showDistance={false}
              />
            </Box>
          </VStack>

          <Divider />

          {/* Next Steps */}
          <VStack space={4} width="100%">
            <Text fontSize="lg" fontWeight="semibold" color="gray.800" textAlign="center">
              What's Next?
            </Text>
            
            <VStack space={3}>
              {nextSteps.map((step, index) => (
                <HStack key={index} space={3} alignItems="flex-start">
                  <Box mt={0.5}>
                    <Icon
                      as={MaterialIcons}
                      name={step.icon}
                      size="sm"
                      color="blue.500"
                    />
                  </Box>
                  <VStack flex={1} space={1}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.800">
                      {step.title}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {step.description}
                    </Text>
                  </VStack>
                  {index === 0 && (
                    <Badge colorScheme="green" variant="subtle" rounded="full">
                      Done!
                    </Badge>
                  )}
                </HStack>
              ))}
            </VStack>
          </VStack>
        </VStack>
      </Center>

      {/* Action Buttons */}
      <VStack space={3} px={6} pb={6}>
        <Button
          colorScheme="blue"
          size="lg"
          onPress={handleViewProfile}
          leftIcon={<Icon as={MaterialIcons} name="preview" />}
        >
          View Business Profile
        </Button>
        
        <HStack space={3}>
          <Button
            variant="outline"
            colorScheme="blue"
            flex={1}
            onPress={onShareBusiness}
            leftIcon={<Icon as={MaterialIcons} name="share" />}
          >
            Share
          </Button>
          
          <Button
            variant="outline"
            colorScheme="gray"
            flex={1}
            onPress={handleGoToDashboard}
            leftIcon={<Icon as={MaterialIcons} name="dashboard" />}
          >
            Dashboard
          </Button>
        </HStack>
        
        {!isEditing && (
          <Button
            variant="ghost"
            colorScheme="gray"
            onPress={handleCreateAnother}
          >
            Create Another Business
          </Button>
        )}
      </VStack>
    </Box>
  );
};