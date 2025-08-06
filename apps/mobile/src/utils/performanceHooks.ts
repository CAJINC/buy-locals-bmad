import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Dimensions } from 'react-native';
import { mobilePerformanceOptimizer } from '../services/mobilePerformanceOptimizer';

/**
 * Enterprise Performance Hooks for React Native
 * Optimized for 60fps animations and sub-100ms interactions
 */

// Screen dimensions for responsive optimizations
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Optimized debounced value hook with performance tracking
 */
export function useOptimizedDebounce<T>(
  value: T, 
  delay: number = 150,
  options: {
    immediate?: boolean;
    maxWait?: number;
    trackPerformance?: boolean;
    componentName?: string;
  } = {}
): T {
  const {
    immediate = false,
    maxWait = 1000,
    trackPerformance = true,
    componentName = 'UnknownComponent'
  } = options;

  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef<NodeJS.Timeout>();
  const maxWaitTimerRef = useRef<NodeJS.Timeout>();
  const lastExecTimeRef = useRef(0);
  const performanceStartRef = useRef(0);

  useEffect(() => {
    if (trackPerformance) {
      performanceStartRef.current = Date.now();
    }

    // Clear existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
    }

    // Execute immediately if specified
    if (immediate && lastExecTimeRef.current === 0) {
      setDebouncedValue(value);
      lastExecTimeRef.current = Date.now();
      return;
    }

    // Set up debounce timer
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
      lastExecTimeRef.current = Date.now();
      
      if (trackPerformance) {
        const performanceTime = Date.now() - performanceStartRef.current;
        console.log(`🎯 Debounce performance - ${componentName}: ${performanceTime}ms`);
      }
    }, delay);

    // Set up max wait timer to ensure updates don't get delayed indefinitely
    if (maxWait > 0) {
      maxWaitTimerRef.current = setTimeout(() => {
        setDebouncedValue(value);
        lastExecTimeRef.current = Date.now();
      }, maxWait);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    };
  }, [value, delay, immediate, maxWait, trackPerformance, componentName]);

  return debouncedValue;
}

/**
 * Optimized virtualization hook for large lists
 */
export function useVirtualization<T>(
  items: T[],
  options: {
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
    componentName?: string;
  }
): {
  visibleItems: Array<{ item: T; index: number }>;
  scrollToIndex: (index: number) => void;
  totalHeight: number;
  onScroll: (scrollTop: number) => void;
} {
  const { itemHeight, containerHeight, overscan = 5, componentName = 'VirtualizedList' } = options;
  const [scrollTop, setScrollTop] = useState(0);
  
  const { visibleItems, totalHeight } = useMemo(() => {
    const startTime = Date.now();
    
    const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleEnd = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    const visible = [];
    for (let i = visibleStart; i < visibleEnd; i++) {
      if (items[i]) {
        visible.push({ item: items[i], index: i });
      }
    }
    
    const total = items.length * itemHeight;
    
    // Track virtualization performance
    const renderTime = Date.now() - startTime;
    if (renderTime > 5) { // Only log if significant
      console.log(`📱 Virtualization performance - ${componentName}: ${renderTime}ms for ${visible.length} items`);
    }
    
    return { visibleItems: visible, totalHeight: total };
  }, [items, scrollTop, itemHeight, containerHeight, overscan, componentName]);

  const scrollToIndex = useCallback((index: number) => {
    const targetScrollTop = index * itemHeight;
    setScrollTop(targetScrollTop);
  }, [itemHeight]);

  const onScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);

  return { visibleItems, scrollToIndex, totalHeight, onScroll };
}

/**
 * Performance-optimized async data fetching hook
 */
