import React from 'react';
import {
  VStack,
  FormControl,
  Input,
  Text,
  HStack,
} from 'native-base';
import { FormStepProps } from '../types';

export const ContactStep: React.FC<FormStepProps> = ({
  data,
  onDataChange,
  errors,
}) => {
  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleContactChange = (field: string, value: string) => {
    const updatedContact = {
      ...data.contact,
      [field]: value,
    };
    onDataChange({ contact: updatedContact });
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (numbers.length >= 10) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    } else if (numbers.length >= 6) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    } else if (numbers.length >= 3) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    }
    return numbers;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleContactChange('phone', formatted);
  };

  const normalizeWebsite = (value: string) => {
    let normalized = value.trim();
    if (normalized && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    return normalized;
  };

  const handleWebsiteChange = (value: string) => {
    handleContactChange('website', value);
  };

  const handleWebsiteBlur = () => {
    if (data.contact?.website) {
      const normalized = normalizeWebsite(data.contact.website);
      if (normalized !== data.contact.website) {
        handleContactChange('website', normalized);
      }
    }
  };

  return (
    <VStack space={6}>
      <Text fontSize="lg" fontWeight="semibold" color="gray.800">
        Contact Information
      </Text>
      
      <Text fontSize="sm" color="gray.600">
        Provide at least one way for customers to contact you. All fields are optional, but having multiple contact methods helps build trust.
      </Text>

      {/* Phone Number */}
      <FormControl isInvalid={!!getFieldError('contact.phone')}>
        <FormControl.Label>
          <HStack space={2} alignItems="center">
            <Text color="blue.500">📞</Text>
            <Text>Phone Number</Text>
          </HStack>
        </FormControl.Label>
        <Input
          placeholder="(555) 123-4567"
          value={data.contact?.phone || ''}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          size="lg"
          maxLength={14} // Formatted length: (XXX) XXX-XXXX
        />
        <FormControl.ErrorMessage>
          {getFieldError('contact.phone')}
        </FormControl.ErrorMessage>
        <FormControl.HelperText>
          Primary contact number for customers
        </FormControl.HelperText>
      </FormControl>

      {/* Email */}
      <FormControl isInvalid={!!getFieldError('contact.email')}>
        <FormControl.Label>
          <HStack space={2} alignItems="center">
            <Text color="blue.500">📧</Text>
            <Text>Email Address</Text>
          </HStack>
        </FormControl.Label>
        <Input
          placeholder="contact@yourbusiness.com"
          value={data.contact?.email || ''}
          onChangeText={(value) => handleContactChange('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          size="lg"
        />
        <FormControl.ErrorMessage>
          {getFieldError('contact.email')}
        </FormControl.ErrorMessage>
        <FormControl.HelperText>
          Business email for customer inquiries
        </FormControl.HelperText>
      </FormControl>

      {/* Website */}
      <FormControl isInvalid={!!getFieldError('contact.website')}>
        <FormControl.Label>
          <HStack space={2} alignItems="center">
            <Text color="blue.500">🌐</Text>
            <Text>Website</Text>
          </HStack>
        </FormControl.Label>
        <Input
          placeholder="www.yourbusiness.com"
          value={data.contact?.website || ''}
          onChangeText={handleWebsiteChange}
          onBlur={handleWebsiteBlur}
          keyboardType="url"
          autoCapitalize="none"
          size="lg"
        />
        <FormControl.ErrorMessage>
          {getFieldError('contact.website')}
        </FormControl.ErrorMessage>
        <FormControl.HelperText>
          Your business website or social media page
        </FormControl.HelperText>
      </FormControl>

      {/* Contact Summary */}
      <VStack space={2} bg="blue.50" p={4} rounded="md">
        <Text fontSize="sm" fontWeight="semibold" color="blue.800">
          Contact Methods Provided:
        </Text>
        <VStack space={1}>
          {data.contact?.phone && (
            <HStack space={2} alignItems="center">
              <Text color="green.500">✅</Text>
              <Text fontSize="sm" color="gray.700">Phone number</Text>
            </HStack>
          )}
          {data.contact?.email && (
            <HStack space={2} alignItems="center">
              <Text color="green.500">✅</Text>
              <Text fontSize="sm" color="gray.700">Email address</Text>
            </HStack>
          )}
          {data.contact?.website && (
            <HStack space={2} alignItems="center">
              <Text color="green.500">✅</Text>
              <Text fontSize="sm" color="gray.700">Website</Text>
            </HStack>
          )}
          {!data.contact?.phone && !data.contact?.email && !data.contact?.website && (
            <HStack space={2} alignItems="center">
              <Text color="orange.500">⚠️</Text>
              <Text fontSize="sm" color="gray.700">No contact methods provided</Text>
            </HStack>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
};