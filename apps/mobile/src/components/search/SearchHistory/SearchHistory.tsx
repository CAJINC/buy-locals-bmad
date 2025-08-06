import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeInUp,
  FadeOutUp,
} from 'react-native-reanimated';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

import {
  SearchHistoryEntry,
  SearchRecommendation,
  searchHistoryService,
} from '../../../services/searchHistoryService';
import { LocationCoordinates } from '../../../services/locationService';

export interface SearchHistoryProps {
  onSearchSelect: (query: string, location?: LocationCoordinates) => void;
  onRecommendationSelect: (recommendation: SearchRecommendation) => void;
  currentLocation?: LocationCoordinates;
  maxEntries?: number;
  showRecommendations?: boolean;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    placeholderColor: string;
    borderColor: string;
  };
  style?: any;
}

interface HistoryItemProps {
  entry: SearchHistoryEntry;
  onSelect: (query: string, location?: LocationCoordinates) => void;
  onDelete: (entryId: string) => void;
  theme: SearchHistoryProps['theme'];
  index: number;
}

interface RecommendationItemProps {
  recommendation: SearchRecommendation;
  onSelect: (recommendation: SearchRecommendation) => void;
  theme: SearchHistoryProps['theme'];
  index: number;
}

// Memoized history item component
const HistoryItem = React.memo<HistoryItemProps>(
  ({ entry, onSelect, onDelete, theme, index }) => {
    const itemOpacity = useSharedValue(0);
    const itemScale = useSharedValue(0.95);

    useEffect(() => {
      const delay = index * 100;
      setTimeout(() => {
        itemOpacity.value = withTiming(1, { duration: 300 });
        itemScale.value = withSpring(1, { damping: 20 });
      }, delay);
    }, [index, itemOpacity, itemScale]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: itemOpacity.value,
        transform: [{ scale: itemScale.value }],
      };
    });

    const formatTimestamp = useCallback((timestamp: number) => {
      const date = new Date(timestamp);
      
      if (isToday(date)) {
        return `Today at ${format(date, 'h:mm a')}`;
      }
      if (isYesterday(date)) {
        return `Yesterday at ${format(date, 'h:mm a')}`;
      }
      
      const daysDiff = differenceInDays(new Date(), date);
      if (daysDiff < 7) {
        return format(date, 'EEEE \'at\' h:mm a');
      }
      
      return format(date, 'MMM d \'at\' h:mm a');
    }, []);

    const formatResultCount = useCallback((count: number) => {
      if (count === 0) return 'No results';
      if (count === 1) return '1 result';
      return `${count} results`;
    }, []);

    const getSearchIcon = useCallback(() => {
      if (entry.query) {
        return 'search-outline';
      }
      return 'location-outline';
    }, [entry.query]);

    const getSearchTitle = useCallback(() => {
      if (entry.query) {
        return entry.query;
      }
      return 'Location search';
    }, [entry.query]);

    const handlePress = useCallback(() => {
      onSelect(entry.query || '', entry.location);
    }, [entry.query, entry.location, onSelect]);

    const handleDelete = useCallback(() => {
      Alert.alert(
        'Delete Search',
        'Are you sure you want to remove this search from your history?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: () => onDelete(entry.id)
          },
        ]
      );
    }, [entry.id, onDelete]);

    return (
      <Animated.View
        style={[
          styles.historyItem,
          { borderBottomColor: theme.borderColor },
          animatedStyle,
        ]}
        entering={FadeInUp.delay(index * 100)}
      >
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.historyContent}>
            {/* Icon */}
            <View style={styles.historyIcon}>
              <Ionicons
                name={getSearchIcon() as any}
                size={18}
                color={theme.primaryColor}
              />
            </View>

            {/* Content */}
            <View style={styles.historyText}>
              <Text
                style={[styles.historyTitle, { color: theme.textColor }]}
                numberOfLines={1}
              >
                {getSearchTitle()}
              </Text>
              
              <View style={styles.historyMeta}>
                <Text style={[styles.historyTime, { color: theme.placeholderColor }]}>
                  {formatTimestamp(entry.timestamp)}
                </Text>
                
                <Text style={[styles.historyDot, { color: theme.placeholderColor }]}>
                  •
                </Text>
                
                <Text style={[styles.historyResults, { color: theme.placeholderColor }]}>
                  {formatResultCount(entry.results.count)}
                </Text>
                
                {entry.userInteraction.rating && entry.userInteraction.rating > 0 && (
                  <>
                    <Text style={[styles.historyDot, { color: theme.placeholderColor }]}>
                      •
                    </Text>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={[styles.ratingText, { color: theme.placeholderColor }]}>
                        {entry.userInteraction.rating.toFixed(1)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
              
              {entry.location && (
                <Text
                  style={[styles.historyLocation, { color: theme.placeholderColor }]}
                  numberOfLines={1}
                >
                  Near {entry.location.latitude.toFixed(4)}, {entry.location.longitude.toFixed(4)}
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={styles.historyActions}>
              {entry.sessionInfo.isRepeatSearch && (
                <View style={[styles.repeatBadge, { backgroundColor: theme.primaryColor + '20' }]}>
                  <Text style={[styles.repeatText, { color: theme.primaryColor }]}>
                    Repeat
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color={theme.placeholderColor} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

// Memoized recommendation item component
const RecommendationItem = React.memo<RecommendationItemProps>(
  ({ recommendation, onSelect, theme, index }) => {
    const itemOpacity = useSharedValue(0);
    const itemScale = useSharedValue(0.95);

    useEffect(() => {
      const delay = index * 100;
      setTimeout(() => {
        itemOpacity.value = withTiming(1, { duration: 300 });
        itemScale.value = withSpring(1, { damping: 20 });
      }, delay);
    }, [index, itemOpacity, itemScale]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: itemOpacity.value,
        transform: [{ scale: itemScale.value }],
      };
    });

    const getRecommendationIcon = useCallback(() => {
      switch (recommendation.type) {
        case 'location':
          return 'location-outline';
        case 'query':
          return 'search-outline';
        case 'category':
          return 'grid-outline';
        case 'refinement':
          return 'funnel-outline';
        default:
          return 'bulb-outline';
      }
    }, [recommendation.type]);

    const getConfidenceColor = useCallback(() => {
      if (recommendation.confidence > 0.8) return '#34C759';
      if (recommendation.confidence > 0.6) return '#FF9500';
      return theme.placeholderColor;
    }, [recommendation.confidence, theme.placeholderColor]);

    const handlePress = useCallback(() => {
      onSelect(recommendation);
    }, [recommendation, onSelect]);

    return (
      <Animated.View
        style={[
          styles.recommendationItem,
          { borderBottomColor: theme.borderColor },
          animatedStyle,
        ]}
        entering={FadeInUp.delay(index * 100)}
      >
        <TouchableOpacity
          style={styles.recommendationButton}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.recommendationContent}>
            {/* Icon */}
            <View style={styles.recommendationIcon}>
              <Ionicons
                name={getRecommendationIcon() as any}
                size={18}
                color={theme.primaryColor}
              />
            </View>

            {/* Content */}
            <View style={styles.recommendationText}>
              <Text
                style={[styles.recommendationTitle, { color: theme.textColor }]}
                numberOfLines={1}
              >
                {recommendation.title}
              </Text>
              
              <Text
                style={[styles.recommendationDescription, { color: theme.placeholderColor }]}
                numberOfLines={2}
              >
                {recommendation.description}
              </Text>
              
              {/* Badges */}
              <View style={styles.recommendationBadges}>
                <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor() + '20' }]}>
                  <Text style={[styles.confidenceText, { color: getConfidenceColor() }]}>
                    {Math.round(recommendation.confidence * 100)}% match
                  </Text>
                </View>
                
                {recommendation.basedOn.patterns.length > 0 && (
                  <View style={[styles.patternBadge, { backgroundColor: theme.primaryColor + '20' }]}>
                    <Text style={[styles.patternText, { color: theme.primaryColor }]}>
                      Pattern-based
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Arrow */}
            <Ionicons name="chevron-forward" size={16} color={theme.placeholderColor} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

HistoryItem.displayName = 'HistoryItem';
RecommendationItem.displayName = 'RecommendationItem';

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  onSearchSelect,
  onRecommendationSelect,
  currentLocation,
  maxEntries = 20,
  showRecommendations = true,
  theme,
  style,
}) => {
  const [historyEntries, setHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const [recommendations, setRecommendations] = useState<SearchRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load search history and recommendations
  const loadData = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Load search history
      const history = searchHistoryService.getSearchHistory({
        limit: maxEntries,
      });
      setHistoryEntries(history);

      // Load recommendations if enabled and location is available
      if (showRecommendations && currentLocation) {
        const recs = await searchHistoryService.getSearchRecommendations(currentLocation);
        setRecommendations(recs.slice(0, 5)); // Show top 5 recommendations
      }
    } catch (error) {
      console.error('Failed to load search data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [maxEntries, showRecommendations, currentLocation]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  // Handle history item selection
  const handleHistorySelect = useCallback(
    (query: string, location?: LocationCoordinates) => {
      onSearchSelect(query, location);
    },
    [onSearchSelect]
  );

  // Handle recommendation selection
  const handleRecommendationSelect = useCallback(
    (recommendation: SearchRecommendation) => {
      onRecommendationSelect(recommendation);
    },
    [onRecommendationSelect]
  );

  // Handle delete history item
  const handleDeleteHistoryItem = useCallback(
    async (entryId: string) => {
      try {
        // Remove from local state immediately for responsive UI
        setHistoryEntries(prev => prev.filter(entry => entry.id !== entryId));
        
        // TODO: Implement actual deletion in searchHistoryService
        // await searchHistoryService.deleteSearchEntry(entryId);
        
        // Show success feedback
        console.log('History item deleted:', entryId);
      } catch (error) {
        console.error('Failed to delete history item:', error);
        // Reload data to restore state
        loadData();
      }
    },
    [loadData]
  );

  // Clear all history
  const handleClearHistory = useCallback(async () => {
    Alert.alert(
      'Clear Search History',
      'Are you sure you want to clear all search history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await searchHistoryService.clearSearchHistory();
              setHistoryEntries([]);
              setRecommendations([]);
            } catch (error) {
              console.error('Failed to clear history:', error);
            }
          },
        },
      ]
    );
  }, []);

  // Render history item
  const renderHistoryItem: ListRenderItem<SearchHistoryEntry> = useCallback(
    ({ item, index }) => (
      <HistoryItem
        entry={item}
        onSelect={handleHistorySelect}
        onDelete={handleDeleteHistoryItem}
        theme={theme}
        index={index}
      />
    ),
    [handleHistorySelect, handleDeleteHistoryItem, theme]
  );

  // Render recommendation item
  const renderRecommendationItem: ListRenderItem<SearchRecommendation> = useCallback(
    ({ item, index }) => (
      <RecommendationItem
        recommendation={item}
        onSelect={handleRecommendationSelect}
        theme={theme}
        index={index}
      />
    ),
    [handleRecommendationSelect, theme]
  );

  // Combined data for FlatList
  const combinedData = useMemo(() => {
    const data: Array<{ type: 'recommendation' | 'history'; item: any }> = [];
    
    // Add recommendations first
    recommendations.forEach(rec => {
      data.push({ type: 'recommendation', item: rec });
    });
    
    // Add history items
    historyEntries.forEach(entry => {
      data.push({ type: 'history', item: entry });
    });
    
    return data;
  }, [recommendations, historyEntries]);

  // Render combined item
  const renderCombinedItem: ListRenderItem<{ type: 'recommendation' | 'history'; item: any }> = useCallback(
    ({ item, index }) => {
      if (item.type === 'recommendation') {
        return renderRecommendationItem({ item: item.item, index });
      }
      return renderHistoryItem({ item: item.item, index: index - recommendations.length });
    },
    [renderRecommendationItem, renderHistoryItem, recommendations.length]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: { type: 'recommendation' | 'history'; item: any }) => {
      return `${item.type}_${item.item.id}`;
    },
    []
  );

  // Show empty state
  if (!isLoading && combinedData.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundColor }, style]}>
        <Ionicons name="time-outline" size={48} color={theme.placeholderColor} />
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
          No Search History
        </Text>
        <Text style={[styles.emptyDescription, { color: theme.placeholderColor }]}>
          Your search history will appear here as you explore businesses and locations.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Search History
          </Text>
          {historyEntries.length > 0 && (
            <Text style={[styles.headerCount, { color: theme.placeholderColor }]}>
              {historyEntries.length} {historyEntries.length === 1 ? 'item' : 'items'}
            </Text>
          )}
        </View>
        
        {historyEntries.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
          >
            <Text style={[styles.clearButtonText, { color: theme.primaryColor }]}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <FlatList
        data={combinedData}
        renderItem={renderCombinedItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primaryColor}
            colors={[theme.primaryColor]}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  headerCount: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  historyItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  historyText: {
    flex: 1,
    marginRight: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 4,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  historyTime: {
    fontSize: 13,
    lineHeight: 16,
  },
  historyDot: {
    fontSize: 13,
    lineHeight: 16,
  },
  historyResults: {
    fontSize: 13,
    lineHeight: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    lineHeight: 14,
  },
  historyLocation: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repeatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  repeatText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: 4,
  },
  recommendationItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 122, 255, 0.03)',
  },
  recommendationButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recommendationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recommendationIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    marginRight: 8,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
  },
  recommendationBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  patternBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  patternText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SearchHistory;