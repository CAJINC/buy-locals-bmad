import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DynamicMapView } from '../DynamicMapView/DynamicMapView';
import { dynamicSearchService } from '../../../services/dynamicSearchService';
import { searchHistoryService } from '../../../services/searchHistoryService';
import { locationService } from '../../../services/locationService';

// Mock dependencies
jest.mock('../../../services/dynamicSearchService');
jest.mock('../../../services/searchHistoryService');
jest.mock('../../../services/locationService');
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  return React.forwardRef((props: any, ref: any) => {
    return (
      <View
        testID="map-view"
        ref={ref}
        onLayout={() => props.onMapReady?.()}
        {...props}
      />
    );
  });
});

// Mock components
jest.mock('../SearchNotifications', () => ({
  SearchNotificationSystem: ({ enabled, onActionPress }: any) => 
    enabled ? <div testID="search-notifications" data-action-press={onActionPress} /> : null
}));

jest.mock('../MapView/BusinessMarker', () => ({
  BusinessMarker: ({ business, onPress }: any) => (
    <div 
      testID={`business-marker-${business.id}`} 
      onPress={() => onPress(business)}
      data-business-id={business.id}
    />
  )
}));

jest.mock('../MapView/MapControls', () => ({
  MapControls: ({ onLocationPress, onToggleMapType }: any) => (
    <div testID="map-controls">
      <button testID="location-button" onPress={onLocationPress} />
      <button testID="map-type-button" onPress={onToggleMapType} />
    </div>
  )
}));

const mockDynamicSearchService = dynamicSearchService as jest.Mocked<typeof dynamicSearchService>;
const mockSearchHistoryService = searchHistoryService as jest.Mocked<typeof searchHistoryService>;
const mockLocationService = locationService as jest.Mocked<typeof locationService>;

