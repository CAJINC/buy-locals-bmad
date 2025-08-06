import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';
import { LocationCoordinates } from './locationService';

// Types for search history and context preservation
export interface SearchHistoryEntry {
  id: string;
  timestamp: number;
  query?: string;
  location: LocationCoordinates;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
    radius?: number;
  };
  results: {
    count: number;
    businesses: any[];
    source: 'fresh' | 'cached' | 'partial';
    responseTime: number;
    confidence: number;
  };
  userInteraction: {
    viewDuration: number;
    businessesViewed: string[];
    businessesInteracted: string[];
    businessesSaved: string[];
    wasHelpful: boolean;
    rating?: number; // 1-5 user rating of search quality
    feedback?: string;
  };
  context: {
    appState: 'foreground' | 'background';
    networkType: string;
    batteryLevel?: number;
    movementPattern: 'stationary' | 'walking' | 'driving' | 'transit';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
    weatherCondition?: string;
  };
  sessionInfo: {
    sessionId: string;
    searchSequence: number;
    isRepeatSearch: boolean;
    previousSearchId?: string;
  };
}

export interface SearchPattern {
  id: string;
  type: 'location' | 'query' | 'category' | 'time' | 'mixed';
  pattern: {
    commonLocations: LocationCoordinates[];
    commonQueries: string[];
    commonCategories: string[];
    commonTimes: string[];
    frequency: number;
  };
  confidence: number;
  lastUsed: number;
  predictiveValue: number; // How likely this pattern predicts future searches
}

export interface SearchContext {
  currentSession: {
    sessionId: string;
    startTime: number;
    searchCount: number;
    lastSearchTime: number;
    currentLocation: LocationCoordinates;
    userMovementPattern: string;
  };
  recentHistory: SearchHistoryEntry[];
  personalizedPatterns: SearchPattern[];
  userPreferences: {
    defaultRadius: number;
    preferredCategories: string[];
    notificationSettings: {
      enabled: boolean;
      types: string[];
      frequency: 'all' | 'important' | 'minimal';
    };
    privacySettings: {
      saveHistory: boolean;
      shareAnonymizedData: boolean;
      retentionPeriod: number; // days
    };
  };
  performanceMetrics: {
    averageSearchTime: number;
    cacheHitRate: number;
    userSatisfactionScore: number;
    mostUsedFeatures: string[];
  };
}

export interface SearchRecommendation {
  id: string;
  type: 'location' | 'query' | 'category' | 'refinement';
  title: string;
  description: string;
  confidence: number;
  relevanceScore: number;
  basedOn: {
    patterns: string[];
    recentHistory: boolean;
    locationContext: boolean;
    timeContext: boolean;
  };
  action: {
    type: 'search' | 'navigate' | 'filter';
    payload: any;
  };
}

export interface ContextSnapshot {
  timestamp: number;
  location: LocationCoordinates;
  searchState: {
    activeQuery?: string;
    activeFilters: any;
    currentRegion: any;
    resultCount: number;
  };
  userState: {
    interactionMode: 'browsing' | 'searching' | 'exploring';
    sessionDuration: number;
    recentActions: string[];
  };
  environmentalContext: {
    networkCondition: string;
    batteryLevel?: number;
    timeContext: string;
    movementPattern: string;
  };
}

/**
 * Enterprise-grade search history and context preservation service
 * Provides intelligent recommendations, pattern learning, and context management
 */
export class SearchHistoryService extends EventEmitter {
  private static readonly STORAGE_KEY_HISTORY = '@buy_locals:search_history_v2';
  private static readonly STORAGE_KEY_CONTEXT = '@buy_locals:search_context_v2';
  private static readonly STORAGE_KEY_PATTERNS = '@buy_locals:search_patterns_v2';
  private static readonly STORAGE_KEY_SNAPSHOTS = '@buy_locals:context_snapshots_v2';
  
