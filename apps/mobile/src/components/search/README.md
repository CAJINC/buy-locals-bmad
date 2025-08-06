# Search Interface Components

This directory contains a comprehensive search interface implementation for the Buy Locals mobile application, providing advanced search functionality with autocomplete, voice search, search history, and intelligent suggestions.

## 📁 Architecture Overview

```
components/search/
├── SearchBar/                    # Main search input with autocomplete
│   └── SearchBar.tsx
├── SearchSuggestions/            # Autocomplete dropdown with suggestions
│   └── SearchSuggestions.tsx
├── SearchHistory/                # User search history and recommendations
│   └── SearchHistory.tsx
├── VoiceSearch/                  # Voice input integration
│   └── VoiceSearch.tsx
├── SearchLoadingState/           # Loading animations and states
│   └── SearchLoadingState.tsx
├── __tests__/                    # Comprehensive test suite
│   └── SearchBar.test.tsx
├── SearchAutocomplete.tsx        # Legacy compatibility component
├── README.md                     # This documentation
└── index.ts                      # Export definitions
```

## 🚀 Key Features

### SearchBar Component
- **Debounced Input**: 300ms debouncing for optimal performance
- **Real-time Suggestions**: Intelligent autocomplete with backend integration
- **Voice Search**: Optional voice input with error handling
- **Animated Interactions**: Smooth scaling, focus states, and transitions
- **Theme Support**: Dark/light mode with customizable colors
- **Accessibility**: Screen reader support and proper ARIA labels
- **Performance**: Optimized rendering with React.memo and useCallback

### SearchSuggestions Component
- **Multiple Suggestion Types**: Business, category, trending, history, location
- **Smart Highlighting**: Query term highlighting in suggestions
- **Distance Display**: Location-based distance calculations
- **Staggered Animations**: Progressive item animations for smooth UX
- **Caching**: Intelligent suggestion caching for performance
- **Analytics Integration**: Impression and click tracking

### SearchHistory Component
- **Persistent History**: AsyncStorage-based search history
- **Smart Recommendations**: AI-powered pattern recognition
- **Contextual Data**: Timestamps, location, results count, ratings
- **Pattern Learning**: Location, time, and query-based patterns
- **Data Management**: History cleanup, export, and privacy controls

### VoiceSearch Component
- **Multi-platform Support**: iOS and Android voice recognition
- **Error Handling**: Comprehensive error states and user feedback
- **Permissions**: Automatic permission handling with fallbacks
- **Visual Feedback**: Animated microphone states and pulse effects
- **Language Support**: Configurable language codes

### SearchLoadingState Component
- **Multiple Modes**: Full-screen and compact loading states
- **Rich Animations**: Rotating icons, pulse effects, progress bars
- **Progress Tracking**: Optional progress indication with shimmer effects
- **Responsive Design**: Adapts to different screen sizes

## 🔧 Usage Examples

### Basic Search Bar
```tsx
import { SearchBar } from '../components/search';

<SearchBar
  placeholder="Search businesses..."
  onSearch={(query) => console.log('Search:', query)}
  onSuggestionSelect={(suggestion) => handleSuggestion(suggestion)}
  showVoiceSearch={true}
  theme={customTheme}
/>
```

### Advanced Search with History
```tsx
import { SearchBar, SearchHistory } from '../components/search';

const [showHistory, setShowHistory] = useState(true);

{showHistory ? (
  <SearchHistory
    onSearchSelect={(query, location) => performSearch(query, location)}
    onRecommendationSelect={(rec) => handleRecommendation(rec)}
    currentLocation={userLocation}
    showRecommendations={true}
    theme={theme}
  />
) : (
  <SearchBar
    onSearch={handleSearch}
    onSuggestionSelect={handleSuggestion}
    location={userLocation}
    theme={theme}
  />
)}
```

### Voice Search Integration
```tsx
<SearchBar
  showVoiceSearch={true}
  onVoiceSearch={(query) => {
    console.log('Voice result:', query);
    performSearch(query);
  }}
  theme={theme}
/>
```

### Loading States
```tsx
import { SearchLoadingState } from '../components/search';

<SearchLoadingState
  message="Searching businesses..."
  submessage="Finding the best matches in your area"
  showProgress={true}
  progressValue={0.7}
  theme={theme}
/>
```

## 🎨 Theming

All components support comprehensive theming through the `theme` prop:

```tsx
const customTheme = {
  primaryColor: '#007AFF',          // Primary brand color
  backgroundColor: '#FFFFFF',       // Background color
  textColor: '#000000',            // Text color
  placeholderColor: '#8E8E93',     // Placeholder and secondary text
  borderColor: '#E5E5E7',          // Borders and dividers
  shadowColor: '#000000',          // Shadow color
};
```

