import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { locationService, LocationCoordinates } from './locationService';

// Types for dynamic search system
export interface SearchRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  radius?: number; // in kilometers
  timestamp: number;
}

export interface SearchCriteria {
  query?: string;
  category?: string;
  radius: number;
  sortBy?: 'distance' | 'rating' | 'relevance' | 'price';
  filters?: {
    openNow?: boolean;
    priceRange?: [number, number];
    minimumRating?: number;
    hasDelivery?: boolean;
    hasPickup?: boolean;
  };
  location: LocationCoordinates;
  region: SearchRegion;
  timestamp: number;
}

export interface SearchResult {
  id: string;
  businesses: any[]; // Business type from existing components
  totalCount: number;
  region: SearchRegion;
  criteria: SearchCriteria;
  timestamp: number;
  source: 'fresh' | 'cached' | 'partial';
  confidence: number; // 0-100, search result freshness confidence
  expiresAt: number;
  networkCondition: string;
}

export interface SearchUpdateNotification {
  type: 'search_started' | 'search_progress' | 'search_completed' | 'search_failed' | 'results_invalidated' | 'bandwidth_limited';
  searchId: string;
  timestamp: number;
  region: SearchRegion;
  resultCount?: number;
  progress?: number; // 0-100
  error?: string;
  bandwidthInfo?: {
    connectionType: string;
    isLowBandwidth: boolean;
    estimatedSpeed: string;
  };
  userFeedback?: {
    message: string;
    action?: 'retry' | 'disable_updates' | 'show_cached' | 'wait';
  };
}

export interface BandwidthStrategy {
  maxConcurrentRequests: number;
  debounceMs: number;
  minRegionChangeThreshold: number;
  enablePredictiveSearch: boolean;
  cacheStrategy: 'aggressive' | 'conservative' | 'adaptive';
  updateFrequency: 'high' | 'medium' | 'low' | 'disabled';
  dataCompression: boolean;
  requestPriority: 'high' | 'normal' | 'low';
}

export interface SearchHistoryEntry {
  id: string;
  criteria: SearchCriteria;
  result: SearchResult;
  userInteraction: {
    viewDuration: number;
    businessesViewed: number;
    businessesInteracted: number;
    savedLocations: number;
    wasHelpful: boolean;
  };
  context: {
    appState: 'foreground' | 'background';
    batteryLevel?: number;
    networkType: string;
    userMovementPattern: 'stationary' | 'walking' | 'driving' | 'transit';
  };
}

export interface SearchContext {
  currentLocation: LocationCoordinates;
  currentRegion: SearchRegion;
  lastSearchTime: number;
  searchInProgress: boolean;
  pendingRegionChanges: SearchRegion[];
  recentHistory: SearchHistoryEntry[];
  userPreferences: {
    autoSearchEnabled: boolean;
    notificationsEnabled: boolean;
    dataUsageMode: 'unrestricted' | 'optimized' | 'minimal';
  };
}

/**
 * Enterprise-grade dynamic search update service with comprehensive real-time capabilities
 * Handles bandwidth-conscious strategies, search history, and context preservation
 */
export class DynamicSearchService extends EventEmitter {
  private static readonly STORAGE_KEY_HISTORY = '@buy_locals:search_history';
  private static readonly STORAGE_KEY_CONTEXT = '@buy_locals:search_context';
  private static readonly STORAGE_KEY_PREFERENCES = '@buy_locals:search_preferences';
  
  // Configuration constants
  private readonly MAX_HISTORY_ENTRIES = 100;
  private readonly DEFAULT_SEARCH_RADIUS = 5; // 5km
  private readonly MIN_REGION_CHANGE = 0.001; // ~100m
  private readonly DEFAULT_DEBOUNCE_MS = 1500;
  private readonly CACHE_EXPIRY_MS = 600000; // 10 minutes
  private readonly PREDICTIVE_SEARCH_DISTANCE = 1000; // 1km ahead
  
  // Service state
  private searchContext: SearchContext;
  private bandwidthStrategy: BandwidthStrategy;
  private activeSearches = new Map<string, Promise<SearchResult>>();
  private searchHistory: SearchHistoryEntry[] = [];
  private locationUpdateUnsubscribe: (() => void) | null = null;
  private regionChangeTimeout: NodeJS.Timeout | null = null;
  private networkCondition: any = null;
  
