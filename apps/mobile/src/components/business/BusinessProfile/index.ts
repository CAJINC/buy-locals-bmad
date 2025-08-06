export { BusinessProfile } from './BusinessProfile';
export { BusinessCard } from './BusinessCard';
export { BusinessHeader } from './BusinessHeader';
export { BusinessRating } from './BusinessRating';
export { BusinessVerification } from './BusinessVerification';
export { BusinessSocialMedia } from './BusinessSocialMedia';
export { ExpandableText } from './ExpandableText';
export { BusinessCategoryBadges } from './BusinessCategoryBadges';
export { BusinessContactInfo } from './BusinessContactInfo';
export { BusinessHoursDisplay } from './BusinessHoursDisplay';
export { BusinessPhotoGallery } from './BusinessPhotoGallery';
export { ServicesCatalog } from './ServicesCatalog';
export { ServiceItem } from './ServiceItem';
export { ServiceSearch } from './ServiceSearch';

// New enhanced components
export { LocationMap } from './LocationMap';
export { ContactMethods } from './ContactMethods';
export { OptimizedImage, BusinessLogoImage, BusinessPhotoImage, ThumbnailImage } from './OptimizedImage';

// Hooks and utilities
export { useResponsiveDesign, useResponsiveStyles, useResponsiveGrid } from './hooks/useResponsiveDesign';
export { 
  ImageOptimizer, 
  LazyLoader, 
  PerformanceMonitor, 
  MemoryManager,
  BundleOptimizer,
  NetworkOptimizer,
  DeviceCapabilities 
} from './utils/performanceUtils';
export { 
  AccessibilityHelper, 
  ScreenReaderOptimizer, 
  KeyboardNavigation 
} from './utils/accessibilityUtils';

export type {
  BusinessProfileProps,
  BusinessCardProps,
  BusinessHeaderProps,
  BusinessRatingProps,
  BusinessVerificationProps,
  BusinessSocialMediaProps,
  ExpandableTextProps,
  BusinessContactInfoProps,
  BusinessHoursDisplayProps,
  BusinessPhotoGalleryProps,
  ShareOptions,
  // Service Types
  EnhancedService,
  ServiceCategory,
  ServicesCatalogProps,
  ServiceItemProps,
  ServiceSearchProps,
  ServiceFilters,
  // New enhancement types
  LocationMapProps,
  ContactMethod,
  ContactMethodsProps,
  OptimizedImageProps,
  ResponsiveBreakpoints,
  Breakpoint,
  DeviceType,
  Orientation,
  ResponsiveDesignHook,
} from './types';