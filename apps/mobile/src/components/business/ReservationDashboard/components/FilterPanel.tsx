import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { FilterPanelProps, ReservationFilter } from '../types';
import { filterStyles as styles } from './FilterPanel.styles';

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onClose,
  theme = 'light',
  businessId
}) => {
  const [localFilters, setLocalFilters] = useState<ReservationFilter>(filters);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([]);

  // Load service types for the business
  useEffect(() => {
    loadServiceTypes();
  }, [businessId]);

  const loadServiceTypes = async () => {
    // Mock data - replace with actual API call
    const mockServiceTypes = [
      { id: 'haircut', name: 'Hair Cut' },
      { id: 'coloring', name: 'Hair Coloring' },
      { id: 'consultation', name: 'Consultation' },
      { id: 'styling', name: 'Hair Styling' }
    ];
    setServiceTypes(mockServiceTypes);
  };

  // Handle filter updates
  const updateFilter = (key: keyof ReservationFilter, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters and close panel
  const applyFilters = () => {
    onFilterChange(localFilters);
    onClose();
  };

  // Reset filters to default
  const resetFilters = () => {
    const defaultFilters: ReservationFilter = {
      status: 'all',
      dateRange: 'today',
      serviceType: 'all',
      sortBy: 'scheduledAt',
      sortOrder: 'desc'
    };
    setLocalFilters(defaultFilters);
  };

  // Handle date picker changes
  const handleDateChange = (type: 'start' | 'end', event: any, selectedDate?: Date) => {
    setShowDatePicker(null);
    if (selectedDate) {
      const customDateRange = localFilters.customDateRange || {
        startDate: new Date(),
        endDate: new Date()
      };
      
      if (type === 'start') {
        customDateRange.startDate = selectedDate;
      } else {
        customDateRange.endDate = selectedDate;
      }
      
      updateFilter('customDateRange', customDateRange);
      updateFilter('dateRange', 'custom');
    }
  };

  // Render filter section header
  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[
        styles.sectionTitle,
        theme === 'dark' && styles.sectionTitleDark
      ]}>
        {title}
      </Text>
    </View>
  );

  // Render status filter
  const renderStatusFilter = () => {
    const statusOptions = [
      { value: 'all', label: 'All Statuses' },
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'expired', label: 'Expired' }
    ];

    return (
      <View style={styles.filterSection}>
        {renderSectionHeader('Status', '📋')}
        <View style={styles.optionsGrid}>
          {statusOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                localFilters.status === option.value && styles.optionButtonSelected,
                theme === 'dark' && styles.optionButtonDark
              ]}
              onPress={() => updateFilter('status', option.value)}
            >
              <Text style={[
                styles.optionText,
                localFilters.status === option.value && styles.optionTextSelected,
                theme === 'dark' && styles.optionTextDark
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render date range filter
  const renderDateRangeFilter = () => {
    const dateRangeOptions = [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: 'tomorrow', label: 'Tomorrow' },
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' },
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'past', label: 'Past' },
      { value: 'custom', label: 'Custom Range' }
    ];

    return (
      <View style={styles.filterSection}>
        {renderSectionHeader('Date Range', '📅')}
        <View style={styles.optionsGrid}>
          {dateRangeOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                localFilters.dateRange === option.value && styles.optionButtonSelected,
                theme === 'dark' && styles.optionButtonDark
              ]}
              onPress={() => updateFilter('dateRange', option.value)}
            >
              <Text style={[
                styles.optionText,
                localFilters.dateRange === option.value && styles.optionTextSelected,
                theme === 'dark' && styles.optionTextDark
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom date range pickers */}
        {localFilters.dateRange === 'custom' && (
          <View style={styles.customDateRange}>
            <TouchableOpacity
              style={[
                styles.datePickerButton,
                theme === 'dark' && styles.datePickerButtonDark
              ]}
              onPress={() => setShowDatePicker('start')}
            >
              <Text style={styles.datePickerLabel}>From:</Text>
              <Text style={[
                styles.datePickerText,
                theme === 'dark' && styles.datePickerTextDark
              ]}>
                {localFilters.customDateRange?.startDate.toLocaleDateString() || 'Select Date'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.datePickerButton,
                theme === 'dark' && styles.datePickerButtonDark
              ]}
              onPress={() => setShowDatePicker('end')}
            >
              <Text style={styles.datePickerLabel}>To:</Text>
              <Text style={[
                styles.datePickerText,
                theme === 'dark' && styles.datePickerTextDark
              ]}>
                {localFilters.customDateRange?.endDate.toLocaleDateString() || 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render service type filter
  const renderServiceTypeFilter = () => {
    const allServiceTypes = [
      { id: 'all', name: 'All Services' },
      ...serviceTypes
    ];

    return (
      <View style={styles.filterSection}>
        {renderSectionHeader('Service Type', '🔧')}
        <View style={styles.optionsGrid}>
          {allServiceTypes.map(service => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.optionButton,
                localFilters.serviceType === service.id && styles.optionButtonSelected,
                theme === 'dark' && styles.optionButtonDark
              ]}
              onPress={() => updateFilter('serviceType', service.id)}
            >
              <Text style={[
                styles.optionText,
                localFilters.serviceType === service.id && styles.optionTextSelected,
                theme === 'dark' && styles.optionTextDark
              ]}>
                {service.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render sorting options
  const renderSortingOptions = () => {
    const sortByOptions = [
      { value: 'scheduledAt', label: 'Scheduled Time' },
      { value: 'createdAt', label: 'Created Date' },
      { value: 'customerName', label: 'Customer Name' },
      { value: 'totalAmount', label: 'Amount' },
      { value: 'status', label: 'Status' }
    ];

    return (
      <View style={styles.filterSection}>
        {renderSectionHeader('Sort By', '🔄')}
        
        {/* Sort by field */}
        <View style={styles.sortOptions}>
          <Text style={[
            styles.sortLabel,
            theme === 'dark' && styles.sortLabelDark
          ]}>
            Field:
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortButtonsContainer}
          >
            {sortByOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortButton,
                  localFilters.sortBy === option.value && styles.sortButtonSelected,
                  theme === 'dark' && styles.sortButtonDark
                ]}
                onPress={() => updateFilter('sortBy', option.value)}
              >
                <Text style={[
                  styles.sortButtonText,
                  localFilters.sortBy === option.value && styles.sortButtonTextSelected,
                  theme === 'dark' && styles.sortButtonTextDark
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sort order toggle */}
        <View style={styles.sortOrderRow}>
          <Text style={[
            styles.sortLabel,
            theme === 'dark' && styles.sortLabelDark
          ]}>
            Order:
          </Text>
          <View style={styles.sortOrderToggle}>
            <TouchableOpacity
              style={[
                styles.sortOrderButton,
                localFilters.sortOrder === 'asc' && styles.sortOrderButtonSelected
              ]}
              onPress={() => updateFilter('sortOrder', 'asc')}
            >
              <Text style={[
                styles.sortOrderText,
                localFilters.sortOrder === 'asc' && styles.sortOrderTextSelected
              ]}>
                ↑ Ascending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortOrderButton,
                localFilters.sortOrder === 'desc' && styles.sortOrderButtonSelected
              ]}
              onPress={() => updateFilter('sortOrder', 'desc')}
            >
              <Text style={[
                styles.sortOrderText,
                localFilters.sortOrder === 'desc' && styles.sortOrderTextSelected
              ]}>
                ↓ Descending
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render search filter
  const renderSearchFilter = () => (
    <View style={styles.filterSection}>
      {renderSectionHeader('Search', '🔍')}
      <TextInput
        style={[
          styles.searchInput,
          theme === 'dark' && styles.searchInputDark
        ]}
        placeholder="Search by customer name, email, or notes..."
        placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
        value={localFilters.searchQuery || ''}
        onChangeText={(text) => updateFilter('searchQuery', text)}
      />
    </View>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      theme === 'dark' && styles.containerDark
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[
            styles.headerTitle,
            theme === 'dark' && styles.headerTitleDark
          ]}>
            Filter Reservations
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetFilters}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderSearchFilter()}
        {renderStatusFilter()}
        {renderDateRangeFilter()}
        {renderServiceTypeFilter()}
        {renderSortingOptions()}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, styles.cancelButton]}
          onPress={onClose}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerButton, styles.applyButton]}
          onPress={applyFilters}
        >
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === 'start' 
              ? localFilters.customDateRange?.startDate || new Date()
              : localFilters.customDateRange?.endDate || new Date()
          }
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(showDatePicker, event, date)}
        />
      )}
    </SafeAreaView>
  );
};