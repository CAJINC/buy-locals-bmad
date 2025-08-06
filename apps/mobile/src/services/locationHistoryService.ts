import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationCoordinates } from './locationService';
import { GeocodingResult } from './geocodingService';

export interface LocationHistoryEntry {
  id: string;
  query: string;
  address: string;
  coordinates: LocationCoordinates;
  placeId?: string;
  timestamp: number;
  searchCount: number;
  lastUsed: number;
  source: 'search' | 'gps' | 'manual' | 'bookmark';
}

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  coordinates: LocationCoordinates;
  placeId?: string;
  category: 'home' | 'work' | 'favorite' | 'custom';
  notes?: string;
  createdAt: number;
  lastUsed: number;
}

export interface LocationSearchStats {
  totalSearches: number;
  uniqueLocations: number;
  mostSearchedLocation: string;
  averageSearchesPerDay: number;
  recentActivity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

class LocationHistoryService {
  private readonly HISTORY_STORAGE_KEY = '@buy_locals:location_history';
  private readonly SAVED_LOCATIONS_STORAGE_KEY = '@buy_locals:saved_locations';
  private readonly MAX_HISTORY_ENTRIES = 100;
  private readonly MAX_SAVED_LOCATIONS = 50;
  private readonly DUPLICATE_THRESHOLD_METERS = 100; // Consider locations within 100m as duplicates
  
  private historyCache: LocationHistoryEntry[] = [];
  private savedLocationsCache: SavedLocation[] = [];
  private initialized = false;
  
  /**
   * Initialize service by loading cached data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await Promise.all([
        this.loadLocationHistory(),
        this.loadSavedLocations()
      ]);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize LocationHistoryService:', error);
    }
  }
  
  /**
   * Add location to search history
   */
  async addToHistory(
    query: string,
    result: GeocodingResult,
    source: 'search' | 'gps' | 'manual' | 'bookmark' = 'search'
  ): Promise<void> {
    await this.initialize();
    
    try {
      const existingIndex = this.findDuplicateHistoryEntry(result);
      
      if (existingIndex !== -1) {
        // Update existing entry
        const existing = this.historyCache[existingIndex];
        existing.searchCount += 1;
        existing.lastUsed = Date.now();
        existing.query = query; // Update query to most recent
        
        // Move to front of array
        this.historyCache.splice(existingIndex, 1);
        this.historyCache.unshift(existing);
      } else {
        // Create new entry
        const newEntry: LocationHistoryEntry = {
          id: this.generateId(),
          query: query.trim(),
          address: result.formattedAddress,
          coordinates: result.coordinates,
          placeId: result.placeId,
          timestamp: Date.now(),
          searchCount: 1,
          lastUsed: Date.now(),
          source
        };
        
        this.historyCache.unshift(newEntry);
      }
      
      // Limit history size
      if (this.historyCache.length > this.MAX_HISTORY_ENTRIES) {
        this.historyCache = this.historyCache.slice(0, this.MAX_HISTORY_ENTRIES);
      }
      
      await this.persistLocationHistory();
    } catch (error) {
      console.error('Failed to add to location history:', error);
    }
  }
  
  /**
   * Get location search history
   */
  async getLocationHistory(limit: number = 20): Promise<LocationHistoryEntry[]> {
    await this.initialize();
    
    return this.historyCache
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }
  
  /**
   * Search location history
   */
  async searchHistory(query: string, limit: number = 10): Promise<LocationHistoryEntry[]> {
    await this.initialize();
    
    if (!query.trim()) {
      return this.getLocationHistory(limit);
    }
    
    const lowerQuery = query.toLowerCase();
    
    return this.historyCache
      .filter(entry => 
        entry.query.toLowerCase().includes(lowerQuery) ||
        entry.address.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Prioritize by relevance score
        const aScore = this.calculateRelevanceScore(a, lowerQuery);
        const bScore = this.calculateRelevanceScore(b, lowerQuery);
        
        if (aScore !== bScore) {
          return bScore - aScore;
        }
        
        // Then by recency
        return b.lastUsed - a.lastUsed;
      })
      .slice(0, limit);
  }
  
