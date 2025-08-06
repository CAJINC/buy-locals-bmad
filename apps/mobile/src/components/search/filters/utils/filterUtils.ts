import { FilterState, CategoryOption, FilterPreset } from '../FilterPanel/types';
import { DEFAULT_FILTER_STATE, DISTANCE_CONVERSIONS } from '../FilterPanel/constants';

// Filter state utilities
export const filterUtils = {
  /**
   * Check if filters are in default state (no filters applied)
   */
  isDefaultState: (filters: FilterState): boolean => {
    return (
      filters.categories.length === 0 &&
      filters.priceRange.min === DEFAULT_FILTER_STATE.priceRange.min &&
      filters.priceRange.max === DEFAULT_FILTER_STATE.priceRange.max &&
      filters.distance.radius === DEFAULT_FILTER_STATE.distance.radius &&
      filters.rating.minimum === DEFAULT_FILTER_STATE.rating.minimum &&
      filters.hours.openNow === DEFAULT_FILTER_STATE.hours.openNow &&
      !filters.hours.specificHours &&
      filters.features.length === 0
    );
  },

  /**
   * Count active filters
   */
  countActiveFilters: (filters: FilterState): number => {
    let count = 0;
    
    if (filters.categories.length > 0) count++;
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) count++;
    if (filters.distance.radius < 25) count++;
    if (filters.rating.minimum > 0) count++;
    if (filters.hours.openNow || filters.hours.specificHours) count++;
    if (filters.features.length > 0) count++;
    
    return count;
  },

  /**
   * Generate filter summary text
   */
  generateSummary: (filters: FilterState): string => {
    const parts: string[] = [];
    
    if (filters.categories.length > 0) {
      parts.push(`${filters.categories.length} categories`);
    }
    
    if (filters.distance.radius < 25) {
      parts.push(`within ${filters.distance.radius}${filters.distance.unit}`);
    }
    
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) {
      const { min, max } = filters.priceRange;
      if (min === 0) {
        parts.push(`under $${max}`);
      } else if (max >= 1000) {
        parts.push(`$${min}+`);
      } else {
        parts.push(`$${min}-$${max}`);
      }
    }
    
    if (filters.rating.minimum > 0) {
      parts.push(`${filters.rating.minimum}★+`);
    }
    
    if (filters.hours.openNow) {
      parts.push('open now');
    }
    
    if (filters.features.length > 0) {
      parts.push(`${filters.features.length} features`);
    }
    
    return parts.join(', ') || 'No filters applied';
  },

  /**
   * Convert filters to URL query parameters
   */
  toUrlParams: (filters: FilterState): URLSearchParams => {
    const params = new URLSearchParams();
    
    if (filters.categories.length > 0) {
      params.set('categories', filters.categories.join(','));
    }
    
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) {
      params.set('price_min', filters.priceRange.min.toString());
      params.set('price_max', filters.priceRange.max.toString());
    }
    
    if (filters.distance.radius < 25) {
      params.set('radius', filters.distance.radius.toString());
      params.set('distance_unit', filters.distance.unit);
    }
    
    if (filters.rating.minimum > 0) {
      params.set('rating', filters.rating.minimum.toString());
    }
    
    if (filters.hours.openNow) {
      params.set('open_now', 'true');
    }
    
    if (filters.hours.specificHours) {
      params.set('hours', filters.hours.specificHours);
    }
    
    if (filters.features.length > 0) {
      params.set('features', filters.features.join(','));
    }
    
    return params;
  },

  /**
   * Parse filters from URL query parameters
   */
  fromUrlParams: (params: URLSearchParams): FilterState => {
    const filters: FilterState = { ...DEFAULT_FILTER_STATE };
    
    // Categories
    const categories = params.get('categories');
    if (categories) {
      filters.categories = categories.split(',');
    }
    
    // Price range
    const priceMin = params.get('price_min');
    const priceMax = params.get('price_max');
    if (priceMin) {
      filters.priceRange.min = parseInt(priceMin, 10);
    }
    if (priceMax) {
      filters.priceRange.max = parseInt(priceMax, 10);
    }
    
    // Distance
    const radius = params.get('radius');
    const distanceUnit = params.get('distance_unit');
    if (radius) {
      filters.distance.radius = parseInt(radius, 10);
    }
    if (distanceUnit === 'km' || distanceUnit === 'miles') {
      filters.distance.unit = distanceUnit;
    }
    
    // Rating
    const rating = params.get('rating');
    if (rating) {
      filters.rating.minimum = parseFloat(rating);
    }
    
    // Hours
    const openNow = params.get('open_now');
    if (openNow === 'true') {
      filters.hours.openNow = true;
    }
    
    const hours = params.get('hours');
    if (hours) {
      filters.hours.specificHours = hours;
    }
    
    // Features
    const features = params.get('features');
    if (features) {
      filters.features = features.split(',');
    }
    
    return filters;
  },

  /**
   * Merge filter states
   */
  mergeFilters: (...filterStates: Partial<FilterState>[]): FilterState => {
    return filterStates.reduce((merged, current) => ({
      ...merged,
      ...current,
      // Handle arrays specifically
      categories: current.categories || merged.categories,
      features: current.features || merged.features,
      // Handle nested objects
      priceRange: current.priceRange ? { ...merged.priceRange, ...current.priceRange } : merged.priceRange,
      distance: current.distance ? { ...merged.distance, ...current.distance } : merged.distance,
      rating: current.rating ? { ...merged.rating, ...current.rating } : merged.rating,
      hours: current.hours ? { ...merged.hours, ...current.hours } : merged.hours,
    }), DEFAULT_FILTER_STATE as FilterState);
  },

  /**
   * Convert distance between units
   */
  convertDistance: (value: number, fromUnit: 'km' | 'miles', toUnit: 'km' | 'miles'): number => {
    if (fromUnit === toUnit) return value;
    
    if (fromUnit === 'km' && toUnit === 'miles') {
      return DISTANCE_CONVERSIONS.kmToMiles(value);
    }
    
    if (fromUnit === 'miles' && toUnit === 'km') {
      return DISTANCE_CONVERSIONS.milesToKm(value);
    }
    
    return value;
  },

  /**
   * Format filter values for display
   */
  formatFilterValue: (filterType: string, value: any): string => {
    switch (filterType) {
      case 'categories':
        return Array.isArray(value) ? value.join(', ') : value;
      
      case 'priceRange':
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          const { min, max } = value;
          if (min === 0 && max >= 1000) return 'Any price';
          if (min === 0) return `Under $${max}`;
          if (max >= 1000) return `$${min}+`;
          return `$${min} - $${max}`;
        }
        return String(value);
      
      case 'distance':
        if (typeof value === 'object' && value.radius !== undefined && value.unit !== undefined) {
          return `${value.radius} ${value.unit}`;
        }
        return String(value);
      
      case 'rating':
        if (typeof value === 'object' && value.minimum !== undefined) {
          return value.minimum === 0 ? 'Any rating' : `${value.minimum}★ & up`;
        }
        return String(value);
      
      case 'features':
        return Array.isArray(value) ? value.join(', ') : value;
      
      case 'hours':
        if (typeof value === 'object') {
          const parts = [];
          if (value.openNow) parts.push('Open now');
          if (value.specificHours) parts.push(value.specificHours);
          return parts.join(', ');
        }
        return String(value);
      
      default:
        return String(value);
    }
  },

  /**
   * Check if filter value is significant (not default/empty)
   */
  isSignificantFilter: (filterType: string, value: any): boolean => {
    switch (filterType) {
      case 'categories':
      case 'features':
        return Array.isArray(value) && value.length > 0;
      
      case 'priceRange':
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          return value.min > 0 || value.max < 1000;
        }
        return false;
      
      case 'distance':
        if (typeof value === 'object' && value.radius !== undefined) {
          return value.radius < 25;
        }
        return false;
      
      case 'rating':
        if (typeof value === 'object' && value.minimum !== undefined) {
          return value.minimum > 0;
        }
        return false;
      
      case 'hours':
        if (typeof value === 'object') {
          return value.openNow || Boolean(value.specificHours);
        }
        return false;
      
      default:
        return Boolean(value);
    }
  },
};

