import { logger } from '../utils/logger.js';

/**
 * Advanced Filter State Management Service
 * Handles complex filter combinations, persistence, presets, and validation
 */

export interface AdvancedFilters {
  // Location filters
  location?: {
    lat: number;
    lng: number;
    radius?: number;
  };

  // Category filters
  categories?: string[];
  includeSubcategories?: boolean;

  // Text search
  search?: string;

  // Price range filters
  priceRange?: {
    min?: number;
    max?: number;
  };

  // Rating filters
  minRating?: number;

  // Business hours filters
  businessHours?: {
    openNow?: boolean;
    is24x7?: boolean;
    specificHours?: {
      day: string;
      startTime: string;
      endTime: string;
    };
  };

  // Distance and location preferences
  maxDistance?: number;

  // Content filters
  hasPhotos?: boolean;
  minReviewCount?: number;
  recentlyAdded?: boolean; // Within last 30 days
  verifiedOnly?: boolean;

  // Sorting preferences
  sortBy?: 'distance' | 'rating' | 'price' | 'newest' | 'popularity' | 'reviewCount';
  sortOrder?: 'asc' | 'desc';

  // Pagination
  page?: number;
  limit?: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: AdvancedFilters;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
}

export interface FilterConflict {
  type: 'warning' | 'error';
  field: string;
  message: string;
  suggestedResolution?: Partial<AdvancedFilters>;
}

export interface FilterValidationResult {
  isValid: boolean;
  conflicts: FilterConflict[];
  normalizedFilters: AdvancedFilters;
  appliedFilters: string[]; // Human-readable filter descriptions
}

export interface FilterState {
  filters: AdvancedFilters;
  activeFilterCount: number;
  hasLocationFilter: boolean;
  hasCategoryFilter: boolean;
  hasTextFilter: boolean;
  hasAdvancedFilters: boolean;
  lastModified: Date;
}

