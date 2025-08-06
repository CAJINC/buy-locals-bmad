import { BusinessSearchResult } from '../services/enhancedLocationSearchService';
import { WeeklyHours, SpecialHours } from '../../types/business';

export interface PerformanceMetrics {
  searchResponseTime: number;
  hoursCalculationTime: number;
  realTimeUpdateLatency: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export interface OptimizationConfig {
  enableCaching: boolean;
  cacheTimeout: number;
  batchSize: number;
  maxConcurrentRequests: number;
  preloadThreshold: number;
}

export class PerformanceOptimizationService {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private requestQueue: Map<string, Promise<any>> = new Map();
  private metrics: PerformanceMetrics = {
    searchResponseTime: 0,
    hoursCalculationTime: 0,
    realTimeUpdateLatency: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
  };

  private config: OptimizationConfig = {
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    batchSize: 20,
    maxConcurrentRequests: 5,
    preloadThreshold: 0.8,
  };

  /**
   * Optimizes search query performance with intelligent caching
   */
  async optimizeSearchQuery(
    query: string,
    location: { latitude: number; longitude: number },
    filters: any,
    searchFn: (query: string, location: any, filters: any) => Promise<BusinessSearchResult[]>
  ): Promise<BusinessSearchResult[]> {
    const startTime = performance.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateSearchCacheKey(query, location, filters);
      
      // Check cache first
      if (this.config.enableCaching) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          this.updateMetrics('cacheHit', performance.now() - startTime);
          return cachedResult;
        }
      }

      // Check if same request is already in progress
      if (this.requestQueue.has(cacheKey)) {
        return await this.requestQueue.get(cacheKey)!;
      }

      // Execute search with request deduplication
      const searchPromise = this.executeOptimizedSearch(query, location, filters, searchFn);
      this.requestQueue.set(cacheKey, searchPromise);

      const results = await searchPromise;

      // Cache results
      if (this.config.enableCaching && results) {
        this.setCache(cacheKey, results, this.config.cacheTimeout);
      }

      // Clean up request queue
      this.requestQueue.delete(cacheKey);

      // Update metrics
      this.updateMetrics('searchResponse', performance.now() - startTime);

