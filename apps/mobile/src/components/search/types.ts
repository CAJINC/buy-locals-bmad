// Search Component Types
// Consolidated type definitions for the search interface

import { LocationCoordinates } from '../../services/locationService';
import { SearchSuggestion } from '../../services/suggestionService';
import { SearchRecommendation } from '../../services/searchHistoryService';

// Theme Configuration
export interface SearchTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  placeholderColor: string;
  borderColor: string;
  shadowColor: string;
  surfaceColor?: string;
}

// Performance Configuration
export type SearchPerformanceMode = 'fast' | 'comprehensive';

// Voice Search Types
export interface VoiceSearchConfig {
  enabled: boolean;
  language: string;
  timeout: number;
  confidenceThreshold: number;
}

export interface VoiceSearchResult {
  text: string;
  confidence: number;
  alternates?: string[];
}

export interface VoiceSearchError {
  code: string;
  message: string;
  recoverable: boolean;
}

// Search State Types
export interface SearchState {
  query: string;
  isSearching: boolean;
  hasResults: boolean;
  showSuggestions: boolean;
  showHistory: boolean;
  lastSearchTime: number;
  error: string | null;
}

// Animation States
export interface SearchAnimationState {
  isFocused: boolean;
  isLoading: boolean;
  hasText: boolean;
  showClearButton: boolean;
  showVoiceButton: boolean;
}

// Search Bar Configuration
export interface SearchBarConfig {
  placeholder: string;
  debounceMs: number;
  maxSuggestions: number;
  performanceMode: SearchPerformanceMode;
  autoFocus: boolean;
  showVoiceSearch: boolean;
  showHistory: boolean;
  enableAnalytics: boolean;
}

// Search Context
export interface SearchContext {
  location?: LocationCoordinates;
  userPreferences?: {
    categories: string[];
    radius: number;
    sortBy: string;
  };
  sessionData?: {
    sessionId: string;
    startTime: number;
    searchCount: number;
  };
}

// Search Events
export interface SearchEvents {
  onSearch: (query: string, context?: SearchContext) => void;
  onQueryChange?: (query: string) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onHistorySelect?: (query: string, location?: LocationCoordinates) => void;
  onRecommendationSelect?: (recommendation: SearchRecommendation) => void;
  onVoiceSearch?: (result: VoiceSearchResult) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onError?: (error: SearchError) => void;
}

