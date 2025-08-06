import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Keyboard,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { SearchSuggestion, SuggestionResponse } from '../../services/suggestionService';
import { LocationCoordinates } from '../../services/locationService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SearchAutocompleteProps {
  placeholder?: string;
  initialQuery?: string;
  location?: LocationCoordinates;
  onSearch: (query: string, suggestion?: SearchSuggestion) => void;
  onSuggestionPress: (suggestion: SearchSuggestion) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: any;
  containerStyle?: any;
  inputStyle?: any;
  suggestionService: any; // SuggestionService instance
  maxSuggestions?: number;
  debounceMs?: number;
  showTrending?: boolean;
  showPopular?: boolean;
  performanceMode?: 'fast' | 'comprehensive';
  theme?: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    placeholderColor: string;
    borderColor: string;
    shadowColor: string;
  };
}

interface SuggestionItemProps {
  suggestion: SearchSuggestion;
  onPress: (suggestion: SearchSuggestion) => void;
  theme: any;
  index: number;
}

// Memoized suggestion item component for performance
const SuggestionItem = React.memo(({ suggestion, onPress, theme, index }: SuggestionItemProps) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(1, { duration: 200 + (index * 50) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(animatedValue.value, [0, 1], [0, 1]);
    const translateY = interpolate(animatedValue.value, [0, 1], [20, 0]);
    
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const getSuggestionIcon = (type: string) => {
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
      default:
        return 'search-outline';
    }
  };

  const getSuggestionTypeColor = (type: string) => {
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
      default:
        return theme.textColor;
    }
  };

  return (
    <Animated.View style={[styles.suggestionItem, { borderBottomColor: theme.borderColor }, animatedStyle]}>
      <TouchableOpacity
        style={styles.suggestionButton}
        onPress={() => onPress(suggestion)}
        activeOpacity={0.7}
      >
        <View style={styles.suggestionContent}>
          <View style={styles.suggestionIcon}>
            <Ionicons
              name={getSuggestionIcon(suggestion.type) as any}
              size={18}
              color={getSuggestionTypeColor(suggestion.type)}
            />
          </View>
          
          <View style={styles.suggestionText}>
            <Text style={[styles.suggestionTitle, { color: theme.textColor }]} numberOfLines={1}>
              {suggestion.displayText}
            </Text>
            
            {suggestion.description && (
              <Text style={[styles.suggestionDescription, { color: theme.placeholderColor }]} numberOfLines={1}>
                {suggestion.description}
              </Text>
            )}
            
            {suggestion.location?.distance !== undefined && (
              <Text style={[styles.suggestionDistance, { color: theme.placeholderColor }]}>
                {suggestion.location.distance < 1
                  ? `${Math.round(suggestion.location.distance * 1000)}m away`
                  : `${suggestion.location.distance.toFixed(1)}km away`
                }
              </Text>
            )}
          </View>
          
          <View style={styles.suggestionMeta}>
            {suggestion.type === 'trending' && (
              <View style={[styles.trendingBadge, { backgroundColor: '#FF3B30' }]}>
                <Text style={styles.trendingText}>🔥</Text>
              </View>
            )}
            
            {suggestion.metadata.relevanceScore > 0.8 && (
              <View style={[styles.relevanceBadge, { backgroundColor: theme.primaryColor }]}>
                <Ionicons name="star" size={12} color="white" />
              </View>
            )}
            
            <Ionicons name="chevron-forward" size={16} color={theme.placeholderColor} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  placeholder = 'Search for businesses, categories...',
  initialQuery = '',
  location,
  onSearch,
  onSuggestionPress,
  onFocus,
  onBlur,
  style,
  containerStyle,
  inputStyle,
  suggestionService,
  maxSuggestions = 8,
  debounceMs = 150,
  showTrending = true,
  showPopular = true,
  performanceMode = 'fast',
  theme = {
    primaryColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    placeholderColor: '#8E8E93',
    borderColor: '#E5E5E7',
    shadowColor: '#000000',
  },
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  
  // Animated values for UI transitions
  const suggestionListHeight = useSharedValue(0);
  const suggestionListOpacity = useSharedValue(0);
  const inputScale = useSharedValue(1);

  // Default suggestions when input is focused but empty
  const [trendingSuggestions, setTrendingSuggestions] = useState<SearchSuggestion[]>([]);
  const [popularSuggestions, setPopularSuggestions] = useState<SearchSuggestion[]>([]);

  // Load default suggestions when component mounts
  useEffect(() => {
    if (showTrending) {
      loadTrendingSuggestions();
    }
    if (showPopular) {
      loadPopularSuggestions();
    }
  }, [location, showTrending, showPopular]);

  const loadTrendingSuggestions = async () => {
    try {
      const trending = await suggestionService.getTrendingSuggestions(location, 3);
      setTrendingSuggestions(trending);
    } catch (error) {
      console.warn('Failed to load trending suggestions:', error);
    }
  };

  const loadPopularSuggestions = async () => {
    try {
      const popular = await suggestionService.getCategorySuggestions('', location, 5);
      setPopularSuggestions(popular);
    } catch (error) {
      console.warn('Failed to load popular suggestions:', error);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (searchQuery.length >= 2) {
          await performSearch(searchQuery);
        } else if (searchQuery.length === 0) {
          // Show default suggestions when query is empty
          const defaultSuggestions = [
            ...trendingSuggestions.slice(0, 2),
            ...popularSuggestions.slice(0, 4),
          ].slice(0, maxSuggestions);
          
          setSuggestions(defaultSuggestions);
          setIsLoading(false);
        } else {
          setSuggestions([]);
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [trendingSuggestions, popularSuggestions, location, maxSuggestions, debounceMs]
  );

  const performSearch = async (searchQuery: string) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    
    const startTime = Date.now();
    
    try {
      const response: SuggestionResponse = await suggestionService.getSuggestions(
        searchQuery,
        location,
        {
          maxSuggestions,
          performanceMode,
          debounceMs: 0, // We handle debouncing here
        }
      );
      
      // Ignore stale responses
      if (requestId !== requestIdRef.current) {
        return;
      }
      
      setSuggestions(response.suggestions);
      setResponseTime(Date.now() - startTime);
      setCacheHit(response.cacheHit);
      
    } catch (error) {
      console.warn('Search suggestions error:', error);
      setSuggestions([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Handle query change
  const handleQueryChange = (text: string) => {
    setQuery(text);
    
    if (text.trim() !== query.trim()) {
      debouncedSearch(text.trim());
    }
  };

  // Handle input focus
  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
    
    inputScale.value = withSpring(1.02);
    suggestionListHeight.value = withSpring(Math.min(suggestions.length * 60 + 20, 300));
    suggestionListOpacity.value = withTiming(1, { duration: 200 });
    
    if (query.length === 0) {
      // Show default suggestions
      const defaultSuggestions = [
        ...trendingSuggestions.slice(0, 2),
        ...popularSuggestions.slice(0, 4),
      ].slice(0, maxSuggestions);
      
      setSuggestions(defaultSuggestions);
    }
    
    onFocus?.();
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay blur to allow suggestion tap
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
      
      inputScale.value = withSpring(1);
      suggestionListHeight.value = withTiming(0, { duration: 200 });
      suggestionListOpacity.value = withTiming(0, { duration: 150 });
      
      onBlur?.();
    }, 150);
  };

  // Handle suggestion press
  const handleSuggestionPress = async (suggestion: SearchSuggestion) => {
    // Track analytics
    await suggestionService.trackSuggestionClick(
      suggestion,
      query,
      location,
      {
        source: 'autocomplete',
        position: suggestions.indexOf(suggestion),
        totalSuggestions: suggestions.length,
      }
    );
    
    setQuery(suggestion.text);
    setShowSuggestions(false);
    Keyboard.dismiss();
    
    // Animate input
    inputScale.value = withSpring(1);
    suggestionListHeight.value = withTiming(0);
    suggestionListOpacity.value = withTiming(0);
    
    onSuggestionPress(suggestion);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    if (query.trim().length > 0) {
      setShowSuggestions(false);
      Keyboard.dismiss();
      onSearch(query.trim());
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // Animated styles
  const inputAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: inputScale.value }],
    };
  });

  const suggestionListAnimatedStyle = useAnimatedStyle(() => {
    return {
      height: suggestionListHeight.value,
      opacity: suggestionListOpacity.value,
    };
  });

  // Update suggestion list height when suggestions change
  useEffect(() => {
    if (showSuggestions) {
      const height = Math.min(suggestions.length * 60 + 20, 300);
      suggestionListHeight.value = withSpring(height);
    }
  }, [suggestions.length, showSuggestions]);

  const renderSuggestion = ({ item, index }: { item: SearchSuggestion; index: number }) => (
    <SuggestionItem
      suggestion={item}
      onPress={handleSuggestionPress}
      theme={theme}
      index={index}
    />
  );

  const keyExtractor = (item: SearchSuggestion) => item.id;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }, containerStyle]}>
      {/* Search Input */}
      <Animated.View style={[styles.inputContainer, inputAnimatedStyle]}>
        <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor }]}>
          <Ionicons name="search" size={20} color={theme.placeholderColor} style={styles.searchIcon} />
          
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: theme.textColor }, inputStyle]}
            placeholder={placeholder}
            placeholderTextColor={theme.placeholderColor}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          
          {/* Loading indicator or clear button */}
          <View style={styles.inputActions}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.primaryColor} />
            ) : (
              query.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={theme.placeholderColor} />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
        
        {/* Performance indicator (development only) */}
        {__DEV__ && responseTime && (
          <View style={styles.performanceIndicator}>
            <Text style={[styles.performanceText, { color: theme.placeholderColor }]}>
              {responseTime}ms {cacheHit ? '(cached)' : ''}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Suggestions List */}
      {showSuggestions && (
        <Animated.View style={[styles.suggestionsContainer, suggestionListAnimatedStyle]}>
          <BlurView intensity={Platform.OS === 'ios' ? 95 : 0} style={styles.suggestionsBlur}>
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              style={[styles.suggestionsList, { backgroundColor: theme.backgroundColor }]}
              contentContainerStyle={styles.suggestionsContent}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={8}
              windowSize={21}
            />
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
  },
  inputActions: {
    marginLeft: 12,
  },
  clearButton: {
    padding: 2,
  },
  performanceIndicator: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  performanceText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999,
    overflow: 'hidden',
  },
  suggestionsBlur: {
    flex: 1,
  },
  suggestionsList: {
    maxHeight: 300,
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
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  suggestionText: {
    flex: 1,
    marginRight: 12,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  suggestionDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  suggestionDistance: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  trendingText: {
    fontSize: 12,
  },
  relevanceBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});

export default SearchAutocomplete;