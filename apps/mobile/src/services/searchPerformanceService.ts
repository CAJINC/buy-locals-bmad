import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationCoordinates } from './locationService';

// Performance Configuration Constants
export const SEARCH_PERFORMANCE_CONFIG = {
  // Debouncing
  DEBOUNCE_DELAY: 300, // 300ms debounce
  DEBOUNCE_AGGRESSIVE_DELAY: 150, // For fast typers
  
  // Caching
  CACHE_TTL: 300000, // 5 minutes (matches backend TTL)
  CACHE_MAX_ENTRIES: 500,
  CACHE_CLEANUP_THRESHOLD: 600,
  OFFLINE_CACHE_TTL: 1800000, // 30 minutes for offline
  
  // Progressive Loading
  INITIAL_RADIUS: 5, // 5km initial search
  RADIUS_EXPANSION_STEPS: [10, 25, 50], // Progressive expansion
  EXPANSION_DELAY: 200, // 200ms between expansions
  
  // Performance Monitoring
  PERFORMANCE_TARGET: 1000, // 1 second target
  PERFORMANCE_WARNING: 800, // 800ms warning threshold
  METRICS_BUFFER_SIZE: 100,
  
  // Network Conditions
  SLOW_NETWORK_THRESHOLD: 2000, // 2 seconds considered slow
  OFFLINE_DETECTION_TIMEOUT: 5000,
  FALLBACK_RETRY_DELAY: 1000,
  FALLBACK_MAX_RETRIES: 3,
  
  // Preloading
  PRELOAD_RADIUS: 15, // 15km for common area preloading
  PRELOAD_MAX_AREAS: 10,
  PRELOAD_TRIGGER_DISTANCE: 2000, // 2km from cache boundary
};

export interface SearchQuery {
  lat: number;
  lng: number;
  radius?: number;
  category?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'distance' | 'rating' | 'newest';
}

export interface CachedSearchResult {
  businesses: any[];
  totalCount: number;
  searchRadius: number;
  searchCenter: { lat: number; lng: number };
  timestamp: number;
  cacheKey: string;
  isOfflineCache?: boolean;
  performanceMetrics?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  executionTime: number;
  cacheHit: boolean;
  networkLatency?: number;
  resultsCount: number;
  searchComplexity: 'simple' | 'medium' | 'complex';
  timestamp: number;
}

export interface NetworkCondition {
  isOnline: boolean;
  isSlow: boolean;
  averageLatency: number;
  reliability: number; // 0-100
  lastChecked: number;
}

export interface PreloadArea {
  center: { lat: number; lng: number };
  radius: number;
  priority: number; // 1-10, higher is more important
  lastUsed: number;
  hitCount: number;
}

class SearchPerformanceService {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private searchCache = new Map<string, CachedSearchResult>();
  private performanceMetrics: PerformanceMetrics[] = [];
  private networkCondition: NetworkCondition = {
    isOnline: true,
    isSlow: false,
    averageLatency: 200,
    reliability: 100,
    lastChecked: Date.now(),
  };
  private preloadAreas: PreloadArea[] = [];
  private activeSearches = new Map<string, Promise<any>>();
  
  // Storage keys
  private readonly STORAGE_KEYS = {
    SEARCH_CACHE: '@buy_locals:search_cache',
    OFFLINE_CACHE: '@buy_locals:offline_search_cache',
    PERFORMANCE_METRICS: '@buy_locals:search_performance',
    PRELOAD_AREAS: '@buy_locals:preload_areas',
    NETWORK_CONDITION: '@buy_locals:network_condition',
  };

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize the service with cached data and background tasks
   */
  private async initializeService(): Promise<void> {
    try {
      await Promise.all([
        this.loadSearchCache(),
        this.loadPerformanceMetrics(),
        this.loadPreloadAreas(),
        this.loadNetworkCondition(),
      ]);
      
      // Start background tasks
      this.startNetworkMonitoring();
      this.startCacheCleanup();
      this.startPreloadingService();
      
    } catch (error) {
      console.warn('Search performance service initialization failed:', error);
    }
  }

