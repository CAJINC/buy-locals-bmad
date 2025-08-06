import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SearchLoadingStateProps {
  message?: string;
  submessage?: string;
  showProgress?: boolean;
  progressValue?: number;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    placeholderColor: string;
  };
  style?: any;
  compact?: boolean;
}

export const SearchLoadingState: React.FC<SearchLoadingStateProps> = ({
  message = 'Searching...',
  submessage = 'Finding the best results for you',
  showProgress = false,
  progressValue = 0,
  theme,
  style,
  compact = false,
}) => {
  // Animation values
  const searchIconRotation = useSharedValue(0);
  const searchIconScale = useSharedValue(1);
  const progressOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const dotAnimation1 = useSharedValue(0);
  const dotAnimation2 = useSharedValue(0);
  const dotAnimation3 = useSharedValue(0);
  const shimmerPosition = useSharedValue(-200);

  // Initialize animations
  useEffect(() => {
    // Search icon rotation
    searchIconRotation.value = withRepeat(
      withTiming(360, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Search icon scale pulse
    searchIconScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Pulse animation
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.2, { duration: 1000 })
      ),
      -1,
      false
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );

    // Dot loading animation
    const dotAnimationSequence = (sharedValue: Animated.SharedValue<number>, delay: number) => {
      sharedValue.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300 }),
            withTiming(0.3, { duration: 300 }),
            withTiming(0.3, { duration: 400 })
          ),
          -1,
          false
        )
      );
    };

    dotAnimationSequence(dotAnimation1, 0);
    dotAnimationSequence(dotAnimation2, 200);
    dotAnimationSequence(dotAnimation3, 400);

    // Shimmer effect
    shimmerPosition.value = withRepeat(
      withTiming(SCREEN_WIDTH + 200, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, [
    searchIconRotation,
    searchIconScale,
    pulseOpacity,
    pulseScale,
    dotAnimation1,
    dotAnimation2,
    dotAnimation3,
    shimmerPosition,
  ]);

  // Progress animation
  useEffect(() => {
    if (showProgress) {
      progressOpacity.value = withTiming(1, { duration: 300 });
      progressWidth.value = withTiming(progressValue * 100, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      });
    } else {
      progressOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [showProgress, progressValue, progressOpacity, progressWidth]);

  // Animated styles
  const searchIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${searchIconRotation.value}deg` },
        { scale: searchIconScale.value },
      ],
    };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    };
  });

  const progressContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progressOpacity.value,
    };
  });

  const progressBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  const dot1AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dotAnimation1.value,
      transform: [
        {
          scale: interpolate(dotAnimation1.value, [0.3, 1], [0.5, 1]),
        },
      ],
    };
  });

  const dot2AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dotAnimation2.value,
      transform: [
        {
          scale: interpolate(dotAnimation2.value, [0.3, 1], [0.5, 1]),
        },
      ],
    };
  });

  const dot3AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dotAnimation3.value,
      transform: [
        {
          scale: interpolate(dotAnimation3.value, [0.3, 1], [0.5, 1]),
        },
      ],
    };
  });

  const shimmerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shimmerPosition.value }],
    };
  });

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          { backgroundColor: theme.backgroundColor },
          style,
        ]}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <Animated.View style={[styles.compactIconContainer, searchIconAnimatedStyle]}>
          <Ionicons name="search" size={16} color={theme.primaryColor} />
        </Animated.View>
        
        <Text style={[styles.compactMessage, { color: theme.textColor }]}>
          {message}
        </Text>
        
        <View style={styles.compactDots}>
          <Animated.View style={[styles.compactDot, { backgroundColor: theme.primaryColor }, dot1AnimatedStyle]} />
          <Animated.View style={[styles.compactDot, { backgroundColor: theme.primaryColor }, dot2AnimatedStyle]} />
          <Animated.View style={[styles.compactDot, { backgroundColor: theme.primaryColor }, dot3AnimatedStyle]} />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor },
        style,
      ]}
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
    >
      {/* Background pulse effect */}
      <Animated.View
        style={[
          styles.pulseBackground,
          {
            backgroundColor: theme.primaryColor,
          },
          pulseAnimatedStyle,
        ]}
      />

      {/* Main content */}
      <View style={styles.content}>
        {/* Search icon with animation */}
        <View style={styles.iconContainer}>
          <Animated.View style={searchIconAnimatedStyle}>
            <Ionicons name="search" size={32} color={theme.primaryColor} />
          </Animated.View>
        </View>

        {/* Loading message */}
        <Text style={[styles.message, { color: theme.textColor }]}>
          {message}
        </Text>

        {/* Submessage */}
        <Text style={[styles.submessage, { color: theme.placeholderColor }]}>
          {submessage}
        </Text>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.primaryColor },
              dot1AnimatedStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.primaryColor },
              dot2AnimatedStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.primaryColor },
              dot3AnimatedStyle,
            ]}
          />
        </View>

        {/* Progress bar */}
        {showProgress && (
          <Animated.View
            style={[styles.progressContainer, progressContainerAnimatedStyle]}
          >
            <View style={[styles.progressTrack, { backgroundColor: theme.placeholderColor + '30' }]}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.primaryColor },
                  progressBarAnimatedStyle,
                ]}
              >
                {/* Shimmer effect */}
                <Animated.View
                  style={[styles.shimmer, shimmerAnimatedStyle]}
                />
              </Animated.View>
            </View>
            
            <Text style={[styles.progressText, { color: theme.placeholderColor }]}>
              {Math.round(progressValue * 100)}%
            </Text>
          </Animated.View>
        )}

        {/* Loading states text */}
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, { color: theme.placeholderColor }]}>
            Analyzing your preferences...
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    position: 'relative',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pulseBackground: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.1,
  },
  content: {
    alignItems: 'center',
    maxWidth: 280,
  },
  iconContainer: {
    marginBottom: 24,
  },
  compactIconContainer: {
    marginRight: 8,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  compactMessage: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
  },
  submessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  compactDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SearchLoadingState;