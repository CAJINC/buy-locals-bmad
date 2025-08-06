import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Button,
  Image,
  Progress,
  IconButton,
  useToast,
  Modal,
  Pressable,
  ScrollView,
  Badge,
} from 'native-base';
import { Alert } from 'react-native';
// Note: Using mock implementations for image picker and manipulator
// In production, use react-native-image-picker and react-native-image-resizer
import { ImageUploadProps, UploadedImage, CompressionOptions } from './types';
import { businessService } from '../../../services/businessService';

const DEFAULT_COMPRESSION: CompressionOptions = {
  quality: 0.8,
  maxWidth: 1200,
  maxHeight: 1200,
  format: 'jpeg',
};

export const ImageUploader: React.FC<ImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  businessId,
  isLoading = false,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
}) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const toast = useToast();

  const compressImage = async (uri: string, options: CompressionOptions = DEFAULT_COMPRESSION) => {
    try {
      // Mock implementation - in production use react-native-image-resizer
      console.log('Compressing image:', uri, options);
      // Return original URI as compression placeholder
      return uri;
    } catch (error) {
      console.error('Image compression failed:', error);
      return uri; // Return original if compression fails
    }
  };

  const generateImageId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const uploadImage = async (image: UploadedImage): Promise<void> => {
    if (!businessId) {
      onUploadError?.(image.id, 'Business ID is required for upload');
      return;
    }

    try {
      onUploadStart?.(image.id);
      
      // Update image to uploading state
      const updatedImages = images.map(img => 
        img.id === image.id 
          ? { ...img, isUploading: true, uploadProgress: 0, error: undefined }
          : img
      );
      onImagesChange(updatedImages);

      // Compress image before upload
      const compressedUri = await compressImage(image.uri);

      // Create form data for upload
      const formData = new FormData();
      formData.append('media', {
        uri: compressedUri,
        type: 'image/jpeg',
        name: image.fileName,
      } as any);
      formData.append('type', image.type);

      // Upload to backend
      const response = await businessService.uploadBusinessMedia(businessId, formData, (progress) => {
        onUploadProgress?.(image.id, progress);
        const updatedImages = images.map(img => 
          img.id === image.id 
            ? { ...img, uploadProgress: progress }
            : img
        );
        onImagesChange(updatedImages);
      });

      if (response.success && response.url) {
        // Update image with successful upload
        const updatedImages = images.map(img => 
          img.id === image.id 
            ? { ...img, uri: response.url!, isUploading: false, uploadProgress: 100 }
            : img
        );
        onImagesChange(updatedImages);
        onUploadComplete?.(image.id, response.url);
        
        toast.show({
          title: 'Upload Complete',
          description: 'Image uploaded successfully',
          status: 'success',
        });
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      // Update image with error state
      const updatedImages = images.map(img => 
        img.id === image.id 
          ? { ...img, isUploading: false, error: errorMessage }
          : img
      );
      onImagesChange(updatedImages);
      onUploadError?.(image.id, errorMessage);
      
      toast.show({
        title: 'Upload Failed',
        description: errorMessage,
        status: 'error',
      });
    }
  };

  const handleImagePicker = async (source: 'camera' | 'library') => {
    try {
      if (images.length >= maxImages) {
        toast.show({
          title: 'Maximum Images Reached',
          description: `You can only upload up to ${maxImages} images`,
          status: 'warning',
        });
        return;
      }

      // Mock implementation - in production use react-native-image-picker
      const mockAssets = [
        {
          uri: `file://mock-image-${Date.now()}.jpg`,
          fileName: `mock-image-${Date.now()}.jpg`,
          fileSize: 1024000, // 1MB mock size
        },
      ];

      const newImages: UploadedImage[] = mockAssets.map((asset) => ({
        id: generateImageId(),
        uri: asset.uri,
        type: 'photo',
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      }));

      const updatedImages = [...images, ...newImages];
      onImagesChange(updatedImages);

      // Auto-upload if businessId is available
      if (businessId) {
        newImages.forEach(image => {
          uploadImage(image);
        });
      }

      toast.show({
        title: 'Mock Image Added',
        description: `Added mock image from ${source}`,
        status: 'info',
      });
    } catch (error) {
      console.error('Image picker error:', error);
      toast.show({
        title: 'Error',
        description: 'Failed to select image',
        status: 'error',
      });
    }
  };

  const handleRemoveImage = (imageId: string) => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedImages = images.filter(img => img.id !== imageId);
            onImagesChange(updatedImages);
          },
        },
      ]
    );
  };

  const handleImagePress = (image: UploadedImage) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const canAddMore = images.length < maxImages && !isLoading;

  return (
    <VStack space={4}>
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontSize="md" fontWeight="semibold" color="gray.800">
          Business Photos
        </Text>
        <Text fontSize="sm" color="gray.600">
          {images.length} / {maxImages}
        </Text>
      </HStack>

      {/* Image Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack space={3}>
          {images.map((image) => (
            <Box key={image.id} position="relative">
              <Pressable onPress={() => handleImagePress(image)}>
                <Box
                  w="100px"
                  h="100px"
                  rounded="md"
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="gray.200"
                >
                  <Image
                    source={{ uri: image.uri }}
                    alt="Business photo"
                    w="100%"
                    h="100%"
                    resizeMode="cover"
                  />
                  
                  {/* Upload Progress Overlay */}
                  {image.isUploading && (
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
                          value={image.uploadProgress || 0}
                          w="80px"
                          colorScheme="blue"
                        />
                        <Text fontSize="xs" color="white">
                          {Math.round(image.uploadProgress || 0)}%
                        </Text>
                      </VStack>
                    </Box>
                  )}

                  {/* Error Overlay */}
                  {image.error && (
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
                      <Text fontSize="xs" color="white" textAlign="center">
                        ❌ Failed
                      </Text>
                    </Box>
                  )}

                  {/* Success Badge */}
                  {!image.isUploading && !image.error && businessId && (
                    <Badge
                      colorScheme="green"
                      variant="solid"
                      position="absolute"
                      top={1}
                      right={1}
                    >
                      ✓
                    </Badge>
                  )}
                </Box>
              </Pressable>

              {/* Remove Button */}
              <IconButton
                icon={<Text fontSize="sm">✕</Text>}
                size="sm"
                variant="solid"
                colorScheme="red"
                rounded="full"
                position="absolute"
                top={-2}
                right={-2}
                onPress={() => handleRemoveImage(image.id)}
              />
            </Box>
          ))}

          {/* Add Photo Button */}
          {canAddMore && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Add Photo',
                  'Choose how to add a photo',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Camera', onPress: () => handleImagePicker('camera') },
                    { text: 'Photo Library', onPress: () => handleImagePicker('library') },
                  ]
                );
              }}
            >
              <Box
                w="100px"
                h="100px"
                rounded="md"
                borderWidth={2}
                borderStyle="dashed"
                borderColor="gray.300"
                justifyContent="center"
                alignItems="center"
                bg="gray.50"
              >
                <VStack space={1} alignItems="center">
                  <Text fontSize="2xl" color="gray.400">
                    📷
                  </Text>
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    Add Photo
                  </Text>
                </VStack>
              </Box>
            </Pressable>
          )}
        </HStack>
      </ScrollView>

      {/* Action Buttons */}
      {canAddMore && (
        <HStack space={2}>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handleImagePicker('camera')}
            leftIcon={<Text>📷</Text>}
          >
            Camera
          </Button>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handleImagePicker('library')}
            leftIcon={<Text>🖼️</Text>}
          >
            Gallery
          </Button>
        </HStack>
      )}

      {/* Image Modal */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} size="full">
        <Modal.Content maxWidth="90%" maxHeight="80%">
          <Modal.CloseButton />
          <Modal.Header>Photo Preview</Modal.Header>
          <Modal.Body>
            {selectedImage && (
              <VStack space={4} alignItems="center">
                <Image
                  source={{ uri: selectedImage.uri }}
                  alt="Selected photo"
                  w="100%"
                  h="300px"
                  resizeMode="contain"
                />
                <VStack space={2} w="100%">
                  <Text fontSize="sm" color="gray.600">
                    File: {selectedImage.fileName}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Size: {(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  {selectedImage.error && (
                    <Text fontSize="sm" color="red.600">
                      Error: {selectedImage.error}
                    </Text>
                  )}
                </VStack>
              </VStack>
            )}
          </Modal.Body>
        </Modal.Content>
      </Modal>

      {/* Help Text */}
      <Text fontSize="xs" color="gray.500">
        Upload up to {maxImages} high-quality photos of your business. Images will be automatically compressed and optimized.
      </Text>
    </VStack>
  );
};