import { InteractionManager, Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPerformanceService } from './searchPerformanceService';

/**
 * Mobile Performance Optimizer Service
 * Enterprise-grade React Native performance optimization
 * Target: Sub-100ms UI interactions, smooth 60fps animations
 */

export interface MobilePerformanceConfig {
  // UI Performance
  enableVirtualization: boolean;
  chunkSize: number;
  batchRenderSize: number;
  animationDuration: number;
  
  // Memory Management
  memoryWarningThreshold: number;
  memoryCleanupThreshold: number;
  imageCache: {
    maxSize: number;
    maxAge: number;
    compressionQuality: number;
  };
  
  // Network Optimization
  requestConcurrency: number;
  requestTimeout: number;
  retryAttempts: number;
  
  // Caching Strategy
  enablePersistentCache: boolean;
  enableMemoryCache: boolean;
  cacheCompressionEnabled: boolean;
}

const MOBILE_PERFORMANCE_CONFIG: MobilePerformanceConfig = {
  // UI Performance - Optimized for 60fps
  enableVirtualization: true,
  chunkSize: 10,
  batchRenderSize: 5,
  animationDuration: Platform.select({ ios: 200, android: 250 }),
  
  // Memory Management - Conservative for mobile devices
  memoryWarningThreshold: 50 * 1024 * 1024, // 50MB
  memoryCleanupThreshold: 60 * 1024 * 1024, // 60MB
  imageCache: {
    maxSize: 20 * 1024 * 1024, // 20MB for images
    maxAge: 3600000, // 1 hour
    compressionQuality: Platform.select({ ios: 0.8, android: 0.7 }),
  },
  
  // Network Optimization
  requestConcurrency: Platform.select({ ios: 4, android: 3 }),
  requestTimeout: 8000, // 8 seconds
  retryAttempts: 3,
  
  // Caching Strategy
  enablePersistentCache: true,
  enableMemoryCache: true,
  cacheCompressionEnabled: Platform.select({ ios: false, android: true }),
};

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
  networkLatency: number;
  uiFrameDrops: number;
  batteryImpact: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface ComponentPerformanceData {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  memoryLeaks: number;
  reRenderReasons: string[];
}

class MobilePerformanceOptimizer {
  private performanceMetrics: PerformanceMetrics[] = [];
  private componentMetrics = new Map<string, ComponentPerformanceData>();
  private memoryUsageHistory: number[] = [];
  private renderQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  private memoryMonitorTimer: NodeJS.Timeout | null = null;
  
  // Image caching and management
  private imageCache = new Map<string, { data: any; timestamp: number; size: number }>();
  private currentImageCacheSize = 0;
  
  // Request management
  private activeRequests = new Map<string, Promise<any>>();
  private requestQueue: Array<{ request: () => Promise<any>; resolve: Function; reject: Function }> = [];
  private processingRequests = 0;

  constructor() {
    this.initializeOptimizer();
  }

  /**
   * Initialize mobile performance optimizer
   */
  private async initializeOptimizer(): Promise<void> {
    console.log('🚀 Initializing Mobile Performance Optimizer');
    
    try {
      await this.setupMemoryMonitoring();
      await this.setupPerformanceTracking();
      await this.optimizeDeviceSpecificSettings();
      await this.startBackgroundOptimizations();
      
      console.log('✅ Mobile Performance Optimizer initialized successfully');
    } catch (error) {
      console.error('❌ Mobile Performance Optimizer initialization failed:', error);
    }
  }

  /**
   * Optimize component rendering with batching and virtualization
   */
  optimizeComponentRendering<T>(
    items: T[],
    renderFunction: (item: T, index: number) => any,
    options: {
      virtualize?: boolean;
      batchSize?: number;
      windowSize?: number;
      componentName?: string;
    } = {}
  ): {
    visibleItems: T[];
    renderBatch: () => Promise<void>;
    updateVisibleRange: (startIndex: number, endIndex: number) => void;
  } {
    const {
      virtualize = MOBILE_PERFORMANCE_CONFIG.enableVirtualization,
      batchSize = MOBILE_PERFORMANCE_CONFIG.batchRenderSize,
      windowSize = 20,
      componentName = 'UnknownComponent'
    } = options;

    let visibleStartIndex = 0;
    let visibleEndIndex = Math.min(windowSize, items.length);
    
    // Track component performance
    this.trackComponentPerformance(componentName, 'render_optimization');

    const renderBatch = async (): Promise<void> => {
      const startTime = Date.now();
      
      return new Promise((resolve) => {
        this.addToRenderQueue(() => {
          try {
            const batchStartIndex = visibleStartIndex;
            const batchEndIndex = Math.min(batchStartIndex + batchSize, visibleEndIndex);
            
            // Render items in small batches to maintain 60fps
            for (let i = batchStartIndex; i < batchEndIndex; i++) {
              if (items[i]) {
                renderFunction(items[i], i);
              }
            }
            
            const renderTime = Date.now() - startTime;
            this.recordComponentRenderTime(componentName, renderTime);
            
            resolve();
          } catch (error) {
            console.error(`Render batch error for ${componentName}:`, error);
            resolve();
          }
        });
      });
    };

    const updateVisibleRange = (startIndex: number, endIndex: number): void => {
      visibleStartIndex = Math.max(0, startIndex);
      visibleEndIndex = Math.min(endIndex, items.length);
    };

    const getVisibleItems = (): T[] => {
      if (!virtualize) return items;
      return items.slice(visibleStartIndex, visibleEndIndex);
    };

    return {
      visibleItems: getVisibleItems(),
      renderBatch,
      updateVisibleRange,
    };
  }

