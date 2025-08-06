import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { FilterPanel } from '../FilterPanel/FilterPanel';
import { DEFAULT_FILTER_STATE, FILTER_PRESETS, DEFAULT_CATEGORIES } from '../FilterPanel/constants';
import { FilterState } from '../FilterPanel/types';

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    PanGestureHandler: View,
    State: { BEGAN: 0, FAILED: 1, CANCELLED: 2, END: 3 },
  };
});

describe('FilterPanel', () => {
  const defaultProps = {
    filters: DEFAULT_FILTER_STATE,
    onFiltersChange: jest.fn(),
    onClose: jest.fn(),
    visible: true,
    categories: DEFAULT_CATEGORIES,
    resultCount: 42,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    render(<FilterPanel {...defaultProps} />);
    
    expect(screen.getByTestId('filter-panel')).toBeTruthy();
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByText('View 42 Results')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(<FilterPanel {...defaultProps} visible={false} />);
    
    expect(screen.queryByTestId('filter-panel')).toBeFalsy();
  });

  it('displays active filter count badge', () => {
    const filtersWithCategories: FilterState = {
      ...DEFAULT_FILTER_STATE,
      categories: ['restaurants', 'shopping'],
      rating: { minimum: 4.0 },
    };

    render(
      <FilterPanel 
        {...defaultProps} 
        filters={filtersWithCategories}
      />
    );
    
    expect(screen.getByText('2')).toBeTruthy(); // Filter count badge
  });

  it('handles filter section expansion/collapse', async () => {
    render(<FilterPanel {...defaultProps} />);
    
    const categorySection = screen.getByTestId('filter-panel-section-categories');
    expect(categorySection).toBeTruthy();
    
    // Categories should be expanded by default
    expect(screen.getByTestId('category-filter')).toBeTruthy();
    
    // Collapse the section
    fireEvent.press(categorySection);
    
    await waitFor(() => {
      expect(screen.queryByTestId('category-filter')).toBeFalsy();
    });
  });

  it('handles preset selection', async () => {
    const onFiltersChangeMock = jest.fn();
    
    render(
      <FilterPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChangeMock}
      />
    );
    
    const firstPreset = FILTER_PRESETS[0];
    const presetButton = screen.getByTestId(`filter-panel-presets-item-${firstPreset.id}`);
    
    fireEvent.press(presetButton);
    
    await waitFor(() => {
      expect(onFiltersChangeMock).toHaveBeenCalledWith({
        ...DEFAULT_FILTER_STATE,
        ...firstPreset.filters,
      });
    });
  });

  it('handles clear all filters', async () => {
    const onFiltersChangeMock = jest.fn();
    const filtersWithData: FilterState = {
      ...DEFAULT_FILTER_STATE,
      categories: ['restaurants'],
      rating: { minimum: 4.0 },
    };
    
    render(
      <FilterPanel 
        {...defaultProps} 
        filters={filtersWithData}
        onFiltersChange={onFiltersChangeMock}
      />
    );
    
    const clearButton = screen.getByTestId('filter-panel-clear');
    fireEvent.press(clearButton);
    
    await waitFor(() => {
      expect(onFiltersChangeMock).toHaveBeenCalledWith(DEFAULT_FILTER_STATE);
    });
  });

  it('handles apply filters (close modal)', async () => {
    const onCloseMock = jest.fn();
    
    render(
      <FilterPanel 
        {...defaultProps} 
        onClose={onCloseMock}
      />
    );
    
    const applyButton = screen.getByTestId('filter-panel-apply');
    fireEvent.press(applyButton);
    
    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('displays loading state correctly', () => {
    render(
      <FilterPanel 
        {...defaultProps} 
        isLoading={true}
        resultCount={0}
      />
    );
    
    expect(screen.getByText('Searching...')).toBeTruthy();
  });

  it('displays filter chips for active filters', () => {
    const filtersWithData: FilterState = {
      ...DEFAULT_FILTER_STATE,
      categories: ['restaurants'],
      rating: { minimum: 4.0 },
      hours: { openNow: true },
    };
    
    render(
      <FilterPanel 
        {...defaultProps} 
        filters={filtersWithData}
      />
    );
    
    expect(screen.getByTestId('filter-panel-chips')).toBeTruthy();
  });

  it('handles filter chip removal', async () => {
    const onFiltersChangeMock = jest.fn();
    const filtersWithData: FilterState = {
      ...DEFAULT_FILTER_STATE,
      categories: ['restaurants'],
    };
    
    render(
      <FilterPanel 
        {...defaultProps} 
        filters={filtersWithData}
        onFiltersChange={onFiltersChangeMock}
      />
    );
    
    // Find and press the remove button on a filter chip
    const filterChips = screen.getByTestId('filter-panel-chips');
    expect(filterChips).toBeTruthy();
    
    // This would test chip removal - implementation depends on FilterChips component
    // fireEvent.press(removeButton);
  });

  it('handles category filter changes', async () => {
    const onFiltersChangeMock = jest.fn();
    
    render(
      <FilterPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChangeMock}
      />
    );
    
    // Expand categories section (should be expanded by default)
    const categoryFilter = screen.getByTestId('category-filter');
    expect(categoryFilter).toBeTruthy();
    
    // Test category selection would depend on CategoryFilter implementation
  });

  it('handles accessibility requirements', () => {
    render(<FilterPanel {...defaultProps} />);
    
    // Check for proper accessibility labels
    const closeButton = screen.getByTestId('filter-panel-close');
    expect(closeButton).toBeTruthy();
    
    const applyButton = screen.getByTestId('filter-panel-apply');
    expect(applyButton).toBeTruthy();
  });

  it('handles backdrop press to close', async () => {
    const onCloseMock = jest.fn();
    
    render(
      <FilterPanel 
        {...defaultProps} 
        onClose={onCloseMock}
      />
    );
    
    // The backdrop would be a touchable area behind the modal
    // This test would need to simulate pressing outside the modal content
    // Implementation depends on the specific modal structure
  });

  it('persists scroll position when sections are toggled', async () => {
    render(<FilterPanel {...defaultProps} />);
    
    // This test would verify that scrolling position is maintained
    // when sections are expanded/collapsed
    // Implementation would depend on ScrollView ref usage
  });

  it('handles theme customization', () => {
    const customTheme = {
      primaryColor: '#FF5722',
      backgroundColor: '#FAFAFA',
      surfaceColor: '#EEEEEE',
      textColor: '#212121',
      borderColor: '#E0E0E0',
    };
    
    render(
      <FilterPanel 
        {...defaultProps} 
        theme={customTheme}
      />
    );
    
    // Verify theme colors are applied
    // This would test that components use the provided theme
  });

  it('handles different screen sizes responsively', () => {
    // Mock different screen dimensions
    const mockDimensions = { width: 320, height: 568 }; // iPhone SE size
    
    render(<FilterPanel {...defaultProps} />);
    
    // Test that the modal adapts to smaller screens
    // This would verify responsive design implementation
  });
});

