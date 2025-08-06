import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterState, FilterValidationResult } from '../FilterPanel/types';
import { DEFAULT_FILTER_STATE, FILTER_VALIDATION_RULES } from '../FilterPanel/constants';

interface UseFilterStateOptions {
  persistFilters?: boolean;
  storageKey?: string;
  onFilterChange?: (filters: FilterState) => void;
  validateFilters?: boolean;
}

interface UseFilterStateReturn {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  updateFilters: (updates: Partial<FilterState>) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  validation: FilterValidationResult;
  isLoading: boolean;
}

const STORAGE_KEY = '@buy_locals:filter_state';

export const useFilterState = ({
  persistFilters = true,
  storageKey = STORAGE_KEY,
  onFilterChange,
  validateFilters = true,
}: UseFilterStateOptions = {}): UseFilterStateReturn => {
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<FilterValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  // Load persisted filters on mount
  useEffect(() => {
    if (persistFilters) {
      loadPersistedFilters();
    }
  }, [persistFilters, storageKey]);

  // Validate filters whenever they change
  useEffect(() => {
    if (validateFilters) {
      const validationResult = validateFilterState(filters);
      setValidation(validationResult);
    }
  }, [filters, validateFilters]);

  // Load persisted filters from storage
  const loadPersistedFilters = async () => {
    try {
      setIsLoading(true);
      const persistedFilters = await AsyncStorage.getItem(storageKey);
      
      if (persistedFilters) {
        const parsedFilters = JSON.parse(persistedFilters) as FilterState;
        
        // Validate loaded filters before applying
        const validationResult = validateFilterState(parsedFilters);
        if (validationResult.isValid || validationResult.errors.length === 0) {
          setFiltersState(parsedFilters);
        } else {
          console.warn('Invalid persisted filters, using defaults:', validationResult.errors);
          setFiltersState(DEFAULT_FILTER_STATE);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted filters:', error);
      setFiltersState(DEFAULT_FILTER_STATE);
    } finally {
      setIsLoading(false);
    }
  };

  // Persist filters to storage
  const persistFiltersToStorage = async (filtersToSave: FilterState) => {
    if (!persistFilters) return;
    
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error('Failed to persist filters:', error);
    }
  };

  // Set filters with validation and persistence
  const setFilters = useCallback((newFilters: FilterState) => {
    const validationResult = validateFilters ? validateFilterState(newFilters) : { isValid: true, errors: [], warnings: [] };
    
    if (validationResult.isValid || validationResult.errors.length === 0) {
      setFiltersState(newFilters);
      persistFiltersToStorage(newFilters);
      
      if (onFilterChange) {
        onFilterChange(newFilters);
      }
    } else {
      console.warn('Invalid filter state:', validationResult.errors);
      setValidation(validationResult);
    }
  }, [onFilterChange, persistFilters, validateFilters]);

  // Update filters partially
  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
  }, [filters, setFilters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, [setFilters]);

  // Reset to default state
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, [setFilters]);

  return {
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    resetFilters,
    validation,
    isLoading,
  };
};

// Filter validation function
const validateFilterState = (filters: FilterState): FilterValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate categories
  if (filters.categories.length > FILTER_VALIDATION_RULES.categories.maxSelections) {
    errors.push(`Too many categories selected (max: ${FILTER_VALIDATION_RULES.categories.maxSelections})`);
  }

  // Validate price range
  const priceRule = FILTER_VALIDATION_RULES.priceRange;
  if (filters.priceRange.min < priceRule.minValue || filters.priceRange.min > priceRule.maxValue) {
    errors.push(`Invalid minimum price (range: ${priceRule.minValue}-${priceRule.maxValue})`);
  }
  if (filters.priceRange.max < priceRule.minValue || filters.priceRange.max > priceRule.maxValue) {
    errors.push(`Invalid maximum price (range: ${priceRule.minValue}-${priceRule.maxValue})`);
  }
  if (filters.priceRange.min >= filters.priceRange.max) {
    errors.push('Minimum price must be less than maximum price');
  }

  // Validate distance
  const distanceRule = FILTER_VALIDATION_RULES.distance;
  if (filters.distance.radius < distanceRule.minRadius || filters.distance.radius > distanceRule.maxRadius) {
    errors.push(`Invalid distance radius (range: ${distanceRule.minRadius}-${distanceRule.maxRadius})`);
  }

  // Validate rating
  const ratingRule = FILTER_VALIDATION_RULES.rating;
  if (filters.rating.minimum < ratingRule.minValue || filters.rating.minimum > ratingRule.maxValue) {
    errors.push(`Invalid rating (range: ${ratingRule.minValue}-${ratingRule.maxValue})`);
  }

  // Validate features
  if (filters.features.length > FILTER_VALIDATION_RULES.features.maxSelections) {
    errors.push(`Too many features selected (max: ${FILTER_VALIDATION_RULES.features.maxSelections})`);
  }

  // Warnings for potentially ineffective filters
  if (filters.categories.length === 0 && filters.priceRange.min === 0 && filters.priceRange.max >= 1000 && 
      filters.distance.radius >= 25 && filters.rating.minimum === 0 && !filters.hours.openNow && 
      filters.features.length === 0) {
    warnings.push('No filters applied - showing all results');
  }

  if (filters.distance.radius > 50) {
    warnings.push('Large search radius may return many results');
  }

  if (filters.rating.minimum >= 4.5 && filters.priceRange.max <= 50) {
    warnings.push('High rating with low price range may have few results');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};