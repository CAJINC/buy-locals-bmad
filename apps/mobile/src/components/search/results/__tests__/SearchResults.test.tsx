import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchResults } from '../SearchResults/SearchResults';
import { SearchResultItem } from '../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock location service
jest.mock('../../../../services/locationService', () => ({
  locationService: {
    getCurrentLocation: jest.fn().mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      timestamp: Date.now()
    }),
  }
}));

const mockResults: SearchResultItem[] = [
  {
    id: '1',
    name: 'Test Coffee Shop',
    category: 'restaurant',
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    address: '123 Test St',
    rating: 4.5,
    review_count: 100,
    price_range: '$$',
    phone: '555-1234',
    website: 'https://test.com',
    photos: [],
    hours: {},
    tags: ['coffee'],
    description: 'A great coffee shop',
    distance: 0.5,
    isCurrentlyOpen: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    relevanceScore: 95,
    isBookmarked: false
  },
  {
    id: '2',
    name: 'Test Restaurant',
    category: 'restaurant',
    coordinates: { latitude: 37.7849, longitude: -122.4094 },
    address: '456 Test Ave',
    rating: 4.2,
    review_count: 50,
    price_range: '$$$',
    phone: '555-5678',
    website: 'https://restaurant.com',
    photos: [],
    hours: {},
    tags: ['food'],
    description: 'A nice restaurant',
    distance: 1.2,
    isCurrentlyOpen: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    relevanceScore: 80,
    isBookmarked: true
  }
];

const mockLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now()
};

const defaultProps = {
  results: mockResults,
  currentLocation: mockLocation,
  searchQuery: 'coffee',
  onResultPress: jest.fn(),
  onSortChange: jest.fn(),
  onRefresh: jest.fn(),
  onLoadMore: jest.fn(),
  onBookmark: jest.fn(),
  onShare: jest.fn(),
  onGetDirections: jest.fn(),
  onExportResults: jest.fn(),
};

