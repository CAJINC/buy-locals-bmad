import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FilterDropdownProps, FilterOption } from '../FilterPanel/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  title,
  options,
  onSelectionChange,
  multiSelect = true,
  searchable = false,
  searchQuery = '',
  onSearchChange,
  placeholder = 'Select options...',
  maxHeight = SCREEN_HEIGHT * 0.4,
  theme,
  testID = 'filter-dropdown',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  const searchText = searchable && onSearchChange ? searchQuery : internalSearchQuery;

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) {
      return options;
    }

    const query = searchText.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(query) ||
      option.description?.toLowerCase().includes(query)
    );
  }, [options, searchText]);

  // Get selected options for display
  const selectedOptions = useMemo(() => {
    return options.filter(option => option.selected);
  }, [options]);

  // Handle option selection
  const handleOptionToggle = useCallback((optionId: string) => {
    let newSelection: string[];

    if (multiSelect) {
      // Multi-select mode
      const currentSelection = options
        .filter(option => option.selected)
        .map(option => option.id);

      if (currentSelection.includes(optionId)) {
        newSelection = currentSelection.filter(id => id !== optionId);
      } else {
        newSelection = [...currentSelection, optionId];
      }
    } else {
      // Single-select mode
      newSelection = selectedOptions.map(opt => opt.id).includes(optionId) ? [] : [optionId];
      setIsExpanded(false); // Close dropdown on single selection
    }

    onSelectionChange(newSelection);
  }, [options, selectedOptions, multiSelect, onSelectionChange]);

  // Handle search input change
  const handleSearchChange = useCallback((text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    } else {
      setInternalSearchQuery(text);
    }
  }, [onSearchChange]);

  // Clear all selections
  const handleClearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Render option item
  const renderOptionItem = useCallback(({ item }: { item: FilterOption }) => (
    <TouchableOpacity
      style={[
        styles.optionItem,
        item.selected && { backgroundColor: `${theme.primaryColor}10` },
        item.disabled && styles.disabledOption,
      ]}
      onPress={() => handleOptionToggle(item.id)}
      disabled={item.disabled}
      activeOpacity={0.7}
      testID={`${testID}-option-${item.id}`}
    >
      <View style={styles.optionContent}>
        <View style={styles.optionTextContainer}>
          <Text
            style={[
              styles.optionLabel,
              item.selected && { color: theme.primaryColor, fontWeight: '600' },
              item.disabled && { color: '#ccc' },
            ]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
          
          {item.description && (
            <Text
              style={[
                styles.optionDescription,
                item.disabled && { color: '#ccc' },
              ]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          )}
        </View>

        <View style={styles.optionIndicators}>
          {/* Count badge */}
          {item.count !== undefined && item.count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.primaryColor }]}>
              <Text style={styles.countBadgeText}>
                {item.count > 999 ? '999+' : item.count.toString()}
              </Text>
            </View>
          )}

          {/* Selection indicator */}
          <View style={[
            styles.selectionIndicator,
            item.selected && { backgroundColor: theme.primaryColor },
          ]}>
            {item.selected && (
              <Icon
                name={multiSelect ? 'check' : 'radio-button-checked'}
                size={16}
                color="#fff"
              />
            )}
            {!item.selected && (
              <Icon
                name={multiSelect ? 'check-box-outline-blank' : 'radio-button-unchecked'}
                size={16}
                color="#ccc"
              />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), [theme, multiSelect, testID, handleOptionToggle]);

  // Summary text for collapsed state
  const summaryText = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }
    
    if (selectedOptions.length <= 3) {
      return selectedOptions.map(opt => opt.label).join(', ');
    }
    
    return `${selectedOptions.length} options selected`;
  }, [selectedOptions, placeholder]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Dropdown Header */}
      <TouchableOpacity
        style={[
          styles.header,
          isExpanded && { borderBottomColor: theme.primaryColor, borderBottomWidth: 2 },
          { borderColor: theme.borderColor },
        ]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
        testID={`${testID}-header`}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            {title}
          </Text>
          
          {selectedOptions.length > 0 && (
            <View style={[styles.selectedBadge, { backgroundColor: theme.primaryColor }]}>
              <Text style={styles.selectedBadgeText}>
                {selectedOptions.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {selectedOptions.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
              testID={`${testID}-clear`}
            >
              <Icon name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
          
          <Icon
            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>

      {/* Summary text when collapsed */}
      {!isExpanded && (
        <Text
          style={[
            styles.summaryText,
            selectedOptions.length > 0 && { color: theme.primaryColor },
          ]}
          numberOfLines={2}
        >
          {summaryText}
        </Text>
      )}

      {/* Dropdown Content */}
      {isExpanded && (
        <View style={[styles.dropdownContent, { borderColor: theme.borderColor }]}>
          {/* Search Input */}
          {searchable && (
            <View style={[styles.searchContainer, { borderColor: theme.borderColor }]}>
              <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.textColor }]}
                placeholder="Search options..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={handleSearchChange}
                testID={`${testID}-search`}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => handleSearchChange('')}
                >
                  <Icon name="close" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Options List */}
          <FlatList
            data={filteredOptions}
            renderItem={renderOptionItem}
            keyExtractor={(item) => item.id}
            style={[styles.optionsList, { maxHeight }]}
            contentContainerStyle={styles.optionsListContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="search-off" size={32} color="#ccc" />
                <Text style={styles.emptyText}>No options found</Text>
                {searchable && searchText.trim() && (
                  <Text style={styles.emptySubtext}>
                    Try adjusting your search terms
                  </Text>
                )}
              </View>
            }
          />

          {/* Footer with selection info */}
          {multiSelect && options.length > 0 && (
            <View style={[styles.footer, { borderTopColor: theme.borderColor }]}>
              <Text style={styles.footerText}>
                {selectedOptions.length} of {options.length} selected
              </Text>
              
              {selectedOptions.length > 0 && (
                <TouchableOpacity
                  style={styles.footerClearButton}
                  onPress={handleClearAll}
                  testID={`${testID}-footer-clear`}
                >
                  <Text style={[styles.footerClearText, { color: theme.primaryColor }]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  dropdownContent: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
  },
  optionsList: {
    flexGrow: 0,
  },
  optionsListContent: {
    paddingVertical: 8,
  },
  optionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333',
    lineHeight: 18,
  },
  optionDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    lineHeight: 16,
  },
  optionIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
  footerClearButton: {
    padding: 4,
  },
  footerClearText: {
    fontSize: 12,
    fontWeight: '500',
  },
});