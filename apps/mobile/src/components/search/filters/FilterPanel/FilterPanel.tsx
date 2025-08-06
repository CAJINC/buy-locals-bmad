import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FilterChips } from '../FilterChips/FilterChips';
import { CategoryFilter } from '../CategoryFilter/CategoryFilter';
import { RangeFilters } from '../RangeFilters/RangeFilters';
import { FilterDropdown } from '../FilterDropdown/FilterDropdown';
import { FilterPresets } from '../FilterPresets/FilterPresets';
import { FilterSummary } from '../FilterSummary/FilterSummary';
import { FilterPanelProps, FilterState, FilterSection } from './types';
import { DEFAULT_FILTER_STATE, FILTER_SECTIONS, FILTER_PRESETS } from './constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters = DEFAULT_FILTER_STATE,
  onFiltersChange,
  onClose,
  visible = false,
  resultCount = 0,
  isLoading = false,
  location,
  categories = [],
  onCategoryPress,
  theme = {
    primaryColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F8F9FA',
    textColor: '#000000',
    borderColor: '#E0E0E0',
  },
  style,
  testID = 'filter-panel',
}) => {
  // State for controlling sections and animations
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['categories']) // Categories expanded by default
  );
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [searchableFilter, setSearchableFilter] = useState<string>('');
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Memoized filter counts
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000)) count++;
    if (filters.distance && filters.distance.radius < 25) count++;
    if (filters.rating && filters.rating.minimum > 0) count++;
    if (filters.hours?.openNow) count++;
    if (filters.features.length > 0) count++;
    return count;
  }, [filters]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT - MODAL_HEIGHT,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropOpacity]);

  // Event handlers
  const handleSectionToggle = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const handleFilterUpdate = useCallback((updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      onFiltersChange({ ...DEFAULT_FILTER_STATE, ...preset.filters });
    }
  }, [onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setActivePreset(null);
    onFiltersChange(DEFAULT_FILTER_STATE);
  }, [onFiltersChange]);

  const handleApplyFilters = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  // Render section content
  const renderSectionContent = useCallback((section: FilterSection) => {
    if (!expandedSections.has(section.id)) return null;

    switch (section.id) {
      case 'categories':
        return (
          <CategoryFilter
            selectedCategories={filters.categories}
            onCategoriesChange={(categories) => handleFilterUpdate({ categories })}
            availableCategories={categories}
            onCategoryPress={onCategoryPress}
            theme={theme}
          />
        );
      
      case 'location':
        return (
          <RangeFilters
            distance={filters.distance}
            onDistanceChange={(distance) => handleFilterUpdate({ distance })}
            location={location}
            theme={theme}
          />
        );
      
      case 'price':
        return (
          <RangeFilters
            priceRange={filters.priceRange}
            onPriceRangeChange={(priceRange) => handleFilterUpdate({ priceRange })}
            theme={theme}
          />
        );
      
      case 'rating':
        return (
          <RangeFilters
            rating={filters.rating}
            onRatingChange={(rating) => handleFilterUpdate({ rating })}
            theme={theme}
          />
        );
      
      case 'hours':
        return (
          <FilterDropdown
            title="Business Hours"
            options={[
              { id: 'open_now', label: 'Open Now', selected: filters.hours?.openNow || false },
              { id: 'open_24_7', label: 'Open 24/7', selected: filters.hours?.specificHours === '24/7' },
            ]}
            onSelectionChange={(selections) => {
              const openNow = selections.includes('open_now');
              const is24_7 = selections.includes('open_24_7');
              handleFilterUpdate({
                hours: {
                  openNow,
                  specificHours: is24_7 ? '24/7' : undefined,
                },
              });
            }}
            theme={theme}
          />
        );
      
      case 'features':
        return (
          <FilterDropdown
            title="Features"
            searchable
            options={[
              { id: 'photos', label: 'Has Photos', selected: filters.features.includes('photos') },
              { id: 'reviews', label: 'Has Reviews', selected: filters.features.includes('reviews') },
              { id: 'verified', label: 'Verified Business', selected: filters.features.includes('verified') },
              { id: 'wheelchair_accessible', label: 'Wheelchair Accessible', selected: filters.features.includes('wheelchair_accessible') },
              { id: 'parking', label: 'Parking Available', selected: filters.features.includes('parking') },
              { id: 'wifi', label: 'WiFi', selected: filters.features.includes('wifi') },
              { id: 'delivery', label: 'Delivery Available', selected: filters.features.includes('delivery') },
              { id: 'outdoor_seating', label: 'Outdoor Seating', selected: filters.features.includes('outdoor_seating') },
            ]}
            onSelectionChange={(selections) => handleFilterUpdate({ features: selections })}
            searchQuery={searchableFilter}
            onSearchChange={setSearchableFilter}
            theme={theme}
          />
        );
      
      default:
        return null;
    }
  }, [expandedSections, filters, handleFilterUpdate, categories, onCategoryPress, location, theme, searchableFilter]);

  const renderFilterSection = useCallback((section: FilterSection) => {
    const isExpanded = expandedSections.has(section.id);
    const sectionHasActiveFilters = useMemo(() => {
      switch (section.id) {
        case 'categories': return filters.categories.length > 0;
        case 'location': return filters.distance && filters.distance.radius < 25;
        case 'price': return filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000);
        case 'rating': return filters.rating && filters.rating.minimum > 0;
        case 'hours': return filters.hours?.openNow || filters.hours?.specificHours;
        case 'features': return filters.features.length > 0;
        default: return false;
      }
    }, [filters, section.id]);

    return (
      <View key={section.id} style={styles.section}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            sectionHasActiveFilters && { borderLeftColor: theme.primaryColor, borderLeftWidth: 3 }
          ]}
          onPress={() => handleSectionToggle(section.id)}
          activeOpacity={0.7}
          testID={`${testID}-section-${section.id}`}
        >
          <View style={styles.sectionHeaderContent}>
            <Icon
              name={section.icon}
              size={20}
              color={sectionHasActiveFilters ? theme.primaryColor : '#666'}
              style={styles.sectionIcon}
            />
            <Text style={[
              styles.sectionTitle,
              sectionHasActiveFilters && { color: theme.primaryColor, fontWeight: '600' }
            ]}>
              {section.title}
            </Text>
            {sectionHasActiveFilters && (
              <View style={[styles.activeBadge, { backgroundColor: theme.primaryColor }]}>
                <Text style={styles.activeBadgeText}>•</Text>
              </View>
            )}
          </View>
          <Icon
            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>

        {renderSectionContent(section)}
      </View>
    );
  }, [expandedSections, handleSectionToggle, renderSectionContent, filters, theme, testID]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity }
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        {/* Filter Panel */}
        <Animated.View
          style={[
            styles.filterPanel,
            { 
              backgroundColor: theme.backgroundColor,
              transform: [{ translateY: slideAnim }]
            },
            style
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.headerTitle, { color: theme.textColor }]}>
                  Filters
                </Text>
                {activeFilterCount > 0 && (
                  <View style={[styles.filterCountBadge, { backgroundColor: theme.primaryColor }]}>
                    <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearFilters}
                  disabled={activeFilterCount === 0}
                  testID={`${testID}-clear`}
                >
                  <Text style={[
                    styles.clearButtonText,
                    { color: activeFilterCount > 0 ? theme.primaryColor : '#999' }
                  ]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  testID={`${testID}-close`}
                >
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <View style={styles.chipsContainer}>
                <FilterChips
                  filters={filters}
                  onFilterRemove={(filterType, value) => {
                    // Handle individual filter removal
                    const updates: Partial<FilterState> = {};
                    
                    switch (filterType) {
                      case 'category':
                        updates.categories = filters.categories.filter(c => c !== value);
                        break;
                      case 'feature':
                        updates.features = filters.features.filter(f => f !== value);
                        break;
                      case 'price':
                        updates.priceRange = { min: 0, max: 1000 };
                        break;
                      case 'distance':
                        updates.distance = { radius: 25, unit: 'km' };
                        break;
                      case 'rating':
                        updates.rating = { minimum: 0 };
                        break;
                      case 'hours':
                        updates.hours = { openNow: false };
                        break;
                    }
                    
                    handleFilterUpdate(updates);
                  }}
                  theme={theme}
                  testID={`${testID}-chips`}
                />
              </View>
            )}

            {/* Filter Presets */}
            <View style={styles.presetsContainer}>
              <FilterPresets
                presets={FILTER_PRESETS}
                activePresetId={activePreset}
                onPresetSelect={handlePresetSelect}
                theme={theme}
                testID={`${testID}-presets`}
              />
            </View>

            {/* Filter Sections */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {FILTER_SECTIONS.map(renderFilterSection)}
            </ScrollView>

            {/* Footer with Results Summary */}
            <View style={[styles.footer, { borderTopColor: theme.borderColor, backgroundColor: theme.surfaceColor }]}>
              <FilterSummary
                resultCount={resultCount}
                isLoading={isLoading}
                appliedFilters={filters}
                theme={theme}
                testID={`${testID}-summary`}
              />
              
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: theme.primaryColor }]}
                onPress={handleApplyFilters}
                disabled={isLoading}
                testID={`${testID}-apply`}
              >
                <Text style={styles.applyButtonText}>
                  {isLoading ? 'Searching...' : `View ${resultCount.toLocaleString()} Results`}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  backdropTouch: {
    flex: 1,
  },
  filterPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  filterCountBadge: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 16,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  presetsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  activeBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  activeBadgeText: {
    color: 'transparent',
    fontSize: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  applyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});