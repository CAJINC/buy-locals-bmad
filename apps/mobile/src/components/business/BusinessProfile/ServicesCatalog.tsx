import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FlatList,
  Heading,
  Spinner,
  Center,
  Badge,
  Pressable,
  Icon,
  Divider,
  Button,
  Alert,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { ListRenderItem, RefreshControl } from 'react-native';
import { ServicesCatalogProps, EnhancedService, ServiceCategory } from './types';
import { ServiceItem } from './ServiceItem';
import { ServiceSearch } from './ServiceSearch';

// Category color scheme mapping
const categoryColors = [
  'blue', 'green', 'purple', 'orange', 'red', 'teal', 'cyan', 'pink', 'indigo', 'yellow'
];

export const ServicesCatalog: React.FC<ServicesCatalogProps> = React.memo(({
  services,
  categories = [],
  businessName,
  onServicePress,
  onBookService,
  showCategories = true,
  showSearch = true,
  showAvailabilityFilter = true,
  enableBooking = true,
  isLoading = false,
}) => {
  const [filteredServices, setFilteredServices] = useState<EnhancedService[]>(services);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-generate categories if not provided
  const autoCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    
    const categoryMap = new Map<string, ServiceCategory>();
    
    services.forEach(service => {
      if (!categoryMap.has(service.category)) {
        categoryMap.set(service.category, {
          id: service.category,
          name: service.category,
          color: categoryColors[categoryMap.size % categoryColors.length],
          serviceCount: 0,
        });
      }
      categoryMap.get(service.category)!.serviceCount!++;
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => 
      (b.serviceCount || 0) - (a.serviceCount || 0)
    );
  }, [categories, services]);

  // Filter services by selected category
  const categoryFilteredServices = useMemo(() => {
    if (!selectedCategory) return filteredServices;
    return filteredServices.filter(service => service.category === selectedCategory);
  }, [filteredServices, selectedCategory]);

  // Group services by category for display
  const groupedServices = useMemo(() => {
    const groups = new Map<string, EnhancedService[]>();
    
    categoryFilteredServices.forEach(service => {
      if (!groups.has(service.category)) {
        groups.set(service.category, []);
      }
      groups.get(service.category)!.push(service);
    });
    
    return Array.from(groups.entries()).map(([categoryName, categoryServices]) => ({
      category: autoCategories.find(c => c.name === categoryName) || {
        id: categoryName,
        name: categoryName,
        color: 'gray',
        serviceCount: categoryServices.length,
      },
      services: categoryServices,
    }));
  }, [categoryFilteredServices, autoCategories]);

  // Statistics
  const stats = useMemo(() => {
    const totalServices = services.length;
    const availableServices = services.filter(s => s.availability === 'available').length;
    const bookableServices = services.filter(s => s.bookingEnabled && s.availability === 'available').length;
    
    return {
      total: totalServices,
      available: availableServices,
      bookable: bookableServices,
    };
  }, [services]);

  // Handle service press
  const handleServicePress = useCallback((service: EnhancedService) => {
    onServicePress?.(service);
  }, [onServicePress]);

  // Handle booking
  const handleBookService = useCallback((service: EnhancedService) => {
    if (!service.bookingEnabled || service.availability !== 'available') {
      return;
    }
    onBookService?.(service);
  }, [onBookService]);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilteredServices: EnhancedService[]) => {
    setFilteredServices(newFilteredServices);
  }, []);

  // Handle category selection
  const handleCategoryPress = useCallback((categoryName: string) => {
    setSelectedCategory(prev => prev === categoryName ? null : categoryName);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Render service item
  const renderServiceItem: ListRenderItem<EnhancedService> = useCallback(({ item }) => (
    <ServiceItem
      service={item}
      onPress={handleServicePress}
      onBook={handleBookService}
      showBookingButton={enableBooking}
      compact={viewMode === 'grid'}
    />
  ), [handleServicePress, handleBookService, enableBooking, viewMode]);

  // Render category section
  const renderCategorySection = ({ category, services: categoryServices }: { category: ServiceCategory; services: EnhancedService[] }) => (
    <VStack key={category.id} space={3} mb={6}>
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2} alignItems="center">
          <Heading size="md" color="gray.800">
            {category.name}
          </Heading>
          <Badge
            colorScheme={category.color}
            variant="subtle"
            borderRadius="full"
          >
            {categoryServices.length}
          </Badge>
        </HStack>
        
        {categoryServices.length > 3 && (
          <Button
            size="sm"
            variant="ghost"
            colorScheme="blue"
            onPress={() => handleCategoryPress(category.name)}
          >
            View All
          </Button>
        )}
      </HStack>
      
      <VStack space={3}>
        {(categoryServices.length > 3 ? categoryServices.slice(0, 3) : categoryServices).map(service => (
          <ServiceItem
            key={service.id}
            service={service}
            onPress={handleServicePress}
            onBook={handleBookService}
            showBookingButton={enableBooking}
            compact={false}
          />
        ))}
      </VStack>
    </VStack>
  );

  // Loading state
  if (isLoading) {
    return (
      <Center flex={1} py={10}>
        <VStack space={4} alignItems="center">
          <Spinner size="lg" color="blue.500" />
          <Text color="gray.600">Loading services...</Text>
        </VStack>
      </Center>
    );
  }

  // Empty state
  if (services.length === 0) {
    return (
      <Center py={10}>
        <VStack space={4} alignItems="center" maxW="80%">
          <Icon as={MaterialIcons} name="business-center" size="4xl" color="gray.400" />
          <Heading size="md" color="gray.600" textAlign="center">
            No Services Available
          </Heading>
          <Text color="gray.500" textAlign="center" fontSize="sm">
            {businessName ? `${businessName} hasn't added any services yet.` : 'This business hasn\'t added any services yet.'}
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <VStack space={4} flex={1}>
      {/* Header with Stats */}
      <VStack space={3}>
        <HStack justifyContent="space-between" alignItems="center">
          <Heading size="lg" color="gray.800">
            Services & Products
          </Heading>
          
          <HStack space={2}>
            <Pressable
              onPress={() => setViewMode('list')}
              p={2}
              borderRadius="md"
              bg={viewMode === 'list' ? 'blue.100' : 'transparent'}
            >
              <Icon
                as={MaterialIcons}
                name="view-list"
                size="md"
                color={viewMode === 'list' ? 'blue.600' : 'gray.500'}
              />
            </Pressable>
            
            <Pressable
              onPress={() => setViewMode('grid')}
              p={2}
              borderRadius="md"
              bg={viewMode === 'grid' ? 'blue.100' : 'transparent'}
            >
              <Icon
                as={MaterialIcons}
                name="view-module"
                size="md"
                color={viewMode === 'grid' ? 'blue.600' : 'gray.500'}
              />
            </Pressable>
          </HStack>
        </HStack>
        
        {/* Service Statistics */}
        <HStack space={4} justifyContent="space-around" bg="gray.50" p={3} borderRadius="lg">
          <VStack alignItems="center" space={1}>
            <Text fontWeight="bold" fontSize="lg" color="blue.600">
              {stats.total}
            </Text>
            <Text fontSize="xs" color="gray.600">
              Total
            </Text>
          </VStack>
          
          <Divider orientation="vertical" />
          
          <VStack alignItems="center" space={1}>
            <Text fontWeight="bold" fontSize="lg" color="green.600">
              {stats.available}
            </Text>
            <Text fontSize="xs" color="gray.600">
              Available
            </Text>
          </VStack>
          
          <Divider orientation="vertical" />
          
          <VStack alignItems="center" space={1}>
            <Text fontWeight="bold" fontSize="lg" color="purple.600">
              {stats.bookable}
            </Text>
            <Text fontSize="xs" color="gray.600">
              Bookable
            </Text>
          </VStack>
        </HStack>
      </VStack>

      {/* Search and Filters */}
      {showSearch && (
        <ServiceSearch
          services={services}
          categories={autoCategories}
          onFiltersChange={handleFiltersChange}
          showCategoryFilter={showCategories}
          showAvailabilityFilter={showAvailabilityFilter}
          searchPlaceholder={`Search services${businessName ? ` at ${businessName}` : ''}...`}
        />
      )}

      {/* Category Filter Chips */}
      {showCategories && autoCategories.length > 0 && !selectedCategory && (
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Browse by Category:
          </Text>
          <FlatList
            data={autoCategories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item: category }) => (
              <Pressable onPress={() => handleCategoryPress(category.name)} mr={2}>
                <Badge
                  colorScheme={category.color}
                  variant="outline"
                  borderRadius="full"
                  px={3}
                  py={2}
                >
                  <HStack space={2} alignItems="center">
                    <Text fontSize="sm" fontWeight="medium">
                      {category.name}
                    </Text>
                    <Badge
                      colorScheme={category.color}
                      variant="solid"
                      borderRadius="full"
                      minW={5}
                      h={5}
                      _text={{ fontSize: 'xs' }}
                    >
                      {category.serviceCount}
                    </Badge>
                  </HStack>
                </Badge>
              </Pressable>
            )}
          />
        </Box>
      )}

      {/* Selected Category Header */}
      {selectedCategory && (
        <HStack justifyContent="space-between" alignItems="center" bg="blue.50" p={3} borderRadius="lg">
          <HStack space={2} alignItems="center">
            <Icon as={MaterialIcons} name="category" color="blue.600" />
            <Text fontWeight="medium" color="blue.800">
              {selectedCategory} Services
            </Text>
          </HStack>
          
          <Button
            size="sm"
            variant="ghost"
            colorScheme="blue"
            onPress={() => setSelectedCategory(null)}
            leftIcon={<Icon as={MaterialIcons} name="clear" />}
          >
            Clear
          </Button>
        </HStack>
      )}

      {/* Services List/Grid */}
      {categoryFilteredServices.length === 0 ? (
        <Center py={10}>
          <VStack space={3} alignItems="center">
            <Icon as={MaterialIcons} name="search-off" size="3xl" color="gray.400" />
            <Text color="gray.600" textAlign="center">
              No services match your current filters
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={() => setSelectedCategory(null)}
            >
              Clear Filters
            </Button>
          </VStack>
        </Center>
      ) : selectedCategory ? (
        // Single category view
        <FlatList
          data={categoryFilteredServices}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceItem}
          ItemSeparatorComponent={() => <Box h={3} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        // Grouped by category view
        <FlatList
          data={groupedServices}
          keyExtractor={(item) => item.category.id}
          renderItem={({ item }) => renderCategorySection(item)}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Booking Notice */}
      {enableBooking && stats.bookable > 0 && (
        <Alert status="info" borderRadius="lg">
          <HStack space={2} alignItems="center">
            <Alert.Icon />
            <Text fontSize="sm" flex={1}>
              {stats.bookable} {stats.bookable === 1 ? 'service is' : 'services are'} available for online booking
            </Text>
          </HStack>
        </Alert>
      )}
    </VStack>
  );
});

ServicesCatalog.displayName = 'ServicesCatalog';