import { FilterState, FilterSection, FilterPreset, RangeFilterConfig } from './types';

// Default filter state with sensible defaults
export const DEFAULT_FILTER_STATE: FilterState = {
  categories: [],
  priceRange: {
    min: 0,
    max: 1000,
  },
  distance: {
    radius: 25,
    unit: 'km',
  },
  rating: {
    minimum: 0,
  },
  hours: {
    openNow: false,
  },
  features: [],
};

// Filter sections configuration
export const FILTER_SECTIONS: FilterSection[] = [
  {
    id: 'categories',
    title: 'Categories',
    icon: 'category',
    description: 'Filter by business type',
  },
  {
    id: 'location',
    title: 'Distance',
    icon: 'location-on',
    description: 'Search radius from your location',
  },
  {
    id: 'price',
    title: 'Price Range',
    icon: 'attach-money',
    description: 'Filter by price range',
  },
  {
    id: 'rating',
    title: 'Rating',
    icon: 'star',
    description: 'Minimum rating requirement',
  },
  {
    id: 'hours',
    title: 'Business Hours',
    icon: 'schedule',
    description: 'Operating hours and availability',
  },
  {
    id: 'features',
    title: 'Features',
    icon: 'featured-play-list',
    description: 'Amenities and special features',
  },
];

// Predefined filter presets
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'nearby_popular',
    name: 'Nearby & Popular',
    description: 'Close by with great ratings',
    icon: 'trending-up',
    filters: {
      distance: { radius: 5, unit: 'km' },
      rating: { minimum: 4.0 },
    },
  },
  {
    id: 'open_now',
    name: 'Open Now',
    description: 'Currently accepting customers',
    icon: 'access-time',
    filters: {
      hours: { openNow: true },
      distance: { radius: 15, unit: 'km' },
    },
  },
  {
    id: 'budget_friendly',
    name: 'Budget Friendly',
    description: 'Great value options',
    icon: 'money-off',
    filters: {
      priceRange: { min: 0, max: 50 },
      rating: { minimum: 3.5 },
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'High-end establishments',
    icon: 'diamond',
    filters: {
      priceRange: { min: 100, max: 1000 },
      rating: { minimum: 4.5 },
      features: ['verified'],
    },
  },
  {
    id: 'accessible',
    name: 'Accessible',
    description: 'Wheelchair accessible venues',
    icon: 'accessible',
    filters: {
      features: ['wheelchair_accessible', 'parking'],
      distance: { radius: 20, unit: 'km' },
    },
  },
  {
    id: 'family_friendly',
    name: 'Family Friendly',
    description: 'Great for families',
    icon: 'family-restroom',
    filters: {
      rating: { minimum: 4.0 },
      features: ['parking', 'wheelchair_accessible'],
    },
  },
];

// Range filter configurations
export const RANGE_FILTER_CONFIGS: Record<string, RangeFilterConfig> = {
  distance: {
    min: 1,
    max: 50,
    step: 1,
    unit: 'km',
    formatValue: (value: number) => `${value} km`,
  },
  distanceMiles: {
    min: 1,
    max: 30,
    step: 1,
    unit: 'miles',
    formatValue: (value: number) => `${value} mi`,
  },
  price: {
    min: 0,
    max: 1000,
    step: 5,
    unit: '$',
    formatValue: (value: number) => {
      if (value === 0) return 'Free';
      if (value >= 1000) return '$1000+';
      return `$${value}`;
    },
  },
  rating: {
    min: 0,
    max: 5,
    step: 0.5,
    unit: '★',
    formatValue: (value: number) => {
      if (value === 0) return 'Any rating';
      return `${value}★ & up`;
    },
  },
};

