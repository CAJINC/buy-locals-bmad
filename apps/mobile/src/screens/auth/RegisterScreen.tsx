import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Heading,
  Link,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Select,
  CheckIcon,
  KeyboardAvoidingView,
  ScrollView,
} from 'native-base';
import { Platform } from 'react-native';
import { useAuthContext } from '../../contexts/AuthContext';
import { CreateUserRequest } from '@buy-locals/shared';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegistrationSuccess?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onRegistrationSuccess,
}) => {
  const { register, isLoading, error, clearError } = useAuthContext();
  
  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'consumer',
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};
    
    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and numbers';
    }
    
    // Confirm password validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (confirmPassword !== formData.password) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    // Name validation
    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }
    
    // Phone validation (optional but validate format if provided)
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    clearError();
    
    if (!validateForm()) return;

    const success = await register(formData);
    if (success && onRegistrationSuccess) {
      onRegistrationSuccess();
    }
  };

  const handleInputChange = (field: keyof CreateUserRequest | 'confirmPassword', value: string) => {
    if (field === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear validation error when user starts typing
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear general error when user makes changes
    if (error) {
      clearError();
    }
  };

  return (
    <KeyboardAvoidingView
      flex={1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Box flex={1} bg="white" px={6} py={8}>
          <VStack space={6} alignItems="center">
            {/* Header */}
            <VStack space={2} alignItems="center">
              <Heading size="xl" color="primary.600">
                Create Account
              </Heading>
              <Text color="gray.500" textAlign="center">
                Join Buy Locals and support your community
              </Text>
            </VStack>

            {/* Error Alert */}
            {error && (
              <Alert status="error" width="100%">
                <AlertIcon />
                <AlertTitle>Registration Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Registration Form */}
            <VStack space={4} width="100%">
              <HStack space={2}>
                <VStack space={1} flex={1}>
                  <Input
                    placeholder="First name"
                    value={formData.firstName}
                    onChangeText={(value) => handleInputChange('firstName', value)}
                    autoCapitalize="words"
                    isInvalid={!!validationErrors.firstName}
                    size="lg"
                  />
                  {validationErrors.firstName && (
                    <Text color="error.500" fontSize="sm">
                      {validationErrors.firstName}
                    </Text>
                  )}
                </VStack>

                <VStack space={1} flex={1}>
                  <Input
                    placeholder="Last name"
                    value={formData.lastName}
                    onChangeText={(value) => handleInputChange('lastName', value)}
                    autoCapitalize="words"
                    isInvalid={!!validationErrors.lastName}
                    size="lg"
                  />
                  {validationErrors.lastName && (
                    <Text color="error.500" fontSize="sm">
                      {validationErrors.lastName}
                    </Text>
                  )}
                </VStack>
              </HStack>

              <VStack space={1}>
                <Input
                  placeholder="Email address"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  isInvalid={!!validationErrors.email}
                  size="lg"
                />
                {validationErrors.email && (
                  <Text color="error.500" fontSize="sm">
                    {validationErrors.email}
                  </Text>
                )}
              </VStack>

              <VStack space={1}>
                <Input
                  placeholder="Phone number (optional)"
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  isInvalid={!!validationErrors.phone}
                  size="lg"
                />
                {validationErrors.phone && (
                  <Text color="error.500" fontSize="sm">
                    {validationErrors.phone}
                  </Text>
                )}
              </VStack>

              <VStack space={1}>
                <Select
                  selectedValue={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                  placeholder="Account Type"
                  size="lg"
                  _selectedItem={{
                    bg: 'primary.100',
                    endIcon: <CheckIcon size="5" />,
                  }}
                >
                  <Select.Item label="Consumer" value="consumer" />
                  <Select.Item label="Business Owner" value="business_owner" />
                </Select>
              </VStack>

              <VStack space={1}>
                <Input
                  placeholder="Password"
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  type="password"
                  autoComplete="new-password"
                  isInvalid={!!validationErrors.password}
                  size="lg"
                />
                {validationErrors.password && (
                  <Text color="error.500" fontSize="sm">
                    {validationErrors.password}
                  </Text>
                )}
              </VStack>

              <VStack space={1}>
                <Input
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChangeText={(value) => handleInputChange('confirmPassword', value)}
                  type="password"
                  autoComplete="new-password"
                  isInvalid={!!validationErrors.confirmPassword}
                  size="lg"
                />
                {validationErrors.confirmPassword && (
                  <Text color="error.500" fontSize="sm">
                    {validationErrors.confirmPassword}
                  </Text>
                )}
              </VStack>

              <Button
                onPress={handleRegister}
                isLoading={isLoading}
                isDisabled={isLoading}
                size="lg"
                colorScheme="primary"
              >
                Create Account
              </Button>
            </VStack>

            {/* Login Link */}
            <HStack alignItems="center">
              <Text color="gray.500" fontSize="sm">
                Already have an account?{' '}
              </Text>
              <Link onPress={onNavigateToLogin}>
                <Text color="primary.600" fontSize="sm" fontWeight="medium">
                  Sign In
                </Text>
              </Link>
            </HStack>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};