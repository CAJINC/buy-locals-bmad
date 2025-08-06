import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { BusinessSearchResult } from '../services/enhancedLocationSearchService';
import { BusinessListView } from '../components/discovery/BusinessListView';
import { HoursBasedRecommendations } from '../components/search/HoursBasedRecommendations';
import { SearchFiltersBar, SearchFilter } from '../components/search/SearchFiltersBar';
import { LocationService } from '../services/locationService';
import { SearchService } from '../services/searchService';
import { NotificationService } from '../services/notificationService';

interface ComprehensiveSearchScreenProps {
  route?: {
    params?: {
      initialQuery?: string;
      category?: string;
      location?: { latitude: number; longitude: number };
    };
  };
}

type SearchMode = 'results' | 'recommendations' | 'filters';

export const ComprehensiveSearchScreen: React.FC<ComprehensiveSearchScreenProps> = ({
  route,
}) => {
  const navigation = useNavigation();
  const { initialQuery, category, location: initialLocation } = route?.params || {};

  // State Management
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [searchMode, setSearchMode] = useState<SearchMode>('results');
  const [businesses, setBusinesses] = useState<BusinessSearchResult[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<BusinessSearchResult[]>([]);
  const [currentLocation, setCurrentLocation] = useState(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Services
  const locationService = new LocationService();
  const searchService = new SearchService();
  const notificationService = new NotificationService();

  // Filter State
  const [searchFilters, setSearchFilters] = useState<SearchFilter[]>([
    {
      id: 'category',
      label: 'Category',
      icon: 'category',
      isActive: !!category,
      type: 'select',
      options: ['Restaurant', 'Shopping', 'Services', 'Entertainment', 'Health'],
      value: category,
    },
    {
      id: 'rating',
      label: 'Rating',
      icon: 'star',
      isActive: false,
      type: 'select',
      options: ['4+ Stars', '3+ Stars', '2+ Stars'],
    },
    {
      id: 'distance',
      label: 'Distance',
      icon: 'location-on',
      isActive: false,
      type: 'select',
      options: ['Within 1 mile', 'Within 5 miles', 'Within 10 miles'],
    },
    {
      id: 'price',
      label: 'Price',
      icon: 'attach-money',
      isActive: false,
      type: 'select',
      options: ['$', '$$', '$$$', '$$$$'],
    },
    {
      id: 'verified',
      label: 'Verified',
      icon: 'verified',
      isActive: false,
      type: 'toggle',
    },
  ]);

  const [openNowFilter, setOpenNowFilter] = useState({
    isActive: false,
    businessCount: 0,
    isLoading: false,
    closingSoonCount: 0,
    nextOpeningCount: 0,
  });

  // Computed Values
  const openBusinesses = useMemo(() => 
    businesses.filter(business => business.isCurrentlyOpen),
    [businesses]
  );

  const closingSoonBusinesses = useMemo(() => {
    const now = new Date();
    return businesses.filter(business => {
      if (!business.isCurrentlyOpen || !business.nextChange) return false;
      const hoursUntilClose = (business.nextChange.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilClose <= 2 && hoursUntilClose > 0;
    });
  }, [businesses]);

  const nextOpeningBusinesses = useMemo(() => {
    const now = new Date();
    return businesses.filter(business => {
      if (business.isCurrentlyOpen || !business.nextChange) return false;
      const hoursUntilOpen = (business.nextChange.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilOpen <= 2 && hoursUntilOpen > 0;
    });
  }, [businesses]);

  // Initialize location and search
  useEffect(() => {
    const initializeSearch = async () => {
      try {
        setIsLoading(true);
        
        // Get current location if not provided
        if (!currentLocation) {
          const location = await locationService.getCurrentLocation();
          setCurrentLocation(location);
        }
        
        // Perform initial search if query provided
        if (searchQuery) {
          await performSearch(searchQuery);
        }
      } catch (error) {
        console.error('Failed to initialize search:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSearch();
  }, []);

  // Update filter counts when businesses change
  useEffect(() => {
    setOpenNowFilter(prev => ({
      ...prev,
      businessCount: openBusinesses.length,
      closingSoonCount: closingSoonBusinesses.length,
      nextOpeningCount: nextOpeningBusinesses.length,
    }));
  }, [openBusinesses, closingSoonBusinesses, nextOpeningBusinesses]);

  // Apply filters to businesses
  useEffect(() => {
    let filtered = [...businesses];

    // Apply Open Now filter
    if (openNowFilter.isActive) {
      filtered = filtered.filter(business => business.isCurrentlyOpen);
    }

    // Apply other filters
    searchFilters.forEach(filter => {
      if (!filter.isActive) return;

      switch (filter.id) {
        case 'category':
          if (filter.value) {
            filtered = filtered.filter(business => 
              business.categories?.some(cat => 
                cat.toLowerCase().includes(filter.value.toLowerCase())
              )
            );
          }
          break;
        case 'rating':
          if (filter.value) {
            const minRating = parseFloat(filter.value.charAt(0));
            filtered = filtered.filter(business => 
              business.rating && business.rating >= minRating
            );
          }
          break;
        case 'distance':
          if (filter.value && currentLocation) {
            const maxDistance = parseFloat(filter.value.split(' ')[1]);
            filtered = filtered.filter(business => 
              business.distance && business.distance <= maxDistance
            );
          }
          break;
        case 'verified':
          filtered = filtered.filter(business => business.isVerified);
          break;
      }
    });

    setFilteredBusinesses(filtered);
  }, [businesses, openNowFilter.isActive, searchFilters, currentLocation]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !currentLocation) return;

    try {
      setIsLoading(true);
      setOpenNowFilter(prev => ({ ...prev, isLoading: true }));

      const results = await searchService.searchBusinesses({
        query: query.trim(),
        location: currentLocation,
        radius: 25000, // 25km
        includeHours: true,
        includeRealTimeStatus: true,
      });

      setBusinesses(results);
      
      // Track search analytics
      await searchService.trackSearchAnalytics({
        query: query.trim(),
        location: currentLocation,
        resultCount: results.length,
        filtersApplied: searchFilters.filter(f => f.isActive).map(f => f.id),
        openNowActive: openNowFilter.isActive,
      });

    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert(
        'Search Error',
        'Unable to search businesses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setOpenNowFilter(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentLocation, searchFilters, openNowFilter.isActive, searchService]);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
      setSearchMode('results');
    }
  }, [searchQuery, performSearch]);

  const handleRefresh = useCallback(async () => {
    if (searchQuery.trim()) {
      setIsRefreshing(true);
      try {
        await performSearch(searchQuery);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [searchQuery, performSearch]);

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    setSearchFilters(prev => prev.map(filter => {
      if (filter.id === filterId) {
        return {
          ...filter,
          isActive: filter.type === 'toggle' ? value : !!value,
          value: filter.type === 'toggle' ? undefined : value,
        };
      }
      return filter;
    }));
  }, []);

  const handleOpenNowToggle = useCallback((isActive: boolean) => {
    setOpenNowFilter(prev => ({ ...prev, isActive }));
  }, []);

  const handleOpenNowRecommendation = useCallback((type: 'closing-soon' | 'next-opening') => {
    // Apply specific filter based on recommendation type
    if (type === 'closing-soon') {
      setFilteredBusinesses(closingSoonBusinesses);
    } else if (type === 'next-opening') {
      setFilteredBusinesses(nextOpeningBusinesses);
    }
    setSearchMode('results');
  }, [closingSoonBusinesses, nextOpeningBusinesses]);

  const handleBusinessPress = useCallback((business: BusinessSearchResult) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  }, [navigation]);

  const renderSearchHeader = () => (
    <View style={styles.searchHeader}>
      <View style={styles.searchInputContainer}>
        <Icon name="search" size={24} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses, services, food..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          returnKeyType="search"
          testID="search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
            testID="clear-search"
          >
            <Icon name="clear" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      {searchQuery.trim().length > 0 && (
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          testID="search-button"
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderModeSelector = () => (
    <View style={styles.modeSelectorContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'results' && styles.activeModeButton]}
          onPress={() => setSearchMode('results')}
          testID="mode-results"
        >
          <Icon name="list" size={20} color={searchMode === 'results' ? '#FFF' : '#666'} />
          <Text style={[styles.modeButtonText, searchMode === 'results' && styles.activeModeButtonText]}>
            Results ({filteredBusinesses.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'recommendations' && styles.activeModeButton]}
          onPress={() => setSearchMode('recommendations')}
          testID="mode-recommendations"
        >
          <Icon name="recommend" size={20} color={searchMode === 'recommendations' ? '#FFF' : '#666'} />
          <Text style={[styles.modeButtonText, searchMode === 'recommendations' && styles.activeModeButtonText]}>
            By Hours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'filters' && styles.activeModeButton]}
          onPress={() => setSearchMode('filters')}
          testID="mode-filters"
        >
          <Icon name="tune" size={20} color={searchMode === 'filters' ? '#FFF' : '#666'} />
          <Text style={[styles.modeButtonText, searchMode === 'filters' && styles.activeModeButtonText]}>
            Filters
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (isLoading && businesses.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching businesses...</Text>
        </View>
      );
    }

    switch (searchMode) {
      case 'recommendations':
        return (
          <HoursBasedRecommendations
            businesses={businesses}
            currentLocation={currentLocation}
            onBusinessPress={handleBusinessPress}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            testID="hours-recommendations"
          />
        );
      
      case 'filters':
        return (
          <View style={styles.filtersContainer}>
            <SearchFiltersBar
              filters={searchFilters}
              openNowFilter={openNowFilter}
              onFilterChange={handleFilterChange}
              onOpenNowToggle={handleOpenNowToggle}
              onOpenNowRecommendation={handleOpenNowRecommendation}
              showEnhancedOpenNow={true}
              isLoading={isLoading}
              testID="search-filters"
            />
          </View>
        );
      
      default:
        return (
          <BusinessListView
            businesses={filteredBusinesses}
            currentLocation={currentLocation}
            onBusinessPress={handleBusinessPress}
            showEmptyState={true}
            showLoadingState={isLoading}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            testID="search-results"
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="comprehensive-search-screen">
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {renderSearchHeader()}
      {renderModeSelector()}
      
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSelectorContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeModeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeModeButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  filtersContainer: {
    flex: 1,
  },
});