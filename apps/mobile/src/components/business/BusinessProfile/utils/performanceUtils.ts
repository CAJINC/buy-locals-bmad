import { Dimensions, PixelRatio } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const pixelRatio = PixelRatio.get();

// Image optimization utilities
export class ImageOptimizer {
  private static cache = new Map<string, string>();
  private static readonly CACHE_PREFIX = 'image_cache_';
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get optimized image URL based on container size and device capabilities
   */
  static getOptimizedImageUrl(
    originalUrl: string,
    containerWidth: number,
    containerHeight: number,
    quality: number = 80
  ): string {
    if (!originalUrl) return '';

    // Calculate optimal image size based on device pixel ratio and container size
    const optimalWidth = Math.ceil(containerWidth * pixelRatio);
    const optimalHeight = Math.ceil(containerHeight * pixelRatio);

    // If using a CDN that supports resizing (like Cloudinary, ImageKit, etc.)
    // This is a generic example - adapt to your CDN's URL format
    if (originalUrl.includes('cloudinary.com') || originalUrl.includes('imagekit.io')) {
      const separator = originalUrl.includes('?') ? '&' : '?';
      return `${originalUrl}${separator}w=${optimalWidth}&h=${optimalHeight}&q=${quality}&f=auto`;
    }

    // For other URLs, return original (could implement local resizing if needed)
    return originalUrl;
  }

  /**
   * Preload images for better performance
   */
  static async preloadImages(imageUrls: string[]): Promise<void> {
    const preloadPromises = imageUrls.map(url => {
      return new Promise<void>((resolve) => {
        // In React Native, we can use Image.prefetch for preloading
        // This would be implemented with actual image prefetch logic
        resolve();
      });
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Cache image metadata for performance
   */
  static async cacheImageMetadata(imageId: string, metadata: any): Promise<void> {
    try {
      const cacheData = {
        metadata,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${imageId}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('Failed to cache image metadata:', error);
    }
  }

  /**
   * Retrieve cached image metadata
   */
  static async getCachedImageMetadata(imageId: string): Promise<any | null> {
    try {
      const cachedData = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${imageId}`);
      if (!cachedData) return null;

      const { metadata, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid
      if (Date.now() - timestamp > this.CACHE_EXPIRY) {
        await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${imageId}`);
        return null;
      }

      return metadata;
    } catch (error) {
      console.warn('Failed to retrieve cached image metadata:', error);
      return null;
    }
  }

  /**
   * Get responsive image sizes for different breakpoints
   */
  static getResponsiveImageSizes(): {
    thumbnail: { width: number; height: number };
    small: { width: number; height: number };
    medium: { width: number; height: number };
    large: { width: number; height: number };
  } {
    const baseWidth = screenWidth;
    
    return {
      thumbnail: { width: 100, height: 100 },
      small: { width: Math.min(200, baseWidth * 0.3), height: Math.min(200, baseWidth * 0.3) },
      medium: { width: Math.min(400, baseWidth * 0.6), height: Math.min(400, baseWidth * 0.6) },
      large: { width: Math.min(800, baseWidth * 0.9), height: Math.min(600, screenHeight * 0.7) },
    };
  }

  /**
   * Clean up old cached images
   */
  static async cleanupImageCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      for (const key of cacheKeys) {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const { timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp > this.CACHE_EXPIRY) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup image cache:', error);
    }
  }
}

// Lazy loading utilities
export class LazyLoader {
  private static visibleItems = new Set<string>();
  private static observers = new Map<string, () => void>();

  /**
   * Register an item for lazy loading
   */
  static register(
    itemId: string,
    onVisible: () => void,
    threshold: number = 0.1
  ): void {
    this.observers.set(itemId, onVisible);
  }

  /**
   * Unregister an item from lazy loading
   */
  static unregister(itemId: string): void {
    this.observers.delete(itemId);
    this.visibleItems.delete(itemId);
  }

  /**
   * Mark an item as visible (to be called by intersection observer logic)
   */
  static markVisible(itemId: string): void {
    if (!this.visibleItems.has(itemId)) {
      this.visibleItems.add(itemId);
      const callback = this.observers.get(itemId);
      callback?.();
    }
  }