  // Configuration constants
  private readonly MAX_HISTORY_ENTRIES = 500;
  private readonly MAX_CONTEXT_SNAPSHOTS = 100;
  private readonly PATTERN_LEARNING_THRESHOLD = 5; // Minimum searches to form pattern
  private readonly CONTEXT_SNAPSHOT_INTERVAL = 30000; // 30 seconds
  private readonly HISTORY_CLEANUP_INTERVAL = 86400000; // 24 hours
  
  // Service state
  private searchHistory: SearchHistoryEntry[] = [];
  private searchContext: SearchContext;
  private searchPatterns: SearchPattern[] = [];
  private contextSnapshots: ContextSnapshot[] = [];
  private currentSessionId: string = '';
  private contextSnapshotTimer: NodeJS.Timeout | null = null;
  private historyCleanupTimer: NodeJS.Timeout | null = null;
  private lastInteractionTime: number = 0;

  constructor() {
    super();
    
    // Initialize search context
    this.searchContext = {
      currentSession: {
        sessionId: this.generateSessionId(),
        startTime: Date.now(),
        searchCount: 0,
        lastSearchTime: 0,
        currentLocation: { latitude: 0, longitude: 0, accuracy: 0, timestamp: 0 },
        userMovementPattern: 'stationary'
      },
      recentHistory: [],
      personalizedPatterns: [],
      userPreferences: {
        defaultRadius: 5,
        preferredCategories: [],
        notificationSettings: {
          enabled: true,
          types: ['search_completed', 'recommendations', 'patterns'],
          frequency: 'important'
        },
        privacySettings: {
          saveHistory: true,
          shareAnonymizedData: false,
          retentionPeriod: 90
        }
      },
      performanceMetrics: {
        averageSearchTime: 1200,
        cacheHitRate: 0.75,
        userSatisfactionScore: 4.2,
        mostUsedFeatures: ['location_search', 'category_filter', 'radius_adjustment']
      }
    };
    
    this.currentSessionId = this.searchContext.currentSession.sessionId;
    this.initialize();
  }

  /**
   * Initialize service with stored data and timers
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadStoredData();
      this.startContextSnapshots();
      this.startHistoryCleanup();
      
      console.log('SearchHistoryService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SearchHistoryService:', error);
    }
  }

  /**
   * Load stored history and context data
   */
  private async loadStoredData(): Promise<void> {
    try {
      // Load search history
      const historyData = await AsyncStorage.getItem(SearchHistoryService.STORAGE_KEY_HISTORY);
      if (historyData) {
        this.searchHistory = JSON.parse(historyData);
        this.searchContext.recentHistory = this.searchHistory.slice(0, 50);
      }

      // Load search context
      const contextData = await AsyncStorage.getItem(SearchHistoryService.STORAGE_KEY_CONTEXT);
      if (contextData) {
        const storedContext = JSON.parse(contextData);
        this.searchContext = { ...this.searchContext, ...storedContext };
        // Generate new session ID on app restart
        this.searchContext.currentSession.sessionId = this.generateSessionId();
        this.searchContext.currentSession.startTime = Date.now();
      }

      // Load search patterns
      const patternsData = await AsyncStorage.getItem(SearchHistoryService.STORAGE_KEY_PATTERNS);
      if (patternsData) {
        this.searchPatterns = JSON.parse(patternsData);
        this.searchContext.personalizedPatterns = this.searchPatterns;
      }

      // Load context snapshots
      const snapshotsData = await AsyncStorage.getItem(SearchHistoryService.STORAGE_KEY_SNAPSHOTS);
      if (snapshotsData) {
        this.contextSnapshots = JSON.parse(snapshotsData);
      }

    } catch (error) {
      console.warn('Failed to load stored search data:', error);
    }
  }