export class FilterStateService {
  private readonly DEFAULT_PRESETS: FilterPreset[] = [
    {
      id: 'nearby-popular',
      name: 'Popular Nearby',
      description: 'Popular businesses within 10km',
      filters: {
        location: { lat: 0, lng: 0, radius: 10 },
        minRating: 4.0,
        sortBy: 'popularity',
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    },
    {
      id: 'highly-rated',
      name: 'Highly Rated',
      description: 'Businesses with 4.5+ stars',
      filters: {
        minRating: 4.5,
        minReviewCount: 10,
        sortBy: 'rating',
        sortOrder: 'desc',
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    },
    {
      id: 'open-now',
      name: 'Open Now',
      description: 'Businesses currently open',
      filters: {
        businessHours: { openNow: true },
        sortBy: 'distance',
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    },
    {
      id: 'new-businesses',
      name: 'Recently Added',
      description: 'New businesses added in the last 30 days',
      filters: {
        recentlyAdded: true,
        sortBy: 'newest',
        sortOrder: 'desc',
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    },
  ];

  /**
   * Validate and normalize filter combinations
   */
  validateFilters(filters: AdvancedFilters): FilterValidationResult {
    const conflicts: FilterConflict[] = [];
    const normalizedFilters = { ...filters };
    const appliedFilters: string[] = [];

    try {
      // Location validation
      if (filters.location) {
        const { lat, lng, radius } = filters.location;
        
        if (lat < -90 || lat > 90) {
          conflicts.push({
            type: 'error',
            field: 'location.lat',
            message: 'Latitude must be between -90 and 90',
            suggestedResolution: { location: { lat: Math.max(-90, Math.min(90, lat)), lng, radius } },
          });
        }

        if (lng < -180 || lng > 180) {
          conflicts.push({
            type: 'error',
            field: 'location.lng',
            message: 'Longitude must be between -180 and 180',
            suggestedResolution: { location: { lat, lng: Math.max(-180, Math.min(180, lng)), radius } },
          });
        }

        if (radius && (radius < 0.1 || radius > 100)) {
          conflicts.push({
            type: 'warning',
            field: 'location.radius',
            message: 'Search radius should be between 0.1 and 100 km',
            suggestedResolution: { location: { lat, lng, radius: Math.max(0.1, Math.min(100, radius)) } },
          });
          normalizedFilters.location!.radius = Math.max(0.1, Math.min(100, radius));
        }

        appliedFilters.push(`Within ${normalizedFilters.location.radius || 25}km of location`);
      }

      // Distance conflict resolution
      if (filters.maxDistance && filters.location?.radius) {
        if (filters.maxDistance > filters.location.radius) {
          conflicts.push({
            type: 'warning',
            field: 'maxDistance',
            message: 'Maximum distance exceeds search radius',
            suggestedResolution: { maxDistance: filters.location.radius },
          });
          normalizedFilters.maxDistance = filters.location.radius;
        }
      }

      // Price range validation
      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        if (min !== undefined && max !== undefined && min > max) {
          conflicts.push({
            type: 'error',
            field: 'priceRange',
            message: 'Minimum price cannot be greater than maximum price',
            suggestedResolution: { priceRange: { min: max, max: min } },
          });
          normalizedFilters.priceRange = { min: max, max: min };
        }

        if (min !== undefined || max !== undefined) {
          appliedFilters.push(`Price range: $${min || 0} - $${max || '∞'}`);
        }
      }

      // Rating validation
      if (filters.minRating !== undefined) {
        if (filters.minRating < 0 || filters.minRating > 5) {
          conflicts.push({
            type: 'error',
            field: 'minRating',
            message: 'Rating must be between 0 and 5',
            suggestedResolution: { minRating: Math.max(0, Math.min(5, filters.minRating)) },
          });
          normalizedFilters.minRating = Math.max(0, Math.min(5, filters.minRating));
        }

        appliedFilters.push(`${normalizedFilters.minRating}+ stars`);
      }

      // Review count validation
      if (filters.minReviewCount !== undefined) {
        if (filters.minReviewCount < 0) {
          conflicts.push({
            type: 'warning',
            field: 'minReviewCount',
            message: 'Minimum review count cannot be negative',
            suggestedResolution: { minReviewCount: 0 },
          });
          normalizedFilters.minReviewCount = 0;
        }

        if (normalizedFilters.minReviewCount > 0) {
          appliedFilters.push(`${normalizedFilters.minReviewCount}+ reviews`);
        }
      }

      // Business hours validation
      if (filters.businessHours?.specificHours) {
        const { day, startTime, endTime } = filters.businessHours.specificHours;
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        if (!validDays.includes(day.toLowerCase())) {
          conflicts.push({
            type: 'error',
            field: 'businessHours.specificHours.day',
            message: 'Invalid day of week',
          });
        }

        // Time format validation (HH:MM)
        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
          conflicts.push({
            type: 'error',
            field: 'businessHours.specificHours',
            message: 'Time must be in HH:MM format',
          });
        }
      }

      // Category validation
      if (filters.categories && filters.categories.length > 0) {
        appliedFilters.push(`Categories: ${filters.categories.join(', ')}`);
      }

      // Text search
      if (filters.search) {
        appliedFilters.push(`Search: "${filters.search}"`);
      }

      // Special filters
      if (filters.hasPhotos) appliedFilters.push('Has photos');
      if (filters.verifiedOnly) appliedFilters.push('Verified businesses only');
      if (filters.recentlyAdded) appliedFilters.push('Recently added');
      if (filters.businessHours?.openNow) appliedFilters.push('Open now');
      if (filters.businessHours?.is24x7) appliedFilters.push('24/7 businesses');

      // Pagination validation
      if (filters.page !== undefined && filters.page < 1) {
        normalizedFilters.page = 1;
      }

      if (filters.limit !== undefined && (filters.limit < 1 || filters.limit > 100)) {
        normalizedFilters.limit = Math.max(1, Math.min(100, filters.limit));
      }

      // Sort validation
      const validSorts = ['distance', 'rating', 'price', 'newest', 'popularity', 'reviewCount'];
      if (filters.sortBy && !validSorts.includes(filters.sortBy)) {
        conflicts.push({
          type: 'warning',
          field: 'sortBy',
          message: 'Invalid sort option',
          suggestedResolution: { sortBy: 'distance' },
        });
        normalizedFilters.sortBy = 'distance';
      }

      // Logical conflict checking
      if (filters.businessHours?.openNow && filters.businessHours?.specificHours) {
        conflicts.push({
          type: 'warning',
          field: 'businessHours',
          message: 'Cannot use "open now" filter with specific hours filter',
          suggestedResolution: { businessHours: { openNow: true } },
        });
        normalizedFilters.businessHours = { openNow: true };
      }

      const errorCount = conflicts.filter(c => c.type === 'error').length;
      
      return {
        isValid: errorCount === 0,
        conflicts,
        normalizedFilters,
        appliedFilters,
      };

    } catch (error) {
      logger.error('Filter validation error', {
        component: 'filter-state-service',
        operation: 'validate-filters',
        error: error instanceof Error ? error.message : String(error),
        filters,
      });

      return {
        isValid: false,
        conflicts: [{
          type: 'error',
          field: 'validation',
          message: 'Internal validation error',
        }],
        normalizedFilters: filters,
        appliedFilters: [],
      };
    }
  }

  /**
   * Analyze current filter state
   */
  analyzeFilterState(filters: AdvancedFilters): FilterState {
    const hasLocationFilter = Boolean(filters.location);
    const hasCategoryFilter = Boolean(filters.categories && filters.categories.length > 0);
    const hasTextFilter = Boolean(filters.search);
    
    const basicFilters = ['location', 'categories', 'search'];
    const advancedFilterKeys = Object.keys(filters).filter(key => !basicFilters.includes(key));
    const hasAdvancedFilters = advancedFilterKeys.some(key => filters[key as keyof AdvancedFilters] !== undefined);

    const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
      if (value === undefined || value === null) return false;
      if (key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortOrder') return false;
      if (typeof value === 'object' && Object.keys(value).length === 0) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }).length;

    return {
      filters,
      activeFilterCount,
      hasLocationFilter,
      hasCategoryFilter,
      hasTextFilter,
      hasAdvancedFilters,
      lastModified: new Date(),
    };
  }

  /**
   * Generate URL parameters from filters
   */
  filtersToUrlParams(filters: AdvancedFilters): URLSearchParams {
    const params = new URLSearchParams();

    try {
      // Location
      if (filters.location) {
        params.set('lat', filters.location.lat.toString());
        params.set('lng', filters.location.lng.toString());
        if (filters.location.radius) {
          params.set('radius', filters.location.radius.toString());
        }
      }

      // Categories
      if (filters.categories && filters.categories.length > 0) {
        params.set('categories', filters.categories.join(','));
      }

      if (filters.includeSubcategories !== undefined) {
        params.set('includeSubcategories', filters.includeSubcategories.toString());
      }

      // Search
      if (filters.search) {
        params.set('search', filters.search);
      }

      // Price range
      if (filters.priceRange) {
        if (filters.priceRange.min !== undefined) {
          params.set('priceMin', filters.priceRange.min.toString());
        }
        if (filters.priceRange.max !== undefined) {
          params.set('priceMax', filters.priceRange.max.toString());
        }
      }

      // Rating
      if (filters.minRating !== undefined) {
        params.set('minRating', filters.minRating.toString());
      }

      // Business hours
      if (filters.businessHours) {
        if (filters.businessHours.openNow) {
          params.set('openNow', 'true');
        }
        if (filters.businessHours.is24x7) {
          params.set('is24x7', 'true');
        }
        if (filters.businessHours.specificHours) {
          const { day, startTime, endTime } = filters.businessHours.specificHours;
          params.set('specificDay', day);
          params.set('specificStart', startTime);
          params.set('specificEnd', endTime);
        }
      }

      // Distance
      if (filters.maxDistance !== undefined) {
        params.set('maxDistance', filters.maxDistance.toString());
      }

      // Boolean filters
      if (filters.hasPhotos) params.set('hasPhotos', 'true');
      if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
      if (filters.recentlyAdded) params.set('recentlyAdded', 'true');

      // Review count
      if (filters.minReviewCount !== undefined) {
        params.set('minReviewCount', filters.minReviewCount.toString());
      }

      // Sorting
      if (filters.sortBy) {
        params.set('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.set('sortOrder', filters.sortOrder);
      }

      // Pagination
      if (filters.page !== undefined && filters.page !== 1) {
        params.set('page', filters.page.toString());
      }
      if (filters.limit !== undefined && filters.limit !== 10) {
        params.set('limit', filters.limit.toString());
      }

      return params;

    } catch (error) {
      logger.error('URL serialization error', {
        component: 'filter-state-service',
        operation: 'filters-to-url-params',
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      return new URLSearchParams();
    }
  }

  /**
   * Parse URL parameters to filters
   */
  urlParamsToFilters(params: URLSearchParams): AdvancedFilters {
    const filters: AdvancedFilters = {};

    try {
      // Location
      const lat = params.get('lat');
      const lng = params.get('lng');
      const radius = params.get('radius');

      if (lat && lng) {
        filters.location = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: radius ? parseFloat(radius) : undefined,
        };
      }

      // Categories
      const categories = params.get('categories');
      if (categories) {
        filters.categories = categories.split(',').filter(Boolean);
      }

      const includeSubcategories = params.get('includeSubcategories');
      if (includeSubcategories) {
        filters.includeSubcategories = includeSubcategories === 'true';
      }

      // Search
      const search = params.get('search');
      if (search) {
        filters.search = search;
      }

      // Price range
      const priceMin = params.get('priceMin');
      const priceMax = params.get('priceMax');
      if (priceMin || priceMax) {
        filters.priceRange = {
          min: priceMin ? parseFloat(priceMin) : undefined,
          max: priceMax ? parseFloat(priceMax) : undefined,
        };
      }

      // Rating
      const minRating = params.get('minRating');
      if (minRating) {
        filters.minRating = parseFloat(minRating);
      }

      // Business hours
      const openNow = params.get('openNow');
      const is24x7 = params.get('is24x7');
      const specificDay = params.get('specificDay');
      const specificStart = params.get('specificStart');
      const specificEnd = params.get('specificEnd');

      if (openNow || is24x7 || specificDay) {
        filters.businessHours = {
          openNow: openNow === 'true',
          is24x7: is24x7 === 'true',
          specificHours: specificDay && specificStart && specificEnd ? {
            day: specificDay,
            startTime: specificStart,
            endTime: specificEnd,
          } : undefined,
        };
      }

      // Distance
      const maxDistance = params.get('maxDistance');
      if (maxDistance) {
        filters.maxDistance = parseFloat(maxDistance);
      }

      // Boolean filters
      if (params.get('hasPhotos') === 'true') filters.hasPhotos = true;
      if (params.get('verifiedOnly') === 'true') filters.verifiedOnly = true;
      if (params.get('recentlyAdded') === 'true') filters.recentlyAdded = true;

      // Review count
      const minReviewCount = params.get('minReviewCount');
      if (minReviewCount) {
        filters.minReviewCount = parseInt(minReviewCount);
      }

      // Sorting
      const sortBy = params.get('sortBy');
      if (sortBy) {
        filters.sortBy = sortBy as AdvancedFilters['sortBy'];
      }

      const sortOrder = params.get('sortOrder');
      if (sortOrder) {
        filters.sortOrder = sortOrder as AdvancedFilters['sortOrder'];
      }

      // Pagination
      const page = params.get('page');
      if (page) {
        filters.page = parseInt(page);
      }

      const limit = params.get('limit');
      if (limit) {
        filters.limit = parseInt(limit);
      }

      return filters;

    } catch (error) {
      logger.error('URL parsing error', {
        component: 'filter-state-service',
        operation: 'url-params-to-filters',
        error: error instanceof Error ? error.message : String(error),
        params: params.toString(),
      });
      return {};
    }
  }

  /**
   * Get default filter presets
   */
  getDefaultPresets(): FilterPreset[] {
    return [...this.DEFAULT_PRESETS];
  }

  /**
   * Create custom filter preset
   */
  createCustomPreset(
    name: string,
    filters: AdvancedFilters,
    description?: string
  ): FilterPreset {
    const validation = this.validateFilters(filters);
    
    if (!validation.isValid) {
      throw new Error(`Invalid filters for preset: ${validation.conflicts.map(c => c.message).join(', ')}`);
    }

    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      filters: validation.normalizedFilters,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };
  }

  /**
   * Apply preset to current filters
   */
  applyPreset(preset: FilterPreset, currentLocation?: { lat: number; lng: number }): AdvancedFilters {
    const presetFilters = { ...preset.filters };
    
    // Update location if preset has location but no coordinates, and current location is available
    if (presetFilters.location && currentLocation) {
      presetFilters.location = {
        ...presetFilters.location,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      };
    }

    return presetFilters;
  }

  /**
   * Generate filter breadcrumbs for UI display
   */
  generateFilterBreadcrumbs(filters: AdvancedFilters): Array<{
    id: string;
    label: string;
    value: string;
    removable: boolean;
    filterPath: string;
  }> {
    const breadcrumbs: Array<{
      id: string;
      label: string;
      value: string;
      removable: boolean;
      filterPath: string;
    }> = [];

    try {
      // Location breadcrumb
      if (filters.location) {
        breadcrumbs.push({
          id: 'location',
          label: 'Location',
          value: `Within ${filters.location.radius || 25}km`,
          removable: true,
          filterPath: 'location',
        });
      }

      // Category breadcrumbs
      if (filters.categories && filters.categories.length > 0) {
        filters.categories.forEach((category, index) => {
          breadcrumbs.push({
            id: `category_${index}`,
            label: 'Category',
            value: category,
            removable: true,
            filterPath: `categories[${index}]`,
          });
        });
      }

      // Search breadcrumb
      if (filters.search) {
        breadcrumbs.push({
          id: 'search',
          label: 'Search',
          value: `"${filters.search}"`,
          removable: true,
          filterPath: 'search',
        });
      }

      // Price range breadcrumb
      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        const priceText = min !== undefined && max !== undefined
          ? `$${min} - $${max}`
          : min !== undefined
            ? `$${min}+`
            : `Under $${max}`;
            
        breadcrumbs.push({
          id: 'priceRange',
          label: 'Price',
          value: priceText,
          removable: true,
          filterPath: 'priceRange',
        });
      }

      // Rating breadcrumb
      if (filters.minRating !== undefined) {
        breadcrumbs.push({
          id: 'rating',
          label: 'Rating',
          value: `${filters.minRating}+ stars`,
          removable: true,
          filterPath: 'minRating',
        });
      }

      // Business hours breadcrumbs
      if (filters.businessHours?.openNow) {
        breadcrumbs.push({
          id: 'openNow',
          label: 'Hours',
          value: 'Open now',
          removable: true,
          filterPath: 'businessHours.openNow',
        });
      }

      if (filters.businessHours?.is24x7) {
        breadcrumbs.push({
          id: 'is24x7',
          label: 'Hours',
          value: '24/7',
          removable: true,
          filterPath: 'businessHours.is24x7',
        });
      }

      // Boolean filter breadcrumbs
      if (filters.hasPhotos) {
        breadcrumbs.push({
          id: 'hasPhotos',
          label: 'Content',
          value: 'Has photos',
          removable: true,
          filterPath: 'hasPhotos',
        });
      }

      if (filters.verifiedOnly) {
        breadcrumbs.push({
          id: 'verified',
          label: 'Status',
          value: 'Verified only',
          removable: true,
          filterPath: 'verifiedOnly',
        });
      }

      if (filters.recentlyAdded) {
        breadcrumbs.push({
          id: 'recent',
          label: 'Recency',
          value: 'Recently added',
          removable: true,
          filterPath: 'recentlyAdded',
        });
      }

      // Review count breadcrumb
      if (filters.minReviewCount !== undefined && filters.minReviewCount > 0) {
        breadcrumbs.push({
          id: 'reviewCount',
          label: 'Reviews',
          value: `${filters.minReviewCount}+ reviews`,
          removable: true,
          filterPath: 'minReviewCount',
        });
      }

      return breadcrumbs;

    } catch (error) {
      logger.error('Breadcrumb generation error', {
        component: 'filter-state-service',
        operation: 'generate-breadcrumbs',
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      return [];
    }
  }

  /**
   * Clear specific filter by path
   */
  clearFilter(filters: AdvancedFilters, filterPath: string): AdvancedFilters {
    const updatedFilters = { ...filters };

    try {
      // Handle nested paths like 'businessHours.openNow'
      if (filterPath.includes('.')) {
        const [parentKey, childKey] = filterPath.split('.');
        if (updatedFilters[parentKey as keyof AdvancedFilters] && typeof updatedFilters[parentKey as keyof AdvancedFilters] === 'object') {
          delete (updatedFilters[parentKey as keyof AdvancedFilters] as any)[childKey];
          
          // Remove parent if empty
          if (Object.keys(updatedFilters[parentKey as keyof AdvancedFilters] as any).length === 0) {
            delete updatedFilters[parentKey as keyof AdvancedFilters];
          }
        }
      }
      // Handle array index paths like 'categories[0]'
      else if (filterPath.includes('[')) {
        const match = filterPath.match(/^(\w+)\[(\d+)\]$/);
        if (match) {
          const [, arrayKey, indexStr] = match;
          const index = parseInt(indexStr);
          const array = updatedFilters[arrayKey as keyof AdvancedFilters] as any[];
          if (Array.isArray(array) && index >= 0 && index < array.length) {
            array.splice(index, 1);
            if (array.length === 0) {
              delete updatedFilters[arrayKey as keyof AdvancedFilters];
            }
          }
        }
      }
      // Handle direct property paths
      else {
        delete updatedFilters[filterPath as keyof AdvancedFilters];
      }

      return updatedFilters;

    } catch (error) {
      logger.error('Filter clearing error', {
        component: 'filter-state-service',
        operation: 'clear-filter',
        error: error instanceof Error ? error.message : String(error),
        filterPath,
        filters,
      });
      return filters;
    }
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): AdvancedFilters {
    return {};
  }
}

export const filterStateService = new FilterStateService();