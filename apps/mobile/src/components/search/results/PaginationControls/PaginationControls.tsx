import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PaginationControlsProps } from '../types';

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  totalResults,
  currentResultsCount,
  testID = 'pagination-controls'
}) => {
  // Handle load more press
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasNextPage) {
      onLoadMore();
    }
  }, [isLoadingMore, hasNextPage, onLoadMore]);

  // Don't render if no more pages or all results loaded
  if (!hasNextPage && currentResultsCount >= totalResults) {
    return (
      <View style={styles.endContainer} testID={`${testID}-end`}>
        <View style={styles.endIndicator} />
        <Text style={styles.endText}>
          End of results
        </Text>
        <Text style={styles.totalText}>
          Showing all {totalResults.toLocaleString()} results
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${(currentResultsCount / totalResults) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          Showing {currentResultsCount.toLocaleString()} of {totalResults.toLocaleString()}
        </Text>
      </View>

      {/* Load More Button */}
      {hasNextPage && (
        <TouchableOpacity
          style={[
            styles.loadMoreButton,
            isLoadingMore && styles.loadingButton
          ]}
          onPress={handleLoadMore}
          disabled={isLoadingMore}
          activeOpacity={0.7}
          testID={`${testID}-load-more`}
        >
          {isLoadingMore ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator 
                size="small" 
                color="#007AFF" 
                style={styles.loadingIndicator}
              />
              <Text style={styles.loadingText}>
                Loading more...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons 
                name="add-circle-outline" 
                size={18} 
                color="#007AFF" 
                style={styles.buttonIcon}
              />
              <Text style={styles.loadMoreText}>
                Load More Results
              </Text>
              <Text style={styles.remainingText}>
                ({(totalResults - currentResultsCount).toLocaleString()} remaining)
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Auto-load Hint */}
      {hasNextPage && !isLoadingMore && (
        <Text style={styles.autoLoadHint}>
          Or scroll to the bottom to auto-load
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadMoreButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginBottom: 12,
    minWidth: 200,
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
  loadingButton: {
    borderColor: '#C7C7CC',
  },
  buttonContent: {
    alignItems: 'center',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginBottom: 4,
  },
  loadMoreText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  remainingText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  autoLoadHint: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  endContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  endIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D1D6',
    borderRadius: 2,
    marginBottom: 12,
  },
  endText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  totalText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});