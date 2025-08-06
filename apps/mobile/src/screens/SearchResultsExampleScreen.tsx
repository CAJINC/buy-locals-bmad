import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Text,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  SearchResults,
  SearchResultItem,
  SearchSortOption,
  useSearchResults,
  SearchResultsExportService
} from '../components/search/results';
import { locationService, LocationCoordinates } from '../services/locationService';

// Mock search results data
const MOCK_SEARCH_RESULTS: SearchResultItem[] = [
  {
    id: '1',
    name: 'The Cozy Corner Café',
    category: 'restaurant',
    coordinates: {
      latitude: 37.7749,
      longitude: -122.4194
    },
    address: '123 Main Street, San Francisco, CA 94102',
    rating: 4.5,
    review_count: 142,
    price_range: '$$',
    phone: '(415) 555-0123',
    website: 'https://cozyCornerCafe.com',
    photos: ['https://example.com/photo1.jpg'],
    hours: {},
    tags: ['coffee', 'breakfast', 'wifi'],
    description: 'A charming neighborhood café serving artisan coffee and fresh pastries. Perfect spot for remote work with free wifi.',
    distance: 0.3,
    isCurrentlyOpen: true,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:45:00Z',
    relevanceScore: 95,
    searchMatchHighlights: {
      name: ['café'],
      description: ['coffee'],
      tags: ['coffee']
    },
    isBookmarked: false
  },
  {
    id: '2',
    name: 'Green Valley Books & Coffee',
    category: 'retail',
    coordinates: {
      latitude: 37.7849,
      longitude: -122.4094
    },
    address: '456 Oak Avenue, San Francisco, CA 94103',
    rating: 4.8,
    review_count: 89,
    price_range: '$',
    phone: '(415) 555-0456',
    website: 'https://greenvalleybooks.com',
    photos: ['https://example.com/photo2.jpg'],
    hours: {},
    tags: ['books', 'coffee', 'events'],
    description: 'Independent bookstore with rare finds and a cozy reading nook. Community events every weekend.',
    distance: 0.7,
    isCurrentlyOpen: true,
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T16:20:00Z',
    relevanceScore: 88,
    searchMatchHighlights: {
      name: ['coffee'],
      description: ['coffee'],
      tags: ['coffee']
    },
    isBookmarked: true
  },
  {
    id: '3',
    name: 'Sunrise Yoga Studio',
    category: 'fitness',
    coordinates: {
      latitude: 37.7649,
      longitude: -122.4294
    },
    address: '789 Pine Street, San Francisco, CA 94104',
    rating: 4.6,
    review_count: 76,
    price_range: '$$$',
    phone: '(415) 555-0789',
    website: 'https://sunriseyoga.com',
    photos: ['https://example.com/photo3.jpg'],
    hours: {},
    tags: ['yoga', 'fitness', 'meditation'],
    description: 'Peaceful yoga studio offering morning and evening classes for all levels. Drop-in friendly.',
    distance: 1.2,
    isCurrentlyOpen: false,
    created_at: '2024-01-05T08:00:00Z',
    updated_at: '2024-01-19T12:30:00Z',
    relevanceScore: 65,
    isBookmarked: false
  },
  {
    id: '4',
    name: 'Mario\'s Authentic Pizza',
    category: 'restaurant',
    coordinates: {
      latitude: 37.7549,
      longitude: -122.4394
    },
    address: '321 Elm Street, San Francisco, CA 94105',
    rating: 4.2,
    review_count: 203,
    price_range: '$$',
    phone: '(415) 555-0321',
    website: 'https://mariospizza.com',
    photos: ['https://example.com/photo4.jpg'],
    hours: {},
    tags: ['pizza', 'italian', 'delivery'],
    description: 'Family-owned pizzeria serving wood-fired pizza with fresh ingredients since 1985.',
    distance: 1.8,
    isCurrentlyOpen: true,
    created_at: '2024-01-01T12:00:00Z',
    updated_at: '2024-01-17T18:45:00Z',
    relevanceScore: 72,
    isBookmarked: false
  },
  {
    id: '5',
    name: 'Tech Hub Coworking',
    category: 'service',
    coordinates: {
      latitude: 37.7449,
      longitude: -122.4494
    },
    address: '654 Market Street, San Francisco, CA 94106',
    rating: 4.4,
    review_count: 124,
    price_range: '$$$',
    phone: '(415) 555-0654',
    website: 'https://techhub.com',
    photos: ['https://example.com/photo5.jpg'],
    hours: {},
    tags: ['coworking', 'wifi', 'meeting rooms'],
    description: 'Modern coworking space with high-speed internet, meeting rooms, and networking events.',
    distance: 2.1,
    isCurrentlyOpen: true,
    created_at: '2024-01-12T14:30:00Z',
    updated_at: '2024-01-21T10:15:00Z',
    relevanceScore: 58,
    isBookmarked: false
  }
];

interface SearchResultsExampleScreenProps {
  navigation?: any;
  route?: any;
}