// Category utilities
export const categoryUtils = {
  /**
   * Find category by ID in hierarchical structure
   */
  findCategory: (categories: CategoryOption[], id: string): CategoryOption | null => {
    for (const category of categories) {
      if (category.id === id) {
        return category;
      }
      
      if (category.children) {
        const found = categoryUtils.findCategory(category.children, id);
        if (found) return found;
      }
    }
    
    return null;
  },

  /**
   * Get all category IDs including children
   */
  getAllCategoryIds: (categories: CategoryOption[]): string[] => {
    const ids: string[] = [];
    
    const collectIds = (cats: CategoryOption[]) => {
      cats.forEach(cat => {
        ids.push(cat.id);
        if (cat.children) {
          collectIds(cat.children);
        }
      });
    };
    
    collectIds(categories);
    return ids;
  },

  /**
   * Get category path (parent > child)
   */
  getCategoryPath: (categories: CategoryOption[], categoryId: string): string[] => {
    const path: string[] = [];
    
    const findPath = (cats: CategoryOption[], targetId: string, currentPath: string[] = []): boolean => {
      for (const cat of cats) {
        const newPath = [...currentPath, cat.name];
        
        if (cat.id === targetId) {
          path.push(...newPath);
          return true;
        }
        
        if (cat.children && findPath(cat.children, targetId, newPath)) {
          return true;
        }
      }
      
      return false;
    };
    
    findPath(categories, categoryId);
    return path;
  },

  /**
   * Filter categories by search query
   */
  searchCategories: (categories: CategoryOption[], query: string): CategoryOption[] => {
    const searchTerm = query.toLowerCase();
    const results: CategoryOption[] = [];
    
    const searchRecursive = (cats: CategoryOption[]): CategoryOption[] => {
      return cats.reduce((filtered, cat) => {
        const matchesName = cat.name.toLowerCase().includes(searchTerm);
        const filteredChildren = cat.children ? searchRecursive(cat.children) : [];
        
        if (matchesName || filteredChildren.length > 0) {
          filtered.push({
            ...cat,
            children: filteredChildren.length > 0 ? filteredChildren : cat.children,
          });
        }
        
        return filtered;
      }, [] as CategoryOption[]);
    };
    
    return searchRecursive(categories);
  },
};

// Preset utilities
export const presetUtils = {
  /**
   * Check if current filters match a preset
   */
  matchesPreset: (filters: FilterState, preset: FilterPreset): boolean => {
    const presetFilters = filterUtils.mergeFilters(DEFAULT_FILTER_STATE, preset.filters);
    
    return (
      JSON.stringify(filters.categories.sort()) === JSON.stringify(presetFilters.categories.sort()) &&
      filters.priceRange.min === presetFilters.priceRange.min &&
      filters.priceRange.max === presetFilters.priceRange.max &&
      filters.distance.radius === presetFilters.distance.radius &&
      filters.distance.unit === presetFilters.distance.unit &&
      filters.rating.minimum === presetFilters.rating.minimum &&
      filters.hours.openNow === presetFilters.hours.openNow &&
      filters.hours.specificHours === presetFilters.hours.specificHours &&
      JSON.stringify(filters.features.sort()) === JSON.stringify(presetFilters.features.sort())
    );
  },

  /**
   * Find active preset ID from current filters
   */
  findActivePreset: (filters: FilterState, presets: FilterPreset[]): string | null => {
    for (const preset of presets) {
      if (presetUtils.matchesPreset(filters, preset)) {
        return preset.id;
      }
    }
    
    return null;
  },
};