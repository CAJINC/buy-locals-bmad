import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SortOptionsProps } from '../types';
import { SORT_OPTIONS } from '../constants';
import { getSortLabel } from '../utils/searchResultUtils';

const { height: screenHeight } = Dimensions.get('window');

export const SortOptions: React.FC<SortOptionsProps> = ({
  currentSort,
  onSortChange,
  resultCount,
  isVisible,
  onToggle,
  testID = 'sort-options'
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = new Animated.Value(screenHeight);

  // Handle sort option press
  const handleSortPress = useCallback(() => {
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [slideAnim]);

  // Handle sort selection
  const handleSortSelect = useCallback((sortKey: string) => {
    onSortChange(sortKey as any);
    
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setModalVisible(false);
    });
  }, [onSortChange, slideAnim]);

  // Handle modal close
  const handleClose = useCallback(() => {
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setModalVisible(false);
    });
  }, [slideAnim]);

  // Get current sort option details
  const currentSortOption = SORT_OPTIONS.find(option => option.key === currentSort);

  return (
    <View style={styles.container} testID={testID}>
      {/* Sort Button */}
      <TouchableOpacity
        style={styles.sortButton}
        onPress={handleSortPress}
        activeOpacity={0.7}
        testID={`${testID}-button`}
      >
        <View style={styles.sortButtonContent}>
          <Ionicons 
            name="funnel-outline" 
            size={16} 
            color="#007AFF" 
            style={styles.sortIcon} 
          />
          <Text style={styles.sortButtonText}>
            Sort: {getSortLabel(currentSort)}
          </Text>
          <Ionicons 
            name="chevron-down" 
            size={16} 
            color="#007AFF" 
          />
        </View>
      </TouchableOpacity>

      {/* Results Count */}
      {resultCount > 0 && (
        <Text style={styles.resultCount}>
          {resultCount.toLocaleString()} {resultCount === 1 ? 'result' : 'results'}
        </Text>
      )}

      {/* Sort Options Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
        testID={`${testID}-modal`}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            onPress={handleClose}
            activeOpacity={1}
          />
          
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Sort Results</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                testID={`${testID}-close`}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Sort Options List */}
            <View style={styles.optionsContainer}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOptionItem,
                    option.key === currentSort && styles.selectedSortOption
                  ]}
                  onPress={() => handleSortSelect(option.key)}
                  activeOpacity={0.7}
                  testID={`${testID}-option-${option.key}`}
                >
                  <View style={styles.sortOptionContent}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={20} 
                      color={option.key === currentSort ? '#007AFF' : '#8E8E93'} 
                      style={styles.optionIcon}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text style={[
                        styles.optionLabel,
                        option.key === currentSort && styles.selectedOptionLabel
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                  
                  {option.key === currentSort && (
                    <Ionicons 
                      name="checkmark" 
                      size={20} 
                      color="#007AFF" 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Safe Area Bottom */}
            <View style={styles.safeAreaBottom} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sortButton: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E8FF',
  },
  sortButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortIcon: {
    marginRight: 6,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 4,
  },
  resultCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
    position: 'relative',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D1D6',
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 12,
    padding: 8,
  },
  optionsContainer: {
    paddingHorizontal: 20,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  selectedSortOption: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
    marginBottom: 2,
  },
  selectedOptionLabel: {
    color: '#007AFF',
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  safeAreaBottom: {
    ...Platform.select({
      ios: {
        height: 34, // Safe area bottom height on newer iPhones
      },
      android: {
        height: 20,
      },
    }),
  },
});