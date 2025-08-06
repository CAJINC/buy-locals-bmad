import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Pressable,
  Icon,
  FlatList,
  Badge,
  Menu,
  useColorModeValue,
  AlertDialog,
  Button,
  Input,
  Select,
  Modal,
  FormControl,
  TextArea,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { RefreshControl } from 'react-native';
import { locationHistoryService, SavedLocation } from '../../../services/locationHistoryService';
import { LocationCoordinates } from '../../../services/locationService';
import { GeocodingResult } from '../../../services/geocodingService';

export interface SavedLocationsProps {
  onLocationSelect: (coordinates: LocationCoordinates, address: string, placeId?: string) => void;
  onSaveLocation?: (name: string, result: GeocodingResult, category: 'home' | 'work' | 'favorite' | 'custom', notes?: string) => void;
  enableAdd?: boolean;
  filterCategory?: 'home' | 'work' | 'favorite' | 'custom';
  maxItems?: number;
  title?: string;
  containerStyle?: object;
}

interface EditLocationForm {
  name: string;
  category: 'home' | 'work' | 'favorite' | 'custom';
  notes: string;
}

export const SavedLocations: React.FC<SavedLocationsProps> = ({
  onLocationSelect,
  onSaveLocation,
  enableAdd = false,
  filterCategory,
  maxItems = 20,
  title = "Saved Locations",
  containerStyle
}) => {
  // State
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<SavedLocation | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditLocationForm>({
    name: '',
    category: 'custom',
    notes: ''
  });
  
  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  
  /**
   * Initialize component
   */
  useEffect(() => {
    loadSavedLocations();
  }, [filterCategory]);
  
  /**
   * Load saved locations
   */
  const loadSavedLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      const locations = await locationHistoryService.getSavedLocations(filterCategory);
      setSavedLocations(locations.slice(0, maxItems));
    } catch (error) {
      console.error('Failed to load saved locations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, maxItems]);
  
  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSavedLocations();
    setIsRefreshing(false);
  }, [loadSavedLocations]);
  
  /**
   * Handle location selection
   */
  const handleLocationSelect = useCallback(async (location: SavedLocation) => {
    try {
      // Update usage
      await locationHistoryService.updateSavedLocationUsage(location.id);
      
      // Update local state
      setSavedLocations(prev => 
        prev.map(loc => 
          loc.id === location.id 
            ? { ...loc, lastUsed: Date.now() }
            : loc
        )
      );
      
      onLocationSelect(location.coordinates, location.address, location.placeId);
    } catch (error) {
      console.error('Failed to select saved location:', error);
    }
  }, [onLocationSelect]);
  
  /**
   * Handle location deletion
   */
  const handleLocationDelete = useCallback(async () => {
    if (!selectedLocation) return;
    
    try {
      await locationHistoryService.removeSavedLocation(selectedLocation.id);
      setSavedLocations(prev => prev.filter(loc => loc.id !== selectedLocation.id));
      setShowDeleteDialog(false);
      setSelectedLocation(null);
    } catch (error) {
      console.error('Failed to delete saved location:', error);
    }
  }, [selectedLocation]);
  
  /**
   * Handle edit location
   */
  const handleEditLocation = useCallback((location: SavedLocation) => {
    setSelectedLocation(location);
    setEditForm({
      name: location.name,
      category: location.category,
      notes: location.notes || ''
    });
    setShowEditModal(true);
  }, []);
  
  /**
   * Handle save edit
   */
  const handleSaveEdit = useCallback(async () => {
    if (!selectedLocation) return;
    
    try {
      // Create updated location object
      const updatedLocation: SavedLocation = {
        ...selectedLocation,
        name: editForm.name.trim(),
        category: editForm.category,
        notes: editForm.notes.trim() || undefined,
        lastUsed: Date.now()
      };
      
      // Save to storage (we'll need to add an update method to the service)
      await locationHistoryService.removeSavedLocation(selectedLocation.id);
      const geocodingResult: GeocodingResult = {
        formattedAddress: updatedLocation.address,
        coordinates: updatedLocation.coordinates,
        placeId: updatedLocation.placeId,
        components: {},
        types: []
      };
      
      await locationHistoryService.saveLocation(
        updatedLocation.name,
        geocodingResult,
        updatedLocation.category,
        updatedLocation.notes
      );
      
      // Update local state
      setSavedLocations(prev => 
        prev.map(loc => 
          loc.id === selectedLocation.id ? updatedLocation : loc
        )
      );
      
      setShowEditModal(false);
      setSelectedLocation(null);
    } catch (error) {
      console.error('Failed to update saved location:', error);
    }
  }, [selectedLocation, editForm]);
  
  /**
   * Get category icon
   */
  const getCategoryIcon = useCallback((category: string): string => {
    switch (category) {
      case 'home': return 'home';
      case 'work': return 'work';
      case 'favorite': return 'star';
      case 'custom':
      default: return 'place';
    }
  }, []);
  
  /**
   * Get category color
   */
  const getCategoryColor = useCallback((category: string): string => {
    switch (category) {
      case 'home': return 'blue.500';
      case 'work': return 'green.500';
      case 'favorite': return 'yellow.500';
      case 'custom':
      default: return 'purple.500';
    }
  }, []);
  
  /**
   * Get category label
   */
  const getCategoryLabel = useCallback((category: string): string => {
    switch (category) {
      case 'home': return 'Home';
      case 'work': return 'Work';
      case 'favorite': return 'Favorite';
      case 'custom':
      default: return 'Custom';
    }
  }, []);
  
  /**
   * Get relative time string
   */
  const getRelativeTime = useCallback((timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }, []);
  
  /**
   * Render saved location item
   */
  const renderLocationItem = ({ item }: { item: SavedLocation }) => {
    const relativeTime = getRelativeTime(item.lastUsed);
    
    return (
      <Box bg={bgColor} borderBottomWidth={1} borderBottomColor={borderColor}>
        <Pressable onPress={() => handleLocationSelect(item)}>
          <HStack space={3} p={4} alignItems="center">
            {/* Category Icon */}
            <Icon
              as={MaterialIcons}
              name={getCategoryIcon(item.category)}
              size="md"
              color={getCategoryColor(item.category)}
            />
            
            {/* Location Details */}
            <VStack flex={1} space={1}>
              <HStack justifyContent="space-between" alignItems="flex-start">
                <Text fontSize="md" fontWeight="medium" color={textColor} flex={1} numberOfLines={1} mr={2}>
                  {item.name}
                </Text>
                <Text fontSize="xs" color={subtextColor}>
                  {relativeTime}
                </Text>
              </HStack>
              
              <Text fontSize="sm" color={subtextColor} numberOfLines={1}>
                {item.address}
              </Text>
              
              {item.notes && (
                <Text fontSize="xs" color={subtextColor} numberOfLines={1} italic>
                  {item.notes}
                </Text>
              )}
              
              <HStack space={2} alignItems="center" mt={1}>
                <Badge 
                  colorScheme={
                    item.category === 'home' ? 'blue' :
                    item.category === 'work' ? 'green' :
                    item.category === 'favorite' ? 'yellow' : 'purple'
                  }
                  variant="subtle" 
                  size="sm"
                >
                  {getCategoryLabel(item.category)}
                </Badge>
              </HStack>
            </VStack>
            
            {/* Actions Menu */}
            <Menu
              trigger={(triggerProps) => (
                <Pressable {...triggerProps}>
                  <Icon as={MaterialIcons} name="more-vert" size="sm" color={subtextColor} />
                </Pressable>
              )}
            >
              <Menu.Item onPress={() => handleEditLocation(item)}>
                <HStack space={2} alignItems="center">
                  <Icon as={MaterialIcons} name="edit" size="xs" />
                  <Text>Edit</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item 
                onPress={() => {
                  setSelectedLocation(item);
                  setShowDeleteDialog(true);
                }}
              >
                <HStack space={2} alignItems="center">
                  <Icon as={MaterialIcons} name="delete" size="xs" />
                  <Text>Delete</Text>
                </HStack>
              </Menu.Item>
            </Menu>
          </HStack>
        </Pressable>
      </Box>
    );
  };
  
  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <Box flex={1} justifyContent="center" alignItems="center" p={8}>
      <Icon as={MaterialIcons} name="bookmark-border" size="3xl" color={subtextColor} mb={4} />
      <Text fontSize="lg" color={textColor} fontWeight="medium" mb={2}>
        No Saved Locations
      </Text>
      <Text fontSize="sm" color={subtextColor} textAlign="center" mb={4}>
        Save your favorite places for quick access
      </Text>
    </Box>
  );
  
  /**
   * Render category stats
   */
  const renderCategoryStats = () => {
    if (filterCategory) return null;
    
    const categoryStats = savedLocations.reduce((acc, location) => {
      acc[location.category] = (acc[location.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const categories = Object.entries(categoryStats);
    if (categories.length === 0) return null;
    
    return (
      <Box p={4} bg={itemBgColor} borderRadius="md" mb={4}>
        <Text fontSize="md" fontWeight="semibold" color={textColor} mb={3}>
          Categories
        </Text>
        
        <HStack space={2} flexWrap="wrap">
          {categories.map(([category, count]) => (
            <Badge
              key={category}
              colorScheme={
                category === 'home' ? 'blue' :
                category === 'work' ? 'green' :
                category === 'favorite' ? 'yellow' : 'purple'
              }
              variant="subtle"
              mb={1}
            >
              {getCategoryLabel(category)}: {count}
            </Badge>
          ))}
        </HStack>
      </Box>
    );
  };
  
  return (
    <Box style={containerStyle} flex={1}>
      <VStack space={4} flex={1}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            {title}
          </Text>
          
          {savedLocations.length > 0 && (
            <Text fontSize="sm" color={subtextColor}>
              {savedLocations.length} saved
            </Text>
          )}
        </HStack>
        
        {/* Category Stats */}
        {renderCategoryStats()}
        
        {/* Saved Locations List */}
        <Box flex={1}>
          {isLoading ? (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Text color={subtextColor}>Loading saved locations...</Text>
            </Box>
          ) : savedLocations.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={savedLocations}
              keyExtractor={(item) => item.id}
              renderItem={renderLocationItem}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </Box>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog isOpen={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <AlertDialog.Content>
            <AlertDialog.CloseButton />
            <AlertDialog.Header>Delete Saved Location</AlertDialog.Header>
            <AlertDialog.Body>
              Are you sure you want to delete "{selectedLocation?.name}"? This action cannot be undone.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button.Group space={2}>
                <Button
                  variant="unstyled"
                  colorScheme="coolGray"
                  onPress={() => setShowDeleteDialog(false)}
                >
                  Cancel
                </Button>
                <Button colorScheme="danger" onPress={handleLocationDelete}>
                  Delete
                </Button>
              </Button.Group>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>
        
        {/* Edit Location Modal */}
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
          <Modal.Content>
            <Modal.CloseButton />
            <Modal.Header>Edit Location</Modal.Header>
            <Modal.Body>
              <VStack space={4}>
                <FormControl>
                  <FormControl.Label>Name</FormControl.Label>
                  <Input
                    value={editForm.name}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                    placeholder="Enter location name"
                  />
                </FormControl>
                
                <FormControl>
                  <FormControl.Label>Category</FormControl.Label>
                  <Select
                    selectedValue={editForm.category}
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value as any }))}
                  >
                    <Select.Item label="Home" value="home" />
                    <Select.Item label="Work" value="work" />
                    <Select.Item label="Favorite" value="favorite" />
                    <Select.Item label="Custom" value="custom" />
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormControl.Label>Notes (Optional)</FormControl.Label>
                  <TextArea
                    value={editForm.notes}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, notes: text }))}
                    placeholder="Add notes..."
                    autoCompleteType="off"
                    h={20}
                  />
                </FormControl>
              </VStack>
            </Modal.Body>
            <Modal.Footer>
              <Button.Group space={2}>
                <Button
                  variant="ghost"
                  colorScheme="blueGray"
                  onPress={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button onPress={handleSaveEdit} isDisabled={!editForm.name.trim()}>
                  Save
                </Button>
              </Button.Group>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </VStack>
    </Box>
  );
};