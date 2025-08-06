import { locationService, LocationCoordinates } from './locationService';
import { searchPerformanceService, SearchQuery, SEARCH_PERFORMANCE_CONFIG } from './searchPerformanceService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BusinessSearchResult {
  id: string;
  name: string;
  category: string[];
  location: {
    lat: number;
    lng: number;
  };
  distance: number;
  rating: number;
  reviewCount: number;
  isOpen?: boolean;
  status?: string;
  nextChange?: Date | null;
  priceRange?: [number, number];
  amenities?: string[];
  phone?: string;
  website?: string;
  description?: string;
  images?: string[];
  hours?: any;
  timezone?: string;
}

export interface SearchFilters {
  category?: string[];
  search?: string;
  priceRange?: [number, number];
  rating?: number;
  amenities?: string[];
  isOpen?: boolean;
  openNow?: boolean; // Alias for isOpen for consistency with backend
  sortBy?: 'distance' | 'rating' | 'newest' | 'popular';
}

export interface SearchOptions {
  useProgressiveLoading?: boolean;
  enableDebouncing?: boolean;
  fallbackToCache?: boolean;
  preloadCommonAreas?: boolean;
  maxResults?: number;
  timeoutMs?: number;
}

export interface SearchResponse {
  businesses: BusinessSearchResult[];
  totalCount: number;
  searchRadius: number;
  searchCenter: { lat: number; lng: number };
  executionTime: number;
  cacheHit: boolean;
  isPartial?: boolean;
  isOffline?: boolean;
  performanceMetrics?: any;
}

class EnhancedLocationSearchService {
  private readonly API_BASE_URL = process.env.REACT_NATIVE_API_URL || 'http://localhost:3001/api';
  private readonly DEFAULT_RADIUS = 25; // km
  private readonly DEFAULT_LIMIT = 20;
  
