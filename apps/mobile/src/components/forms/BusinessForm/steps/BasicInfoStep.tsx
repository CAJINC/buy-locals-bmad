import React from 'react';
import {
  VStack,
  FormControl,
  Input,
  TextArea,
  Text,
  Select,
  CheckIcon,
  HStack,
  Checkbox,
  ScrollView,
} from 'native-base';
import { FormStepProps } from '../types';

// Import business categories (will create a shared version)
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

export const BasicInfoStep: React.FC<FormStepProps> = ({
  data,
  onDataChange,
  errors,
}) => {
  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleNameChange = (value: string) => {
    onDataChange({ name: value });
  };

  const handleDescriptionChange = (value: string) => {
    onDataChange({ description: value });
  };

  const handleCategoryToggle = (categoryValue: string, isSelected: boolean) => {
    const currentCategories = data.categories || [];
    
    let newCategories: string[];
    if (isSelected) {
      // Add category if not already present and under limit of 3
      if (!currentCategories.includes(categoryValue) && currentCategories.length < 3) {
        newCategories = [...currentCategories, categoryValue];
      } else {
        newCategories = currentCategories;
      }
    } else {
      // Remove category
      newCategories = currentCategories.filter(cat => cat !== categoryValue);
    }
    
    onDataChange({ categories: newCategories });
  };

  return (
    <VStack space={6}>
      {/* Business Name */}
      <FormControl isRequired isInvalid={!!getFieldError('name')}>
        <FormControl.Label>Business Name</FormControl.Label>
        <Input
          placeholder=\"Enter your business name\"
          value={data.name || ''}
          onChangeText={handleNameChange}
          size=\"lg\"
        />
        <FormControl.ErrorMessage>
          {getFieldError('name')}
        </FormControl.ErrorMessage>
        <FormControl.HelperText>
          Choose a clear, memorable name for your business
        </FormControl.HelperText>
      </FormControl>

      {/* Business Description */}
      <FormControl>
        <FormControl.Label>Description</FormControl.Label>
        <TextArea
          placeholder=\"Describe your business, services, or what makes you special...\"
          value={data.description || ''}
          onChangeText={handleDescriptionChange}
          numberOfLines={4}
          maxLength={2000}
        />
        <FormControl.HelperText>
          Optional: Tell customers what makes your business unique (up to 2000 characters)
        </FormControl.HelperText>
      </FormControl>

      {/* Business Categories */}
      <FormControl isRequired isInvalid={!!getFieldError('categories')}>
        <FormControl.Label>Business Categories</FormControl.Label>
        <Text fontSize=\"sm\" color=\"gray.600\" mb={3}>
          Select up to 3 categories that best describe your business
        </Text>
        
        <ScrollView maxHeight={200}>
          <VStack space={2}>
            {BUSINESS_CATEGORIES.map((category) => {
              const isSelected = (data.categories || []).includes(category.value);
              const isDisabled = !isSelected && (data.categories || []).length >= 3;
              
              return (
                <Checkbox
                  key={category.value}
                  value={category.value}
                  isChecked={isSelected}
                  isDisabled={isDisabled}
                  onChange={(isChecked) => handleCategoryToggle(category.value, isChecked)}
                  colorScheme=\"blue\"
                >
                  <Text 
                    color={isDisabled ? 'gray.400' : 'black'}
                    fontSize=\"md\"
                  >
                    {category.label}
                  </Text>
                </Checkbox>
              );
            })}
          </VStack>
        </ScrollView>
        
        <FormControl.ErrorMessage>
          {getFieldError('categories')}
        </FormControl.ErrorMessage>
        <FormControl.HelperText>
          Selected: {(data.categories || []).length}/3 categories
        </FormControl.HelperText>
      </FormControl>

      {/* Show selected categories */}
      {data.categories && data.categories.length > 0 && (
        <VStack space={2}>
          <Text fontSize=\"sm\" fontWeight=\"semibold\" color=\"blue.600\">
            Selected Categories:
          </Text>
          <HStack space={2} flexWrap=\"wrap\">
            {data.categories.map((categoryValue) => {
              const category = BUSINESS_CATEGORIES.find(cat => cat.value === categoryValue);
              return (
                <Text
                  key={categoryValue}
                  bg=\"blue.100\"
                  color=\"blue.800\"
                  px={3}
                  py={1}
                  rounded=\"full\"
                  fontSize=\"sm\"
                >
                  {category?.label || categoryValue}
                </Text>
              );
            })}
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};