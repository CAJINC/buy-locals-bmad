import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Icon,
  Button,
  Badge,
  Text,
  Pressable,
  ScrollView,
  Select,
  CheckIcon,
  Slider,
  Modal,
  Divider,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { ServiceSearchProps, ServiceFilters, EnhancedService } from './types';

// Custom hook for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const ServiceSearch: React.FC<ServiceSearchProps> = React.memo(({
  services,
  categories = [],
  onFiltersChange,
  onSearchChange,
  showCategoryFilter = true,
  showPriceFilter = true,
  showAvailabilityFilter = true,
  searchPlaceholder = 'Search services...',
}) => {
  // Filter state
  const [filters, setFilters] = useState<ServiceFilters>({
    searchQuery: '',
    selectedCategories: [],
    priceRange: { min: undefined, max: undefined },
    availability: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Debounced search query
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  // Memoized price range from services
  const priceRange = useMemo(() => {
    const prices = services
      .filter(service => service.pricing.type === 'exact' && service.pricing.amount)
      .map(service => service.pricing.amount!)
      .filter(price => price > 0);

    if (prices.length === 0) {
      return { min: 0, max: 1000 };
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [services]);

  // Update search query in filters when debounced value changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, searchQuery: debouncedSearchQuery }));
    onSearchChange?.(debouncedSearchQuery);
  }, [debouncedSearchQuery, onSearchChange]);

  // Filter and sort services
  const filteredServices = useMemo(() => {
    let result = [...services];

    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      result = result.filter(service =>
        service.name.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.selectedCategories.length > 0) {
      result = result.filter(service =>
        filters.selectedCategories.includes(service.category)
      );
    }

    // Apply availability filter
    if (filters.availability !== 'all') {
      result = result.filter(service => service.availability === filters.availability);
    }

    // Apply price range filter
    if (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined) {
      result = result.filter(service => {
        if (service.pricing.type === 'exact' && service.pricing.amount) {
          const price = service.pricing.amount;
          const minCheck = filters.priceRange.min === undefined || price >= filters.priceRange.min;
          const maxCheck = filters.priceRange.max === undefined || price <= filters.priceRange.max;
          return minCheck && maxCheck;
        }
        if (service.pricing.type === 'range') {
          const avgPrice = ((service.pricing.minAmount || 0) + (service.pricing.maxAmount || 0)) / 2;
          const minCheck = filters.priceRange.min === undefined || avgPrice >= filters.priceRange.min;
          const maxCheck = filters.priceRange.max === undefined || avgPrice <= filters.priceRange.max;
          return minCheck && maxCheck;
        }
        return true; // Include quote-based services
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          const priceA = a.pricing.type === 'exact' ? (a.pricing.amount || 0) : 
                        a.pricing.type === 'range' ? ((a.pricing.minAmount || 0) + (a.pricing.maxAmount || 0)) / 2 : 0;
          const priceB = b.pricing.type === 'exact' ? (b.pricing.amount || 0) : 
                        b.pricing.type === 'range' ? ((b.pricing.minAmount || 0) + (b.pricing.maxAmount || 0)) / 2 : 0;
          comparison = priceA - priceB;
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [services, filters]);

  // Update parent component when filtered services change
  useEffect(() => {
    onFiltersChange(filteredServices);
  }, [filteredServices, onFiltersChange]);

  // Category management
  const toggleCategory = useCallback((categoryName: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryName)
        ? prev.selectedCategories.filter(c => c !== categoryName)
        : [...prev.selectedCategories, categoryName]
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      selectedCategories: [],
      priceRange: { min: undefined, max: undefined },
      availability: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    setLocalSearchQuery('');
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery.trim()) count++;
    if (filters.selectedCategories.length > 0) count++;
    if (filters.availability !== 'all') count++;
    if (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined) count++;
    return count;
  }, [filters]);

  return (
    <VStack space={3}>
      {/* Search Input */}
      <HStack space={2}>
        <Input
          flex={1}
          placeholder={searchPlaceholder}
          value={localSearchQuery}
          onChangeText={setLocalSearchQuery}
          InputLeftElement={
            <Icon as={MaterialIcons} name="search" size="md" ml={3} color="gray.400" />
          }
          InputRightElement={
            localSearchQuery ? (
              <Pressable onPress={() => setLocalSearchQuery('')}>
                <Icon as={MaterialIcons} name="clear" size="md" mr={3} color="gray.400" />
              </Pressable>
            ) : undefined
          }
          bg="gray.50"
          borderColor="gray.300"
          borderRadius="full"
          fontSize="md"
        />
        
        <Button
          variant="outline"
          borderRadius="full"
          leftIcon={<Icon as={MaterialIcons} name="filter-list" />}
          onPress={() => setShowFilters(true)}
          colorScheme="blue"
          size="md"
        >
          Filter
          {activeFilterCount > 0 && (
            <Badge
              colorScheme="red"
              variant="solid"
              borderRadius="full"
              position="absolute"
              top={-2}
              right={-2}
              minW={5}
              h={5}
              _text={{ fontSize: 'xs' }}
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </HStack>

      {/* Quick Category Filters */}
      {showCategoryFilter && categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack space={2} px={1} py={1}>
            {categories.map(category => {
              const isSelected = filters.selectedCategories.includes(category.name);
              return (
                <Pressable key={category.id} onPress={() => toggleCategory(category.name)}>
                  <Badge
                    colorScheme={isSelected ? 'blue' : 'gray'}
                    variant={isSelected ? 'solid' : 'outline'}
                    borderRadius="full"
                    px={3}
                    py={2}
                  >
                    <HStack space={1} alignItems="center">
                      {category.icon && (
                        <Icon as={MaterialIcons} name={category.icon} size="xs" />
                      )}
                      <Text fontSize="sm" fontWeight="medium">
                        {category.name}
                      </Text>
                    </HStack>
                  </Badge>
                </Pressable>
              );
            })}
          </HStack>
        </ScrollView>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <HStack space={2} alignItems="center" flexWrap="wrap">
          <Text fontSize="sm" color="gray.600">
            Active filters:
          </Text>
          
          {filters.selectedCategories.map(category => (
            <Badge key={category} colorScheme="blue" variant="subtle" borderRadius="full">
              <HStack space={1} alignItems="center">
                <Text fontSize="xs">{category}</Text>
                <Pressable onPress={() => toggleCategory(category)}>
                  <Icon as={MaterialIcons} name="close" size="xs" />
                </Pressable>
              </HStack>
            </Badge>
          ))}
          
          {filters.availability !== 'all' && (
            <Badge colorScheme="green" variant="subtle" borderRadius="full">
              <HStack space={1} alignItems="center">
                <Text fontSize="xs">{filters.availability}</Text>
                <Pressable onPress={() => setFilters(prev => ({ ...prev, availability: 'all' }))}>
                  <Icon as={MaterialIcons} name="close" size="xs" />
                </Pressable>
              </HStack>
            </Badge>
          )}
          
          <Button size="xs" variant="ghost" onPress={clearFilters}>
            Clear All
          </Button>
        </HStack>
      )}

      {/* Filter Modal */}
      <Modal isOpen={showFilters} onClose={() => setShowFilters(false)} size="full">
        <Modal.Content maxH="90%">
          <Modal.CloseButton />
          <Modal.Header>Filter Services</Modal.Header>
          <Modal.Body>
            <ScrollView>
              <VStack space={6}>
                {/* Sorting */}
                <VStack space={3}>
                  <Text fontWeight="bold" color="gray.800">
                    Sort By
                  </Text>
                  <HStack space={2}>
                    <Select
                      flex={1}
                      selectedValue={filters.sortBy}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as any }))}
                      accessibilityLabel="Sort by"
                      _selectedItem={{
                        bg: 'blue.100',
                        endIcon: <CheckIcon size={3} />,
                      }}
                    >
                      <Select.Item label="Name" value="name" />
                      <Select.Item label="Price" value="price" />
                      <Select.Item label="Duration" value="duration" />
                      <Select.Item label="Category" value="category" />
                    </Select>
                    
                    <Button
                      variant="outline"
                      onPress={() => setFilters(prev => ({ 
                        ...prev, 
                        sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                      }))}
                      leftIcon={
                        <Icon 
                          as={MaterialIcons} 
                          name={filters.sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} 
                        />
                      }
                    >
                      {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    </Button>
                  </HStack>
                </VStack>

                <Divider />

                {/* Availability Filter */}
                {showAvailabilityFilter && (
                  <>
                    <VStack space={3}>
                      <Text fontWeight="bold" color="gray.800">
                        Availability
                      </Text>
                      <Select
                        selectedValue={filters.availability}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, availability: value as any }))}
                        accessibilityLabel="Filter by availability"
                        _selectedItem={{
                          bg: 'green.100',
                          endIcon: <CheckIcon size={3} />,
                        }}
                      >
                        <Select.Item label="All" value="all" />
                        <Select.Item label="Available" value="available" />
                        <Select.Item label="Busy" value="busy" />
                        <Select.Item label="Unavailable" value="unavailable" />
                      </Select>
                    </VStack>
                    
                    <Divider />
                  </>
                )}

                {/* Price Range Filter */}
                {showPriceFilter && priceRange.max > priceRange.min && (
                  <VStack space={3}>
                    <Text fontWeight="bold" color="gray.800">
                      Price Range
                    </Text>
                    <VStack space={4}>
                      <HStack justifyContent="space-between">
                        <Text fontSize="sm" color="gray.600">
                          ${filters.priceRange.min || priceRange.min}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          ${filters.priceRange.max || priceRange.max}
                        </Text>
                      </HStack>
                      
                      <Box px={2}>
                        <Slider
                          defaultValue={[filters.priceRange.min || priceRange.min, filters.priceRange.max || priceRange.max]}
                          minValue={priceRange.min}
                          maxValue={priceRange.max}
                          step={Math.ceil((priceRange.max - priceRange.min) / 100)}
                          onChange={(values) => {
                            setFilters(prev => ({
                              ...prev,
                              priceRange: {
                                min: values[0],
                                max: values[1],
                              }
                            }));
                          }}
                        >
                          <Slider.Track>
                            <Slider.FilledTrack />
                          </Slider.Track>
                          <Slider.Thumb />
                        </Slider>
                      </Box>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setFilters(prev => ({ ...prev, priceRange: { min: undefined, max: undefined } }))}
                      >
                        Reset Price Range
                      </Button>
                    </VStack>
                  </VStack>
                )}
              </VStack>
            </ScrollView>
          </Modal.Body>
          <Modal.Footer>
            <HStack space={2} w="100%">
              <Button flex={1} variant="outline" onPress={clearFilters}>
                Clear All
              </Button>
              <Button flex={1} onPress={() => setShowFilters(false)}>
                Apply Filters
              </Button>
            </HStack>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Results Count */}
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontSize="sm" color="gray.600">
          {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} found
        </Text>
        
        {filters.searchQuery.trim() && (
          <Text fontSize="sm" color="blue.600">
            for "{filters.searchQuery}"
          </Text>
        )}
      </HStack>
    </VStack>
  );
});

ServiceSearch.displayName = 'ServiceSearch';