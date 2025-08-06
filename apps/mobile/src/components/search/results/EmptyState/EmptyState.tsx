import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyStateProps } from '../types';
import { EMPTY_STATE_MESSAGES } from '../constants';

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchQuery,
  onRetry,
  onClearFilters,
  onExpandRadius,
  hasFilters = false,
  testID = 'empty-state'
}) => {
  // Determine which message to show
  const messageConfig = useMemo(() => {
    if (hasFilters) {
      return EMPTY_STATE_MESSAGES.no_results_with_filters;
    }
    return EMPTY_STATE_MESSAGES.no_results;
  }, [hasFilters]);

  // Handle retry action
  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  // Handle clear filters action
  const handleClearFilters = useCallback(() => {
    onClearFilters?.();
  }, [onClearFilters]);

  // Handle expand radius action
  const handleExpandRadius = useCallback(() => {
    onExpandRadius?.();
  }, [onExpandRadius]);

  // Render suggestion item
  const renderSuggestion = useCallback((suggestion: string, index: number) => (
    <View key={index} style={styles.suggestionItem}>
      <Ionicons 
        name="bulb-outline" 
        size={16} 
        color="#FF9500" 
        style={styles.suggestionIcon}
      />
      <Text style={styles.suggestionText}>
        {suggestion}
      </Text>
    </View>
  ), []);

  return (
    <View style={styles.container} testID={testID}>
      {/* Empty State Illustration */}
      <View style={styles.illustrationContainer}>
        <View style={styles.searchIcon}>
          <Ionicons name="search" size={48} color="#C7C7CC" />
        </View>
        <View style={styles.noResultsIcon}>
          <Ionicons name="close-circle" size={24} color="#FF3B30" />
        </View>
      </View>

      {/* Main Message */}
      <Text style={styles.title}>
        {messageConfig.title}
      </Text>
      
      <Text style={styles.subtitle}>
        {messageConfig.subtitle}
      </Text>

      {/* Search Query Display */}
      {searchQuery && (
        <View style={styles.queryContainer}>
          <Text style={styles.queryLabel}>Searched for:</Text>
          <Text style={styles.queryText}>"{searchQuery}"</Text>
        </View>
      )}

      {/* Suggestions */}
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>
          Try these suggestions:
        </Text>
        {messageConfig.suggestions.map(renderSuggestion)}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Retry Button */}
        {onRetry && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
            testID={`${testID}-retry`}
          >
            <Ionicons 
              name="refresh" 
              size={18} 
              color="white" 
              style={styles.buttonIcon}
            />
            <Text style={styles.primaryButtonText}>
              Search Again
            </Text>
          </TouchableOpacity>
        )}

        {/* Clear Filters Button */}
        {hasFilters && onClearFilters && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleClearFilters}
            activeOpacity={0.7}
            testID={`${testID}-clear-filters`}
          >
            <Ionicons 
              name="filter" 
              size={18} 
              color="#007AFF" 
              style={styles.buttonIcon}
            />
            <Text style={styles.secondaryButtonText}>
              Clear All Filters
            </Text>
          </TouchableOpacity>
        )}

        {/* Expand Radius Button */}
        {onExpandRadius && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleExpandRadius}
            activeOpacity={0.7}
            testID={`${testID}-expand-radius`}
          >
            <Ionicons 
              name="expand-outline" 
              size={18} 
              color="#007AFF" 
              style={styles.buttonIcon}
            />
            <Text style={styles.secondaryButtonText}>
              Expand Search Area
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alternative Search Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>
          Search Tips:
        </Text>
        <View style={styles.tipItem}>
          <Ionicons name="location-outline" size={16} color="#8E8E93" />
          <Text style={styles.tipText}>
            Make sure location services are enabled
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="wifi-outline" size={16} color="#8E8E93" />
          <Text style={styles.tipText}>
            Check your internet connection
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="time-outline" size={16} color="#8E8E93" />
          <Text style={styles.tipText}>
            Some businesses may have limited hours
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  illustrationContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  searchIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsIcon: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  queryContainer: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  queryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  queryText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  suggestionsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  buttonIcon: {
    marginRight: 8,
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 12,
    flex: 1,
  },
});