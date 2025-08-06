import { useState, useEffect, useMemo } from 'react';
import { Dimensions, DeviceEventEmitter, Platform } from 'react-native';
import { useColorMode, useColorModeValue } from 'native-base';
import { AccessibilityHelper } from '../utils/accessibilityUtils';
import { DeviceCapabilities } from '../utils/performanceUtils';

const { width: initialWidth, height: initialHeight } = Dimensions.get('window');

// Breakpoint definitions
export const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// Device type detection
export type DeviceType = 'phone' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface ResponsiveDesignHook {
  // Screen dimensions
  width: number;
  height: number;
  
  // Device information
  deviceType: DeviceType;
  orientation: Orientation;
  isTablet: boolean;
  isPhone: boolean;
  
  // Breakpoint information
  currentBreakpoint: Breakpoint;
  isBreakpoint: (breakpoint: Breakpoint) => boolean;
  isBreakpointUp: (breakpoint: Breakpoint) => boolean;
  isBreakpointDown: (breakpoint: Breakpoint) => boolean;
  
  // Responsive values
  getValue: <T>(values: Partial<Record<Breakpoint, T>>) => T | undefined;
  
  // Performance and accessibility
  isHighPerformance: boolean;
  isReducedMotion: boolean;
  isScreenReaderActive: boolean;
  
  // Theme and color mode
  colorMode: 'light' | 'dark';
  isDark: boolean;
  toggleColorMode: () => void;
  
  // Responsive spacing and sizing
  getSpacing: (base: number) => number;
  getFontSize: (base: number) => number;
  getIconSize: (base: number) => number;
}

export const useResponsiveDesign = (): ResponsiveDesignHook => {
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  
  const { colorMode, toggleColorMode } = useColorMode();

  // Listen to dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => subscription?.remove();
  }, []);

  // Initialize accessibility settings
  useEffect(() => {
    const initializeAccessibility = async () => {
      try {
        const reducedMotion = await AccessibilityHelper.isReducedMotionPreferred();
        const screenReader = AccessibilityHelper.isScreenReaderActive();
        
        setIsReducedMotion(reducedMotion);
        setIsScreenReaderActive(screenReader);
      } catch (error) {
        console.warn('Failed to initialize accessibility settings:', error);
      }
    };

    initializeAccessibility();
    AccessibilityHelper.initialize();

    return () => {
      AccessibilityHelper.cleanup();
    };
  }, []);

  // Calculate device type based on screen size
  const deviceType = useMemo((): DeviceType => {
    const { width } = dimensions;
    
    if (Platform.OS === 'web') {
      if (width >= BREAKPOINTS.lg) return 'desktop';
      if (width >= BREAKPOINTS.md) return 'tablet';
      return 'phone';
    }
    
    // For mobile platforms, use screen size to determine device type
    if (width >= 768) return 'tablet';
    return 'phone';
  }, [dimensions]);

  // Calculate orientation
  const orientation = useMemo((): Orientation => {
    return dimensions.width > dimensions.height ? 'landscape' : 'portrait';
  }, [dimensions]);

  // Calculate current breakpoint
  const currentBreakpoint = useMemo((): Breakpoint => {
    const { width } = dimensions;
    
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    if (width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  }, [dimensions]);

  // Breakpoint utility functions
  const isBreakpoint = useMemo(() => (breakpoint: Breakpoint): boolean => {
    return currentBreakpoint === breakpoint;
  }, [currentBreakpoint]);

  const isBreakpointUp = useMemo(() => (breakpoint: Breakpoint): boolean => {
    return dimensions.width >= BREAKPOINTS[breakpoint];
  }, [dimensions.width]);

  const isBreakpointDown = useMemo(() => (breakpoint: Breakpoint): boolean => {
    return dimensions.width < BREAKPOINTS[breakpoint];
  }, [dimensions.width]);

  // Get responsive value based on breakpoints
  const getValue = useMemo(() => <T,>(values: Partial<Record<Breakpoint, T>>): T | undefined => {
    // Find the best matching value for current breakpoint
    const breakpointOrder: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];
    
    for (const bp of breakpointOrder) {
      if (isBreakpointUp(bp) && values[bp] !== undefined) {
        return values[bp];
      }
    }
    
    // Fallback to the smallest available value
    for (const bp of breakpointOrder.reverse()) {
      if (values[bp] !== undefined) {
        return values[bp];
      }
    }
    
    return undefined;
  }, [isBreakpointUp]);

  // Performance detection
  const isHighPerformance = useMemo(() => {
    return DeviceCapabilities.isHighPerformanceDevice();
  }, []);

  // Responsive spacing calculation
  const getSpacing = useMemo(() => (base: number): number => {
    const multiplier = getValue({
      xs: 0.8,
      sm: 0.9,
      md: 1.0,
      lg: 1.1,
      xl: 1.2,
    }) || 1.0;
    
    return Math.round(base * multiplier);
  }, [getValue]);

  // Responsive font size calculation
  const getFontSize = useMemo(() => (base: number): number => {
    const multiplier = getValue({
      xs: 0.9,
      sm: 0.95,
      md: 1.0,
      lg: 1.05,
      xl: 1.1,
    }) || 1.0;
    
    // Consider accessibility font scaling
    const accessibilityMultiplier = isScreenReaderActive ? 1.1 : 1.0;
    
    return Math.round(base * multiplier * accessibilityMultiplier);
  }, [getValue, isScreenReaderActive]);

  // Responsive icon size calculation
  const getIconSize = useMemo(() => (base: number): number => {
    const multiplier = getValue({
      xs: 0.9,
      sm: 0.95,
      md: 1.0,
      lg: 1.05,
      xl: 1.1,
    }) || 1.0;
    
    return Math.round(base * multiplier);
  }, [getValue]);

  return {
    // Screen dimensions
    width: dimensions.width,
    height: dimensions.height,
    
    // Device information
    deviceType,
    orientation,
    isTablet: deviceType === 'tablet',
    isPhone: deviceType === 'phone',
    
    // Breakpoint information
    currentBreakpoint,
    isBreakpoint,
    isBreakpointUp,
    isBreakpointDown,
    
    // Responsive values
    getValue,
    
    // Performance and accessibility
    isHighPerformance,
    isReducedMotion,
    isScreenReaderActive,
    
    // Theme and color mode
    colorMode,
    isDark: colorMode === 'dark',
    toggleColorMode,
    
    // Responsive spacing and sizing
    getSpacing,
    getFontSize,
    getIconSize,
  };
};