  // Performance tracking
  private searchMetrics = {
    totalSearches: 0,
    cacheHits: 0,
    averageLatency: 0,
    sub1SecondSearches: 0,
  };

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Load performance metrics from storage
      const metrics = await AsyncStorage.getItem('@buy_locals:search_metrics');
      if (metrics) {
        this.searchMetrics = { ...this.searchMetrics, ...JSON.parse(metrics) };
      }
    } catch (error) {
      console.warn('Enhanced search service initialization failed:', error);
    }
  }

  /**
   * Main search method with comprehensive performance optimization
   */
  async searchBusinesses(
    location?: LocationCoordinates,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      // Get current location if not provided
      const searchLocation = location || await locationService.getCurrentLocation();
      
      // Build search query
      const query: SearchQuery = {
        lat: searchLocation.latitude,
        lng: searchLocation.longitude,
        radius: this.DEFAULT_RADIUS,
        category: filters.category,
        search: filters.search,
        page: 1,
        limit: options.maxResults || this.DEFAULT_LIMIT,
        sortBy: filters.sortBy || 'distance',
        filters: {
          openNow: filters.openNow || filters.isOpen,
          priceRange: filters.priceRange,
          minimumRating: filters.rating,
        }
      };

      // Update preload area tracking
      searchPerformanceService.updatePreloadArea(
        query.lat, 
        query.lng, 
        query.radius,
        this.calculateSearchPriority(filters)
      );

      // Choose search strategy based on options
      let searchResult: SearchResponse;

      if (options.useProgressiveLoading) {
        searchResult = await this.progressiveSearch(query, options);
      } else if (options.enableDebouncing) {
        searchResult = await this.debouncedSearch(query, options);
      } else {
        searchResult = await this.standardSearch(query, options);
      }

      // Update performance metrics
      this.updateSearchMetrics(searchResult, Date.now() - startTime);
      
      // Trigger preloading for common areas (background task)
      if (options.preloadCommonAreas) {
        this.triggerBackgroundPreloading(searchResult.searchCenter);
      }

      return searchResult;

    } catch (error) {
      console.error('Enhanced search error:', error);
      
      // Try fallback strategies
      if (options.fallbackToCache && location) {
        const fallbackResult = await this.handleSearchFallback(location, filters, startTime);
        if (fallbackResult) {
          return fallbackResult;
        }
      }
      
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Progressive search: nearby first, then expand radius
   */
  private async progressiveSearch(query: SearchQuery, options: SearchOptions): Promise<SearchResponse> {
    console.log('Starting progressive search');
    
    return searchPerformanceService.progressiveSearch(
      query,
      (searchQuery: SearchQuery) => this.executeAPISearch(searchQuery),
      (partialResults, radius) => {
        console.log(`Progressive results: ${partialResults.businesses?.length || 0} businesses within ${radius}km`);
      }
    ) as Promise<SearchResponse>;
  }

  /**
   * Debounced search to reduce API calls
   */
  private async debouncedSearch(query: SearchQuery, options: SearchOptions): Promise<SearchResponse> {
    console.log('Starting debounced search');
    
    return searchPerformanceService.debouncedSearch(
      query,
      (searchQuery: SearchQuery) => this.executeAPISearch(searchQuery),
      {
        priority: options.timeoutMs && options.timeoutMs < 1000 ? 'high' : 'normal',
        aggressiveTyping: query.search && query.search.length > 0,
      }
    ) as Promise<SearchResponse>;
  }

  /**
   * Standard optimized search with caching
   */
  private async standardSearch(query: SearchQuery, options: SearchOptions): Promise<SearchResponse> {
    console.log('Starting standard optimized search');
    
    return searchPerformanceService.debouncedSearch(
      query,
      (searchQuery: SearchQuery) => this.executeAPISearch(searchQuery),
      { immediate: true }
    ) as Promise<SearchResponse>;
  }

  /**
   * Execute actual API search with performance tracking
   * Handles both regular search and "Open Now" filter integration
   */
  private async executeAPISearch(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      // Determine endpoint based on filters
      const isOpenNowFilter = query.filters?.openNow === true;
      const endpoint = isOpenNowFilter 
        ? '/businesses/open' 
        : '/businesses/search/location';

      // Build API request parameters
      const searchParams = new URLSearchParams({
        lat: query.lat.toString(),
        lng: query.lng.toString(),
        radius: (query.radius || this.DEFAULT_RADIUS).toString(),
        limit: (query.limit || this.DEFAULT_LIMIT).toString(),
        page: (query.page || 1).toString(),
        sortBy: query.sortBy || 'distance',
      });

      if (query.category && query.category.length > 0) {
        searchParams.append('categories', query.category.join(','));
      }

      if (query.search) {
        searchParams.append('search', query.search);
      }

      // Add additional filters for open businesses endpoint
      if (isOpenNowFilter && query.filters) {
        if (query.filters.priceRange) {
          searchParams.append('priceMin', query.filters.priceRange[0].toString());
          searchParams.append('priceMax', query.filters.priceRange[1].toString());
        }
        if (query.filters.minimumRating) {
          searchParams.append('rating', query.filters.minimumRating.toString());
        }
      }

      // Execute API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(), 
        SEARCH_PERFORMANCE_CONFIG.SLOW_NETWORK_THRESHOLD
      );

      console.log(`Making ${isOpenNowFilter ? 'Open Now' : 'Location'} search request to: ${this.API_BASE_URL}${endpoint}`);

      const response = await fetch(
        `${this.API_BASE_URL}${endpoint}?${searchParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const executionTime = Date.now() - startTime;

      // Transform API response to our format
      const businessResults = data.businesses || data.data?.businesses || [];
      const searchResult: SearchResponse = {
        businesses: this.transformBusinessResults(businessResults),
        totalCount: data.totalCount || data.data?.totalCount || businessResults.length,
        searchRadius: query.radius || this.DEFAULT_RADIUS,
        searchCenter: { lat: query.lat, lng: query.lng },
        executionTime,
        cacheHit: false,
        performanceMetrics: {
          apiLatency: executionTime,
          resultsCount: businessResults.length,
          searchComplexity: this.getSearchComplexity(query),
          endpoint: endpoint,
          isOpenNowSearch: isOpenNowFilter,
        },
      };

      console.log(`${isOpenNowFilter ? 'Open Now' : 'Location'} search completed: ${searchResult.businesses.length} results in ${executionTime}ms`);
      return searchResult;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Search request timed out');
      }
      
      console.error('API search error:', error);
      throw error;
    }
  }

  /**
   * Transform API business results to our format
   * Handles both regular and "Open Now" endpoint responses
   */
  private transformBusinessResults(apiResults: any[]): BusinessSearchResult[] {
    return apiResults.map(business => ({
      id: business.id,
      name: business.name,
      category: business.categories || business.category || [],
      location: {
        lat: business.location?.coordinates?.lat || business.location?.lat || business.lat,
        lng: business.location?.coordinates?.lng || business.location?.lng || business.lng,
      },
      distance: parseFloat(business.distance_km || business.distance || 0),
      rating: parseFloat(business.rating || business.avg_rating || 0),
      reviewCount: parseInt(business.review_count || business.reviewCount || 0),
      // Enhanced hours status from business hours service
      isOpen: business.is_open !== undefined ? business.is_open : (business.isCurrentlyOpen || business.isOpen),
      status: business.status || (business.is_open ? 'open' : 'closed'),
      nextChange: business.next_change ? new Date(business.next_change) : null,
      priceRange: business.price_range || business.priceRange,
      amenities: business.amenities || [],
      phone: business.phone || business.contact?.phone,
      website: business.website || business.contact?.website,
      hours: business.hours || {},
      timezone: business.timezone,
      description: business.description,
      images: business.images || [],
    }));
  }

  /**
   * Handle search fallback strategies
   */
  private async handleSearchFallback(
    location: LocationCoordinates, 
    filters: SearchFilters,
    startTime: number
  ): Promise<SearchResponse | null> {
    console.log('Attempting search fallback strategies');
    
    try {
      // Strategy 1: Try cached results from performance service
      const analytics = searchPerformanceService.getPerformanceAnalytics();
      if (analytics.recentMetrics.length > 0) {
        // Get most recent cached result that matches location
        // This would be implemented by the performance service
        console.log('Attempting to use performance service cache');
      }

      // Strategy 2: Try offline cached results
      const offlineResults = await this.getOfflineFallbackResults(location, filters);
      if (offlineResults && offlineResults.length > 0) {
        console.log(`Found ${offlineResults.length} offline fallback results`);
        
        return {
          businesses: offlineResults,
          totalCount: offlineResults.length,
          searchRadius: this.DEFAULT_RADIUS,
          searchCenter: { lat: location.latitude, lng: location.longitude },
          executionTime: Date.now() - startTime,
          cacheHit: true,
          isOffline: true,
        };
      }

      // Strategy 3: Return empty results with helpful message
      return {
        businesses: [],
        totalCount: 0,
        searchRadius: this.DEFAULT_RADIUS,
        searchCenter: { lat: location.latitude, lng: location.longitude },
        executionTime: Date.now() - startTime,
        cacheHit: false,
        isOffline: true,
      };

    } catch (error) {
      console.error('Fallback strategies failed:', error);
      return null;
    }
  }

  /**
   * Get offline cached results for fallback
   */
  private async getOfflineFallbackResults(
    location: LocationCoordinates,
    filters: SearchFilters
  ): Promise<BusinessSearchResult[]> {
    try {
      const offlineData = await AsyncStorage.getItem('@buy_locals:offline_businesses');
      if (!offlineData) return [];

      const cachedBusinesses: BusinessSearchResult[] = JSON.parse(offlineData);
      
      // Filter businesses within reasonable distance (10km for offline)
      const nearbyBusinesses = cachedBusinesses.filter(business => {
        const distance = this.calculateDistance(
          location.latitude, location.longitude,
          business.location.lat, business.location.lng
        );
        
        return distance <= 10; // 10km radius for offline results
      });

      // Apply filters
      let filteredResults = nearbyBusinesses;

      if (filters.category && filters.category.length > 0) {
        filteredResults = filteredResults.filter(business =>
          business.category.some(cat => filters.category!.includes(cat))
        );
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredResults = filteredResults.filter(business =>
          business.name.toLowerCase().includes(searchTerm) ||
          business.description?.toLowerCase().includes(searchTerm)
        );
      }

      if (filters.rating) {
        filteredResults = filteredResults.filter(business =>
          business.rating >= filters.rating!
        );
      }

      if (filters.isOpen) {
        filteredResults = filteredResults.filter(business => business.isOpen);
      }

      // Sort by distance
      filteredResults.sort((a, b) => a.distance - b.distance);

      // Limit results
      return filteredResults.slice(0, this.DEFAULT_LIMIT);

    } catch (error) {
      console.warn('Offline fallback error:', error);
      return [];
    }
  }

  /**
   * Cache business results for offline use
   */
  async cacheBusinessesForOffline(businesses: BusinessSearchResult[]): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('@buy_locals:offline_businesses');
      const existingBusinesses: BusinessSearchResult[] = existing ? JSON.parse(existing) : [];
      
      // Merge with existing, avoiding duplicates
      const mergedBusinesses = [...existingBusinesses];
      
      businesses.forEach(newBusiness => {
        const existingIndex = mergedBusinesses.findIndex(b => b.id === newBusiness.id);
        if (existingIndex >= 0) {
          // Update existing
          mergedBusinesses[existingIndex] = newBusiness;
        } else {
          // Add new
          mergedBusinesses.push(newBusiness);
        }
      });

      // Limit cache size to prevent storage bloat
      const limitedBusinesses = mergedBusinesses
        .sort((a, b) => b.rating - a.rating) // Keep higher rated businesses
        .slice(0, 1000); // Max 1000 cached businesses

      await AsyncStorage.setItem('@buy_locals:offline_businesses', JSON.stringify(limitedBusinesses));
      console.log(`Cached ${businesses.length} businesses for offline use`);

    } catch (error) {
      console.warn('Offline caching error:', error);
    }
  }

  /**
   * Trigger background preloading for common areas
   */
  private async triggerBackgroundPreloading(searchCenter: { lat: number; lng: number }): Promise<void> {
    try {
      // This would run in background to preload nearby high-traffic areas
      console.log(`Triggering background preloading for area: ${searchCenter.lat}, ${searchCenter.lng}`);
      
      // Identify nearby high-traffic areas
      const commonAreas = await this.identifyCommonAreas(searchCenter);
      
      // Preload up to 3 areas
      for (const area of commonAreas.slice(0, 3)) {
        setTimeout(async () => {
          try {
            await this.preloadArea(area);
          } catch (error) {
            console.warn('Background preload error:', error);
          }
        }, Math.random() * 5000); // Stagger preloading
      }

    } catch (error) {
      console.warn('Background preloading trigger error:', error);
    }
  }

  /**
   * Identify common/popular areas for preloading
   */
  private async identifyCommonAreas(center: { lat: number; lng: number }): Promise<Array<{ lat: number; lng: number; radius: number }>> {
    // This would typically use analytics data to identify popular areas
    // For now, we'll simulate with nearby grid points
    const areas = [];
    const gridSize = 0.05; // ~5km grid
    
    for (let latOffset = -gridSize; latOffset <= gridSize; latOffset += gridSize) {
      for (let lngOffset = -gridSize; lngOffset <= gridSize; lngOffset += gridSize) {
        if (latOffset === 0 && lngOffset === 0) continue; // Skip center
        
        areas.push({
          lat: center.lat + latOffset,
          lng: center.lng + lngOffset,
          radius: 15,
        });
      }
    }
    
    return areas;
  }

  /**
   * Preload a specific area
   */
  private async preloadArea(area: { lat: number; lng: number; radius: number }): Promise<void> {
    try {
      const query: SearchQuery = {
        lat: area.lat,
        lng: area.lng,
        radius: area.radius,
        limit: 15, // Reasonable preload size
      };

      console.log(`Preloading area: ${area.lat}, ${area.lng}`);
      
      // Execute search through performance service to benefit from caching
      const result = await searchPerformanceService.debouncedSearch(
        query,
        (searchQuery: SearchQuery) => this.executeAPISearch(searchQuery),
        { immediate: true }
      );

      // Cache for offline use if results are good
      if (result && result.businesses && result.businesses.length > 0) {
        await this.cacheBusinessesForOffline(result.businesses);
        console.log(`Preloaded ${result.businesses.length} businesses for area`);
      }

    } catch (error) {
      console.warn('Area preload failed:', error);
    }
  }

  /**
   * Search for businesses in a specific category
   */
  async searchByCategory(
    category: string,
    location?: LocationCoordinates,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    return this.searchBusinesses(
      location,
      { category: [category] },
      { ...options, enableDebouncing: false } // Category searches don't need debouncing
    );
  }

  /**
   * Search for businesses by text query
   */
  async searchByText(
    searchText: string,
    location?: LocationCoordinates,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    return this.searchBusinesses(
      location,
      { search: searchText },
      { ...options, enableDebouncing: true } // Text searches benefit from debouncing
    );
  }

  /**
   * Get nearby businesses (simple distance-based search)
   */
  async getNearbyBusinesses(
    location?: LocationCoordinates,
    radius: number = 10,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const searchLocation = location || await locationService.getCurrentLocation();
    
    const query: SearchQuery = {
      lat: searchLocation.latitude,
      lng: searchLocation.longitude,
      radius,
      limit: options.maxResults || this.DEFAULT_LIMIT,
      sortBy: 'distance',
    };

    return searchPerformanceService.debouncedSearch(
      query,
      (searchQuery: SearchQuery) => this.executeAPISearch(searchQuery),
      { immediate: true }
    ) as Promise<SearchResponse>;
  }

  /**
   * Get search suggestions based on current location and search history
   */
  async getSearchSuggestions(location?: LocationCoordinates): Promise<{
    categories: string[];
    popularSearches: string[];
    nearbyLandmarks: string[];
  }> {
    try {
      const searchLocation = location || await locationService.getCurrentLocation();
      
      // This would typically call an API endpoint for suggestions
      const response = await fetch(
        `${this.API_BASE_URL}/businesses/suggestions?lat=${searchLocation.latitude}&lng=${searchLocation.longitude}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        return await response.json();
      }

      // Fallback to cached suggestions
      return this.getCachedSuggestions();

    } catch (error) {
      console.warn('Search suggestions error:', error);
      return this.getCachedSuggestions();
    }
  }

  /**
   * Get cached search suggestions
   */
  private getCachedSuggestions(): { categories: string[]; popularSearches: string[]; nearbyLandmarks: string[] } {
    return {
      categories: ['Restaurant', 'Coffee Shop', 'Gas Station', 'Grocery Store', 'Pharmacy', 'Bank'],
      popularSearches: ['coffee', 'food', 'gas', 'groceries', 'pharmacy', 'atm'],
      nearbyLandmarks: [],
    };
  }

  /**
   * Get search performance analytics
   */
  getSearchPerformance(): {
    totalSearches: number;
    cacheHitRate: number;
    averageLatency: number;
    sub1SecondRate: number;
    performanceService: ReturnType<typeof searchPerformanceService.getPerformanceAnalytics>;
  } {
    const performanceServiceAnalytics = searchPerformanceService.getPerformanceAnalytics();
    
    return {
      totalSearches: this.searchMetrics.totalSearches,
      cacheHitRate: this.searchMetrics.totalSearches > 0 
        ? (this.searchMetrics.cacheHits / this.searchMetrics.totalSearches) * 100 
        : 0,
      averageLatency: this.searchMetrics.averageLatency,
      sub1SecondRate: this.searchMetrics.totalSearches > 0
        ? (this.searchMetrics.sub1SecondSearches / this.searchMetrics.totalSearches) * 100
        : 0,
      performanceService: performanceServiceAnalytics,
    };
  }

  /**
   * Clear all search caches
   */
  async clearSearchCache(): Promise<void> {
    await Promise.all([
      searchPerformanceService.clearAllCaches(),
      AsyncStorage.removeItem('@buy_locals:offline_businesses'),
      AsyncStorage.removeItem('@buy_locals:search_metrics'),
    ]);
    
    // Reset metrics
    this.searchMetrics = {
      totalSearches: 0,
      cacheHits: 0,
      averageLatency: 0,
      sub1SecondSearches: 0,
    };
    
    console.log('All search caches cleared');
  }

  /**
   * Utility methods
   */
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

  private calculateSearchPriority(filters: SearchFilters): number {
    let priority = 5; // Base priority
    
    if (filters.category && filters.category.length > 0) priority += 1;
    if (filters.search && filters.search.length > 0) priority += 2;
    if (filters.isOpen) priority += 1;
    if (filters.rating && filters.rating > 4) priority += 1;
    
    return Math.min(10, priority);
  }

  private getSearchComplexity(query: SearchQuery): 'simple' | 'medium' | 'complex' {
    let complexity = 0;
    
    if (query.search) complexity += 2;
    if (query.category && query.category.length > 0) complexity += 1;
    if (query.radius && query.radius > 50) complexity += 1;
    if (query.sortBy && query.sortBy !== 'distance') complexity += 1;
    
    if (complexity <= 1) return 'simple';
    if (complexity <= 3) return 'medium';
    return 'complex';
  }

  private updateSearchMetrics(result: SearchResponse, executionTime: number): void {
    this.searchMetrics.totalSearches += 1;
    
    if (result.cacheHit) {
      this.searchMetrics.cacheHits += 1;
    }
    
    // Update average latency (weighted)
    this.searchMetrics.averageLatency = 
      (this.searchMetrics.averageLatency * 0.8) + (executionTime * 0.2);
    
    if (executionTime < 1000) {
      this.searchMetrics.sub1SecondSearches += 1;
    }

    // Persist metrics periodically
    if (this.searchMetrics.totalSearches % 10 === 0) {
      this.persistSearchMetrics();
    }
  }

  private async persistSearchMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem('@buy_locals:search_metrics', JSON.stringify(this.searchMetrics));
    } catch (error) {
      console.warn('Search metrics persistence error:', error);
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    console.log('Cleaning up EnhancedLocationSearchService');
    searchPerformanceService.cleanup();
    console.log('EnhancedLocationSearchService cleanup completed');
  }
}

export const enhancedLocationSearchService = new EnhancedLocationSearchService();