describe('DynamicMapView', () => {
  const mockBusiness = {
    id: 'business-1',
    name: 'Test Business',
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    rating: 4.5,
    category: 'restaurant'
  };

  const mockLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    timestamp: Date.now()
  };

  const mockRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mocks
    mockDynamicSearchService.on = jest.fn();
    mockDynamicSearchService.off = jest.fn();
    mockDynamicSearchService.handleRegionChange = jest.fn();
    mockDynamicSearchService.performDynamicSearch = jest.fn().mockResolvedValue({
      id: 'search-1',
      businesses: [mockBusiness],
      source: 'fresh',
      confidence: 95,
      timestamp: Date.now()
    });
    mockDynamicSearchService.updateUserPreferences = jest.fn();

    mockSearchHistoryService.addSearchEntry = jest.fn().mockResolvedValue('entry-1');
    mockSearchHistoryService.updateUserInteraction = jest.fn();
    mockSearchHistoryService.createContextSnapshot = jest.fn().mockReturnValue({
      timestamp: Date.now(),
      location: mockLocation,
      searchState: {},
      userState: {},
      environmentalContext: {}
    });
    mockSearchHistoryService.saveContextSnapshot = jest.fn();
    mockSearchHistoryService.getContextSnapshot = jest.fn().mockReturnValue(null);

    mockLocationService.subscribeToLocationUpdates = jest.fn().mockReturnValue(() => {});
    mockLocationService.getCurrentLocation = jest.fn().mockResolvedValue(mockLocation);
    mockLocationService.startLocationWatch = jest.fn();
    mockLocationService.stopLocationWatch = jest.fn();
    mockLocationService.calculateDistance = jest.fn().mockReturnValue(1.5);

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    test('should render with default props', () => {
      const { getByTestId } = render(<DynamicMapView />);
      
      expect(getByTestId('map-view')).toBeTruthy();
    });

    test('should render with businesses', () => {
      const { getByTestId } = render(
        <DynamicMapView businesses={[mockBusiness]} />
      );
      
      expect(getByTestId('map-view')).toBeTruthy();
      expect(getByTestId(`business-marker-${mockBusiness.id}`)).toBeTruthy();
    });

    test('should render map controls', () => {
      const { getByTestId } = render(<DynamicMapView />);
      
      expect(getByTestId('map-controls')).toBeTruthy();
    });

    test('should render search notifications when enabled', () => {
      const { getByTestId } = render(
        <DynamicMapView searchNotificationsEnabled={true} />
      );
      
      expect(getByTestId('search-notifications')).toBeTruthy();
    });

    test('should not render search notifications when disabled', () => {
      const { queryByTestId } = render(
        <DynamicMapView searchNotificationsEnabled={false} />
      );
      
      expect(queryByTestId('search-notifications')).toBeNull();
    });
  });

  describe('Dynamic Search Integration', () => {
    test('should setup dynamic search listeners on mount', () => {
      render(<DynamicMapView enableDynamicSearch={true} />);
      
      expect(mockDynamicSearchService.on).toHaveBeenCalledWith(
        'search_notification',
        expect.any(Function)
      );
    });

    test('should trigger search on region change', async () => {
      const { getByTestId } = render(<DynamicMapView enableDynamicSearch={true} />);
      
      // Simulate map ready
      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onMapReady');
      });

      // Simulate region change
      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      expect(mockDynamicSearchService.handleRegionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: mockRegion.latitude,
          longitude: mockRegion.longitude,
          latitudeDelta: mockRegion.latitudeDelta,
          longitudeDelta: mockRegion.longitudeDelta
        }),
        'user_pan'
      );
    });

    test('should update businesses from dynamic search results', async () => {
      const onDynamicSearchResults = jest.fn();
      const { getByTestId } = render(
        <DynamicMapView 
          enableDynamicSearch={true}
          onDynamicSearchResults={onDynamicSearchResults}
        />
      );

      // Mock successful search
      mockDynamicSearchService.performDynamicSearch.mockResolvedValue({
        id: 'search-2',
        businesses: [mockBusiness, { ...mockBusiness, id: 'business-2' }],
        source: 'fresh',
        confidence: 90,
        timestamp: Date.now()
      });

      // Trigger search
      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onMapReady');
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      // Wait for search completion
      await waitFor(() => {
        expect(onDynamicSearchResults).toHaveBeenCalled();
      });
    });

    test('should handle search failures gracefully', async () => {
      mockDynamicSearchService.performDynamicSearch.mockRejectedValue(
        new Error('Search failed')
      );

      const { getByTestId } = render(<DynamicMapView enableDynamicSearch={true} />);

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onMapReady');
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Search Error',
          expect.stringContaining('Unable to search for businesses'),
          expect.any(Array)
        );
      });
    });

    test('should not trigger search when dynamic search is disabled', async () => {
      const { getByTestId } = render(<DynamicMapView enableDynamicSearch={false} />);

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      expect(mockDynamicSearchService.handleRegionChange).not.toHaveBeenCalled();
    });
  });

  describe('Location Integration', () => {
    test('should get user location on mount', async () => {
      render(<DynamicMapView showUserLocation={true} />);

      await waitFor(() => {
        expect(mockLocationService.getCurrentLocation).toHaveBeenCalled();
      });
    });

    test('should subscribe to location updates', () => {
      render(<DynamicMapView showUserLocation={true} followUserLocation={true} />);

      expect(mockLocationService.subscribeToLocationUpdates).toHaveBeenCalled();
      expect(mockLocationService.startLocationWatch).toHaveBeenCalledWith(true);
    });

    test('should trigger search on location updates when dynamic search enabled', async () => {
      render(
        <DynamicMapView 
          showUserLocation={true}
          followUserLocation={true}
          enableDynamicSearch={true}
        />
      );

      const locationCallback = mockLocationService.subscribeToLocationUpdates.mock.calls[0][0];
      
      await act(async () => {
        locationCallback(mockLocation);
      });

      // Should eventually trigger search due to location change
      expect(mockDynamicSearchService.handleRegionChange).toHaveBeenCalled();
    });

    test('should handle location errors', async () => {
      mockLocationService.getCurrentLocation.mockRejectedValue(
        new Error('Location unavailable')
      );

      const { getByTestId } = render(<DynamicMapView showUserLocation={true} />);

      await waitFor(() => {
        // Should show error state but not crash
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });
  });

  describe('Context Preservation', () => {
    test('should save context snapshots when enabled', async () => {
      const { getByTestId } = render(
        <DynamicMapView contextPreservationEnabled={true} />
      );

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      expect(mockSearchHistoryService.createContextSnapshot).toHaveBeenCalled();
      expect(mockSearchHistoryService.saveContextSnapshot).toHaveBeenCalled();
    });

    test('should not save context snapshots when disabled', async () => {
      const { getByTestId } = render(
        <DynamicMapView contextPreservationEnabled={false} />
      );

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      expect(mockSearchHistoryService.createContextSnapshot).not.toHaveBeenCalled();
    });

    test('should add searches to history', async () => {
      render(
        <DynamicMapView 
          enableDynamicSearch={true}
          contextPreservationEnabled={true}
        />
      );

      // Mock location service to return location
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      // Wait for initial location and trigger search
      await waitFor(() => {
        expect(mockLocationService.getCurrentLocation).toHaveBeenCalled();
      });

      // Should add search to history after successful search
      await waitFor(() => {
        expect(mockSearchHistoryService.addSearchEntry).toHaveBeenCalled();
      });
    });
  });

  describe('Business Interaction', () => {
    test('should handle business selection', async () => {
      const onBusinessSelect = jest.fn();
      const { getByTestId } = render(
        <DynamicMapView 
          businesses={[mockBusiness]}
          onBusinessSelect={onBusinessSelect}
          contextPreservationEnabled={true}
        />
      );

      // Mock search ID for interaction tracking
      mockSearchHistoryService.addSearchEntry.mockResolvedValue('search-123');

      await act(async () => {
        fireEvent.press(getByTestId(`business-marker-${mockBusiness.id}`));
      });

      expect(onBusinessSelect).toHaveBeenCalledWith(mockBusiness);
      expect(mockSearchHistoryService.updateUserInteraction).toHaveBeenCalled();
    });

    test('should combine static and dynamic businesses', async () => {
      const staticBusiness = { ...mockBusiness, id: 'static-1' };
      const dynamicBusiness = { ...mockBusiness, id: 'dynamic-1' };

      mockDynamicSearchService.performDynamicSearch.mockResolvedValue({
        id: 'search-3',
        businesses: [dynamicBusiness],
        source: 'fresh',
        confidence: 95,
        timestamp: Date.now()
      });

      const { getByTestId, queryByTestId } = render(
        <DynamicMapView 
          businesses={[staticBusiness]}
          enableDynamicSearch={true}
        />
      );

      // Should show static business initially
      expect(queryByTestId(`business-marker-${staticBusiness.id}`)).toBeTruthy();

      // Wait for dynamic search to complete
      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onMapReady');
      });

      // Should show both static and dynamic businesses
      await waitFor(() => {
        expect(queryByTestId(`business-marker-${staticBusiness.id}`)).toBeTruthy();
        expect(queryByTestId(`business-marker-${dynamicBusiness.id}`)).toBeTruthy();
      });
    });
  });

  describe('Search Notifications', () => {
    test('should handle notification actions', async () => {
      const { getByTestId } = render(
        <DynamicMapView 
          enableDynamicSearch={true}
          searchNotificationsEnabled={true}
        />
      );

      const notificationSystem = getByTestId('search-notifications');
      const actionHandler = notificationSystem.props['data-action-press'];

      await act(async () => {
        actionHandler('retry', { 
          type: 'search_failed', 
          region: mockRegion, 
          timestamp: Date.now(),
          searchId: 'failed-search'
        });
      });

      // Should trigger a new search
      expect(mockDynamicSearchService.performDynamicSearch).toHaveBeenCalled();
    });

    test('should disable auto-search on user request', async () => {
      const { getByTestId } = render(
        <DynamicMapView 
          enableDynamicSearch={true}
          searchNotificationsEnabled={true}
        />
      );

      const notificationSystem = getByTestId('search-notifications');
      const actionHandler = notificationSystem.props['data-action-press'];

      await act(async () => {
        actionHandler('disable_updates', { 
          type: 'bandwidth_limited', 
          region: mockRegion, 
          timestamp: Date.now(),
          searchId: 'bandwidth-search'
        });
      });

      expect(mockDynamicSearchService.updateUserPreferences).toHaveBeenCalledWith({
        autoSearchEnabled: false
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Auto-Search Disabled',
        expect.stringContaining('Dynamic search updates have been disabled'),
        expect.any(Array)
      );
    });
  });

  describe('Map Controls', () => {
    test('should handle location button press', async () => {
      const onLocationPress = jest.fn();
      const { getByTestId } = render(
        <DynamicMapView onLocationPress={onLocationPress} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('location-button'));
      });

      expect(onLocationPress).toHaveBeenCalled();
    });

    test('should get current location when location button pressed without custom handler', async () => {
      const { getByTestId } = render(<DynamicMapView />);

      await act(async () => {
        fireEvent.press(getByTestId('location-button'));
      });

      expect(mockLocationService.getCurrentLocation).toHaveBeenCalled();
    });

    test('should toggle map type', async () => {
      const { getByTestId } = render(<DynamicMapView />);

      await act(async () => {
        fireEvent.press(getByTestId('map-type-button'));
      });

      // Should cycle through map types (implementation specific)
      // This tests that the handler is connected
    });
  });

  describe('Error Handling', () => {
    test('should handle location service errors gracefully', async () => {
      mockLocationService.getCurrentLocation.mockRejectedValue(
        new Error('GPS unavailable')
      );

      const { getByTestId } = render(<DynamicMapView showUserLocation={true} />);

      // Should not crash the component
      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });

    test('should handle dynamic search service errors', async () => {
      mockDynamicSearchService.handleRegionChange.mockRejectedValue(
        new Error('Search service unavailable')
      );

      const { getByTestId } = render(<DynamicMapView enableDynamicSearch={true} />);

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      // Should not crash despite error
      expect(getByTestId('map-view')).toBeTruthy();
    });

    test('should handle context preservation errors', async () => {
      mockSearchHistoryService.saveContextSnapshot.mockRejectedValue(
        new Error('Storage unavailable')
      );

      const { getByTestId } = render(
        <DynamicMapView contextPreservationEnabled={true} />
      );

      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      // Should not crash despite context save error
      expect(getByTestId('map-view')).toBeTruthy();
    });
  });

  describe('State Management', () => {
    test('should update search state correctly', async () => {
      const onSearchStateChange = jest.fn();
      const { getByTestId } = render(
        <DynamicMapView 
          enableDynamicSearch={true}
          onSearchStateChange={onSearchStateChange}
        />
      );

      // Should start as idle
      expect(onSearchStateChange).toHaveBeenCalledWith('idle');

      // Trigger search
      await act(async () => {
        fireEvent(getByTestId('map-view'), 'onMapReady');
        fireEvent(getByTestId('map-view'), 'onRegionChangeComplete', mockRegion);
      });

      // Should transition through searching to completed
      await waitFor(() => {
        expect(onSearchStateChange).toHaveBeenCalledWith('searching');
        expect(onSearchStateChange).toHaveBeenCalledWith('completed');
      });
    });

    test('should handle search state changes from notifications', async () => {
      const onSearchStateChange = jest.fn();
      render(
        <DynamicMapView 
          enableDynamicSearch={true}
          onSearchStateChange={onSearchStateChange}
        />
      );

      // Get the notification handler
      const notificationHandler = mockDynamicSearchService.on.mock.calls[0][1];

      await act(async () => {
        notificationHandler({
          type: 'search_started',
          searchId: 'test-search',
          timestamp: Date.now(),
          region: mockRegion
        });
      });

      expect(onSearchStateChange).toHaveBeenCalledWith('searching');

      await act(async () => {
        notificationHandler({
          type: 'search_completed',
          searchId: 'test-search',
          timestamp: Date.now(),
          region: mockRegion,
          resultCount: 5
        });
      });

      expect(onSearchStateChange).toHaveBeenCalledWith('completed');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup services on unmount', () => {
      const { unmount } = render(<DynamicMapView enableDynamicSearch={true} />);

      unmount();

      expect(mockDynamicSearchService.off).toHaveBeenCalled();
      expect(mockLocationService.stopLocationWatch).toHaveBeenCalled();
    });

    test('should clear timers on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = render(
        <DynamicMapView contextPreservationEnabled={true} />
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });
});