# MapView Component

A comprehensive map interface for displaying business locations with advanced features including clustering, user location tracking, and interactive business summaries.

## Features

- **Interactive Map**: Built on `react-native-maps` with native performance
- **Business Markers**: Custom markers with category icons and colors
- **Marker Clustering**: Automatic clustering for dense business areas (>10 businesses)
- **User Location**: Real-time user location tracking and centering
- **Business Summaries**: Detailed business information modal on marker tap
- **Map Controls**: Layer toggles, location centering, and map type switching
- **Search Integration**: Region change detection triggers business searches
- **Loading States**: Comprehensive loading and error handling
- **Accessibility**: Full accessibility support with proper labels and hints

## Usage

```tsx
import { MapView } from '../MapView';
import { Business } from '../MapView/types';

const businesses: Business[] = [
  {
    id: '1',
    name: 'Coffee Shop',
    category: 'cafe',
    coordinates: { latitude: 37.78825, longitude: -122.4324, accuracy: 10, timestamp: Date.now() },
    address: '123 Main St, San Francisco, CA',
    rating: 4.5,
    reviewCount: 123,
    verified: true,
  },
];

function MapScreen() {
  const handleRegionChange = (region) => {
    // Trigger business search for new region
    console.log('Region changed:', region);
  };

  const handleBusinessSelect = (business) => {
    console.log('Business selected:', business);
  };

  return (
    <MapView
      businesses={businesses}
      onRegionChange={handleRegionChange}
      onBusinessSelect={handleBusinessSelect}
      showUserLocation={true}
      enableClustering={true}
    />
  );
}
```

## Props

### MapViewProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `businesses` | `Business[]` | `[]` | Array of businesses to display |
| `initialRegion` | `MapRegion` | SF Bay Area | Initial map region |
| `onRegionChange` | `(region: MapRegion) => void` | - | Called when map region changes |
| `onBusinessSelect` | `(business: Business) => void` | - | Called when business marker is tapped |
| `showUserLocation` | `boolean` | `true` | Show user location indicator |
| `enableClustering` | `boolean` | `true` | Enable marker clustering |
| `clusteringRadius` | `number` | `50` | Clustering radius in pixels |
| `searchRadius` | `number` | `10` | Initial search radius in km |
| `loading` | `boolean` | `false` | Show loading state |
| `error` | `string \| null` | `null` | Error message to display |
| `onRetry` | `() => void` | - | Retry callback for errors |
| `customMapStyle` | `object[]` | - | Custom map styling |
| `showTrafficLayer` | `boolean` | `false` | Show traffic information |
| `followUserLocation` | `boolean` | `false` | Automatically follow user location |
| `minZoomLevel` | `number` | `3` | Minimum zoom level |
| `maxZoomLevel` | `number` | `20` | Maximum zoom level |
| `onLocationPress` | `() => void` | - | Custom location button handler |
| `onMapReady` | `() => void` | - | Called when map is ready |
| `testID` | `string` | - | Test identifier |

## Business Data Structure

```tsx
interface Business {
  id: string;
  name: string;
  category: string; // Used for marker icon/color
  coordinates: LocationCoordinates;
  address: string;
  rating?: number; // 1-5 star rating
  reviewCount?: number;
  priceLevel?: number; // 1-4 price level ($-$$$$)
  isOpen?: boolean;
  distance?: number; // km from user location
  phone?: string;
  website?: string;
  image?: string;
  verified?: boolean;
  businessHours?: BusinessHours;
}
```

## Supported Business Categories

The component includes built-in icons and colors for these categories:

- `restaurant` 🍽️ (Red)
- `cafe` ☕ (Brown)
- `bar` 🍺 (Yellow)
- `shop` 🛍️ (Orange)
- `grocery` 🛒 (Green)
- `gas_station` ⛽ (Teal)
- `hospital` 🏥 (Pink)
- `pharmacy` 💊 (Pink)
- `bank` 🏦 (Blue)
- `hotel` 🏨 (Purple)
- `gym` 💪 (Orange)
- `beauty` 💅 (Light Pink)
- `automotive` 🔧 (Gray)
- `education` 🎓 (Blue)
- `entertainment` 🎬 (Red)
- `professional` 💼 (Green)
- `home_services` 🏠 (Orange)
- `pet_services` 🐕 (Purple)
- `other` 📍 (Gray)

## Components

### BusinessMarker
- Custom business location marker
- Category-based styling
- Verified business badge
- Tap interaction with callout

### ClusterMarker
- Groups nearby businesses
- Dynamic sizing based on business count
- Color coding by density
- Tap to zoom into cluster

### BusinessSummary
- Modal with detailed business information
- Action buttons (directions, call, website)
- Business hours and contact info
- Responsive design

### MapControls
- Map type toggle (Standard/Satellite/Hybrid)
- User location centering button
- Traffic layer toggle
- Floating controls design

## Integration with Location Services

The MapView automatically integrates with the existing `locationService`:

```tsx
// Automatic user location tracking
useEffect(() => {
  const unsubscribe = locationService.subscribeToLocationUpdates((location) => {
    setUserLocation(location);
  });
  return unsubscribe;
}, []);

// Permission handling
const location = await locationService.getCurrentLocation();
```

## Performance Optimizations

- **Marker Clustering**: Reduces render load for dense areas
- **Region Change Debouncing**: Prevents excessive search triggers
- **Memoized Calculations**: Optimized clustering and marker processing
- **Lazy Loading**: Components load only when needed
- **Native Optimizations**: Uses `tracksViewChanges={false}` for markers

## Error Handling

Comprehensive error states for:
- Location permission denied
- Network connectivity issues
- GPS signal problems
- Map loading failures

Each error provides specific user guidance and recovery options.

## Accessibility

- Screen reader support
- Semantic labels for all interactive elements
- High contrast mode support
- Voice control compatibility
- Proper focus management

## Testing

```tsx
// Example test usage
<MapView
  testID="business-map"
  businesses={mockBusinesses}
  onRegionChange={mockRegionChange}
  onBusinessSelect={mockBusinessSelect}
/>
```

## Dependencies

- `react-native-maps`: Native map implementation
- `react-native-geolocation-service`: Location services
- `react-native-permissions`: Permission handling

## Platform Differences

### iOS
- Apple Maps integration
- Native location services
- CoreLocation permissions

### Android
- Google Maps integration
- Android location services
- Granular permission controls

## Troubleshooting

### Common Issues

1. **Map not loading**: Check API keys and bundle identifiers
2. **Location not working**: Verify permissions in app settings
3. **Markers not showing**: Ensure business data includes valid coordinates
4. **Clustering not working**: Check `enableClustering` prop and business count
5. **Search not triggering**: Verify `onRegionChange` handler

### Debug Mode

Enable debug logging:

```tsx
// Add to your app's debug configuration
console.log('MapView Debug:', {
  businessCount: businesses.length,
  currentRegion,
  userLocation,
  clustersCount: clusters.length
});
```