  /**
   * Add search entry to history with comprehensive context
   */
  async addSearchEntry(
    query: string | undefined,
    location: LocationCoordinates,
    region: any,
    results: any,
    additionalContext?: Partial<SearchHistoryEntry['context']>
  ): Promise<string> {
    try {
      const searchId = this.generateSearchId();
      const timestamp = Date.now();
      
      // Determine if this is a repeat search
      const isRepeatSearch = this.isRepeatSearch(query, location);
      const previousSearchId = isRepeatSearch ? this.findPreviousSearchId(query, location) : undefined;
      
      const entry: SearchHistoryEntry = {
        id: searchId,
        timestamp,
        query,
        location,
        region,
        results: {
          count: results.businesses?.length || 0,
          businesses: results.businesses || [],
          source: results.source || 'fresh',
          responseTime: results.responseTime || 0,
          confidence: results.confidence || 100
        },
        userInteraction: {
          viewDuration: 0,
          businessesViewed: [],
          businessesInteracted: [],
          businessesSaved: [],
          wasHelpful: true // Default to true, updated by user feedback
        },
        context: {
          appState: 'foreground',
          networkType: 'unknown',
          movementPattern: this.searchContext.currentSession.userMovementPattern,
          timeOfDay: this.getTimeOfDay(),
          dayOfWeek: this.getDayOfWeek(),
          ...additionalContext
        },
        sessionInfo: {
          sessionId: this.currentSessionId,
          searchSequence: this.searchContext.currentSession.searchCount + 1,
          isRepeatSearch,
          previousSearchId
        }
      };
      
      // Add to history
      this.searchHistory.unshift(entry);
      
      // Limit history size
      if (this.searchHistory.length > this.MAX_HISTORY_ENTRIES) {
        this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY_ENTRIES);
      }
      
      // Update context
      this.searchContext.recentHistory = this.searchHistory.slice(0, 50);
      this.searchContext.currentSession.searchCount++;
      this.searchContext.currentSession.lastSearchTime = timestamp;
      
      // Update performance metrics
      this.updatePerformanceMetrics(entry);
      
      // Learn from search pattern
      await this.learnFromSearch(entry);
      
      // Persist data
      await this.persistHistoryData();
      
      // Emit event
      this.emit('search_added', entry);
      
      console.log('Search entry added to history:', searchId);
      return searchId;
      
    } catch (error) {
      console.error('Failed to add search entry:', error);
      throw error;
    }
  }

  /**
   * Update user interaction data for a search entry
   */
  async updateUserInteraction(
    searchId: string,
    interaction: Partial<SearchHistoryEntry['userInteraction']>
  ): Promise<void> {
    try {
      const entry = this.searchHistory.find(h => h.id === searchId);
      if (!entry) {
        console.warn('Search entry not found for interaction update:', searchId);
        return;
      }
      
      // Update interaction data
      entry.userInteraction = { ...entry.userInteraction, ...interaction };
      
      // Update last interaction time
      this.lastInteractionTime = Date.now();
      
      // Update performance metrics if rating provided
      if (interaction.rating) {
        this.updateSatisfactionScore(interaction.rating);
      }
      
      // Persist data
      await this.persistHistoryData();
      
      // Emit event
      this.emit('interaction_updated', { searchId, interaction });
      
    } catch (error) {
      console.error('Failed to update user interaction:', error);
    }
  }

  /**
   * Learn patterns from search behavior
   */
  private async learnFromSearch(entry: SearchHistoryEntry): Promise<void> {
    try {
      // Location-based patterns
      await this.updateLocationPattern(entry);
      
      // Query-based patterns
      if (entry.query) {
        await this.updateQueryPattern(entry);
      }
      
      // Time-based patterns
      await this.updateTimePattern(entry);
      
      // Mixed patterns (combination of factors)
      await this.updateMixedPatterns(entry);
      
      // Cleanup old patterns
      this.cleanupPatterns();
      
    } catch (error) {
      console.warn('Failed to learn from search:', error);
    }
  }

  /**
   * Update location-based search patterns
   */
  private async updateLocationPattern(entry: SearchHistoryEntry): Promise<void> {
    const locationKey = this.getLocationKey(entry.location);
    let pattern = this.searchPatterns.find(p => p.type === 'location' && p.id.includes(locationKey));
    
    if (!pattern) {
      pattern = {
        id: `location_${locationKey}_${Date.now()}`,
        type: 'location',
        pattern: {
          commonLocations: [entry.location],
          commonQueries: entry.query ? [entry.query] : [],
          commonCategories: [],
          commonTimes: [this.getTimeOfDay()],
          frequency: 1
        },
        confidence: 0.1,
        lastUsed: entry.timestamp,
        predictiveValue: 0.1
      };
      this.searchPatterns.push(pattern);
    } else {
      pattern.pattern.frequency++;
      pattern.lastUsed = entry.timestamp;
      pattern.confidence = Math.min(1.0, pattern.pattern.frequency / 10);
      
      if (entry.query && !pattern.pattern.commonQueries.includes(entry.query)) {
        pattern.pattern.commonQueries.push(entry.query);
      }
    }
    
    this.searchContext.personalizedPatterns = this.searchPatterns;
  }

  /**
   * Update query-based search patterns
   */
  private async updateQueryPattern(entry: SearchHistoryEntry): Promise<void> {
    if (!entry.query) return;
    
    let pattern = this.searchPatterns.find(p => p.type === 'query' && p.pattern.commonQueries.includes(entry.query!));
    
    if (!pattern) {
      pattern = {
        id: `query_${entry.query}_${Date.now()}`,
        type: 'query',
        pattern: {
          commonLocations: [entry.location],
          commonQueries: [entry.query],
          commonCategories: [],
          commonTimes: [this.getTimeOfDay()],
          frequency: 1
        },
        confidence: 0.1,
        lastUsed: entry.timestamp,
        predictiveValue: 0.2
      };
      this.searchPatterns.push(pattern);
    } else {
      pattern.pattern.frequency++;
      pattern.lastUsed = entry.timestamp;
      pattern.confidence = Math.min(1.0, pattern.pattern.frequency / 5);
      
      // Add location if not too far from existing ones
      const isNearExistingLocation = pattern.pattern.commonLocations.some(loc => 
        this.calculateDistance(entry.location.latitude, entry.location.longitude, loc.latitude, loc.longitude) < 2
      );
      
      if (!isNearExistingLocation && pattern.pattern.commonLocations.length < 5) {
        pattern.pattern.commonLocations.push(entry.location);
      }
    }
  }

  /**
   * Update time-based search patterns
   */
  private async updateTimePattern(entry: SearchHistoryEntry): Promise<void> {
    const timeKey = `${entry.context.timeOfDay}_${entry.context.dayOfWeek}`;
    let pattern = this.searchPatterns.find(p => p.type === 'time' && p.id.includes(timeKey));
    
    if (!pattern) {
      pattern = {
        id: `time_${timeKey}_${Date.now()}`,
        type: 'time',
        pattern: {
          commonLocations: [entry.location],
          commonQueries: entry.query ? [entry.query] : [],
          commonCategories: [],
          commonTimes: [`${entry.context.timeOfDay}_${entry.context.dayOfWeek}`],
          frequency: 1
        },
        confidence: 0.1,
        lastUsed: entry.timestamp,
        predictiveValue: 0.15
      };
      this.searchPatterns.push(pattern);
    } else {
      pattern.pattern.frequency++;
      pattern.lastUsed = entry.timestamp;
      pattern.confidence = Math.min(1.0, pattern.pattern.frequency / 8);
    }
  }

  /**
   * Update mixed search patterns (combining multiple factors)
   */
  private async updateMixedPatterns(entry: SearchHistoryEntry): Promise<void> {
    // Look for patterns that combine location + time + query
    if (entry.query) {
      const mixedKey = `${this.getLocationKey(entry.location)}_${entry.context.timeOfDay}_${entry.query}`;
      let pattern = this.searchPatterns.find(p => p.type === 'mixed' && p.id.includes(mixedKey));
      
      if (!pattern && this.searchPatterns.filter(p => p.type === 'mixed').length < 20) {
        pattern = {
          id: `mixed_${mixedKey}_${Date.now()}`,
          type: 'mixed',
          pattern: {
            commonLocations: [entry.location],
            commonQueries: [entry.query],
            commonCategories: [],
            commonTimes: [`${entry.context.timeOfDay}_${entry.context.dayOfWeek}`],
            frequency: 1
          },
          confidence: 0.05,
          lastUsed: entry.timestamp,
          predictiveValue: 0.3
        };
        this.searchPatterns.push(pattern);
      } else if (pattern) {
        pattern.pattern.frequency++;
        pattern.lastUsed = entry.timestamp;
        pattern.confidence = Math.min(1.0, pattern.pattern.frequency / 3);
        pattern.predictiveValue = Math.min(0.5, pattern.predictiveValue + 0.05);
      }
    }
  }

  /**
   * Generate personalized search recommendations
   */
  async getSearchRecommendations(
    currentLocation: LocationCoordinates,
    currentContext?: Partial<ContextSnapshot>
  ): Promise<SearchRecommendation[]> {
    try {
      const recommendations: SearchRecommendation[] = [];
      const currentTimeOfDay = this.getTimeOfDay();
      const currentDayOfWeek = this.getDayOfWeek();
      
      // Location-based recommendations
      const locationRecommendations = this.getLocationBasedRecommendations(currentLocation);
      recommendations.push(...locationRecommendations);
      
      // Time-based recommendations
      const timeRecommendations = this.getTimeBasedRecommendations(currentTimeOfDay, currentDayOfWeek);
      recommendations.push(...timeRecommendations);
      
      // Pattern-based recommendations
      const patternRecommendations = this.getPatternBasedRecommendations(currentLocation, currentTimeOfDay);
      recommendations.push(...patternRecommendations);
      
      // History-based recommendations
      const historyRecommendations = this.getHistoryBasedRecommendations(currentLocation);
      recommendations.push(...historyRecommendations);
      
      // Sort by relevance score and confidence
      recommendations.sort((a, b) => {
        const scoreA = (a.relevanceScore * 0.6) + (a.confidence * 0.4);
        const scoreB = (b.relevanceScore * 0.6) + (b.confidence * 0.4);
        return scoreB - scoreA;
      });
      
      // Return top 10 recommendations
      return recommendations.slice(0, 10);
      
    } catch (error) {
      console.error('Failed to generate search recommendations:', error);
      return [];
    }
  }

  /**
   * Get location-based recommendations
   */
  private getLocationBasedRecommendations(location: LocationCoordinates): SearchRecommendation[] {
    const recommendations: SearchRecommendation[] = [];
    
    // Find searches near current location
    const nearbySearches = this.searchHistory.filter(entry => {
      const distance = this.calculateDistance(
        location.latitude, location.longitude,
        entry.location.latitude, entry.location.longitude
      );
      return distance < 2; // Within 2km
    });
    
    // Group by query and find popular ones
    const queryFrequency = new Map<string, number>();
    nearbySearches.forEach(search => {
      if (search.query) {
        queryFrequency.set(search.query, (queryFrequency.get(search.query) || 0) + 1);
      }
    });
    
    // Create recommendations from popular queries
    Array.from(queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([query, frequency]) => {
        recommendations.push({
          id: `location_${query}_${Date.now()}`,
          type: 'query',
          title: `Search for "${query}"`,
          description: `Popular search in this area (${frequency} previous searches)`,
          confidence: Math.min(1.0, frequency / 5),
          relevanceScore: 0.8,
          basedOn: {
            patterns: ['location'],
            recentHistory: true,
            locationContext: true,
            timeContext: false
          },
          action: {
            type: 'search',
            payload: { query, location }
          }
        });
      });
    
    return recommendations;
  }

  /**
   * Get time-based recommendations
   */
  private getTimeBasedRecommendations(timeOfDay: string, dayOfWeek: string): SearchRecommendation[] {
    const recommendations: SearchRecommendation[] = [];
    
    // Find patterns for this time
    const timePatterns = this.searchPatterns.filter(p => 
      p.type === 'time' && 
      p.pattern.commonTimes.some(time => time.includes(timeOfDay) && time.includes(dayOfWeek))
    );
    
    timePatterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .forEach(pattern => {
        pattern.pattern.commonQueries.forEach(query => {
          if (query) {
            recommendations.push({
              id: `time_${query}_${Date.now()}`,
              type: 'query',
              title: `Search for "${query}"`,
              description: `Often searched at this time`,
              confidence: pattern.confidence,
              relevanceScore: 0.6,
              basedOn: {
                patterns: [pattern.id],
                recentHistory: false,
                locationContext: false,
                timeContext: true
              },
              action: {
                type: 'search',
                payload: { query }
              }
            });
          }
        });
      });
    
    return recommendations;
  }

  /**
   * Get pattern-based recommendations
   */
  private getPatternBasedRecommendations(location: LocationCoordinates, timeOfDay: string): SearchRecommendation[] {
    const recommendations: SearchRecommendation[] = [];
    
    // Find high-confidence patterns
    const relevantPatterns = this.searchPatterns.filter(p => {
      if (p.confidence < 0.3) return false;
      
      // Check location relevance
      if (p.pattern.commonLocations.length > 0) {
        const hasNearbyLocation = p.pattern.commonLocations.some(loc =>
          this.calculateDistance(location.latitude, location.longitude, loc.latitude, loc.longitude) < 5
        );
        if (!hasNearbyLocation) return false;
      }
      
      // Check time relevance
      if (p.pattern.commonTimes.length > 0) {
        const hasRelevantTime = p.pattern.commonTimes.some(time => time.includes(timeOfDay));
        if (!hasRelevantTime) return false;
      }
      
      return true;
    });
    
    relevantPatterns
      .sort((a, b) => (b.confidence * b.predictiveValue) - (a.confidence * a.predictiveValue))
      .slice(0, 4)
      .forEach(pattern => {
        pattern.pattern.commonQueries.forEach(query => {
          if (query) {
            recommendations.push({
              id: `pattern_${query}_${Date.now()}`,
              type: 'query',
              title: `Try searching for "${query}"`,
              description: `Based on your search patterns`,
              confidence: pattern.confidence,
              relevanceScore: pattern.predictiveValue,
              basedOn: {
                patterns: [pattern.id],
                recentHistory: true,
                locationContext: true,
                timeContext: true
              },
              action: {
                type: 'search',
                payload: { query, location }
              }
            });
          }
        });
      });
    
    return recommendations;
  }

  /**
   * Get history-based recommendations
   */
  private getHistoryBasedRecommendations(location: LocationCoordinates): SearchRecommendation[] {
    const recommendations: SearchRecommendation[] = [];
    
    // Find recently successful searches that were rated highly
    const successfulSearches = this.searchHistory
      .filter(entry => 
        entry.userInteraction.wasHelpful && 
        (entry.userInteraction.rating || 4) >= 4 &&
        entry.results.count > 0
      )
      .slice(0, 20);
    
    // Group by location similarity
    const locationGroups = new Map<string, SearchHistoryEntry[]>();
    successfulSearches.forEach(search => {
      const locationKey = this.getLocationKey(search.location, 1); // 1km precision
      const group = locationGroups.get(locationKey) || [];
      group.push(search);
      locationGroups.set(locationKey, group);
    });
    
    // Create recommendations from successful location groups
    Array.from(locationGroups.entries())
      .filter(([, searches]) => searches.length >= 2)
      .slice(0, 3)
      .forEach(([locationKey, searches]) => {
        const mostRecent = searches[0];
        const avgRating = searches.reduce((sum, s) => sum + (s.userInteraction.rating || 4), 0) / searches.length;
        
        recommendations.push({
          id: `history_${locationKey}_${Date.now()}`,
          type: 'location',
          title: 'Search near previous location',
          description: `You've had ${searches.length} successful searches in this area (avg rating: ${avgRating.toFixed(1)})`,
          confidence: Math.min(1.0, searches.length / 5),
          relevanceScore: 0.7,
          basedOn: {
            patterns: [],
            recentHistory: true,
            locationContext: true,
            timeContext: false
          },
          action: {
            type: 'navigate',
            payload: { location: mostRecent.location, region: mostRecent.region }
          }
        });
      });
    
    return recommendations;
  }

  /**
   * Create context snapshot for preservation
   */
  createContextSnapshot(
    location: LocationCoordinates,
    searchState: any,
    userState: any,
    environmentalContext?: any
  ): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      timestamp: Date.now(),
      location,
      searchState: {
        activeQuery: searchState.activeQuery,
        activeFilters: searchState.activeFilters || {},
        currentRegion: searchState.currentRegion,
        resultCount: searchState.resultCount || 0
      },
      userState: {
        interactionMode: userState.interactionMode || 'browsing',
        sessionDuration: Date.now() - this.searchContext.currentSession.startTime,
        recentActions: userState.recentActions || []
      },
      environmentalContext: {
        networkCondition: environmentalContext?.networkCondition || 'unknown',
        batteryLevel: environmentalContext?.batteryLevel,
        timeContext: this.getTimeOfDay(),
        movementPattern: this.searchContext.currentSession.userMovementPattern
      }
    };
    
    return snapshot;
  }

  /**
   * Save context snapshot
   */
  async saveContextSnapshot(snapshot: ContextSnapshot): Promise<void> {
    try {
      this.contextSnapshots.unshift(snapshot);
      
      // Limit snapshots
      if (this.contextSnapshots.length > this.MAX_CONTEXT_SNAPSHOTS) {
        this.contextSnapshots = this.contextSnapshots.slice(0, this.MAX_CONTEXT_SNAPSHOTS);
      }
      
      // Persist to storage
      await AsyncStorage.setItem(
        SearchHistoryService.STORAGE_KEY_SNAPSHOTS,
        JSON.stringify(this.contextSnapshots)
      );
      
      this.emit('context_snapshot_saved', snapshot);
      
    } catch (error) {
      console.error('Failed to save context snapshot:', error);
    }
  }

  /**
   * Restore context from snapshot
   */
  getContextSnapshot(timestamp?: number): ContextSnapshot | null {
    if (timestamp) {
      return this.contextSnapshots.find(s => s.timestamp === timestamp) || null;
    }
    
    // Return most recent snapshot
    return this.contextSnapshots[0] || null;
  }

  /**
   * Get search history with filtering options
   */
  getSearchHistory(options?: {
    limit?: number;
    fromDate?: number;
    toDate?: number;
    location?: LocationCoordinates;
    radius?: number;
    query?: string;
  }): SearchHistoryEntry[] {
    let filtered = [...this.searchHistory];
    
    if (options) {
      if (options.fromDate) {
        filtered = filtered.filter(entry => entry.timestamp >= options.fromDate!);
      }
      
      if (options.toDate) {
        filtered = filtered.filter(entry => entry.timestamp <= options.toDate!);
      }
      
      if (options.location && options.radius) {
        filtered = filtered.filter(entry => {
          const distance = this.calculateDistance(
            options.location!.latitude, options.location!.longitude,
            entry.location.latitude, entry.location.longitude
          );
          return distance <= options.radius!;
        });
      }
      
      if (options.query) {
        filtered = filtered.filter(entry => 
          entry.query?.toLowerCase().includes(options.query!.toLowerCase())
        );
      }
      
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
    }
    
    return filtered;
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        this.searchHistory = this.searchHistory.filter(entry => entry.timestamp > cutoffDate);
      } else {
        this.searchHistory = [];
      }
      
      this.searchContext.recentHistory = this.searchHistory.slice(0, 50);
      await this.persistHistoryData();
      
      this.emit('history_cleared', { olderThanDays });
      
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }

  // Helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLocationKey(location: LocationCoordinates, precisionKm: number = 0.1): string {
    const precision = precisionKm / 111; // Convert km to degrees (approximate)
    const lat = Math.round(location.latitude / precision) * precision;
    const lng = Math.round(location.longitude / precision) * precision;
    return `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private getDayOfWeek(): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  private isRepeatSearch(query: string | undefined, location: LocationCoordinates): boolean {
    if (!query) return false;
    
    return this.searchHistory.some(entry => 
      entry.query === query &&
      this.calculateDistance(
        entry.location.latitude, entry.location.longitude,
        location.latitude, location.longitude
      ) < 0.5 // Within 500m
    );
  }

  private findPreviousSearchId(query: string | undefined, location: LocationCoordinates): string | undefined {
    if (!query) return undefined;
    
    const previous = this.searchHistory.find(entry => 
      entry.query === query &&
      this.calculateDistance(
        entry.location.latitude, entry.location.longitude,
        location.latitude, location.longitude
      ) < 0.5
    );
    
    return previous?.id;
  }

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

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private updatePerformanceMetrics(entry: SearchHistoryEntry): void {
    const metrics = this.searchContext.performanceMetrics;
    
    // Update average search time
    const totalEntries = this.searchHistory.length;
    const currentAvg = metrics.averageSearchTime;
    metrics.averageSearchTime = ((currentAvg * (totalEntries - 1)) + entry.results.responseTime) / totalEntries;
    
    // Update cache hit rate (simplified)
    if (entry.results.source === 'cached') {
      const cacheHits = this.searchHistory.filter(h => h.results.source === 'cached').length;
      metrics.cacheHitRate = cacheHits / totalEntries;
    }
  }

  private updateSatisfactionScore(rating: number): void {
    const scores = this.searchHistory
      .map(h => h.userInteraction.rating)
      .filter(r => r !== undefined) as number[];
    
    if (scores.length > 0) {
      this.searchContext.performanceMetrics.userSatisfactionScore = 
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  }

  private cleanupPatterns(): void {
    const now = Date.now();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    
    this.searchPatterns = this.searchPatterns.filter(pattern => {
      return (now - pattern.lastUsed) < maxAge && pattern.confidence > 0.05;
    });
    
    // Limit total patterns
    if (this.searchPatterns.length > 100) {
      this.searchPatterns.sort((a, b) => 
        (b.confidence * b.predictiveValue) - (a.confidence * a.predictiveValue)
      );
      this.searchPatterns = this.searchPatterns.slice(0, 100);
    }
  }

  private startContextSnapshots(): void {
    this.contextSnapshotTimer = setInterval(() => {
      // Create periodic snapshots during active usage
      if (Date.now() - this.lastInteractionTime < 300000) { // 5 minutes
        const snapshot = this.createContextSnapshot(
          this.searchContext.currentSession.currentLocation,
          {},
          { interactionMode: 'browsing', recentActions: [] },
          {}
        );
        this.saveContextSnapshot(snapshot);
      }
    }, this.CONTEXT_SNAPSHOT_INTERVAL);
  }

  private startHistoryCleanup(): void {
    this.historyCleanupTimer = setInterval(async () => {
      const retentionPeriod = this.searchContext.userPreferences.privacySettings.retentionPeriod;
      await this.clearSearchHistory(retentionPeriod);
    }, this.HISTORY_CLEANUP_INTERVAL);
  }

  private async persistHistoryData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(SearchHistoryService.STORAGE_KEY_HISTORY, JSON.stringify(this.searchHistory)),
        AsyncStorage.setItem(SearchHistoryService.STORAGE_KEY_CONTEXT, JSON.stringify(this.searchContext)),
        AsyncStorage.setItem(SearchHistoryService.STORAGE_KEY_PATTERNS, JSON.stringify(this.searchPatterns))
      ]);
    } catch (error) {
      console.warn('Failed to persist history data:', error);
    }
  }

  /**
   * Cleanup service resources
   */
  cleanup(): void {
    if (this.contextSnapshotTimer) {
      clearInterval(this.contextSnapshotTimer);
    }
    
    if (this.historyCleanupTimer) {
      clearInterval(this.historyCleanupTimer);
    }
    
    this.removeAllListeners();
    console.log('SearchHistoryService cleanup completed');
  }

  /**
   * Get service statistics
   */
  getStatistics(): any {
    return {
      historyEntries: this.searchHistory.length,
      searchPatterns: this.searchPatterns.length,
      contextSnapshots: this.contextSnapshots.length,
      currentSession: this.searchContext.currentSession,
      performanceMetrics: this.searchContext.performanceMetrics
    };
  }
}

// Export singleton instance
export const searchHistoryService = new SearchHistoryService();