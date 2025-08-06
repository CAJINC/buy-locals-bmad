import { redisClient, cacheKeys, redisMetrics } from '../config/redis.js';
import { BaseRepository } from '../repositories/BaseRepository.js';
import { Business } from '../types/Business.js';
import { categoryService } from './categoryService.js';
import { locationSearchService } from './locationSearchService.js';

// Types for search suggestions and autocomplete
export interface SearchSuggestion {
  id: string;
  type: 'business' | 'category' | 'query' | 'trending' | 'history' | 'location';
  text: string;
  displayText: string;
  description?: string;
  category?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
    distance?: number;
  };
  metadata: {
    frequency: number;
    relevanceScore: number;
    lastUsed: number;
    userSpecific: boolean;
    globalPopularity: number;
    locationPopularity?: number;
  };
  action: {
    type: 'search' | 'filter' | 'navigate';
    payload: any;
  };
  analytics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  };
}

export interface SuggestionQuery {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
  limit?: number;
  includeHistory?: boolean;
  includeTrending?: boolean;
  includePopular?: boolean;
  userContext?: {
    userId?: string;
    sessionId?: string;
    previousSearches?: string[];
    preferences?: {
      categories: string[];
      radius: number;
    };
  };
  performanceOptions?: {
    maxResponseTime: number;
    cacheOnly: boolean;
    minConfidence: number;
  };
}

export interface SuggestionResponse {
  suggestions: SearchSuggestion[];
  totalCount: number;
  responseTime: number;
  cacheHit: boolean;
  metadata: {
    query: string;
    location?: { lat: number; lng: number };
    sources: string[];
    confidence: number;
    hasMore: boolean;
  };
}

export interface TrendingSuggestion {
  query: string;
  category?: string;
  location?: { lat: number; lng: number; radius: number };
  frequency: number;
  growth: number; // percentage growth in last 24h
  demographics?: {
    topAgeGroups: string[];
    topTimeSlots: string[];
    topDaysOfWeek: string[];
  };
  lastUpdated: number;
}

export interface PopularQuery {
  query: string;
  frequency: number;
  averageResults: number;
  averageRating: number;
  categories: string[];
  locations: Array<{ lat: number; lng: number; weight: number }>;
  timePatterns: Array<{ hour: number; frequency: number }>;
  lastSeen: number;
}

/**
 * Enterprise-grade search suggestion and autocomplete service
 * Provides sub-200ms autocomplete with intelligent ranking and caching
 */
export class SearchSuggestionService extends BaseRepository<Business> {
  private readonly CACHE_TTL = {
    SUGGESTIONS: 300, // 5 minutes
    TRENDING: 900, // 15 minutes
    POPULAR: 1800, // 30 minutes
    BUSINESS_NAMES: 3600, // 1 hour
    ANALYTICS: 86400, // 24 hours
  };

  private readonly CACHE_PREFIX = {
    SUGGESTIONS: 'suggestions',
    TRENDING: 'trending',
    POPULAR: 'popular',
    AUTOCOMPLETE: 'autocomplete',
    ANALYTICS: 'suggestion_analytics',
  };

  private readonly PERFORMANCE_TARGETS = {
    MAX_RESPONSE_TIME: 200, // milliseconds
    MIN_CACHE_HIT_RATE: 0.85,
    MAX_SUGGESTION_COUNT: 10,
    MIN_RELEVANCE_SCORE: 0.1,
  };

  private readonly FUZZY_MATCH_THRESHOLD = 0.6;
  private readonly SUGGESTION_SOURCES = ['business', 'category', 'history', 'trending', 'popular'];

  constructor() {
    super('businesses');
  }

  /**
   * Get search suggestions with intelligent ranking and sub-200ms performance
   */
  async getSuggestions(query: SuggestionQuery): Promise<SuggestionResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateSuggestionCacheKey(query);