  /**
   * Debounced search with intelligent delay adjustment
   */
  debouncedSearch(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any>,
    options: {
      immediate?: boolean;
      aggressiveTyping?: boolean;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<any> {
    const searchKey = this.generateSearchKey(query);
    const delay = this.calculateDebounceDelay(query, options);

    // Clear existing timer
    if (this.debounceTimers.has(searchKey)) {
      clearTimeout(this.debounceTimers.get(searchKey)!);
    }

    // For immediate searches or high priority
    if (options.immediate || options.priority === 'high') {
      return this.executeSearchWithPerformanceTracking(query, searchFunction);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          this.debounceTimers.delete(searchKey);
          const result = await this.executeSearchWithPerformanceTracking(query, searchFunction);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      this.debounceTimers.set(searchKey, timer);
    });
  }

  /**
   * Execute search with comprehensive performance tracking
   */
  private async executeSearchWithPerformanceTracking(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);
    
    try {
      // Check cache first
      const cachedResult = await this.getCachedResult(cacheKey, query);
      if (cachedResult) {
        this.recordPerformanceMetric({
          executionTime: Date.now() - startTime,
          cacheHit: true,
          resultsCount: cachedResult.businesses.length,
          searchComplexity: this.assessSearchComplexity(query),
          timestamp: Date.now(),
        });
        return cachedResult;
      }

      // Check for duplicate in-flight requests
      if (this.activeSearches.has(cacheKey)) {
        console.log('Reusing in-flight search request');
        return await this.activeSearches.get(cacheKey);
      }

      // Execute search with network condition handling
      const searchPromise = this.executeSearchWithFallbacks(query, searchFunction);
      this.activeSearches.set(cacheKey, searchPromise);

      try {
        const result = await searchPromise;
        
        // Cache the result
        await this.cacheSearchResult(cacheKey, result, query);
        
        // Record performance metrics
        this.recordPerformanceMetric({
          executionTime: Date.now() - startTime,
          cacheHit: false,
          networkLatency: result.networkLatency,
          resultsCount: result.businesses?.length || 0,
          searchComplexity: this.assessSearchComplexity(query),
          timestamp: Date.now(),
        });

        return result;
      } finally {
        this.activeSearches.delete(cacheKey);
      }

    } catch (error) {
      console.error('Search execution error:', error);
      
      // Try fallback strategies
      const fallbackResult = await this.handleSearchError(error, query, startTime);
      if (fallbackResult) {
        return fallbackResult;
      }
      
      throw error;
    }
  }

  /**
   * Execute search with network fallback strategies
   */
  private async executeSearchWithFallbacks(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any>
  ): Promise<any> {
    const networkStartTime = Date.now();
    
    try {
      // Add network monitoring
      const searchPromise = searchFunction(query);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 
          this.networkCondition.isSlow ? SEARCH_PERFORMANCE_CONFIG.SLOW_NETWORK_THRESHOLD * 2 : SEARCH_PERFORMANCE_CONFIG.SLOW_NETWORK_THRESHOLD)
      );

      const result = await Promise.race([searchPromise, timeoutPromise]);
      
      // Update network condition
      const networkLatency = Date.now() - networkStartTime;
      this.updateNetworkCondition(true, networkLatency);
      
