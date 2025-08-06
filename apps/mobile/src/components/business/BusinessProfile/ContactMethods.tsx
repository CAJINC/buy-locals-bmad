import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Badge,
  Pressable,
  useColorModeValue,
  useToast,
  Divider,
  Flex,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Linking, Platform, Alert } from 'react-native';
import { Business } from 'packages/shared/src/types/business';

export interface ContactMethod {
  type: 'phone' | 'email' | 'website' | 'social';
  label: string;
  value: string;
  icon: string;
  color: string;
  available: boolean;
  responseTime?: string;
  preferred?: boolean;
  platform?: string; // For social media
}

export interface ContactMethodsProps {
  business: Business;
  showResponseTimes?: boolean;
  showAvailabilityStatus?: boolean;
  showPreferredIndicator?: boolean;
  variant?: 'compact' | 'full' | 'grid';
  enablePhoneCall?: boolean;
  enableEmailCompose?: boolean;
  enableWebsiteBrowsing?: boolean;
  onContactMethodPress?: (method: ContactMethod) => void;
}

export const ContactMethods: React.FC<ContactMethodsProps> = ({
  business,
  showResponseTimes = true,
  showAvailabilityStatus = true,
  showPreferredIndicator = true,
  variant = 'full',
  enablePhoneCall = true,
  enableEmailCompose = true,
  enableWebsiteBrowsing = true,
  onContactMethodPress,
}) => {
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
  const toast = useToast();

  // Theme-based colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.300');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');

  // Transform business contact info into ContactMethod format
  const contactMethods = useMemo((): ContactMethod[] => {
    const methods: ContactMethod[] = [];

    // Phone contact
    if (business.contact?.phone) {
      methods.push({
        type: 'phone',
        label: 'Phone',
        value: business.contact.phone,
        icon: 'phone',
        color: 'green.500',
        available: true,
        responseTime: 'Immediate',
        preferred: true,
      });
    }

    // Email contact
    if (business.contact?.email) {
      methods.push({
        type: 'email',
        label: 'Email',
        value: business.contact.email,
        icon: 'email',
        color: 'blue.500',
        available: true,
        responseTime: 'Within 24 hours',
        preferred: false,
      });
    }

    // Website
    if (business.contact?.website) {
      methods.push({
        type: 'website',
        label: 'Website',
        value: business.contact.website,
        icon: 'language',
        color: 'purple.500',
        available: true,
        responseTime: 'Browse anytime',
        preferred: false,
      });
    }

    // Social media contacts
    if (business.contact?.socialMedia) {
      business.contact.socialMedia.forEach((social) => {
        const platformConfig = getSocialMediaConfig(social.platform);
        methods.push({
          type: 'social',
          label: platformConfig.label,
          value: social.url,
          icon: platformConfig.icon,
          color: platformConfig.color,
          available: true,
          responseTime: platformConfig.responseTime,
          preferred: false,
          platform: social.platform,
        });
      });
    }

    return methods;
  }, [business.contact]);

  // Helper function for social media configuration
  const getSocialMediaConfig = (platform: string) => {
    const configs = {
      facebook: { label: 'Facebook', icon: 'facebook', color: 'blue.600', responseTime: 'Within hours' },
      instagram: { label: 'Instagram', icon: 'camera-alt', color: 'pink.500', responseTime: 'Within hours' },
      twitter: { label: 'Twitter', icon: 'alternate-email', color: 'blue.400', responseTime: 'Within hours' },
      linkedin: { label: 'LinkedIn', icon: 'business', color: 'blue.700', responseTime: 'Within 1-2 days' },
      youtube: { label: 'YouTube', icon: 'play-circle-filled', color: 'red.500', responseTime: 'Browse anytime' },
      tiktok: { label: 'TikTok', icon: 'video-library', color: 'gray.800', responseTime: 'Browse anytime' },
    };
    return configs[platform as keyof typeof configs] || {
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      icon: 'link',
      color: 'gray.500',
      responseTime: 'Varies',
    };
  };

  // Handle contact method actions
  const handleContactMethod = useCallback(async (method: ContactMethod) => {
    if (onContactMethodPress) {
      onContactMethodPress(method);
      return;
    }

    setLoadingMethod(method.type);

    try {
      switch (method.type) {
        case 'phone':
          if (enablePhoneCall) {
            await handlePhoneCall(method.value);
          }
          break;
        case 'email':
          if (enableEmailCompose) {
            await handleEmailCompose(method.value);
          }
          break;
        case 'website':
        case 'social':
          if (enableWebsiteBrowsing) {
            await handleWebsiteBrowsing(method.value);
          }
          break;
      }
    } catch (error) {
      console.error(`Error handling ${method.type} contact:`, error);
      toast.show({
        title: 'Error',
        description: `Unable to open ${method.label.toLowerCase()}`,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoadingMethod(null);
    }
  }, [onContactMethodPress, enablePhoneCall, enableEmailCompose, enableWebsiteBrowsing, toast]);

  // Phone call handler
  const handlePhoneCall = useCallback(async (phoneNumber: string) => {
    const phoneUrl = `tel:${phoneNumber}`;
    const canOpen = await Linking.canOpenURL(phoneUrl);
    
    if (canOpen) {
      await Linking.openURL(phoneUrl);
      toast.show({
        title: 'Calling...',
        description: `Connecting to ${phoneNumber}`,
        status: 'info',
        duration: 2000,
      });
    } else {
      Alert.alert(
        'Unable to Call',
        'Your device does not support phone calls.',
        [{ text: 'OK' }]
      );
    }
  }, [toast]);

  // Email compose handler
  const handleEmailCompose = useCallback(async (email: string) => {
    const subject = `Inquiry about ${business.name}`;
    const body = `Hello,\n\nI'm interested in learning more about your business.\n\nBest regards,`;
    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    const canOpen = await Linking.canOpenURL(emailUrl);
    
    if (canOpen) {
      await Linking.openURL(emailUrl);
      toast.show({
        title: 'Opening Email',
        description: 'Composing email to business',
        status: 'info',
        duration: 2000,
      });
    } else {
      Alert.alert(
        'Unable to Send Email',
        'No email app is configured on your device.',
        [{ text: 'OK' }]
      );
    }
  }, [business.name, toast]);

  // Website browsing handler
  const handleWebsiteBrowsing = useCallback(async (url: string) => {
    // Ensure URL has protocol
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const canOpen = await Linking.canOpenURL(formattedUrl);
    
    if (canOpen) {
      await Linking.openURL(formattedUrl);
      toast.show({
        title: 'Opening Website',
        description: 'Launching external browser',
        status: 'info',
        duration: 2000,
      });
    } else {
      Alert.alert(
        'Unable to Open Website',
        'Cannot open the website link.',
        [{ text: 'OK' }]
      );
    }
  }, [toast]);

  // Render contact method item
  const renderContactMethod = (method: ContactMethod, index: number) => {
    const isLoading = loadingMethod === method.type;
    
    return (
      <Pressable
        key={`${method.type}-${index}`}
        onPress={() => handleContactMethod(method)}
        disabled={isLoading}
        accessible={true}
        accessibilityLabel={`Contact via ${method.label}: ${method.value}`}
        accessibilityHint={`Opens ${method.label.toLowerCase()} to contact business`}
        accessibilityRole="button"
      >
        <Box
          bg={cardBgColor}
          borderRadius="lg"
          borderWidth={1}
          borderColor={borderColor}
          p={4}
          opacity={isLoading ? 0.6 : 1}
        >
          <HStack space={3} alignItems="center">
            <Box
              p={2}
              bg={method.color}
              borderRadius="full"
              _dark={{ bg: method.color }}
            >
              <Icon
                as={MaterialIcons}
                name={method.icon as any}
                size="sm"
                color="white"
              />
            </Box>
            
            <VStack flex={1} space={1}>
              <HStack alignItems="center" justifyContent="space-between">
                <HStack alignItems="center" space={2}>
                  <Text fontWeight="medium" color={textColor} fontSize="md">
                    {method.label}
                  </Text>
                  
                  {/* Preferred indicator */}
                  {showPreferredIndicator && method.preferred && (
                    <Badge
                      variant="solid"
                      colorScheme="green"
                      size="sm"
                      _text={{ fontSize: 'xs' }}
                    >
                      Preferred
                    </Badge>
                  )}
                </HStack>
                
                {/* Availability status */}
                {showAvailabilityStatus && (
                  <HStack alignItems="center" space={1}>
                    <Box w={2} h={2} bg="green.500" borderRadius="full" />
                    <Text fontSize="xs" color="green.600">
                      Available
                    </Text>
                  </HStack>
                )}
              </HStack>
              
              <Text color={subtextColor} fontSize="sm" numberOfLines={1}>
                {method.value}
              </Text>
              
              {/* Response time */}
              {showResponseTimes && method.responseTime && (
                <Text color={subtextColor} fontSize="xs">
                  {method.responseTime}
                </Text>
              )}
            </VStack>
            
            <Icon
              as={MaterialIcons}
              name={isLoading ? 'hourglass-empty' : 'chevron-right'}
              size="md"
              color="gray.400"
            />
          </HStack>
        </Box>
      </Pressable>
    );
  };

  if (contactMethods.length === 0) {
    return (
      <Box p={4} bg={cardBgColor} borderRadius="lg" borderWidth={1} borderColor={borderColor}>
        <VStack space={2} alignItems="center">
          <Icon as={MaterialIcons} name="contact-support" size="lg" color="gray.400" />
          <Text fontSize="sm" color={subtextColor} textAlign="center">
            No contact methods available
          </Text>
        </VStack>
      </Box>
    );
  }

  // Render based on variant
  switch (variant) {
    case 'compact':
      return (
        <HStack space={2} flexWrap="wrap">
          {contactMethods.slice(0, 3).map((method, index) => (
            <Pressable
              key={`${method.type}-${index}`}
              onPress={() => handleContactMethod(method)}
              disabled={loadingMethod === method.type}
            >
              <Button
                size="sm"
                variant={method.preferred ? 'solid' : 'outline'}
                colorScheme={method.color.split('.')[0] as any}
                leftIcon={<Icon as={MaterialIcons} name={method.icon as any} />}
                isLoading={loadingMethod === method.type}
                accessible={true}
                accessibilityLabel={`Contact via ${method.label}`}
              >
                {method.label}
              </Button>
            </Pressable>
          ))}
        </HStack>
      );

    case 'grid':
      return (
        <Flex direction="row" wrap="wrap" justify="space-between">
          {contactMethods.map((method, index) => (
            <Box key={`${method.type}-${index}`} width="48%" mb={3}>
              {renderContactMethod(method, index)}
            </Box>
          ))}
        </Flex>
      );

    default: // 'full'
      return (
        <VStack space={3}>
          {contactMethods.map((method, index) => (
            <React.Fragment key={`${method.type}-${index}`}>
              {renderContactMethod(method, index)}
              {index < contactMethods.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </VStack>
      );
  }
};