### Dark Mode Support
The components automatically adapt to dark mode when using NativeBase's `useColorMode`:

```tsx
import { useColorMode } from 'native-base';

const { colorMode } = useColorMode();
const theme = {
  primaryColor: '#007AFF',
  backgroundColor: colorMode === 'dark' ? '#1A1A1A' : '#FFFFFF',
  textColor: colorMode === 'dark' ? '#FFFFFF' : '#000000',
  placeholderColor: colorMode === 'dark' ? '#666666' : '#8E8E93',
  borderColor: colorMode === 'dark' ? '#333333' : '#E5E5E7',
};
```

## ⚙️ Configuration Options

### SearchBar Props
```tsx
interface SearchBarProps {
  placeholder?: string;                    // Input placeholder text
  initialQuery?: string;                   // Initial search query
  location?: LocationCoordinates;          // User's current location
  onSearch: (query: string) => void;       // Search submission handler
  onQueryChange?: (query: string) => void; // Query change handler
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onFocus?: () => void;                    // Focus event handler
  onBlur?: () => void;                     // Blur event handler
  onVoiceSearch?: (query: string) => void; // Voice search handler
  showVoiceSearch?: boolean;               // Enable voice search
  showHistory?: boolean;                   // Show search history
  isLoading?: boolean;                     // Loading state
  disabled?: boolean;                      // Disable input
  autoFocus?: boolean;                     // Auto-focus on mount
  debounceMs?: number;                     // Debounce delay (default: 300ms)
  maxSuggestions?: number;                 // Max suggestions (default: 8)
  performanceMode?: 'fast' | 'comprehensive'; // Performance mode
  theme: SearchTheme;                      // Theme configuration
}
```

### Performance Optimization
- **debounceMs**: Controls suggestion loading delay
- **performanceMode**: 
  - `'fast'`: Basic suggestions only
  - `'comprehensive'`: Full suggestion suite including trending
- **maxSuggestions**: Limits suggestion count for performance

## 🔄 API Integration

The search components integrate with the following services:

### SuggestionService
```tsx
// Get search suggestions
const suggestions = await suggestionService.getSuggestions(query, location, options);

// Track analytics
await suggestionService.trackSuggestionClick(suggestion, query, location);
```

### SearchHistoryService
```tsx
// Add search to history
await searchHistoryService.addSearchEntry(query, location, region, results);

// Get recommendations
const recommendations = await searchHistoryService.getSearchRecommendations(location);
```

## 📱 Platform Support

### iOS
- Native voice recognition with Speech framework
- Blur effects for suggestion dropdown
- Haptic feedback for interactions
- Proper keyboard handling

### Android
- Google Speech-to-Text integration
- Material Design animations
- Proper back button handling
- Edge-to-edge display support

## 🧪 Testing

Comprehensive test suite covering:
- Component rendering and props
- User interactions and events
- Voice search functionality
- Theme application
- Performance optimizations
- Error states and edge cases

Run tests:
```bash
npm test SearchBar.test.tsx
```

## 🔒 Privacy & Security

### Data Handling
- Search history stored locally with AsyncStorage
- Configurable retention periods
- User consent for data collection
- Anonymized analytics tracking

### Voice Search
- On-device speech processing when possible
- Secure permission handling
- No persistent audio storage
- User control over voice features

## 📈 Performance Metrics

### Optimization Features
- **Sub-200ms** suggestion loading with caching
- **Debounced input** prevents excessive API calls
- **Virtualized lists** for large suggestion sets
- **Memoized components** prevent unnecessary re-renders
- **Progressive loading** for improved perceived performance

### Analytics Integration
- Suggestion impression tracking
- Click-through rate monitoring
- Search success rate measurement
- Performance timing collection

## 🔮 Future Enhancements

### Planned Features
- **Offline Search**: Cached suggestions for offline use
- **Search Filters**: Category, distance, rating filters
- **Recent Locations**: Quick access to frequently searched areas
- **Search Shortcuts**: Custom user-defined search shortcuts
- **Multi-language**: Localized suggestions and voice recognition

### Performance Improvements
- **WebAssembly**: Client-side search indexing
- **Push Notifications**: Suggested searches based on location
- **Machine Learning**: Improved recommendation algorithms
- **CDN Integration**: Faster suggestion delivery

## 🤝 Contributing

When contributing to the search interface:

1. **Follow TypeScript**: All components use strict typing
2. **Test Coverage**: Maintain >90% test coverage
3. **Performance**: Measure and optimize for mobile performance
4. **Accessibility**: Ensure screen reader compatibility
5. **Documentation**: Update README for new features

## 📄 License

This search interface implementation is part of the Buy Locals mobile application and follows the project's licensing terms.