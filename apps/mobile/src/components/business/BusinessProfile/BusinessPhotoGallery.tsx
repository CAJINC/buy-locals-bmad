import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Center,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Alert, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
import { BusinessPhotoGalleryProps, PhotoItem } from './types';
import { PhotoGalleryScroll } from './PhotoGalleryScroll';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoItem as PhotoItemComponent } from './PhotoItem';

export const BusinessPhotoGallery: React.FC<BusinessPhotoGalleryProps> = ({
  media,
  onImagePress,
  maxImages = 6,
  aspectRatio = 1,
  enableZoom = true,
  enableGestures = true,
  lazyLoadingEnabled = true,
  showMetadata = false,
  preloadCount = 3,
  cacheEnabled = true,
}) => {
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryMode, setGalleryMode] = useState<'grid' | 'horizontal'>('horizontal');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());

  // Transform media items to PhotoItem format with enhanced metadata
  const photos = useMemo<PhotoItem[]>(() => {
    return media.map((item, index) => ({
      ...item,
      loading: imageLoading.has(item.id),
      error: imageErrors.has(item.id),
      cached: cacheEnabled,
      metadata: {
        title: item.description || `Photo ${index + 1}`,
        caption: item.description,
        dateTime: new Date(),
        tags: item.type === 'logo' ? ['logo', 'branding'] : ['gallery', 'business'],
        ...item.metadata,
      },
    }));
  }, [media, imageLoading, imageErrors, cacheEnabled]);

  const displayImages = photos.slice(0, maxImages);
  const remainingCount = photos.length - maxImages;

  // Enhanced image press handler with error handling
  const handleImagePress = useCallback((photo: PhotoItem, index: number) => {
    try {
      if (onImagePress) {
        onImagePress(photo.url, index);
      } else {
        setSelectedImageIndex(index);
        setLightboxVisible(true);
      }
    } catch (error) {
      console.error('Error opening image:', error);
      Alert.alert('Error', 'Unable to open image. Please try again.');
    }
  }, [onImagePress]);

  // Lightbox navigation handlers
  const handleNextImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const handlePrevImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleLightboxIndexChange = useCallback((index: number) => {
    setSelectedImageIndex(index);
  }, []);

  // Image loading state handlers
  const handleImageLoadStart = useCallback((imageId: string) => {
    setImageLoading(prev => new Set([...prev, imageId]));
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  const handleImageLoadEnd = useCallback((imageId: string) => {
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  const handleImageError = useCallback((imageId: string) => {
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    setImageErrors(prev => new Set([...prev, imageId]));
  }, []);

  // View all photos handler
  const handleViewAllPhotos = useCallback(() => {
    setSelectedImageIndex(0);
    setLightboxVisible(true);
  }, []);

  // Toggle gallery mode
  const handleToggleGalleryMode = useCallback(() => {
    setGalleryMode(prev => prev === 'grid' ? 'horizontal' : 'grid');
  }, []);

  // Preload images for better performance
  useEffect(() => {
    if (lazyLoadingEnabled && photos.length > 0) {
      const preloadImages = photos.slice(0, preloadCount);
      preloadImages.forEach(photo => {
        if (photo.url) {
          handleImageLoadStart(photo.id);
          // Simulate loading completion after a delay
          setTimeout(() => handleImageLoadEnd(photo.id), 1000);
        }
      });
    }
  }, [photos, lazyLoadingEnabled, preloadCount, handleImageLoadStart, handleImageLoadEnd]);

  // Empty state
  if (photos.length === 0) {
    return (
      <Box
        p={6}
        bg="gray.50"
        borderRadius="lg"
        alignItems="center"
        justifyContent="center"
        minH="200px"
      >
        <Icon
          as={MaterialIcons}
          name="photo-library"
          size="3xl"
          color="gray.400"
        />
        <Text color="gray.500" fontSize="lg" mt={3} fontWeight="medium">
          No Photos Available
        </Text>
        <Text color="gray.400" fontSize="sm" mt={1} textAlign="center">
          Photos will appear here once they're uploaded
        </Text>
      </Box>
    );
  }

  return (
    <VStack space={4}>
      {/* Gallery Header with Mode Toggle */}
      <HStack justifyContent="space-between" alignItems="center">
        <VStack>
          <Text fontSize="lg" fontWeight="semibold" color="gray.800">
            Photo Gallery
          </Text>
          {photos.length > 0 && (
            <Text fontSize="sm" color="gray.600">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </Text>
          )}
        </VStack>
        
        {photos.length > 0 && (
          <HStack space={2} alignItems="center">
            {/* Gallery Mode Toggle */}
            <Pressable onPress={handleToggleGalleryMode}>
              <Box
                p={2}
                borderRadius="md"
                bg={galleryMode === 'horizontal' ? 'blue.100' : 'gray.100'}
              >
                <Icon
                  as={MaterialIcons}
                  name={galleryMode === 'horizontal' ? 'view-carousel' : 'grid-view'}
                  size="sm"
                  color={galleryMode === 'horizontal' ? 'blue.600' : 'gray.600'}
                />
              </Box>
            </Pressable>
            
            {/* View All Button */}
            {photos.length > 3 && (
              <Pressable onPress={handleViewAllPhotos}>
                <HStack space={1} alignItems="center">
                  <Icon
                    as={MaterialIcons}
                    name="photo-library"
                    size="sm"
                    color="blue.600"
                  />
                  <Text color="blue.600" fontSize="sm" fontWeight="medium">
                    View All
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>
        )}
      </HStack>

      {/* Photo Gallery Content */}
      {galleryMode === 'horizontal' ? (
        // Horizontal Scrolling Gallery
        <PhotoGalleryScroll
          photos={photos}
          onPhotoPress={handleImagePress}
          horizontal={true}
          lazyLoadingEnabled={lazyLoadingEnabled}
          preloadCount={preloadCount}
          showThumbnails={showMetadata}
          itemHeight={200}
        />
      ) : (
        // Grid Layout for Legacy Support
        <VStack space={3}>
          {/* Featured Image */}
          {displayImages.length > 0 && (
            <PhotoItemComponent
              photo={displayImages[0]}
              onPress={() => handleImagePress(displayImages[0], 0)}
              width={screenWidth - 32}
              height={200}
              borderRadius={12}
              lazy={lazyLoadingEnabled}
              showMetadata={showMetadata}
              priority={'high'}
            />
          )}

          {/* Secondary Images Grid */}
          {displayImages.length > 1 && (
            <HStack space={2} flex={1}>
              {displayImages.slice(1, 4).map((photo, index) => (
                <Box key={photo.id} flex={1}>
                  <PhotoItemComponent
                    photo={photo}
                    onPress={() => handleImagePress(photo, index + 1)}
                    width={(screenWidth - 48) / 3}
                    height={100}
                    borderRadius={8}
                    lazy={lazyLoadingEnabled}
                    showMetadata={false}
                    priority={'normal'}
                  />
                </Box>
              ))}
              
              {/* Show More Button */}
              {remainingCount > 0 && (
                <Pressable
                  flex={1}
                  onPress={handleViewAllPhotos}
                >
                  <Box
                    width={(screenWidth - 48) / 3}
                    height={100}
                    borderRadius={8}
                    bg="gray.800"
                    opacity={0.9}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="white" fontSize="lg" fontWeight="bold">
                      +{remainingCount}
                    </Text>
                    <Text color="white" fontSize="xs" mt={1}>
                      more
                    </Text>
                  </Box>
                </Pressable>
              )}
            </HStack>
          )}
        </VStack>
      )}

      {/* Enhanced Photo Lightbox */}
      <PhotoLightbox
        photos={photos}
        initialIndex={selectedImageIndex}
        visible={lightboxVisible}
        onClose={() => setLightboxVisible(false)}
        onIndexChange={handleLightboxIndexChange}
        enableZoom={enableZoom}
        enableGestures={enableGestures}
        showMetadata={showMetadata}
      />
    </VStack>
  );
};