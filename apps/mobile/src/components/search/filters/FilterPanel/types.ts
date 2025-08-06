import { LocationCoordinates } from '../../../services/locationService';

// Core filter state interface
export interface FilterState {
  categories: string[];
  priceRange: {
    min: number;
    max: number;
  };
  distance: {
    radius: number;
    unit: 'km' | 'miles';
  };
  rating: {
    minimum: number;
  };
  hours: {
    openNow: boolean;
    specificHours?: string;
  };
  features: string[];
}

// Theme configuration for consistent styling
export interface FilterTheme {
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  borderColor: string;
  shadowColor?: string;
}

// Filter section configuration
export interface FilterSection {
  id: string;
  title: string;
  icon: string;
  description?: string;
}

// Filter preset configuration
export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  filters: Partial<FilterState>;
}

// Category interface for hierarchical selection
export interface CategoryOption {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  children?: CategoryOption[];
  count?: number;
}

// Filter dropdown option
export interface FilterOption {
  id: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  count?: number;
  description?: string;
}

// Range filter configuration
export interface RangeFilterConfig {
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatValue?: (value: number) => string;
}

// Filter change events
export interface FilterChangeEvents {
  onCategoryChange?: (categories: string[]) => void;
  onPriceRangeChange?: (range: { min: number; max: number }) => void;
  onDistanceChange?: (distance: { radius: number; unit: 'km' | 'miles' }) => void;
  onRatingChange?: (rating: { minimum: number }) => void;
  onHoursChange?: (hours: { openNow: boolean; specificHours?: string }) => void;
  onFeaturesChange?: (features: string[]) => void;
}

// Main FilterPanel props
export interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose: () => void;
  visible: boolean;
  resultCount?: number;
  isLoading?: boolean;
  location?: LocationCoordinates;
  categories?: CategoryOption[];
  onCategoryPress?: (category: string) => void;
  theme?: FilterTheme;
  style?: any;
  testID?: string;
}

// Filter chips props
export interface FilterChipsProps {
  filters: FilterState;
  onFilterRemove: (filterType: string, value?: string) => void;
  theme: FilterTheme;
  maxVisible?: number;
  testID?: string;
}

// Category filter props
export interface CategoryFilterProps {
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  availableCategories: CategoryOption[];
  onCategoryPress?: (category: string) => void;
  maxSelections?: number;
  showHierarchy?: boolean;
  theme: FilterTheme;
  testID?: string;
}

// Range filters props
export interface RangeFiltersProps {
  distance?: { radius: number; unit: 'km' | 'miles' };
  priceRange?: { min: number; max: number };
  rating?: { minimum: number };
  onDistanceChange?: (distance: { radius: number; unit: 'km' | 'miles' }) => void;
  onPriceRangeChange?: (range: { min: number; max: number }) => void;
  onRatingChange?: (rating: { minimum: number }) => void;
  location?: LocationCoordinates;
  theme: FilterTheme;
  testID?: string;
}

// Filter dropdown props
export interface FilterDropdownProps {
  title: string;
  options: FilterOption[];
  onSelectionChange: (selectedIds: string[]) => void;
  multiSelect?: boolean;
  searchable?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  maxHeight?: number;
  theme: FilterTheme;
  testID?: string;
}

// Filter presets props
export interface FilterPresetsProps {
  presets: FilterPreset[];
  activePresetId?: string | null;
  onPresetSelect: (presetId: string) => void;
  theme: FilterTheme;
  testID?: string;
}

// Filter summary props
export interface FilterSummaryProps {
  resultCount: number;
  isLoading: boolean;
  appliedFilters: FilterState;
  theme: FilterTheme;
  testID?: string;
}

// Filter validation result
export interface FilterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Filter analytics event
export interface FilterAnalyticsEvent {
  action: 'apply' | 'clear' | 'preset_select' | 'individual_filter';
  filterType?: string;
  filterValue?: any;
  resultCount?: number;
  timestamp: number;
  sessionId: string;
}

// Filter accessibility configuration
export interface FilterAccessibilityConfig {
  announceResultCount: boolean;
  announceFilterChanges: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
}

// Performance configuration
export interface FilterPerformanceConfig {
  debounceMs: number;
  batchUpdates: boolean;
  virtualizeOptions: boolean;
  enableMemoization: boolean;
}

// Filter persistence configuration
export interface FilterPersistenceConfig {
  persistFilters: boolean;
  persistPresets: boolean;
  syncWithUrl: boolean;
  storageKey: string;
}

// Type guards
export const isValidFilterState = (state: any): state is FilterState => {
  return (
    state &&
    typeof state === 'object' &&
    Array.isArray(state.categories) &&
    typeof state.priceRange === 'object' &&
    typeof state.distance === 'object' &&
    typeof state.rating === 'object' &&
    typeof state.hours === 'object' &&
    Array.isArray(state.features)
  );
};

export const isValidCategoryOption = (option: any): option is CategoryOption => {
  return (
    option &&
    typeof option === 'object' &&
    typeof option.id === 'string' &&
    typeof option.name === 'string'
  );
};

// Utility types
export type FilterType = 'categories' | 'priceRange' | 'distance' | 'rating' | 'hours' | 'features';
export type FilterOperator = 'equals' | 'contains' | 'range' | 'minimum' | 'boolean';
export type SortOrder = 'asc' | 'desc';

// Filter history entry
export interface FilterHistoryEntry {
  id: string;
  filters: FilterState;
  resultCount: number;
  appliedAt: number;
  name?: string;
}

// Filter suggestion
export interface FilterSuggestion {
  type: FilterType;
  value: any;
  label: string;
  description?: string;
  confidence: number;
  basedOn: 'location' | 'history' | 'trending' | 'similar_users';
}