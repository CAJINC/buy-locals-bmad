import React from 'react';
import {
  HStack,
  VStack,
  Text,
  Icon,
  Badge,
  Tooltip,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessVerificationProps } from './types';

export const BusinessVerification: React.FC<BusinessVerificationProps> = React.memo(({
  isVerified,
  verificationLevel = 'basic',
  verificationDate,
  compact = false,
}) => {
  if (!isVerified) {
    return null;
  }

  const getVerificationConfig = () => {
    switch (verificationLevel) {
      case 'enterprise':
        return {
          icon: 'verified',
          color: 'purple.500',
          bgColor: 'purple.50',
          borderColor: 'purple.200',
          label: 'Enterprise Verified',
          description: 'Premium verification with enhanced benefits',
        };
      case 'premium':
        return {
          icon: 'verified',
          color: 'blue.500',
          bgColor: 'blue.50',
          borderColor: 'blue.200',
          label: 'Premium Verified',
          description: 'Enhanced verification with additional checks',
        };
      default:
        return {
          icon: 'verified',
          color: 'green.500',
          bgColor: 'green.50',
          borderColor: 'green.200',
          label: 'Verified',
          description: 'Business identity and information verified',
        };
    }
  };

  const config = getVerificationConfig();

  const formatVerificationDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  if (compact) {
    return (
      <Tooltip
        label={`${config.description}${verificationDate ? ` (Verified ${formatVerificationDate(verificationDate)})` : ''}`}
        placement="top"
      >
        <HStack space={1} alignItems="center">
          <Icon
            as={MaterialIcons}
            name={config.icon}
            size="sm"
            color={config.color}
          />
          <Text fontSize="xs" color={config.color} fontWeight="medium">
            {config.label}
          </Text>
        </HStack>
      </Tooltip>
    );
  }

  return (
    <VStack space={2}>
      <Badge
        variant="subtle"
        colorScheme={config.color.split('.')[0]}
        startIcon={
          <Icon
            as={MaterialIcons}
            name={config.icon}
            size="xs"
          />
        }
        borderRadius="full"
        px={3}
        py={1}
      >
        {config.label}
      </Badge>
      
      <VStack space={1}>
        <Text fontSize="sm" color="gray.700">
          {config.description}
        </Text>
        {verificationDate && (
          <Text fontSize="xs" color="gray.500">
            Verified {formatVerificationDate(verificationDate)}
          </Text>
        )}
      </VStack>
    </VStack>
  );
});