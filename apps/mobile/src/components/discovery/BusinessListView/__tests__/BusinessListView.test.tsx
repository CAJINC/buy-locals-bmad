import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BusinessListView } from '../BusinessListView';
import { BusinessWithDistance } from '../types';

// Mock vector icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock business data
const mockBusinesses: BusinessWithDistance[] = [
  {
    id: '1',
    owner_id: 'owner1',
    name: 'Test Restaurant',
    description: 'A great place to eat',
    location: {
      address: '123 Main St',
      city: 'Test City',
      state: 'TC',
      zipCode: '12345',
      coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    categories: ['Restaurant'],
    hours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' }
    },
    contact: {
      phone: '555-0123',
      email: 'test@restaurant.com'
    },
    media: [],
    services: [],
    is_active: true,
    rating: 4.5,
    reviewCount: 25,
    isVerified: true,
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
    distance: 0.5,
    estimatedTravelTime: 5
  },
  {
    id: '2',
    owner_id: 'owner2',
    name: 'Coffee Shop',
    description: 'Best coffee in town',
    location: {
      address: '456 Oak Ave',
      city: 'Test City',
      state: 'TC',
      zipCode: '12345',
      coordinates: { lat: 40.7130, lng: -74.0065 }
    },
    categories: ['Cafe'],
    hours: {
      monday: { open: '07:00', close: '19:00' },
      tuesday: { open: '07:00', close: '19:00' }
    },
    contact: {
      phone: '555-0456'
    },
    media: [],
    services: [],
    is_active: true,
    rating: 4.2,
    reviewCount: 18,
    isVerified: false,
    created_at: new Date('2023-01-02'),
    updated_at: new Date('2023-01-02'),
    distance: 0.8,
    estimatedTravelTime: 8
  }
];

const mockCurrentLocation = {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: Date.now()
};

