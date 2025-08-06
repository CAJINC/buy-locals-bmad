import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  SearchResultItem, 
  SearchSortOption, 
  SearchResultsState 
} from '../types';
import { 
  sortSearchResults, 
  filterSearchResults, 
  calculateRelevanceScore,
  generateSearchHighlights,
  paginateResults,
  debounce
} from '../utils/searchResultUtils';
import { LocationCoordinates } from '../../../../services/locationService';
import { 
  DEFAULT_SORT, 
  RESULTS_PER_PAGE, 
  BOOKMARK_STORAGE_KEY, 
  SORT_PREFERENCE_STORAGE_KEY 
} from '../constants';

export interface UseSearchResultsOptions {
  initialResults?: SearchResultItem[];
  initialSortBy?: SearchSortOption;
  searchQuery?: string;
  currentLocation?: LocationCoordinates;
  filters?: any;
  enableBookmarking?: boolean;
  enableInfiniteScroll?: boolean;
  pageSize?: number;
}

export interface UseSearchResultsReturn {
  state: SearchResultsState;
  actions: {
    setSortBy: (sortBy: SearchSortOption) => void;
    setResults: (results: SearchResultItem[]) => void;
    addResults: (results: SearchResultItem[]) => void;
    refreshResults: () => Promise<void>;
    loadMore: () => Promise<void>;
    toggleBookmark: (resultId: string) => Promise<void>;
    clearResults: () => void;
    retrySearch: () => void;
  };
  computed: {
    sortedResults: SearchResultItem[];
    displayResults: SearchResultItem[];
    isEmpty: boolean;
    isLastPage: boolean;
    hasBookmarks: boolean;
  };
  preferences: {
    sortPreference: SearchSortOption;
    bookmarkedIds: Set<string>;
  };
}

/**
 * Custom hook for managing search results state and operations
 */