export function useOptimizedQuery<T>(
  queryKey: string,
  queryFunction: () => Promise<T>,
  options: {
    enabled?: boolean;
    cacheTime?: number;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: number;
    retryDelay?: number;
    optimisticUpdate?: boolean;
  } = {}
): {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (newData: T) => void;
} {
  const {
    enabled = true,
    cacheTime = 300000, // 5 minutes
    staleTime = 60000, // 1 minute
    refetchOnWindowFocus = false,
    retry = 3,
    retryDelay = 1000,
    optimisticUpdate = false
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const queryRef = useRef<{ timestamp: number; data: T } | null>(null);
  const retryCountRef = useRef(0);

  const executeQuery = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    const now = Date.now();
    
    // Check if we have fresh cached data
    if (queryRef.current && (now - queryRef.current.timestamp < staleTime)) {
      setData(queryRef.current.data);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const startTime = Date.now();
      
      // Use mobile performance optimizer for network requests
      const result = await mobilePerformanceOptimizer.optimizeNetworkRequest(
        queryFunction,
        {
          priority: 'medium',
          cacheKey: queryKey,
          timeout: 8000,
          retries: retry
        }
      );
      
      const executionTime = Date.now() - startTime;
      console.log(`🚀 Query performance - ${queryKey}: ${executionTime}ms`);

      queryRef.current = { timestamp: now, data: result };
      setData(result);
      retryCountRef.current = 0;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      
      if (retryCountRef.current < retry) {
        retryCountRef.current++;
        setTimeout(() => {
          executeQuery();
        }, retryDelay * Math.pow(2, retryCountRef.current - 1));
      } else {
        setIsError(true);
        setError(errorObj);
        console.error(`❌ Query failed - ${queryKey}:`, errorObj.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [queryKey, queryFunction, enabled, staleTime, retry, retryDelay]);

  const mutate = useCallback((newData: T) => {
    if (optimisticUpdate) {
      setData(newData);
      queryRef.current = { timestamp: Date.now(), data: newData };
    }
  }, [optimisticUpdate]);

  const refetch = useCallback(async (): Promise<void> => {
    queryRef.current = null; // Force refetch
    await executeQuery();
  }, [executeQuery]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  // Handle app state changes for refetch on focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    // This would integrate with app state change listeners
    // For now, we'll skip this implementation
  }, [refetchOnWindowFocus]);

  return { data, isLoading, isError, error, refetch, mutate };
}

/**
 * Optimized intersection observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: {
    threshold?: number;
    rootMargin?: string;
    componentName?: string;
  } = {}
): {
  ref: React.RefObject<any>;
  isIntersecting: boolean;
  hasIntersected: boolean;
} {
  const { threshold = 0.1, componentName = 'LazyComponent' } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Simple intersection detection based on scroll position
    const checkIntersection = () => {
      if (!element) return;

      // This is a simplified implementation
      // In a real app, you'd use native intersection observer or scroll listeners
      const rect = element.getBoundingClientRect?.();
      if (rect) {
        const isVisible = rect.top < screenHeight && rect.bottom > 0;
        
        if (isVisible !== isIntersecting) {
          setIsIntersecting(isVisible);
          
          if (isVisible && !hasIntersected) {
            setHasIntersected(true);
            console.log(`👁️ Component entered viewport - ${componentName}`);
          }
        }
      }
    };

    // Check intersection periodically (this would be optimized with real observers)
    const intervalId = setInterval(checkIntersection, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [isIntersecting, hasIntersected, componentName]);

  return { ref, isIntersecting, hasIntersected };
}

/**
 * Memory-efficient image loading hook
 */
export function useOptimizedImage(
  imageUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    lazy?: boolean;
    placeholder?: string;
  } = {}
): {
  src: string | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const { width, height, quality = 0.8, lazy = true, placeholder } = options;
  const [src, setSrc] = useState<string | null>(lazy ? placeholder || null : null);
  const [isLoading, setIsLoading] = useState(!lazy);
  const [error, setError] = useState<Error | null>(null);
  const [shouldLoad, setShouldLoad] = useState(!lazy);

  // Use intersection observer for lazy loading
  const { ref, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
    componentName: 'OptimizedImage'
  });

  useEffect(() => {
    if (lazy && hasIntersected && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [lazy, hasIntersected, shouldLoad]);

  const loadImage = useCallback(async () => {
    if (!imageUrl || !shouldLoad) return;

    setIsLoading(true);
    setError(null);

    try {
      const optimizedSrc = await mobilePerformanceOptimizer.optimizeImageLoading(imageUrl, {
        width,
        height,
        quality,
        priority: lazy ? 'low' : 'medium'
      });

      if (optimizedSrc) {
        setSrc(optimizedSrc);
      } else {
        setSrc(imageUrl); // Fallback to original
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Image loading failed');
      setError(errorObj);
      setSrc(imageUrl); // Fallback to original
    } finally {
      setIsLoading(false);
    }
  }, [imageUrl, shouldLoad, width, height, quality, lazy]);

  const reload = useCallback(() => {
    setSrc(null);
    setError(null);
    loadImage();
  }, [loadImage]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  return { src, isLoading, error, reload };
}

/**
 * Performance tracking hook for components
 */
export function usePerformanceTracking(
  componentName: string,
  options: {
    trackRender?: boolean;
    trackMount?: boolean;
    trackUpdate?: boolean;
  } = {}
): {
  trackAction: (actionName: string) => void;
  getMetrics: () => any;
} {
  const { trackRender = true, trackMount = true, trackUpdate = true } = options;
  const renderTimeRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);
  const metricsRef = useRef<{ [key: string]: number }>({});

  // Track component mount
  useEffect(() => {
    if (trackMount) {
      mountTimeRef.current = Date.now();
      console.log(`🏗️ Component mounted - ${componentName}`);
    }

    return () => {
      if (trackMount) {
        const mountDuration = Date.now() - mountTimeRef.current;
        console.log(`🏗️ Component unmounted - ${componentName}: ${mountDuration}ms lifetime`);
      }
    };
  }, [componentName, trackMount]);

  // Track renders
  useEffect(() => {
    if (trackRender) {
      const renderStart = Date.now();
      
      // Schedule after render to measure actual render time
      InteractionManager.runAfterInteractions(() => {
        renderTimeRef.current = Date.now() - renderStart;
        
        if (renderTimeRef.current > 16) { // Above 60fps threshold
          console.warn(`⚠️ Slow render - ${componentName}: ${renderTimeRef.current}ms`);
        }
      });
    }
  });

  const trackAction = useCallback((actionName: string) => {
    const startTime = Date.now();
    metricsRef.current[actionName] = startTime;
    
    return () => {
      const duration = Date.now() - startTime;
      metricsRef.current[`${actionName}_duration`] = duration;
      console.log(`⚡ Action completed - ${componentName}.${actionName}: ${duration}ms`);
    };
  }, [componentName]);

  const getMetrics = useCallback(() => {
    return {
      componentName,
      renderTime: renderTimeRef.current,
      mountTime: mountTimeRef.current,
      actions: { ...metricsRef.current }
    };
  }, [componentName]);

  return { trackAction, getMetrics };
}

/**
 * Batch state updates for better performance
 */
export function useBatchedState<T>(
  initialState: T,
  batchDelay: number = 16 // One frame at 60fps
): [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState(initialState);
  const pendingUpdatesRef = useRef<Array<T | ((prev: T) => T)>>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchedSetState = useCallback((updater: T | ((prev: T) => T)) => {
    pendingUpdatesRef.current.push(updater);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const updates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = [];

      setState(prevState => {
        let newState = prevState;
        updates.forEach(update => {
          newState = typeof update === 'function' ? (update as any)(newState) : update;
        });
        return newState;
      });
    }, batchDelay);
  }, [batchDelay]);

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    
    if (pendingUpdatesRef.current.length > 0) {
      const updates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = [];

      setState(prevState => {
        let newState = prevState;
        updates.forEach(update => {
          newState = typeof update === 'function' ? (update as any)(newState) : update;
        });
        return newState;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState, flushUpdates];
}

/**
 * Smart memoization hook that considers performance impact
 */
export function useSmartMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: {
    maxAge?: number;
    componentName?: string;
    heavyComputation?: boolean;
  } = {}
): T {
  const { maxAge = 300000, componentName = 'SmartMemo', heavyComputation = false } = options;
  const cacheRef = useRef<{ value: T; timestamp: number; deps: React.DependencyList } | null>(null);

  return useMemo(() => {
    const now = Date.now();
    const startTime = now;

    // Check if we can reuse cached value
    if (cacheRef.current && 
        cacheRef.current.deps.length === deps.length &&
        cacheRef.current.deps.every((dep, i) => dep === deps[i]) &&
        (now - cacheRef.current.timestamp < maxAge)) {
      return cacheRef.current.value;
    }

    // Compute new value
    const value = factory();
    const computationTime = Date.now() - startTime;

    // Log performance for heavy computations
    if (heavyComputation || computationTime > 10) {
      console.log(`🧮 Smart memo computation - ${componentName}: ${computationTime}ms`);
    }

    // Cache the result
    cacheRef.current = {
      value,
      timestamp: now,
      deps: [...deps]
    };

    return value;
  }, deps);
}

/**
 * Responsive design hook optimized for performance
 */
export function useResponsiveValue<T>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  },
  defaultValue: T
): T {
  const [screenData, setScreenData] = useState({
    width: screenWidth,
    height: screenHeight
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData({
        width: window.width,
        height: window.height
      });
    });

    return () => subscription?.remove();
  }, []);

  return useMemo(() => {
    const { width } = screenData;
    
    // Define breakpoints (can be customized)
    if (width >= 1200 && values.xl !== undefined) return values.xl;
    if (width >= 992 && values.lg !== undefined) return values.lg;
    if (width >= 768 && values.md !== undefined) return values.md;
    if (width >= 576 && values.sm !== undefined) return values.sm;
    if (values.xs !== undefined) return values.xs;
    
    return defaultValue;
  }, [screenData.width, values, defaultValue]);
}