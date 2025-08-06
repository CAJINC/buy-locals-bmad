import React, { useState, useEffect } from 'react';
import {
  Box,
  Pressable,
  Skeleton,
  Icon,
  Text,
  VStack,
  Center,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from 'react-native-fast-image';
import { PhotoItem as PhotoItemType } from './types';

interface PhotoItemProps {
  photo: PhotoItemType;
  onPress: () => void;
  width: number;
  height: number;
  borderRadius?: number;
  lazy?: boolean;
  priority?: FastImage.Priority;
  showMetadata?: boolean;
  placeholder?: boolean;
}

export const PhotoItem: React.FC<PhotoItemProps> = ({
  photo,
  onPress,
  width,
  height,
  borderRadius = 8,
  lazy = true,
  priority = FastImage.priority.normal,
  showMetadata = false,
  placeholder = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setImageLoaded(true);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
    setImageLoaded(false);
  };

  // Reset states when photo URL changes
  useEffect(() => {
    if (photo.url) {
      setLoading(true);
      setError(false);
      setImageLoaded(false);
    }
  }, [photo.url]);

  if (placeholder) {
    return (
      <Box
        width={width}
        height={height}
        borderRadius={borderRadius}
        overflow="hidden"
      >
        <Skeleton
          width="100%"
          height="100%"
          startColor="gray.100"
          endColor="gray.200"
        />
      </Box>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <VStack space={1}>
        <Box
          width={width}
          height={height}
          borderRadius={borderRadius}
          overflow="hidden"
          bg="gray.100"
          position="relative"
        >
          {/* Loading Skeleton */}
          {loading && (
            <Skeleton
              position="absolute"
              width="100%"
              height="100%"
              startColor="gray.100"
              endColor="gray.200"
              zIndex={1}
            />
          )}

          {/* Error State */}
          {error && (
            <Center
              position="absolute"
              width="100%"
              height="100%"
              bg="gray.200"
              zIndex={2}
            >
              <Icon
                as={MaterialIcons}
                name="broken-image"
                size="lg"
                color="gray.400"
              />
              <Text color="gray.500" fontSize="xs" mt={1}>
                Failed to load
              </Text>
            </Center>
          )}

          {/* Actual Image */}
          {photo.url && (
            <FastImage
              source={{
                uri: photo.url,
                priority: priority,
              }}
              style={{
                width: '100%',
                height: '100%',
                opacity: imageLoaded ? 1 : 0,
              }}
              onLoadStart={handleLoadStart}
              onLoad={handleLoad}
              onError={handleError}
              resizeMode={FastImage.resizeMode.cover}
              cache={FastImage.cacheControl.immutable}
            />
          )}

          {/* Photo Type Indicator */}
          {photo.type === 'logo' && imageLoaded && (
            <Box
              position="absolute"
              top={2}
              right={2}
              bg="rgba(0,0,0,0.7)"
              px={2}
              py={1}
              borderRadius="sm"
            >
              <Text color="white" fontSize="xs" fontWeight="medium">
                Logo
              </Text>
            </Box>
          )}
        </Box>

        {/* Photo Metadata */}
        {showMetadata && photo.metadata && (
          <VStack space={1} maxW={width}>
            {photo.metadata.title && (
              <Text fontSize="sm" fontWeight="medium" numberOfLines={1}>
                {photo.metadata.title}
              </Text>
            )}
            {photo.metadata.caption && (
              <Text fontSize="xs" color="gray.600" numberOfLines={2}>
                {photo.metadata.caption}
              </Text>
            )}
            {photo.metadata.tags && photo.metadata.tags.length > 0 && (
              <Text fontSize="xs" color="blue.600" numberOfLines={1}>
                #{photo.metadata.tags.slice(0, 3).join(' #')}
              </Text>
            )}
          </VStack>
        )}
      </VStack>
    </Pressable>
  );
};

// Placeholder component for lazy loading
export const PhotoItemPlaceholder: React.FC<{
  width: number;
  height: number;
  borderRadius?: number;
}> = ({ width, height, borderRadius = 8 }) => {
  return (
    <Box
      width={width}
      height={height}
      borderRadius={borderRadius}
      overflow="hidden"
    >
      <Skeleton
        width="100%"
        height="100%"
        startColor="gray.100"
        endColor="gray.200"
      />
    </Box>
  );
};