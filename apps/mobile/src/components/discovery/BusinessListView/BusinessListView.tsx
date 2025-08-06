import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl,
  ListRenderItemInfo,
  Platform
} from 'react-native';
import { BusinessListViewProps, BusinessWithDistance, SortOption } from './types';
import { BusinessListItem } from './BusinessListItem';
import { BusinessListSkeleton } from './BusinessListSkeleton';
import { BusinessListEmptyState } from './BusinessListEmptyState';
import { BusinessListSortBar } from './BusinessListSortBar';

export const BusinessListView: React.FC<BusinessListViewProps> = ({
  businesses,
  currentLocation,
  loading = false,
  refreshing = false,
  hasNextPage = false,
  sortBy = 'distance',
  onBusinessPress,
  onRefresh,
  onLoadMore,
  onSortChange,
  emptyStateMessage = "No businesses found",
  emptyStateSubtitle = "Try adjusting your search criteria or expanding your search radius.",
  emptyStateAction,
  emptyStateActionLabel = "Try Again",
  showSortOptions = true,
  showDistance = true,
  showRating = true,
  testID = 'business-list-view'
}) => {
  const [showSortBar, setShowSortBar] = useState(false);

  // Sort businesses based on the current sort option
  const sortedBusinesses = useMemo(() => {
    const sorted = [...businesses];
    
    switch (sortBy) {
      case 'distance':
        return sorted.sort((a, b) => a.distance - b.distance);
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      default:
        return sorted;
    }
  }, [businesses, sortBy]);

  // Handle sort change
  const handleSortChange = useCallback((newSort: SortOption) => {
    onSortChange?.(newSort);
    setShowSortBar(false);
  }, [onSortChange]);

  // Handle sort bar toggle
  const handleToggleSortBar = useCallback(() => {
    setShowSortBar(prev => !prev);
  }, []);

  // Handle business item press
  const handleBusinessPress = useCallback((business: BusinessWithDistance) => {
    onBusinessPress(business);
  }, [onBusinessPress]);

  // Render business list item
  const renderBusinessItem = useCallback(({ 
    item, 
    index 
  }: ListRenderItemInfo<BusinessWithDistance>) => (
    <BusinessListItem
      business={item}
      currentLocation={currentLocation}
      onPress={handleBusinessPress}
      showDistance={showDistance}
      showRating={showRating}
      testID={`${testID}-item-${index}`}
    />
  ), [
    currentLocation,
    handleBusinessPress,
    showDistance,
    showRating,
    testID
  ]);

  // Get item key
  const getItemKey = useCallback((item: BusinessWithDistance) => item.id, []);

  // Handle end reached (load more)
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [hasNextPage, loading, onLoadMore]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (loading) {
      return (
        <BusinessListSkeleton
          count={5}
          testID={`${testID}-skeleton`}
        />
      );
    }

    return (
      <BusinessListEmptyState
        message={emptyStateMessage}
        subtitle={emptyStateSubtitle}
        action={emptyStateAction}
        actionLabel={emptyStateActionLabel}
        testID={`${testID}-empty-state`}
      />
    );
  }, [
    loading,
    emptyStateMessage,
    emptyStateSubtitle,
    emptyStateAction,
    emptyStateActionLabel,
    testID
  ]);

  // Render footer (loading indicator for pagination)
  const renderFooter = useCallback(() => {
    if (!hasNextPage || !loading) return null;

    return (
      <View style={styles.footer}>
        <BusinessListSkeleton
          count={2}
          testID={`${testID}-loading-more`}
        />
      </View>
    );
  }, [hasNextPage, loading, testID]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Sort Bar */}
      {showSortOptions && sortedBusinesses.length > 0 && (
        <BusinessListSortBar
          currentSort={sortBy}
          onSortChange={handleSortChange}
          showSortOptions={showSortBar}
          onToggleSortOptions={handleToggleSortBar}
          testID={`${testID}-sort-bar`}
        />
      )}

      {/* Business List */}
      <FlatList
        data={sortedBusinesses}
        renderItem={renderBusinessItem}
        keyExtractor={getItemKey}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
              title="Pull to refresh"
              titleColor="#666"
              testID={`${testID}-refresh-control`}
            />
          ) : undefined
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={[
          styles.listContent,
          sortedBusinesses.length === 0 && styles.emptyListContent
        ]}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        getItemLayout={undefined} // Let FlatList calculate dynamic heights
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
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  footer: {
    paddingVertical: 20,
  },
});