// Hook for responsive styles
export const useResponsiveStyles = () => {
  const responsive = useResponsiveDesign();
  
  // Common responsive style patterns
  const styles = useMemo(() => ({
    container: {
      paddingHorizontal: responsive.getSpacing(responsive.isPhone ? 16 : 24),
      paddingVertical: responsive.getSpacing(responsive.isPhone ? 12 : 16),
    },
    
    card: {
      padding: responsive.getSpacing(responsive.isPhone ? 16 : 20),
      borderRadius: responsive.getValue({
        xs: 8,
        sm: 10,
        md: 12,
        lg: 14,
        xl: 16,
      }),
    },
    
    text: {
      fontSize: responsive.getFontSize(16),
      lineHeight: responsive.getFontSize(24),
    },
    
    heading: {
      fontSize: responsive.getFontSize(responsive.isPhone ? 20 : 24),
      lineHeight: responsive.getFontSize(responsive.isPhone ? 28 : 32),
    },
    
    button: {
      height: responsive.getValue({
        xs: 44,
        sm: 48,
        md: 52,
        lg: 56,
        xl: 60,
      }),
      paddingHorizontal: responsive.getSpacing(responsive.isPhone ? 16 : 24),
    },
    
    icon: {
      size: responsive.getIconSize(24),
    },
    
    spacing: {
      xs: responsive.getSpacing(4),
      sm: responsive.getSpacing(8),
      md: responsive.getSpacing(16),
      lg: responsive.getSpacing(24),
      xl: responsive.getSpacing(32),
    },
  }), [responsive]);

  return { responsive, styles };
};

// Hook for responsive grid layout
export const useResponsiveGrid = (itemMinWidth: number = 250) => {
  const { width, getValue } = useResponsiveDesign();
  
  const gridConfig = useMemo(() => {
    const columns = getValue({
      xs: 1,
      sm: 2,
      md: 3,
      lg: 4,
      xl: 5,
    }) || Math.floor(width / itemMinWidth);
    
    const itemWidth = Math.floor((width - (columns + 1) * 16) / columns);
    
    return {
      columns,
      itemWidth,
      gap: 16,
    };
  }, [width, getValue, itemMinWidth]);

  return gridConfig;
};

export default useResponsiveDesign;