import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CategoryFilterProps, CategoryOption } from '../FilterPanel/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = (SCREEN_WIDTH - 80) / 2; // Accounting for padding and gaps

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategories,
  onCategoriesChange,
  availableCategories,
  onCategoryPress,
  maxSelections = 10,
  showHierarchy = true,
  theme,
  testID = 'category-filter',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableCategories;
    }

    const query = searchQuery.toLowerCase();
    const filtered: CategoryOption[] = [];

    const searchInCategory = (category: CategoryOption): boolean => {
      const matchesName = category.name.toLowerCase().includes(query);
      const matchesChildren = category.children?.some(child => searchInCategory(child)) || false;
      
      if (matchesName || matchesChildren) {
        const filteredCategory: CategoryOption = {
          ...category,
          children: category.children?.filter(child => searchInCategory(child)),
        };
        filtered.push(filteredCategory);
        return true;
      }
      
      return false;
    };

    availableCategories.forEach(category => searchInCategory(category));
    return filtered;
  }, [availableCategories, searchQuery]);

  // Toggle parent category expansion
  const toggleParentExpansion = useCallback((categoryId: string) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Handle category selection
  const handleCategoryToggle = useCallback((categoryId: string, isParent: boolean = false) => {
    let newSelection = [...selectedCategories];
    
    if (selectedCategories.includes(categoryId)) {
      // Remove category
      newSelection = newSelection.filter(id => id !== categoryId);
      
      // If parent category is being removed, also remove all children
      if (isParent) {
        const parentCategory = availableCategories.find(cat => cat.id === categoryId);
        if (parentCategory?.children) {
          const childIds = parentCategory.children.map(child => child.id);
          newSelection = newSelection.filter(id => !childIds.includes(id));
        }
      }
    } else {
      // Add category (if under limit)
      if (newSelection.length < maxSelections) {
        newSelection.push(categoryId);
        
        // If parent category is being selected, auto-expand it
        if (isParent) {
          setExpandedParents(prev => new Set([...prev, categoryId]));
        }
      }
    }
    
    onCategoriesChange(newSelection);
    
    // Trigger category press callback if provided
    if (onCategoryPress) {
      onCategoryPress(categoryId);
    }
  }, [selectedCategories, onCategoriesChange, onCategoryPress, maxSelections, availableCategories]);

  // Handle child category selection
  const handleChildCategoryToggle = useCallback((childId: string, parentId: string) => {
    let newSelection = [...selectedCategories];
    
    if (selectedCategories.includes(childId)) {
      // Remove child
      newSelection = newSelection.filter(id => id !== childId);
    } else {
      // Add child (if under limit)
      if (newSelection.length < maxSelections) {
        newSelection.push(childId);
        
        // Remove parent if child is being selected
        newSelection = newSelection.filter(id => id !== parentId);
      }
    }
    
    onCategoriesChange(newSelection);
    
    if (onCategoryPress) {
      onCategoryPress(childId);
    }
  }, [selectedCategories, onCategoriesChange, onCategoryPress, maxSelections]);

  // Render individual category item
  const renderCategoryItem = useCallback((category: CategoryOption, isChild = false, parentId?: string) => {
    const isSelected = selectedCategories.includes(category.id);
    const isExpanded = expandedParents.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const isParentSelected = parentId && selectedCategories.includes(parentId);
    const isDisabled = !isSelected && selectedCategories.length >= maxSelections;
    
    return (
      <View key={category.id} style={[styles.categoryContainer, isChild && styles.childCategoryContainer]}>
        <TouchableOpacity
          style={[
            styles.categoryItem,
            isChild ? styles.childCategoryItem : styles.parentCategoryItem,
            isSelected && { backgroundColor: `${theme.primaryColor}15`, borderColor: theme.primaryColor },
            isParentSelected && !isSelected && styles.parentSelectedItem,
            isDisabled && styles.disabledItem,
          ]}
          onPress={() => {
            if (isChild && parentId) {
              handleChildCategoryToggle(category.id, parentId);
            } else {
              handleCategoryToggle(category.id, !isChild);
            }
          }}
          disabled={isDisabled}
          activeOpacity={0.7}
          testID={`${testID}-item-${category.id}`}
        >
          <View style={styles.categoryContent}>
            {/* Category Icon */}
            <View style={[
              styles.iconContainer,
              isSelected && { backgroundColor: theme.primaryColor }
            ]}>
              <Icon
                name={category.icon || (isChild ? 'radio-button-unchecked' : 'category')}
                size={isChild ? 16 : 20}
                color={isSelected ? '#fff' : (isDisabled ? '#ccc' : theme.primaryColor)}
              />
            </View>
            
            {/* Category Name and Count */}
            <View style={styles.textContainer}>
              <Text
                style={[
                  styles.categoryName,
                  isChild && styles.childCategoryName,
                  isSelected && { color: theme.primaryColor, fontWeight: '600' },
                  isDisabled && { color: '#ccc' },
                ]}
                numberOfLines={2}
              >
                {category.name}
              </Text>
              
              {category.count !== undefined && (
                <Text style={[
                  styles.categoryCount,
                  isSelected && { color: theme.primaryColor },
                  isDisabled && { color: '#ccc' },
                ]}>
                  {category.count.toLocaleString()}
                </Text>
              )}
            </View>
            
            {/* Selection Indicator */}
            <View style={styles.selectionIndicator}>
              {isSelected && (
                <Icon
                  name="check-circle"
                  size={20}
                  color={theme.primaryColor}
                />
              )}
              
              {/* Expand/Collapse for parent categories */}
              {hasChildren && !isChild && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => toggleParentExpansion(category.id)}
                  testID={`${testID}-expand-${category.id}`}
                >
                  <Icon
                    name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Child Categories */}
        {hasChildren && showHierarchy && isExpanded && (
          <View style={styles.childrenContainer}>
            {category.children!.map(child => renderCategoryItem(child, true, category.id))}
          </View>
        )}
      </View>
    );
  }, [
    selectedCategories,
    expandedParents,
    maxSelections,
    theme,
    testID,
    showHierarchy,
    handleCategoryToggle,
    handleChildCategoryToggle,
    toggleParentExpansion
  ]);

  // Render main content
  return (
    <View style={styles.container} testID={testID}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { borderColor: theme.borderColor }]}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.textColor }]}
          placeholder="Search categories..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID={`${testID}-search`}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
          >
            <Icon name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection Summary */}
      <View style={styles.selectionSummary}>
        <Text style={[styles.summaryText, { color: theme.textColor }]}>
          {selectedCategories.length} of {maxSelections} categories selected
        </Text>
        {selectedCategories.length > 0 && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={() => onCategoriesChange([])}
            testID={`${testID}-clear-all`}
          >
            <Text style={[styles.clearAllText, { color: theme.primaryColor }]}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories List */}
      <FlatList
        data={filteredCategories}
        renderItem={({ item }) => renderCategoryItem(item)}
        keyExtractor={(item) => item.id}
        style={styles.categoryList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        numColumns={1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No categories found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search terms</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  },
  clearAllButton: {
    padding: 4,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryList: {
    maxHeight: 400,
  },
  listContent: {
    paddingBottom: 20,
  },
  categoryContainer: {
    marginBottom: 4,
  },
  childCategoryContainer: {
    marginLeft: 20,
  },
  categoryItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F8F9FA',
    marginBottom: 8,
  },
  parentCategoryItem: {
    minHeight: 60,
  },
  childCategoryItem: {
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E7',
    marginBottom: 4,
  },
  parentSelectedItem: {
    backgroundColor: '#F0F0F0',
    borderColor: '#D0D0D0',
  },
  disabledItem: {
    opacity: 0.5,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  childCategoryName: {
    fontSize: 14,
    fontWeight: '400',
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    marginLeft: 8,
    padding: 4,
  },
  childrenContainer: {
    marginTop: -4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
});