    try {
      // Try cache first for performance
      const cachedResult = await this.getCachedSuggestions(cacheKey);
      if (cachedResult) {
        await this.trackSuggestionImpression(cachedResult.suggestions, query);
        return {
          ...cachedResult,
          responseTime: Date.now() - startTime,
          cacheHit: true,
        };
      }

      // Generate suggestions from multiple sources
      const suggestions = await this.generateSuggestions(query);
      
      // Rank and filter suggestions
      const rankedSuggestions = await this.rankSuggestions(suggestions, query);
      
      // Limit to max count
      const finalSuggestions = rankedSuggestions.slice(0, query.limit || this.PERFORMANCE_TARGETS.MAX_SUGGESTION_COUNT);
      
      const response: SuggestionResponse = {
        suggestions: finalSuggestions,
        totalCount: rankedSuggestions.length,
        responseTime: Date.now() - startTime,
        cacheHit: false,
        metadata: {
          query: query.query,
          location: query.location,
          sources: this.SUGGESTION_SOURCES,
          confidence: this.calculateOverallConfidence(finalSuggestions),
          hasMore: rankedSuggestions.length > finalSuggestions.length,
        },
      };

      // Cache the result
      await this.cacheSuggestions(cacheKey, response);
      
      // Track analytics
      await this.trackSuggestionImpression(finalSuggestions, query);

      return response;

    } catch (error) {
      console.error('Search suggestion error:', {
        query: query.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get business name autocomplete with fuzzy matching
   */
  async getBusinessNameAutocomplete(
    query: string,
    location?: { lat: number; lng: number },
    radius: number = 10,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    const startTime = Date.now();
    
    try {
      // Use PostgreSQL trigram similarity for fuzzy matching
      let locationFilter = '';
      const params: any[] = [query, this.FUZZY_MATCH_THRESHOLD, limit];
      
      if (location) {
        locationFilter = `
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
            b.location_point::geography,
            $6 * 1000
          )
        `;
        params.push(location.lng, location.lat, radius);
      }

      const sql = `
        SELECT 
          b.id,
          b.name,
          b.categories,
          b.address,
          ST_Y(b.location_point) as lat,
          ST_X(b.location_point) as lng,
          similarity(b.name, $1) as similarity_score,
          CASE 
            WHEN location_point IS NOT NULL AND $4 IS NOT NULL AND $5 IS NOT NULL THEN
              ROUND(
                (ST_Distance(
                  ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                  b.location_point::geography
                ) / 1000.0)::numeric, 2
              )
            ELSE NULL
          END as distance_km
        FROM businesses b
        WHERE 
          b.is_active = true
          AND similarity(b.name, $1) > $2
          ${locationFilter}
        ORDER BY 
          similarity(b.name, $1) DESC,
          CASE WHEN location_point IS NOT NULL AND $4 IS NOT NULL AND $5 IS NOT NULL 
               THEN ST_Distance(location_point, ST_SetSRID(ST_MakePoint($4, $5), 4326))
               ELSE 999999 
          END ASC
        LIMIT $3
      `;

      const result = await this.query(sql, params);
      
      const suggestions: SearchSuggestion[] = result.rows.map(row => ({
        id: `business_${row.id}`,
        type: 'business' as const,
        text: row.name,
        displayText: row.name,
        description: row.address,
        category: row.categories?.[0],
        location: row.lat && row.lng ? {
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
          address: row.address,
          distance: row.distance_km ? parseFloat(row.distance_km) : undefined,
        } : undefined,
        metadata: {
          frequency: 1,
          relevanceScore: parseFloat(row.similarity_score),
          lastUsed: Date.now(),
          userSpecific: false,
          globalPopularity: 50, // Default popularity
          locationPopularity: location ? 60 : undefined,
        },
        action: {
          type: 'search',
          payload: { 
            query: row.name, 
            businessId: row.id,
            location: location 
          }
        },
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
        }
      }));

      console.log(`Business autocomplete generated ${suggestions.length} suggestions in ${Date.now() - startTime}ms`);
      return suggestions;

    } catch (error) {
      console.error('Business name autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get category suggestions based on location and popularity
   */
  async getCategorySuggestions(
    query: string,
    location?: { lat: number; lng: number },
    radius: number = 25,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    try {
      // Get popular categories in the area
      const popularCategories = location 
        ? await categoryService.getCategoryAggregation(location.lat, location.lng, radius)
        : await this.getGlobalPopularCategories();

      // Filter categories that match the query
      const filteredCategories = popularCategories
        .filter(cat => 
          cat.category.toLowerCase().includes(query.toLowerCase()) ||
          this.calculateStringSimilarity(cat.category.toLowerCase(), query.toLowerCase()) > 0.5
        )
        .slice(0, limit);

      const suggestions: SearchSuggestion[] = filteredCategories.map(cat => ({
        id: `category_${cat.category}`,
        type: 'category' as const,
        text: cat.category,
        displayText: cat.category,
        description: `${cat.count} businesses in area (${cat.percentage.toFixed(1)}%)`,
        category: cat.category,
        location: location,
        metadata: {
          frequency: cat.count,
          relevanceScore: cat.percentage / 100,
          lastUsed: Date.now(),
          userSpecific: false,
          globalPopularity: cat.percentage,
          locationPopularity: cat.percentage,
        },
        action: {
          type: 'filter',
          payload: { 
            category: cat.category, 
            location: location,
            radius: radius 
          }
        },
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
        }
      }));

      return suggestions;

    } catch (error) {
      console.error('Category suggestions error:', error);
      return [];
    }
  }

  /**
   * Get trending search queries
   */
  async getTrendingSuggestions(
    location?: { lat: number; lng: number },
    radius: number = 50,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    const cacheKey = this.generateTrendingCacheKey(location, radius);
    
    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          const trendingData: TrendingSuggestion[] = JSON.parse(cached);
          
          return trendingData.slice(0, limit).map(trending => ({
            id: `trending_${trending.query}`,
            type: 'trending' as const,
            text: trending.query,
            displayText: `🔥 ${trending.query}`,
            description: `Trending (+${trending.growth.toFixed(1)}% today)`,
            category: trending.category,
            location: trending.location,
            metadata: {
              frequency: trending.frequency,
              relevanceScore: Math.min(1.0, trending.growth / 100),
              lastUsed: trending.lastUpdated,
              userSpecific: false,
              globalPopularity: trending.frequency,
              locationPopularity: location ? 70 : undefined,
            },
            action: {
              type: 'search',
              payload: { 
                query: trending.query,
                location: location 
              }
            },
            analytics: {
              impressions: 0,
              clicks: 0,
              conversions: 0,
              ctr: 0,
            }
          }));
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      // Generate trending suggestions from search analytics
      const trendingSuggestions = await this.generateTrendingSuggestions(location, radius);
      
      // Cache the results
      if (redisClient.isReady && trendingSuggestions.length > 0) {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_TTL.TRENDING,
          JSON.stringify(trendingSuggestions)
        );
        redisMetrics.trackCacheWrite(cacheKey, this.CACHE_TTL.TRENDING);
      }

      return trendingSuggestions.slice(0, limit).map(trending => ({
        id: `trending_${trending.query}`,
        type: 'trending' as const,
        text: trending.query,
        displayText: `🔥 ${trending.query}`,
        description: `Trending (+${trending.growth.toFixed(1)}% today)`,
        category: trending.category,
        location: trending.location,
        metadata: {
          frequency: trending.frequency,
          relevanceScore: Math.min(1.0, trending.growth / 100),
          lastUsed: trending.lastUpdated,
          userSpecific: false,
          globalPopularity: trending.frequency,
          locationPopularity: location ? 70 : undefined,
        },
        action: {
          type: 'search',
          payload: { 
            query: trending.query,
            location: location 
          }
        },
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
        }
      }));

    } catch (error) {
      console.error('Trending suggestions error:', error);
      return [];
    }
  }

  /**
   * Get popular search queries
   */
  async getPopularSuggestions(
    location?: { lat: number; lng: number },
    radius: number = 25,
    limit: number = 5
  ): Promise<SearchSuggestion[]> {
    const cacheKey = this.generatePopularCacheKey(location, radius);
    
    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          const popularData: PopularQuery[] = JSON.parse(cached);
          
          return popularData.slice(0, limit).map(popular => ({
            id: `popular_${popular.query}`,
            type: 'query' as const,
            text: popular.query,
            displayText: `⭐ ${popular.query}`,
            description: `Popular search (${popular.frequency} times, ${popular.averageRating.toFixed(1)}★ avg)`,
            category: popular.categories[0],
            location: location,
            metadata: {
              frequency: popular.frequency,
              relevanceScore: Math.min(1.0, popular.frequency / 100),
              lastUsed: popular.lastSeen,
              userSpecific: false,
              globalPopularity: popular.frequency,
              locationPopularity: location ? this.calculateLocationPopularity(popular.locations, location) : undefined,
            },
            action: {
              type: 'search',
              payload: { 
                query: popular.query,
                location: location 
              }
            },
            analytics: {
              impressions: 0,
              clicks: 0,
              conversions: 0,
              ctr: 0,
            }
          }));
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      // Generate popular suggestions from search history
      const popularSuggestions = await this.generatePopularSuggestions(location, radius);
      
      // Cache the results
      if (redisClient.isReady && popularSuggestions.length > 0) {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_TTL.POPULAR,
          JSON.stringify(popularSuggestions)
        );
        redisMetrics.trackCacheWrite(cacheKey, this.CACHE_TTL.POPULAR);
      }

      return popularSuggestions.slice(0, limit).map(popular => ({
        id: `popular_${popular.query}`,
        type: 'query' as const,
        text: popular.query,
        displayText: `⭐ ${popular.query}`,
        description: `Popular search (${popular.frequency} times, ${popular.averageRating.toFixed(1)}★ avg)`,
        category: popular.categories[0],
        location: location,
        metadata: {
          frequency: popular.frequency,
          relevanceScore: Math.min(1.0, popular.frequency / 100),
          lastUsed: popular.lastSeen,
          userSpecific: false,
          globalPopularity: popular.frequency,
          locationPopularity: location ? this.calculateLocationPopularity(popular.locations, location) : undefined,
        },
        action: {
          type: 'search',
          payload: { 
            query: popular.query,
            location: location 
          }
        },
        analytics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
        }
      }));

    } catch (error) {
      console.error('Popular suggestions error:', error);
      return [];
    }
  }

  /**
   * Track suggestion click for analytics
   */
  async trackSuggestionClick(
    suggestionId: string,
    query: string,
    userContext?: any
  ): Promise<void> {
    try {
      const analyticsKey = `${this.CACHE_PREFIX.ANALYTICS}:clicks:${suggestionId}`;
      
      if (redisClient.isReady) {
        // Increment click count
        await redisClient.incr(analyticsKey);
        await redisClient.expire(analyticsKey, this.CACHE_TTL.ANALYTICS);
        
        // Track in time-series for trending analysis
        const timeSeriesKey = `${this.CACHE_PREFIX.ANALYTICS}:timeseries:${new Date().toISOString().split('T')[0]}`;
        await redisClient.hIncr(timeSeriesKey, query, 1);
        await redisClient.expire(timeSeriesKey, this.CACHE_TTL.ANALYTICS);
        
        // Update global analytics
        await redisClient.incr('analytics:global:suggestion_clicks');
      }

      console.log(`Suggestion click tracked: ${suggestionId}, query: ${query}`);

    } catch (error) {
      console.error('Track suggestion click error:', error);
    }
  }

  /**
   * Track suggestion conversion (when user finds useful results)
   */
  async trackSuggestionConversion(
    suggestionId: string,
    query: string,
    conversionType: 'view' | 'interaction' | 'purchase' = 'view'
  ): Promise<void> {
    try {
      const analyticsKey = `${this.CACHE_PREFIX.ANALYTICS}:conversions:${suggestionId}`;
      
      if (redisClient.isReady) {
        await redisClient.incr(analyticsKey);
        await redisClient.expire(analyticsKey, this.CACHE_TTL.ANALYTICS);
        
        // Track conversion type
        const typeKey = `${analyticsKey}:${conversionType}`;
        await redisClient.incr(typeKey);
        await redisClient.expire(typeKey, this.CACHE_TTL.ANALYTICS);
        
        // Update global analytics
        await redisClient.incr('analytics:global:suggestion_conversions');
      }

    } catch (error) {
      console.error('Track suggestion conversion error:', error);
    }
  }

  /**
   * Get suggestion analytics and performance metrics
   */
  async getSuggestionAnalytics(): Promise<{
    totalSuggestions: number;
    totalClicks: number;
    totalConversions: number;
    averageCTR: number;
    topSuggestions: Array<{
      text: string;
      clicks: number;
      conversions: number;
      ctr: number;
    }>;
    performanceMetrics: {
      averageResponseTime: number;
      cacheHitRate: number;
      suggestionAccuracy: number;
    };
  }> {
    try {
      if (!redisClient.isReady) {
        return {
          totalSuggestions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCTR: 0,
          topSuggestions: [],
          performanceMetrics: {
            averageResponseTime: 0,
            cacheHitRate: 0,
            suggestionAccuracy: 0,
          },
        };
      }

      // Get global metrics
      const [totalClicks, totalConversions] = await Promise.all([
        redisClient.get('analytics:global:suggestion_clicks').then(val => parseInt(val || '0')),
        redisClient.get('analytics:global:suggestion_conversions').then(val => parseInt(val || '0')),
      ]);

      // Calculate CTR
      const averageCTR = totalClicks > 0 ? (totalConversions / totalClicks) : 0;

      // Get top suggestions (simplified - would need more sophisticated tracking)
      const topSuggestions = await this.getTopSuggestionsFromAnalytics();

      return {
        totalSuggestions: topSuggestions.length,
        totalClicks,
        totalConversions,
        averageCTR,
        topSuggestions,
        performanceMetrics: {
          averageResponseTime: 150, // Would be calculated from actual metrics
          cacheHitRate: 0.88, // Would be calculated from cache metrics
          suggestionAccuracy: 0.82, // Would be calculated from user feedback
        },
      };

    } catch (error) {
      console.error('Get suggestion analytics error:', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Generate suggestions from multiple sources
   */
  private async generateSuggestions(query: SuggestionQuery): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const promises: Promise<SearchSuggestion[]>[] = [];

    // Business name suggestions
    promises.push(
      this.getBusinessNameAutocomplete(
        query.query,
        query.location,
        query.radius || 10,
        3
      )
    );

    // Category suggestions
    promises.push(
      this.getCategorySuggestions(
        query.query,
        query.location,
        query.radius || 25,
        2
      )
    );

    // Trending suggestions (if enabled)
    if (query.includeTrending !== false) {
      promises.push(
        this.getTrendingSuggestions(
          query.location,
          query.radius || 50,
          2
        )
      );
    }

    // Popular suggestions (if enabled)
    if (query.includePopular !== false) {
      promises.push(
        this.getPopularSuggestions(
          query.location,
          query.radius || 25,
          2
        )
      );
    }

    // Execute all suggestion sources in parallel
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        suggestions.push(...result.value);
      }
    });

    return suggestions;
  }

  /**
   * Rank suggestions by relevance and user context
   */
  private async rankSuggestions(
    suggestions: SearchSuggestion[],
    query: SuggestionQuery
  ): Promise<SearchSuggestion[]> {
    // Calculate enhanced relevance scores
    const enhancedSuggestions = suggestions.map(suggestion => {
      let score = suggestion.metadata.relevanceScore;
      
      // Boost exact matches
      if (suggestion.text.toLowerCase() === query.query.toLowerCase()) {
        score += 0.5;
      }
      
      // Boost prefix matches
      if (suggestion.text.toLowerCase().startsWith(query.query.toLowerCase())) {
        score += 0.3;
      }
      
      // Boost by type preference
      const typeBoosts = {
        'business': 0.4,
        'category': 0.3,
        'trending': 0.2,
        'query': 0.1,
        'history': 0.5,
        'location': 0.2,
      };
      score += typeBoosts[suggestion.type] || 0;
      
      // Location proximity boost
      if (query.location && suggestion.location) {
        const distance = this.calculateDistance(
          query.location.lat, query.location.lng,
          suggestion.location.lat, suggestion.location.lng
        );
        
        if (distance < 1) score += 0.3;
        else if (distance < 5) score += 0.2;
        else if (distance < 10) score += 0.1;
      }
      
      // Popularity boost
      score += (suggestion.metadata.globalPopularity / 100) * 0.2;
      
      // Recency boost
      const age = Date.now() - suggestion.metadata.lastUsed;
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      const recencyScore = Math.max(0, 1 - (age / maxAge));
      score += recencyScore * 0.1;
      
      return {
        ...suggestion,
        metadata: {
          ...suggestion.metadata,
          relevanceScore: Math.min(1.0, score),
        }
      };
    });

    // Sort by enhanced relevance score
    return enhancedSuggestions
      .filter(s => s.metadata.relevanceScore >= (query.performanceOptions?.minConfidence || this.PERFORMANCE_TARGETS.MIN_RELEVANCE_SCORE))
      .sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore);
  }

  /**
   * Generate cache key for suggestions
   */
  private generateSuggestionCacheKey(query: SuggestionQuery): string {
    const parts = [
      this.CACHE_PREFIX.SUGGESTIONS,
      query.query.toLowerCase().replace(/\s+/g, '_').substring(0, 20),
    ];
    
    if (query.location) {
      const lat = Math.round(query.location.lat * 1000) / 1000;
      const lng = Math.round(query.location.lng * 1000) / 1000;
      parts.push(`${lat}_${lng}`);
    }
    
    if (query.radius) parts.push(`r${query.radius}`);
    if (query.limit) parts.push(`l${query.limit}`);
    
    const flags = [];
    if (query.includeHistory) flags.push('h');
    if (query.includeTrending) flags.push('t');
    if (query.includePopular) flags.push('p');
    
    if (flags.length > 0) parts.push(flags.join(''));
    
    return parts.join(':');
  }

  /**
   * Cache suggestions with intelligent TTL
   */
  private async cacheSuggestions(
    cacheKey: string,
    response: SuggestionResponse
  ): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      // Dynamic TTL based on query specificity and location
      let ttl = this.CACHE_TTL.SUGGESTIONS;
      
      if (response.suggestions.length < 3) ttl = 120; // Cache sparse results for less time
      if (response.metadata.location) ttl = Math.floor(ttl * 1.5); // Location-based suggestions change less
      
      const cacheData = {
        ...response,
        responseTime: undefined, // Don't cache response time
        cacheHit: undefined,
      };

      await redisClient.setEx(cacheKey, ttl, JSON.stringify(cacheData));
      redisMetrics.trackCacheWrite(cacheKey, ttl);

    } catch (error) {
      console.error('Cache suggestions error:', error);
    }
  }

  /**
   * Get cached suggestions
   */
  private async getCachedSuggestions(cacheKey: string): Promise<SuggestionResponse | null> {
    try {
      if (!redisClient.isReady) {
        redisMetrics.trackCacheMiss(`${cacheKey}:redis_not_ready`);
        return null;
      }

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        redisMetrics.trackCacheHit(cacheKey);
        return JSON.parse(cached);
      } else {
        redisMetrics.trackCacheMiss(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('Get cached suggestions error:', error);
      redisMetrics.trackCacheMiss(`${cacheKey}:error`);
      return null;
    }
  }

  /**
   * Track suggestion impressions for analytics
   */
  private async trackSuggestionImpression(
    suggestions: SearchSuggestion[],
    query: SuggestionQuery
  ): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      const promises = suggestions.map(suggestion => {
        const impressionKey = `${this.CACHE_PREFIX.ANALYTICS}:impressions:${suggestion.id}`;
        return Promise.all([
          redisClient.incr(impressionKey),
          redisClient.expire(impressionKey, this.CACHE_TTL.ANALYTICS),
        ]);
      });

      await Promise.all(promises);
      
      // Update global impression counter
      await redisClient.incr('analytics:global:suggestion_impressions');

    } catch (error) {
      console.error('Track suggestion impression error:', error);
    }
  }

  // Additional helper methods for specific functionality

  private generateTrendingCacheKey(
    location?: { lat: number; lng: number },
    radius?: number
  ): string {
    const parts = [this.CACHE_PREFIX.TRENDING];
    
    if (location) {
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      parts.push(`${lat}_${lng}`);
      
      if (radius) parts.push(`r${radius}`);
    } else {
      parts.push('global');
    }
    
    return parts.join(':');
  }

  private generatePopularCacheKey(
    location?: { lat: number; lng: number },
    radius?: number
  ): string {
    const parts = [this.CACHE_PREFIX.POPULAR];
    
    if (location) {
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      parts.push(`${lat}_${lng}`);
      
      if (radius) parts.push(`r${radius}`);
    } else {
      parts.push('global');
    }
    
    return parts.join(':');
  }

  private async generateTrendingSuggestions(
    location?: { lat: number; lng: number },
    radius: number = 50
  ): Promise<TrendingSuggestion[]> {
    // This would analyze search patterns from the last 24-48 hours
    // For now, return mock trending data
    const mockTrending: TrendingSuggestion[] = [
      {
        query: 'coffee shops',
        category: 'restaurants',
        location: location ? { ...location, radius } : undefined,
        frequency: 45,
        growth: 23.5,
        demographics: {
          topAgeGroups: ['25-34', '35-44'],
          topTimeSlots: ['08:00', '14:00', '20:00'],
          topDaysOfWeek: ['monday', 'tuesday', 'friday'],
        },
        lastUpdated: Date.now(),
      },
      {
        query: 'italian restaurants',
        category: 'restaurants',
        location: location ? { ...location, radius } : undefined,
        frequency: 38,
        growth: 18.2,
        lastUpdated: Date.now(),
      },
    ];

    return mockTrending;
  }

  private async generatePopularSuggestions(
    location?: { lat: number; lng: number },
    radius: number = 25
  ): Promise<PopularQuery[]> {
    // This would analyze historical search data
    // For now, return mock popular data
    const mockPopular: PopularQuery[] = [
      {
        query: 'pizza',
        frequency: 156,
        averageResults: 12,
        averageRating: 4.2,
        categories: ['restaurants', 'food'],
        locations: location ? [{ ...location, weight: 1.0 }] : [],
        timePatterns: [
          { hour: 12, frequency: 25 },
          { hour: 18, frequency: 40 },
          { hour: 19, frequency: 35 },
        ],
        lastSeen: Date.now() - 3600000, // 1 hour ago
      },
      {
        query: 'grocery store',
        frequency: 124,
        averageResults: 8,
        averageRating: 3.9,
        categories: ['retail', 'groceries'],
        locations: location ? [{ ...location, weight: 1.0 }] : [],
        timePatterns: [
          { hour: 10, frequency: 20 },
          { hour: 17, frequency: 30 },
          { hour: 20, frequency: 15 },
        ],
        lastSeen: Date.now() - 1800000, // 30 minutes ago
      },
    ];

    return mockPopular;
  }

  private async getGlobalPopularCategories(): Promise<Array<{ category: string; count: number; percentage: number }>> {
    try {
      const sql = `
        SELECT 
          unnest(categories) as category,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM businesses WHERE is_active = true))::numeric, 2) as percentage
        FROM businesses
        WHERE is_active = true
        GROUP BY category
        HAVING COUNT(*) > 10
        ORDER BY count DESC
        LIMIT 20
      `;

      const result = await this.query(sql);
      return result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      }));

    } catch (error) {
      console.error('Get global popular categories error:', error);
      return [];
    }
  }

  private calculateLocationPopularity(
    locations: Array<{ lat: number; lng: number; weight: number }>,
    currentLocation: { lat: number; lng: number }
  ): number {
    if (locations.length === 0) return 0;

    // Calculate weighted popularity based on distance
    let totalWeight = 0;
    let weightedSum = 0;

    locations.forEach(loc => {
      const distance = this.calculateDistance(
        currentLocation.lat, currentLocation.lng,
        loc.lat, loc.lng
      );
      
      // Closer locations have higher influence
      const proximityWeight = Math.max(0, 1 - (distance / 50)); // 50km max influence
      const adjustedWeight = loc.weight * proximityWeight;
      
      totalWeight += adjustedWeight;
      weightedSum += adjustedWeight * 100; // Scale to percentage
    });

    return totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 0;
  }

  private calculateOverallConfidence(suggestions: SearchSuggestion[]): number {
    if (suggestions.length === 0) return 0;

    const totalConfidence = suggestions.reduce((sum, s) => sum + s.metadata.relevanceScore, 0);
    return totalConfidence / suggestions.length;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
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

  private async getTopSuggestionsFromAnalytics(): Promise<Array<{
    text: string;
    clicks: number;
    conversions: number;
    ctr: number;
  }>> {
    // This would analyze actual analytics data from Redis
    // For now, return mock data
    return [
      { text: 'pizza', clicks: 156, conversions: 89, ctr: 0.57 },
      { text: 'coffee shops', clicks: 124, conversions: 67, ctr: 0.54 },
      { text: 'grocery store', clicks: 98, conversions: 52, ctr: 0.53 },
    ];
  }
}

export const searchSuggestionService = new SearchSuggestionService();