      return results;
    } catch (error) {
      // Clean up request queue on error
      const cacheKey = this.generateSearchCacheKey(query, location, filters);
      this.requestQueue.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Optimizes hours calculation with memoization
   */
  async optimizeHoursCalculation(
    businessId: string,
    hours: WeeklyHours,
    specialHours: SpecialHours[],
    timezone: string,
    calculationFn: (businessId: string, hours: WeeklyHours, specialHours: SpecialHours[], timezone: string) => Promise<any>
  ): Promise<any> {
    const startTime = performance.now();
    
    const cacheKey = this.generateHoursCacheKey(businessId, hours, specialHours, timezone);
    
    // Check cache for recent calculation
    if (this.config.enableCaching) {
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.updateMetrics('cacheHit', performance.now() - startTime);
        return cachedResult;
      }
    }

    // Execute calculation
    const result = await calculationFn(businessId, hours, specialHours, timezone);
    
    // Cache result with shorter TTL for hours calculation (1 minute)
    if (this.config.enableCaching && result) {
      this.setCache(cacheKey, result, 60000);
    }

    this.updateMetrics('hoursCalculation', performance.now() - startTime);
    return result;
  }

  /**
   * Optimizes real-time updates with batching and throttling
   */
  optimizeRealTimeUpdates<T>(
    updateFn: (items: T[]) => Promise<void>,
    throttleMs: number = 1000
  ): (item: T) => void {
    let updateBatch: T[] = [];
    let updateTimer: NodeJS.Timeout | null = null;

    return (item: T) => {
      updateBatch.push(item);

      if (updateTimer) {
        clearTimeout(updateTimer);
      }

      updateTimer = setTimeout(async () => {
        if (updateBatch.length > 0) {
          const startTime = performance.now();
          
          try {
            // Process batch
            const batchToProcess = [...updateBatch];
            updateBatch = [];

            await updateFn(batchToProcess);
            
            this.updateMetrics('realTimeUpdate', performance.now() - startTime);
          } catch (error) {
            console.error('Real-time update error:', error);
            // Re-queue failed items
            updateBatch.unshift(...updateBatch);
          }
        }
        updateTimer = null;
      }, throttleMs);
    };
  }

  /**
   * Implements intelligent preloading for search results
   */
  async preloadSearchResults(
    queries: string[],
    location: { latitude: number; longitude: number },
    searchFn: (query: string, location: any) => Promise<BusinessSearchResult[]>
  ): Promise<void> {
    const preloadPromises = queries.slice(0, 5).map(async (query) => {
      try {
        const cacheKey = this.generateSearchCacheKey(query, location, {});
        
        // Only preload if not already cached
        if (!this.getFromCache(cacheKey)) {
          const results = await searchFn(query, location);
          this.setCache(cacheKey, results, this.config.cacheTimeout);
        }
      } catch (error) {
        // Silently fail preloading - don't impact user experience
        console.warn('Preload failed for query:', query, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Optimizes memory usage by implementing LRU cache eviction
   */
  private implementLRUEviction(): void {
    const maxCacheSize = 100; // Maximum number of cache entries
    
    if (this.cache.size > maxCacheSize) {
      // Sort by last access time and remove oldest entries
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp);
      
      const entriesToRemove = entries.slice(0, entries.length - maxCacheSize);
      entriesToRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Implements smart cache warming based on usage patterns
   */
  async warmCacheBasedOnUsagePatterns(
    recentSearches: Array<{ query: string; location: any; timestamp: number }>,
    searchFn: (query: string, location: any) => Promise<BusinessSearchResult[]>
  ): Promise<void> {
    // Analyze patterns and warm cache for frequently used queries
    const frequentQueries = this.analyzeSearchPatterns(recentSearches);
    
    const warmupPromises = frequentQueries.map(async ({ query, location }) => {
      const cacheKey = this.generateSearchCacheKey(query, location, {});
      
      if (!this.getFromCache(cacheKey)) {
        try {
          const results = await searchFn(query, location);
          this.setCache(cacheKey, results, this.config.cacheTimeout * 2); // Longer TTL for frequently used queries
        } catch (error) {
          console.warn('Cache warming failed:', error);
        }
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * Optimizes search filters with lazy evaluation
   */
  optimizeSearchFilters<T>(
    items: T[],
    filters: Array<{ id: string; predicate: (item: T) => boolean; weight: number }>
  ): T[] {
    // Sort filters by weight (lighter filters first for early termination)
    const sortedFilters = filters.sort((a, b) => a.weight - b.weight);
    
    return items.filter(item => {
      // Early termination - if any filter fails, skip remaining filters
      return sortedFilters.every(filter => filter.predicate(item));
    });
  }

  /**
   * Implements virtualization for large business lists
   */
  virtualizeBusinessList(
    businesses: BusinessSearchResult[],
    viewportHeight: number,
    itemHeight: number,
    scrollOffset: number
  ): { visibleItems: BusinessSearchResult[]; totalHeight: number; startIndex: number } {
    const totalItems = businesses.length;
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2; // +2 for buffer
    
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - 1);
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);
    
    return {
      visibleItems: businesses.slice(startIndex, endIndex + 1),
      totalHeight: totalItems * itemHeight,
      startIndex,
    };
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update timestamp for LRU
    item.timestamp = Date.now();
    return item.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    // Implement LRU eviction
    this.implementLRUEviction();
  }

  /**
   * Cache key generation
   */
  private generateSearchCacheKey(
    query: string,
    location: { latitude: number; longitude: number },
    filters: any
  ): string {
    const locationKey = `${Math.round(location.latitude * 1000)},${Math.round(location.longitude * 1000)}`;
    const filtersKey = JSON.stringify(filters);
    return `search:${query}:${locationKey}:${filtersKey}`;
  }

  private generateHoursCacheKey(
    businessId: string,
    hours: WeeklyHours,
    specialHours: SpecialHours[],
    timezone: string
  ): string {
    const hoursHash = this.hashObject(hours);
    const specialHoursHash = this.hashObject(specialHours);
    return `hours:${businessId}:${hoursHash}:${specialHoursHash}:${timezone}`;
  }

  /**
   * Performance metrics and monitoring
   */
  private updateMetrics(type: string, duration: number): void {
    switch (type) {
      case 'searchResponse':
        this.metrics.searchResponseTime = duration;
        break;
      case 'hoursCalculation':
        this.metrics.hoursCalculationTime = duration;
        break;
      case 'realTimeUpdate':
        this.metrics.realTimeUpdateLatency = duration;
        break;
      case 'cacheHit': {
        // Calculate cache hit rate
        const totalRequests = (this.metrics.cacheHitRate * 100) + 1;
        const hits = (this.metrics.cacheHitRate * (totalRequests - 1)) + 1;
        this.metrics.cacheHitRate = hits / totalRequests;
        break;
      }
    }
  }

  /**
   * Analytics and pattern recognition
   */
  private analyzeSearchPatterns(
    searches: Array<{ query: string; location: any; timestamp: number }>
  ): Array<{ query: string; location: any; frequency: number }> {
    const patterns = new Map<string, { query: string; location: any; count: number }>();
    
    searches.forEach(search => {
      const key = `${search.query}:${search.location.latitude}:${search.location.longitude}`;
      const existing = patterns.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        patterns.set(key, {
          query: search.query,
          location: search.location,
          count: 1,
        });
      }
    });
    
    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(pattern => ({
        query: pattern.query,
        location: pattern.location,
        frequency: pattern.count,
      }));
  }

  /**
   * Helper methods
   */
  private async executeOptimizedSearch(
    query: string,
    location: any,
    filters: any,
    searchFn: (query: string, location: any, filters: any) => Promise<BusinessSearchResult[]>
  ): Promise<BusinessSearchResult[]> {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), 30000); // 30 second timeout
    });

    const searchPromise = searchFn(query, location, filters);
    
    return Promise.race([searchPromise, timeoutPromise]);
  }

  private hashObject(obj: any): string {
    return btoa(JSON.stringify(obj)).slice(0, 16);
  }

  /**
   * Performance monitoring and reporting
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
    };
  }

  /**
   * Memory optimization utilities
   */
  optimizeMemoryUsage(): void {
    // Clear expired cache entries
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key);
      }
    }

    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Configuration management
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): OptimizationConfig {
    return { ...this.config };
  }
}