import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { SearchSuggestion, getSuggestionService } from '../../../services/suggestionService';
import { LocationCoordinates } from '../../../services/locationService';
import { searchHistoryService } from '../../../services/searchHistoryService';

export interface SearchSuggestionsProps {
  query: string;
  location?: LocationCoordinates;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  showHistory?: boolean;
  maxSuggestions?: number;
  performanceMode?: 'fast' | 'comprehensive';
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    placeholderColor: string;
    borderColor: string;
  };
  debounceMs?: number;
}

interface SuggestionItemProps {
  suggestion: SearchSuggestion;
  onPress: (suggestion: SearchSuggestion) => void;
  theme: SearchSuggestionsProps['theme'];
  index: number;
  query: string;
}

// Memoized suggestion item for performance
const SuggestionItem = React.memo<SuggestionItemProps>(
  ({ suggestion, onPress, theme, index, query }) => {
    const itemOpacity = useSharedValue(0);
    const itemTranslateY = useSharedValue(20);

    useEffect(() => {
      // Stagger animation based on index
      const delay = index * 50;
      setTimeout(() => {
        itemOpacity.value = withTiming(1, { duration: 300 });
        itemTranslateY.value = withSpring(0, { damping: 20 });
      }, delay);
    }, [index, itemOpacity, itemTranslateY]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: itemOpacity.value,
        transform: [{ translateY: itemTranslateY.value }],
      };
    });

    const getSuggestionIcon = useCallback((type: string) => {
      switch (type) {
        case 'business':
          return 'business-outline';
        case 'category':
          return 'grid-outline';
        case 'trending':
          return 'trending-up-outline';
        case 'history':
          return 'time-outline';
        case 'location':
          return 'location-outline';
        case 'query':
          return 'search-outline';
        default:
          return 'search-outline';
      }
    }, []);

    const getSuggestionIconColor = useCallback((type: string) => {
      switch (type) {
        case 'business':
          return theme.primaryColor;
        case 'category':
          return '#FF9500';
        case 'trending':
          return '#FF3B30';
        case 'history':
          return '#8E8E93';
        case 'location':
          return '#34C759';
        case 'query':
          return theme.placeholderColor;
        default:
          return theme.placeholderColor;
      }
    }, [theme]);

    const getHighlightedText = useCallback((text: string, searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        return <Text style={[styles.suggestionTitle, { color: theme.textColor }]}>{text}</Text>;
      }

      const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      
      return (
        <Text style={[styles.suggestionTitle, { color: theme.textColor }]}>
          {parts.map((part, i) => (
            <Text
              key={i}
              style={
                part.toLowerCase() === searchQuery.toLowerCase()
                  ? [styles.highlightedText, { backgroundColor: `${theme.primaryColor  }20`, color: theme.primaryColor }]
                  : undefined
              }
            >
              {part}
            </Text>
          ))}
        </Text>
      );
    }, [theme]);

    const formatDistance = useCallback((distance: number) => {
      if (distance < 1) {
        return `${Math.round(distance * 1000)}m away`;
      }
      return `${distance.toFixed(1)}km away`;
    }, []);

    return (
      <Animated.View style={[styles.suggestionItem, { borderBottomColor: theme.borderColor }, animatedStyle]}>
        <TouchableOpacity
          style={styles.suggestionButton}
          onPress={() => onPress(suggestion)}
          activeOpacity={0.7}
        >
          <View style={styles.suggestionContent}>
            {/* Icon */}
            <View style={styles.suggestionIcon}>
              <Ionicons
                name={getSuggestionIcon(suggestion.type) as any}
                size={18}
                color={getSuggestionIconColor(suggestion.type)}
              />
            </View>

            {/* Text Content */}
            <View style={styles.suggestionText}>
              {getHighlightedText(suggestion.displayText, query)}
              
              {suggestion.description && (
                <Text
                  style={[styles.suggestionDescription, { color: theme.placeholderColor }]}
                  numberOfLines={1}
                >
                  {suggestion.description}
                </Text>
              )}
              
              {suggestion.location?.distance !== undefined && (
                <Text style={[styles.suggestionDistance, { color: theme.placeholderColor }]}>
                  {formatDistance(suggestion.location.distance)}
                </Text>
              )}
              
              {suggestion.category && (
                <Text style={[styles.suggestionCategory, { color: theme.placeholderColor }]}>
                  in {suggestion.category}
                </Text>
              )}
            </View>

            {/* Meta Information */}
            <View style={styles.suggestionMeta}>
              {/* Trending indicator */}
              {suggestion.type === 'trending' && (
                <View style={[styles.trendingBadge, { backgroundColor: '#FF3B30' }]}>
                  <Text style={styles.trendingEmoji}>🔥</Text>
                </View>
              )}
              
              {/* High relevance indicator */}
              {suggestion.metadata.relevanceScore > 0.8 && (
                <View style={[styles.relevanceBadge, { backgroundColor: theme.primaryColor }]}>
                  <Ionicons name="star" size={10} color="white" />
                </View>
              )}
              
              {/* History frequency indicator */}
              {suggestion.type === 'history' && suggestion.metadata.frequency > 3 && (
                <View style={styles.frequencyIndicator}>
                  <Text style={[styles.frequencyText, { color: theme.placeholderColor }]}>
                    {suggestion.metadata.frequency}x
                  </Text>
                </View>
              )}
              
              <Ionicons name="chevron-forward" size={14} color={theme.placeholderColor} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

SuggestionItem.displayName = 'SuggestionItem';

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  location,
  onSuggestionSelect,
  showHistory = true,
  maxSuggestions = 8,
  performanceMode = 'fast',
  theme,
  debounceMs = 300,
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const containerOpacity = useSharedValue(0);

  // Memoized suggestion service
  const suggestionService = useMemo(() => {
    try {
      return getSuggestionService();
    } catch {
      return null;
    }
  }, []);

  // Load suggestions with debouncing and caching
  const loadSuggestions = useCallback(async (searchQuery: string) => {
    if (!suggestionService) {
      console.warn('Suggestion service not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let allSuggestions: SearchSuggestion[] = [];

      if (searchQuery.length >= 2) {
        // Get API suggestions
        const response = await suggestionService.getSuggestions(
          searchQuery,
          location,
          {
            maxSuggestions,
            performanceMode,
            debounceMs: 0, // Debouncing handled at component level
          }
        );
        
        allSuggestions = response.suggestions;
      } else if (searchQuery.length === 0) {
        // Get default suggestions when no query
        const [trending, categories, recommendations] = await Promise.all([
          suggestionService.getTrendingSuggestions(location, 3).catch(() => []),
          suggestionService.getCategorySuggestions('', location, 4).catch(() => []),
          showHistory ? searchHistoryService.getSearchRecommendations(
            location || { latitude: 0, longitude: 0, accuracy: 0, timestamp: 0 }
          ).catch(() => []) : Promise.resolve([])
        ]);

        // Convert recommendations to suggestions
        const historyAsSuggestions: SearchSuggestion[] = recommendations.slice(0, 2).map(rec => ({
          id: rec.id,
          type: 'history' as const,
          text: rec.type === 'query' ? rec.action.payload.query : rec.title,
          displayText: rec.title,
          description: rec.description,
          metadata: {
            frequency: 1,
            relevanceScore: rec.relevanceScore,
            lastUsed: Date.now(),
            userSpecific: true,
            globalPopularity: 0,
          },
          action: rec.action,
          analytics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
          },
        }));

        allSuggestions = [
          ...trending,
          ...categories,
          ...historyAsSuggestions,
        ].slice(0, maxSuggestions);
      }

      setSuggestions(allSuggestions);
      
      // Animate in
      containerOpacity.value = withTiming(1, { duration: 300 });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load suggestions';
      console.error('Error loading suggestions:', err);
      setError(errorMessage);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    suggestionService,
    location,
    maxSuggestions,
    performanceMode,
    showHistory,
    containerOpacity,
  ]);

  // Debounced effect for query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuggestions(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, loadSuggestions, debounceMs]);

  // Handle suggestion selection with analytics
  const handleSuggestionSelect = useCallback(
    async (suggestion: SearchSuggestion) => {
      try {
        // Track analytics
        if (suggestionService) {
          await suggestionService.trackSuggestionClick(
            suggestion,
            query,
            location,
            {
              source: 'search_suggestions',
              position: suggestions.indexOf(suggestion),
              totalSuggestions: suggestions.length,
            }
          );
        }

        // Call parent handler
        onSuggestionSelect(suggestion);
      } catch (error) {
        console.warn('Error tracking suggestion selection:', error);
        // Still call parent handler even if analytics fail
        onSuggestionSelect(suggestion);
      }
    },
    [suggestionService, query, location, suggestions, onSuggestionSelect]
  );

  // Render suggestion item
  const renderSuggestion: ListRenderItem<SearchSuggestion> = useCallback(
    ({ item, index }) => (
      <SuggestionItem
        suggestion={item}
        onPress={handleSuggestionSelect}
        theme={theme}
        index={index}
        query={query}
      />
    ),
    [handleSuggestionSelect, theme, query]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: SearchSuggestion) => item.id, []);

  // Get item layout for performance
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 60,
      offset: 60 * index,
      index,
    }),
    []
  );

  // Animated container style
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOpacity.value,
    };
  });

  // Show loading state
  if (isLoading && suggestions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.placeholderColor }]}>
            Loading suggestions...
          </Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={20} color="#FF3B30" />
          <Text style={[styles.errorText, { color: theme.placeholderColor }]}>
            {error}
          </Text>
        </View>
      </View>
    );
  }

  // Show empty state
  if (suggestions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={24} color={theme.placeholderColor} />
          <Text style={[styles.emptyText, { color: theme.placeholderColor }]}>
            {query.length > 0 ? 'No suggestions found' : 'Start typing to see suggestions'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor },
        animatedContainerStyle,
      ]}
      entering={FadeIn.duration(300)}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 95 : 0} style={styles.blurContainer}>
        <FlatList
          data={suggestions}
          renderItem={renderSuggestion}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          initialNumToRender={6}
          windowSize={10}
          style={styles.suggestionsList}
          contentContainerStyle={styles.suggestionsContent}
        />
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
  },
  suggestionsList: {
    maxHeight: 320,
  },
  suggestionsContent: {
    paddingVertical: 8,
  },
  suggestionItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
    marginRight: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  highlightedText: {
    fontWeight: '600',
    borderRadius: 2,
  },
  suggestionDescription: {
    fontSize: 13,
    lineHeight: 16,
    marginTop: 2,
  },
  suggestionDistance: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 1,
  },
  suggestionCategory: {
    fontSize: 12,
    lineHeight: 14,
    marginTop: 1,
    fontStyle: 'italic',
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendingBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingEmoji: {
    fontSize: 10,
  },
  relevanceBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyIndicator: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
  },
  frequencyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SearchSuggestions;