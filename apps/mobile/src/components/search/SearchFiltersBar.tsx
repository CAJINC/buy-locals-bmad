import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { OpenNowFilter, EnhancedOpenNowFilter } from './OpenNowFilter';

export interface SearchFilter {
  id: string;
  label: string;
  icon: string;
  isActive: boolean;
  count?: number;
  type: 'toggle' | 'select' | 'range';
  options?: string[];
  value?: any;
}

export interface SearchFiltersBarProps {
  filters: SearchFilter[];
  openNowFilter?: {
    isActive: boolean;
    businessCount?: number;
    isLoading?: boolean;
    closingSoonCount?: number;
    nextOpeningCount?: number;
  };
  onFilterChange: (filterId: string, value: any) => void;
  onOpenNowToggle: (isActive: boolean) => void;
  onOpenNowRecommendation?: (type: 'closing-soon' | 'next-opening') => void;
  showEnhancedOpenNow?: boolean;
  isLoading?: boolean;
  testID?: string;
}

export const SearchFiltersBar: React.FC<SearchFiltersBarProps> = ({
  filters,
  openNowFilter,
  onFilterChange,
  onOpenNowToggle,
  onOpenNowRecommendation,
  showEnhancedOpenNow = false,
  isLoading = false,
  testID = 'search-filters-bar'
}) => {
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleFilterExpansion = useCallback((filterId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
  }, []);

  const toggleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (openNowFilter?.isActive) count++;
    count += filters.filter(filter => filter.isActive).length;
    return count;
  }, [filters, openNowFilter]);

  const renderStandardFilter = (filter: SearchFilter) => {
    const isExpanded = expandedFilters.has(filter.id);

    return (
      <View key={filter.id} style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter.isActive && styles.activeFilterButton]}
          onPress={() => {
            if (filter.type === 'toggle') {
              onFilterChange(filter.id, !filter.isActive);
            } else {
              toggleFilterExpansion(filter.id);
            }
          }}
          testID={`${testID}-${filter.id}`}
        >
          <Icon
            name={filter.icon}
            size={18}
            color={filter.isActive ? '#FFF' : '#666'}
          />
          <Text style={[styles.filterLabel, filter.isActive && styles.activeFilterLabel]}>
            {filter.label}
          </Text>
          {filter.count !== undefined && (
            <Text style={[styles.filterCount, filter.isActive && styles.activeFilterCount]}>
              ({filter.count})
            </Text>
          )}
          {filter.type !== 'toggle' && (
            <Icon
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={16}
              color={filter.isActive ? '#FFF' : '#666'}
            />
          )}
        </TouchableOpacity>

        {isExpanded && filter.type === 'select' && filter.options && (
          <View style={styles.filterOptions}>
            {filter.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.filterOption,
                  filter.value === option && styles.activeFilterOption
                ]}
                onPress={() => {
                  onFilterChange(filter.id, option);
                  setExpandedFilters(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(filter.id);
                    return newSet;
                  });
                }}
                testID={`${testID}-${filter.id}-option-${index}`}
              >
                <Text style={[
                  styles.filterOptionText,
                  filter.value === option && styles.activeFilterOptionText
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCollapsedView = () => (
    <View style={styles.collapsedContainer}>
      <TouchableOpacity
        style={styles.collapsedButton}
        onPress={toggleCollapse}
        testID={`${testID}-expand`}
      >
        <Icon name="filter-list" size={20} color="#666" />
        <Text style={styles.collapsedText}>
          Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
        </Text>
        <Icon name="expand-more" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  const renderExpandedView = () => (
    <View style={styles.expandedContainer}>
      <View style={styles.filtersHeader}>
        <Text style={styles.filtersTitle}>Filters</Text>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={toggleCollapse}
          testID={`${testID}-collapse`}
        >
          <Icon name="expand-less" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersScrollContent}
      >
        {/* Open Now Filter */}
        {openNowFilter && (
          <View style={styles.openNowFilterContainer}>
            {showEnhancedOpenNow ? (
              <EnhancedOpenNowFilter
                isActive={openNowFilter.isActive}
                onToggle={onOpenNowToggle}
                businessCount={openNowFilter.businessCount}
                isLoading={openNowFilter.isLoading}
                showRecommendations={true}
                closingSoonCount={openNowFilter.closingSoonCount}
                nextOpeningCount={openNowFilter.nextOpeningCount}
                onRecommendationPress={onOpenNowRecommendation}
                testID={`${testID}-enhanced-open-now`}
              />
            ) : (
              <OpenNowFilter
                isActive={openNowFilter.isActive}
                onToggle={onOpenNowToggle}
                businessCount={openNowFilter.businessCount}
                isLoading={openNowFilter.isLoading}
                testID={`${testID}-open-now`}
              />
            )}
          </View>
        )}

        {/* Other Filters */}
        {filters.map(renderStandardFilter)}
      </ScrollView>

      {/* Clear All Filters */}
      {getActiveFilterCount() > 0 && (
        <View style={styles.clearAllContainer}>
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={() => {
              // Clear all filters
              if (openNowFilter?.isActive) {
                onOpenNowToggle(false);
              }
              filters.forEach(filter => {
                if (filter.isActive) {
                  onFilterChange(filter.id, false);
                }
              });
            }}
            testID={`${testID}-clear-all`}
          >
            <Icon name="clear" size={16} color="#F44336" />
            <Text style={styles.clearAllText}>Clear All ({getActiveFilterCount()})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {isCollapsed ? renderCollapsedView() : renderExpandedView()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  // Collapsed View
  collapsedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collapsedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  
  // Expanded View
  expandedContainer: {
    paddingBottom: 12,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  collapseButton: {
    padding: 4,
  },
  filtersScroll: {
    paddingVertical: 12,
  },
  filtersScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  
  // Open Now Filter
  openNowFilterContainer: {
    minWidth: 120,
  },
  
  // Standard Filters
  filterContainer: {
    position: 'relative',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activeFilterLabel: {
    color: '#FFF',
  },
  filterCount: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterCount: {
    color: '#CCE7FF',
  },
  
  // Filter Options (for select type)
  filterOptions: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    maxHeight: 200,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activeFilterOption: {
    backgroundColor: '#F0F8FF',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333',
  },
  activeFilterOptionText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  
  // Clear All
  clearAllContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  clearAllText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
});