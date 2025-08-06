import { Business } from '@buy-locals/shared';
import { LocationCoordinates } from '../../../services/locationService';

export interface BusinessWithDistance extends Business {
  distance: number;
  bearing?: number;
  estimatedTravelTime?: number;
  isCurrentlyOpen?: boolean;
  status?: string;
  nextChange?: Date | null;
  timezone?: string;
}

export type SortOption = 'distance' | 'rating' | 'name' | 'newest';

export interface SortBy {
  key: SortOption;
  label: string;
  icon: string;
}

export interface BusinessListViewProps {
  businesses: BusinessWithDistance[];
  currentLocation?: LocationCoordinates;
  loading?: boolean;
  refreshing?: boolean;
  hasNextPage?: boolean;
  sortBy?: SortOption;
  onBusinessPress: (business: BusinessWithDistance) => void;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onSortChange?: (sortBy: SortOption) => void;
  emptyStateMessage?: string;
  emptyStateSubtitle?: string;
  emptyStateAction?: () => void;
  emptyStateActionLabel?: string;
  showSortOptions?: boolean;
  showDistance?: boolean;
  showRating?: boolean;
  testID?: string;
}

export interface BusinessListItemProps {
  business: BusinessWithDistance;
  currentLocation?: LocationCoordinates;
  onPress: (business: BusinessWithDistance) => void;
  showDistance?: boolean;
  showRating?: boolean;
  testID?: string;
}

export interface BusinessListSkeletonProps {
  count?: number;
  testID?: string;
}

export interface BusinessListEmptyStateProps {
  message: string;
  subtitle?: string;
  action?: () => void;
  actionLabel?: string;
  testID?: string;
}

export interface BusinessListSortBarProps {
  currentSort: SortOption;
  onSortChange: (sortBy: SortOption) => void;
  showSortOptions: boolean;
  onToggleSortOptions: () => void;
  testID?: string;
}

export interface BusinessRatingDisplayProps {
  rating?: number;
  reviewCount?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  testID?: string;
}

export interface BusinessDistanceDisplayProps {
  distance: number;
  estimatedTravelTime?: number;
  size?: 'small' | 'medium' | 'large';
  testID?: string;
}

export interface BusinessHoursIndicatorProps {
  hours?: Business['hours'];
  isOpen?: boolean;
  status?: string;
  nextChange?: Date | null;
  timezone?: string;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showNextChange?: boolean;
  testID?: string;
}