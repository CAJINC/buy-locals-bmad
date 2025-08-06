import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Pressable,
  Icon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessContactInfoProps } from './types';

export const BusinessContactInfo: React.FC<BusinessContactInfoProps> = ({
  contact,
  onCall,
  onEmail,
  onWebsite,
}) => {
  const handleCall = () => {
    if (contact.phone && onCall) {
      onCall(contact.phone);
    }
  };

  const handleEmail = () => {
    if (contact.email && onEmail) {
      onEmail(contact.email);
    }
  };

  const handleWebsite = () => {
    if (contact.website && onWebsite) {
      onWebsite(contact.website);
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return original if can't format
  };

  // Format website URL for display
  const formatWebsiteUrl = (url: string): string => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <VStack space={2}>
      {/* Phone */}
      {contact.phone && (
        <Pressable onPress={handleCall}>
          <HStack space={3} alignItems="center" py={2}>
            <Icon
              as={MaterialIcons}
              name="phone"
              size="sm"
              color="green.500"
            />
            <VStack flex={1}>
              <Text color="gray.800" fontSize="md">
                {formatPhoneNumber(contact.phone)}
              </Text>
              <Text color="gray.500" fontSize="xs">
                Tap to call
              </Text>
            </VStack>
            <Icon
              as={MaterialIcons}
              name="chevron-right"
              size="sm"
              color="gray.400"
            />
          </HStack>
        </Pressable>
      )}

      {/* Email */}
      {contact.email && (
        <Pressable onPress={handleEmail}>
          <HStack space={3} alignItems="center" py={2}>
            <Icon
              as={MaterialIcons}
              name="email"
              size="sm"
              color="blue.500"
            />
            <VStack flex={1}>
              <Text color="gray.800" fontSize="md">
                {contact.email}
              </Text>
              <Text color="gray.500" fontSize="xs">
                Tap to email
              </Text>
            </VStack>
            <Icon
              as={MaterialIcons}
              name="chevron-right"
              size="sm"
              color="gray.400"
            />
          </HStack>
        </Pressable>
      )}

      {/* Website */}
      {contact.website && (
        <Pressable onPress={handleWebsite}>
          <HStack space={3} alignItems="center" py={2}>
            <Icon
              as={MaterialIcons}
              name="language"
              size="sm"
              color="purple.500"
            />
            <VStack flex={1}>
              <Text color="gray.800" fontSize="md">
                {formatWebsiteUrl(contact.website)}
              </Text>
              <Text color="gray.500" fontSize="xs">
                Tap to visit website
              </Text>
            </VStack>
            <Icon
              as={MaterialIcons}
              name="open-in-new"
              size="sm"
              color="gray.400"
            />
          </HStack>
        </Pressable>
      )}

      {/* No contact info message */}
      {!contact.phone && !contact.email && !contact.website && (
        <HStack space={3} alignItems="center" py={4}>
          <Icon
            as={MaterialIcons}
            name="info-outline"
            size="sm"
            color="gray.400"
          />
          <Text color="gray.500" fontSize="md" style={{ fontStyle: 'italic' }}>
            No contact information available
          </Text>
        </HStack>
      )}
    </VStack>
  );
};