import { BaseRepository } from '../repositories/BaseRepository.js';
import { redisClient, cacheKeys, redisMetrics } from '../config/redis.js';
import { 
  getAllCategories, 
  getAllSubcategories, 
  getCategoryMetadata,
  getCategorySubcategories,
  getParentCategory,
  BUSINESS_CATEGORY_OPTIONS,
  CategoryMetadata,
  BusinessCategory,
  expandCategoryFilter,
  CategoryFilter
} from '../constants/businessCategories.js';
import { logger } from '../utils/logger.js';

export interface CategorySearchResult {
  category: string;
  label: string;
  icon: string;
  description: string;
  businessCount: number;
  averageRating: number;
  popularityScore: number;
  subcategories?: CategorySearchResult[];
}

export interface CategoryAggregation {
  category: string;
  count: number;
  percentage: number;
  averageRating?: number;
  subcategoryBreakdown?: { subcategory: string; count: number }[];
}

export interface CategoryPopularityData {
  category: string;
  searchCount: number;
  clickCount: number;
  conversionRate: number;
  lastUpdated: string;
  trendScore: number; // -100 to +100
}

export class CategoryService extends BaseRepository<any> {
  private readonly CACHE_TTL = 1800; // 30 minutes
  private readonly POPULARITY_CACHE_TTL = 3600; // 1 hour
  private readonly ANALYTICS_CACHE_TTL = 86400; // 24 hours

  constructor() {
    super('businesses');
  }