  /**
   * Check if an item is visible
   */
  static isVisible(itemId: string): boolean {
    return this.visibleItems.has(itemId);
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics = new Map<string, number>();

  /**
   * Start measuring a performance metric
   */
  static startMeasure(name: string): void {
    this.metrics.set(name, Date.now());
  }

  /**
   * End measuring and log the result
   */
  static endMeasure(name: string): number | null {
    const startTime = this.metrics.get(name);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.metrics.delete(name);
    
    // Log performance metrics in development
    if (__DEV__) {
      console.log(`[Performance] ${name}: ${duration}ms`);
    }

    return duration;
  }

  /**
   * Measure component render time
   */
  static measureRender<T>(
    componentName: string,
    renderFunction: () => T
  ): T {
    this.startMeasure(`${componentName}_render`);
    const result = renderFunction();
    this.endMeasure(`${componentName}_render`);
    return result;
  }
}

// Memory management utilities
export class MemoryManager {
  private static memoryWarningHandlers: (() => void)[] = [];

  /**
   * Register a handler for memory warnings
   */
  static onMemoryWarning(handler: () => void): () => void {
    this.memoryWarningHandlers.push(handler);
    
    // Return cleanup function
    return () => {
      const index = this.memoryWarningHandlers.indexOf(handler);
      if (index > -1) {
        this.memoryWarningHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Trigger memory cleanup
   */
  static triggerMemoryCleanup(): void {
    this.memoryWarningHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.warn('Error in memory warning handler:', error);
      }
    });
  }

  /**
   * Get memory usage information (mock implementation)
   */
  static getMemoryInfo(): {
    used: number;
    available: number;
    percentage: number;
  } {
    // In a real implementation, this would use native modules
    // to get actual memory information
    return {
      used: 0,
      available: 0,
      percentage: 0,
    };
  }
}

// Bundle optimization utilities
export class BundleOptimizer {
  /**
   * Dynamically import a component for code splitting
   */
  static async loadComponent<T>(
    importFunction: () => Promise<{ default: T }>
  ): Promise<T | null> {
    try {
      const module = await importFunction();
      return module.default;
    } catch (error) {
      console.error('Failed to load component:', error);
      return null;
    }
  }

  /**
   * Preload critical components
   */
  static preloadComponents(
    importFunctions: Array<() => Promise<any>>
  ): void {
    // Preload with low priority
    setTimeout(() => {
      importFunctions.forEach(importFn => {
        importFn().catch(() => {
          // Silently handle preload failures
        });
      });
    }, 100);
  }
}

// Network optimization utilities
export class NetworkOptimizer {
  private static requestCache = new Map<string, {
    data: any;
    timestamp: number;
    expiry: number;
  }>();

  /**
   * Cache network response with expiry
   */
  static cacheResponse(
    key: string,
    data: any,
    expiryMs: number = 5 * 60 * 1000 // 5 minutes default
  ): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiryMs,
    });
  }

  /**
   * Get cached response if still valid
   */
  static getCachedResponse<T>(key: string): T | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.expiry) {
      this.requestCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear expired cache entries
   */
  static cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > cached.expiry) {
        this.requestCache.delete(key);
      }
    }
  }
}

// Device capability utilities
export class DeviceCapabilities {
  /**
   * Check if device supports high-performance features
   */
  static isHighPerformanceDevice(): boolean {
    // Simplified check based on screen density and dimensions
    const totalPixels = screenWidth * screenHeight * pixelRatio * pixelRatio;
    return totalPixels > 2000000; // Rough threshold for high-end devices
  }

  /**
   * Get recommended image quality based on device capabilities
   */
  static getRecommendedImageQuality(): number {
    if (this.isHighPerformanceDevice()) {
      return 90; // High quality for capable devices
    }
    return 75; // Lower quality for less capable devices
  }

  /**
   * Check if device has sufficient memory for heavy operations
   */
  static hasSufficientMemory(): boolean {
    // In a real implementation, this would check actual available memory
    return this.isHighPerformanceDevice();
  }
}

// Export all utilities
export {
  ImageOptimizer,
  LazyLoader,
  PerformanceMonitor,
  MemoryManager,
  BundleOptimizer,
  NetworkOptimizer,
  DeviceCapabilities,
};