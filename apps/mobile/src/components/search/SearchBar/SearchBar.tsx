import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Box, Input, IconButton, useColorMode } from 'native-base';

import { SearchSuggestion } from '../../../services/suggestionService';
import { LocationCoordinates } from '../../../services/locationService';
import { SearchSuggestions } from '../SearchSuggestions/SearchSuggestions';
import { VoiceSearch } from '../VoiceSearch/VoiceSearch';

export interface SearchBarProps {
  placeholder?: string;
  initialQuery?: string;
  location?: LocationCoordinates;
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onVoiceSearch?: (query: string) => void;
  showVoiceSearch?: boolean;
  showHistory?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  style?: any;
  inputStyle?: any;
  theme?: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    placeholderColor: string;
    borderColor: string;
    shadowColor: string;
  };
  debounceMs?: number;
  maxSuggestions?: number;
  performanceMode?: 'fast' | 'comprehensive';
}

interface AnimatedSearchBarState {
  isFocused: boolean;
  showSuggestions: boolean;
  hasText: boolean;
  isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search businesses, categories...',
  initialQuery = '',
  location,
  onSearch,
  onQueryChange,
  onSuggestionSelect,
  onFocus,
  onBlur,
  onVoiceSearch,
  showVoiceSearch = true,
  showHistory = true,
  isLoading = false,
  disabled = false,
  autoFocus = false,
  style,
  inputStyle,
  theme = {
    primaryColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    placeholderColor: '#8E8E93',
    borderColor: '#E5E5E7',
    shadowColor: '#000000',
  },
  debounceMs = 300,
  maxSuggestions = 8,
  performanceMode = 'fast',
}) => {
  // State
  const [query, setQuery] = useState(initialQuery);
  const [searchBarState, setSearchBarState] = useState<AnimatedSearchBarState>({
    isFocused: false,
    showSuggestions: false,
    hasText: query.length > 0,
    isLoading: false,
  });

  // Refs
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Color mode
  const { colorMode } = useColorMode();

  // Animated values
  const inputScale = useSharedValue(1);
  const inputBorderWidth = useSharedValue(1);
  const suggestionOpacity = useSharedValue(0);
  const suggestionHeight = useSharedValue(0);
  const clearButtonOpacity = useSharedValue(query.length > 0 ? 1 : 0);
  const voiceButtonOpacity = useSharedValue(showVoiceSearch ? 1 : 0);

  // Dynamic theme based on color mode
  const dynamicTheme = {
    ...theme,
    backgroundColor: colorMode === 'dark' ? '#1A1A1A' : theme.backgroundColor,
    textColor: colorMode === 'dark' ? '#FFFFFF' : theme.textColor,
    placeholderColor: colorMode === 'dark' ? '#666666' : theme.placeholderColor,
    borderColor: colorMode === 'dark' ? '#333333' : theme.borderColor,
  };

  // Update query change handler with debouncing
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      
      // Update state
      setSearchBarState(prev => ({
        ...prev,
        hasText: text.length > 0,
        isLoading: text.length >= 2,
      }));

      // Update animated values
      clearButtonOpacity.value = withTiming(text.length > 0 ? 1 : 0, { duration: 200 });
      voiceButtonOpacity.value = withTiming(
        showVoiceSearch && text.length === 0 ? 1 : 0,
        { duration: 200 }
      );

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the query change callback
      if (onQueryChange && text.length >= 1) {
        debounceTimerRef.current = setTimeout(() => {
          onQueryChange(text);
          setSearchBarState(prev => ({ ...prev, isLoading: false }));
        }, debounceMs);
      } else {
        setSearchBarState(prev => ({ ...prev, isLoading: false }));
      }
    },
    [onQueryChange, debounceMs, clearButtonOpacity, voiceButtonOpacity, showVoiceSearch]
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    setSearchBarState(prev => ({
      ...prev,
      isFocused: true,
      showSuggestions: true,
    }));

    // Animate input
    inputScale.value = withSpring(1.02, { damping: 20 });
    inputBorderWidth.value = withTiming(2, { duration: 200 });
    
    // Show suggestions with animation
    suggestionOpacity.value = withTiming(1, { duration: 300 });
    suggestionHeight.value = withSpring(Math.min(maxSuggestions * 60 + 20, 320));

    onFocus?.();
  }, [onFocus, inputScale, inputBorderWidth, suggestionOpacity, suggestionHeight, maxSuggestions]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Delay blur to allow suggestion tap
    suggestionTimeoutRef.current = setTimeout(() => {
      setSearchBarState(prev => ({
        ...prev,
        isFocused: false,
        showSuggestions: false,
      }));

      // Animate input
      inputScale.value = withSpring(1, { damping: 20 });
      inputBorderWidth.value = withTiming(1, { duration: 200 });
      
      // Hide suggestions
      suggestionOpacity.value = withTiming(0, { duration: 200 });
      suggestionHeight.value = withTiming(0, { duration: 250 });

      onBlur?.();
    }, 150);
  }, [onBlur, inputScale, inputBorderWidth, suggestionOpacity, suggestionHeight]);

  // Handle search submit
  const handleSearchSubmit = useCallback(() => {
    if (query.trim().length > 0) {
      // Hide suggestions immediately
      setSearchBarState(prev => ({ ...prev, showSuggestions: false }));
      suggestionOpacity.value = withTiming(0, { duration: 150 });
      suggestionHeight.value = withTiming(0, { duration: 200 });
      
      Keyboard.dismiss();
      onSearch(query.trim());
    }
  }, [query, onSearch, suggestionOpacity, suggestionHeight]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      setQuery(suggestion.text);
      setSearchBarState(prev => ({ ...prev, showSuggestions: false, hasText: true }));
      
      // Hide suggestions
      suggestionOpacity.value = withTiming(0, { duration: 150 });
      suggestionHeight.value = withTiming(0, { duration: 200 });
      
      clearButtonOpacity.value = withTiming(1, { duration: 200 });
      
      Keyboard.dismiss();
      onSuggestionSelect(suggestion);
    },
    [onSuggestionSelect, suggestionOpacity, suggestionHeight, clearButtonOpacity]
  );

  // Handle voice search result
  const handleVoiceSearchResult = useCallback(
    (voiceQuery: string) => {
      if (voiceQuery) {
        setQuery(voiceQuery);
        setSearchBarState(prev => ({ ...prev, hasText: true }));
        clearButtonOpacity.value = withTiming(1, { duration: 200 });
        
        onVoiceSearch?.(voiceQuery);
        
        // Auto-search if query is valid
        if (voiceQuery.trim().length > 0) {
          setTimeout(() => onSearch(voiceQuery.trim()), 500);
        }
      }
    },
    [onVoiceSearch, onSearch, clearButtonOpacity]
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchBarState(prev => ({ ...prev, hasText: false, showSuggestions: true }));
    
    clearButtonOpacity.value = withTiming(0, { duration: 200 });
    voiceButtonOpacity.value = withTiming(showVoiceSearch ? 1 : 0, { duration: 200 });
    
    inputRef.current?.focus();
    onQueryChange?.('');
  }, [onQueryChange, clearButtonOpacity, voiceButtonOpacity, showVoiceSearch]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  // Animated styles
  const inputContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: inputScale.value }],
      borderWidth: inputBorderWidth.value,
    };
  });

  const clearButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: clearButtonOpacity.value,
      transform: [
        {
          scale: interpolate(clearButtonOpacity.value, [0, 1], [0.5, 1]),
        },
      ],
    };
  });

  const voiceButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: voiceButtonOpacity.value,
      transform: [
        {
          scale: interpolate(voiceButtonOpacity.value, [0, 1], [0.5, 1]),
        },
      ],
    };
  });

  const suggestionContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: suggestionOpacity.value,
      height: suggestionHeight.value,
    };
  });

  return (
    <View style={[styles.container, style]}>
      {/* Main Search Input */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: dynamicTheme.backgroundColor,
            borderColor: searchBarState.isFocused ? dynamicTheme.primaryColor : dynamicTheme.borderColor,
            shadowColor: dynamicTheme.shadowColor,
          },
          inputContainerAnimatedStyle,
        ]}
      >
        <Ionicons
          name="search"
          size={20}
          color={dynamicTheme.placeholderColor}
          style={styles.searchIcon}
        />

        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            { color: dynamicTheme.textColor },
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={dynamicTheme.placeholderColor}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          editable={!disabled}
          blurOnSubmit={false}
        />

        {/* Loading Indicator */}
        {(isLoading || searchBarState.isLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={dynamicTheme.primaryColor} />
          </View>
        )}

        {/* Clear Button */}
        <Animated.View style={[styles.actionButton, clearButtonAnimatedStyle]}>
          <Pressable onPress={handleClearSearch} style={styles.buttonTouchable}>
            <Ionicons name="close-circle" size={20} color={dynamicTheme.placeholderColor} />
          </Pressable>
        </Animated.View>

        {/* Voice Search Button */}
        {showVoiceSearch && (
          <Animated.View style={[styles.actionButton, voiceButtonAnimatedStyle]}>
            <VoiceSearch
              onResult={handleVoiceSearchResult}
              onError={(error) => console.warn('Voice search error:', error)}
              theme={dynamicTheme}
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* Suggestions Dropdown */}
      {searchBarState.showSuggestions && (
        <Animated.View style={[styles.suggestionsContainer, suggestionContainerAnimatedStyle]}>
          <SearchSuggestions
            query={query}
            location={location}
            onSuggestionSelect={handleSuggestionSelect}
            showHistory={showHistory}
            maxSuggestions={maxSuggestions}
            performanceMode={performanceMode}
            theme={dynamicTheme}
            debounceMs={debounceMs}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    height: '100%',
  },
  loadingContainer: {
    marginLeft: 8,
  },
  actionButton: {
    marginLeft: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTouchable: {
    padding: 2,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
});

export default SearchBar;