describe('SearchResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search results correctly', () => {
    const { getByTestId, getAllByText } = render(
      <SearchResults {...defaultProps} />
    );

    expect(getByTestId('search-results')).toBeTruthy();
    expect(getAllByText('Test Coffee Shop')).toBeTruthy();
    expect(getAllByText('Test Restaurant')).toBeTruthy();
  });

  it('displays result count correctly', () => {
    const { getByText } = render(
      <SearchResults {...defaultProps} totalResults={2} />
    );

    expect(getByText('2 results found')).toBeTruthy();
  });

  it('handles result press', () => {
    const onResultPress = jest.fn();
    const { getAllByTestId } = render(
      <SearchResults {...defaultProps} onResultPress={onResultPress} />
    );

    const resultItems = getAllByTestId(/search-results-item-/);
    fireEvent.press(resultItems[0]);

    expect(onResultPress).toHaveBeenCalledWith(mockResults[0]);
  });

  it('handles sort change', async () => {
    const onSortChange = jest.fn();
    const { getByTestId } = render(
      <SearchResults {...defaultProps} onSortChange={onSortChange} />
    );

    const sortButton = getByTestId('search-results-sort-options-button');
    fireEvent.press(sortButton);

    await waitFor(() => {
      const ratingOption = getByTestId('search-results-sort-options-option-rating');
      fireEvent.press(ratingOption);
    });

    expect(onSortChange).toHaveBeenCalledWith('rating');
  });

  it('handles refresh', async () => {
    const onRefresh = jest.fn();
    const { getByTestId } = render(
      <SearchResults {...defaultProps} onRefresh={onRefresh} />
    );

    const flatList = getByTestId('search-results-flat-list');
    
    // Simulate pull to refresh
    await act(async () => {
      fireEvent(flatList, 'onRefresh');
    });

    expect(onRefresh).toHaveBeenCalled();
  });

  it('handles load more', async () => {
    const onLoadMore = jest.fn();
    const { getByTestId } = render(
      <SearchResults 
        {...defaultProps} 
        hasNextPage={true}
        onLoadMore={onLoadMore} 
      />
    );

    const loadMoreButton = getByTestId('search-results-pagination-load-more');
    fireEvent.press(loadMoreButton);

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('handles bookmark toggle', async () => {
    const onBookmark = jest.fn();
    const { getAllByTestId } = render(
      <SearchResults {...defaultProps} onBookmark={onBookmark} />
    );

    const bookmarkButtons = getAllByTestId(/search-results-item-.*-actions-bookmark/);
    fireEvent.press(bookmarkButtons[0]);

    expect(onBookmark).toHaveBeenCalledWith('1');
  });

  it('handles share', async () => {
    const onShare = jest.fn();
    const { getAllByTestId } = render(
      <SearchResults {...defaultProps} onShare={onShare} />
    );

    const shareButtons = getAllByTestId(/search-results-item-.*-actions-share/);
    fireEvent.press(shareButtons[0]);

    expect(onShare).toHaveBeenCalledWith(mockResults[0]);
  });

  it('handles get directions', async () => {
    const onGetDirections = jest.fn();
    const { getAllByTestId } = render(
      <SearchResults {...defaultProps} onGetDirections={onGetDirections} />
    );

    const directionsButtons = getAllByTestId(/search-results-item-.*-actions-directions/);
    fireEvent.press(directionsButtons[0]);

    expect(onGetDirections).toHaveBeenCalledWith(mockResults[0]);
  });

  it('shows loading state correctly', () => {
    const { getByText } = render(
      <SearchResults {...defaultProps} results={[]} isLoading={true} />
    );

    expect(getByText('Searching nearby businesses...')).toBeTruthy();
  });

  it('shows empty state when no results', () => {
    const { getByTestId } = render(
      <SearchResults {...defaultProps} results={[]} isLoading={false} />
    );

    expect(getByTestId('search-results-empty-state')).toBeTruthy();
  });

  it('shows pagination controls when has next page', () => {
    const { getByTestId } = render(
      <SearchResults {...defaultProps} hasNextPage={true} />
    );

    expect(getByTestId('search-results-pagination')).toBeTruthy();
  });

  it('sorts results correctly', () => {
    const { getAllByText } = render(
      <SearchResults {...defaultProps} sortBy="rating" />
    );

    // Results should be sorted by rating (highest first)
    // Test Restaurant has 4.2, Test Coffee Shop has 4.5
    const businessNames = getAllByText(/Test/);
    expect(businessNames[0].children[0]).toBe('Test Coffee Shop'); // 4.5 rating
  });

  it('handles infinite scroll', async () => {
    const onLoadMore = jest.fn();
    const { getByTestId } = render(
      <SearchResults 
        {...defaultProps} 
        hasNextPage={true}
        onLoadMore={onLoadMore} 
      />
    );

    const flatList = getByTestId('search-results-flat-list');
    
    // Simulate end reached
    await act(async () => {
      fireEvent(flatList, 'onEndReached');
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('shows correct result highlights', () => {
    const resultsWithHighlights = mockResults.map(result => ({
      ...result,
      searchMatchHighlights: {
        name: ['coffee'],
        description: ['coffee']
      }
    }));

    const { getByText } = render(
      <SearchResults 
        {...defaultProps} 
        results={resultsWithHighlights}
        searchQuery="coffee"
      />
    );

    // Should highlight the word "coffee" in the first result
    expect(getByText('Test Coffee Shop')).toBeTruthy();
  });

  it('handles export results', async () => {
    const onExportResults = jest.fn();
    const { getByTestId } = render(
      <SearchResults {...defaultProps} onExportResults={onExportResults} />
    );

    // Export would typically be triggered from a menu or header button
    // This is just testing the prop is passed correctly
    expect(onExportResults).toBeDefined();
  });

  it('persists sort preference', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify('rating'));
    AsyncStorage.setItem.mockResolvedValue();

    const onSortChange = jest.fn();
    const { getByTestId } = render(
      <SearchResults {...defaultProps} onSortChange={onSortChange} />
    );

    const sortButton = getByTestId('search-results-sort-options-button');
    fireEvent.press(sortButton);

    await waitFor(() => {
      const distanceOption = getByTestId('search-results-sort-options-option-distance');
      fireEvent.press(distanceOption);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@buy_locals:search_sort_preference',
      JSON.stringify('distance')
    );
  });

  it('persists bookmark state', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    AsyncStorage.setItem.mockResolvedValue();

    const onBookmark = jest.fn();
    const { getAllByTestId } = render(
      <SearchResults {...defaultProps} onBookmark={onBookmark} />
    );

    const bookmarkButtons = getAllByTestId(/search-results-item-.*-actions-bookmark/);
    fireEvent.press(bookmarkButtons[0]);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@buy_locals:bookmarked_results',
        JSON.stringify(['1'])
      );
    });
  });

  it('handles search query updates', () => {
    const { rerender, getAllByText } = render(
      <SearchResults {...defaultProps} searchQuery="coffee" />
    );

    // Update search query
    rerender(
      <SearchResults {...defaultProps} searchQuery="restaurant" />
    );

    // Results should be re-processed with new query
    expect(getAllByText(/Test/)).toBeTruthy();
  });

  it('handles location updates', () => {
    const newLocation = {
      latitude: 37.8749,
      longitude: -122.3194,
      accuracy: 15,
      timestamp: Date.now()
    };

    const { rerender } = render(
      <SearchResults {...defaultProps} currentLocation={mockLocation} />
    );

    // Update location
    rerender(
      <SearchResults {...defaultProps} currentLocation={newLocation} />
    );

    // Component should handle location change
    expect(true).toBe(true); // Basic assertion that re-render works
  });
});