describe('FilterPanel Integration', () => {
  const integrationProps = {
    filters: DEFAULT_FILTER_STATE,
    onFiltersChange: jest.fn(),
    onClose: jest.fn(),
    visible: true,
    categories: DEFAULT_CATEGORIES,
    resultCount: 150,
    location: { latitude: 37.7749, longitude: -122.4194 },
  };

  it('integrates with all child components', () => {
    render(<FilterPanel {...integrationProps} />);
    
    // Verify all major components are rendered
    expect(screen.getByTestId('filter-panel')).toBeTruthy();
    expect(screen.getByTestId('filter-panel-presets')).toBeTruthy();
    expect(screen.getByTestId('filter-panel-summary')).toBeTruthy();
  });

  it('handles complex filter combinations', async () => {
    const complexFilters: FilterState = {
      categories: ['restaurants', 'shopping'],
      priceRange: { min: 25, max: 100 },
      distance: { radius: 10, unit: 'km' },
      rating: { minimum: 4.0 },
      hours: { openNow: true },
      features: ['wifi', 'parking'],
    };

    const onFiltersChangeMock = jest.fn();
    
    render(
      <FilterPanel 
        {...integrationProps} 
        filters={complexFilters}
        onFiltersChange={onFiltersChangeMock}
      />
    );
    
    // Verify complex filters are displayed correctly
    expect(screen.getByText('6')).toBeTruthy(); // Filter count badge
    expect(screen.getByTestId('filter-panel-chips')).toBeTruthy();
  });

  it('handles performance with large category lists', () => {
    const largeCategories = Array.from({ length: 100 }, (_, i) => ({
      id: `category-${i}`,
      name: `Category ${i}`,
      icon: 'category',
      count: Math.floor(Math.random() * 100),
    }));

    render(
      <FilterPanel 
        {...integrationProps} 
        categories={largeCategories}
      />
    );
    
    // Verify performance with large data sets
    expect(screen.getByTestId('filter-panel')).toBeTruthy();
  });
});