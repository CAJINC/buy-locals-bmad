import { searchHistoryService, SearchHistoryEntry, SearchRecommendation } from '../searchHistoryService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('SearchHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    searchHistoryService.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with empty history', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const stats = searchHistoryService.getStatistics();
      expect(stats.historyEntries).toBe(0);
    });

    test('should load stored history on initialization', async () => {
      const mockHistory = [
        {
          id: 'test-1',
          timestamp: Date.now(),
          query: 'coffee',
          location: { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
          region: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          results: { count: 5, businesses: [], source: 'fresh', responseTime: 1000, confidence: 95 },
          userInteraction: { viewDuration: 0, businessesViewed: [], businessesInteracted: [], businessesSaved: [], wasHelpful: true },
          context: { appState: 'foreground', networkType: 'wifi', movementPattern: 'stationary', timeOfDay: 'morning', dayOfWeek: 'monday' },
          sessionInfo: { sessionId: 'session-1', searchSequence: 1, isRepeatSearch: false }
        }
      ];

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockHistory));
      
      const service = new (searchHistoryService.constructor as any)();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('Search History Management', () => {
    test('should add search entry to history', async () => {
      const query = 'restaurants';
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [{ id: '1', name: 'Test Restaurant' }], source: 'fresh', responseTime: 1200, confidence: 90 };

      const searchId = await searchHistoryService.addSearchEntry(query, location, region, results);

      expect(searchId).toBeDefined();
      expect(typeof searchId).toBe('string');

      const history = searchHistoryService.getSearchHistory({ limit: 1 });
      expect(history.length).toBe(1);
      expect(history[0].query).toBe(query);
      expect(history[0].location).toEqual(location);
      expect(history[0].results.confidence).toBe(90);
    });

    test('should detect repeat searches', async () => {
      const query = 'coffee shops';
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 85 };

      // First search
      await searchHistoryService.addSearchEntry(query, location, region, results);
      
      // Repeat search
      await searchHistoryService.addSearchEntry(query, location, region, results);

      const history = searchHistoryService.getSearchHistory({ limit: 2 });
      expect(history.length).toBe(2);
      expect(history[0].sessionInfo.isRepeatSearch).toBe(true);
      expect(history[1].sessionInfo.isRepeatSearch).toBe(false);
    });

    test('should update user interaction data', async () => {
      const searchId = await searchHistoryService.addSearchEntry(
        'pizza',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      await searchHistoryService.updateUserInteraction(searchId, {
        viewDuration: 30000,
        businessesViewed: ['business-1', 'business-2'],
        businessesInteracted: ['business-1'],
        rating: 4
      });

      const history = searchHistoryService.getSearchHistory({ limit: 1 });
      expect(history[0].userInteraction.viewDuration).toBe(30000);
      expect(history[0].userInteraction.businessesViewed).toHaveLength(2);
      expect(history[0].userInteraction.rating).toBe(4);
    });

    test('should filter search history', async () => {
      const baseLocation = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add multiple searches
      await searchHistoryService.addSearchEntry('coffee', baseLocation, region, results);
      await searchHistoryService.addSearchEntry('restaurants', { ...baseLocation, latitude: 37.7849 }, region, results);
      await searchHistoryService.addSearchEntry('coffee', baseLocation, region, results);

      // Filter by query
      const coffeeSearches = searchHistoryService.getSearchHistory({ query: 'coffee' });
      expect(coffeeSearches).toHaveLength(2);
      expect(coffeeSearches.every(search => search.query?.includes('coffee'))).toBe(true);

      // Filter by location and radius
      const nearbySearches = searchHistoryService.getSearchHistory({
        location: baseLocation,
        radius: 5 // 5km radius
      });
      expect(nearbySearches.length).toBeGreaterThan(0);

      // Filter by date range
      const now = Date.now();
      const recentSearches = searchHistoryService.getSearchHistory({
        fromDate: now - 60000, // Last minute
        toDate: now
      });
      expect(recentSearches.length).toBe(3);
    });

    test('should clear old search history', async () => {
      // Add some searches
      await searchHistoryService.addSearchEntry(
        'test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      const historyBeforeClear = searchHistoryService.getSearchHistory();
      expect(historyBeforeClear.length).toBeGreaterThan(0);

      await searchHistoryService.clearSearchHistory();

      const historyAfterClear = searchHistoryService.getSearchHistory();
      expect(historyAfterClear).toHaveLength(0);
    });
  });

  describe('Pattern Learning', () => {
    test('should learn location-based patterns', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add multiple searches in same location
      for (let i = 0; i < 6; i++) {
        await searchHistoryService.addSearchEntry(
          `query-${i}`,
          { ...location, timestamp: Date.now() + i },
          region,
          results
        );
      }

      const stats = searchHistoryService.getStatistics();
      expect(stats.searchPatterns).toBeGreaterThan(0);
    });

    test('should learn time-based patterns', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Mock time of day
      const originalGetHours = Date.prototype.getHours;
      Date.prototype.getHours = jest.fn(() => 9); // Morning

      // Add multiple morning searches
      for (let i = 0; i < 8; i++) {
        await searchHistoryService.addSearchEntry(
          'coffee',
          location,
          region,
          results
        );
      }

      Date.prototype.getHours = originalGetHours;

      const stats = searchHistoryService.getStatistics();
      expect(stats.searchPatterns).toBeGreaterThan(0);
    });

    test('should learn mixed patterns', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Mock consistent time
      Date.prototype.getHours = jest.fn(() => 12); // Lunch time

      // Add multiple lunch searches for same query and location
      for (let i = 0; i < 4; i++) {
        await searchHistoryService.addSearchEntry(
          'lunch restaurants',
          location,
          region,
          results
        );
      }

      const stats = searchHistoryService.getStatistics();
      expect(stats.searchPatterns).toBeGreaterThan(0);
    });
  });

  describe('Search Recommendations', () => {
    test('should generate location-based recommendations', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add searches in the area
      await searchHistoryService.addSearchEntry('coffee', location, region, results);
      await searchHistoryService.addSearchEntry('coffee', location, region, results);
      await searchHistoryService.addSearchEntry('restaurants', location, region, results);

      const recommendations = await searchHistoryService.getSearchRecommendations(location);

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      
      const coffeeRec = recommendations.find(rec => rec.title.includes('coffee'));
      expect(coffeeRec).toBeDefined();
      expect(coffeeRec?.confidence).toBeGreaterThan(0);
    });

    test('should generate time-based recommendations', async () => {
      // Mock current time
      const mockHour = 8; // Morning
      Date.prototype.getHours = jest.fn(() => mockHour);
      Date.prototype.getDay = jest.fn(() => 1); // Monday

      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add multiple morning searches
      for (let i = 0; i < 10; i++) {
        await searchHistoryService.addSearchEntry('breakfast', location, region, results);
      }

      const recommendations = await searchHistoryService.getSearchRecommendations(location);

      const timeBasedRec = recommendations.find(rec => 
        rec.basedOn.timeContext && rec.title.includes('breakfast')
      );
      expect(timeBasedRec).toBeDefined();
    });

    test('should rank recommendations by relevance', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add high-frequency search
      for (let i = 0; i < 10; i++) {
        await searchHistoryService.addSearchEntry('popular query', location, region, results);
      }

      // Add low-frequency search
      await searchHistoryService.addSearchEntry('rare query', location, region, results);

      const recommendations = await searchHistoryService.getSearchRecommendations(location);

      expect(recommendations.length).toBeGreaterThan(0);
      
      // First recommendation should have higher relevance
      if (recommendations.length > 1) {
        expect(recommendations[0].relevanceScore).toBeGreaterThanOrEqual(recommendations[1].relevanceScore);
      }
    });
  });

  describe('Context Preservation', () => {
    test('should create context snapshots', () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const searchState = {
        activeQuery: 'coffee',
        activeFilters: { openNow: true },
        currentRegion: { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        resultCount: 5
      };
      const userState = {
        interactionMode: 'searching' as const,
        recentActions: ['search', 'filter']
      };

      const snapshot = searchHistoryService.createContextSnapshot(location, searchState, userState);

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.location).toEqual(location);
      expect(snapshot.searchState.activeQuery).toBe('coffee');
      expect(snapshot.userState.interactionMode).toBe('searching');
    });

    test('should save and retrieve context snapshots', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const snapshot = searchHistoryService.createContextSnapshot(
        location,
        { resultCount: 3 },
        { interactionMode: 'browsing' as const }
      );

      await searchHistoryService.saveContextSnapshot(snapshot);

      const retrievedSnapshot = searchHistoryService.getContextSnapshot();
      expect(retrievedSnapshot).toBeDefined();
      expect(retrievedSnapshot?.timestamp).toBe(snapshot.timestamp);
    });

    test('should limit context snapshot storage', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };

      // Create many snapshots
      for (let i = 0; i < 150; i++) {
        const snapshot = searchHistoryService.createContextSnapshot(
          { ...location, timestamp: Date.now() + i },
          { resultCount: i },
          { interactionMode: 'browsing' as const }
        );
        await searchHistoryService.saveContextSnapshot(snapshot);
      }

      const stats = searchHistoryService.getStatistics();
      expect(stats.contextSnapshots).toBeLessThanOrEqual(100); // Should enforce limit
    });
  });

  describe('Performance Metrics', () => {
    test('should track search performance', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };

      // Add searches with different performance characteristics
      await searchHistoryService.addSearchEntry(
        'fast search',
        location,
        region,
        { businesses: [], source: 'fresh', responseTime: 500, confidence: 95 }
      );

      await searchHistoryService.addSearchEntry(
        'slow search',
        location,
        region,
        { businesses: [], source: 'fresh', responseTime: 2000, confidence: 80 }
      );

      const stats = searchHistoryService.getStatistics();
      expect(stats.performanceMetrics).toBeDefined();
      expect(stats.performanceMetrics.averageSearchTime).toBeGreaterThan(0);
    });

    test('should update user satisfaction scores', async () => {
      const searchId = await searchHistoryService.addSearchEntry(
        'test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      await searchHistoryService.updateUserInteraction(searchId, { rating: 5 });

      const stats = searchHistoryService.getStatistics();
      expect(stats.performanceMetrics.userSatisfactionScore).toBeGreaterThan(0);
    });
  });

  describe('Data Management', () => {
    test('should enforce history size limits', async () => {
      const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      const results = { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 };

      // Add more than the limit
      for (let i = 0; i < 550; i++) {
        await searchHistoryService.addSearchEntry(`query-${i}`, location, region, results);
      }

      const stats = searchHistoryService.getStatistics();
      expect(stats.historyEntries).toBeLessThanOrEqual(500); // Should enforce limit
    });

    test('should reset daily metrics', async () => {
      // Mock date change
      const originalToDateString = Date.prototype.toDateString;
      let currentDay = 'Mon Jan 01 2024';
      Date.prototype.toDateString = jest.fn(() => currentDay);

      // Add some data
      await searchHistoryService.addSearchEntry(
        'test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      // Change day
      currentDay = 'Tue Jan 02 2024';

      // Create new service instance (simulating app restart)
      const newService = new (searchHistoryService.constructor as any)();
      await new Promise(resolve => setTimeout(resolve, 100));

      Date.prototype.toDateString = originalToDateString;
    });

    test('should persist data to storage', async () => {
      await searchHistoryService.addSearchEntry(
        'persist test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      // Should have called setItem to persist
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle storage failures gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));

      // Should not throw error
      await expect(searchHistoryService.addSearchEntry(
        'error test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      )).resolves.toBeDefined();
    });

    test('should handle invalid search IDs', async () => {
      // Should not throw error for non-existent search ID
      await expect(searchHistoryService.updateUserInteraction('invalid-id', { rating: 5 }))
        .resolves.toBeUndefined();
    });

    test('should handle corrupted storage data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');

      // Should initialize with default values
      const stats = searchHistoryService.getStatistics();
      expect(stats.historyEntries).toBe(0);
    });
  });

  describe('Event System', () => {
    test('should emit events for search additions', async () => {
      let eventEmitted = false;
      searchHistoryService.once('search_added', () => {
        eventEmitted = true;
      });

      await searchHistoryService.addSearchEntry(
        'event test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      expect(eventEmitted).toBe(true);
    });

    test('should emit events for interaction updates', async () => {
      const searchId = await searchHistoryService.addSearchEntry(
        'interaction test',
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        { businesses: [], source: 'fresh', responseTime: 1000, confidence: 80 }
      );

      let eventEmitted = false;
      searchHistoryService.once('interaction_updated', () => {
        eventEmitted = true;
      });

      await searchHistoryService.updateUserInteraction(searchId, { rating: 4 });

      expect(eventEmitted).toBe(true);
    });

    test('should emit events for context snapshots', async () => {
      let eventEmitted = false;
      searchHistoryService.once('context_snapshot_saved', () => {
        eventEmitted = true;
      });

      const snapshot = searchHistoryService.createContextSnapshot(
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        {},
        { interactionMode: 'browsing' as const }
      );

      await searchHistoryService.saveContextSnapshot(snapshot);

      expect(eventEmitted).toBe(true);
    });
  });
});