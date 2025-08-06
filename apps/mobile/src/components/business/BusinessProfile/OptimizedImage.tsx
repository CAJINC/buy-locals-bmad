import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Skeleton, Center, Icon, Text, VStack, useColorModeValue } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { LayoutChangeEvent } from 'react-native';
import FastImage, { ResizeMode } from 'react-native-fast-image';
import { ImageOptimizer, LazyLoader, PerformanceMonitor } from './utils/performanceUtils';
import { AccessibilityHelper, ScreenReaderOptimizer } from './utils/accessibilityUtils';

export interface OptimizedImageProps {
  source: { uri: string } | number;
  width?: number | string;
  height?: number | string;
  resizeMode?: ResizeMode;
  borderRadius?: number;
  alt?: string;
  placeholder?: string;
  fallbackIcon?: string;
  lazyLoad?: boolean;
  preload?: boolean;
  cache?: 'immutable' | 'web' | 'cacheOnly';
  quality?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onPress?: () => void;
  testID?: string;
  accessible?: boolean;
  accessibilityRole?: 'image' | 'button';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: Record<string, unknown>;
  containerStyle?: Record<string, unknown>;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  width = '100%',
  height = 200,
  resizeMode = FastImage.resizeMode.cover,
  borderRadius = 0,
  alt,
  placeholder: _placeholder = 'Loading image...',
  fallbackIcon: _fallbackIcon = 'image',
  lazyLoad = true,
  preload = false,
  cache = 'immutable',
  quality = 80,
  onLoad,
  onError,
  onPress,
  testID,
  accessible = true,
  accessibilityRole = onPress ? 'button' : 'image',
  accessibilityLabel,
  accessibilityHint,
  style,
  containerStyle,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!lazyLoad);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<string>(Math.random().toString());

  // Theme-based colors
  const skeletonColor = useColorModeValue('gray.200', 'gray.600');
  const skeletonEndColor = useColorModeValue('gray.300', 'gray.500');
  const errorBgColor = useColorModeValue('gray.100', 'gray.700');
  const errorIconColor = useColorModeValue('gray.400', 'gray.500');
  const errorTextColor = useColorModeValue('gray.500', 'gray.400');

  // Handle container layout for responsive sizing
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
    setContainerSize({ width: containerWidth, height: containerHeight });
  }, []);

  // Get optimized source URI
  const optimizedSource = React.useMemo(() => {
    if (typeof source === 'number') return source;

    const sourceUri = source.uri;
    if (!sourceUri || !containerSize.width || !containerSize.height) {
      return source;
    }

    const optimizedUri = ImageOptimizer.getOptimizedImageUrl(
      sourceUri,
      containerSize.width,
      containerSize.height,
      quality
    );

    return {
      uri: optimizedUri,
      priority: FastImage.priority.normal,
      cache: FastImage.cacheControl[cache],
    };
  }, [source, containerSize, quality, cache]);

  // Handle lazy loading
  useEffect(() => {
    if (lazyLoad && !visible) {
      const itemId = imageRef.current;
      LazyLoader.register(itemId, () => setVisible(true));

      // Simulate intersection observer logic
      // In a real implementation, this would use actual intersection observer
      const timer = setTimeout(() => {
        LazyLoader.markVisible(itemId);
      }, 100);

      return () => {
        clearTimeout(timer);
        LazyLoader.unregister(itemId);
      };
    }
  }, [lazyLoad, visible]);

  // Handle preloading
  useEffect(() => {
    if (preload && typeof optimizedSource === 'object' && optimizedSource.uri) {
      FastImage.preload([optimizedSource]);
    }
  }, [preload, optimizedSource]);

  // Handle image loading
  const handleImageLoad = useCallback(() => {
    PerformanceMonitor.endMeasure(`image_load_${imageRef.current}`);
    setLoading(false);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleImageError = useCallback(
    (errorEvent: { nativeEvent: { error: string } }) => {
      PerformanceMonitor.endMeasure(`image_load_${imageRef.current}`);
      setLoading(false);
      setError(true);
      onError?.(errorEvent);
    },
    [onError]
  );

  // Start performance measurement when loading begins
  useEffect(() => {
    if (visible && !error) {
      PerformanceMonitor.startMeasure(`image_load_${imageRef.current}`);
    }
  }, [visible, error]);

  // Generate accessibility props
  const accessibilityProps = React.useMemo(() => {
    let label = accessibilityLabel;
    let hint = accessibilityHint;

    if (!label) {
      if (alt) {
        label = ScreenReaderOptimizer.describeVisualElement({
          type: 'image',
          content: alt,
          purpose: onPress ? 'interactive' : undefined,
        });
      } else {
        label = onPress ? 'Interactive image' : 'Image';
      }
    }

    if (!hint && onPress) {
      hint = AccessibilityHelper.getInteractionHint('tap', 'image');
    }

    return {
      accessible,
      accessibilityRole,
      accessibilityLabel: label,
      accessibilityHint: hint,
    };
  }, [accessible, accessibilityRole, accessibilityLabel, accessibilityHint, alt, onPress]);

  // Styles for image loading state
  const hiddenImageStyle = React.useMemo(
    () => ({
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      opacity: 0,
      borderRadius,
    }),
    [borderRadius]
  );

  // Render loading skeleton
  const renderSkeleton = () => (
    <Skeleton
      isLoaded={false}
      borderRadius={borderRadius}
      startColor={skeletonColor}
      endColor={skeletonEndColor}
    >
      <Box width={width} height={height} />
    </Skeleton>
  );

  // Render error state
  const renderError = () => (
    <Center
      width={width}
      height={height}
      bg={errorBgColor}
      borderRadius={borderRadius}
      {...accessibilityProps}
      accessibilityLabel="Image failed to load"
    >
      <VStack space={2} alignItems="center">
        <Icon as={MaterialIcons} name="broken-image" size="xl" color={errorIconColor} />
        <Text fontSize="xs" color={errorTextColor} textAlign="center">
          Image unavailable
        </Text>
      </VStack>
    </Center>
  );

  // Don't render anything if lazy loading and not visible yet
  if (lazyLoad && !visible) {
    return (
      <Box
        width={width}
        height={height}
        onLayout={handleLayout}
        style={containerStyle}
        testID={testID}
      >
        {renderSkeleton()}
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box style={containerStyle} testID={testID} onLayout={handleLayout}>
        {renderError()}
      </Box>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <Box style={containerStyle} testID={testID} onLayout={handleLayout}>
        {renderSkeleton()}
        {visible && (
          <FastImage
            source={optimizedSource}
            style={hiddenImageStyle}
            resizeMode={resizeMode}
            onLoad={handleImageLoad}
            onError={handleImageError}
            {...accessibilityProps}
          />
        )}
      </Box>
    );
  }

  // Render loaded image
  return (
    <Box style={containerStyle} testID={testID} onLayout={handleLayout}>
      <FastImage
        source={optimizedSource}
        style={[
          {
            width,
            height,
            borderRadius,
          },
          style,
        ]}
        resizeMode={resizeMode}
        onLoad={handleImageLoad}
        onError={handleImageError}
        {...accessibilityProps}
      />

      {onPress && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          onTouchEnd={onPress}
          {...accessibilityProps}
        />
      )}
    </Box>
  );
};

// Specialized image components for different use cases
export const BusinessLogoImage: React.FC<
  Omit<OptimizedImageProps, 'resizeMode' | 'accessibilityRole'>
> = props => (
  <OptimizedImage
    {...props}
    resizeMode={FastImage.resizeMode.contain}
    accessibilityRole="image"
    fallbackIcon="business"
  />
);

export const BusinessPhotoImage: React.FC<Omit<OptimizedImageProps, 'resizeMode'>> = props => (
  <OptimizedImage {...props} resizeMode={FastImage.resizeMode.cover} fallbackIcon="photo" />
);

export const ThumbnailImage: React.FC<Omit<OptimizedImageProps, 'quality' | 'cache'>> = props => (
  <OptimizedImage {...props} quality={60} cache="web" />
);

// Higher-order component for image preloading
export const withImagePreloading = <P extends object>(
  Component: React.ComponentType<P>,
  imageUrls: string[]
) => {
  return React.forwardRef<React.ElementRef<typeof Component>, P>((props, ref) => {
    useEffect(() => {
      const sources = imageUrls.map(uri => ({ uri }));
      FastImage.preload(sources);
    }, []);

    return <Component {...props} ref={ref} />;
  });
};

export default OptimizedImage;