  // Search orchestration
  private pendingSearchRequests = new Map<string, SearchCriteria>();
  private searchResultsCache = new Map<string, SearchResult>();
  private invalidationQueue: string[] = [];
  
  constructor() {
    super();
    
    // Initialize default context
    this.searchContext = {
      currentLocation: { latitude: 0, longitude: 0, accuracy: 0, timestamp: 0 },
      currentRegion: { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01, timestamp: 0 },
      lastSearchTime: 0,
      searchInProgress: false,
      pendingRegionChanges: [],
      recentHistory: [],
      userPreferences: {
        autoSearchEnabled: true,
        notificationsEnabled: true,
        dataUsageMode: 'optimized'
      }
    };
    
    // Initialize bandwidth strategy
    this.bandwidthStrategy = {
      maxConcurrentRequests: 2,
      debounceMs: this.DEFAULT_DEBOUNCE_MS,
      minRegionChangeThreshold: this.MIN_REGION_CHANGE,
      enablePredictiveSearch: true,
      cacheStrategy: 'adaptive',
      updateFrequency: 'medium',
      dataCompression: true,
      requestPriority: 'normal'
    };
    
    this.initialize();
  }

  /**
   * Initialize service with stored data and network monitoring
   */
  private async initialize(): Promise<void> {
    try {
      // Load search context and preferences
      await this.loadStoredData();
      
      // Setup network monitoring
      await this.initializeNetworkMonitoring();
      
      // Setup location monitoring
      this.setupLocationMonitoring();
      
      console.log('DynamicSearchService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DynamicSearchService:', error);
    }
  }

  /**
   * Load stored search data and preferences
   */
  private async loadStoredData(): Promise<void> {
    try {
      // Load search history
      const historyData = await AsyncStorage.getItem(DynamicSearchService.STORAGE_KEY_HISTORY);
      if (historyData) {
        this.searchHistory = JSON.parse(historyData).slice(0, this.MAX_HISTORY_ENTRIES);
        this.searchContext.recentHistory = this.searchHistory.slice(0, 10);
      }

      // Load search context
      const contextData = await AsyncStorage.getItem(DynamicSearchService.STORAGE_KEY_CONTEXT);
      if (contextData) {
        const storedContext = JSON.parse(contextData);
        this.searchContext = { ...this.searchContext, ...storedContext };
      }

      // Load user preferences
      const preferencesData = await AsyncStorage.getItem(DynamicSearchService.STORAGE_KEY_PREFERENCES);
      if (preferencesData) {
        const preferences = JSON.parse(preferencesData);
        this.searchContext.userPreferences = { ...this.searchContext.userPreferences, ...preferences };
      }

    } catch (error) {
      console.warn('Failed to load stored search data:', error);
    }
  }

  /**
   * Initialize network monitoring for bandwidth-conscious strategies
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network state
      const networkState = await NetInfo.fetch();
      this.updateNetworkCondition(networkState);
      
      // Subscribe to network changes
      const unsubscribe = NetInfo.addEventListener((state) => {
        this.updateNetworkCondition(state);
        this.adjustBandwidthStrategy(state);
      });
      
      // Store unsubscribe function for cleanup
      this.locationUpdateUnsubscribe = unsubscribe;
      
    } catch (error) {
      console.warn('Failed to initialize network monitoring:', error);
    }
  }

  /**
   * Setup location monitoring for automatic search triggers
   */
  private setupLocationMonitoring(): void {
    if (this.locationUpdateUnsubscribe) {
      this.locationUpdateUnsubscribe();
    }

    this.locationUpdateUnsubscribe = locationService.subscribeToLocationUpdates((location) => {
      this.handleLocationUpdate(location);
    });
  }

