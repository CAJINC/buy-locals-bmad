import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Divider,
  Badge,
  ScrollView,
  Box,
  Heading,
} from 'native-base';
import { FormStepProps } from '../types';
import { BusinessCard } from '../../../business/BusinessProfile/BusinessCard';
import { Business } from 'packages/shared/src/types/business';

interface ReviewStepProps extends FormStepProps {
  onSubmit: () => Promise<void>;
  isEditing?: boolean;
}

const BUSINESS_CATEGORIES = [
  { value: 'restaurants', label: 'Restaurants & Food' },
  { value: 'retail', label: 'Retail & Shopping' },
  { value: 'services', label: 'Professional Services' },
  { value: 'health', label: 'Health & Medical' },
  { value: 'entertainment', label: 'Entertainment & Recreation' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'beauty', label: 'Beauty & Personal Care' },
  { value: 'fitness', label: 'Fitness & Sports' },
  { value: 'education', label: 'Education & Learning' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'home_garden', label: 'Home & Garden' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'pets', label: 'Pets & Animals' },
  { value: 'technology', label: 'Technology' },
  { value: 'events', label: 'Events & Celebrations' },
];

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

interface SectionProps {
  title: string;
  emoji: string;
  children: React.ReactNode;
}

const ReviewSection: React.FC<SectionProps> = ({ title, emoji, children }) => (
  <VStack space={3}>
    <HStack space={2} alignItems="center">
      <Text color="blue.500">{emoji}</Text>
      <Text fontSize="md" fontWeight="semibold" color="gray.800">
        {title}
      </Text>
    </HStack>
    <Box bg="gray.50" p={4} rounded="md">
      {children}
    </Box>
  </VStack>
);