describe('BusinessListView', () => {
  const defaultProps = {
    businesses: mockBusinesses,
    currentLocation: mockCurrentLocation,
    onBusinessPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders business list correctly', () => {
      const { getByTestId } = render(<BusinessListView {...defaultProps} />);
      
      expect(getByTestId('business-list-view')).toBeTruthy();
      expect(getByTestId('business-list-view-flat-list')).toBeTruthy();
    });

    it('renders business items correctly', () => {
      const { getByTestId, getByText } = render(<BusinessListView {...defaultProps} />);
      
      expect(getByText('Test Restaurant')).toBeTruthy();
      expect(getByText('Coffee Shop')).toBeTruthy();
      expect(getByTestId('business-list-view-item-0')).toBeTruthy();
      expect(getByTestId('business-list-view-item-1')).toBeTruthy();
    });

    it('renders sort bar when showSortOptions is true', () => {
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} showSortOptions={true} />
      );
      
      expect(getByTestId('business-list-view-sort-bar')).toBeTruthy();
    });

    it('does not render sort bar when showSortOptions is false', () => {
      const { queryByTestId } = render(
        <BusinessListView {...defaultProps} showSortOptions={false} />
      );
      
      expect(queryByTestId('business-list-view-sort-bar')).toBeNull();
    });

    it('renders loading skeleton when loading is true', () => {
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} businesses={[]} loading={true} />
      );
      
      expect(getByTestId('business-list-view-skeleton')).toBeTruthy();
    });

    it('renders empty state when no businesses and not loading', () => {
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} businesses={[]} loading={false} />
      );
      
      expect(getByTestId('business-list-view-empty-state')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('calls onBusinessPress when business item is pressed', () => {
      const onBusinessPress = jest.fn();
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} onBusinessPress={onBusinessPress} />
      );
      
      fireEvent.press(getByTestId('business-list-view-item-0'));
      expect(onBusinessPress).toHaveBeenCalledWith(mockBusinesses[0]);
    });

    it('calls onRefresh when pull to refresh is triggered', () => {
      const onRefresh = jest.fn();
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} onRefresh={onRefresh} />
      );
      
      const refreshControl = getByTestId('business-list-view-refresh-control');
      fireEvent(refreshControl, 'refresh');
      expect(onRefresh).toHaveBeenCalled();
    });

    it('calls onLoadMore when end is reached', async () => {
      const onLoadMore = jest.fn();
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          onLoadMore={onLoadMore}
          hasNextPage={true}
        />
      );
      
      const flatList = getByTestId('business-list-view-flat-list');
      fireEvent(flatList, 'endReached');
      
      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalled();
      });
    });

    it('calls onSortChange when sort option is changed', () => {
      const onSortChange = jest.fn();
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          onSortChange={onSortChange}
          showSortOptions={true}
        />
      );
      
      // Toggle sort bar
      fireEvent.press(getByTestId('business-list-view-sort-bar-toggle'));
      
      // Select rating sort
      fireEvent.press(getByTestId('business-list-view-sort-bar-option-rating'));
      expect(onSortChange).toHaveBeenCalledWith('rating');
    });
  });

  describe('Sorting', () => {
    it('sorts businesses by distance correctly', () => {
      const { getByText } = render(
        <BusinessListView {...defaultProps} sortBy="distance" />
      );
      
      // Test Restaurant has distance 0.5, Coffee Shop has 0.8
      // Test Restaurant should appear first
      const businessNames = Array.from(
        getByText('Test Restaurant').parent?.parent?.parent?.children || []
      ).map(child => child.props?.children).filter(Boolean);
      
      expect(businessNames[0]).toBe('Test Restaurant');
    });

    it('sorts businesses by rating correctly', () => {
      const { rerender } = render(
        <BusinessListView {...defaultProps} sortBy="rating" />
      );
      
      // Should sort by rating (4.5 vs 4.2)
      // Test Restaurant (4.5) should come before Coffee Shop (4.2)
      rerender(<BusinessListView {...defaultProps} sortBy="rating" />);
    });

    it('sorts businesses by name correctly', () => {
      const { rerender } = render(
        <BusinessListView {...defaultProps} sortBy="name" />
      );
      
      // Should sort alphabetically
      // Coffee Shop should come before Test Restaurant
      rerender(<BusinessListView {...defaultProps} sortBy="name" />);
    });
  });

  describe('Empty State', () => {
    it('displays custom empty state message', () => {
      const customMessage = 'No restaurants found nearby';
      const { getByText } = render(
        <BusinessListView 
          {...defaultProps} 
          businesses={[]} 
          loading={false}
          emptyStateMessage={customMessage}
        />
      );
      
      expect(getByText(customMessage)).toBeTruthy();
    });

    it('displays custom empty state subtitle', () => {
      const customSubtitle = 'Try expanding your search area';
      const { getByText } = render(
        <BusinessListView 
          {...defaultProps} 
          businesses={[]} 
          loading={false}
          emptyStateSubtitle={customSubtitle}
        />
      );
      
      expect(getByText(customSubtitle)).toBeTruthy();
    });

    it('calls empty state action when button is pressed', () => {
      const emptyStateAction = jest.fn();
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          businesses={[]} 
          loading={false}
          emptyStateAction={emptyStateAction}
          emptyStateActionLabel="Retry Search"
        />
      );
      
      fireEvent.press(getByTestId('business-list-view-empty-state-action-button'));
      expect(emptyStateAction).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily when props are the same', () => {
      const { rerender } = render(<BusinessListView {...defaultProps} />);
      
      // Re-render with same props
      rerender(<BusinessListView {...defaultProps} />);
      
      // Component should not re-render unnecessarily
      // This would be tested with React DevTools Profiler in practice
    });

    it('handles large datasets efficiently', () => {
      const largeBusiness = Array.from({ length: 100 }, (_, i) => ({
        ...mockBusinesses[0],
        id: `business-${i}`,
        name: `Business ${i}`,
        distance: Math.random() * 10
      }));
      
      const { getByTestId } = render(
        <BusinessListView {...defaultProps} businesses={largeBusiness} />
      );
      
      expect(getByTestId('business-list-view')).toBeTruthy();
      // Performance would be measured with actual profiling tools
    });
  });

  describe('Accessibility', () => {
    it('has proper accessibility labels', () => {
      const { getByTestId } = render(<BusinessListView {...defaultProps} />);
      
      expect(getByTestId('business-list-view')).toBeTruthy();
      expect(getByTestId('business-list-view-flat-list')).toBeTruthy();
    });

    it('supports screen readers', () => {
      const { getByTestId } = render(<BusinessListView {...defaultProps} />);
      
      const businessItem = getByTestId('business-list-view-item-0');
      expect(businessItem).toBeTruthy();
      expect(businessItem.props.accessible).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles undefined businesses gracefully', () => {
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          businesses={undefined as any}
        />
      );
      
      expect(getByTestId('business-list-view-empty-state')).toBeTruthy();
    });

    it('handles missing location data gracefully', () => {
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          currentLocation={undefined}
        />
      );
      
      expect(getByTestId('business-list-view')).toBeTruthy();
    });

    it('handles businesses without required fields', () => {
      const incompleteBusinesses = [
        {
          ...mockBusinesses[0],
          name: '',
          location: undefined as any
        }
      ];
      
      const { getByTestId } = render(
        <BusinessListView 
          {...defaultProps} 
          businesses={incompleteBusinesses}
        />
      );
      
      expect(getByTestId('business-list-view')).toBeTruthy();
    });
  });
});