export const SearchResultsExampleScreen: React.FC<SearchResultsExampleScreenProps> = ({
  navigation,
  route
}) => {
  // State management
  const [searchQuery] = useState('coffee shop');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates>();

  // Use search results hook
  const {
    state,
    actions,
    computed,
    preferences
  } = useSearchResults({
    initialResults: MOCK_SEARCH_RESULTS,
    searchQuery,
    currentLocation,
    enableBookmarking: true,
    enableInfiniteScroll: true
  });

  // Get current location on mount
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
      } catch (error) {
        console.warn('Failed to get current location:', error);
        // Use default SF location for demo
        setCurrentLocation({
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        });
      }
    };

    getCurrentLocation();
  }, []);

  // Handle result press
  const handleResultPress = useCallback((result: SearchResultItem) => {
    Alert.alert(
      result.name,
      result.description,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Details', 
          onPress: () => {
            // Navigate to business details screen
            console.log('Navigate to business details:', result.id);
          }
        }
      ]
    );
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: SearchSortOption) => {
    actions.setSortBy(sortBy);
  }, [actions]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, this would refetch data from API
      console.log('Refreshing search results...');
      
      // For demo, just update the last updated time
      actions.setResults(MOCK_SEARCH_RESULTS);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [actions]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (state.isLoadingMore) return;
    
    try {
      // Simulate loading more results
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would fetch next page from API
      const moreResults: SearchResultItem[] = [
        {
          id: '6',
          name: 'Local Artisan Market',
          category: 'retail',
          coordinates: {
            latitude: 37.7349,
            longitude: -122.4594
          },
          address: '987 Broadway, San Francisco, CA 94107',
          rating: 4.3,
          review_count: 67,
          price_range: '$$',
          phone: '(415) 555-0987',
          website: 'https://artisanmarket.com',
          photos: [],
          hours: {},
          tags: ['crafts', 'local', 'handmade'],
          description: 'Supporting local artisans with handcrafted goods and unique finds.',
          distance: 2.5,
          isCurrentlyOpen: true,
          created_at: '2024-01-08T11:00:00Z',
          updated_at: '2024-01-16T15:30:00Z',
          relevanceScore: 45,
          isBookmarked: false
        }
      ];
      
      actions.addResults(moreResults);
    } catch (error) {
      console.error('Load more failed:', error);
    }
  }, [actions, state.isLoadingMore]);

  // Handle bookmark toggle
  const handleBookmark = useCallback(async (resultId: string) => {
    await actions.toggleBookmark(resultId);
    
    const result = state.results.find(r => r.id === resultId);
    const isNowBookmarked = preferences.bookmarkedIds.has(resultId);
    
    Alert.alert(
      isNowBookmarked ? 'Bookmarked!' : 'Bookmark Removed',
      `${result?.name} has been ${isNowBookmarked ? 'added to' : 'removed from'} your bookmarks.`,
      [{ text: 'OK' }]
    );
  }, [actions, state.results, preferences.bookmarkedIds]);

  // Handle share
  const handleShare = useCallback(async (result: SearchResultItem) => {
    const shareResult = await SearchResultsExportService.shareIndividualBusiness(
      result,
      `Check out this local business I found!`
    );
    
    if (!shareResult.success) {
      Alert.alert('Share Failed', shareResult.error || 'Unable to share business');
    }
  }, []);

  // Handle directions
  const handleGetDirections = useCallback((result: SearchResultItem) => {
    Alert.alert(
      'Get Directions',
      `Opening directions to ${result.name}...`,
      [{ text: 'OK' }]
    );
  }, []);

  // Handle export results
  const handleExportResults = useCallback(async (results: SearchResultItem[]) => {
    Alert.alert(
      'Export Results',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV',
          onPress: async () => {
            const exportResult = await SearchResultsExportService.exportResults(
              results,
              searchQuery,
              state.sortBy,
              currentLocation,
              { format: 'csv', includePhotos: false, includeCoordinates: true, includeFullDetails: true }
            );
            
            if (!exportResult.success) {
              Alert.alert('Export Failed', exportResult.error || 'Unable to export results');
            }
          }
        },
        {
          text: 'JSON',
          onPress: async () => {
            const exportResult = await SearchResultsExportService.exportResults(
              results,
              searchQuery,
              state.sortBy,
              currentLocation,
              { format: 'json', includePhotos: false, includeCoordinates: true, includeFullDetails: true }
            );
            
            if (!exportResult.success) {
              Alert.alert('Export Failed', exportResult.error || 'Unable to export results');
            }
          }
        }
      ]
    );
  }, [searchQuery, state.sortBy, currentLocation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>"{searchQuery}"</Text>
        </View>

        <TouchableOpacity
          onPress={() => handleExportResults(computed.sortedResults)}
          style={styles.exportButton}
        >
          <Ionicons name="download-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      <SearchResults
        results={computed.sortedResults}
        currentLocation={currentLocation}
        searchQuery={searchQuery}
        sortBy={state.sortBy}
        isLoading={isLoading}
        isLoadingMore={state.isLoadingMore}
        isRefreshing={isRefreshing}
        hasNextPage={computed.isLastPage === false}
        totalResults={state.totalResults}
        onResultPress={handleResultPress}
        onSortChange={handleSortChange}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onGetDirections={handleGetDirections}
        onExportResults={handleExportResults}
        testID="search-results-screen"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
    marginLeft: 8,
  },
});