export const useSearchResults = ({
  initialResults = [],
  initialSortBy = DEFAULT_SORT,
  searchQuery = '',
  currentLocation,
  filters,
  enableBookmarking = true,
  enableInfiniteScroll = true,
  pageSize = RESULTS_PER_PAGE
}: UseSearchResultsOptions = {}): UseSearchResultsReturn => {
  // Core state
  const [state, setState] = useState<SearchResultsState>({
    results: initialResults,
    sortBy: initialSortBy,
    currentPage: 0,
    totalResults: initialResults.length,
    hasNextPage: false,
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
    lastUpdated: new Date(),
    searchQuery: searchQuery,
    filters: filters,
    bookmarkedResults: new Set()
  });

  // Refs for async operations
  const refreshCallbackRef = useRef<(() => Promise<void>) | null>(null);
  const loadMoreCallbackRef = useRef<(() => Promise<void>) | null>(null);
  
  // Persistent preferences
  const [sortPreference, setSortPreference] = useState<SearchSortOption>(initialSortBy);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Load user preferences on mount
  useEffect(() => {
    loadUserPreferences();
  }, []);

  // Update relevance scores when search query changes
  useEffect(() => {
    if (searchQuery && state.results.length > 0) {
      const updatedResults = state.results.map(result => ({
        ...result,
        relevanceScore: calculateRelevanceScore(result, searchQuery),
        searchMatchHighlights: generateSearchHighlights(result, searchQuery)
      }));
      
      setState(prev => ({
        ...prev,
        results: updatedResults,
        searchQuery
      }));
    }
  }, [searchQuery]);

  // Load user preferences from storage
  const loadUserPreferences = useCallback(async () => {
    try {
      const [sortPref, bookmarks] = await Promise.all([
        AsyncStorage.getItem(SORT_PREFERENCE_STORAGE_KEY),
        AsyncStorage.getItem(BOOKMARK_STORAGE_KEY)
      ]);

      if (sortPref) {
        const savedSort = JSON.parse(sortPref) as SearchSortOption;
        setSortPreference(savedSort);
        setState(prev => ({ ...prev, sortBy: savedSort }));
      }

      if (bookmarks) {
        const savedBookmarks = new Set(JSON.parse(bookmarks));
        setBookmarkedIds(savedBookmarks);
        setState(prev => ({ ...prev, bookmarkedResults: savedBookmarks }));
      }
    } catch (error) {
      console.warn('Failed to load search preferences:', error);
    }
  }, []);

  // Save sort preference
  const saveSortPreference = useCallback(async (sortBy: SearchSortOption) => {
    try {
      await AsyncStorage.setItem(SORT_PREFERENCE_STORAGE_KEY, JSON.stringify(sortBy));
    } catch (error) {
      console.warn('Failed to save sort preference:', error);
    }
  }, []);

  // Save bookmarks
  const saveBookmarks = useCallback(async (bookmarks: Set<string>) => {
    if (!enableBookmarking) return;
    
    try {
      await AsyncStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...bookmarks]));
    } catch (error) {
      console.warn('Failed to save bookmarks:', error);
    }
  }, [enableBookmarking]);

  // Computed values
  const sortedResults = useMemo(() => {
    const filtered = filterSearchResults(state.results, searchQuery, filters);
    return sortSearchResults(filtered, state.sortBy, currentLocation);
  }, [state.results, state.sortBy, searchQuery, filters, currentLocation]);

  const displayResults = useMemo(() => {
    if (!enableInfiniteScroll) return sortedResults;
    
    const { items } = paginateResults(sortedResults, state.currentPage, pageSize);
    return items;
  }, [sortedResults, state.currentPage, pageSize, enableInfiniteScroll]);

  const hasNextPage = useMemo(() => {
    if (!enableInfiniteScroll) return false;
    
    const { hasNextPage } = paginateResults(sortedResults, state.currentPage, pageSize);
    return hasNextPage;
  }, [sortedResults, state.currentPage, pageSize, enableInfiniteScroll]);

  // Actions
  const setSortBy = useCallback((sortBy: SearchSortOption) => {
    setState(prev => ({ ...prev, sortBy, currentPage: 0 }));
    setSortPreference(sortBy);
    saveSortPreference(sortBy);
  }, [saveSortPreference]);

  const setResults = useCallback((results: SearchResultItem[]) => {
    const processedResults = results.map(result => ({
      ...result,
      relevanceScore: calculateRelevanceScore(result, searchQuery),
      searchMatchHighlights: generateSearchHighlights(result, searchQuery),
      isBookmarked: bookmarkedIds.has(result.id)
    }));

    setState(prev => ({
      ...prev,
      results: processedResults,
      totalResults: processedResults.length,
      currentPage: 0,
      lastUpdated: new Date(),
      hasNextPage: hasNextPage
    }));
  }, [searchQuery, bookmarkedIds, hasNextPage]);

  const addResults = useCallback((newResults: SearchResultItem[]) => {
    const processedResults = newResults.map(result => ({
      ...result,
      relevanceScore: calculateRelevanceScore(result, searchQuery),
      searchMatchHighlights: generateSearchHighlights(result, searchQuery),
      isBookmarked: bookmarkedIds.has(result.id)
    }));

    setState(prev => {
      const updatedResults = [...prev.results, ...processedResults];
      return {
        ...prev,
        results: updatedResults,
        totalResults: updatedResults.length,
        lastUpdated: new Date()
      };
    });
  }, [searchQuery, bookmarkedIds]);

  const refreshResults = useCallback(async () => {
    if (!refreshCallbackRef.current) return;

    setState(prev => ({ ...prev, isRefreshing: true }));
    try {
      await refreshCallbackRef.current();
    } catch (error) {
      console.error('Failed to refresh results:', error);
    } finally {
      setState(prev => ({ ...prev, isRefreshing: false }));
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!loadMoreCallbackRef.current || !hasNextPage || state.isLoadingMore) return;

    setState(prev => ({ ...prev, isLoadingMore: true }));
    try {
      await loadMoreCallbackRef.current();
      setState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    } catch (error) {
      console.error('Failed to load more results:', error);
    } finally {
      setState(prev => ({ ...prev, isLoadingMore: false }));
    }
  }, [hasNextPage, state.isLoadingMore]);

  const toggleBookmark = useCallback(async (resultId: string) => {
    if (!enableBookmarking) return;

    const newBookmarks = new Set(bookmarkedIds);
    if (newBookmarks.has(resultId)) {
      newBookmarks.delete(resultId);
    } else {
      newBookmarks.add(resultId);
    }

    setBookmarkedIds(newBookmarks);
    await saveBookmarks(newBookmarks);

    // Update the result's bookmark status
    setState(prev => ({
      ...prev,
      results: prev.results.map(result =>
        result.id === resultId
          ? { ...result, isBookmarked: newBookmarks.has(resultId) }
          : result
      ),
      bookmarkedResults: newBookmarks
    }));
  }, [enableBookmarking, bookmarkedIds, saveBookmarks]);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      totalResults: 0,
      currentPage: 0,
      hasNextPage: false,
      lastUpdated: new Date()
    }));
  }, []);

  const retrySearch = useCallback(() => {
    if (refreshCallbackRef.current) {
      refreshResults();
    }
  }, [refreshResults]);

  // Debounced search effect for performance
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setState(prev => ({ ...prev, searchQuery: query }));
    }, 300),
    []
  );

  // Set callback refs for external operations
  const setRefreshCallback = useCallback((callback: () => Promise<void>) => {
    refreshCallbackRef.current = callback;
  }, []);

  const setLoadMoreCallback = useCallback((callback: () => Promise<void>) => {
    loadMoreCallbackRef.current = callback;
  }, []);

  return {
    state: {
      ...state,
      hasNextPage
    },
    actions: {
      setSortBy,
      setResults,
      addResults,
      refreshResults,
      loadMore,
      toggleBookmark,
      clearResults,
      retrySearch
    },
    computed: {
      sortedResults,
      displayResults,
      isEmpty: sortedResults.length === 0,
      isLastPage: !hasNextPage,
      hasBookmarks: bookmarkedIds.size > 0
    },
    preferences: {
      sortPreference,
      bookmarkedIds
    }
  };
};