  /**
   * Optimize network requests with intelligent queueing and concurrency control
   */
  async optimizeNetworkRequest<T>(
    requestFunction: () => Promise<T>,
    options: {
      priority?: 'high' | 'medium' | 'low';
      cacheKey?: string;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<T> {
    const {
      priority = 'medium',
      cacheKey,
      timeout = MOBILE_PERFORMANCE_CONFIG.requestTimeout,
      retries = MOBILE_PERFORMANCE_CONFIG.retryAttempts
    } = options;

    // Check cache first if cacheKey provided
    if (cacheKey) {
      const cachedResult = await this.getCachedNetworkResult<T>(cacheKey);
      if (cachedResult) {
        this.recordPerformanceMetric({
          renderTime: 0,
          memoryUsage: await this.getCurrentMemoryUsage(),
          cacheHitRatio: 1.0,
          networkLatency: 0,
          uiFrameDrops: 0,
          batteryImpact: 'low',
          timestamp: Date.now(),
        });
        return cachedResult;
      }
    }

    // Check if request is already in flight
    if (cacheKey && this.activeRequests.has(cacheKey)) {
      console.log(`🔄 Reusing in-flight request: ${cacheKey}`);
      return await this.activeRequests.get(cacheKey) as T;
    }

    // Create optimized request with timeout and retry logic
    const optimizedRequest = async (): Promise<T> => {
      let lastError: any;
      const startTime = Date.now();
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const requestPromise = Promise.race([
            requestFunction(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);

          if (cacheKey) {
            this.activeRequests.set(cacheKey, requestPromise);
          }

          const result = await requestPromise;
          const networkLatency = Date.now() - startTime;

          // Cache successful result
          if (cacheKey && result) {
            await this.setCachedNetworkResult(cacheKey, result);
          }

          // Record performance metrics
          this.recordPerformanceMetric({
            renderTime: 0,
            memoryUsage: await this.getCurrentMemoryUsage(),
            cacheHitRatio: 0,
            networkLatency,
            uiFrameDrops: 0,
            batteryImpact: networkLatency > 2000 ? 'high' : networkLatency > 1000 ? 'medium' : 'low',
            timestamp: Date.now(),
          });

          return result;
        } catch (error) {
          lastError = error;
          console.warn(`🔄 Network request attempt ${attempt}/${retries} failed:`, error.message);
          
          if (attempt < retries) {
            // Exponential backoff for retries
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
          }
        } finally {
          if (cacheKey) {
            this.activeRequests.delete(cacheKey);
          }
        }
      }

      throw lastError;
    };

    // Handle request concurrency
    if (this.processingRequests >= MOBILE_PERFORMANCE_CONFIG.requestConcurrency) {
      return new Promise((resolve, reject) => {
        const queueItem = {
          request: optimizedRequest,
          resolve,
          reject
        };

        // Insert based on priority
        if (priority === 'high') {
          this.requestQueue.unshift(queueItem);
        } else {
          this.requestQueue.push(queueItem);
        }

        this.processRequestQueue();
      });
    }

    this.processingRequests++;
    try {
      const result = await optimizedRequest();
      this.processRequestQueue();
      return result;
    } finally {
      this.processingRequests--;
    }
  }

  /**
   * Optimize image loading and caching
   */
  async optimizeImageLoading(
    imageUrl: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<string | null> {
    const {
      width,
      height,
      quality = MOBILE_PERFORMANCE_CONFIG.imageCache.compressionQuality,
      priority = 'medium'
    } = options;

    const cacheKey = this.generateImageCacheKey(imageUrl, width, height, quality);

    // Check cache first
    const cachedImage = this.imageCache.get(cacheKey);
    if (cachedImage && Date.now() - cachedImage.timestamp < MOBILE_PERFORMANCE_CONFIG.imageCache.maxAge) {
      return cachedImage.data;
    }

    try {
      // Load and optimize image
      const optimizedImageData = await this.loadAndOptimizeImage(imageUrl, {
        width,
        height,
        quality,
        priority
      });

      // Cache the optimized image
      this.cacheOptimizedImage(cacheKey, optimizedImageData);

      return optimizedImageData;
    } catch (error) {
      console.warn('Image optimization failed:', error);
      return null;
    }
  }

  /**
   * Memory management and garbage collection optimization
   */
  async optimizeMemoryUsage(): Promise<void> {
    const currentMemoryUsage = await this.getCurrentMemoryUsage();
    this.memoryUsageHistory.push(currentMemoryUsage);

    // Keep only last 100 memory readings
    if (this.memoryUsageHistory.length > 100) {
      this.memoryUsageHistory = this.memoryUsageHistory.slice(-100);
    }

    // Trigger cleanup if needed
    if (currentMemoryUsage > MOBILE_PERFORMANCE_CONFIG.memoryCleanupThreshold) {
      console.log('🧹 Triggering memory cleanup - Current usage:', Math.round(currentMemoryUsage / 1024 / 1024), 'MB');
      await this.performMemoryCleanup();
    }

    // Warn if memory usage is growing rapidly
    if (this.memoryUsageHistory.length >= 10) {
      const recentAverage = this.memoryUsageHistory.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const oldAverage = this.memoryUsageHistory.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
      
      if (recentAverage > oldAverage * 1.2) {
        console.warn('⚠️ Memory usage growing rapidly:', {
          recentAverage: Math.round(recentAverage / 1024 / 1024),
          oldAverage: Math.round(oldAverage / 1024 / 1024),
          trend: 'increasing'
        });
      }
    }
  }

  /**
   * Get comprehensive performance analytics
   */
  getPerformanceAnalytics(): {
    overallPerformance: {
      averageRenderTime: number;
      memoryEfficiency: number;
      networkPerformance: number;
      batteryEfficiency: number;
      cacheEfficiency: number;
    };
    componentMetrics: ComponentPerformanceData[];
    recommendations: string[];
    healthScore: number;
  } {
    const recentMetrics = this.performanceMetrics.slice(-50); // Last 50 metrics
    
    if (recentMetrics.length === 0) {
      return {
        overallPerformance: {
          averageRenderTime: 0,
          memoryEfficiency: 100,
          networkPerformance: 100,
          batteryEfficiency: 100,
          cacheEfficiency: 100,
        },
        componentMetrics: [],
        recommendations: ['Start using the performance optimizer to see metrics'],
        healthScore: 100,
      };
    }

    const averageRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
    const averageCacheHitRatio = recentMetrics.reduce((sum, m) => sum + m.cacheHitRatio, 0) / recentMetrics.length;
    const averageNetworkLatency = recentMetrics.reduce((sum, m) => sum + m.networkLatency, 0) / recentMetrics.length;
    const averageMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;

    // Calculate efficiency scores (0-100)
    const memoryEfficiency = Math.max(0, 100 - (averageMemoryUsage / MOBILE_PERFORMANCE_CONFIG.memoryWarningThreshold) * 50);
    const networkPerformance = Math.max(0, 100 - (averageNetworkLatency / 2000) * 100);
    const batteryEfficiency = this.calculateBatteryEfficiency(recentMetrics);
    const cacheEfficiency = averageCacheHitRatio * 100;

    // Generate recommendations
    const recommendations = this.generatePerformanceRecommendations({
      averageRenderTime,
      memoryEfficiency,
      networkPerformance,
      batteryEfficiency,
      cacheEfficiency,
    });

    // Calculate overall health score
    const healthScore = Math.round(
      (memoryEfficiency + networkPerformance + batteryEfficiency + cacheEfficiency) / 4
    );

    return {
      overallPerformance: {
        averageRenderTime: Math.round(averageRenderTime * 100) / 100,
        memoryEfficiency: Math.round(memoryEfficiency),
        networkPerformance: Math.round(networkPerformance),
        batteryEfficiency: Math.round(batteryEfficiency),
        cacheEfficiency: Math.round(cacheEfficiency),
      },
      componentMetrics: Array.from(this.componentMetrics.values()),
      recommendations,
      healthScore,
    };
  }

  /**
   * Private helper methods
   */
  private async setupMemoryMonitoring(): Promise<void> {
    // Monitor memory usage every 30 seconds
    this.memoryMonitorTimer = setInterval(async () => {
      await this.optimizeMemoryUsage();
    }, 30000);
  }

  private async setupPerformanceTracking(): Promise<void> {
    // Set up frame drop detection for iOS/Android
    if (Platform.OS === 'ios') {
      // iOS-specific performance tracking
    } else {
      // Android-specific performance tracking
    }
  }

  private async optimizeDeviceSpecificSettings(): Promise<void> {
    // Adjust settings based on device capabilities
    const deviceInfo = await this.getDeviceCapabilities();
    
    if (deviceInfo.isLowEndDevice) {
      // Reduce performance settings for low-end devices
      MOBILE_PERFORMANCE_CONFIG.chunkSize = 5;
      MOBILE_PERFORMANCE_CONFIG.batchRenderSize = 3;
      MOBILE_PERFORMANCE_CONFIG.requestConcurrency = 2;
    } else if (deviceInfo.isHighEndDevice) {
      // Increase performance settings for high-end devices
      MOBILE_PERFORMANCE_CONFIG.chunkSize = 15;
      MOBILE_PERFORMANCE_CONFIG.batchRenderSize = 8;
      MOBILE_PERFORMANCE_CONFIG.requestConcurrency = 6;
    }
  }

  private async startBackgroundOptimizations(): Promise<void> {
    // Start background optimization tasks
    InteractionManager.runAfterInteractions(() => {
      // Perform initial cache cleanup
      this.performMemoryCleanup();
      
      // Start request queue processing
      this.processRequestQueue();
    });
  }

  private addToRenderQueue(renderFunction: () => void): void {
    this.renderQueue.push(renderFunction);
    
    if (!this.isProcessingQueue) {
      this.processRenderQueue();
    }
  }

  private processRenderQueue(): void {
    if (this.renderQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    
    const processNextBatch = () => {
      const batchSize = Math.min(MOBILE_PERFORMANCE_CONFIG.batchRenderSize, this.renderQueue.length);
      
      for (let i = 0; i < batchSize; i++) {
        const renderFunction = this.renderQueue.shift();
        if (renderFunction) {
          try {
            renderFunction();
          } catch (error) {
            console.error('Render queue processing error:', error);
          }
        }
      }

      if (this.renderQueue.length > 0) {
        // Continue processing in next frame
        requestAnimationFrame(processNextBatch);
      } else {
        this.isProcessingQueue = false;
      }
    };

    requestAnimationFrame(processNextBatch);
  }

  private async processRequestQueue(): Promise<void> {
    while (
      this.requestQueue.length > 0 && 
      this.processingRequests < MOBILE_PERFORMANCE_CONFIG.requestConcurrency
    ) {
      const queueItem = this.requestQueue.shift();
      if (queueItem) {
        this.processingRequests++;
        
        try {
          const result = await queueItem.request();
          queueItem.resolve(result);
        } catch (error) {
          queueItem.reject(error);
        } finally {
          this.processingRequests--;
        }
      }
    }
  }

  private trackComponentPerformance(componentName: string, action: string): void {
    const existing = this.componentMetrics.get(componentName) || {
      componentName,
      renderCount: 0,
      averageRenderTime: 0,
      memoryLeaks: 0,
      reRenderReasons: [],
    };

    existing.renderCount++;
    this.componentMetrics.set(componentName, existing);
  }

  private recordComponentRenderTime(componentName: string, renderTime: number): void {
    const existing = this.componentMetrics.get(componentName);
    if (existing) {
      existing.averageRenderTime = (existing.averageRenderTime + renderTime) / 2;
      this.componentMetrics.set(componentName, existing);
    }
  }

  private recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.performanceMetrics.length > 200) {
      this.performanceMetrics = this.performanceMetrics.slice(-200);
    }
  }

  private async getCurrentMemoryUsage(): Promise<number> {
    // This would integrate with native modules for actual memory usage
    // For now, return estimated usage based on cache sizes
    return this.currentImageCacheSize + 10 * 1024 * 1024; // Base app usage
  }

  private async performMemoryCleanup(): Promise<void> {
    console.log('🧹 Performing memory cleanup');
    
    // Clean image cache
    this.cleanupImageCache();
    
    // Clear old performance metrics
    this.performanceMetrics = this.performanceMetrics.slice(-100);
    
    // Clear component metrics for components not used recently
    const now = Date.now();
    for (const [name, data] of this.componentMetrics) {
      if (data.renderCount === 0) { // Not rendered recently
        this.componentMetrics.delete(name);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private cleanupImageCache(): void {
    const now = Date.now();
    let cleanedSize = 0;
    
    // Remove expired images
    for (const [key, cached] of this.imageCache) {
      if (now - cached.timestamp > MOBILE_PERFORMANCE_CONFIG.imageCache.maxAge) {
        cleanedSize += cached.size;
        this.imageCache.delete(key);
      }
    }
    
    // If still too large, remove least recently used
    if (this.currentImageCacheSize > MOBILE_PERFORMANCE_CONFIG.imageCache.maxSize) {
      const sortedEntries = Array.from(this.imageCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      while (this.currentImageCacheSize > MOBILE_PERFORMANCE_CONFIG.imageCache.maxSize * 0.8 && sortedEntries.length > 0) {
        const [key, cached] = sortedEntries.shift()!;
        cleanedSize += cached.size;
        this.imageCache.delete(key);
      }
    }
    
    this.currentImageCacheSize = Math.max(0, this.currentImageCacheSize - cleanedSize);
    
    if (cleanedSize > 0) {
      console.log('🧹 Image cache cleanup completed:', Math.round(cleanedSize / 1024), 'KB freed');
    }
  }

  private async getCachedNetworkResult<T>(cacheKey: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`net_cache_${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 300000) { // 5 minutes
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Network cache retrieval error:', error);
    }
    return null;
  }

  private async setCachedNetworkResult<T>(cacheKey: string, data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`net_cache_${cacheKey}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('Network cache storage error:', error);
    }
  }

  private generateImageCacheKey(url: string, width?: number, height?: number, quality?: number): string {
    return `img_${url}_${width || 'auto'}_${height || 'auto'}_${quality || 'default'}`;
  }

  private async loadAndOptimizeImage(
    imageUrl: string, 
    options: { width?: number; height?: number; quality?: number; priority?: string }
  ): Promise<string> {
    // This would integrate with native image optimization
    // For now, return the original URL
    return imageUrl;
  }

  private cacheOptimizedImage(cacheKey: string, imageData: string): void {
    const size = imageData.length * 2; // Rough size estimate
    
    // Clean cache if needed
    if (this.currentImageCacheSize + size > MOBILE_PERFORMANCE_CONFIG.imageCache.maxSize) {
      this.cleanupImageCache();
    }
    
    this.imageCache.set(cacheKey, {
      data: imageData,
      timestamp: Date.now(),
      size,
    });
    
    this.currentImageCacheSize += size;
  }

  private async getDeviceCapabilities(): Promise<{
    isLowEndDevice: boolean;
    isHighEndDevice: boolean;
    memorySize: number;
    cpuCores: number;
  }> {
    // This would integrate with device info libraries
    return {
      isLowEndDevice: false,
      isHighEndDevice: true,
      memorySize: 4096, // 4GB
      cpuCores: 8,
    };
  }

  private calculateBatteryEfficiency(metrics: PerformanceMetrics[]): number {
    const batteryImpactScores = metrics.map(m => {
      switch (m.batteryImpact) {
        case 'low': return 100;
        case 'medium': return 70;
        case 'high': return 40;
        default: return 100;
      }
    });
    
    return batteryImpactScores.reduce((sum, score) => sum + score, 0) / batteryImpactScores.length;
  }

  private generatePerformanceRecommendations(performance: {
    averageRenderTime: number;
    memoryEfficiency: number;
    networkPerformance: number;
    batteryEfficiency: number;
    cacheEfficiency: number;
  }): string[] {
    const recommendations: string[] = [];
    
    if (performance.averageRenderTime > 16) { // Above 60fps threshold
      recommendations.push('Consider implementing component virtualization for large lists');
    }
    
    if (performance.memoryEfficiency < 80) {
      recommendations.push('Memory usage is high - implement more aggressive caching cleanup');
    }
    
    if (performance.networkPerformance < 70) {
      recommendations.push('Network performance is slow - consider implementing request batching');
    }
    
    if (performance.batteryEfficiency < 75) {
      recommendations.push('High battery usage detected - optimize background tasks');
    }
    
    if (performance.cacheEfficiency < 60) {
      recommendations.push('Cache hit ratio is low - improve caching strategy');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance is excellent! Keep up the good work.');
    }
    
    return recommendations;
  }

  /**
   * Cleanup when service is destroyed
   */
  cleanup(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
    }
    
    this.performanceMetrics = [];
    this.componentMetrics.clear();
    this.imageCache.clear();
    this.renderQueue = [];
    this.requestQueue = [];
    this.activeRequests.clear();
  }
}

export const mobilePerformanceOptimizer = new MobilePerformanceOptimizer();