      return {
        ...result,
        networkLatency,
      };

    } catch (error) {
      console.warn('Primary search failed, trying fallbacks:', error);
      
      // Update network condition
      this.updateNetworkCondition(false, Date.now() - networkStartTime);
      
      // Try progressive loading fallback
      if (!query.radius || query.radius > SEARCH_PERFORMANCE_CONFIG.INITIAL_RADIUS) {
        const fallbackQuery = {
          ...query,
          radius: SEARCH_PERFORMANCE_CONFIG.INITIAL_RADIUS,
        };
        
        try {
          const fallbackResult = await searchFunction(fallbackQuery);
          console.log('Fallback search succeeded with reduced radius');
          return {
            ...fallbackResult,
            isFallback: true,
            fallbackReason: 'network_timeout',
          };
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Progressive loading implementation - search nearby first, then expand
   */
  async progressiveSearch(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any>,
    onPartialResults?: (results: any, radius: number) => void
  ): Promise<any> {
    const startTime = Date.now();
    let allResults: any[] = [];
    let totalCount = 0;
    const searchCenter = { lat: query.lat, lng: query.lng };
    
    // Start with initial radius
    let currentRadius = SEARCH_PERFORMANCE_CONFIG.INITIAL_RADIUS;
    const targetRadius = query.radius || 25;
    
    try {
      // Phase 1: Initial nearby search
      console.log(`Progressive search: Phase 1 - ${currentRadius}km radius`);
      const initialQuery = { ...query, radius: currentRadius };
      const initialResult = await this.executeSearchWithPerformanceTracking(initialQuery, searchFunction);
      
      allResults = initialResult.businesses || [];
      totalCount = initialResult.totalCount || 0;
      
      // Notify with initial results
      if (onPartialResults && allResults.length > 0) {
        onPartialResults({
          ...initialResult,
          isPartial: true,
          currentRadius,
          targetRadius,
        }, currentRadius);
      }
      
      // Phase 2: Progressive expansion if needed and if we have time budget
      const timeRemaining = SEARCH_PERFORMANCE_CONFIG.PERFORMANCE_TARGET - (Date.now() - startTime);
      
      if (currentRadius < targetRadius && timeRemaining > SEARCH_PERFORMANCE_CONFIG.EXPANSION_DELAY) {
        const expansionSteps = SEARCH_PERFORMANCE_CONFIG.RADIUS_EXPANSION_STEPS
          .filter(radius => radius <= targetRadius && radius > currentRadius);
        
        for (const expandRadius of expansionSteps) {
          // Check time budget
          const currentTime = Date.now() - startTime;
          if (currentTime > SEARCH_PERFORMANCE_CONFIG.PERFORMANCE_WARNING) {
            console.log('Progressive search: Time budget exceeded, stopping expansion');
            break;
          }
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, SEARCH_PERFORMANCE_CONFIG.EXPANSION_DELAY));
          
          console.log(`Progressive search: Expanding to ${expandRadius}km radius`);
          const expandQuery = { ...query, radius: expandRadius };
          
          try {
            const expandedResult = await this.executeSearchWithPerformanceTracking(expandQuery, searchFunction);
            
            // Merge results, avoiding duplicates
            const existingIds = new Set(allResults.map(b => b.id));
            const newResults = (expandedResult.businesses || []).filter(b => !existingIds.has(b.id));
            
            allResults = [...allResults, ...newResults];
            totalCount = expandedResult.totalCount || totalCount;
            currentRadius = expandRadius;
            
            // Notify with updated results
            if (onPartialResults) {
              onPartialResults({
                ...expandedResult,
                businesses: allResults,
                isPartial: expandRadius < targetRadius,
                currentRadius,
                targetRadius,
              }, currentRadius);
            }
            
          } catch (expandError) {
            console.warn(`Progressive expansion to ${expandRadius}km failed:`, expandError);
            break;
          }
        }
      }
      
      // Final result
      const finalResult = {
        businesses: allResults,
        totalCount,
        searchRadius: currentRadius,
        searchCenter,
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        isProgressive: true,
      };
      
      console.log(`Progressive search completed: ${allResults.length} results in ${currentRadius}km radius`);
      return finalResult;
      
    } catch (error) {
      console.error('Progressive search error:', error);
      
      // Return partial results if we have any
      if (allResults.length > 0) {
        console.log('Returning partial results due to error');
        return {
          businesses: allResults,
          totalCount,
          searchRadius: currentRadius,
          searchCenter,
          executionTimeMs: Date.now() - startTime,
          cacheHit: false,
          isPartial: true,
          error: error.message,
        };
      }
      
      throw error;
    }
  }

  /**
   * Get cached result with location-based cache keys
   */
  private async getCachedResult(cacheKey: string, query: SearchQuery): Promise<CachedSearchResult | null> {
    try {
      // Check memory cache first
      if (this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey)!;
        
        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age < SEARCH_PERFORMANCE_CONFIG.CACHE_TTL) {
          console.log('Cache hit (memory):', cacheKey);
          return cached;
        }
        
        // Remove expired cache
        this.searchCache.delete(cacheKey);
      }

      // Check for nearby cached results (location-based cache key flexibility)
      const nearbyResult = this.findNearbyCachedResult(query);
      if (nearbyResult) {
        console.log('Cache hit (nearby):', nearbyResult.cacheKey);
        return nearbyResult;
      }

      // Check offline cache if network conditions are poor
      if (this.networkCondition.isSlow || !this.networkCondition.isOnline) {
        const offlineResult = await this.getOfflineCachedResult(query);
        if (offlineResult) {
          console.log('Cache hit (offline):', cacheKey);
          return offlineResult;
        }
      }

      return null;
    } catch (error) {
      console.warn('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Find nearby cached results for cache key flexibility
   */
  private findNearbyCachedResult(query: SearchQuery): CachedSearchResult | null {
    const maxDistance = 0.01; // ~1km tolerance for cache hits
    
    for (const [key, cached] of this.searchCache) {
      const distance = this.calculateDistance(
        query.lat, query.lng,
        cached.searchCenter.lat, cached.searchCenter.lng
      );
      
      // Check if cached result is nearby and compatible
      if (distance <= maxDistance && 
          cached.searchRadius >= (query.radius || 25) &&
          this.isQueryCompatible(query, cached)) {
        
        // Update cache key for tracking
        cached.cacheKey = key;
        return cached;
      }
    }
    
    return null;
  }

  /**
   * Cache search result with intelligent TTL and compression
   */
  private async cacheSearchResult(cacheKey: string, result: any, query: SearchQuery): Promise<void> {
    try {
      const cacheEntry: CachedSearchResult = {
        businesses: result.businesses || [],
        totalCount: result.totalCount || 0,
        searchRadius: result.searchRadius || query.radius || 25,
        searchCenter: { lat: query.lat, lng: query.lng },
        timestamp: Date.now(),
        cacheKey,
        performanceMetrics: result.performanceMetrics,
      };

      // Store in memory cache
      this.searchCache.set(cacheKey, cacheEntry);

      // Store in offline cache for critical areas
      if (this.isAreaCritical(query.lat, query.lng)) {
        await this.storeOfflineCache(cacheKey, cacheEntry);
      }

      // Trigger cache cleanup if needed
      if (this.searchCache.size > SEARCH_PERFORMANCE_CONFIG.CACHE_CLEANUP_THRESHOLD) {
        this.cleanupCache();
      }

      // Persist cache for next app session
      await this.persistSearchCache();

    } catch (error) {
      console.warn('Cache storage error:', error);
    }
  }

  /**
   * Handle search errors with fallback strategies
   */
  private async handleSearchError(error: any, query: SearchQuery, startTime: number): Promise<any | null> {
    console.log('Handling search error with fallbacks:', error.message);

    // Strategy 1: Try offline cache
    const offlineResult = await this.getOfflineCachedResult(query);
    if (offlineResult) {
      console.log('Fallback: Using offline cache');
      this.recordPerformanceMetric({
        executionTime: Date.now() - startTime,
        cacheHit: true,
        resultsCount: offlineResult.businesses.length,
        searchComplexity: this.assessSearchComplexity(query),
        timestamp: Date.now(),
      });
      
      return {
        ...offlineResult,
        isOfflineFallback: true,
        error: 'Network unavailable, showing cached results',
      };
    }

    // Strategy 2: Try broader cached results
    const broaderResult = this.findBroaderCachedResult(query);
    if (broaderResult) {
      console.log('Fallback: Using broader cached results');
      return {
        ...broaderResult,
        isFallback: true,
        fallbackReason: 'network_error',
      };
    }

    // Strategy 3: Return empty result with error info
    console.log('All fallback strategies failed');
    return null;
  }

  /**
   * Network condition monitoring
   */
  private startNetworkMonitoring(): void {
    // Monitor network conditions every 30 seconds
    setInterval(() => {
      this.checkNetworkCondition();
    }, 30000);
  }

  private async checkNetworkCondition(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Simple connectivity test (could be enhanced with actual endpoint)
      const testPromise = Promise.resolve(); // Simplified
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network test timeout')), 5000)
      );

      await Promise.race([testPromise, timeoutPromise]);
      
      const latency = Date.now() - startTime;
      this.updateNetworkCondition(true, latency);

    } catch (error) {
      this.updateNetworkCondition(false, SEARCH_PERFORMANCE_CONFIG.OFFLINE_DETECTION_TIMEOUT);
    }
  }

  private updateNetworkCondition(isOnline: boolean, latency: number): void {
    const reliability = isOnline ? Math.min(100, this.networkCondition.reliability + 10) 
                                 : Math.max(0, this.networkCondition.reliability - 20);
    
    this.networkCondition = {
      isOnline,
      isSlow: latency > SEARCH_PERFORMANCE_CONFIG.SLOW_NETWORK_THRESHOLD,
      averageLatency: (this.networkCondition.averageLatency * 0.7) + (latency * 0.3), // Weighted average
      reliability,
      lastChecked: Date.now(),
    };

    // Persist network condition
    this.persistNetworkCondition();
  }

  /**
   * Preloading service for common areas
   */
  private startPreloadingService(): void {
    // Trigger preloading every 5 minutes
    setInterval(() => {
      this.triggerIntelligentPreloading();
    }, 300000);
  }

  private async triggerIntelligentPreloading(): Promise<void> {
    try {
      // Find areas that need preloading
      const areasToPreload = this.identifyPreloadAreas();
      
      for (const area of areasToPreload.slice(0, 3)) { // Limit to 3 areas per cycle
        await this.preloadArea(area);
        
        // Small delay between preloads
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.warn('Preloading error:', error);
    }
  }

  private identifyPreloadAreas(): PreloadArea[] {
    return this.preloadAreas
      .filter(area => {
        const age = Date.now() - area.lastUsed;
        return age < 1800000 && !this.isAreaCached(area); // 30 minutes
      })
      .sort((a, b) => (b.priority * b.hitCount) - (a.priority * a.hitCount))
      .slice(0, SEARCH_PERFORMANCE_CONFIG.PRELOAD_MAX_AREAS);
  }

  private async preloadArea(area: PreloadArea): Promise<void> {
    console.log(`Preloading area: ${area.center.lat}, ${area.center.lng}`);
    
    const query: SearchQuery = {
      lat: area.center.lat,
      lng: area.center.lng,
      radius: area.radius,
      limit: 20, // Reasonable limit for preloading
    };

    try {
      // This would call the actual search function in a real implementation
      // For now, we'll simulate preloading
      const cacheKey = this.generateCacheKey(query);
      
      if (!this.searchCache.has(cacheKey)) {
        console.log('Area would be preloaded:', cacheKey);
        // await this.executeSearchWithPerformanceTracking(query, actualSearchFunction);
      }
    } catch (error) {
      console.warn('Area preloading failed:', error);
    }
  }

  /**
   * Performance monitoring and metrics
   */
  private recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.performanceMetrics.length > SEARCH_PERFORMANCE_CONFIG.METRICS_BUFFER_SIZE) {
      this.performanceMetrics = this.performanceMetrics.slice(-SEARCH_PERFORMANCE_CONFIG.METRICS_BUFFER_SIZE);
    }

    // Log performance warnings
    if (metric.executionTime > SEARCH_PERFORMANCE_CONFIG.PERFORMANCE_WARNING) {
      console.warn(`Slow search detected: ${metric.executionTime}ms for ${metric.resultsCount} results`);
    }

    // Persist metrics periodically
    if (this.performanceMetrics.length % 10 === 0) {
      this.persistPerformanceMetrics();
    }
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(): {
    averageExecutionTime: number;
    cacheHitRate: number;
    networkReliability: number;
    sub1SecondRate: number;
    recentMetrics: PerformanceMetrics[];
    networkCondition: NetworkCondition;
  } {
    const recentMetrics = this.performanceMetrics.slice(-50); // Last 50 searches
    
    if (recentMetrics.length === 0) {
      return {
        averageExecutionTime: 0,
        cacheHitRate: 0,
        networkReliability: 100,
        sub1SecondRate: 100,
        recentMetrics: [],
        networkCondition: this.networkCondition,
      };
    }

    const totalTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const sub1Second = recentMetrics.filter(m => m.executionTime < 1000).length;

    return {
      averageExecutionTime: Math.round(totalTime / recentMetrics.length),
      cacheHitRate: Math.round((cacheHits / recentMetrics.length) * 100) / 100,
      networkReliability: this.networkCondition.reliability,
      sub1SecondRate: Math.round((sub1Second / recentMetrics.length) * 100) / 100,
      recentMetrics: recentMetrics.slice(-10), // Last 10 for detailed view
      networkCondition: this.networkCondition,
    };
  }

  /**
   * Cache management utilities
   */
  private cleanupCache(): void {
    console.log('Cleaning up search cache');
    
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, cached] of this.searchCache) {
      const age = now - cached.timestamp;
      if (age > SEARCH_PERFORMANCE_CONFIG.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    // Remove expired entries
    expiredKeys.forEach(key => this.searchCache.delete(key));
    
    // If still too many entries, remove least recently used
    if (this.searchCache.size > SEARCH_PERFORMANCE_CONFIG.CACHE_MAX_ENTRIES) {
      const entries = Array.from(this.searchCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp); // Oldest first
      
      const toRemove = entries.slice(0, this.searchCache.size - SEARCH_PERFORMANCE_CONFIG.CACHE_MAX_ENTRIES);
      toRemove.forEach(([key]) => this.searchCache.delete(key));
    }
    
    console.log(`Cache cleanup completed: ${expiredKeys.length} expired, ${this.searchCache.size} remaining`);
  }

  private startCacheCleanup(): void {
    // Clean cache every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 300000);
  }

  /**
   * Offline cache management
   */
  private async getOfflineCachedResult(query: SearchQuery): Promise<CachedSearchResult | null> {
    try {
      const offlineCacheData = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_CACHE);
      if (!offlineCacheData) return null;

      const offlineCache = JSON.parse(offlineCacheData) as { [key: string]: CachedSearchResult };
      
      // Find best matching offline result
      for (const [key, cached] of Object.entries(offlineCache)) {
        const distance = this.calculateDistance(
          query.lat, query.lng,
          cached.searchCenter.lat, cached.searchCenter.lng
        );
        
        const age = Date.now() - cached.timestamp;
        
        if (distance <= 5 && // Within 5km
            cached.searchRadius >= (query.radius || 25) &&
            age < SEARCH_PERFORMANCE_CONFIG.OFFLINE_CACHE_TTL) {
          
          return {
            ...cached,
            isOfflineCache: true,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn('Offline cache retrieval error:', error);
      return null;
    }
  }

  private async storeOfflineCache(cacheKey: string, result: CachedSearchResult): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_CACHE);
      const offlineCache = existing ? JSON.parse(existing) : {};
      
      offlineCache[cacheKey] = {
        ...result,
        isOfflineCache: true,
      };
      
      // Limit offline cache size
      const entries = Object.entries(offlineCache);
      if (entries.length > 50) {
        // Keep most recent 30 entries
        const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        const limited = sorted.slice(0, 30);
        const limitedCache = Object.fromEntries(limited);
        
        await AsyncStorage.setItem(this.STORAGE_KEYS.OFFLINE_CACHE, JSON.stringify(limitedCache));
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.OFFLINE_CACHE, JSON.stringify(offlineCache));
      }
    } catch (error) {
      console.warn('Offline cache storage error:', error);
    }
  }

  /**
   * Utility functions
   */
  private generateSearchKey(query: SearchQuery): string {
    return `search:${query.lat}:${query.lng}:${query.search || 'all'}`;
  }

  private generateCacheKey(query: SearchQuery): string {
    const { lat, lng, radius, category, search, page, limit, sortBy } = query;
    
    // Round coordinates to 4 decimal places for better cache efficiency
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    
    const parts = [
      'search',
      `${roundedLat},${roundedLng}`,
      `r${radius || 25}`,
      category ? `c${category.sort().join(',')}` : 'all',
      search ? `s${search.toLowerCase().replace(/\s+/g, '_')}` : 'all',
      `p${page || 1}`,
      `l${limit || 10}`,
      sortBy || 'distance',
    ];
    
    return parts.join(':');
  }

  private calculateDebounceDelay(query: SearchQuery, options: any): number {
    let delay = SEARCH_PERFORMANCE_CONFIG.DEBOUNCE_DELAY;
    
    // Adjust for aggressive typing
    if (options.aggressiveTyping) {
      delay = SEARCH_PERFORMANCE_CONFIG.DEBOUNCE_AGGRESSIVE_DELAY;
    }
    
    // Adjust for network conditions
    if (this.networkCondition.isSlow) {
      delay *= 1.5; // Increase delay for slow networks
    }
    
    // Adjust for search complexity
    const complexity = this.assessSearchComplexity(query);
    if (complexity === 'complex') {
      delay *= 1.2;
    }
    
    return Math.round(delay);
  }

  private assessSearchComplexity(query: SearchQuery): 'simple' | 'medium' | 'complex' {
    let complexity = 0;
    
    if (query.search && query.search.length > 0) complexity += 2;
    if (query.category && query.category.length > 0) complexity += 1;
    if (query.radius && query.radius > 50) complexity += 1;
    if (query.sortBy && query.sortBy !== 'distance') complexity += 1;
    
    if (complexity <= 1) return 'simple';
    if (complexity <= 3) return 'medium';
    return 'complex';
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private isQueryCompatible(query: SearchQuery, cached: CachedSearchResult): boolean {
    // Check if categories match or are compatible
    if (query.category && query.category.length > 0) {
      // Would need more sophisticated matching logic
      return true; // Simplified
    }
    
    // Check if search terms are compatible
    if (query.search && query.search.length > 0) {
      // Would need more sophisticated matching logic
      return true; // Simplified
    }
    
    return true;
  }

  private isAreaCritical(lat: number, lng: number): boolean {
    // Areas that are accessed frequently should be cached offline
    // This would be enhanced with actual usage analytics
    return this.preloadAreas.some(area => {
      const distance = this.calculateDistance(lat, lng, area.center.lat, area.center.lng);
      return distance <= 5 && area.hitCount > 10;
    });
  }

  private isAreaCached(area: PreloadArea): boolean {
    const query: SearchQuery = {
      lat: area.center.lat,
      lng: area.center.lng,
      radius: area.radius,
    };
    
    const cacheKey = this.generateCacheKey(query);
    return this.searchCache.has(cacheKey);
  }

  private findBroaderCachedResult(query: SearchQuery): CachedSearchResult | null {
    // Look for cached results with broader search parameters
    for (const [_, cached] of this.searchCache) {
      const distance = this.calculateDistance(
        query.lat, query.lng,
        cached.searchCenter.lat, cached.searchCenter.lng
      );
      
      if (distance <= 10 && cached.searchRadius >= (query.radius || 25) * 1.5) {
        return cached;
      }
    }
    
    return null;
  }

  /**
   * Persistence methods
   */
  private async persistSearchCache(): Promise<void> {
    try {
      const cacheArray = Array.from(this.searchCache.entries());
      const limitedCache = cacheArray.slice(-100); // Keep last 100 entries
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SEARCH_CACHE,
        JSON.stringify(Object.fromEntries(limitedCache))
      );
    } catch (error) {
      console.warn('Cache persistence error:', error);
    }
  }

  private async loadSearchCache(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.STORAGE_KEYS.SEARCH_CACHE);
      if (cacheData) {
        const cache = JSON.parse(cacheData);
        const now = Date.now();
        
        // Filter out expired entries
        for (const [key, entry] of Object.entries(cache)) {
          const age = now - (entry as CachedSearchResult).timestamp;
          if (age < SEARCH_PERFORMANCE_CONFIG.CACHE_TTL) {
            this.searchCache.set(key, entry as CachedSearchResult);
          }
        }
        
        console.log(`Loaded ${this.searchCache.size} cached search results`);
      }
    } catch (error) {
      console.warn('Cache loading error:', error);
    }
  }

  private async persistPerformanceMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PERFORMANCE_METRICS,
        JSON.stringify(this.performanceMetrics.slice(-50))
      );
    } catch (error) {
      console.warn('Performance metrics persistence error:', error);
    }
  }

  private async loadPerformanceMetrics(): Promise<void> {
    try {
      const metricsData = await AsyncStorage.getItem(this.STORAGE_KEYS.PERFORMANCE_METRICS);
      if (metricsData) {
        this.performanceMetrics = JSON.parse(metricsData);
      }
    } catch (error) {
      console.warn('Performance metrics loading error:', error);
    }
  }

  private async persistPreloadAreas(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PRELOAD_AREAS,
        JSON.stringify(this.preloadAreas.slice(-20))
      );
    } catch (error) {
      console.warn('Preload areas persistence error:', error);
    }
  }

  private async loadPreloadAreas(): Promise<void> {
    try {
      const areasData = await AsyncStorage.getItem(this.STORAGE_KEYS.PRELOAD_AREAS);
      if (areasData) {
        this.preloadAreas = JSON.parse(areasData);
      }
    } catch (error) {
      console.warn('Preload areas loading error:', error);
    }
  }

  private async persistNetworkCondition(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.NETWORK_CONDITION,
        JSON.stringify(this.networkCondition)
      );
    } catch (error) {
      console.warn('Network condition persistence error:', error);
    }
  }

  private async loadNetworkCondition(): Promise<void> {
    try {
      const conditionData = await AsyncStorage.getItem(this.STORAGE_KEYS.NETWORK_CONDITION);
      if (conditionData) {
        this.networkCondition = JSON.parse(conditionData);
      }
    } catch (error) {
      console.warn('Network condition loading error:', error);
    }
  }

  /**
   * Public API methods
   */
  
  /**
   * Update preload area with usage tracking
   */
  updatePreloadArea(lat: number, lng: number, radius: number = 15, priority: number = 5): void {
    const existing = this.preloadAreas.find(area => 
      this.calculateDistance(lat, lng, area.center.lat, area.center.lng) < 2
    );
    
    if (existing) {
      existing.hitCount += 1;
      existing.lastUsed = Date.now();
      existing.priority = Math.min(10, existing.priority + 0.1);
    } else {
      this.preloadAreas.push({
        center: { lat, lng },
        radius,
        priority,
        lastUsed: Date.now(),
        hitCount: 1,
      });
    }
    
    // Persist updates
    this.persistPreloadAreas();
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    this.searchCache.clear();
    this.performanceMetrics = [];
    this.preloadAreas = [];
    
    await Promise.all([
      AsyncStorage.removeItem(this.STORAGE_KEYS.SEARCH_CACHE),
      AsyncStorage.removeItem(this.STORAGE_KEYS.OFFLINE_CACHE),
      AsyncStorage.removeItem(this.STORAGE_KEYS.PERFORMANCE_METRICS),
      AsyncStorage.removeItem(this.STORAGE_KEYS.PRELOAD_AREAS),
    ]);
    
    console.log('All search caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    memoryCacheSize: number;
    offlineCacheSize: number;
    preloadAreas: number;
    performanceMetrics: number;
  } {
    return {
      memoryCacheSize: this.searchCache.size,
      offlineCacheSize: 0, // Would need to check AsyncStorage
      preloadAreas: this.preloadAreas.length,
      performanceMetrics: this.performanceMetrics.length,
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    console.log('Cleaning up SearchPerformanceService');
    
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear active searches
    this.activeSearches.clear();
    
    console.log('SearchPerformanceService cleanup completed');
  }
}

export const searchPerformanceService = new SearchPerformanceService();