// Category hierarchy for business types
export const DEFAULT_CATEGORIES = [
  {
    id: 'restaurants',
    name: 'Restaurants',
    icon: 'restaurant',
    children: [
      { id: 'fast_food', name: 'Fast Food', icon: 'fastfood' },
      { id: 'fine_dining', name: 'Fine Dining', icon: 'restaurant-menu' },
      { id: 'pizza', name: 'Pizza', icon: 'local-pizza' },
      { id: 'asian', name: 'Asian Cuisine', icon: 'ramen-dining' },
      { id: 'mexican', name: 'Mexican', icon: 'lunch-dining' },
      { id: 'italian', name: 'Italian', icon: 'restaurant' },
      { id: 'american', name: 'American', icon: 'lunch-dining' },
      { id: 'seafood', name: 'Seafood', icon: 'set-meal' },
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: 'shopping-bag',
    children: [
      { id: 'grocery', name: 'Grocery Stores', icon: 'shopping-cart' },
      { id: 'fashion', name: 'Fashion & Clothing', icon: 'checkroom' },
      { id: 'electronics', name: 'Electronics', icon: 'devices' },
      { id: 'home_garden', name: 'Home & Garden', icon: 'home' },
      { id: 'books', name: 'Books & Media', icon: 'menu-book' },
      { id: 'sports', name: 'Sports & Recreation', icon: 'sports' },
      { id: 'pharmacy', name: 'Pharmacy', icon: 'local-pharmacy' },
    ],
  },
  {
    id: 'services',
    name: 'Services',
    icon: 'build',
    children: [
      { id: 'automotive', name: 'Automotive', icon: 'car-repair' },
      { id: 'beauty', name: 'Beauty & Wellness', icon: 'face' },
      { id: 'health', name: 'Healthcare', icon: 'local-hospital' },
      { id: 'financial', name: 'Financial', icon: 'account-balance' },
      { id: 'legal', name: 'Legal', icon: 'gavel' },
      { id: 'real_estate', name: 'Real Estate', icon: 'home-work' },
      { id: 'education', name: 'Education', icon: 'school' },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: 'theater-comedy',
    children: [
      { id: 'bars_nightlife', name: 'Bars & Nightlife', icon: 'local-bar' },
      { id: 'movies', name: 'Movies & Cinema', icon: 'movie' },
      { id: 'museums', name: 'Museums & Culture', icon: 'museum' },
      { id: 'parks', name: 'Parks & Recreation', icon: 'park' },
      { id: 'fitness', name: 'Fitness & Gyms', icon: 'fitness-center' },
      { id: 'gaming', name: 'Gaming & Arcades', icon: 'sports-esports' },
    ],
  },
  {
    id: 'coffee_cafes',
    name: 'Coffee & Cafes',
    icon: 'coffee',
    children: [
      { id: 'coffee_shops', name: 'Coffee Shops', icon: 'coffee' },
      { id: 'tea_houses', name: 'Tea Houses', icon: 'emoji-food-beverage' },
      { id: 'bakeries', name: 'Bakeries', icon: 'bakery-dining' },
      { id: 'desserts', name: 'Desserts', icon: 'cake' },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: 'business',
    children: [
      { id: 'coworking', name: 'Coworking Spaces', icon: 'co-present' },
      { id: 'printing', name: 'Printing Services', icon: 'print' },
      { id: 'consulting', name: 'Consulting', icon: 'person' },
      { id: 'marketing', name: 'Marketing', icon: 'campaign' },
      { id: 'it_services', name: 'IT Services', icon: 'computer' },
    ],
  },
];

// Feature options with descriptions
export const FEATURE_OPTIONS = [
  {
    id: 'photos',
    label: 'Has Photos',
    description: 'Business with uploaded photos',
    icon: 'photo-camera',
  },
  {
    id: 'reviews',
    label: 'Has Reviews',
    description: 'Customer reviews available',
    icon: 'rate-review',
  },
  {
    id: 'verified',
    label: 'Verified Business',
    description: 'Verified by platform',
    icon: 'verified',
  },
  {
    id: 'wheelchair_accessible',
    label: 'Wheelchair Accessible',
    description: 'Accessible entrance and facilities',
    icon: 'accessible',
  },
  {
    id: 'parking',
    label: 'Parking Available',
    description: 'On-site parking',
    icon: 'local-parking',
  },
  {
    id: 'wifi',
    label: 'WiFi',
    description: 'Free WiFi available',
    icon: 'wifi',
  },
  {
    id: 'delivery',
    label: 'Delivery Available',
    description: 'Offers delivery service',
    icon: 'delivery-dining',
  },
  {
    id: 'takeout',
    label: 'Takeout',
    description: 'Takeout available',
    icon: 'takeout-dining',
  },
  {
    id: 'outdoor_seating',
    label: 'Outdoor Seating',
    description: 'Patio or outdoor dining',
    icon: 'deck',
  },
  {
    id: 'pet_friendly',
    label: 'Pet Friendly',
    description: 'Welcomes pets',
    icon: 'pets',
  },
  {
    id: 'live_music',
    label: 'Live Music',
    description: 'Features live entertainment',
    icon: 'music-note',
  },
  {
    id: 'happy_hour',
    label: 'Happy Hour',
    description: 'Special pricing hours',
    icon: 'local-bar',
  },
];

// Business hours options
export const HOURS_OPTIONS = [
  {
    id: 'open_now',
    label: 'Open Now',
    description: 'Currently open for business',
  },
  {
    id: 'open_24_7',
    label: 'Open 24/7',
    description: 'Always open',
  },
  {
    id: 'open_weekends',
    label: 'Open Weekends',
    description: 'Open Saturday and Sunday',
  },
  {
    id: 'open_late',
    label: 'Open Late',
    description: 'Open past 10 PM',
  },
  {
    id: 'open_early',
    label: 'Open Early',
    description: 'Opens before 8 AM',
  },
];

// Price range labels
export const PRICE_RANGE_LABELS = {
  0: 'Free',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

// Distance unit conversion
export const DISTANCE_CONVERSIONS = {
  kmToMiles: (km: number) => Math.round(km * 0.621371),
  milesToKm: (miles: number) => Math.round(miles * 1.60934),
};

// Filter validation rules
export const FILTER_VALIDATION_RULES = {
  categories: {
    maxSelections: 10,
    required: false,
  },
  priceRange: {
    minValue: 0,
    maxValue: 1000,
    required: false,
  },
  distance: {
    minRadius: 1,
    maxRadius: 100,
    required: false,
  },
  rating: {
    minValue: 0,
    maxValue: 5,
    step: 0.5,
    required: false,
  },
  features: {
    maxSelections: 15,
    required: false,
  },
};

// Animation constants
export const ANIMATION_CONFIG = {
  timing: {
    duration: 300,
    useNativeDriver: false,
  },
  spring: {
    tension: 100,
    friction: 8,
    useNativeDriver: false,
  },
};

// Performance constants
export const PERFORMANCE_CONFIG = {
  debounceMs: 300,
  maxVisibleOptions: 100,
  virtualListThreshold: 50,
  batchUpdateSize: 10,
};

// Accessibility constants
export const ACCESSIBILITY_CONFIG = {
  minimumTouchTarget: 44,
  announceResultChanges: true,
  supportScreenReader: true,
  highContrastSupport: true,
};

// Export commonly used combinations
export const QUICK_FILTERS = {
  nearbyAndOpen: {
    distance: { radius: 10, unit: 'km' as const },
    hours: { openNow: true },
  },
  highRated: {
    rating: { minimum: 4.0 },
  },
  budgetFriendly: {
    priceRange: { min: 0, max: 50 },
  },
  premiumOnly: {
    priceRange: { min: 100, max: 1000 },
    rating: { minimum: 4.5 },
  },
};