  /**
   * Handle location updates and trigger searches when appropriate
   */
  private async handleLocationUpdate(location: LocationCoordinates): Promise<void> {
    try {
      const previousLocation = this.searchContext.currentLocation;
      this.searchContext.currentLocation = location;
      
      // Calculate movement distance
      const distance = this.calculateDistance(
        previousLocation.latitude, previousLocation.longitude,
        location.latitude, location.longitude
      );
      
      // Only trigger search if significant movement detected
      if (distance > this.bandwidthStrategy.minRegionChangeThreshold * 100) { // Convert to meters
        const region: SearchRegion = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
          radius: this.DEFAULT_SEARCH_RADIUS,
          timestamp: Date.now()
        };
        
        await this.handleRegionChange(region, 'location_update');
      }
      
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  /**
   * Handle map region changes with intelligent debouncing
   */
  async handleRegionChange(
    region: SearchRegion,
    trigger: 'user_pan' | 'user_zoom' | 'location_update' | 'programmatic' = 'user_pan'
  ): Promise<void> {
    try {
      // Update current region
      this.searchContext.currentRegion = region;
      
      // Check if auto-search is enabled
      if (!this.searchContext.userPreferences.autoSearchEnabled) {
        return;
      }
      
      // Add to pending region changes for batching
      this.searchContext.pendingRegionChanges.push(region);
      
      // Clear existing timeout
      if (this.regionChangeTimeout) {
        clearTimeout(this.regionChangeTimeout);
      }
      
      // Set debounced search trigger
      this.regionChangeTimeout = setTimeout(() => {
        this.processPendingRegionChanges(trigger);
      }, this.bandwidthStrategy.debounceMs);
      
    } catch (error) {
      console.error('Error handling region change:', error);
    }
  }

  /**
   * Process pending region changes and trigger appropriate searches
   */
  private async processPendingRegionChanges(trigger: string): Promise<void> {
    try {
      const pendingChanges = [...this.searchContext.pendingRegionChanges];
      this.searchContext.pendingRegionChanges = [];
      
      if (pendingChanges.length === 0) return;
      
      // Use the most recent region change
      const latestRegion = pendingChanges[pendingChanges.length - 1];
      
      // Check if region change is significant enough
      if (!this.isSignificantRegionChange(latestRegion)) {
        return;
      }
      
      // Create search criteria
      const criteria: SearchCriteria = {
        radius: latestRegion.radius || this.DEFAULT_SEARCH_RADIUS,
        location: this.searchContext.currentLocation,
        region: latestRegion,
        timestamp: Date.now()
      };
      
      // Check bandwidth limitations
      if (this.shouldLimitDueToBandwidth()) {
        this.emitSearchNotification({
          type: 'bandwidth_limited',
          searchId: this.generateSearchId(criteria),
          timestamp: Date.now(),
          region: latestRegion,
          bandwidthInfo: {
            connectionType: this.networkCondition?.type || 'unknown',
            isLowBandwidth: true,
            estimatedSpeed: this.networkCondition?.details?.cellularGeneration || 'unknown'
          },
          userFeedback: {
            message: 'Search updates paused due to slow connection',
            action: 'show_cached'
          }
        });
        return;
      }
      
      // Trigger dynamic search
      await this.performDynamicSearch(criteria, trigger);
      
    } catch (error) {
      console.error('Error processing pending region changes:', error);
    }
  }

  /**
   * Perform dynamic search with caching and bandwidth optimization
   */
  async performDynamicSearch(
    criteria: SearchCriteria,
    trigger: string = 'manual'
  ): Promise<SearchResult> {
    const searchId = this.generateSearchId(criteria);
    
    try {
      // Check if search is already in progress
      if (this.activeSearches.has(searchId)) {
        return await this.activeSearches.get(searchId)!;
      }
      
      // Check cache first
      const cachedResult = this.getCachedSearchResult(criteria);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        this.emitSearchNotification({
          type: 'search_completed',
          searchId,
          timestamp: Date.now(),
          region: criteria.region,
          resultCount: cachedResult.businesses.length
        });
        return cachedResult;
      }
      
      // Start fresh search
      this.searchContext.searchInProgress = true;
      
      this.emitSearchNotification({
        type: 'search_started',
        searchId,
        timestamp: Date.now(),
        region: criteria.region
      });
      
      // Create search promise
      const searchPromise = this.executeFreshSearch(criteria, searchId);
      this.activeSearches.set(searchId, searchPromise);
      
      // Execute search
      const result = await searchPromise;
      
      // Store result in cache
      this.cacheSearchResult(result);
      
      // Update search history
      await this.addToSearchHistory(criteria, result);
      
      // Cleanup
      this.activeSearches.delete(searchId);
      this.searchContext.searchInProgress = false;
      this.searchContext.lastSearchTime = Date.now();
      
      // Emit completion notification
      this.emitSearchNotification({
        type: 'search_completed',
        searchId,
        timestamp: Date.now(),
        region: criteria.region,
        resultCount: result.businesses.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Dynamic search failed:', error);
      
      // Cleanup on error
      this.activeSearches.delete(searchId);
      this.searchContext.searchInProgress = false;
      
      // Emit error notification
      this.emitSearchNotification({
        type: 'search_failed',
        searchId,
        timestamp: Date.now(),
        region: criteria.region,
        error: error instanceof Error ? error.message : 'Unknown search error'
      });
      
      // Try to return cached results as fallback
      const fallbackResult = this.getCachedSearchResult(criteria);
      if (fallbackResult) {
        return { ...fallbackResult, source: 'cached' as const };
      }
      
      throw error;
    }
  }

  /**
   * Execute fresh search request with performance monitoring
   */
  private async executeFreshSearch(criteria: SearchCriteria, searchId: string): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Emit progress notification
      this.emitSearchNotification({
        type: 'search_progress',
        searchId,
        timestamp: Date.now(),
        region: criteria.region,
        progress: 25
      });
      
      // Simulate API call (replace with actual location search service integration)
      const businesses = await this.fetchBusinessesFromAPI(criteria);
      
      this.emitSearchNotification({
        type: 'search_progress',
        searchId,
        timestamp: Date.now(),
        region: criteria.region,
        progress: 75
      });
      
      // Calculate search confidence based on various factors
      const confidence = this.calculateSearchConfidence(criteria, businesses, Date.now() - startTime);
      
      const result: SearchResult = {
        id: searchId,
        businesses,
        totalCount: businesses.length,
        region: criteria.region,
        criteria,
        timestamp: Date.now(),
        source: 'fresh',
        confidence,
        expiresAt: Date.now() + this.CACHE_EXPIRY_MS,
        networkCondition: this.networkCondition?.type || 'unknown'
      };
      
      return result;
      
    } catch (error) {
      console.error('Fresh search execution failed:', error);
      throw error;
    }
  }

