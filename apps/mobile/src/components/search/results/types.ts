import { Business } from '@buy-locals/shared';
import { LocationCoordinates } from '../../../services/locationService';

export interface SearchResultItem extends Business {
  distance: number;
  bearing?: number;
  estimatedTravelTime?: number;
  isCurrentlyOpen?: boolean;
  relevanceScore?: number;
  searchMatchHighlights?: {
    name?: string[];
    description?: string[];
    tags?: string[];
  };
  isBookmarked?: boolean;
  lastVisited?: Date;
}

export type SearchSortOption = 
  | 'distance' 
  | 'rating' 
  | 'relevance' 
  | 'newest'
  | 'alphabetical'
  | 'price_low'
  | 'price_high';

export interface SearchSortBy {
  key: SearchSortOption;
  label: string;
  icon: string;
  description: string;
}

export interface SearchResultsState {
  results: SearchResultItem[];
  sortBy: SearchSortOption;
  currentPage: number;
  totalResults: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  lastUpdated: Date;
  searchQuery: string;
  filters: any;
  bookmarkedResults: Set<string>;
}

export interface SearchResultsProps {
  results: SearchResultItem[];
  currentLocation?: LocationCoordinates;
  searchQuery: string;
  sortBy?: SearchSortOption;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  isRefreshing?: boolean;
  hasNextPage?: boolean;
  totalResults?: number;
  onResultPress: (result: SearchResultItem) => void;
  onSortChange: (sortBy: SearchSortOption) => void;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onBookmark?: (resultId: string) => void;
  onShare?: (result: SearchResultItem) => void;
  onGetDirections?: (result: SearchResultItem) => void;
  onExportResults?: (results: SearchResultItem[]) => void;
  testID?: string;
}

export interface SearchResultItemProps {
  result: SearchResultItem;
  currentLocation?: LocationCoordinates;
  searchQuery?: string;
  onPress: (result: SearchResultItem) => void;
  onBookmark?: (resultId: string) => void;
  onShare?: (result: SearchResultItem) => void;
  onGetDirections?: (result: SearchResultItem) => void;
  showDistance?: boolean;
  showRating?: boolean;
  showHighlights?: boolean;
  testID?: string;
}

export interface SortOptionsProps {
  currentSort: SearchSortOption;
  onSortChange: (sortBy: SearchSortOption) => void;
  resultCount: number;
  isVisible: boolean;
  onToggle: () => void;
  testID?: string;
}

export interface PaginationControlsProps {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  totalResults: number;
  currentResultsCount: number;
  testID?: string;
}

export interface EmptyStateProps {
  searchQuery: string;
  onRetry?: () => void;
  onClearFilters?: () => void;
  onExpandRadius?: () => void;
  hasFilters?: boolean;
  testID?: string;
}

export interface NearbyAlternativesProps {
  currentLocation: LocationCoordinates;
  searchQuery: string;
  onAlternativePress: (alternative: SearchResultItem) => void;
  testID?: string;
}

export interface ResultActionsProps {
  result: SearchResultItem;
  onBookmark: (resultId: string) => void;
  onShare: (result: SearchResultItem) => void;
  onGetDirections: (result: SearchResultItem) => void;
  isBookmarked: boolean;
  testID?: string;
}

export interface SearchExportData {
  searchQuery: string;
  timestamp: Date;
  location: LocationCoordinates;
  sortBy: SearchSortOption;
  totalResults: number;
  results: SearchResultItem[];
}

export interface SearchShareData {
  type: 'single' | 'multiple';
  results: SearchResultItem[];
  searchQuery: string;
  message?: string;
}