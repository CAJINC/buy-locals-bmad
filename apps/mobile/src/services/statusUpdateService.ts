import { BusinessStatus } from '../hooks/useBusinessStatus';
import { mobilePerformanceOptimizer } from './mobilePerformanceOptimizer';

export interface StatusUpdateCache {
  businessId: string;
  status: BusinessStatus;
  lastUpdated: number;
  expiresAt: number;
}

export class StatusUpdateService {
  private cache: Map<string, StatusUpdateCache> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly UPDATE_THRESHOLD = 30 * 1000; // 30 seconds
  private apiBaseUrl: string = __DEV__ ? 'http://localhost:3001' : '';

  constructor() {}

  /**
   * Get cached status or fetch fresh if expired
   */
  async getBusinessStatus(businessId: string): Promise<BusinessStatus | null> {
    const cached = this.cache.get(businessId);
    const now = Date.now();

    // Return cached if still valid
    if (cached && cached.expiresAt > now) {
      return cached.status;
    }

    // Fetch fresh status using performance optimizer
    try {
      const status = await mobilePerformanceOptimizer.optimizeNetworkRequest(
        () => this.fetchBusinessStatus(businessId),
        {
          cacheKey: `business-status-${businessId}`,
          priority: 'medium',
          timeout: 5000
        }
      );
      
      if (status) {
        this.updateCache(businessId, status);
      }
      return status;
    } catch (error) {
      console.error(`Error fetching status for business ${businessId}:`, error);
      // Return stale cache if available
      return cached?.status || null;
    }
  }

  /**
   * Update status in cache and optionally persist
   */
  updateBusinessStatus(businessId: string, status: BusinessStatus): void {
    this.updateCache(businessId, status);
  }

  /**
   * Batch get multiple business statuses
   */
  async getBatchBusinessStatuses(businessIds: string[]): Promise<Map<string, BusinessStatus>> {
    const results = new Map<string, BusinessStatus>();
    const uncachedIds: string[] = [];
    const now = Date.now();

    // Check cache first
    for (const businessId of businessIds) {
      const cached = this.cache.get(businessId);
      if (cached && cached.expiresAt > now) {
        results.set(businessId, cached.status);
      } else {
        uncachedIds.push(businessId);
      }
    }

    // Fetch uncached statuses in parallel
    if (uncachedIds.length > 0) {
      const promises = uncachedIds.map(async (businessId) => {
        try {
          const status = await this.fetchBusinessStatus(businessId);
          if (status) {
            this.updateCache(businessId, status);
            results.set(businessId, status);
          }
        } catch (error) {
          console.error(`Error fetching status for business ${businessId}:`, error);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Get businesses currently open in location
   */
  async getOpenBusinessesInLocation(
    lat: number,
    lng: number,
    radius: number = 25
  ): Promise<BusinessStatus[]> {
    try {
      const response = await mobilePerformanceOptimizer.optimizeNetworkRequest(
        () => fetch(`${this.apiBaseUrl}/api/businesses/open?lat=${lat}&lng=${lng}&radius=${radius}`).then(r => r.json()),
        {
          cacheKey: `open-businesses-${lat}-${lng}-${radius}`,
          priority: 'high',
          timeout: 8000
        }
      );

      return response.data.map((business: any) => ({
        businessId: business.id,
        isOpen: business.isOpen,
        status: business.status,
        reason: business.reason || 'Regular hours',
        nextChange: business.nextChange,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching open businesses:', error);
      return [];
    }
  }

  /**
   * Preload statuses for upcoming searches
   */
  async preloadStatuses(businessIds: string[]): Promise<void> {
    const now = Date.now();
    const toPreload = businessIds.filter(id => {
      const cached = this.cache.get(id);
      return !cached || cached.expiresAt - now < this.UPDATE_THRESHOLD;
    });

    if (toPreload.length > 0) {
      await this.getBatchBusinessStatuses(toPreload);
    }
  }

  /**
   * Check if status needs refresh
   */
  needsRefresh(businessId: string): boolean {
    const cached = this.cache.get(businessId);
    if (!cached) return true;

    const now = Date.now();
    return cached.expiresAt - now < this.UPDATE_THRESHOLD;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [businessId, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now) {
        this.cache.delete(businessId);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
  } {
    const now = Date.now();
    let expired = 0;
    
    for (const cached of this.cache.values()) {
      if (cached.expiresAt <= now) {
        expired++;
      }
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expired,
      hitRate: this.cache.size > 0 ? (this.cache.size - expired) / this.cache.size : 0,
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Private: Fetch status from API
   */
  private async fetchBusinessStatus(businessId: string): Promise<BusinessStatus | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/businesses/${businessId}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        businessId,
        isOpen: data.isOpen,
        status: data.status,
        reason: data.reason,
        nextChange: data.nextChange,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`API error for business ${businessId}:`, error);
      throw error;
    }
  }

  /**
   * Private: Update cache entry
   */
  private updateCache(businessId: string, status: BusinessStatus): void {
    const now = Date.now();
    this.cache.set(businessId, {
      businessId,
      status,
      lastUpdated: now,
      expiresAt: now + this.CACHE_DURATION,
    });
  }
}