// Error Types
export interface SearchError {
  type: 'network' | 'permission' | 'voice' | 'api' | 'validation';
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

// Loading State Configuration
export interface LoadingStateConfig {
  message: string;
  submessage?: string;
  showProgress: boolean;
  progressValue?: number;
  compact: boolean;
  animated: boolean;
}

// Search Metrics
export interface SearchMetrics {
  searchLatency: number;
  suggestionLoadTime: number;
  cacheHitRate: number;
  userSatisfactionScore: number;
  conversionRate: number;
  averageQueryLength: number;
  mostPopularSearches: string[];
}

// Search Analytics Event
export interface SearchAnalyticsEvent {
  eventType: 'search' | 'suggestion_click' | 'voice_search' | 'history_select';
  query?: string;
  suggestionId?: string;
  resultCount?: number;
  searchLatency?: number;
  userLocation?: LocationCoordinates;
  timestamp: number;
  sessionId: string;
}

// Suggestion Display Options
export interface SuggestionDisplayOptions {
  showIcons: boolean;
  showDistance: boolean;
  showCategories: boolean;
  showTrending: boolean;
  showRatings: boolean;
  maxTextLines: number;
  highlightQuery: boolean;
}

// History Display Options
export interface HistoryDisplayOptions {
  maxEntries: number;
  groupByDate: boolean;
  showRecommendations: boolean;
  showMetadata: boolean;
  enableDeletion: boolean;
  enableClearing: boolean;
}

// Search Filter Types
export interface SearchFilters {
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  distance?: {
    radius: number;
    unit: 'km' | 'miles';
  };
  rating?: {
    minimum: number;
  };
  hours?: {
    openNow: boolean;
    specificHours?: string;
  };
  features?: string[];
}

// Search Results Metadata
export interface SearchResultsMetadata {
  totalCount: number;
  filteredCount: number;
  searchTime: number;
  location: LocationCoordinates;
  radius: number;
  query: string;
  appliedFilters: SearchFilters;
  sortBy: string;
  page: number;
  hasMore: boolean;
}

// Component Props Interfaces
export interface BaseSearchProps {
  theme: SearchTheme;
  style?: any;
  testID?: string;
}

export interface SearchBarProps extends BaseSearchProps {
  placeholder?: string;
  initialQuery?: string;
  location?: LocationCoordinates;
  config?: Partial<SearchBarConfig>;
  events: Pick<SearchEvents, 'onSearch' | 'onQueryChange' | 'onSuggestionSelect' | 'onFocus' | 'onBlur' | 'onVoiceSearch'>;
  state?: {
    isLoading?: boolean;
    disabled?: boolean;
    error?: SearchError | null;
  };
}

export interface SearchSuggestionsProps extends BaseSearchProps {
  query: string;
  location?: LocationCoordinates;
  events: Pick<SearchEvents, 'onSuggestionSelect'>;
  config?: {
    maxSuggestions?: number;
    performanceMode?: SearchPerformanceMode;
    debounceMs?: number;
    displayOptions?: Partial<SuggestionDisplayOptions>;
  };
}

export interface SearchHistoryProps extends BaseSearchProps {
  currentLocation?: LocationCoordinates;
  events: Pick<SearchEvents, 'onHistorySelect' | 'onRecommendationSelect'>;
  config?: {
    maxEntries?: number;
    showRecommendations?: boolean;
    displayOptions?: Partial<HistoryDisplayOptions>;
  };
}

export interface VoiceSearchProps extends BaseSearchProps {
  events: Pick<SearchEvents, 'onVoiceSearch' | 'onError'>;
  config?: Partial<VoiceSearchConfig>;
  state?: {
    disabled?: boolean;
    isListening?: boolean;
  };
}

export interface SearchLoadingStateProps extends BaseSearchProps {
  config: LoadingStateConfig;
}

// Utility Types
export type SearchComponentType = 
  | 'SearchBar'
  | 'SearchSuggestions' 
  | 'SearchHistory'
  | 'VoiceSearch'
  | 'SearchLoadingState';

export type SearchEventType = keyof SearchEvents;

export type SearchStateKey = keyof SearchState;

// Constants
export const DEFAULT_SEARCH_CONFIG: SearchBarConfig = {
  placeholder: 'Search businesses, categories...',
  debounceMs: 300,
  maxSuggestions: 8,
  performanceMode: 'fast',
  autoFocus: false,
  showVoiceSearch: true,
  showHistory: true,
  enableAnalytics: true,
};

export const DEFAULT_THEME: SearchTheme = {
  primaryColor: '#007AFF',
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  placeholderColor: '#8E8E93',
  borderColor: '#E5E5E7',
  shadowColor: '#000000',
  surfaceColor: '#F8F8F8',
};

export const VOICE_SEARCH_LANGUAGES = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Spanish (Spain)',
  'es-US': 'Spanish (US)',
  'fr-FR': 'French',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese (Brazil)',
  'zh-CN': 'Chinese (Simplified)',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
} as const;

export type VoiceSearchLanguage = keyof typeof VOICE_SEARCH_LANGUAGES;

// Type Guards
export const isSearchError = (error: any): error is SearchError => {
  return error && typeof error === 'object' && 'type' in error && 'code' in error;
};

export const isVoiceSearchResult = (result: any): result is VoiceSearchResult => {
  return result && typeof result === 'object' && 'text' in result && 'confidence' in result;
};

export const hasLocation = (context: SearchContext): context is SearchContext & { location: LocationCoordinates } => {
  return context.location !== undefined;
};

// Helper Functions
export const createSearchContext = (
  location?: LocationCoordinates,
  userPreferences?: SearchContext['userPreferences']
): SearchContext => {
  return {
    location,
    userPreferences,
    sessionData: {
      sessionId: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      searchCount: 0,
    },
  };
};

export const createSearchError = (
  type: SearchError['type'],
  code: string,
  message: string,
  details?: any,
  recoverable: boolean = true
): SearchError => {
  return {
    type,
    code,
    message,
    details,
    recoverable,
  };
};

export const createAnalyticsEvent = (
  eventType: SearchAnalyticsEvent['eventType'],
  data: Partial<SearchAnalyticsEvent> = {}
): SearchAnalyticsEvent => {
  return {
    eventType,
    timestamp: Date.now(),
    sessionId: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...data,
  };
};

// Export all types for easy importing
export type {
  LocationCoordinates,
  SearchSuggestion,
  SearchRecommendation,
} from '../../services';

export type AllSearchTypes = 
  | SearchTheme
  | SearchPerformanceMode
  | VoiceSearchConfig
  | SearchState
  | SearchContext
  | SearchEvents
  | SearchError
  | SearchMetrics
  | SearchFilters
  | SearchBarProps
  | SearchSuggestionsProps
  | SearchHistoryProps
  | VoiceSearchProps
  | SearchLoadingStateProps;