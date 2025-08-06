import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Modal,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  ScrollView,
  CloseIcon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions, StatusBar } from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  State,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import { PhotoLightboxProps } from './types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ZoomableImageProps {
  uri: string;
  onDoubleTap: () => void;
  onSingleTap: () => void;
  enableZoom: boolean;
  enableGestures: boolean;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({
  uri,
  onDoubleTap,
  onSingleTap,
  enableZoom,
  enableGestures,
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  const maxScale = 4;
  const minScale = 1;

  const resetTransform = useCallback(() => {
    'worklet';
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    lastScale.value = 1;
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;
  }, [scale, translateX, translateY, lastScale, lastTranslateX, lastTranslateY]);

  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: () => {
      lastScale.value = scale.value;
    },
    onActive: (event) => {
      if (!enableZoom) return;
      
      const newScale = clamp(
        lastScale.value * event.scale,
        minScale,
        maxScale
      );
      scale.value = newScale;

      // Constrain translation based on scale
      const maxTranslateX = ((screenWidth * newScale) - screenWidth) / 2;
      const maxTranslateY = ((screenHeight * newScale) - screenHeight) / 2;

      translateX.value = clamp(
        lastTranslateX.value + event.focalX,
        -maxTranslateX,
        maxTranslateX
      );
      translateY.value = clamp(
        lastTranslateY.value + event.focalY,
        -maxTranslateY,
        maxTranslateY
      );
    },
    onEnd: () => {
      lastScale.value = scale.value;
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;

      // Snap back to bounds if needed
      if (scale.value < minScale) {
        runOnJS(resetTransform)();
      }
    },
  });

  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    },
    onActive: (event) => {
      if (!enableGestures || scale.value <= 1) return;

      const maxTranslateX = ((screenWidth * scale.value) - screenWidth) / 2;
      const maxTranslateY = ((screenHeight * scale.value) - screenHeight) / 2;

      translateX.value = clamp(
        lastTranslateX.value + event.translationX,
        -maxTranslateX,
        maxTranslateX
      );
      translateY.value = clamp(
        lastTranslateY.value + event.translationY,
        -maxTranslateY,
        maxTranslateY
      );
    },
    onEnd: () => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    },
  });

  const tapHandler = useAnimatedGestureHandler({
    onStart: () => {
      // Handle tap gestures
    },
    onEnd: () => {
      if (scale.value > 1) {
        runOnJS(resetTransform)();
      } else {
        runOnJS(onSingleTap)();
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  return (
    <Box flex={1} justifyContent="center" alignItems="center">
      <PanGestureHandler onGestureEvent={tapHandler} enabled={enableGestures}>
        <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <PanGestureHandler onGestureEvent={panHandler} enabled={enableGestures}>
            <Animated.View>
              <PinchGestureHandler onGestureEvent={pinchHandler} enabled={enableZoom}>
                <Animated.View style={animatedStyle}>
                  <FastImage
                    source={{ uri }}
                    style={{
                      width: screenWidth * 0.9,
                      height: screenHeight * 0.7,
                    }}
                    resizeMode={FastImage.resizeMode.contain}
                  />
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </Box>
  );
};

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  visible,
  onClose,
  onIndexChange,
  enableZoom = true,
  enableGestures = true,
  showMetadata = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentPhoto = photos[currentIndex];

  const handleIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
    onIndexChange?.(index);
  }, [onIndexChange]);

  const handleNextImage = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      const newIndex = currentIndex + 1;
      handleIndexChange(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * screenWidth,
        animated: true,
      });
    }
  }, [currentIndex, photos.length, handleIndexChange]);

  const handlePrevImage = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      handleIndexChange(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * screenWidth,
        animated: true,
      });
    }
  }, [currentIndex, handleIndexChange]);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < photos.length) {
      handleIndexChange(newIndex);
    }
  }, [currentIndex, photos.length, handleIndexChange]);

  // Update currentIndex when initialIndex changes
  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible || !currentPhoto) {
    return null;
  }

  return (
    <Modal isOpen={visible} onClose={onClose} size="full">
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <Modal.Content bg="black" maxWidth="100%" maxHeight="100%" m={0}>
        <Modal.Header bg="black" borderBottomWidth={0} py={2}>
          <HStack justifyContent="space-between" alignItems="center" flex={1}>
            <VStack>
              <Text color="white" fontSize="lg" fontWeight="bold">
                {currentIndex + 1} of {photos.length}
              </Text>
              {showMetadata && currentPhoto.metadata?.title && (
                <Text color="gray.300" fontSize="sm">
                  {currentPhoto.metadata.title}
                </Text>
              )}
            </VStack>
            <Pressable onPress={onClose} p={2}>
              <CloseIcon color="white" size="md" />
            </Pressable>
          </HStack>
        </Modal.Header>

        <Modal.Body bg="black" p={0} flex={1}>
          {photos.length === 1 ? (
            // Single image view
            <ZoomableImage
              uri={currentPhoto.url}
              onDoubleTap={() => {}}
              onSingleTap={() => {}}
              enableZoom={enableZoom}
              enableGestures={enableGestures}
            />
          ) : (
            // Scrollable gallery view
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
            >
              {photos.map((photo, index) => (
                <Box key={photo.id} width={screenWidth}>
                  <ZoomableImage
                    uri={photo.url}
                    onDoubleTap={() => {}}
                    onSingleTap={() => {}}
                    enableZoom={enableZoom}
                    enableGestures={enableGestures}
                  />
                </Box>
              ))}
            </ScrollView>
          )}
        </Modal.Body>

        {/* Footer with metadata and controls */}
        <Box bg="black" px={4} py={2}>
          {/* Navigation Controls */}
          <HStack justifyContent="space-between" alignItems="center" mb={2}>
            <Pressable
              onPress={handlePrevImage}
              disabled={currentIndex === 0}
              opacity={currentIndex === 0 ? 0.3 : 1}
            >
              <Box
                p={3}
                borderRadius="full"
                bg="rgba(255,255,255,0.2)"
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  as={MaterialIcons}
                  name="chevron-left"
                  size="xl"
                  color="white"
                />
              </Box>
            </Pressable>

            {/* Photo indicators */}
            <HStack space={1} alignItems="center">
              {photos.slice(0, Math.min(photos.length, 5)).map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    handleIndexChange(index);
                    scrollViewRef.current?.scrollTo({
                      x: index * screenWidth,
                      animated: true,
                    });
                  }}
                >
                  <Box
                    width={index === currentIndex ? 3 : 2}
                    height={index === currentIndex ? 3 : 2}
                    borderRadius="full"
                    bg={index === currentIndex ? "white" : "gray.400"}
                  />
                </Pressable>
              ))}
              {photos.length > 5 && (
                <Text color="white" fontSize="xs" ml={2}>
                  +{photos.length - 5}
                </Text>
              )}
            </HStack>

            <Pressable
              onPress={handleNextImage}
              disabled={currentIndex === photos.length - 1}
              opacity={currentIndex === photos.length - 1 ? 0.3 : 1}
            >
              <Box
                p={3}
                borderRadius="full"
                bg="rgba(255,255,255,0.2)"
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  as={MaterialIcons}
                  name="chevron-right"
                  size="xl"
                  color="white"
                />
              </Box>
            </Pressable>
          </HStack>

          {/* Photo Metadata */}
          {showMetadata && currentPhoto.metadata && (
            <VStack space={2}>
              {currentPhoto.metadata.caption && (
                <Text color="gray.300" fontSize="sm" textAlign="center">
                  {currentPhoto.metadata.caption}
                </Text>
              )}
              
              <HStack justifyContent="center" space={4} flexWrap="wrap">
                {currentPhoto.metadata.dateTime && (
                  <Text color="gray.400" fontSize="xs">
                    {new Date(currentPhoto.metadata.dateTime).toLocaleDateString()}
                  </Text>
                )}
                
                {currentPhoto.metadata.location && (
                  <Text color="gray.400" fontSize="xs">
                    📍 {currentPhoto.metadata.location}
                  </Text>
                )}
                
                {currentPhoto.metadata.photographer && (
                  <Text color="gray.400" fontSize="xs">
                    📸 {currentPhoto.metadata.photographer}
                  </Text>
                )}
              </HStack>

              {currentPhoto.metadata.tags && currentPhoto.metadata.tags.length > 0 && (
                <Text color="blue.300" fontSize="xs" textAlign="center">
                  #{currentPhoto.metadata.tags.join(' #')}
                </Text>
              )}
            </VStack>
          )}

          {/* Instructions */}
          {enableZoom && (
            <Text color="gray.500" fontSize="xs" textAlign="center" mt={2}>
              Pinch to zoom • Tap to close
            </Text>
          )}
        </Box>
      </Modal.Content>
    </Modal>
  );
};