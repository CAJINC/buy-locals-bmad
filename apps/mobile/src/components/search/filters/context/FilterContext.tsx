import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { LocationCoordinates } from '../../../services/locationService';
import { enhancedLocationSearchService } from '../../../services/enhancedLocationSearchService';
import { FilterState, FilterTheme, CategoryOption } from '../FilterPanel/types';
import { DEFAULT_FILTER_STATE, DEFAULT_CATEGORIES } from '../FilterPanel/constants';
import { useFilterState } from '../hooks/useFilterState';
import { useFilterAnalytics } from '../hooks/useFilterAnalytics';

interface FilterContextValue {
  // Filter state
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  updateFilters: (updates: Partial<FilterState>) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  isLoading: boolean;
  
  // Search integration
  location?: LocationCoordinates;
  categories: CategoryOption[];
  resultCount: number;
  isSearching: boolean;
  
  // Analytics
  trackFilterApply: (filters: FilterState, resultCount: number) => void;
  trackFilterClear: () => void;
  trackPresetSelect: (presetId: string, filters: FilterState) => void;
  trackIndividualFilter: (filterType: string, filterValue: any) => void;
  
  // UI configuration
  theme: FilterTheme;
  
  // Actions
  performSearch: () => Promise<void>;
  refreshResultCount: () => Promise<void>;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

interface FilterProviderProps {
  children: ReactNode;
  initialFilters?: Partial<FilterState>;
  location?: LocationCoordinates;
  categories?: CategoryOption[];
  theme?: FilterTheme;
  onFiltersChange?: (filters: FilterState) => void;
  onSearchResults?: (results: any[]) => void;
  persistFilters?: boolean;
  enableAnalytics?: boolean;
}

const DEFAULT_THEME: FilterTheme = {
  primaryColor: '#007AFF',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F8F9FA',
  textColor: '#000000',
  borderColor: '#E0E0E0',
};

export const FilterProvider: React.FC<FilterProviderProps> = ({
  children,
  initialFilters = {},
  location,
  categories = DEFAULT_CATEGORIES,
  theme = DEFAULT_THEME,
  onFiltersChange,
  onSearchResults,
  persistFilters = true,
  enableAnalytics = true,
}) => {
  // Initialize filter state with defaults and initial values
  const initialFilterState: FilterState = {
    ...DEFAULT_FILTER_STATE,
    ...initialFilters,
  };

  const {
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    resetFilters,
    isLoading,
  } = useFilterState({
    persistFilters,
    onFilterChange: onFiltersChange,
    validateFilters: true,
  });

  // Initialize analytics
  const {
    trackFilterApply,
    trackFilterClear,
    trackPresetSelect,
    trackIndividualFilter,
  } = useFilterAnalytics({
    enableTracking: enableAnalytics,
  });

  // Search state
  const [resultCount, setResultCount] = React.useState(0);
  const [isSearching, setIsSearching] = React.useState(false);

  // Perform search with current filters
  const performSearch = React.useCallback(async () => {
    if (!location) {
      console.warn('Cannot perform search without location');
      return;
    }

    try {
      setIsSearching(true);
      
      const searchResponse = await enhancedLocationSearchService.searchBusinesses(
        location,
        {
          category: filters.categories,
          priceRange: filters.priceRange.min > 0 || filters.priceRange.max < 1000 
            ? [filters.priceRange.min, filters.priceRange.max] 
            : undefined,
          rating: filters.rating.minimum > 0 ? filters.rating.minimum : undefined,
          amenities: filters.features,
          isOpen: filters.hours.openNow,
          sortBy: 'distance',
        },
        {
          maxResults: 50,
          useProgressiveLoading: true,
          enableDebouncing: true,
        }
      );

      setResultCount(searchResponse.totalCount);
      
      if (onSearchResults) {
        onSearchResults(searchResponse.businesses);
      }

      // Track successful search
      trackFilterApply(filters, searchResponse.totalCount);

    } catch (error) {
      console.error('Filter search failed:', error);
      setResultCount(0);
      
      if (onSearchResults) {
        onSearchResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, [location, filters, onSearchResults, trackFilterApply]);

  // Refresh result count without full search
  const refreshResultCount = React.useCallback(async () => {
    if (!location) return;

    try {
      // This would ideally be a count-only API endpoint for better performance
      const searchResponse = await enhancedLocationSearchService.searchBusinesses(
        location,
        {
          category: filters.categories,
          priceRange: filters.priceRange.min > 0 || filters.priceRange.max < 1000 
            ? [filters.priceRange.min, filters.priceRange.max] 
            : undefined,
          rating: filters.rating.minimum > 0 ? filters.rating.minimum : undefined,
          amenities: filters.features,
          isOpen: filters.hours.openNow,
          sortBy: 'distance',
        },
        {
          maxResults: 1, // Minimal results for count
          useProgressiveLoading: false,
          enableDebouncing: false,
        }
      );

      setResultCount(searchResponse.totalCount);
    } catch (error) {
      console.warn('Failed to refresh result count:', error);
    }
  }, [location, filters]);

  // Auto-refresh result count when filters change
  React.useEffect(() => {
    const debounceTimer = setTimeout(() => {
      refreshResultCount();
    }, 500); // Debounce result count updates

    return () => clearTimeout(debounceTimer);
  }, [refreshResultCount]);

  // Context value
  const contextValue = useMemo<FilterContextValue>(() => ({
    // Filter state
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    resetFilters,
    isLoading,
    
    // Search integration
    location,
    categories,
    resultCount,
    isSearching,
    
    // Analytics
    trackFilterApply,
    trackFilterClear,
    trackPresetSelect,
    trackIndividualFilter,
    
    // UI configuration
    theme,
    
    // Actions
    performSearch,
    refreshResultCount,
  }), [
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    resetFilters,
    isLoading,
    location,
    categories,
    resultCount,
    isSearching,
    trackFilterApply,
    trackFilterClear,
    trackPresetSelect,
    trackIndividualFilter,
    theme,
    performSearch,
    refreshResultCount,
  ]);

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
};

// Hook to use filter context
export const useFilterContext = (): FilterContextValue => {
  const context = useContext(FilterContext);
  
  if (context === undefined) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  
  return context;
};