  /**
   * Clear location history
   */
  async clearHistory(): Promise<void> {
    try {
      this.historyCache = [];
      await AsyncStorage.removeItem(this.HISTORY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear location history:', error);
    }
  }
  
  /**
   * Remove specific history entry
   */
  async removeHistoryEntry(id: string): Promise<void> {
    try {
      this.historyCache = this.historyCache.filter(entry => entry.id !== id);
      await this.persistLocationHistory();
    } catch (error) {
      console.error('Failed to remove history entry:', error);
    }
  }
  
  /**
   * Save location as bookmark
   */
  async saveLocation(
    name: string,
    result: GeocodingResult,
    category: 'home' | 'work' | 'favorite' | 'custom' = 'custom',
    notes?: string
  ): Promise<string> {
    await this.initialize();
    
    try {
      const existingIndex = this.findDuplicateSavedLocation(result);
      
      if (existingIndex !== -1) {
        // Update existing saved location
        const existing = this.savedLocationsCache[existingIndex];
        existing.name = name.trim();
        existing.category = category;
        existing.notes = notes;
        existing.lastUsed = Date.now();
        
        await this.persistSavedLocations();
        return existing.id;
      } else {
        const savedLocation: SavedLocation = {
          id: this.generateId(),
          name: name.trim(),
          address: result.formattedAddress,
          coordinates: result.coordinates,
          placeId: result.placeId,
          category,
          notes,
          createdAt: Date.now(),
          lastUsed: Date.now()
        };
        
        this.savedLocationsCache.unshift(savedLocation);
        
        // Limit saved locations
        if (this.savedLocationsCache.length > this.MAX_SAVED_LOCATIONS) {
          this.savedLocationsCache = this.savedLocationsCache.slice(0, this.MAX_SAVED_LOCATIONS);
        }
        
        await this.persistSavedLocations();
        return savedLocation.id;
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      throw error;
    }
  }
  
  /**
   * Get saved locations
   */
  async getSavedLocations(category?: 'home' | 'work' | 'favorite' | 'custom'): Promise<SavedLocation[]> {
    await this.initialize();
    
    let locations = [...this.savedLocationsCache];
    
    if (category) {
      locations = locations.filter(loc => loc.category === category);
    }
    
    return locations.sort((a, b) => {
      // Sort by category priority, then by last used
      const categoryPriority = { home: 4, work: 3, favorite: 2, custom: 1 };
      const aPriority = categoryPriority[a.category];
      const bPriority = categoryPriority[b.category];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.lastUsed - a.lastUsed;
    });
  }
  
  /**
   * Update saved location usage
   */
  async updateSavedLocationUsage(id: string): Promise<void> {
    try {
      const location = this.savedLocationsCache.find(loc => loc.id === id);
      if (location) {
        location.lastUsed = Date.now();
        await this.persistSavedLocations();
      }
    } catch (error) {
      console.error('Failed to update saved location usage:', error);
    }
  }
  
  /**
   * Remove saved location
   */
  async removeSavedLocation(id: string): Promise<void> {
    try {
      this.savedLocationsCache = this.savedLocationsCache.filter(loc => loc.id !== id);
      await this.persistSavedLocations();
    } catch (error) {
      console.error('Failed to remove saved location:', error);
    }
  }
  
  /**
   * Get location search statistics
   */
  async getLocationStats(): Promise<LocationSearchStats> {
    await this.initialize();
    
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;
    
    const totalSearches = this.historyCache.reduce((sum, entry) => sum + entry.searchCount, 0);
    const uniqueLocations = this.historyCache.length;
    
    // Find most searched location
    const mostSearched = this.historyCache.reduce((max, entry) => 
      entry.searchCount > max.searchCount ? entry : max,
      this.historyCache[0] || { searchCount: 0, address: 'None' }
    );
    
    // Calculate recent activity
    const recentActivity = {
      today: this.historyCache.filter(entry => now - entry.lastUsed < dayMs).length,
      thisWeek: this.historyCache.filter(entry => now - entry.lastUsed < weekMs).length,
      thisMonth: this.historyCache.filter(entry => now - entry.lastUsed < monthMs).length
    };
    
    // Calculate average searches per day (based on history age)
    const oldestEntry = this.historyCache.reduce((oldest, entry) => 
      entry.timestamp < oldest.timestamp ? entry : oldest,
      this.historyCache[0] || { timestamp: now }
    );
    
    const historyAgeDays = Math.max(1, (now - oldestEntry.timestamp) / dayMs);
    const averageSearchesPerDay = totalSearches / historyAgeDays;
    
    return {
      totalSearches,
      uniqueLocations,
      mostSearchedLocation: mostSearched.address,
      averageSearchesPerDay: Math.round(averageSearchesPerDay * 10) / 10,
      recentActivity
    };
  }
  
  /**
   * Get recent searches (last 24 hours)
   */
  async getRecentSearches(limit: number = 10): Promise<LocationHistoryEntry[]> {
    await this.initialize();
    
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - dayMs;
    
    return this.historyCache
      .filter(entry => entry.lastUsed > cutoff)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }
  
  /**
   * Get frequent locations (most searched)
   */
  async getFrequentLocations(limit: number = 5): Promise<LocationHistoryEntry[]> {
    await this.initialize();
    
    return this.historyCache
      .filter(entry => entry.searchCount >= 2) // At least 2 searches
      .sort((a, b) => {
        // Sort by search count, then by recency
        if (b.searchCount !== a.searchCount) {
          return b.searchCount - a.searchCount;
        }
        return b.lastUsed - a.lastUsed;
      })
      .slice(0, limit);
  }
  
  /**
   * Find nearby saved locations
   */
  async findNearbySavedLocations(
    coordinates: LocationCoordinates,
    radiusKm: number = 5
  ): Promise<SavedLocation[]> {
    await this.initialize();
    
    return this.savedLocationsCache.filter(location => {
      const distance = this.calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        location.coordinates.latitude,
        location.coordinates.longitude
      );
      return distance <= radiusKm;
    }).sort((a, b) => {
      // Sort by distance, then by last used
      const distanceA = this.calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        a.coordinates.latitude,
        a.coordinates.longitude
      );
      const distanceB = this.calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        b.coordinates.latitude,
        b.coordinates.longitude
      );
      
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      
      return b.lastUsed - a.lastUsed;
    });
  }
  
  /**
   * Private methods
   */
  
  private async loadLocationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.HISTORY_STORAGE_KEY);
      if (stored) {
        this.historyCache = JSON.parse(stored);
        
        // Clean up expired entries (older than 90 days)
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        this.historyCache = this.historyCache.filter(entry => entry.timestamp > cutoff);
      }
    } catch (error) {
      console.error('Failed to load location history:', error);
      this.historyCache = [];
    }
  }
  
  private async loadSavedLocations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SAVED_LOCATIONS_STORAGE_KEY);
      if (stored) {
        this.savedLocationsCache = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load saved locations:', error);
      this.savedLocationsCache = [];
    }
  }
  
  private async persistLocationHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(this.historyCache));
    } catch (error) {
      console.error('Failed to persist location history:', error);
    }
  }
  
  private async persistSavedLocations(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(this.savedLocationsCache));
    } catch (error) {
      console.error('Failed to persist saved locations:', error);
    }
  }
  
  private findDuplicateHistoryEntry(result: GeocodingResult): number {
    return this.historyCache.findIndex(entry => {
      if (result.placeId && entry.placeId === result.placeId) {
        return true;
      }
      
      const distance = this.calculateDistance(
        result.coordinates.latitude,
        result.coordinates.longitude,
        entry.coordinates.latitude,
        entry.coordinates.longitude
      );
      
      return distance * 1000 < this.DUPLICATE_THRESHOLD_METERS; // Convert km to m
    });
  }
  
  private findDuplicateSavedLocation(result: GeocodingResult): number {
    return this.savedLocationsCache.findIndex(location => {
      if (result.placeId && location.placeId === result.placeId) {
        return true;
      }
      
      const distance = this.calculateDistance(
        result.coordinates.latitude,
        result.coordinates.longitude,
        location.coordinates.latitude,
        location.coordinates.longitude
      );
      
      return distance * 1000 < this.DUPLICATE_THRESHOLD_METERS; // Convert km to m
    });
  }
  
  private calculateRelevanceScore(entry: LocationHistoryEntry, query: string): number {
    let score = 0;
    
    // Exact match bonus
    if (entry.query.toLowerCase() === query) {
      score += 100;
    }
    
    // Query starts with search bonus
    if (entry.query.toLowerCase().startsWith(query)) {
      score += 50;
    }
    
    // Address contains query bonus
    if (entry.address.toLowerCase().includes(query)) {
      score += 30;
    }
    
    // Search frequency bonus
    score += Math.min(entry.searchCount * 5, 25);
    
    // Recency bonus (decay over time)
    const daysSinceUsed = (Date.now() - entry.lastUsed) / (24 * 60 * 60 * 1000);
    score += Math.max(0, 20 - daysSinceUsed);
    
    return score;
  }
  
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
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
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const locationHistoryService = new LocationHistoryService();