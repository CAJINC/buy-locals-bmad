import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ListRenderItemInfo,
  Platform,
  Text,
  Animated
} from 'react-native';
import { SearchResultsProps, SearchResultItem } from '../types';
import { SearchResultItemComponent } from '../SearchResultItem/SearchResultItem';
import { SortOptions } from '../SortOptions/SortOptions';
import { EmptyState } from '../EmptyState/EmptyState';
import { PaginationControls } from '../PaginationControls/PaginationControls';
import { useSearchResults } from '../hooks/useSearchResults';
import { INFINITE_SCROLL_THRESHOLD, RESULTS_PER_PAGE } from '../constants';

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  currentLocation,
  searchQuery,
  sortBy = 'distance',
  isLoading = false,
  isLoadingMore = false,
  isRefreshing = false,
  hasNextPage = false,
  totalResults = 0,
  onResultPress,
  onSortChange,
  onRefresh,
  onLoadMore,
  onBookmark,
  onShare,
  onGetDirections,
  onExportResults,
  testID = 'search-results'
}) => {
  const scrollY = new Animated.Value(0);
  const [showSortOptions, setShowSortOptions] = React.useState(false);

  // Use search results hook for state management
  const {
    state,
    actions,
    computed,
    preferences
  } = useSearchResults({
    initialResults: results,
    initialSortBy: sortBy,
    searchQuery,
    currentLocation,
    enableBookmarking: !!onBookmark,
    enableInfiniteScroll: !!onLoadMore,
    pageSize: RESULTS_PER_PAGE
  });

  // Update results when props change
  useEffect(() => {
    actions.setResults(results);
  }, [results, actions]);

  // Handle sort change
  const handleSortChange = useCallback((newSortBy: SearchResultItem['sortBy']) => {
    actions.setSortBy(newSortBy);
    onSortChange(newSortBy);
    setShowSortOptions(false);
  }, [actions, onSortChange]);

  // Handle item press
  const handleItemPress = useCallback((result: SearchResultItem) => {
    onResultPress(result);
  }, [onResultPress]);

  // Handle bookmark toggle
  const handleBookmark = useCallback(async (resultId: string) => {
    await actions.toggleBookmark(resultId);
    onBookmark?.(resultId);
  }, [actions, onBookmark]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (hasNextPage && !isLoadingMore && onLoadMore) {
      await onLoadMore();
    }
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isLoadingMore) {
      handleLoadMore();
    }
  }, [hasNextPage, isLoadingMore, handleLoadMore]);

  // Render result item
  const renderResultItem = useCallback(({ 
    item, 
    index 
  }: ListRenderItemInfo<SearchResultItem>) => (
    <SearchResultItemComponent
      result={item}
      currentLocation={currentLocation}
      searchQuery={searchQuery}
      onPress={handleItemPress}
      onBookmark={onBookmark ? handleBookmark : undefined}
      onShare={onShare}
      onGetDirections={onGetDirections}
      isBookmarked={preferences.bookmarkedIds.has(item.id)}
      showDistance={true}
      showRating={true}
      showHighlights={true}
      testID={`${testID}-item-${index}`}
    />
  ), [
    currentLocation,
    searchQuery,
    handleItemPress,
    handleBookmark,
    onBookmark,
    onShare,
    onGetDirections,
    preferences.bookmarkedIds,
    testID
  ]);

  // Get item key
  const getItemKey = useCallback((item: SearchResultItem) => item.id, []);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Searching nearby businesses...</Text>
        </View>
      );
    }

    return (
      <EmptyState
        searchQuery={searchQuery}
        onRetry={handleRefresh}
        onClearFilters={() => {
          // Handle clear filters
        }}
        onExpandRadius={() => {
          // Handle expand radius
        }}
        hasFilters={false}
        testID={`${testID}-empty-state`}
      />
    );
  }, [isLoading, searchQuery, handleRefresh, testID]);

  // Render list header with sort options
  const renderListHeader = useCallback(() => {
    if (computed.isEmpty || isLoading) return null;

    return (
      <View style={styles.header}>
        <SortOptions
          currentSort={state.sortBy}
          onSortChange={handleSortChange}
          resultCount={totalResults}
          isVisible={showSortOptions}
          onToggle={() => setShowSortOptions(!showSortOptions)}
          testID={`${testID}-sort-options`}
        />
        {totalResults > 0 && (
          <Text style={styles.resultCount}>
            {totalResults} {totalResults === 1 ? 'result' : 'results'} found
          </Text>
        )}
      </View>
    );
  }, [
    computed.isEmpty,
    isLoading,
    state.sortBy,
    handleSortChange,
    totalResults,
    showSortOptions,
    testID
  ]);

  // Render list footer
  const renderListFooter = useCallback(() => {
    if (computed.isEmpty) return null;

    return (
      <PaginationControls
        hasNextPage={hasNextPage}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        totalResults={totalResults}
        currentResultsCount={computed.displayResults.length}
        testID={`${testID}-pagination`}
      />
    );
  }, [
    computed.isEmpty,
    computed.displayResults.length,
    hasNextPage,
    isLoadingMore,
    handleLoadMore,
    totalResults,
    testID
  ]);

  // Handle scroll for performance optimizations
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    scrollY.setValue(contentOffset.y);
  }, [scrollY]);

  return (
    <View style={styles.container} testID={testID}>
      <FlatList
        data={computed.displayResults}
        renderItem={renderResultItem}
        keyExtractor={getItemKey}
        onEndReached={handleEndReached}
        onEndReachedThreshold={INFINITE_SCROLL_THRESHOLD}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
              title="Pull to refresh"
              titleColor="#666"
              testID={`${testID}-refresh-control`}
            />
          ) : undefined
        }
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderListFooter}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={[
          styles.listContent,
          computed.isEmpty && styles.emptyListContent
        ]}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        updateCellsBatchingPeriod={50}
        getItemLayout={undefined} // Dynamic heights
        keyboardShouldPersistTaps="handled"
        testID={`${testID}-flat-list`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  resultCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});