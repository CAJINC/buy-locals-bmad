import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import filter components
import { FilterPanel, FilterProvider, useFilterContext } from './index';
import { DEFAULT_CATEGORIES } from './FilterPanel/constants';
import { FilterState } from './FilterPanel/types';

// Import other app components
import { BusinessListView } from '../discovery/BusinessListView';
import { locationService, LocationCoordinates } from '../../services/locationService';
import { enhancedLocationSearchService, BusinessSearchResult } from '../../services/enhancedLocationSearchService';

/**
 * Complete integration example showing how to use the filter system
 * with the business search and discovery components
 */

interface SearchWithFiltersProps {
  initialLocation?: LocationCoordinates;
  onBusinessSelect?: (business: BusinessSearchResult) => void;
}

// Main search screen component with filters
export const SearchWithFiltersExample: React.FC<SearchWithFiltersProps> = ({
  initialLocation,
  onBusinessSelect,
}) => {
  const [location, setLocation] = useState<LocationCoordinates | undefined>(initialLocation);
  const [businesses, setBusinesses] = useState<BusinessSearchResult[]>([]);
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Get current location if not provided
  React.useEffect(() => {
    if (!location) {
      getCurrentLocation();
    }
  }, [location]);

  const getCurrentLocation = async () => {
    try {
      const currentLocation = await locationService.getCurrentLocation();
      setLocation(currentLocation);
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  // Handle search with filters
  const handleSearch = useCallback(async (filters: FilterState) => {
    if (!location) {
      console.warn('Cannot search without location');
      return;
    }

    try {
      setIsSearching(true);
      
      const searchResponse = await enhancedLocationSearchService.searchBusinesses(
        location,
        {
          category: filters.categories,
          priceRange: filters.priceRange.min > 0 || filters.priceRange.max < 1000 
            ? [filters.priceRange.min, filters.priceRange.max] 
            : undefined,
          rating: filters.rating.minimum > 0 ? filters.rating.minimum : undefined,
          amenities: filters.features,
          isOpen: filters.hours.openNow,
          sortBy: 'distance',
        },
        {
          maxResults: 50,
          useProgressiveLoading: true,
          enableDebouncing: true,
        }
      );

      setBusinesses(searchResponse.businesses);
      
    } catch (error) {
      console.error('Search failed:', error);
      setBusinesses([]);
    } finally {
      setIsSearching(false);
    }
  }, [location]);

  return (
    <FilterProvider
      location={location}
      categories={DEFAULT_CATEGORIES}
      onFiltersChange={handleSearch}
      onSearchResults={setBusinesses}
      persistFilters={true}
      enableAnalytics={true}
    >
      <SafeAreaView style={styles.container}>
        {/* Search Header */}
        <SearchHeader
          onFilterPress={() => setIsFilterPanelVisible(true)}
          isSearching={isSearching}
          resultCount={businesses.length}
        />

        {/* Business List */}
        <BusinessListView
          businesses={businesses}
          onBusinessPress={onBusinessSelect}
          isLoading={isSearching}
          location={location}
        />

        {/* Filter Panel */}
        <FilterPanelContainer
          visible={isFilterPanelVisible}
          onClose={() => setIsFilterPanelVisible(false)}
        />
      </SafeAreaView>
    </FilterProvider>
  );
};

// Search header component with filter button
const SearchHeader: React.FC<{
  onFilterPress: () => void;
  isSearching: boolean;
  resultCount: number;
}> = ({ onFilterPress, isSearching, resultCount }) => {
  const { filters } = useFilterContext();
  
  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) count++;
    if (filters.distance.radius < 25) count++;
    if (filters.rating.minimum > 0) count++;
    if (filters.hours.openNow) count++;
    if (filters.features.length > 0) count++;
    return count;
  }, [filters]);

  return (
    <View style={styles.searchHeader}>
      <View style={styles.searchInfo}>
        <Text style={styles.resultCount}>
          {isSearching ? 'Searching...' : `${resultCount} results`}
        </Text>
        {activeFilterCount > 0 && (
          <Text style={styles.filterInfo}>
            {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} applied
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.filterButton,
          activeFilterCount > 0 && styles.filterButtonActive
        ]}
        onPress={onFilterPress}
        testID="search-filter-button"
      >
        <Icon
          name="filter-list"
          size={24}
          color={activeFilterCount > 0 ? '#007AFF' : '#666'}
        />
        {activeFilterCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

// Filter panel container with context integration
const FilterPanelContainer: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const {
    filters,
    setFilters,
    location,
    categories,
    resultCount,
    isSearching,
    theme,
    performSearch,
  } = useFilterContext();

  const handleFiltersChange = useCallback(async (newFilters: FilterState) => {
    setFilters(newFilters);
    // Search will be triggered automatically by the FilterProvider
  }, [setFilters]);

  const handleApplyFilters = useCallback(async () => {
    await performSearch();
    onClose();
  }, [performSearch, onClose]);

  return (
    <FilterPanel
      filters={filters}
      onFiltersChange={handleFiltersChange}
      onClose={onClose}
      visible={visible}
      resultCount={resultCount}
      isLoading={isSearching}
      location={location}
      categories={categories}
      theme={theme}
    />
  );
};

// Alternative: Simple filter integration without context
export const SimpleFilterExample: React.FC = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTER_STATE);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const handleSearch = async (searchFilters: FilterState) => {
    // Implement your search logic here
    console.log('Searching with filters:', searchFilters);
    
    // Mock result count
    setResultCount(Math.floor(Math.random() * 100));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.openFilterButton}
        onPress={() => setIsFilterVisible(true)}
      >
        <Text style={styles.openFilterText}>Open Filters</Text>
      </TouchableOpacity>

      <FilterPanel
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          handleSearch(newFilters);
        }}
        onClose={() => setIsFilterVisible(false)}
        visible={isFilterVisible}
        resultCount={resultCount}
        categories={DEFAULT_CATEGORIES}
      />
    </View>
  );
};

// Hook-based integration example
export const useFilterIntegration = (location?: LocationCoordinates) => {
  const [filters, setFilters] = useState(DEFAULT_FILTER_STATE);
  const [businesses, setBusinesses] = useState<BusinessSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const performSearch = useCallback(async (searchFilters: FilterState) => {
    if (!location) return;

    try {
      setIsLoading(true);
      
      const response = await enhancedLocationSearchService.searchBusinesses(
        location,
        {
          category: searchFilters.categories,
          priceRange: searchFilters.priceRange.min > 0 || searchFilters.priceRange.max < 1000
            ? [searchFilters.priceRange.min, searchFilters.priceRange.max]
            : undefined,
          rating: searchFilters.rating.minimum > 0 ? searchFilters.rating.minimum : undefined,
          amenities: searchFilters.features,
          isOpen: searchFilters.hours.openNow,
        }
      );

      setBusinesses(response.businesses);
      setResultCount(response.totalCount);
      
    } catch (error) {
      console.error('Search failed:', error);
      setBusinesses([]);
      setResultCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [location]);

  const updateFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    performSearch(newFilters);
  }, [performSearch]);

  return {
    filters,
    updateFilters,
    businesses,
    resultCount,
    isLoading,
    performSearch,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInfo: {
    flex: 1,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  openFilterButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  openFilterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const DEFAULT_FILTER_STATE: FilterState = {
  categories: [],
  priceRange: { min: 0, max: 1000 },
  distance: { radius: 25, unit: 'km' },
  rating: { minimum: 0 },
  hours: { openNow: false },
  features: [],
};