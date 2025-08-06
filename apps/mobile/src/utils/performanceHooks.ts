import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, AppState, AppStateStatus } from 'react-native';

export interface PerformanceHookOptions {
  enabled?: boolean;
  throttleMs?: number;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Hook for optimized data fetching with caching and retry logic
 */
export function useOptimizedFetch<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: PerformanceHookOptions = {}
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const {
    enabled = true,
    throttleMs = 1000,
    maxRetries = 3,
    timeout = 30000,
  } = options;

  const lastFetchRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const generateCacheKey = useCallback(() => {
    return JSON.stringify(dependencies);
  }, [dependencies]);

  const fetchWithTimeout = useCallback(async (): Promise<T> => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const result = await fetchFn();
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (abortController.signal.aborted) {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }, [fetchFn, timeout]);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    const now = Date.now();
    const cacheKey = generateCacheKey();
    
    // Throttle requests
    if (now - lastFetchRef.current < throttleMs) {
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (cached && now - cached.timestamp < 300000) { // 5 minute cache
      setData(cached.data);
      return;
    }

    setIsLoading(true);
    setError(null);
    lastFetchRef.current = now;

    try {
      const result = await fetchWithTimeout();
      setData(result);
      setRetryCount(0);
      
      // Update cache
      cacheRef.current.set(cacheKey, { data: result, timestamp: now });
      
      // Limit cache size
      if (cacheRef.current.size > 10) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => refetch(), Math.pow(2, retryCount) * 1000); // Exponential backoff
      } else {
        setError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, throttleMs, maxRetries, generateCacheKey, fetchWithTimeout, retryCount]);

  useEffect(() => {
    refetch();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  return { data, isLoading, error, refetch };
}

/**
 * Hook for debounced search with performance optimization
 */
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs: number = 300
): {
  results: T[];
  isSearching: boolean;
  search: (query: string) => void;
  clearResults: () => void;
} {
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const currentSearchRef = useRef<string>('');
  const cacheRef = useRef<Map<string, T[]>>(new Map());

  const search = useCallback((query: string) => {
    currentSearchRef.current = query;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // Check cache
    const cached = cacheRef.current.get(query);
    if (cached) {
      setResults(cached);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Only proceed if this is still the current search
        if (currentSearchRef.current === query) {
          const searchResults = await searchFn(query);
          
          // Double-check we're still searching for the same query
          if (currentSearchRef.current === query) {
            setResults(searchResults);
            
            // Cache results
            cacheRef.current.set(query, searchResults);
            
            // Limit cache size
            if (cacheRef.current.size > 50) {
              const firstKey = cacheRef.current.keys().next().value;
              cacheRef.current.delete(firstKey);
            }
          }
        }
      } catch (error) {
        if (currentSearchRef.current === query) {
          console.error('Search error:', error);
          setResults([]);
        }
      } finally {
        if (currentSearchRef.current === query) {
          setIsSearching(false);
        }
      }
    }, debounceMs);
  }, [searchFn, debounceMs]);

  const clearResults = useCallback(() => {
    setResults([]);
    setIsSearching(false);
    currentSearchRef.current = '';
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return { results, isSearching, search, clearResults };
}

/**
 * Hook for optimized real-time updates with batching
 */
export function useOptimizedRealTime<T>(
  subscriptionFn: (callback: (data: T) => void) => () => void,
  batchMs: number = 1000
): {
  data: T[];
  isConnected: boolean;
  clear: () => void;
} {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const batchRef = useRef<T[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const processBatch = useCallback(() => {
    if (batchRef.current.length > 0) {
      setData(prev => [...prev, ...batchRef.current]);
      batchRef.current = [];
    }
  }, []);

  const handleUpdate = useCallback((newData: T) => {
    batchRef.current.push(newData);
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(processBatch, batchMs);
  }, [batchMs, processBatch]);

  const clear = useCallback(() => {
    setData([]);
    batchRef.current = [];
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    // Wait for interactions to complete before subscribing
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        const unsubscribe = subscriptionFn(handleUpdate);
        unsubscribeRef.current = unsubscribe;
        setIsConnected(true);
      } catch (error) {
        console.error('Subscription error:', error);
        setIsConnected(false);
      }
    });

    return () => {
      task.cancel();
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [subscriptionFn, handleUpdate]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Process any pending batch when app goes to background
        processBatch();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [processBatch]);

  return { data, isConnected, clear };
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const renderStartRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);
  
  useEffect(() => {
    mountTimeRef.current = performance.now();
    
    return () => {
      const mountDuration = performance.now() - mountTimeRef.current;
      console.debug(`${componentName} was mounted for ${mountDuration.toFixed(2)}ms`);
    };
  }, [componentName]);

  const startRender = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    if (renderStartRef.current > 0) {
      const renderDuration = performance.now() - renderStartRef.current;
      console.debug(`${componentName} render took ${renderDuration.toFixed(2)}ms`);
      renderStartRef.current = 0;
    }
  }, [componentName]);

  const measureAction = useCallback((actionName: string, actionFn: () => void) => {
    const startTime = performance.now();
    actionFn();
    const duration = performance.now() - startTime;
    console.debug(`${componentName}.${actionName} took ${duration.toFixed(2)}ms`);
  }, [componentName]);

  return { startRender, endRender, measureAction };
}

/**
 * Hook for memory-efficient large lists
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
): {
  visibleItems: Array<{ item: T; index: number }>;
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  totalHeight: number;
} {
  const [scrollOffset, setScrollOffset] = useState(0);

  const visibleRange = useCallback(() => {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollOffset + containerHeight) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollOffset, itemHeight, containerHeight, overscan, items.length]);

  const { startIndex, endIndex } = visibleRange();
  
  const visibleItems = useCallback(() => {
    const visible: Array<{ item: T; index: number }> = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i]) {
        visible.push({ item: items[i], index: i });
      }
    }
    return visible;
  }, [items, startIndex, endIndex]);

  return {
    visibleItems: visibleItems(),
    scrollOffset,
    setScrollOffset,
    totalHeight: items.length * itemHeight,
  };
}

/**
 * Hook for intelligent preloading
 */
export function useIntelligentPreload<T>(
  preloadFn: () => Promise<T>,
  triggerThreshold: number = 0.8
): {
  preload: () => void;
  isPreloading: boolean;
  preloadedData: T | null;
} {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedData, setPreloadedData] = useState<T | null>(null);
  const preloadedRef = useRef(false);

  const preload = useCallback(async () => {
    if (preloadedRef.current || isPreloading) return;
    
    setIsPreloading(true);
    preloadedRef.current = true;

    try {
      // Wait for UI interactions to complete before preloading
      await new Promise(resolve => {
        InteractionManager.runAfterInteractions(resolve);
      });

      const data = await preloadFn();
      setPreloadedData(data);
    } catch (error) {
      console.warn('Preload failed:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [preloadFn, isPreloading]);

  // Auto-trigger preload based on usage patterns
  useEffect(() => {
    const shouldPreload = Math.random() < triggerThreshold;
    if (shouldPreload && !preloadedRef.current) {
      // Delay preloading to not impact initial load
      setTimeout(preload, 2000);
    }
  }, [preload, triggerThreshold]);

  return { preload, isPreloading, preloadedData };
}