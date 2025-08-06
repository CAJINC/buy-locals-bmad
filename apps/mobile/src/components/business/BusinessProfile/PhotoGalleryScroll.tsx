import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  FlatList,
  Skeleton,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions, ViewToken } from 'react-native';
import { PhotoItem, PhotoItemPlaceholder } from './PhotoItem';
import { PhotoGalleryScrollProps, PhotoItem as PhotoItemType } from './types';

const { width: screenWidth } = Dimensions.get('window');

interface PhotoGalleryScrollState {
  visibleItems: Set<string>;
  loadedItems: Set<string>;
  errorItems: Set<string>;
}

export const PhotoGalleryScroll: React.FC<PhotoGalleryScrollProps> = ({
  photos,
  onPhotoPress,
  horizontal = true,
  lazyLoadingEnabled = true,
  preloadCount = 3,
  showThumbnails = false,
  itemHeight = 200,
  itemWidth = 150,
}) => {
  const [state, setState] = useState<PhotoGalleryScrollState>({
    visibleItems: new Set(),
    loadedItems: new Set(),
    errorItems: new Set(),
  });
  
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculate item dimensions based on screen size and layout
  const getItemDimensions = useCallback(() => {
    if (horizontal) {
      const padding = 32; // 16px on each side
      const spacing = 12; // gap between items
      const visibleItems = showThumbnails ? 2.5 : 2.2;
      
      const availableWidth = screenWidth - padding;
      const totalSpacing = spacing * (visibleItems - 1);
      const calculatedWidth = (availableWidth - totalSpacing) / visibleItems;
      
      return {
        width: Math.floor(calculatedWidth),
        height: itemHeight,
      };
    }
    
    return {
      width: itemWidth,
      height: itemHeight,
    };
  }, [horizontal, showThumbnails, itemHeight, itemWidth]);

  const { width: calculatedWidth, height: calculatedHeight } = getItemDimensions();

  // Handle visibility changes for lazy loading
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visibleIds = new Set(
        viewableItems.map((item) => item.item?.id).filter(Boolean)
      );
      
      setState((prevState) => ({
        ...prevState,
        visibleItems: visibleIds,
      }));

      // Update current index for horizontal scrolling
      if (horizontal && viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }

      // Preload nearby items
      if (lazyLoadingEnabled) {
        const preloadIds = new Set<string>();
        
        viewableItems.forEach((item) => {
          const index = item.index;
          if (index !== null) {
            // Add current and nearby items for preloading
            for (let i = Math.max(0, index - preloadCount); 
                 i <= Math.min(photos.length - 1, index + preloadCount); 
                 i++) {
              if (photos[i]?.id) {
                preloadIds.add(photos[i].id);
              }
            }
          }
        });

        setState((prevState) => ({
          ...prevState,
          loadedItems: new Set([...prevState.loadedItems, ...preloadIds]),
        }));
      }
    },
    [horizontal, lazyLoadingEnabled, preloadCount, photos]
  );

  // Initialize visible items for non-lazy loading
  useEffect(() => {
    if (!lazyLoadingEnabled) {
      const allIds = new Set(photos.map((photo) => photo.id));
      setState((prevState) => ({
        ...prevState,
        visibleItems: allIds,
        loadedItems: allIds,
      }));
    }
  }, [photos, lazyLoadingEnabled]);

  const shouldLoadImage = useCallback(
    (photoId: string) => {
      if (!lazyLoadingEnabled) return true;
      return state.visibleItems.has(photoId) || state.loadedItems.has(photoId);
    },
    [lazyLoadingEnabled, state.visibleItems, state.loadedItems]
  );

  const handlePhotoPress = useCallback(
    (photo: PhotoItemType, index: number) => {
      onPhotoPress(photo, index);
    },
    [onPhotoPress]
  );

  const renderPhotoItem = useCallback(
    ({ item: photo, index }: { item: PhotoItemType; index: number }) => {
      const shouldLoad = shouldLoadImage(photo.id);
      
      if (!shouldLoad && lazyLoadingEnabled) {
        return (
          <Box mr={horizontal ? 3 : 0} mb={horizontal ? 0 : 3}>
            <PhotoItemPlaceholder
              width={calculatedWidth}
              height={calculatedHeight}
              borderRadius={12}
            />
          </Box>
        );
      }

      return (
        <Box mr={horizontal ? 3 : 0} mb={horizontal ? 0 : 3}>
          <PhotoItem
            photo={photo}
            onPress={() => handlePhotoPress(photo, index)}
            width={calculatedWidth}
            height={calculatedHeight}
            borderRadius={12}
            lazy={lazyLoadingEnabled}
            showMetadata={showThumbnails}
            priority={
              index < 3 ? 'high' : 'normal'
            }
          />
        </Box>
      );
    },
    [
      shouldLoadImage,
      lazyLoadingEnabled,
      horizontal,
      calculatedWidth,
      calculatedHeight,
      showThumbnails,
      handlePhotoPress,
    ]
  );

  const renderEmptyState = useCallback(() => (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      minH={calculatedHeight}
      bg="gray.50"
      borderRadius="lg"
    >
      <Icon
        as={MaterialIcons}
        name="photo-library"
        size="2xl"
        color="gray.400"
      />
      <Text color="gray.500" fontSize="md" mt={2}>
        No photos available
      </Text>
    </Box>
  ), [calculatedHeight]);

  const renderHeader = useCallback(() => {
    if (!horizontal || photos.length <= 1) return null;

    return (
      <HStack
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        px={4}
      >
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">
          Photos ({photos.length})
        </Text>
        
        {photos.length > 3 && (
          <Text fontSize="sm" color="blue.600">
            Swipe to see more
          </Text>
        )}
      </HStack>
    );
  }, [horizontal, photos.length]);

  const renderFooter = useCallback(() => {
    if (!horizontal || photos.length <= 5) return null;

    return (
      <Box
        width={calculatedWidth}
        height={calculatedHeight}
        mr={3}
        borderRadius={12}
        bg="gray.800"
        opacity={0.8}
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          onPress={() => onPhotoPress(photos[0], 0)}
          flex={1}
          width="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Text color="white" fontSize="lg" fontWeight="bold">
            +{Math.max(0, photos.length - 5)}
          </Text>
          <Text color="white" fontSize="xs" mt={1}>
            more photos
          </Text>
        </Pressable>
      </Box>
    );
  }, [horizontal, photos.length, calculatedWidth, calculatedHeight, onPhotoPress, photos]);

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: horizontal ? calculatedWidth + 12 : calculatedHeight + 12,
      offset: (horizontal ? calculatedWidth + 12 : calculatedHeight + 12) * index,
      index,
    }),
    [horizontal, calculatedWidth, calculatedHeight]
  );

  if (photos.length === 0) {
    return renderEmptyState();
  }

  return (
    <VStack space={0}>
      {renderHeader()}
      
      <Box>
        <FlatList
          ref={flatListRef}
          data={horizontal ? photos.slice(0, 5) : photos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id}
          horizontal={horizontal}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 50,
            waitForInteraction: true,
          }}
          getItemLayout={getItemLayout}
          initialNumToRender={horizontal ? 3 : 5}
          maxToRenderPerBatch={horizontal ? 2 : 3}
          windowSize={horizontal ? 5 : 10}
          removeClippedSubviews={lazyLoadingEnabled}
          contentContainerStyle={{
            paddingHorizontal: horizontal ? 16 : 0,
            paddingVertical: horizontal ? 0 : 8,
          }}
          ListFooterComponent={renderFooter}
        />
        
        {/* Position Indicator for Horizontal Scrolling */}
        {horizontal && photos.length > 1 && (
          <HStack
            space={1}
            justifyContent="center"
            alignItems="center"
            mt={3}
          >
            {photos.slice(0, Math.min(photos.length, 5)).map((_, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                  });
                }}
              >
                <Box
                  width={index === currentIndex ? 3 : 2}
                  height={index === currentIndex ? 3 : 2}
                  borderRadius="full"
                  bg={index === currentIndex ? "blue.600" : "gray.300"}
                />
              </Pressable>
            ))}
            {photos.length > 5 && (
              <Text color="gray.500" fontSize="xs" ml={2}>
                +{photos.length - 5}
              </Text>
            )}
          </HStack>
        )}
      </Box>
    </VStack>
  );
};