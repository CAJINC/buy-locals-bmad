import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FilterSummaryProps } from '../FilterPanel/types';

export const FilterSummary: React.FC<FilterSummaryProps> = ({
  resultCount,
  isLoading,
  appliedFilters,
  theme,
  testID = 'filter-summary',
}) => {
  // Generate summary text based on applied filters
  const filterSummary = useMemo(() => {
    const summaryParts: string[] = [];
    
    // Categories
    if (appliedFilters.categories.length > 0) {
      const categoryCount = appliedFilters.categories.length;
      summaryParts.push(`${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}`);
    }
    
    // Distance
    if (appliedFilters.distance.radius < 25) {
      summaryParts.push(`within ${appliedFilters.distance.radius}${appliedFilters.distance.unit}`);
    }
    
    // Price range
    if (appliedFilters.priceRange.min > 0 || appliedFilters.priceRange.max < 1000) {
      const { min, max } = appliedFilters.priceRange;
      if (min === 0) {
        summaryParts.push(`under $${max}`);
      } else if (max >= 1000) {
        summaryParts.push(`$${min}+`);
      } else {
        summaryParts.push(`$${min}-$${max}`);
      }
    }
    
    // Rating
    if (appliedFilters.rating.minimum > 0) {
      summaryParts.push(`${appliedFilters.rating.minimum}★+`);
    }
    
    // Hours
    if (appliedFilters.hours.openNow) {
      summaryParts.push('open now');
    }
    if (appliedFilters.hours.specificHours === '24/7') {
      summaryParts.push('24/7');
    }
    
    // Features
    if (appliedFilters.features.length > 0) {
      const featureCount = appliedFilters.features.length;
      summaryParts.push(`${featureCount} feature${featureCount === 1 ? '' : 's'}`);
    }
    
    return summaryParts;
  }, [appliedFilters]);

  // Format result count with appropriate messaging
  const resultMessage = useMemo(() => {
    if (isLoading) {
      return 'Searching...';
    }
    
    if (resultCount === 0) {
      return 'No results found';
    }
    
    if (resultCount === 1) {
      return '1 result found';
    }
    
    return `${resultCount.toLocaleString()} results found`;
  }, [resultCount, isLoading]);

  // Determine icon and color based on result count
  const getResultIndicator = () => {
    if (isLoading) {
      return {
        icon: null,
        color: theme.primaryColor,
        showSpinner: true,
      };
    }
    
    if (resultCount === 0) {
      return {
        icon: 'search-off',
        color: '#FF6B35',
        showSpinner: false,
      };
    }
    
    if (resultCount < 10) {
      return {
        icon: 'filter-list',
        color: '#FFD93D',
        showSpinner: false,
      };
    }
    
    return {
      icon: 'check-circle',
      color: '#4CAF50',
      showSpinner: false,
    };
  };

  const resultIndicator = getResultIndicator();

  return (
    <View style={styles.container} testID={testID}>
      {/* Result Count Display */}
      <View style={styles.resultSection}>
        <View style={styles.resultIndicator}>
          {resultIndicator.showSpinner ? (
            <ActivityIndicator
              size="small"
              color={resultIndicator.color}
              testID={`${testID}-loading`}
            />
          ) : (
            <Icon
              name={resultIndicator.icon!}
              size={20}
              color={resultIndicator.color}
            />
          )}
        </View>
        
        <View style={styles.resultText}>
          <Text
            style={[
              styles.resultCount,
              { color: resultIndicator.color }
            ]}
          >
            {resultMessage}
          </Text>
          
          {/* Filter summary */}
          {filterSummary.length > 0 && !isLoading && (
            <Text style={[styles.filterSummary, { color: theme.textColor }]}>
              Filtered by: {filterSummary.join(', ')}
            </Text>
          )}
        </View>
      </View>

      {/* Additional Info */}
      {!isLoading && (
        <View style={styles.additionalInfo}>
          {/* No results guidance */}
          {resultCount === 0 && (
            <View style={styles.noResultsGuidance}>
              <Text style={styles.guidanceTitle}>Try adjusting your filters:</Text>
              <Text style={styles.guidanceText}>• Increase search radius</Text>
              <Text style={styles.guidanceText}>• Remove some categories</Text>
              <Text style={styles.guidanceText}>• Expand price range</Text>
              <Text style={styles.guidanceText}>• Lower rating requirements</Text>
            </View>
          )}
          
          {/* Performance tip for large results */}
          {resultCount > 100 && (
            <View style={styles.performanceTip}>
              <Icon name="info" size={16} color="#666" />
              <Text style={styles.tipText}>
                Narrow filters for more precise results
              </Text>
            </View>
          )}
          
          {/* Popular filters suggestion */}
          {filterSummary.length === 0 && resultCount > 50 && (
            <View style={styles.suggestionTip}>
              <Icon name="lightbulb-outline" size={16} color={theme.primaryColor} />
              <Text style={[styles.tipText, { color: theme.primaryColor }]}>
                Try "Open Now" or "Highly Rated" filters
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultIndicator: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultText: {
    flex: 1,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  filterSummary: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
  },
  additionalInfo: {
    marginTop: 8,
  },
  noResultsGuidance: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  guidanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 6,
  },
  guidanceText: {
    fontSize: 12,
    color: '#BF360C',
    marginBottom: 2,
    paddingLeft: 8,
  },
  performanceTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  suggestionTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
});