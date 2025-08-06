# Location Discovery Components

## Overview

This module implements Task 2 of Story 2.2: Manual Location Entry System with Google Places API autocomplete for the Buy-Locals mobile app. It provides a comprehensive location search and management system with advanced features for address autocomplete, location history, saved locations, and zip code area expansion.

## Features

- **Google Places API Integration**: Real-time address autocomplete with detailed place information
- **Location History**: Persistent storage and intelligent search of previous location searches
- **Saved Locations**: Bookmark frequently used locations with categorization (Home, Work, Favorite, Custom)
- **Current Location**: GPS-based location detection with fallback strategies
- **Zip Code Expansion**: Intelligent area expansion for broader searches around zip codes
- **Address Validation**: Comprehensive validation and normalization of addresses
- **Search Debouncing**: Performance optimization with intelligent search delays
- **Offline Support**: Cached location data for improved performance
- **Accessibility**: Full accessibility support with proper ARIA labels and keyboard navigation

## Components

### LocationInput

The main search component with Google Places autocomplete functionality.

```tsx
import { LocationInput } from '../components/discovery';

<LocationInput
  onLocationSelect={(coordinates, address, placeId) => {
    console.log('Selected:', coordinates, address);
  }}
  onError={(error) => console.error(error)}
  placeholder="Search for an address or place"
  showHistory={true}
  showSavedLocations={true}
  enableCurrentLocation={true}
  autoFocus={false}
/>
```

**Props:**
- `onLocationSelect`: Callback when location is selected
- `onError`: Error callback
- `placeholder`: Input placeholder text
- `initialValue`: Initial search value
- `showHistory`: Show search history suggestions
- `showSavedLocations`: Show saved location suggestions
- `enableCurrentLocation`: Enable current location detection
- `autoFocus`: Auto-focus input on mount
- `containerStyle`: Custom container styles

### LocationHistory

Displays and manages location search history.

```tsx
import { LocationHistory } from '../components/discovery';

<LocationHistory
  onLocationSelect={(coordinates, address, placeId) => {
    console.log('Selected from history:', coordinates, address);
  }}
  showStats={true}
  maxItems={20}
  title="Recent Searches"
/>
```

**Props:**
- `onLocationSelect`: Callback when history item is selected
- `showStats`: Display search statistics
- `maxItems`: Maximum number of items to display
- `title`: Component title
- `containerStyle`: Custom container styles

### SavedLocations

Manages bookmarked/saved locations with categorization.

```tsx
import { SavedLocations } from '../components/discovery';

<SavedLocations
  onLocationSelect={(coordinates, address, placeId) => {
    console.log('Selected saved location:', coordinates, address);
  }}
  onSaveLocation={async (name, result, category, notes) => {
    // Handle saving location
  }}
  enableAdd={true}
  filterCategory="home"
  maxItems={20}
  title="Saved Places"
/>
```

**Props:**
- `onLocationSelect`: Callback when saved location is selected
- `onSaveLocation`: Callback for saving new location
- `enableAdd`: Enable adding new saved locations
- `filterCategory`: Filter by specific category
- `maxItems`: Maximum number of items to display
- `title`: Component title
- `containerStyle`: Custom container styles

### LocationSearchScreen

Complete location search interface combining all components.

```tsx
import { LocationSearchScreen } from '../components/discovery';

<LocationSearchScreen
  onLocationSelect={(coordinates, address, placeId) => {
    console.log('Final selection:', coordinates, address);
    // Navigate to next screen or process selection
  }}
  onClose={() => navigation.goBack()}
  currentLocation={currentUserLocation}
  title="Search Location"
  showZipCodeExpansion={true}
/>
```

**Props:**
- `onLocationSelect`: Callback when location is finally selected
- `onClose`: Close callback
- `currentLocation`: User's current location for distance calculations
- `title`: Screen title
- `showZipCodeExpansion`: Enable zip code area expansion feature

## Services

### GeocodingService

Handles address geocoding and reverse geocoding using Google Maps API.

```tsx
import { geocodingService } from '../services/geocodingService';

// Geocode address to coordinates
const results = await geocodingService.geocodeAddress('1600 Amphitheatre Parkway');

// Reverse geocode coordinates to address
const addresses = await geocodingService.reverseGeocode(37.4224764, -122.0842499);

// Expand zip code to area bounds
const expansion = await geocodingService.expandZipCodeArea('94043');

// Validate address format
const validation = geocodingService.validateAddress('123 Main St');

// Normalize address format
const normalized = geocodingService.normalizeAddress('123 Main Street');
```

### LocationHistoryService

Manages location search history and saved locations with AsyncStorage persistence.

