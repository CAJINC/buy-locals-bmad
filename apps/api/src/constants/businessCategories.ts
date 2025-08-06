// Main business categories - hierarchical structure
export const BUSINESS_CATEGORIES = {
  RESTAURANTS: 'restaurants',
  RETAIL: 'retail', 
  SERVICES: 'services',
  HEALTH: 'health',
  AUTOMOTIVE: 'automotive',
  BEAUTY: 'beauty',
  ENTERTAINMENT: 'entertainment',
  PROFESSIONAL: 'professional',
  HOME_SERVICES: 'home_services'
} as const;

export type BusinessCategory = typeof BUSINESS_CATEGORIES[keyof typeof BUSINESS_CATEGORIES];

// Subcategory definitions for hierarchical taxonomy
export const SUBCATEGORIES = {
  restaurants: ['fast_food', 'fine_dining', 'casual_dining', 'cafes', 'bars'],
  retail: ['clothing', 'electronics', 'books', 'grocery', 'pharmacy'],
  services: ['cleaning', 'repair', 'consulting', 'legal', 'financial'],
  health: ['medical', 'dental', 'veterinary', 'fitness', 'wellness'],
  automotive: ['repair', 'sales', 'car_wash', 'gas_station'],
  beauty: ['hair_salon', 'spa', 'nail_salon', 'barbershop'],
  entertainment: ['movie_theater', 'arcade', 'bowling', 'live_music'],
  professional: ['accounting', 'real_estate', 'insurance', 'marketing'],
  home_services: ['plumbing', 'electrical', 'landscaping', 'cleaning']
} as const;

export type SubcategoryType = {
  [K in BusinessCategory]: typeof SUBCATEGORIES[K][number];
};

// Enhanced category taxonomy with icons, display metadata, and popularity tracking
export interface CategoryMetadata {
  value: BusinessCategory;
  label: string;
  icon: string;
  description: string;
  subcategories: string[];
  popularity: number; // 1-100 popularity score
  averageRating?: number;
  businessCount?: number;
}

export const BUSINESS_CATEGORY_OPTIONS: CategoryMetadata[] = [
  {
    value: BUSINESS_CATEGORIES.RESTAURANTS,
    label: 'Restaurants & Food',
    icon: '🍽️',
    description: 'Dining, takeout, and food services',
    subcategories: ['fast_food', 'fine_dining', 'casual_dining', 'cafes', 'bars'],
    popularity: 95
  },
  {
    value: BUSINESS_CATEGORIES.RETAIL,
    label: 'Retail & Shopping',
    icon: '🛍️',
    description: 'Stores and retail outlets',
    subcategories: ['clothing', 'electronics', 'books', 'grocery', 'pharmacy'],
    popularity: 88
  },
  {
    value: BUSINESS_CATEGORIES.SERVICES,
    label: 'Professional Services',
    icon: '💼',
    description: 'Business and professional services',
    subcategories: ['cleaning', 'repair', 'consulting', 'legal', 'financial'],
    popularity: 82
  },
  {
    value: BUSINESS_CATEGORIES.HEALTH,
    label: 'Health & Medical',
    icon: '🏥',
    description: 'Healthcare and wellness services',
    subcategories: ['medical', 'dental', 'veterinary', 'fitness', 'wellness'],
    popularity: 91
  },
  {
    value: BUSINESS_CATEGORIES.AUTOMOTIVE,
    label: 'Automotive',
    icon: '🚗',
    description: 'Car services and automotive businesses',
    subcategories: ['repair', 'sales', 'car_wash', 'gas_station'],
    popularity: 75
  },
  {
    value: BUSINESS_CATEGORIES.BEAUTY,
    label: 'Beauty & Personal Care',
    icon: '💄',
    description: 'Beauty and personal care services',
    subcategories: ['hair_salon', 'spa', 'nail_salon', 'barbershop'],
    popularity: 79
  },
  {
    value: BUSINESS_CATEGORIES.ENTERTAINMENT,
    label: 'Entertainment & Recreation',
    icon: '🎭',
    description: 'Entertainment venues and activities',
    subcategories: ['movie_theater', 'arcade', 'bowling', 'live_music'],
    popularity: 73
  },
  {
    value: BUSINESS_CATEGORIES.PROFESSIONAL,
    label: 'Professional Services',
    icon: '📊',
    description: 'Financial and professional services',
    subcategories: ['accounting', 'real_estate', 'insurance', 'marketing'],
    popularity: 68
  },
  {
    value: BUSINESS_CATEGORIES.HOME_SERVICES,
    label: 'Home Services',
    icon: '🏠',
    description: 'Home maintenance and improvement',
    subcategories: ['plumbing', 'electrical', 'landscaping', 'cleaning'],
    popularity: 85
  }
];

// Category utility functions with enhanced metadata support
export const getAllCategories = (): string[] => {
  return Object.values(BUSINESS_CATEGORIES);
};

export const getAllSubcategories = (): string[] => {
  return Object.values(SUBCATEGORIES).flat();
};

export const getCategoryMetadata = (category: string): CategoryMetadata | undefined => {
  return BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
};

export const getCategoryLabel = (category: string): string => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.label || category;
};

export const getCategoryIcon = (category: string): string => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.icon || '📍';
};

export const getCategoryDescription = (category: string): string => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.description || '';
};

export const getCategorySubcategories = (category: string): string[] => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.subcategories || [];
};

export const getCategoryPopularity = (category: string): number => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.popularity || 50;
};

export const isValidCategory = (category: string): boolean => {
  return getAllCategories().includes(category);
};

export const isValidSubcategory = (subcategory: string): boolean => {
  return getAllSubcategories().includes(subcategory);
};

// Get parent category for a subcategory
export const getParentCategory = (subcategory: string): BusinessCategory | undefined => {
  for (const [category, subcats] of Object.entries(SUBCATEGORIES)) {
    if (subcats.includes(subcategory as any)) {
      return category as BusinessCategory;
    }
  }
  return undefined;
};

// Get categories sorted by popularity
export const getCategoriesByPopularity = (): CategoryMetadata[] => {
  return [...BUSINESS_CATEGORY_OPTIONS].sort((a, b) => b.popularity - a.popularity);
};

// Category filtering utilities for OR logic support
export interface CategoryFilter {
  categories: string[];
  includeSubcategories?: boolean;
}

export const expandCategoryFilter = (filter: CategoryFilter): string[] => {
  const expanded = new Set<string>();
  
  filter.categories.forEach(category => {
    expanded.add(category);
    
    if (filter.includeSubcategories) {
      const subcategories = getCategorySubcategories(category);
      subcategories.forEach(sub => expanded.add(sub));
    }
  });
  
  return Array.from(expanded);
};