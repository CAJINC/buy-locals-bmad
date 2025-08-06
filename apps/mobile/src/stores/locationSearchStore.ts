import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { locationService, LocationCoordinates } from '../services/locationService';
import { businessService } from '../services/businessService';

export interface BusinessSearchResult {
  id: string;
  name: string;
  description?: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  categories: string[];
  hours: any;
  contact: any;
  media: any[];
  services: any[];
  distance: number; // kilometers
  bearing?: number; // degrees from north
  estimatedTravelTime?: number; // minutes
  isCurrentlyOpen?: boolean;
}

export interface LocationSearchFilters {
  radius: number; // kilometers
  categories: string[];
  search: string;
  sortBy: 'distance' | 'rating' | 'newest';
  priceRange?: [number, number];
  amenities: string[];
  isOpen: boolean;
}

export interface LocationSearchState {
  // Current location
  currentLocation: LocationCoordinates | null;
  locationPermissionGranted: boolean;
  locationLoading: boolean;
  locationError: string | null;

  // Search state
  searchResults: BusinessSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  lastSearchQuery: string | null;
  searchExecutionTime: number;
  cacheHit: boolean;

  // Filters and pagination
  filters: LocationSearchFilters;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  hasNextPage: boolean;

  // Map view state
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  selectedBusiness: BusinessSearchResult | null;

  // Recent searches and favorites
  recentSearches: string[];
  favoriteLocations: LocationCoordinates[];

  // Actions
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationCoordinates>;
  startLocationTracking: () => void;
  stopLocationTracking: () => void;
  
  searchNearbyBusinesses: (customLocation?: LocationCoordinates) => Promise<void>;
  searchWithFilters: (filters: Partial<LocationSearchFilters>) => Promise<void>;
  loadMoreResults: () => Promise<void>;
  
  updateFilters: (filters: Partial<LocationSearchFilters>) => void;
  clearSearch: () => void;
  setSelectedBusiness: (business: BusinessSearchResult | null) => void;
  
  addRecentSearch: (query: string) => void;
  addFavoriteLocation: (location: LocationCoordinates) => void;
  removeFavoriteLocation: (location: LocationCoordinates) => void;
  
  setMapRegion: (region: any) => void;
  centerMapOnCurrentLocation: () => void;
  centerMapOnBusiness: (business: BusinessSearchResult) => void;
}

const DEFAULT_FILTERS: LocationSearchFilters = {
  radius: 25,
  categories: [],
  search: '',
  sortBy: 'distance',
  amenities: [],
  isOpen: false,
};

const DEFAULT_MAP_DELTA = 0.0922;

