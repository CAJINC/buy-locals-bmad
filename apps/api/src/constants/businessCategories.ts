export const BUSINESS_CATEGORIES = {
  RESTAURANTS: 'restaurants',
  RETAIL: 'retail',
  SERVICES: 'services',
  HEALTH: 'health',
  ENTERTAINMENT: 'entertainment',
  AUTOMOTIVE: 'automotive',
  BEAUTY: 'beauty',
  FITNESS: 'fitness',
  EDUCATION: 'education',
  PROFESSIONAL: 'professional',
  HOME_GARDEN: 'home_garden',
  TRAVEL: 'travel',
  PETS: 'pets',
  TECHNOLOGY: 'technology',
  EVENTS: 'events'
} as const;

export type BusinessCategory = typeof BUSINESS_CATEGORIES[keyof typeof BUSINESS_CATEGORIES];

export const BUSINESS_CATEGORY_OPTIONS = [
  { value: BUSINESS_CATEGORIES.RESTAURANTS, label: 'Restaurants & Food', subcategories: [
    'fine_dining', 'casual_dining', 'fast_food', 'coffee_shops', 'bars_nightlife', 
    'bakeries', 'food_trucks', 'catering', 'delivery_takeout'
  ]},
  { value: BUSINESS_CATEGORIES.RETAIL, label: 'Retail & Shopping', subcategories: [
    'clothing', 'electronics', 'books_media', 'home_decor', 'jewelry', 
    'sporting_goods', 'toys_games', 'groceries', 'pharmacy'
  ]},
  { value: BUSINESS_CATEGORIES.SERVICES, label: 'Professional Services', subcategories: [
    'consulting', 'financial', 'legal', 'marketing', 'cleaning', 
    'repair_maintenance', 'photography', 'event_planning', 'transportation'
  ]},
  { value: BUSINESS_CATEGORIES.HEALTH, label: 'Health & Medical', subcategories: [
    'medical_practices', 'dental', 'vision_care', 'mental_health', 'alternative_medicine', 
    'physical_therapy', 'veterinary', 'pharmacies', 'medical_equipment'
  ]},
  { value: BUSINESS_CATEGORIES.ENTERTAINMENT, label: 'Entertainment & Recreation', subcategories: [
    'theaters', 'music_venues', 'sports_recreation', 'gaming', 'museums', 
    'tours_attractions', 'nightlife', 'festivals', 'outdoor_activities'
  ]},
  { value: BUSINESS_CATEGORIES.AUTOMOTIVE, label: 'Automotive', subcategories: [
    'auto_repair', 'car_dealers', 'gas_stations', 'car_wash', 'auto_parts', 
    'towing', 'rental_cars', 'parking', 'motorcycle'
  ]},
  { value: BUSINESS_CATEGORIES.BEAUTY, label: 'Beauty & Personal Care', subcategories: [
    'hair_salons', 'nail_salons', 'spas', 'massage', 'skincare', 
    'barbershops', 'cosmetics', 'wellness', 'tattoo_piercing'
  ]},
  { value: BUSINESS_CATEGORIES.FITNESS, label: 'Fitness & Sports', subcategories: [
    'gyms', 'yoga_studios', 'martial_arts', 'dance_studios', 'personal_training', 
    'sports_clubs', 'outdoor_fitness', 'nutrition', 'sports_equipment'
  ]},
  { value: BUSINESS_CATEGORIES.EDUCATION, label: 'Education & Learning', subcategories: [
    'schools', 'tutoring', 'music_lessons', 'art_classes', 'language_learning', 
    'test_prep', 'vocational', 'childcare', 'libraries'
  ]},
  { value: BUSINESS_CATEGORIES.PROFESSIONAL, label: 'Professional Services', subcategories: [
    'accounting', 'real_estate', 'insurance', 'banking', 'investment', 
    'business_consulting', 'hr_services', 'it_services', 'coworking'
  ]},
  { value: BUSINESS_CATEGORIES.HOME_GARDEN, label: 'Home & Garden', subcategories: [
    'contractors', 'landscaping', 'home_improvement', 'interior_design', 'pest_control', 
    'appliance_repair', 'plumbing', 'electrical', 'roofing'
  ]},
  { value: BUSINESS_CATEGORIES.TRAVEL, label: 'Travel & Hospitality', subcategories: [
    'hotels', 'bed_breakfast', 'travel_agencies', 'tour_operators', 'vacation_rentals', 
    'transportation', 'travel_insurance', 'luggage_travel_gear'
  ]},
  { value: BUSINESS_CATEGORIES.PETS, label: 'Pets & Animals', subcategories: [
    'veterinary', 'pet_stores', 'grooming', 'boarding', 'training', 
    'pet_sitting', 'animal_rescue', 'pet_supplies', 'exotic_pets'
  ]},
  { value: BUSINESS_CATEGORIES.TECHNOLOGY, label: 'Technology', subcategories: [
    'computer_repair', 'software_development', 'web_design', 'it_support', 'electronics_repair', 
    'phone_repair', 'data_recovery', 'cybersecurity', 'telecommunications'
  ]},
  { value: BUSINESS_CATEGORIES.EVENTS, label: 'Events & Celebrations', subcategories: [
    'wedding_planning', 'party_planning', 'catering', 'event_venues', 'entertainment', 
    'photography', 'florists', 'decorations', 'rental_equipment'
  ]}
];

export const getAllCategories = (): string[] => {
  return Object.values(BUSINESS_CATEGORIES);
};

export const getCategoryLabel = (category: string): string => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.label || category;
};

export const getCategorySubcategories = (category: string): string[] => {
  const option = BUSINESS_CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.subcategories || [];
};

export const isValidCategory = (category: string): boolean => {
  return getAllCategories().includes(category);
};