  /**
   * Get category results with business counts for a specific location
   */
  async getCategoryResultCounts(
    lat: number,
    lng: number,
    radius: number = 25,
    includeSubcategories: boolean = true
  ): Promise<CategorySearchResult[]> {
    const startTime = Date.now();
    const cacheKey = `category_counts:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${includeSubcategories}`;

    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          return JSON.parse(cached);
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      // Query business counts by category within location
      const countQuery = `
        WITH location_businesses AS (
          SELECT 
            categories,
            (SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id) as avg_rating
          FROM businesses
          WHERE is_active = true
            AND location_point IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              location_point::geography,
              $3 * 1000
            )
        ),
        category_stats AS (
          SELECT 
            unnest(categories) as category,
            COUNT(*) as business_count,
            AVG(COALESCE(avg_rating, 4.0)) as avg_rating
          FROM location_businesses
          GROUP BY category
        )
        SELECT 
          category,
          business_count::int,
          ROUND(avg_rating::numeric, 2) as avg_rating
        FROM category_stats
        ORDER BY business_count DESC
      `;

      const result = await this.query(countQuery, [lat, lng, radius]);
      const categoryStats = new Map(
        result.rows.map(row => [
          row.category,
          {
            count: parseInt(row.business_count),
            averageRating: parseFloat(row.avg_rating)
          }
        ])
      );

      // Build enhanced category results with metadata
      const categoryResults: CategorySearchResult[] = [];
      
      for (const categoryOption of BUSINESS_CATEGORY_OPTIONS) {
        const mainCategoryStats = categoryStats.get(categoryOption.value) || { count: 0, averageRating: 4.0 };
        
        // Calculate subcategory counts if requested
        let subcategories: CategorySearchResult[] | undefined;
        let totalCount = mainCategoryStats.count;
        
        if (includeSubcategories) {
          subcategories = categoryOption.subcategories.map(subcat => {
            const subcatStats = categoryStats.get(subcat) || { count: 0, averageRating: 4.0 };
            totalCount += subcatStats.count;
            
            return {
              category: subcat,
              label: this.formatSubcategoryLabel(subcat),
              icon: this.getSubcategoryIcon(subcat),
              description: `${categoryOption.label} - ${this.formatSubcategoryLabel(subcat)}`,
              businessCount: subcatStats.count,
              averageRating: subcatStats.averageRating,
              popularityScore: await this.getCategoryPopularityScore(subcat)
            };
          }).filter(sub => sub.businessCount > 0); // Only include subcategories with businesses
        }

        if (totalCount > 0) {
          categoryResults.push({
            category: categoryOption.value,
            label: categoryOption.label,
            icon: categoryOption.icon,
            description: categoryOption.description,
            businessCount: totalCount,
            averageRating: mainCategoryStats.averageRating,
            popularityScore: categoryOption.popularity,
            subcategories: subcategories?.length ? subcategories : undefined
          });
        }
      }

      // Sort by business count and popularity
      const sortedResults = categoryResults.sort((a, b) => {
        const scoreA = a.businessCount * 0.7 + a.popularityScore * 0.3;
        const scoreB = b.businessCount * 0.7 + b.popularityScore * 0.3;
        return scoreB - scoreA;
      });

      // Cache results
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(sortedResults));
        redisMetrics.trackCacheWrite(cacheKey, this.CACHE_TTL);
      }

      logger.performance('Category result counts query', {
        component: 'category-service',
        operation: 'category-result-counts',
        duration: Date.now() - startTime,
        location: { lat, lng, radius },
        categoriesFound: sortedResults.length
      });

      return sortedResults;
    } catch (error) {
      logger.error('Get category result counts error', {
        component: 'category-service',
        operation: 'category-result-counts',
        error: error instanceof Error ? error.message : String(error),
        location: { lat, lng, radius }
      });
      throw error;
    }
  }

  /**
   * Get category aggregation for search results analysis
   */
  async getCategoryAggregation(
    lat: number,
    lng: number,
    radius: number = 25,
    categoryFilter?: string[]
  ): Promise<CategoryAggregation[]> {
    const startTime = Date.now();
    const cacheKey = `category_agg:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${categoryFilter?.join(',') || 'all'}`;

    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          return JSON.parse(cached);
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      // Build category filter condition
      let categoryCondition = '';
      const queryParams: any[] = [lat, lng, radius];
      let paramIndex = 4;

      if (categoryFilter && categoryFilter.length > 0) {
        categoryCondition = `AND categories && $${paramIndex}`;
        queryParams.push(categoryFilter);
        paramIndex++;
      }

      // Query for category aggregation with subcategory breakdown
      const aggregationQuery = `
        WITH location_businesses AS (
          SELECT 
            categories,
            (SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id) as avg_rating
          FROM businesses
          WHERE is_active = true
            AND location_point IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              location_point::geography,
              $3 * 1000
            )
            ${categoryCondition}
        ),
        total_count AS (
          SELECT COUNT(*) as total FROM location_businesses
        ),
        category_breakdown AS (
          SELECT 
            unnest(categories) as category,
            COUNT(*) as count,
            AVG(COALESCE(avg_rating, 4.0)) as avg_rating,
            ROUND((COUNT(*)::float / (SELECT total FROM total_count) * 100)::numeric, 2) as percentage
          FROM location_businesses
          GROUP BY category
        )
        SELECT 
          category,
          count::int,
          percentage::float,
          ROUND(avg_rating::numeric, 2) as avg_rating
        FROM category_breakdown
        ORDER BY count DESC
      `;

      const result = await this.query(aggregationQuery, queryParams);
      
      const aggregations: CategoryAggregation[] = result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
        averageRating: parseFloat(row.avg_rating)
      }));

      // Add subcategory breakdown for main categories
      for (const agg of aggregations) {
        if (getAllCategories().includes(agg.category)) {
          const subcats = getCategorySubcategories(agg.category);
          if (subcats.length > 0) {
            const subcatCounts = result.rows
              .filter(row => subcats.includes(row.category))
              .map(row => ({
                subcategory: row.category,
                count: parseInt(row.count)
              }));
            
            if (subcatCounts.length > 0) {
              agg.subcategoryBreakdown = subcatCounts;
            }
          }
        }
      }

      // Cache results
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(aggregations));
        redisMetrics.trackCacheWrite(cacheKey, this.CACHE_TTL);
      }

      logger.performance('Category aggregation query', {
        component: 'category-service',
        operation: 'category-aggregation',
        duration: Date.now() - startTime,
        location: { lat, lng, radius },
        resultCount: aggregations.length
      });

      return aggregations;
    } catch (error) {
      logger.error('Get category aggregation error', {
        component: 'category-service',
        operation: 'category-aggregation',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Track category search and interaction for popularity scoring
   */
  async trackCategoryInteraction(
    category: string,
    interactionType: 'search' | 'click' | 'conversion',
    metadata?: {
      location?: { lat: number; lng: number };
      searchQuery?: string;
      userId?: string;
    }
  ): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      const timestamp = Date.now();
      const dateKey = new Date().toISOString().split('T')[0];
      
      // Track interaction counters
      const trackingKeys = [
        `category_analytics:${category}:${interactionType}:${dateKey}`,
        `category_analytics:${category}:${interactionType}:total`,
        `category_analytics:global:${interactionType}:${dateKey}`
      ];

      const promises = trackingKeys.map(key => redisClient.incr(key));
      
      // Set expiration for daily counters (30 days)
      promises.push(
        redisClient.expire(`category_analytics:${category}:${interactionType}:${dateKey}`, 2592000),
        redisClient.expire(`category_analytics:global:${interactionType}:${dateKey}`, 2592000)
      );

      // Store detailed interaction data
      if (metadata) {
        const interactionData = {
          category,
          type: interactionType,
          timestamp,
          metadata
        };
        
        const interactionKey = `category_interaction:${category}:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
        promises.push(
          redisClient.setEx(interactionKey, 604800, JSON.stringify(interactionData)) // 7 days
        );
      }

      await Promise.all(promises);

      // Update category popularity score in background
      this.updateCategoryPopularityScore(category).catch(error => 
        logger.error('Category popularity update error', { category, error })
      );

    } catch (error) {
      logger.error('Track category interaction error', {
        component: 'category-service',
        operation: 'track-interaction',
        category,
        interactionType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get category popularity analytics
   */
  async getCategoryPopularityData(
    category?: string,
    timeframe: '24h' | '7d' | '30d' = '7d'
  ): Promise<CategoryPopularityData[]> {
    const cacheKey = `category_popularity:${category || 'all'}:${timeframe}`;
    
    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          return JSON.parse(cached);
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      const categoriesToAnalyze = category ? [category] : getAllCategories();
      const popularityData: CategoryPopularityData[] = [];

      for (const cat of categoriesToAnalyze) {
        const data = await this.calculateCategoryPopularityMetrics(cat, timeframe);
        if (data) {
          popularityData.push(data);
        }
      }

      // Sort by trend score and popularity
      popularityData.sort((a, b) => b.trendScore - a.trendScore);

      // Cache results
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, this.POPULARITY_CACHE_TTL, JSON.stringify(popularityData));
        redisMetrics.trackCacheWrite(cacheKey, this.POPULARITY_CACHE_TTL);
      }

      return popularityData;
    } catch (error) {
      logger.error('Get category popularity data error', {
        component: 'category-service',
        operation: 'popularity-data',
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Build SQL WHERE clause for multiple category filtering (OR logic)
   */
  buildCategoryFilterQuery(categories: string[]): { condition: string; params: string[] } {
    if (!categories || categories.length === 0) {
      return { condition: '', params: [] };
    }

    // Expand categories to include subcategories if needed
    const expandedCategories = expandCategoryFilter({ 
      categories, 
      includeSubcategories: true 
    });

    const condition = 'AND categories && $?';
    return { condition, params: expandedCategories };
  }

  /**
   * Get trending categories based on recent interaction patterns
   */
  async getTrendingCategories(limit: number = 10): Promise<CategorySearchResult[]> {
    const cacheKey = `trending_categories:${limit}`;

    try {
      // Try cache first
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          redisMetrics.trackCacheHit(cacheKey);
          return JSON.parse(cached);
        }
        redisMetrics.trackCacheMiss(cacheKey);
      }

      const popularityData = await this.getCategoryPopularityData(undefined, '24h');
      const trendingCategories: CategorySearchResult[] = [];

      for (const data of popularityData.slice(0, limit)) {
        const metadata = getCategoryMetadata(data.category);
        if (metadata) {
          // Get current business count (could be cached for performance)
          const businessCount = await this.getCategoryBusinessCount(data.category);
          
          trendingCategories.push({
            category: data.category,
            label: metadata.label,
            icon: metadata.icon,
            description: metadata.description,
            businessCount,
            averageRating: 4.0, // Could calculate actual average
            popularityScore: data.trendScore
          });
        }
      }

      // Cache results for 1 hour
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(trendingCategories));
        redisMetrics.trackCacheWrite(cacheKey, 3600);
      }

      return trendingCategories;
    } catch (error) {
      logger.error('Get trending categories error', {
        component: 'category-service',
        operation: 'trending-categories',
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Update category business counts and ratings (background task)
   */
  async updateCategoryMetadata(): Promise<void> {
    try {
      const updateQuery = `
        WITH category_stats AS (
          SELECT 
            unnest(categories) as category,
            COUNT(*) as business_count,
            AVG(COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id), 4.0)) as avg_rating
          FROM businesses
          WHERE is_active = true
          GROUP BY category
        )
        SELECT category, business_count::int, ROUND(avg_rating::numeric, 2) as avg_rating
        FROM category_stats
      `;

      const result = await this.query(updateQuery, []);
      
      // Update cached category metadata
      for (const row of result.rows) {
        const cacheKey = `category_metadata:${row.category}`;
        const metadata = {
          businessCount: parseInt(row.business_count),
          averageRating: parseFloat(row.avg_rating),
          lastUpdated: new Date().toISOString()
        };
        
        if (redisClient.isReady) {
          await redisClient.setEx(cacheKey, 3600, JSON.stringify(metadata));
        }
      }

      logger.info('Category metadata updated', {
        component: 'category-service',
        operation: 'update-metadata',
        categoriesUpdated: result.rows.length
      });

    } catch (error) {
      logger.error('Update category metadata error', {
        component: 'category-service',
        operation: 'update-metadata',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Private helper methods

  private formatSubcategoryLabel(subcategory: string): string {
    return subcategory
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getSubcategoryIcon(subcategory: string): string {
    const iconMap: Record<string, string> = {
      // Restaurant subcategories
      fast_food: '🍔',
      fine_dining: '🍽️',
      casual_dining: '🍴',
      cafes: '☕',
      bars: '🍺',
      // Retail subcategories  
      clothing: '👕',
      electronics: '📱',
      books: '📚',
      grocery: '🛒',
      pharmacy: '💊',
      // Add more as needed
    };
    
    return iconMap[subcategory] || '📍';
  }

  private async getCategoryPopularityScore(category: string): Promise<number> {
    try {
      if (!redisClient.isReady) return 50; // Default score

      const popularityKey = `category_popularity_score:${category}`;
      const cached = await redisClient.get(popularityKey);
      
      return cached ? parseInt(cached) : 50;
    } catch {
      return 50;
    }
  }

  private async updateCategoryPopularityScore(category: string): Promise<void> {
    try {
      if (!redisClient.isReady) return;

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [todaySearches, todayClicks, yesterdaySearches, yesterdayClicks] = await Promise.all([
        redisClient.get(`category_analytics:${category}:search:${today}`).then(val => parseInt(val || '0')),
        redisClient.get(`category_analytics:${category}:click:${today}`).then(val => parseInt(val || '0')),
        redisClient.get(`category_analytics:${category}:search:${yesterday}`).then(val => parseInt(val || '0')),
        redisClient.get(`category_analytics:${category}:click:${yesterday}`).then(val => parseInt(val || '0'))
      ]);

      // Calculate trend score (-100 to +100)
      const todayActivity = todaySearches + todayClicks;
      const yesterdayActivity = yesterdaySearches + yesterdayClicks;
      
      let trendScore = 0;
      if (yesterdayActivity > 0) {
        const growth = ((todayActivity - yesterdayActivity) / yesterdayActivity) * 100;
        trendScore = Math.max(-100, Math.min(100, growth));
      } else if (todayActivity > 0) {
        trendScore = 100; // New trending category
      }

      // Update popularity score (weighted average of base popularity and trend)
      const basePopularity = getCategoryMetadata(category)?.popularity || 50;
      const newScore = Math.round(basePopularity * 0.7 + (trendScore + 100) * 0.3);
      
      await redisClient.setEx(`category_popularity_score:${category}`, 3600, newScore.toString());

    } catch (error) {
      logger.error('Update category popularity score error', { category, error });
    }
  }

  private async calculateCategoryPopularityMetrics(
    category: string,
    timeframe: '24h' | '7d' | '30d'
  ): Promise<CategoryPopularityData | null> {
    try {
      if (!redisClient.isReady) return null;

      const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
      const promises: Promise<number>[] = [];
      
      let totalSearches = 0;
      let totalClicks = 0;
      let totalConversions = 0;

      // Aggregate data over the timeframe
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        
        promises.push(
          redisClient.get(`category_analytics:${category}:search:${date}`).then(val => parseInt(val || '0')),
          redisClient.get(`category_analytics:${category}:click:${date}`).then(val => parseInt(val || '0')),
          redisClient.get(`category_analytics:${category}:conversion:${date}`).then(val => parseInt(val || '0'))
        );
      }

      const results = await Promise.all(promises);
      
      // Sum up the results
      for (let i = 0; i < results.length; i += 3) {
        totalSearches += results[i];
        totalClicks += results[i + 1];
        totalConversions += results[i + 2];
      }

      const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      
      // Calculate trend score (simplified)
      const currentActivity = totalSearches + totalClicks;
      const trendScore = Math.min(100, Math.max(-100, currentActivity - 50));

      return {
        category,
        searchCount: totalSearches,
        clickCount: totalClicks,
        conversionRate: Math.round(conversionRate * 100) / 100,
        lastUpdated: new Date().toISOString(),
        trendScore
      };

    } catch (error) {
      logger.error('Calculate category popularity metrics error', { category, timeframe, error });
      return null;
    }
  }

  private async getCategoryBusinessCount(category: string): Promise<number> {
    try {
      const cacheKey = `category_business_count:${category}`;
      
      if (redisClient.isReady) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return parseInt(cached);
        }
      }

      const query = `
        SELECT COUNT(*) as count
        FROM businesses
        WHERE is_active = true AND $1 = ANY(categories)
      `;
      
      const result = await this.query(query, [category]);
      const count = parseInt(result.rows[0].count);

      // Cache for 1 hour
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, 3600, count.toString());
      }

      return count;
    } catch {
      return 0;
    }
  }
}

export const categoryService = new CategoryService();