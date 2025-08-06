import React from 'react';
import {
  Box,
  VStack,
  HStack,
  useBreakpointValue,
  ScrollView,
  KeyboardAvoidingView,
} from 'native-base';
import { Platform } from 'react-native';

interface ResponsiveFormLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  sidebar?: React.ReactNode;
  showSidebar?: boolean;
}

export const ResponsiveFormLayout: React.FC<ResponsiveFormLayoutProps> = ({
  children,
  header,
  footer,
  sidebar,
  showSidebar = false,
}) => {
  // Responsive breakpoints
  const isMobile = useBreakpointValue({
    base: true,
    md: false,
  });

  const layout = useBreakpointValue({
    base: 'mobile',
    md: 'tablet',
    lg: 'desktop',
  });

  const padding = useBreakpointValue({
    base: 4,
    md: 6,
    lg: 8,
  });

  const maxWidth = useBreakpointValue({
    base: '100%',
    md: '600px',
    lg: '800px',
  });

  const sidebarWidth = useBreakpointValue({
    base: '0px',
    lg: showSidebar ? '300px' : '0px',
  });

  if (layout === 'desktop' && showSidebar && sidebar) {
    // Desktop layout with sidebar
    return (
      <KeyboardAvoidingView
        flex={1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <HStack flex={1} bg="gray.50">
          {/* Sidebar */}
          <Box width={sidebarWidth} bg="white" borderRightWidth={1} borderRightColor="gray.200">
            <ScrollView flex={1} p={padding}>
              {sidebar}
            </ScrollView>
          </Box>

          {/* Main Content */}
          <VStack flex={1}>
            {/* Header */}
            {header && (
              <Box bg="white" borderBottomWidth={1} borderBottomColor="gray.200">
                {header}
              </Box>
            )}

            {/* Content */}
            <ScrollView flex={1}>
              <Box maxWidth={maxWidth} alignSelf="center" width="100%" p={padding}>
                {children}
              </Box>
            </ScrollView>

            {/* Footer */}
            {footer && (
              <Box bg="white" borderTopWidth={1} borderTopColor="gray.200">
                {footer}
              </Box>
            )}
          </VStack>
        </HStack>
      </KeyboardAvoidingView>
    );
  }

  // Mobile/Tablet single column layout
  return (
    <KeyboardAvoidingView
      flex={1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <VStack flex={1} bg="gray.50">
        {/* Header */}
        {header && (
          <Box bg="white" borderBottomWidth={1} borderBottomColor="gray.200">
            {header}
          </Box>
        )}

        {/* Content */}
        <ScrollView flex={1}>
          <Box maxWidth={maxWidth} alignSelf="center" width="100%" p={padding}>
            {children}
          </Box>
        </ScrollView>

        {/* Footer */}
        {footer && (
          <Box bg="white" borderTopWidth={1} borderTopColor="gray.200">
            {footer}
          </Box>
        )}

        {/* Sidebar as modal on mobile */}
        {isMobile && sidebar && showSidebar && (
          <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="rgba(0,0,0,0.5)">
            <Box position="absolute" left={0} top={0} bottom={0} width="80%" bg="white">
              <ScrollView flex={1} p={padding}>
                {sidebar}
              </ScrollView>
            </Box>
          </Box>
        )}
      </VStack>
    </KeyboardAvoidingView>
  );
};

// Hook for responsive form behavior
export const useResponsiveForm = () => {
  const isMobile = useBreakpointValue({
    base: true,
    md: false,
  });

  const isTablet = useBreakpointValue({
    base: false,
    md: true,
    lg: false,
  });

  const isDesktop = useBreakpointValue({
    base: false,
    lg: true,
  });

  const formSpacing = useBreakpointValue({
    base: 4,
    md: 6,
    lg: 8,
  });

  const inputSize = useBreakpointValue({
    base: 'md',
    md: 'lg',
  });

  const buttonSize = useBreakpointValue({
    base: 'md',
    md: 'lg',
  });

  const modalSize = useBreakpointValue({
    base: 'full',
    md: 'lg',
    lg: 'xl',
  });

  return {
    isMobile,
    isTablet,
    isDesktop,
    formSpacing,
    inputSize,
    buttonSize,
    modalSize,
    // Utility functions
    getResponsiveWidth: (mobile: string, tablet: string, desktop: string) => 
      useBreakpointValue({
        base: mobile,
        md: tablet,
        lg: desktop,
      }),
    getResponsiveSpacing: (multiplier: number = 1) => formSpacing * multiplier,
  };
};

// Mobile-optimized input wrapper
interface MobileInputWrapperProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  isRequired?: boolean;
  helpText?: string;
}

export const MobileInputWrapper: React.FC<MobileInputWrapperProps> = ({
  children,
  label,
  error,
  isRequired,
  helpText,
}) => {
  const { formSpacing } = useResponsiveForm();

  return (
    <VStack space={2} width="100%">
      {label && (
        <HStack alignItems="center" space={1}>
          <Text fontSize="sm" fontWeight="medium" color="gray.700">
            {label}
          </Text>
          {isRequired && (
            <Text fontSize="sm" color="red.500">
              *
            </Text>
          )}
        </HStack>
      )}
      
      <Box>
        {children}
      </Box>
      
      {error && (
        <Text fontSize="xs" color="red.500">
          {error}
        </Text>
      )}
      
      {helpText && !error && (
        <Text fontSize="xs" color="gray.500">
          {helpText}
        </Text>
      )}
    </VStack>
  );
};