export const useLocationSearchStore = create<LocationSearchState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLocation: null,
      locationPermissionGranted: false,
      locationLoading: false,
      locationError: null,

      searchResults: [],
      searchLoading: false,
      searchError: null,
      lastSearchQuery: null,
      searchExecutionTime: 0,
      cacheHit: false,

      filters: DEFAULT_FILTERS,
      currentPage: 1,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,

      mapRegion: null,
      selectedBusiness: null,

      recentSearches: [],
      favoriteLocations: [],

      // Location actions
      requestLocationPermission: async () => {
        set({ locationLoading: true, locationError: null });
        
        try {
          const permission = await locationService.requestLocationPermission();
          set({ 
            locationPermissionGranted: permission.granted,
            locationLoading: false,
            locationError: permission.granted ? null : 'Location permission denied',
          });
          
          return permission.granted;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Permission request failed';
          set({ 
            locationPermissionGranted: false,
            locationLoading: false,
            locationError: errorMessage,
          });
          return false;
        }
      },

      getCurrentLocation: async () => {
        set({ locationLoading: true, locationError: null });
        
        try {
          // Try cached location first
          const cachedLocation = locationService.getCachedLocation();
          if (cachedLocation) {
            set({ 
              currentLocation: cachedLocation,
              locationLoading: false,
            });
            return cachedLocation;
          }

          // Get fresh location
          const location = await locationService.getCurrentLocation();
          set({ 
            currentLocation: location,
            locationLoading: false,
            locationError: null,
          });
          
          // Auto-set map region to current location
          get().setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: DEFAULT_MAP_DELTA,
            longitudeDelta: DEFAULT_MAP_DELTA,
          });
          
          return location;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get location';
          set({ 
            locationLoading: false,
            locationError: errorMessage,
          });
          throw error;
        }
      },

      startLocationTracking: () => {
        locationService.startLocationWatch();
        
        // Subscribe to location updates
        const unsubscribe = locationService.subscribeToLocationUpdates((location) => {
          set({ currentLocation: location });
        });
        
        // Store unsubscribe function (in a real app, you'd want to call this on cleanup)
        // get().locationUnsubscribe = unsubscribe;
      },

      stopLocationTracking: () => {
        locationService.stopLocationWatch();
      },

      // Search actions
      searchNearbyBusinesses: async (customLocation?: LocationCoordinates) => {
        const state = get();
        const searchLocation = customLocation || state.currentLocation;
        
        if (!searchLocation) {
          set({ searchError: 'Location not available' });
          return;
        }

        set({ 
          searchLoading: true, 
          searchError: null,
          currentPage: 1,
        });

        try {
          const startTime = Date.now();
          
          // Build search query
          const searchQuery = {
            lat: searchLocation.latitude,
            lng: searchLocation.longitude,
            radius: state.filters.radius,
            category: state.filters.categories.length > 0 ? state.filters.categories : undefined,
            search: state.filters.search || undefined,
            page: 1,
            limit: 20,
            sortBy: state.filters.sortBy,
            isOpen: state.filters.isOpen || undefined,
          };

          const response = await businessService.searchBusinessesByLocation(searchQuery);
          const executionTime = Date.now() - startTime;

          if (response.success) {
            const { businesses, pagination, searchMetadata } = response.data;
            
            set({
              searchResults: businesses,
              searchLoading: false,
              searchError: null,
              currentPage: pagination.page,
              totalPages: pagination.totalPages,
              totalResults: pagination.totalCount,
              hasNextPage: pagination.hasNext,
              searchExecutionTime: searchMetadata.executionTimeMs,
              cacheHit: searchMetadata.cacheHit,
              lastSearchQuery: JSON.stringify(searchQuery),
            });

            // Add to recent searches if it was a text search
            if (state.filters.search) {
              get().addRecentSearch(state.filters.search);
            }
          } else {
            throw new Error(response.error || 'Search failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Search failed';
          set({ 
            searchLoading: false,
            searchError: errorMessage,
            searchResults: [],
          });
          console.error('Business search error:', error);
        }
      },

      searchWithFilters: async (newFilters: Partial<LocationSearchFilters>) => {
        const state = get();
        
        // Update filters
        const updatedFilters = { ...state.filters, ...newFilters };
        set({ filters: updatedFilters });
        
        // Perform search with new filters
        await get().searchNearbyBusinesses();
      },

      loadMoreResults: async () => {
        const state = get();
        
        if (!state.hasNextPage || state.searchLoading) {
          return;
        }

        set({ searchLoading: true });

        try {
          const searchLocation = state.currentLocation;
          if (!searchLocation) {
            throw new Error('Location not available');
          }

          const searchQuery = {
            lat: searchLocation.latitude,
            lng: searchLocation.longitude,
            radius: state.filters.radius,
            category: state.filters.categories.length > 0 ? state.filters.categories : undefined,
            search: state.filters.search || undefined,
            page: state.currentPage + 1,
            limit: 20,
            sortBy: state.filters.sortBy,
            isOpen: state.filters.isOpen || undefined,
          };

          const response = await businessService.searchBusinessesByLocation(searchQuery);

          if (response.success) {
            const { businesses, pagination } = response.data;
            
            set({
              searchResults: [...state.searchResults, ...businesses],
              searchLoading: false,
              currentPage: pagination.page,
              hasNextPage: pagination.hasNext,
            });
          } else {
            throw new Error(response.error || 'Load more failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load more results';
          set({ 
            searchLoading: false,
            searchError: errorMessage,
          });
          console.error('Load more error:', error);
        }
      },

      // Filter and UI actions
      updateFilters: (newFilters: Partial<LocationSearchFilters>) => {
        const state = get();
        set({ 
          filters: { ...state.filters, ...newFilters },
          currentPage: 1, // Reset pagination when filters change
        });
      },

      clearSearch: () => {
        set({
          searchResults: [],
          searchError: null,
          lastSearchQuery: null,
          currentPage: 1,
          totalPages: 0,
          totalResults: 0,
          hasNextPage: false,
          selectedBusiness: null,
          filters: DEFAULT_FILTERS,
        });
      },

      setSelectedBusiness: (business: BusinessSearchResult | null) => {
        set({ selectedBusiness: business });
      },

      // Recent searches and favorites
      addRecentSearch: (query: string) => {
        const state = get();
        const trimmedQuery = query.trim();
        
        if (!trimmedQuery) return;
        
        const updatedSearches = [
          trimmedQuery,
          ...state.recentSearches.filter(q => q !== trimmedQuery)
        ].slice(0, 10); // Keep only last 10 searches
        
        set({ recentSearches: updatedSearches });
      },

      addFavoriteLocation: (location: LocationCoordinates) => {
        const state = get();
        const isDuplicate = state.favoriteLocations.some(
          fav => Math.abs(fav.latitude - location.latitude) < 0.001 &&
                 Math.abs(fav.longitude - location.longitude) < 0.001
        );
        
        if (!isDuplicate) {
          set({ 
            favoriteLocations: [...state.favoriteLocations, location].slice(0, 20) // Max 20 favorites
          });
        }
      },

      removeFavoriteLocation: (location: LocationCoordinates) => {
        const state = get();
        const updatedFavorites = state.favoriteLocations.filter(
          fav => !(Math.abs(fav.latitude - location.latitude) < 0.001 &&
                   Math.abs(fav.longitude - location.longitude) < 0.001)
        );
        set({ favoriteLocations: updatedFavorites });
      },

      // Map actions
      setMapRegion: (region: any) => {
        set({ mapRegion: region });
      },

      centerMapOnCurrentLocation: () => {
        const state = get();
        if (state.currentLocation) {
          get().setMapRegion({
            latitude: state.currentLocation.latitude,
            longitude: state.currentLocation.longitude,
            latitudeDelta: DEFAULT_MAP_DELTA,
            longitudeDelta: DEFAULT_MAP_DELTA,
          });
        }
      },

      centerMapOnBusiness: (business: BusinessSearchResult) => {
        get().setMapRegion({
          latitude: business.location.coordinates.lat,
          longitude: business.location.coordinates.lng,
          latitudeDelta: 0.01, // Closer zoom for individual business
          longitudeDelta: 0.01,
        });
        set({ selectedBusiness: business });
      },
    }),
    {
      name: 'location-search-store',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Use AsyncStorage in production
          const item = localStorage?.getItem(name);
          return item ? JSON.parse(item) : null;
        },
        setItem: (name, value) => {
          localStorage?.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage?.removeItem(name);
        },
      })),
      partialize: (state) => ({
        // Only persist certain parts of the state
        filters: state.filters,
        recentSearches: state.recentSearches,
        favoriteLocations: state.favoriteLocations,
        locationPermissionGranted: state.locationPermissionGranted,
      }),
    }
  )
);