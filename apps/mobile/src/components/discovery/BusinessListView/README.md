# BusinessListView Component

A high-performance, feature-rich business list component for displaying location-based search results with comprehensive functionality for sorting, filtering, and navigation.

## Features

### Core Functionality
- **High-Performance Rendering**: Uses FlatList with optimization for large datasets
- **Pull-to-Refresh**: Native refresh control integration
- **Infinite Scroll**: Load more results as user scrolls
- **Smart Sorting**: Distance, rating, name, and recency sorting options
- **Rich Business Cards**: Comprehensive business information display

### Business Information Display
- **Business Images**: Logo/photo with placeholder fallbacks
- **Verification Badges**: Visual indicators for verified businesses
- **Ratings & Reviews**: Star ratings with review counts
- **Distance & Travel Time**: Real-time location-based calculations
- **Business Hours**: Current open/closed status with next opening times
- **Contact Information**: Phone, website, and address details
- **Categories**: Primary business category display

### User Experience
- **Skeleton Loading**: Professional loading states
- **Empty State Handling**: Helpful empty state with suggestions
- **Interactive Sort Bar**: Expandable sorting options
- **Smooth Navigation**: Optimized list item interactions
- **Accessibility**: Full accessibility support with test IDs

## Usage

### Basic Implementation

```typescript
import { BusinessListView } from '../components/discovery/BusinessListView';
import { useLocationSearchStore } from '../stores/locationSearchStore';

const BusinessSearchScreen = () => {
  const {
    searchResults,
    currentLocation,
    searchLoading,
    filters,
    hasNextPage,
    searchNearbyBusinesses,
    loadMoreResults,
    updateFilters,
  } = useLocationSearchStore();

  const handleBusinessPress = (business) => {
    // Navigate to business profile
    navigation.navigate('BusinessProfile', { businessId: business.id });
  };

  const handleSortChange = (sortBy) => {
    updateFilters({ sortBy });
  };

  return (
    <BusinessListView
      businesses={searchResults}
      currentLocation={currentLocation}
      loading={searchLoading}
      hasNextPage={hasNextPage}
      sortBy={filters.sortBy}
      onBusinessPress={handleBusinessPress}
      onRefresh={searchNearbyBusinesses}
      onLoadMore={loadMoreResults}
      onSortChange={handleSortChange}
      showSortOptions={true}
      showDistance={true}
      showRating={true}
    />
  );
};
```

### Advanced Configuration

```typescript
<BusinessListView
  businesses={businesses}
  currentLocation={currentLocation}
  loading={loading}
  refreshing={refreshing}
  hasNextPage={hasNextPage}
  sortBy="distance"
  onBusinessPress={handleBusinessPress}
  onRefresh={handleRefresh}
  onLoadMore={handleLoadMore}
  onSortChange={handleSortChange}
  emptyStateMessage="No restaurants found"
  emptyStateSubtitle="Try searching in a different area or adjusting your filters."
  emptyStateAction={handleRetry}
  emptyStateActionLabel="Search Again"
  showSortOptions={true}
  showDistance={true}
  showRating={true}
  testID="restaurant-list"
/>
```

## Components

### BusinessListView
Main container component that orchestrates the entire list experience.

**Props:**
- `businesses`: Array of business objects with distance information
- `currentLocation`: User's current location coordinates
- `loading`: Loading state for initial load
- `refreshing`: Loading state for pull-to-refresh
- `hasNextPage`: Whether more results are available
- `sortBy`: Current sort option ('distance', 'rating', 'name', 'newest')
- `onBusinessPress`: Callback when business item is tapped
- `onRefresh`: Callback for pull-to-refresh
- `onLoadMore`: Callback for infinite scroll
- `onSortChange`: Callback when sort option changes

### BusinessListItem
Individual business card component with rich information display.

**Features:**
- Business image with placeholder fallback
- Verification badge for verified businesses
- Name, rating, and category information
- Distance and estimated travel time
- Business hours with open/closed status
- Contact information and address
- Smooth press animations

### BusinessListSkeleton
Professional loading state with shimmer effects.

**Features:**
- Realistic content placeholders
- Configurable item count
- Smooth shimmer animations
- Matches actual content layout

### BusinessListEmptyState
Helpful empty state with actionable suggestions.

**Features:**
- Clear messaging
- Actionable retry button
- Helpful search suggestions
- Professional icon and layout

### BusinessListSortBar
Interactive sorting interface with expandable options.

**Features:**
- Current sort indicator
- Expandable sort options
- Visual active state
- Smooth animations

## Performance Optimizations

### FlatList Configuration
- `removeClippedSubviews`: Optimized for Android
- `maxToRenderPerBatch`: Controlled batch rendering
- `windowSize`: Optimized viewport management
- `initialNumToRender`: Fast initial load
- `getItemLayout`: Dynamic height support

### Memory Management
- Memoized components to prevent unnecessary re-renders
- Optimized image loading and caching
- Efficient sorting algorithms
- Smart re-render prevention

### Network Optimization
- Intelligent pagination
- Request deduplication
- Cache-first loading strategies
- Progressive image loading

## Integration Requirements

### Required Services
- `locationService`: For current location and distance calculations
- `businessService`: For business data and search functionality
- Navigation service for business profile navigation

### State Management
Works seamlessly with Zustand location search store:
- Automatic state synchronization
- Optimistic updates
- Error handling
- Cache management

### Permissions
- Location permissions for distance calculations
- Network permissions for business data
- Storage permissions for caching

## Accessibility

### Screen Reader Support
- Semantic labels for all interactive elements
- Proper heading hierarchy
- Descriptive button labels
- Content descriptions for images

### Navigation
- Full keyboard navigation support
- Focus management
- Tab order optimization
- Voice control compatibility

### Visual Accessibility
- High contrast color schemes
- Scalable text sizing
- Clear visual hierarchies
- Sufficient touch targets

## Testing

### Unit Tests
- Component rendering tests
- Interaction behavior tests
- Props validation tests
- Error state handling tests

### Integration Tests
- Navigation flow tests
- Data loading tests
- Sorting functionality tests
- Infinite scroll tests

### E2E Tests
- Complete user journey tests
- Performance tests
- Accessibility tests
- Cross-platform compatibility tests

## Customization

### Theming
The component supports custom styling through StyleSheet overrides and theme providers.

### Business Card Layout
Individual business items can be customized by modifying the `BusinessListItem` component or creating custom renderers.

### Sort Options
Sort options can be customized by modifying the `SORT_OPTIONS` array in `BusinessListSortBar.tsx`.

### Empty States
Custom empty states can be provided through props or by replacing the `BusinessListEmptyState` component.

## Browser/Platform Compatibility

- **iOS**: Full native performance with optimized scrolling
- **Android**: Optimized rendering with `removeClippedSubviews`
- **Web**: Progressive enhancement with fallback behaviors
- **Accessibility**: WCAG 2.1 AA compliance across platforms