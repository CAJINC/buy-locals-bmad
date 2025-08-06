import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Button,
  Image,
  Progress,
  useToast,
  Modal,
  Pressable,
  Badge,
} from 'native-base';
import { Alert } from 'react-native';
// Note: Using mock implementations for image picker and manipulator
// In production, use react-native-image-picker and react-native-image-resizer
import { LogoUploadProps, UploadedImage, CompressionOptions } from './types';
import { businessService } from '../../../services/businessService';

const LOGO_COMPRESSION: CompressionOptions = {
  quality: 0.9,
  maxWidth: 400,
  maxHeight: 400,
  format: 'png',
};

export const LogoUploader: React.FC<LogoUploadProps> = ({
  logo,
  onLogoChange,
  businessId,
  isLoading = false,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
}) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const toast = useToast();

  const compressLogo = async (uri: string): Promise<string> => {
    try {
      // Mock implementation - in production use react-native-image-resizer
      console.log('Compressing logo:', uri, LOGO_COMPRESSION);
      return uri; // Return original URI as compression placeholder
    } catch (error) {
      console.error('Logo compression failed:', error);
      return uri;
    }
  };

  const uploadLogo = async (logoData: UploadedImage): Promise<void> => {
    if (!businessId) {
      onUploadError?.('Business ID is required for upload');
      return;
    }

    try {
      onUploadStart?.();
      
      // Update logo to uploading state
      onLogoChange({
        ...logoData,
        isUploading: true,
        uploadProgress: 0,
        error: undefined,
      });

      // Compress logo before upload
      const compressedUri = await compressLogo(logoData.uri);

      // Create form data for upload
      const formData = new FormData();
      formData.append('media', {
        uri: compressedUri,
        type: 'image/png',
        name: logoData.fileName,
      } as any);
      formData.append('type', 'logo');

      // Upload to backend
      const response = await businessService.uploadBusinessMedia(businessId, formData, (progress) => {
        onUploadProgress?.(progress);
        onLogoChange({
          ...logoData,
          uploadProgress: progress,
        });
      });

      if (response.success && response.url) {
        // Update logo with successful upload
        onLogoChange({
          ...logoData,
          uri: response.url,
          isUploading: false,
          uploadProgress: 100,
        });
        onUploadComplete?.(response.url);
        
        toast.show({
          title: 'Logo Uploaded',
          description: 'Business logo uploaded successfully',
          status: 'success',
        });
      } else {
        throw new Error(response.error || 'Logo upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logo upload failed';
      
      // Update logo with error state
      onLogoChange({
        ...logoData,
        isUploading: false,
        error: errorMessage,
      });
      onUploadError?.(errorMessage);
      
      toast.show({
        title: 'Upload Failed',
        description: errorMessage,
        status: 'error',
      });
    }
  };

  const handleLogoSelection = async (source: 'camera' | 'library') => {
    try {
      // Mock implementation - in production use react-native-image-picker
      const mockAsset = {
        uri: `file://mock-logo-${Date.now()}.png`,
        fileName: `mock-logo-${Date.now()}.png`,
        fileSize: 512000, // 512KB mock size
      };

      const newLogo: UploadedImage = {
        id: `logo_${Date.now()}`,
        uri: mockAsset.uri,
        type: 'logo',
        fileName: mockAsset.fileName,
        fileSize: mockAsset.fileSize,
      };

      onLogoChange(newLogo);

      // Auto-upload if businessId is available
      if (businessId) {
        await uploadLogo(newLogo);
      }

      toast.show({
        title: 'Mock Logo Added',
        description: `Added mock logo from ${source}`,
        status: 'info',
      });
    } catch (error) {
      console.error('Logo selection error:', error);
      toast.show({
        title: 'Error',
        description: 'Failed to select logo',
        status: 'error',
      });
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove the business logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onLogoChange(null),
        },
      ]
    );
  };

  const handleLogoPress = () => {
    if (logo && !logo.isUploading) {
      setShowPreviewModal(true);
    }
  };

  return (
    <VStack space={4}>
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontSize="md" fontWeight="semibold" color="gray.800">
          Business Logo
        </Text>
        {logo && (
          <Badge colorScheme={logo.error ? 'red' : logo.isUploading ? 'yellow' : 'green'}>
            {logo.error ? 'Error' : logo.isUploading ? 'Uploading' : 'Ready'}
          </Badge>
        )}
      </HStack>

      {/* Logo Display/Upload Area */}
      <Box alignItems="center">
        {logo ? (
          <Box position="relative">
            <Pressable onPress={handleLogoPress}>
              <Box
                w="120px"
                h="120px"
                rounded="md"
                overflow="hidden"
                borderWidth={2}
                borderColor={logo.error ? 'red.300' : 'gray.200'}
                bg="white"
              >
                <Image
                  source={{ uri: logo.uri }}
                  alt="Business logo"
                  w="100%"
                  h="100%"
                  resizeMode="contain"
                />

                {/* Upload Progress Overlay */}
                {logo.isUploading && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bg="black:alpha.50"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <VStack space={2} alignItems="center">
                      <Progress
                        value={logo.uploadProgress || 0}
                        w="80px"
                        colorScheme="blue"
                      />
                      <Text fontSize="xs" color="white">
                        {Math.round(logo.uploadProgress || 0)}%
                      </Text>
                    </VStack>
                  </Box>
                )}

                {/* Error Overlay */}
                {logo.error && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bg="red.500:alpha.80"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <VStack space={1} alignItems="center">
                      <Text fontSize="lg" color="white">
                        ❌
                      </Text>
                      <Text fontSize="xs" color="white" textAlign="center">
                        Upload Failed
                      </Text>
                    </VStack>
                  </Box>
                )}

                {/* Success Indicator */}
                {!logo.isUploading && !logo.error && businessId && (
                  <Badge
                    colorScheme="green"
                    variant="solid"
                    position="absolute"
                    top={2}
                    right={2}
                  >
                    ✓
                  </Badge>
                )}
              </Box>
            </Pressable>

            {/* Change/Remove Buttons */}
            <HStack space={2} mt={3} justifyContent="center">
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  Alert.alert(
                    'Change Logo',
                    'Choose how to change your business logo',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Camera', onPress: () => handleLogoSelection('camera') },
                      { text: 'Photo Library', onPress: () => handleLogoSelection('library') },
                    ]
                  );
                }}
                isDisabled={logo.isUploading || isLoading}
              >
                Change
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorScheme="red"
                onPress={handleRemoveLogo}
                isDisabled={logo.isUploading || isLoading}
              >
                Remove
              </Button>
            </HStack>
          </Box>
        ) : (
          /* Upload Logo Area */
          <Pressable
            onPress={() => {
              Alert.alert(
                'Add Business Logo',
                'Choose how to add your business logo',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Camera', onPress: () => handleLogoSelection('camera') },
                  { text: 'Photo Library', onPress: () => handleLogoSelection('library') },
                ]
              );
            }}
            isDisabled={isLoading}
          >
            <Box
              w="120px"
              h="120px"
              rounded="md"
              borderWidth={2}
              borderStyle="dashed"
              borderColor="gray.300"
              justifyContent="center"
              alignItems="center"
              bg="gray.50"
            >
              <VStack space={2} alignItems="center">
                <Text fontSize="3xl" color="gray.400">
                  🏢
                </Text>
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Add Logo
                </Text>
              </VStack>
            </Box>
          </Pressable>
        )}
      </Box>

      {/* Action Buttons */}
      {!logo && (
        <HStack space={2}>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handleLogoSelection('camera')}
            leftIcon={<Text>📷</Text>}
            isDisabled={isLoading}
          >
            Camera
          </Button>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handleLogoSelection('library')}
            leftIcon={<Text>🖼️</Text>}
            isDisabled={isLoading}
          >
            Gallery
          </Button>
        </HStack>
      )}

      {/* Logo Preview Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} size="lg">
        <Modal.Content maxWidth="90%">
          <Modal.CloseButton />
          <Modal.Header>Business Logo</Modal.Header>
          <Modal.Body>
            {logo && (
              <VStack space={4} alignItems="center">
                <Image
                  source={{ uri: logo.uri }}
                  alt="Business logo preview"
                  w="200px"
                  h="200px"
                  resizeMode="contain"
                  bg="gray.50"
                  rounded="md"
                />
                <VStack space={2} w="100%">
                  <Text fontSize="sm" color="gray.600">
                    File: {logo.fileName}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Size: {(logo.fileSize / 1024).toFixed(2)} KB
                  </Text>
                  {logo.error && (
                    <Text fontSize="sm" color="red.600">
                      Error: {logo.error}
                    </Text>
                  )}
                </VStack>
              </VStack>
            )}
          </Modal.Body>
        </Modal.Content>
      </Modal>

      {/* Help Text */}
      <Text fontSize="xs" color="gray.500" textAlign="center">
        Upload a square logo (recommended 400x400px) that represents your business. PNG format with transparent background works best.
      </Text>
    </VStack>
  );
};