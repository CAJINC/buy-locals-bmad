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
import { PhotoUploadProps, UploadedImage, CompressionOptions } from './types';
import { businessService } from '../../../services/businessService';

const PHOTO_COMPRESSION: CompressionOptions = {
  quality: 0.8,
  maxWidth: 1200,
  maxHeight: 1200,
  format: 'jpeg',
};

export const PhotoGalleryUploader: React.FC<PhotoUploadProps> = ({
  images,
  onImagesChange,
  maxPhotos = 5,
  enableReordering = true,
  businessId,
  isLoading = false,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
}) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const toast = useToast();

  const compressImage = async (uri: string): Promise<string> => {
    try {
      // Mock implementation - in production use react-native-image-resizer
      console.log('Compressing photo:', uri, PHOTO_COMPRESSION);
      return uri; // Return original URI as compression placeholder
    } catch (error) {
      console.error('Photo compression failed:', error);
      return uri;
    }
  };

  const generateImageId = () => `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const uploadPhoto = async (photo: UploadedImage): Promise<void> => {
    if (!businessId) {
      onUploadError?.(photo.id, 'Business ID is required for upload');
      return;
    }

    try {
      onUploadStart?.(photo.id);
      
      // Update photo to uploading state
      const updatedImages = images.map(img => 
        img.id === photo.id 
          ? { ...img, isUploading: true, uploadProgress: 0, error: undefined }
          : img
      );
      onImagesChange(updatedImages);

      // Compress photo before upload
      const compressedUri = await compressImage(photo.uri);

      // Create form data for upload
      const formData = new FormData();
      formData.append('media', {
        uri: compressedUri,
        type: 'image/jpeg',
        name: photo.fileName,
      } as any);
      formData.append('type', 'photo');

      // Upload to backend
      const response = await businessService.uploadBusinessMedia(businessId, formData, (progress) => {
        onUploadProgress?.(photo.id, progress);
        const updatedImages = images.map(img => 
          img.id === photo.id 
            ? { ...img, uploadProgress: progress }
            : img
        );
        onImagesChange(updatedImages);
      });

      if (response.success && response.url) {
        // Update photo with successful upload
        const updatedImages = images.map(img => 
          img.id === photo.id 
            ? { ...img, uri: response.url!, isUploading: false, uploadProgress: 100 }
            : img
        );
        onImagesChange(updatedImages);
        onUploadComplete?.(photo.id, response.url);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      // Update photo with error state
      const updatedImages = images.map(img => 
        img.id === photo.id 
          ? { ...img, isUploading: false, error: errorMessage }
          : img
      );
      onImagesChange(updatedImages);
      onUploadError?.(photo.id, errorMessage);
      
      toast.show({
        title: 'Upload Failed',
        description: errorMessage,
        status: 'error',
      });
    }
  };

  const handlePhotoSelection = async (source: 'camera' | 'library') => {
    try {
      if (images.length >= maxPhotos) {
        toast.show({
          title: 'Maximum Photos Reached',
          description: `You can only upload up to ${maxPhotos} photos`,
          status: 'warning',
        });
        return;
      }

      // Mock implementation - in production use react-native-image-picker
      const mockCount = source === 'library' ? Math.min(2, maxPhotos - images.length) : 1;
      const mockAssets = Array.from({ length: mockCount }, (_, index) => ({
        uri: `file://mock-photo-${Date.now()}-${index}.jpg`,
        fileName: `mock-photo-${Date.now()}-${index}.jpg`,
        fileSize: 1024000 + (index * 100000), // Varying sizes
      }));

      const newPhotos: UploadedImage[] = mockAssets.map((asset) => ({
        id: generateImageId(),
        uri: asset.uri,
        type: 'photo',
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      }));

      const updatedImages = [...images, ...newPhotos];
      onImagesChange(updatedImages);

      // Auto-upload if businessId is available
      if (businessId) {
        newPhotos.forEach(photo => {
          uploadPhoto(photo);
        });
      }

      toast.show({
        title: 'Mock Photos Added',
        description: `${newPhotos.length} mock photo(s) added from ${source}`,
        status: 'info',
      });
    } catch (error) {
      console.error('Photo selection error:', error);
      toast.show({
        title: 'Error',
        description: 'Failed to select photos',
        status: 'error',
      });
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedImages = images.filter(img => img.id !== photoId);
            onImagesChange(updatedImages);
          },
        },
      ]
    );
  };

  const handlePhotoPress = (photo: UploadedImage) => {
    setSelectedImage(photo);
    setShowImageModal(true);
  };

  const handleReorderPhotos = (fromIndex: number, toIndex: number) => {
    if (!enableReordering) return;

    const updatedImages = [...images];
    const [movedImage] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, movedImage);
    onImagesChange(updatedImages);
  };

  const canAddMore = images.length < maxPhotos && !isLoading;

  return (
    <VStack space={4}>
      <HStack justifyContent="space-between" alignItems="center">
        <VStack>
          <Text fontSize="md" fontWeight="semibold" color="gray.800">
            Business Photos
          </Text>
          {enableReordering && images.length > 1 && (
            <Text fontSize="xs" color="gray.500">
              Drag to reorder photos
            </Text>
          )}
        </VStack>
        <Badge colorScheme="blue" variant="outline">
          {images.length} / {maxPhotos}
        </Badge>
      </HStack>

      {/* Photo Grid */}
      <ScrollView>
        <VStack space={3}>
          {/* Photo Rows (2 per row) */}
          {Array.from({ length: Math.ceil(images.length / 2) }, (_, rowIndex) => (
            <HStack key={rowIndex} space={3} justifyContent="space-between">
              {images.slice(rowIndex * 2, rowIndex * 2 + 2).map((photo, colIndex) => {
                const actualIndex = rowIndex * 2 + colIndex;
                return (
                  <Box key={photo.id} flex={1} position="relative">
                    <Pressable onPress={() => handlePhotoPress(photo)}>
                      <Box
                        w="100%"
                        h="120px"
                        rounded="md"
                        overflow="hidden"
                        borderWidth={1}
                        borderColor={photo.error ? 'red.300' : 'gray.200'}
                      >
                        <Image
                          source={{ uri: photo.uri }}
                          alt={`Business photo ${actualIndex + 1}`}
                          w="100%"
                          h="100%"
                          resizeMode="cover"
                        />

                        {/* Upload Progress Overlay */}
                        {photo.isUploading && (
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
                                value={photo.uploadProgress || 0}
                                w="80%"
                                colorScheme="blue"
                              />
                              <Text fontSize="xs" color="white">
                                {Math.round(photo.uploadProgress || 0)}%
                              </Text>
                            </VStack>
                          </Box>
                        )}

                        {/* Error Overlay */}
                        {photo.error && (
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

                        {/* Success Badge */}
                        {!photo.isUploading && !photo.error && businessId && (
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

                        {/* Photo Order Badge */}
                        <Badge
                          colorScheme="blue"
                          variant="solid"
                          position="absolute"
                          top={2}
                          left={2}
                        >
                          {actualIndex + 1}
                        </Badge>
                      </Box>
                    </Pressable>

                    {/* Remove Button */}
                    <IconButton
                      icon={<Text fontSize="sm" color="white">✕</Text>}
                      size="sm"
                      variant="solid"
                      colorScheme="red"
                      rounded="full"
                      position="absolute"
                      top={-2}
                      right={-2}
                      onPress={() => handleRemovePhoto(photo.id)}
                    />

                    {/* Drag Handle (if reordering enabled) */}
                    {enableReordering && images.length > 1 && (
                      <Box
                        position="absolute"
                        bottom={2}
                        right={2}
                        p={1}
                        bg="black:alpha.50"
                        rounded="sm"
                      >
                        <Text fontSize="xs" color="white">
                          ⋮⋮
                        </Text>
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* Fill empty space if odd number of photos */}
              {images.slice(rowIndex * 2, rowIndex * 2 + 2).length === 1 && (
                <Box flex={1} />
              )}
            </HStack>
          ))}

          {/* Add Photo Button */}
          {canAddMore && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Add Photos',
                  'Choose how to add business photos',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Camera', onPress: () => handlePhotoSelection('camera') },
                    { text: 'Photo Library', onPress: () => handlePhotoSelection('library') },
                  ]
                );
              }}
            >
              <Box
                w="100%"
                h="80px"
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
                  <Text fontSize="sm" color="gray.500">
                    Add More Photos
                  </Text>
                </VStack>
              </Box>
            </Pressable>
          )}
        </VStack>
      </ScrollView>

      {/* Action Buttons */}
      {canAddMore && (
        <HStack space={2}>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handlePhotoSelection('camera')}
            leftIcon={<Text>📷</Text>}
            isDisabled={isLoading}
          >
            Camera
          </Button>
          <Button
            flex={1}
            variant="outline"
            onPress={() => handlePhotoSelection('library')}
            leftIcon={<Text>🖼️</Text>}
            isDisabled={isLoading}
          >
            Gallery
          </Button>
        </HStack>
      )}

      {/* Photo Preview Modal */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} size="full">
        <Modal.Content maxWidth="95%" maxHeight="85%">
          <Modal.CloseButton />
          <Modal.Header>Photo Preview</Modal.Header>
          <Modal.Body>
            {selectedImage && (
              <VStack space={4} alignItems="center">
                <Image
                  source={{ uri: selectedImage.uri }}
                  alt="Selected business photo"
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
                  <Text fontSize="sm" color="gray.600">
                    Position: #{images.findIndex(img => img.id === selectedImage.id) + 1} of {images.length}
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
        Upload up to {maxPhotos} high-quality photos showcasing your business, products, or services. 
        {enableReordering && ' First photo will be the main image in search results.'}
      </Text>
    </VStack>
  );
};