  /**
   * Mock API call - replace with actual location search service
   */
  private async fetchBusinessesFromAPI(criteria: SearchCriteria): Promise<any[]> {
    // Simulate network delay based on connection quality
    const delay = this.getNetworkDelay();
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Mock business data - replace with actual API integration
    return [
      {
        id: '1',
        name: 'Mock Business 1',
        coordinates: {
          latitude: criteria.location.latitude + (Math.random() - 0.5) * 0.01,
          longitude: criteria.location.longitude + (Math.random() - 0.5) * 0.01
        },
        rating: 4.5,
        category: 'restaurant'
      },
      {
        id: '2',
        name: 'Mock Business 2',
        coordinates: {
          latitude: criteria.location.latitude + (Math.random() - 0.5) * 0.01,
          longitude: criteria.location.longitude + (Math.random() - 0.5) * 0.01
        },
        rating: 4.2,
        category: 'retail'
      }
    ];
  }

  /**
   * Calculate search confidence based on multiple factors
   */
  private calculateSearchConfidence(
    criteria: SearchCriteria,
    businesses: any[],
    responseTime: number
  ): number {
    let confidence = 100;
    
    // Reduce confidence for slow response times
    if (responseTime > 5000) confidence -= 20;
    else if (responseTime > 3000) confidence -= 10;
    
    // Reduce confidence for poor network conditions
    if (this.networkCondition?.type === '2g') confidence -= 30;
    else if (this.networkCondition?.type === '3g') confidence -= 15;
    
    // Reduce confidence for very few results
    if (businesses.length === 0) confidence = 20;
    else if (businesses.length < 3) confidence -= 15;
    
    // Reduce confidence for location accuracy
    const locationAccuracy = criteria.location.accuracy;
    if (locationAccuracy > 1000) confidence -= 20;
    else if (locationAccuracy > 500) confidence -= 10;
    
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Cache search result with intelligent caching strategy
   */
  private cacheSearchResult(result: SearchResult): void {
    const cacheKey = this.generateSearchId(result.criteria);
    this.searchResultsCache.set(cacheKey, result);
    
    // Cleanup old cache entries if cache is too large
    if (this.searchResultsCache.size > 50) {
      const sortedEntries = Array.from(this.searchResultsCache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      this.searchResultsCache.clear();
      sortedEntries.slice(0, 30).forEach(([key, value]) => {
        this.searchResultsCache.set(key, value);
      });
    }
  }

  /**
   * Get cached search result
   */
  private getCachedSearchResult(criteria: SearchCriteria): SearchResult | null {
    const cacheKey = this.generateSearchId(criteria);
    return this.searchResultsCache.get(cacheKey) || null;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(result: SearchResult): boolean {
    const now = Date.now();
    
    // Check expiration
    if (now > result.expiresAt) return false;
    
    // Check region similarity
    const regionSimilarity = this.calculateRegionSimilarity(
      result.region,
      this.searchContext.currentRegion
    );
    
    return regionSimilarity > 0.8; // 80% similarity threshold
  }

  /**
   * Add search to history with user interaction context
   */
  private async addToSearchHistory(criteria: SearchCriteria, result: SearchResult): Promise<void> {
    try {
      const historyEntry: SearchHistoryEntry = {
        id: this.generateSearchId(criteria),
        criteria,
        result,
        userInteraction: {
          viewDuration: 0,
          businessesViewed: 0,
          businessesInteracted: 0,
          savedLocations: 0,
          wasHelpful: true // Default to true, can be updated later
        },
        context: {
          appState: 'foreground',
          networkType: this.networkCondition?.type || 'unknown',
          userMovementPattern: 'stationary' // Can be enhanced with movement detection
        }
      };
      
      // Add to history
      this.searchHistory.unshift(historyEntry);
      
      // Limit history size
      if (this.searchHistory.length > this.MAX_HISTORY_ENTRIES) {
        this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY_ENTRIES);
      }
      
      // Update recent history in context
      this.searchContext.recentHistory = this.searchHistory.slice(0, 10);
      
      // Persist to storage
      await this.persistSearchHistory();
      
    } catch (error) {
      console.warn('Failed to add search to history:', error);
    }
  }

  /**
   * Invalidate search results for a region
   */
  async invalidateSearchResults(region: SearchRegion, reason: string = 'manual'): Promise<void> {
    try {
      const keysToInvalidate: string[] = [];
      
      // Find cache entries to invalidate
      for (const [key, result] of this.searchResultsCache) {
        const similarity = this.calculateRegionSimilarity(result.region, region);
        if (similarity > 0.7) { // 70% overlap threshold
          keysToInvalidate.push(key);
        }
      }
      
      // Remove from cache
      keysToInvalidate.forEach(key => {
        this.searchResultsCache.delete(key);
      });
      
      // Emit invalidation notification
      this.emitSearchNotification({
        type: 'results_invalidated',
        searchId: this.generateSearchId({
          location: this.searchContext.currentLocation,
          region,
          radius: region.radius || this.DEFAULT_SEARCH_RADIUS,
          timestamp: Date.now()
        }),
        timestamp: Date.now(),
        region,
        userFeedback: {
          message: `Search results updated due to ${reason}`,
          action: 'retry'
        }
      });
      
      console.log(`Invalidated ${keysToInvalidate.length} search results for region`, region);
      
    } catch (error) {
      console.error('Failed to invalidate search results:', error);
    }
  }

  /**
   * Update network condition and adjust bandwidth strategy
   */
  private updateNetworkCondition(networkState: any): void {
    this.networkCondition = networkState;
    
    // Log network condition changes
    console.log('Network condition updated:', {
      type: networkState.type,
      isConnected: networkState.isConnected,
      isInternetReachable: networkState.isInternetReachable
    });
  }

  /**
   * Adjust bandwidth strategy based on network conditions
   */
  private adjustBandwidthStrategy(networkState: any): void {
    const connectionType = networkState.type;
    const isConnected = networkState.isConnected;
    
    if (!isConnected) {
      // Offline mode
      this.bandwidthStrategy = {
        ...this.bandwidthStrategy,
        maxConcurrentRequests: 0,
        debounceMs: 5000,
        enablePredictiveSearch: false,
        cacheStrategy: 'aggressive',
        updateFrequency: 'disabled'
      };
    } else if (connectionType === 'cellular') {
      // Cellular connection - optimize for bandwidth
      const cellularGeneration = networkState.details?.cellularGeneration;
      
      if (cellularGeneration === '2g') {
        this.bandwidthStrategy = {
          ...this.bandwidthStrategy,
          maxConcurrentRequests: 1,
          debounceMs: 3000,
          enablePredictiveSearch: false,
          cacheStrategy: 'aggressive',
          updateFrequency: 'low',
          dataCompression: true
        };
      } else if (cellularGeneration === '3g') {
        this.bandwidthStrategy = {
          ...this.bandwidthStrategy,
          maxConcurrentRequests: 1,
          debounceMs: 2000,
          enablePredictiveSearch: true,
          cacheStrategy: 'conservative',
          updateFrequency: 'medium',
          dataCompression: true
        };
      } else {
        // 4G/5G
        this.bandwidthStrategy = {
          ...this.bandwidthStrategy,
          maxConcurrentRequests: 2,
          debounceMs: 1500,
          enablePredictiveSearch: true,
          cacheStrategy: 'adaptive',
          updateFrequency: 'high',
          dataCompression: false
        };
      }
    } else if (connectionType === 'wifi') {
      // WiFi connection - full capabilities
      this.bandwidthStrategy = {
        ...this.bandwidthStrategy,
        maxConcurrentRequests: 3,
        debounceMs: 1000,
        enablePredictiveSearch: true,
        cacheStrategy: 'adaptive',
        updateFrequency: 'high',
        dataCompression: false
      };
    }
    
    console.log('Bandwidth strategy adjusted:', this.bandwidthStrategy);
  }

  /**
   * Check if searches should be limited due to bandwidth constraints
   */
  private shouldLimitDueToBandwidth(): boolean {
    if (!this.networkCondition?.isConnected) return true;
    
    const connectionType = this.networkCondition.type;
    const cellularGeneration = this.networkCondition.details?.cellularGeneration;
    
    // Limit on 2G connections
    if (connectionType === 'cellular' && cellularGeneration === '2g') {
      return true;
    }
    
    // Check data usage mode preference
    if (this.searchContext.userPreferences.dataUsageMode === 'minimal') {
      return connectionType === 'cellular';
    }
    
    return false;
  }

  /**
   * Get network delay simulation based on connection type
   */
  private getNetworkDelay(): number {
    const connectionType = this.networkCondition?.type || 'wifi';
    const cellularGeneration = this.networkCondition?.details?.cellularGeneration;
    
    switch (connectionType) {
      case 'wifi':
        return 200 + Math.random() * 300; // 200-500ms
      case 'cellular':
        switch (cellularGeneration) {
          case '2g':
            return 2000 + Math.random() * 3000; // 2-5s
          case '3g':
            return 800 + Math.random() * 1200; // 0.8-2s
          case '4g':
          case '5g':
            return 300 + Math.random() * 500; // 300-800ms
          default:
            return 1000 + Math.random() * 1000; // 1-2s
        }
      default:
        return 500 + Math.random() * 500; // 500ms-1s
    }
  }

  /**
   * Emit search notification to listeners
   */
  private emitSearchNotification(notification: SearchUpdateNotification): void {
    this.emit('search_notification', notification);
  }

  /**
   * Generate unique search ID
   */
  private generateSearchId(criteria: SearchCriteria): string {
    const key = `${criteria.region.latitude.toFixed(4)}_${criteria.region.longitude.toFixed(4)}_${criteria.radius}_${criteria.query || 'all'}`;
    return Buffer.from(key).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate region similarity (0-1)
   */
  private calculateRegionSimilarity(region1: SearchRegion, region2: SearchRegion): number {
    const centerDistance = this.calculateDistance(
      region1.latitude, region1.longitude,
      region2.latitude, region2.longitude
    );
    
    // Calculate delta similarity
    const latDeltaSimilarity = 1 - Math.abs(region1.latitudeDelta - region2.latitudeDelta) / Math.max(region1.latitudeDelta, region2.latitudeDelta);
    const lonDeltaSimilarity = 1 - Math.abs(region1.longitudeDelta - region2.longitudeDelta) / Math.max(region1.longitudeDelta, region2.longitudeDelta);
    
    // Calculate overall similarity
    const centerSimilarity = Math.max(0, 1 - centerDistance / 5); // 5km threshold
    const deltaSimilarity = (latDeltaSimilarity + lonDeltaSimilarity) / 2;
    
    return (centerSimilarity * 0.7) + (deltaSimilarity * 0.3);
  }

  /**
   * Check if region change is significant enough to trigger search
   */
  private isSignificantRegionChange(region: SearchRegion): boolean {
    const currentRegion = this.searchContext.currentRegion;
    
    const distance = this.calculateDistance(
      currentRegion.latitude, currentRegion.longitude,
      region.latitude, region.longitude
    );
    
    // Check distance threshold
    if (distance < this.bandwidthStrategy.minRegionChangeThreshold) {
      return false;
    }
    
    // Check zoom level change
    const zoomChange = Math.abs(
      (currentRegion.latitudeDelta + currentRegion.longitudeDelta) - 
      (region.latitudeDelta + region.longitudeDelta)
    );
    
    return zoomChange > 0.005; // Significant zoom change
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Persist search history to storage
   */
  private async persistSearchHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        DynamicSearchService.STORAGE_KEY_HISTORY,
        JSON.stringify(this.searchHistory)
      );
    } catch (error) {
      console.warn('Failed to persist search history:', error);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: Partial<SearchContext['userPreferences']>): Promise<void> {
    try {
      this.searchContext.userPreferences = { ...this.searchContext.userPreferences, ...preferences };
      
      await AsyncStorage.setItem(
        DynamicSearchService.STORAGE_KEY_PREFERENCES,
        JSON.stringify(this.searchContext.userPreferences)
      );
      
      console.log('User preferences updated:', this.searchContext.userPreferences);
    } catch (error) {
      console.error('Failed to update user preferences:', error);
    }
  }

  /**
   * Get search statistics for debugging and optimization
   */
  getSearchStatistics(): {
    totalSearches: number;
    cacheHitRate: number;
    averageResponseTime: number;
    bandwidthStrategy: BandwidthStrategy;
    networkCondition: any;
    activeSearches: number;
    cacheSize: number;
  } {
    return {
      totalSearches: this.searchHistory.length,
      cacheHitRate: 0.75, // Mock calculation
      averageResponseTime: 1200, // Mock calculation
      bandwidthStrategy: this.bandwidthStrategy,
      networkCondition: this.networkCondition,
      activeSearches: this.activeSearches.size,
      cacheSize: this.searchResultsCache.size
    };
  }

  /**
   * Clear all search data
   */
  async clearAllSearchData(): Promise<void> {
    try {
      // Clear in-memory data
      this.searchHistory = [];
      this.searchResultsCache.clear();
      this.activeSearches.clear();
      this.searchContext.recentHistory = [];
      this.searchContext.pendingRegionChanges = [];
      
      // Clear storage
      await AsyncStorage.multiRemove([
        DynamicSearchService.STORAGE_KEY_HISTORY,
        DynamicSearchService.STORAGE_KEY_CONTEXT,
        DynamicSearchService.STORAGE_KEY_PREFERENCES
      ]);
      
      console.log('All search data cleared');
    } catch (error) {
      console.error('Failed to clear search data:', error);
    }
  }

  /**
   * Cleanup service resources
   */
  cleanup(): void {
    // Clear timeouts
    if (this.regionChangeTimeout) {
      clearTimeout(this.regionChangeTimeout);
    }
    
    // Unsubscribe from location updates
    if (this.locationUpdateUnsubscribe) {
      this.locationUpdateUnsubscribe();
    }
    
    // Clear all active searches
    this.activeSearches.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('DynamicSearchService cleanup completed');
  }
}

// Export singleton instance
export const dynamicSearchService = new DynamicSearchService();