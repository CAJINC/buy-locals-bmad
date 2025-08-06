import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useColorMode, Box } from 'native-base';
import { useFocusEffect } from '@react-navigation/native';

import {
  SearchBar,
  SearchHistory,
  SearchLoadingState,
} from '../components/search';
import { SearchSuggestion } from '../services/suggestionService';
import { SearchRecommendation } from '../services/searchHistoryService';
import { LocationCoordinates } from '../services/locationService';
import { createSuggestionService } from '../services/suggestionService';
import { apiService } from '../services/apiService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ComprehensiveSearchScreenProps {
  navigation: any;
  route: any;
}

interface SearchScreenState {
  query: string;
  isSearching: boolean;
  showHistory: boolean;
  currentLocation: LocationCoordinates | null;
  searchResults: any[];
  error: string | null;
  lastSearchTime: number;
}

export const ComprehensiveSearchScreen: React.FC<ComprehensiveSearchScreenProps> = ({
  navigation,
  route,
}) => {
  const { colorMode } = useColorMode();
  
  // Initialize suggestion service
  const suggestionService = useMemo(() => {
    return createSuggestionService(apiService);
  }, []);

  // State
  const [searchState, setSearchState] = useState<SearchScreenState>({
    query: route.params?.initialQuery || '',
    isSearching: false,
    showHistory: true,
    currentLocation: route.params?.location || null,
    searchResults: [],
    error: null,
    lastSearchTime: 0,
  });

  // Dynamic theme
  const theme = useMemo(() => {
    return {
      primaryColor: '#007AFF',
      backgroundColor: colorMode === 'dark' ? '#1A1A1A' : '#FFFFFF',
      textColor: colorMode === 'dark' ? '#FFFFFF' : '#000000',
      placeholderColor: colorMode === 'dark' ? '#666666' : '#8E8E93',
      borderColor: colorMode === 'dark' ? '#333333' : '#E5E5E7',
      shadowColor: '#000000',
      surfaceColor: colorMode === 'dark' ? '#2A2A2A' : '#F8F8F8',
    };
  }, [colorMode]);

  // Handle back button (Android)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (searchState.showHistory && searchState.query.length === 0) {
          // If showing history and no query, go back to previous screen
          navigation.goBack();
          return true;
        } else if (!searchState.showHistory || searchState.query.length > 0) {
          // If showing results or has query, go back to history view
          setSearchState(prev => ({
            ...prev,
            showHistory: true,
            query: '',
            searchResults: [],
            isSearching: false,
          }));
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, searchState.showHistory, searchState.query])
  );

  // Handle search execution
  const performSearch = useCallback(
    async (query: string, location?: LocationCoordinates) => {
      if (!query.trim()) {
        return;
      }

      setSearchState(prev => ({
        ...prev,
        isSearching: true,
        showHistory: false,
        error: null,
        lastSearchTime: Date.now(),
      }));

      try {
        // This would be replaced with actual search API call
        console.log('Performing search:', { query, location });
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock results - in real implementation, this would be actual search results
        const mockResults = Array.from({ length: 8 }, (_, i) => ({
          id: `result-${i}`,
          name: `Business ${i + 1}`,
          category: 'Restaurant',
          rating: 4.0 + Math.random(),
          distance: Math.random() * 5,
          address: `${100 + i} Main St, City, State`,
        }));

        setSearchState(prev => ({
          ...prev,
          isSearching: false,
          searchResults: mockResults,
          query,
        }));

        // TODO: Add search to history
        // await searchHistoryService.addSearchEntry(query, location, region, results);

      } catch (error) {
        console.error('Search error:', error);
        setSearchState(prev => ({
          ...prev,
          isSearching: false,
          error: error instanceof Error ? error.message : 'Search failed',
        }));
      }
    },
    []
  );

  // Handle search bar search
  const handleSearch = useCallback(
    (query: string) => {
      performSearch(query, searchState.currentLocation || undefined);
    },
    [performSearch, searchState.currentLocation]
  );

  // Handle query change from search bar
  const handleQueryChange = useCallback(
    (query: string) => {
      setSearchState(prev => ({
        ...prev,
        query,
      }));
    },
    []
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      console.log('Suggestion selected:', suggestion);
      
      if (suggestion.action.type === 'search') {
        performSearch(suggestion.text, searchState.currentLocation || undefined);
      } else if (suggestion.action.type === 'navigate') {
        // Handle navigation to location
        console.log('Navigate to location:', suggestion.action.payload);
      } else if (suggestion.action.type === 'filter') {
        // Handle filter application
        console.log('Apply filter:', suggestion.action.payload);
      }
    },
    [performSearch, searchState.currentLocation]
  );

  // Handle search bar focus
  const handleSearchFocus = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      showHistory: true,
    }));
  }, []);

  // Handle search bar blur
  const handleSearchBlur = useCallback(() => {
    // Only hide history if we have search results
    if (searchState.searchResults.length > 0) {
      setSearchState(prev => ({
        ...prev,
        showHistory: false,
      }));
    }
  }, [searchState.searchResults.length]);

  // Handle voice search
  const handleVoiceSearch = useCallback(
    (query: string) => {
      console.log('Voice search result:', query);
      if (query.trim()) {
        performSearch(query, searchState.currentLocation || undefined);
      }
    },
    [performSearch, searchState.currentLocation]
  );

  // Handle history search selection
  const handleHistorySearchSelect = useCallback(
    (query: string, location?: LocationCoordinates) => {
      const searchLocation = location || searchState.currentLocation || undefined;
      performSearch(query, searchLocation);
    },
    [performSearch, searchState.currentLocation]
  );

  // Handle recommendation selection
  const handleRecommendationSelect = useCallback(
    (recommendation: SearchRecommendation) => {
      console.log('Recommendation selected:', recommendation);
      
      if (recommendation.action.type === 'search') {
        const { query, location } = recommendation.action.payload;
        performSearch(query, location || searchState.currentLocation || undefined);
      } else if (recommendation.action.type === 'navigate') {
        // Handle navigation
        console.log('Navigate to:', recommendation.action.payload);
      }
    },
    [performSearch, searchState.currentLocation]
  );

  // Get current screen content
  const getCurrentContent = () => {
    if (searchState.isSearching) {
      return (
        <SearchLoadingState
          message="Searching businesses..."
          submessage="Finding the best matches in your area"
          theme={theme}
          style={styles.loadingState}
        />
      );
    }

    if (searchState.showHistory) {
      return (
        <SearchHistory
          onSearchSelect={handleHistorySearchSelect}
          onRecommendationSelect={handleRecommendationSelect}
          currentLocation={searchState.currentLocation || undefined}
          showRecommendations={true}
          theme={theme}
          style={styles.historyContainer}
        />
      );
    }

    if (searchState.searchResults.length > 0) {
      // TODO: Implement SearchResults component in next task
      return (
        <View style={[styles.resultsContainer, { backgroundColor: theme.backgroundColor }]}>
          {/* Search results will be implemented in the next task */}
        </View>
      );
    }

    // Default to history view
    return (
      <SearchHistory
        onSearchSelect={handleHistorySearchSelect}
        onRecommendationSelect={handleRecommendationSelect}
        currentLocation={searchState.currentLocation || undefined}
        showRecommendations={true}
        theme={theme}
        style={styles.historyContainer}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar
        barStyle={colorMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.backgroundColor}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder="Search businesses, categories, or locations..."
              initialQuery={searchState.query}
              location={searchState.currentLocation || undefined}
              onSearch={handleSearch}
              onQueryChange={handleQueryChange}
              onSuggestionSelect={handleSuggestionSelect}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onVoiceSearch={handleVoiceSearch}
              showVoiceSearch={true}
              showHistory={true}
              isLoading={searchState.isSearching}
              theme={theme}
              debounceMs={300}
              maxSuggestions={8}
              performanceMode="fast"
              style={styles.searchBar}
            />
          </View>

          {/* Content Area */}
          <View style={styles.contentArea}>
            {getCurrentContent()}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  searchBarContainer: {
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchBar: {
    marginBottom: 0,
  },
  contentArea: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
  },
  historyContainer: {
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
    paddingTop: 16,
  },
});

export default ComprehensiveSearchScreen;