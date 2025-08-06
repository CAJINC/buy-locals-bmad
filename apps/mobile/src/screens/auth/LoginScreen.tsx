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
  KeyboardAvoidingView,
  ScrollView,
} from 'native-base';
import { Platform } from 'react-native';
import { useAuthContext } from '../../contexts/AuthContext';
import { LoginRequest } from '@buy-locals/shared';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess,
}) => {
  const { login, isLoading, error, clearError } = useAuthContext();
  
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });
  
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    clearError();
    
    if (!validateForm()) return;

    const success = await login(formData);
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleInputChange = (field: keyof LoginRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
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
        <Box flex={1} bg="white" px={6} py={8} justifyContent="center">
          <VStack space={6} alignItems="center">
            {/* Header */}
            <VStack space={2} alignItems="center">
              <Heading size="xl" color="primary.600">
                Welcome Back
              </Heading>
              <Text color="gray.500" textAlign="center">
                Sign in to your Buy Locals account
              </Text>
            </VStack>

            {/* Error Alert */}
            {error && (
              <Alert status="error" width="100%">
                <AlertIcon />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <VStack space={4} width="100%">
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
                  placeholder="Password"
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  type="password"
                  autoComplete="password"
                  isInvalid={!!validationErrors.password}
                  size="lg"
                />
                {validationErrors.password && (
                  <Text color="error.500" fontSize="sm">
                    {validationErrors.password}
                  </Text>
                )}
              </VStack>

              <HStack justifyContent="flex-end">
                <Link onPress={onNavigateToForgotPassword}>
                  <Text color="primary.600" fontSize="sm">
                    Forgot Password?
                  </Text>
                </Link>
              </HStack>

              <Button
                onPress={handleLogin}
                isLoading={isLoading}
                isDisabled={isLoading}
                size="lg"
                colorScheme="primary"
              >
                Sign In
              </Button>
            </VStack>

            {/* Register Link */}
            <HStack alignItems="center">
              <Text color="gray.500" fontSize="sm">
                Don't have an account?{' '}
              </Text>
              <Link onPress={onNavigateToRegister}>
                <Text color="primary.600" fontSize="sm" fontWeight="medium">
                  Sign Up
                </Text>
              </Link>
            </HStack>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};