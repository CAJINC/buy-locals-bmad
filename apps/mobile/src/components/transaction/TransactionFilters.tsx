import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { styles } from './styles';

export interface TransactionFiltersProps {
  visible: boolean;
  filters: TransactionFiltersState;
  onFiltersChange: (filters: Partial<TransactionFiltersState>) => void;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export interface TransactionFiltersState {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  sortBy: 'date' | 'amount' | 'status' | 'business';
  sortOrder: 'asc' | 'desc';
}

interface DatePickerState {
  show: boolean;
  mode: 'date' | 'time';
  type: 'start' | 'end';
  value: Date;
}

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid', color: '#10B981' },
  { value: 'refunded', label: 'Refunded', color: '#EF4444' },
  { value: 'partially_refunded', label: 'Partially Refunded', color: '#F59E0B' },
  { value: 'disputed', label: 'Disputed', color: '#6B7280' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Date', icon: 'calendar' },
  { value: 'amount', label: 'Amount', icon: 'cash' },
  { value: 'status', label: 'Status', icon: 'checkmark-circle' },
  { value: 'business', label: 'Business', icon: 'business' },
];

const QUICK_DATE_FILTERS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 365 },
];

/**
 * TransactionFilters Component
 * 
 * Advanced filtering modal for transaction history with options for:
 * - Date range selection
 * - Status filtering
 * - Amount range filtering
 * - Search functionality
 * - Sorting options
 * - Quick filter presets
 */