export const ReviewStep: React.FC<ReviewStepProps> = ({
  data,
  onSubmit,
  isEditing = false,
  isLoading,
}) => {
  const formatTime = (time24: string): string => {
    const [hour, minute] = time24.split(':').map(Number);
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const getCategoryLabel = (categoryValue: string): string => {
    return BUSINESS_CATEGORIES.find(cat => cat.value === categoryValue)?.label || categoryValue;
  };

  const formatAddress = () => {
    const { location } = data;
    if (!location) return 'No address provided';
    
    return `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`;
  };

  const getContactMethods = () => {
    const methods = [];
    if (data.contact?.phone) methods.push(`Phone: ${data.contact.phone}`);
    if (data.contact?.email) methods.push(`Email: ${data.contact.email}`);
    if (data.contact?.website) methods.push(`Website: ${data.contact.website}`);
    return methods;
  };

  const getOperatingHours = () => {
    if (!data.hours) return [];
    
    return DAYS_OF_WEEK.map((day) => {
      const dayHours = data.hours![day.key];
      const displayText = dayHours?.closed 
        ? 'Closed'
        : dayHours?.open && dayHours?.close
          ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
          : 'Not set';
      
      return {
        day: day.label,
        hours: displayText,
        isClosed: dayHours?.closed || false,
      };
    });
  };

  // Convert form data to Business interface for preview
  const previewBusiness: Business = {
    id: 'preview-id',
    owner_id: 'current-user-id',
    name: data.name || '',
    description: data.description,
    location: data.location || {
      address: '',
      city: '',
      state: '',
      zipCode: '',
    },
    categories: data.categories || [],
    hours: data.hours || {},
    contact: data.contact || {},
    media: [], // Empty for preview
    services: [],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  return (
    <VStack space={6} flex={1}>
      <VStack space={2}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">
          Review Your Business Information
        </Text>
        <Text fontSize="sm" color="gray.600">
          Please review all the information below before {isEditing ? 'updating' : 'creating'} your business profile.
        </Text>
      </VStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <VStack space={6}>
          {/* Business Preview Card */}
          <VStack space={3}>
            <HStack space={2} alignItems="center">
              <Text color="blue.500">👁️</Text>
              <Text fontSize="md" fontWeight="semibold" color="gray.800">
                How Your Business Will Appear
              </Text>
            </HStack>
            <Box bg="gray.50" p={4} rounded="md">
              <Text fontSize="sm" color="gray.600" mb={3}>
                This is how customers will see your business in search results:
              </Text>
              <BusinessCard 
                business={previewBusiness} 
                compact={false}
                showDistance={false}
              />
            </Box>
          </VStack>

          <Divider />

          {/* Basic Information */}
          <ReviewSection title="Basic Information" emoji="ℹ️">
            <VStack space={3}>
              <VStack space={1}>
                <Text fontSize="sm" color="gray.600">Business Name</Text>
                <Text fontSize="md" fontWeight="medium">
                  {data.name || 'Not provided'}
                </Text>
              </VStack>
              
              {data.description && (
                <VStack space={1}>
                  <Text fontSize="sm" color="gray.600">Description</Text>
                  <Text fontSize="sm" color="gray.800">
                    {data.description}
                  </Text>
                </VStack>
              )}
              
              <VStack space={1}>
                <Text fontSize="sm" color="gray.600">Categories</Text>
                <HStack space={2} flexWrap="wrap">
                  {(data.categories || []).map((category) => (
                    <Badge
                      key={category}
                      colorScheme="blue"
                      variant="solid"
                      rounded="full"
                    >
                      {getCategoryLabel(category)}
                    </Badge>
                  ))}
                  {(!data.categories || data.categories.length === 0) && (
                    <Text fontSize="sm" color="gray.500" italic>
                      No categories selected
                    </Text>
                  )}
                </HStack>
              </VStack>
            </VStack>
          </ReviewSection>

          <Divider />

          {/* Location */}
          <ReviewSection title="Location" emoji="📍">
            <VStack space={3}>
              <VStack space={1}>
                <Text fontSize="sm" color="gray.600">Address</Text>
                <Text fontSize="sm" color="gray.800">
                  {formatAddress()}
                </Text>
              </VStack>
              
              {data.location?.coordinates && (
                <VStack space={1}>
                  <Text fontSize="sm" color="gray.600">Coordinates</Text>
                  <Text fontSize="xs" color="gray.600">
                    {data.location.coordinates.lat.toFixed(6)}, {data.location.coordinates.lng.toFixed(6)}
                  </Text>
                  <Badge colorScheme="green" size="sm" w="fit-content">
                    Address Validated
                  </Badge>
                </VStack>
              )}
            </VStack>
          </ReviewSection>

          <Divider />

          {/* Contact Information */}
          <ReviewSection title="Contact Information" emoji="📞">
            <VStack space={2}>
              {getContactMethods().length > 0 ? (
                getContactMethods().map((method, index) => (
                  <Text key={index} fontSize="sm" color="gray.800">
                    {method}
                  </Text>
                ))
              ) : (
                <Text fontSize="sm" color="gray.500" italic>
                  No contact information provided
                </Text>
              )}
            </VStack>
          </ReviewSection>

          <Divider />

          {/* Business Hours */}
          <ReviewSection title="Business Hours" emoji="🕐">
            <VStack space={2}>
              {getOperatingHours().map((dayInfo) => (
                <HStack key={dayInfo.day} justifyContent="space-between" alignItems="center">
                  <Text fontSize="sm" color="gray.600" flex={1}>
                    {dayInfo.day}
                  </Text>
                  <Text 
                    fontSize="sm" 
                    color={dayInfo.isClosed ? 'red.600' : 'gray.800'}
                    textAlign="right"
                    flex={1}
                  >
                    {dayInfo.hours}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </ReviewSection>
        </VStack>
      </ScrollView>

      {/* Submission Note */}
      <Box bg="blue.50" p={4} rounded="md" mt={4}>
        <HStack space={2} alignItems="flex-start">
          <Text color="blue.600" mt={0.5}>ℹ️</Text>
          <VStack space={1} flex={1}>
            <Text fontSize="sm" fontWeight="medium" color="blue.800">
              {isEditing ? 'Update Business' : 'Create Business Profile'}
            </Text>
            <Text fontSize="xs" color="blue.700">
              {isEditing 
                ? 'Your changes will be saved and visible to customers immediately.'
                : 'Your business will be visible to customers once created. You can edit this information later from your business dashboard.'
              }
            </Text>
          </VStack>
        </HStack>
      </Box>
    </VStack>
  );
};