```tsx
import { locationHistoryService } from '../services/locationHistoryService';

// Add to search history
await locationHistoryService.addToHistory('Google HQ', geocodingResult);

// Search history
const results = await locationHistoryService.searchHistory('google', 10);

// Get recent searches
const recent = await locationHistoryService.getRecentSearches(5);

// Save location
const id = await locationHistoryService.saveLocation('Home', geocodingResult, 'home');

// Get saved locations
const saved = await locationHistoryService.getSavedLocations('home');

// Get statistics
const stats = await locationHistoryService.getLocationStats();

// Find nearby saved locations
const nearby = await locationHistoryService.findNearbySavedLocations(coordinates, 5);
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

### Package Dependencies

Required packages (already added to package.json):

```json
{
  "react-native-google-places-autocomplete": "^2.5.7",
  "@react-native-async-storage/async-storage": "^2.2.0",
  "react-native-geolocation-service": "^5.3.1"
}
```

## Integration Example

Complete integration with existing location service:

```tsx
import React, { useState, useEffect } from 'react';
import { LocationSearchScreen } from '../components/discovery';
import { locationService } from '../services/locationService';

const SearchScreen = ({ navigation }) => {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    // Get current location
    locationService.getCurrentLocation()
      .then(setCurrentLocation)
      .catch(console.error);
  }, []);

  const handleLocationSelect = (coordinates, address, placeId) => {
    // Process the selected location
    console.log('Selected location:', { coordinates, address, placeId });
    
    // Navigate to business search with selected location
    navigation.navigate('BusinessSearch', {
      location: coordinates,
      address,
      placeId
    });
  };

  return (
    <LocationSearchScreen
      onLocationSelect={handleLocationSelect}
      onClose={() => navigation.goBack()}
      currentLocation={currentLocation}
      showZipCodeExpansion={true}
    />
  );
};
```

## Advanced Features

### Zip Code Area Expansion

When users search for a zip code, the system can automatically expand the search area to include nearby regions:

```tsx
// Automatic expansion based on urban/rural detection
const expansion = await geocodingService.expandZipCodeArea('94043');
// Returns: { center, bounds, radius, cities, state, country }

// Urban areas: ~15km radius
// Rural areas: ~30km radius
```

### Search Intelligence

- **Relevance Scoring**: History searches are ranked by relevance, frequency, and recency
- **Duplicate Detection**: Locations within 100m are considered duplicates
- **Context Preservation**: Search context is maintained across app sessions
- **Performance Optimization**: Debounced search with 300ms delay

### Data Persistence

- **History**: Up to 100 recent searches (90-day retention)
- **Saved Locations**: Up to 50 bookmarked locations
- **Categories**: Home, Work, Favorite, Custom with icons
- **Cache Management**: Automatic cleanup of old entries

### Error Handling

- **API Failures**: Graceful fallback to cached data
- **Network Issues**: Offline mode with cached suggestions
- **Permission Denied**: Clear user feedback and alternative options
- **Invalid Addresses**: Validation with helpful suggestions

## Accessibility

- **Screen Reader Support**: Full VoiceOver/TalkBack compatibility
- **Keyboard Navigation**: Complete keyboard accessibility
- **High Contrast**: Proper color contrast ratios
- **Font Scaling**: Dynamic type support

## Performance

- **Debounced Search**: Reduces API calls
- **Intelligent Caching**: LRU cache for frequently accessed locations
- **Lazy Loading**: Components load data on demand
- **Memory Management**: Automatic cleanup of unused resources

## Testing

Comprehensive test coverage including:

- Unit tests for all services
- Integration tests for components
- Mock implementations for external APIs
- Accessibility testing
- Performance benchmarks

Run tests:
```bash
npm test src/components/discovery
npm test src/services/geocodingService
npm test src/services/locationHistoryService
```

## Troubleshooting

### Common Issues

1. **Google Places API not working**: Verify API key and enable required APIs
2. **Location permission denied**: Check device settings and app permissions
3. **Slow search**: Check network connection and API quotas
4. **History not persisting**: Verify AsyncStorage permissions

### Debug Mode

Enable debug logging:
```tsx
// Add to your app initialization
console.log('Location Services Debug Mode Enabled');
```

## Future Enhancements

- **Voice Search**: Add voice-to-text location search
- **Map Integration**: Visual location picker with map
- **Batch Operations**: Bulk import/export of saved locations
- **Social Features**: Share locations with other users
- **Machine Learning**: Predictive location suggestions
- **Offline Maps**: Cached map data for offline use

## License

Part of the Buy-Locals mobile application. See main project LICENSE file.