export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  visible,
  filters,
  onFiltersChange,
  onClose,
  theme = 'light',
}) => {
  const [localFilters, setLocalFilters] = useState<TransactionFiltersState>(filters);
  const [datePicker, setDatePicker] = useState<DatePickerState>({
    show: false,
    mode: 'date',
    type: 'start',
    value: new Date(),
  });

  const [amountInputs, setAmountInputs] = useState({
    minAmount: filters.minAmount ? (filters.minAmount / 100).toString() : '',
    maxAmount: filters.maxAmount ? (filters.maxAmount / 100).toString() : '',
  });

  // Sync local filters with prop changes
  useEffect(() => {
    setLocalFilters(filters);
    setAmountInputs({
      minAmount: filters.minAmount ? (filters.minAmount / 100).toString() : '',
      maxAmount: filters.maxAmount ? (filters.maxAmount / 100).toString() : '',
    });
  }, [filters]);

  // Handle date picker
  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setLocalFilters(prev => ({
        ...prev,
        [datePicker.type === 'start' ? 'startDate' : 'endDate']: selectedDate,
      }));
    }
    setDatePicker(prev => ({ ...prev, show: false }));
  }, [datePicker.type]);

  // Show date picker
  const showDatePicker = useCallback((type: 'start' | 'end') => {
    const currentValue = type === 'start' ? localFilters.startDate : localFilters.endDate;
    setDatePicker({
      show: true,
      mode: 'date',
      type,
      value: currentValue || new Date(),
    });
  }, [localFilters.startDate, localFilters.endDate]);

  // Handle quick date filter
  const handleQuickDateFilter = useCallback((days: number) => {
    const endDate = new Date();
    const startDate = days === 0 ? new Date() : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    if (days === 0) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    setLocalFilters(prev => ({
      ...prev,
      startDate,
      endDate,
    }));
  }, []);

  // Handle status toggle
  const handleStatusToggle = useCallback((status: string) => {
    setLocalFilters(prev => {
      const currentStatus = prev.status || [];
      const newStatus = currentStatus.includes(status)
        ? currentStatus.filter(s => s !== status)
        : [...currentStatus, status];

      return {
        ...prev,
        status: newStatus.length > 0 ? newStatus : undefined,
      };
    });
  }, []);

  // Handle amount input change
  const handleAmountInputChange = useCallback((type: 'min' | 'max', value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    setAmountInputs(prev => ({
      ...prev,
      [`${type}Amount`]: numericValue,
    }));

    // Convert to cents for filters
    const amountInCents = parseFloat(numericValue) * 100;
    
    setLocalFilters(prev => ({
      ...prev,
      [`${type}Amount`]: numericValue ? amountInCents : undefined,
    }));
  }, []);

  // Handle search query change
  const handleSearchQueryChange = useCallback((value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      searchQuery: value || undefined,
    }));
  }, []);

  // Handle sort option change
  const handleSortChange = useCallback((sortBy: TransactionFiltersState['sortBy']) => {
    setLocalFilters(prev => ({
      ...prev,
      sortBy,
      // Toggle sort order if same field is selected
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    // Validate date range
    if (localFilters.startDate && localFilters.endDate && localFilters.startDate > localFilters.endDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    // Validate amount range
    if (localFilters.minAmount && localFilters.maxAmount && localFilters.minAmount > localFilters.maxAmount) {
      Alert.alert('Invalid Amount Range', 'Minimum amount must be less than maximum amount');
      return;
    }

    onFiltersChange(localFilters);
    onClose();

    logger.info('Transaction filters applied', {
      filters: localFilters,
      filtersCount: Object.keys(localFilters).filter(key => 
        localFilters[key as keyof TransactionFiltersState] !== undefined
      ).length,
    });
  }, [localFilters, onFiltersChange, onClose]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    const clearedFilters: TransactionFiltersState = {
      sortBy: 'date',
      sortOrder: 'desc',
    };
    
    setLocalFilters(clearedFilters);
    setAmountInputs({
      minAmount: '',
      maxAmount: '',
    });

    onFiltersChange(clearedFilters);
  }, [onFiltersChange]);

  // Count active filters
  const activeFiltersCount = Object.keys(localFilters).filter(key => {
    const value = localFilters[key as keyof TransactionFiltersState];
    if (key === 'sortBy' || key === 'sortOrder') return false; // Don't count sort as filter
    return value !== undefined && value !== null && 
      (Array.isArray(value) ? value.length > 0 : true);
  }).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <BlurView intensity={100} tint={theme} style={styles.modalOverlay}>
        <View style={[styles.filtersModal, theme === 'dark' && styles.filtersModalDark]}>
          {/* Header */}
          <View style={[styles.filtersHeader, theme === 'dark' && styles.filtersHeaderDark]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close filters"
              accessibilityRole="button"
            >
              <Ionicons
                name="close"
                size={24}
                color={theme === 'dark' ? '#D1D5DB' : '#6B7280'}
              />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text style={[styles.filtersTitle, theme === 'dark' && styles.filtersTitleDark]}>
                Filters
              </Text>
              {activeFiltersCount > 0 && (
                <View style={[styles.filtersBadge, theme === 'dark' && styles.filtersBadgeDark]}>
                  <Text style={styles.filtersBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.clearButton, theme === 'dark' && styles.clearButtonDark]}
              onPress={handleClearFilters}
              accessibilityLabel="Clear all filters"
              accessibilityRole="button"
            >
              <Text style={[styles.clearButtonText, theme === 'dark' && styles.clearButtonTextDark]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.filtersContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Search */}
            <View style={[styles.filterSection, theme === 'dark' && styles.filterSectionDark]}>
              <Text style={[styles.filterSectionTitle, theme === 'dark' && styles.filterSectionTitleDark]}>
                Search
              </Text>
              
              <View style={[styles.searchInputContainer, theme === 'dark' && styles.searchInputContainerDark]}>
                <Ionicons
                  name="search"
                  size={20}
                  color={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, theme === 'dark' && styles.searchInputDark]}
                  placeholder="Search businesses, receipts, or amounts..."
                  placeholderTextColor={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                  value={localFilters.searchQuery || ''}
                  onChangeText={handleSearchQueryChange}
                  clearButtonMode="while-editing"
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Date Range */}
            <View style={[styles.filterSection, theme === 'dark' && styles.filterSectionDark]}>
              <Text style={[styles.filterSectionTitle, theme === 'dark' && styles.filterSectionTitleDark]}>
                Date Range
              </Text>
              
              {/* Quick Date Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFilters}>
                {QUICK_DATE_FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter.label}
                    style={[styles.quickFilterButton, theme === 'dark' && styles.quickFilterButtonDark]}
                    onPress={() => handleQuickDateFilter(filter.days)}
                  >
                    <Text style={[styles.quickFilterText, theme === 'dark' && styles.quickFilterTextDark]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Date Inputs */}
              <View style={styles.dateInputs}>
                <TouchableOpacity
                  style={[styles.dateInput, theme === 'dark' && styles.dateInputDark]}
                  onPress={() => showDatePicker('start')}
                >
                  <Ionicons
                    name="calendar"
                    size={20}
                    color={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                  />
                  <Text style={[styles.dateInputText, theme === 'dark' && styles.dateInputTextDark]}>
                    {localFilters.startDate ? formatDate(localFilters.startDate.toISOString()) : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.dateInput, theme === 'dark' && styles.dateInputDark]}
                  onPress={() => showDatePicker('end')}
                >
                  <Ionicons
                    name="calendar"
                    size={20}
                    color={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                  />
                  <Text style={[styles.dateInputText, theme === 'dark' && styles.dateInputTextDark]}>
                    {localFilters.endDate ? formatDate(localFilters.endDate.toISOString()) : 'End Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Filter */}
            <View style={[styles.filterSection, theme === 'dark' && styles.filterSectionDark]}>
              <Text style={[styles.filterSectionTitle, theme === 'dark' && styles.filterSectionTitleDark]}>
                Transaction Status
              </Text>
              
              <View style={styles.statusOptions}>
                {STATUS_OPTIONS.map((status) => {
                  const isSelected = localFilters.status?.includes(status.value) || false;
                  
                  return (
                    <TouchableOpacity
                      key={status.value}
                      style={[
                        styles.statusOption,
                        isSelected && styles.statusOptionSelected,
                        theme === 'dark' && styles.statusOptionDark,
                        isSelected && theme === 'dark' && styles.statusOptionSelectedDark,
                      ]}
                      onPress={() => handleStatusToggle(status.value)}
                    >
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: status.color },
                          !isSelected && { opacity: 0.3 },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusOptionText,
                          isSelected && styles.statusOptionTextSelected,
                          theme === 'dark' && styles.statusOptionTextDark,
                          isSelected && theme === 'dark' && styles.statusOptionTextSelectedDark,
                        ]}
                      >
                        {status.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Amount Range */}
            <View style={[styles.filterSection, theme === 'dark' && styles.filterSectionDark]}>
              <Text style={[styles.filterSectionTitle, theme === 'dark' && styles.filterSectionTitleDark]}>
                Amount Range
              </Text>
              
              <View style={styles.amountInputs}>
                <View style={[styles.amountInputContainer, theme === 'dark' && styles.amountInputContainerDark]}>
                  <Text style={[styles.currencySymbol, theme === 'dark' && styles.currencySymbolDark]}>
                    $
                  </Text>
                  <TextInput
                    style={[styles.amountInput, theme === 'dark' && styles.amountInputDark]}
                    placeholder="Min"
                    placeholderTextColor={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                    value={amountInputs.minAmount}
                    onChangeText={(value) => handleAmountInputChange('min', value)}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
                
                <Text style={[styles.amountSeparator, theme === 'dark' && styles.amountSeparatorDark]}>
                  to
                </Text>
                
                <View style={[styles.amountInputContainer, theme === 'dark' && styles.amountInputContainerDark]}>
                  <Text style={[styles.currencySymbol, theme === 'dark' && styles.currencySymbolDark]}>
                    $
                  </Text>
                  <TextInput
                    style={[styles.amountInput, theme === 'dark' && styles.amountInputDark]}
                    placeholder="Max"
                    placeholderTextColor={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                    value={amountInputs.maxAmount}
                    onChangeText={(value) => handleAmountInputChange('max', value)}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>

            {/* Sort Options */}
            <View style={[styles.filterSection, theme === 'dark' && styles.filterSectionDark]}>
              <Text style={[styles.filterSectionTitle, theme === 'dark' && styles.filterSectionTitleDark]}>
                Sort By
              </Text>
              
              <View style={styles.sortOptions}>
                {SORT_OPTIONS.map((sort) => {
                  const isSelected = localFilters.sortBy === sort.value;
                  
                  return (
                    <TouchableOpacity
                      key={sort.value}
                      style={[
                        styles.sortOption,
                        isSelected && styles.sortOptionSelected,
                        theme === 'dark' && styles.sortOptionDark,
                        isSelected && theme === 'dark' && styles.sortOptionSelectedDark,
                      ]}
                      onPress={() => handleSortChange(sort.value as any)}
                    >
                      <Ionicons
                        name={sort.icon as any}
                        size={20}
                        color={
                          isSelected
                            ? (theme === 'dark' ? '#60A5FA' : '#3B82F6')
                            : (theme === 'dark' ? '#6B7280' : '#9CA3AF')
                        }
                      />
                      <Text
                        style={[
                          styles.sortOptionText,
                          isSelected && styles.sortOptionTextSelected,
                          theme === 'dark' && styles.sortOptionTextDark,
                          isSelected && theme === 'dark' && styles.sortOptionTextSelectedDark,
                        ]}
                      >
                        {sort.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name={localFilters.sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'}
                          size={20}
                          color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.filtersFooter, theme === 'dark' && styles.filtersFooterDark]}>
            <TouchableOpacity
              style={[styles.applyButton, theme === 'dark' && styles.applyButtonDark]}
              onPress={handleApplyFilters}
              accessibilityLabel="Apply filters"
              accessibilityRole="button"
            >
              <Text style={styles.applyButtonText}>
                Apply Filters
                {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          {datePicker.show && (
            <DateTimePicker
              value={datePicker.value}
              mode={datePicker.mode}
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
              textColor={theme === 'dark' ? '#F9FAFB' : '#111827'}
            />
          )}
        </View>
      </BlurView>
    </Modal>
  );
};