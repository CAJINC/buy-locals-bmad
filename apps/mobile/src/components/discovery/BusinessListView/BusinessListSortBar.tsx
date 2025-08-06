import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessListSortBarProps, SortBy } from './types';

const SORT_OPTIONS: SortBy[] = [
  { key: 'distance', label: 'Distance', icon: 'near-me' },
  { key: 'rating', label: 'Rating', icon: 'star' },
  { key: 'name', label: 'Name', icon: 'sort-by-alpha' },
  { key: 'newest', label: 'Newest', icon: 'new-releases' },
];

export const BusinessListSortBar: React.FC<BusinessListSortBarProps> = ({
  currentSort,
  onSortChange,
  showSortOptions,
  onToggleSortOptions,
  testID = 'business-list-sort-bar'
}) => {
  const currentSortOption = SORT_OPTIONS.find(option => option.key === currentSort);

  return (
    <View style={styles.container} testID={testID}>
      {/* Sort Toggle Button */}
      <TouchableOpacity
        style={[styles.sortToggle, showSortOptions && styles.sortToggleActive]}
        onPress={onToggleSortOptions}
        testID={`${testID}-toggle`}
        activeOpacity={0.7}
      >
        <Icon 
          name={currentSortOption?.icon || 'sort'} 
          size={20} 
          color={showSortOptions ? '#007AFF' : '#666'} 
        />
        <Text style={[
          styles.sortToggleText,
          showSortOptions && styles.sortToggleTextActive
        ]}>
          Sort: {currentSortOption?.label || 'Distance'}
        </Text>
        <Icon 
          name={showSortOptions ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
          size={20} 
          color={showSortOptions ? '#007AFF' : '#666'} 
        />
      </TouchableOpacity>

      {/* Sort Options */}
      {showSortOptions && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.sortOptionsContainer}
          contentContainerStyle={styles.sortOptionsContent}
          testID={`${testID}-options-container`}
        >
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                currentSort === option.key && styles.sortOptionActive
              ]}
              onPress={() => onSortChange(option.key)}
              testID={`${testID}-option-${option.key}`}
              activeOpacity={0.7}
            >
              <Icon
                name={option.icon}
                size={18}
                color={currentSort === option.key ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.sortOptionText,
                currentSort === option.key && styles.sortOptionTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sortToggleActive: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  sortToggleText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  sortToggleTextActive: {
    color: '#007AFF',
  },
  sortOptionsContainer: {
    maxHeight: 60,
  },
  sortOptionsContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    marginRight: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  sortOptionActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  sortOptionText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  sortOptionTextActive: {
    color: '#007AFF',
  },
});