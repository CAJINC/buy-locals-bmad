import React, { useCallback } from 'react';
import {
  HStack,
  VStack,
  Text,
  Icon,
  Pressable,
  useToast,
  Flex,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { BusinessSocialMediaProps } from './types';

export const BusinessSocialMedia: React.FC<BusinessSocialMediaProps> = React.memo(({
  socialMedia,
  compact = false,
}) => {
  const toast = useToast();

  const getSocialMediaConfig = useCallback((platform: string) => {
    switch (platform) {
      case 'facebook':
        return {
          icon: 'facebook',
          color: 'blue.600',
          bgColor: 'blue.50',
          name: 'Facebook',
        };
      case 'instagram':
        return {
          icon: 'camera-alt', // MaterialIcons doesn't have Instagram icon
          color: 'pink.500',
          bgColor: 'pink.50',
          name: 'Instagram',
        };
      case 'twitter':
        return {
          icon: 'alternate-email',
          color: 'blue.400',
          bgColor: 'blue.50',
          name: 'Twitter',
        };
      case 'linkedin':
        return {
          icon: 'business',
          color: 'blue.700',
          bgColor: 'blue.50',
          name: 'LinkedIn',
        };
      case 'youtube':
        return {
          icon: 'play-circle-filled',
          color: 'red.500',
          bgColor: 'red.50',
          name: 'YouTube',
        };
      case 'tiktok':
        return {
          icon: 'video-library',
          color: 'gray.800',
          bgColor: 'gray.50',
          name: 'TikTok',
        };
      default:
        return {
          icon: 'public',
          color: 'gray.500',
          bgColor: 'gray.50',
          name: 'Social Media',
        };
    }
  }, []);

  const handleSocialMediaPress = useCallback(async (url: string, platform: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        throw new Error('Cannot open URL');
      }
    } catch (error) {
      console.error('Error opening social media link:', error);
      toast.show({
        title: "Error",
        description: `Unable to open ${getSocialMediaConfig(platform).name} link`,
        status: "error",
      });
    }
  }, [toast, getSocialMediaConfig]);

  if (!socialMedia || socialMedia.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <HStack space={3} flexWrap="wrap">
        {socialMedia.map((social, index) => {
          const config = getSocialMediaConfig(social.platform);
          return (
            <Pressable
              key={index}
              onPress={() => handleSocialMediaPress(social.url, social.platform)}
              _pressed={{ opacity: 0.6 }}
            >
              <Icon
                as={MaterialIcons}
                name={config.icon}
                size="md"
                color={config.color}
              />
            </Pressable>
          );
        })}
      </HStack>
    );
  }

  return (
    <Flex direction="row" wrap="wrap" justify="flex-start">
      {socialMedia.map((social, index) => {
        const config = getSocialMediaConfig(social.platform);
        return (
          <Pressable
            key={index}
            onPress={() => handleSocialMediaPress(social.url, social.platform)}
            _pressed={{ opacity: 0.6 }}
            mb={2}
            mr={3}
          >
            <HStack
              space={2}
              alignItems="center"
              bg={config.bgColor}
              px={3}
              py={2}
              borderRadius="lg"
              borderWidth={1}
              borderColor="gray.200"
            >
              <Icon
                as={MaterialIcons}
                name={config.icon}
                size="sm"
                color={config.color}
              />
              <VStack space={0}>
                <Text fontSize="sm" fontWeight="medium" color="gray.800">
                  {config.name}
                </Text>
                {social.handle && (
                  <Text fontSize="xs" color="gray.600">
                    {social.handle}
                  </Text>
                )}
              </VStack>
            </HStack>
          </Pressable>
        );
      })}
    </Flex>
  );
});