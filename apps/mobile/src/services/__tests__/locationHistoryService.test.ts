import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationHistoryService } from '../locationHistoryService';
import { GeocodingResult } from '../geocodingService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('LocationHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (locationHistoryService as any).historyCache = [];
    (locationHistoryService as any).savedLocationsCache = [];
    (locationHistoryService as any).initialized = false;
  });

  const mockGeocodingResult: GeocodingResult = {
    formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
    coordinates: {
      latitude: 37.4224764,
      longitude: -122.0842499,
      accuracy: 10,
      timestamp: Date.now()
    },
    placeId: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
    components: {
      locality: 'Mountain View',
      administrativeAreaLevel1: 'CA',
      postalCode: '94043'
    },
    types: ['street_address']
  };

  const mockGeocodingResult2: GeocodingResult = {
    formattedAddress: '1 Infinite Loop, Cupertino, CA 95014, USA',
    coordinates: {
      latitude: 37.331706,
      longitude: -122.030783,
      accuracy: 10,
      timestamp: Date.now()
    },
    placeId: 'ChIJLxHlBrW7j4ARMlBjXhf1sdo',
    components: {
      locality: 'Cupertino',
      administrativeAreaLevel1: 'CA',
      postalCode: '95014'
    },
    types: ['street_address']
  };

  describe('addToHistory', () => {
    it('should add new location to history', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // history
        .mockResolvedValueOnce(null); // saved locations

      await locationHistoryService.addToHistory('Google HQ', mockGeocodingResult);

      const history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('Google HQ');
      expect(history[0].address).toBe('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
      expect(history[0].searchCount).toBe(1);
    });

    it('should increment search count for existing location', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Add same location twice
      await locationHistoryService.addToHistory('Google HQ', mockGeocodingResult);
      await locationHistoryService.addToHistory('Google Headquarters', mockGeocodingResult);

      const history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].searchCount).toBe(2);
      expect(history[0].query).toBe('Google Headquarters'); // Should use most recent query
    });

    it('should limit history size', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Add more than MAX_HISTORY_ENTRIES
      for (let i = 0; i < 105; i++) {
        const result = {
          ...mockGeocodingResult,
          coordinates: {
            ...mockGeocodingResult.coordinates,
            latitude: 37 + i * 0.01, // Make each location significantly different
            longitude: -122 + i * 0.01
          },
          placeId: `place_${i}`
        };
        await locationHistoryService.addToHistory(`Location ${i}`, result);
      }

      const history = await locationHistoryService.getLocationHistory(200);
      expect(history.length).toBeLessThanOrEqual(100); // MAX_HISTORY_ENTRIES
    });
  });

  describe('searchHistory', () => {
    beforeEach(async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Add test data with sufficiently different coordinates to avoid merging
      await locationHistoryService.addToHistory('Google HQ', mockGeocodingResult);
      await locationHistoryService.addToHistory('Apple Park', mockGeocodingResult2);
    });

    it('should search history by query', async () => {
      const results = await locationHistoryService.searchHistory('Google');

      expect(results).toHaveLength(1);
      expect(results[0].query).toBe('Google HQ');
    });

    it('should search history by address', async () => {
      const results = await locationHistoryService.searchHistory('Cupertino');

      expect(results).toHaveLength(1);
      expect(results[0].query).toBe('Apple Park');
    });

    it('should return all results for empty query', async () => {
      const results = await locationHistoryService.searchHistory('');

      expect(results).toHaveLength(2);
    });

    it('should limit search results', async () => {
      const results = await locationHistoryService.searchHistory('', 1);

      expect(results).toHaveLength(1);
    });
  });

  describe('saveLocation', () => {
    it('should save new location', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const id = await locationHistoryService.saveLocation(
        'My Home',
        mockGeocodingResult,
        'home',
        'This is my home address'
      );

      expect(id).toBeTruthy();

      const savedLocations = await locationHistoryService.getSavedLocations();
      expect(savedLocations).toHaveLength(1);
      expect(savedLocations[0].name).toBe('My Home');
      expect(savedLocations[0].category).toBe('home');
      expect(savedLocations[0].notes).toBe('This is my home address');
    });

    it('should update existing saved location', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Save location twice at same coordinates
      const id1 = await locationHistoryService.saveLocation('Home', mockGeocodingResult, 'home');
      const id2 = await locationHistoryService.saveLocation('My House', mockGeocodingResult, 'custom');

      expect(id1).toBe(id2);

      const savedLocations = await locationHistoryService.getSavedLocations();
      expect(savedLocations).toHaveLength(1);
      expect(savedLocations[0].name).toBe('My House');
      expect(savedLocations[0].category).toBe('custom');
    });

    it('should filter saved locations by category', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await locationHistoryService.saveLocation('Home', mockGeocodingResult, 'home');
      await locationHistoryService.saveLocation('Office', mockGeocodingResult2, 'work');

      const homeLocations = await locationHistoryService.getSavedLocations('home');
      const workLocations = await locationHistoryService.getSavedLocations('work');

      expect(homeLocations).toHaveLength(1);
      expect(homeLocations[0].name).toBe('Home');
      expect(workLocations).toHaveLength(1);
      expect(workLocations[0].name).toBe('Office');
    });
  });

  describe('getLocationStats', () => {
    it('should return accurate statistics', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Add test data with different locations
      await locationHistoryService.addToHistory('Location 1', mockGeocodingResult);
      await locationHistoryService.addToHistory('Location 1', mockGeocodingResult); // Same location again
      await locationHistoryService.addToHistory('Location 2', mockGeocodingResult2);

      const stats = await locationHistoryService.getLocationStats();

      expect(stats.totalSearches).toBe(3);
      expect(stats.uniqueLocations).toBe(2);
      expect(stats.mostSearchedLocation).toBe('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
      expect(stats.averageSearchesPerDay).toBeGreaterThan(0);
    });

    it('should handle empty history', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const stats = await locationHistoryService.getLocationStats();

      expect(stats.totalSearches).toBe(0);
      expect(stats.uniqueLocations).toBe(0);
      expect(stats.mostSearchedLocation).toBe('None');
    });
  });

  describe('findNearbySavedLocations', () => {
    it('should find nearby saved locations', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await locationHistoryService.saveLocation('Nearby', mockGeocodingResult, 'custom');
      
      const farLocation = {
        ...mockGeocodingResult2,
        coordinates: {
          ...mockGeocodingResult2.coordinates,
          latitude: 40.7128, // New York - very far
          longitude: -74.0060
        },
        placeId: 'far_location_id'
      };
      await locationHistoryService.saveLocation('Far Away', farLocation, 'custom');

      const searchCoordinates = {
        latitude: 37.4225, // Very close to mockGeocodingResult
        longitude: -122.0843,
        accuracy: 10,
        timestamp: Date.now()
      };

      const nearbyLocations = await locationHistoryService.findNearbySavedLocations(searchCoordinates, 1);

      expect(nearbyLocations).toHaveLength(1);
      expect(nearbyLocations[0].name).toBe('Nearby');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await locationHistoryService.addToHistory('Test', mockGeocodingResult);
      
      let history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(1);

      await locationHistoryService.clearHistory();

      history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('removeHistoryEntry', () => {
    it('should remove specific history entry', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await locationHistoryService.addToHistory('Location 1', mockGeocodingResult);
      await locationHistoryService.addToHistory('Location 2', mockGeocodingResult2);

      let history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(2);

      await locationHistoryService.removeHistoryEntry(history[0].id);

      history = await locationHistoryService.getLocationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('Location 1');
    });
  });

  describe('removeSavedLocation', () => {
    it('should remove specific saved location', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await locationHistoryService.saveLocation('Location 1', mockGeocodingResult, 'home');
      await locationHistoryService.saveLocation('Location 2', mockGeocodingResult2, 'work');

      let saved = await locationHistoryService.getSavedLocations();
      expect(saved).toHaveLength(2);

      await locationHistoryService.removeSavedLocation(saved[0].id);

      saved = await locationHistoryService.getSavedLocations();
      expect(saved).toHaveLength(1);
    });
  });
});