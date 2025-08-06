import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FilterChipsProps, FilterState } from '../FilterPanel/types';

interface FilterChip {
  id: string;
  label: string;
  type: string;
  value?: string;
  removable: boolean;
  color?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onFilterRemove,
  theme,
  maxVisible = 6,
  testID = 'filter-chips',
}) => {
  // Generate filter chips from current filter state
  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];

    // Category chips
    filters.categories.forEach(category => {
      chips.push({
        id: `category-${category}`,
        label: formatCategoryLabel(category),
        type: 'category',
        value: category,
        removable: true,
        color: theme.primaryColor,
      });
    });

    // Price range chip
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) {
      chips.push({
        id: 'price-range',
        label: formatPriceRangeLabel(filters.priceRange),
        type: 'price',
        removable: true,
        color: '#FF6B35',
      });
    }

    // Distance chip
    if (filters.distance.radius < 25) {
      chips.push({
        id: 'distance',
        label: `Within ${filters.distance.radius} ${filters.distance.unit}`,
        type: 'distance',
        removable: true,
        color: '#4ECDC4',
      });
    }

    // Rating chip
    if (filters.rating.minimum > 0) {
      chips.push({
        id: 'rating',
        label: `${filters.rating.minimum}★ & up`,
        type: 'rating',
        removable: true,
        color: '#FFD93D',
      });
    }

    // Hours chips
    if (filters.hours.openNow) {
      chips.push({
        id: 'hours-open-now',
        label: 'Open Now',
        type: 'hours',
        value: 'openNow',
        removable: true,
        color: '#6BCF7F',
      });
    }

    if (filters.hours.specificHours === '24/7') {
      chips.push({
        id: 'hours-24-7',
        label: 'Open 24/7',
        type: 'hours',
        value: '24/7',
        removable: true,
        color: '#6BCF7F',
      });
    }

    // Feature chips
    filters.features.forEach(feature => {
      chips.push({
        id: `feature-${feature}`,
        label: formatFeatureLabel(feature),
        type: 'feature',
        value: feature,
        removable: true,
        color: '#A78BFA',
      });
    });

    return chips;
  }, [filters, theme.primaryColor]);

  // Handle chip removal with animation
  const handleChipRemove = useCallback((chip: FilterChip) => {
    // Enable layout animation for smooth removal
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext({
        duration: 250,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
    }

    onFilterRemove(chip.type, chip.value);
  }, [onFilterRemove]);

  // Show collapsed view if too many chips
  const visibleChips = filterChips.slice(0, maxVisible);
  const remainingCount = filterChips.length - maxVisible;

  if (filterChips.length === 0) {
    return null;
  }

  const renderChip = (chip: FilterChip, index: number) => (
    <Animated.View
      key={chip.id}
      style={[
        styles.chip,
        {
          backgroundColor: `${chip.color || theme.primaryColor}15`,
          borderColor: chip.color || theme.primaryColor,
        }
      ]}
    >
      <TouchableOpacity
        style={styles.chipContent}
        onPress={() => handleChipRemove(chip)}
        activeOpacity={0.7}
        testID={`${testID}-chip-${chip.type}-${index}`}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${chip.label} filter`}
        accessibilityHint="Double tap to remove this filter"
      >
        <Text
          style={[
            styles.chipText,
            { color: chip.color || theme.primaryColor }
          ]}
          numberOfLines={1}
        >
          {chip.label}
        </Text>
        
        {chip.removable && (
          <Icon
            name="close"
            size={16}
            color={chip.color || theme.primaryColor}
            style={styles.chipIcon}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Render visible chips */}
        {visibleChips.map((chip, index) => renderChip(chip, index))}
        
        {/* Show remaining count if there are hidden chips */}
        {remainingCount > 0 && (
          <View
            style={[
              styles.chip,
              styles.countChip,
              {
                backgroundColor: `${theme.primaryColor}10`,
                borderColor: theme.primaryColor,
              }
            ]}
          >
            <Text
              style={[
                styles.chipText,
                styles.countChipText,
                { color: theme.primaryColor }
              ]}
            >
              +{remainingCount} more
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Helper functions for formatting chip labels
const formatCategoryLabel = (category: string): string => {
  const categoryLabels: Record<string, string> = {
    'restaurants': 'Restaurants',
    'fast_food': 'Fast Food',
    'fine_dining': 'Fine Dining',
    'pizza': 'Pizza',
    'asian': 'Asian',
    'mexican': 'Mexican',
    'italian': 'Italian',
    'american': 'American',
    'seafood': 'Seafood',
    'shopping': 'Shopping',
    'grocery': 'Grocery',
    'fashion': 'Fashion',
    'electronics': 'Electronics',
    'home_garden': 'Home & Garden',
    'books': 'Books',
    'sports': 'Sports',
    'pharmacy': 'Pharmacy',
    'services': 'Services',
    'automotive': 'Automotive',
    'beauty': 'Beauty',
    'health': 'Healthcare',
    'financial': 'Financial',
    'legal': 'Legal',
    'real_estate': 'Real Estate',
    'education': 'Education',
    'entertainment': 'Entertainment',
    'bars_nightlife': 'Bars & Nightlife',
    'movies': 'Movies',
    'museums': 'Museums',
    'parks': 'Parks',
    'fitness': 'Fitness',
    'gaming': 'Gaming',
    'coffee_cafes': 'Coffee & Cafes',
    'coffee_shops': 'Coffee Shops',
    'tea_houses': 'Tea Houses',
    'bakeries': 'Bakeries',
    'desserts': 'Desserts',
    'professional': 'Professional',
    'coworking': 'Coworking',
    'printing': 'Printing',
    'consulting': 'Consulting',
    'marketing': 'Marketing',
    'it_services': 'IT Services',
  };

  return categoryLabels[category] || category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatPriceRangeLabel = (priceRange: { min: number; max: number }): string => {
  if (priceRange.min === 0 && priceRange.max >= 1000) {
    return 'Any price';
  }
  
  if (priceRange.min === 0) {
    return `Under $${priceRange.max}`;
  }
  
  if (priceRange.max >= 1000) {
    return `$${priceRange.min}+`;
  }
  
  return `$${priceRange.min} - $${priceRange.max}`;
};

const formatFeatureLabel = (feature: string): string => {
  const featureLabels: Record<string, string> = {
    'photos': 'Has Photos',
    'reviews': 'Has Reviews',
    'verified': 'Verified',
    'wheelchair_accessible': 'Wheelchair Accessible',
    'parking': 'Parking',
    'wifi': 'WiFi',
    'delivery': 'Delivery',
    'takeout': 'Takeout',
    'outdoor_seating': 'Outdoor Seating',
    'pet_friendly': 'Pet Friendly',
    'live_music': 'Live Music',
    'happy_hour': 'Happy Hour',
  };

  return featureLabels[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    overflow: 'hidden',
    minHeight: 32,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 120,
  },
  chipIcon: {
    marginLeft: 6,
  },
  countChip: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});