import { Business } from 'packages/shared/src/types/business';

// Business Hours Status Types
export type BusinessStatusType = 'open' | 'closed' | 'unknown';

export interface HoursValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface BusinessProfileProps {
  business?: Business;
  showActions?: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  onCall?: (phone: string) => void;
  onWebsite?: (url: string) => void;
  onGetDirections?: (address: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
}

export interface BusinessCardProps {
  business: Business;
  onPress?: (business: Business) => void;
  showDistance?: boolean;
  compact?: boolean;
}

export interface BusinessContactInfoProps {
  contact: Business['contact'];
  onCall?: (phone: string) => void;
  onEmail?: (email: string) => void;
  onWebsite?: (url: string) => void;
}

export interface BusinessHoursDisplayProps {
  hours: Business['hours'];
  compact?: boolean;
  showCurrentStatus?: boolean;
}

// Enhanced Business Hours Types
export interface EnhancedBusinessHours {
  // Regular weekly hours
  [day: string]: {
    open?: string;
    close?: string;
    closed?: boolean;
    isClosed?: boolean;
  };
  // Special hours for holidays/events
  specialHours?: {
    [date: string]: {
      open: string;
      close: string;
      isClosed: boolean;
      reason: string; // "Holiday", "Special Event", etc.
    };
  };
  timezone?: string; // Business timezone
  temporaryClosures?: {
    startDate: string;
    endDate: string;
    reason: string;
  }[];
}

export interface TimeZoneInfo {
  name: string;
  abbreviation: string;
  offset: number; // minutes from UTC
}

export interface BusinessStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'unknown';
  reason?: string;
  nextChange: Date | null;
}

export interface EnhancedBusinessHoursDisplayProps {
  hours: Business['hours'] | EnhancedBusinessHours;
  compact?: boolean;
  showCurrentStatus?: boolean;
  showCountdown?: boolean;
  showTimezone?: boolean;
  userTimezone?: string;
  expandable?: boolean;
  showSpecialHours?: boolean;
  onStatusChange?: (status: BusinessStatus) => void;
  refreshInterval?: number; // milliseconds
}

export interface BusinessPhotoGalleryProps {
  media: Business['media'];
  onImagePress?: (imageUrl: string, index: number) => void;
  maxImages?: number;
  aspectRatio?: number;
  enableZoom?: boolean;
  enableGestures?: boolean;
  lazyLoadingEnabled?: boolean;
  showMetadata?: boolean;
  preloadCount?: number;
  cacheEnabled?: boolean;
}

export interface PhotoItem extends Business['media'][0] {
  loading?: boolean;
  error?: boolean;
  cached?: boolean;
  metadata?: {
    title?: string;
    caption?: string;
    dateTime?: Date;
    location?: string;
    photographer?: string;
    tags?: string[];
    size?: { width: number; height: number };
    fileSize?: number;
  };
}

export interface PhotoLightboxProps {
  photos: PhotoItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  enableZoom?: boolean;
  enableGestures?: boolean;
  showMetadata?: boolean;
}

export interface PhotoGalleryScrollProps {
  photos: PhotoItem[];
  onPhotoPress: (photo: PhotoItem, index: number) => void;
  horizontal?: boolean;
  lazyLoadingEnabled?: boolean;
  preloadCount?: number;
  showThumbnails?: boolean;
  itemHeight?: number;
  itemWidth?: number;
}

export interface ShareOptions {
  message?: string;
  url?: string;
  title?: string;
}

export interface BusinessRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showReviewCount?: boolean;
  compact?: boolean;
}

export interface BusinessSocialMediaProps {
  socialMedia: {
    platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
    url: string;
    handle?: string;
  }[];
  compact?: boolean;
}

export interface BusinessVerificationProps {
  isVerified: boolean;
  verificationLevel?: 'basic' | 'premium' | 'enterprise';
  verificationDate?: Date;
  compact?: boolean;
}

export interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  showMoreText?: string;
  showLessText?: string;
  fontSize?: string;
  color?: string;
}

export interface BusinessHeaderProps {
  business: {
    name: string;
    rating?: number;
    reviewCount?: number;
    categories: string[];
    isVerified?: boolean;
    verificationLevel?: 'basic' | 'premium' | 'enterprise';
  };
  logoImage?: {
    id: string;
    url: string;
    type: 'logo' | 'photo';
    description?: string;
  };
  showVerification?: boolean;
}

// Enhanced Service Types for Services Catalog
export interface EnhancedService {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing: {
    type: 'exact' | 'range' | 'quote';
    amount?: number;
    minAmount?: number;
    maxAmount?: number;
    currency: string;
  };
  duration?: number; // minutes
  availability: 'available' | 'busy' | 'unavailable';
  bookingEnabled: boolean;
  requirements?: string[];
  images?: string[];
  isActive?: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  serviceCount?: number;
}

export interface ServicesCatalogProps {
  services: EnhancedService[];
  categories?: ServiceCategory[];
  businessName?: string;
  onServicePress?: (service: EnhancedService) => void;
  onBookService?: (service: EnhancedService) => void;
  showCategories?: boolean;
  showSearch?: boolean;
  showAvailabilityFilter?: boolean;
  enableBooking?: boolean;
  isLoading?: boolean;
}

export interface ServiceItemProps {
  service: EnhancedService;
  onPress?: (service: EnhancedService) => void;
  onBook?: (service: EnhancedService) => void;
  showBookingButton?: boolean;
  compact?: boolean;
}

export interface ServiceSearchProps {
  services: EnhancedService[];
  categories?: ServiceCategory[];
  onFiltersChange: (filteredServices: EnhancedService[]) => void;
  onSearchChange?: (query: string) => void;
  showCategoryFilter?: boolean;
  showPriceFilter?: boolean;
  showAvailabilityFilter?: boolean;
  searchPlaceholder?: string;
}

export interface ServiceFilters {
  searchQuery: string;
  selectedCategories: string[];
  priceRange: {
    min?: number;
    max?: number;
  };
  availability?: 'available' | 'busy' | 'unavailable' | 'all';
  sortBy: 'name' | 'price' | 'duration' | 'category';
  sortOrder: 'asc' | 'desc';
}