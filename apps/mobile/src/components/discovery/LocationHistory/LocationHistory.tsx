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
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { RefreshControl } from 'react-native';
import { locationHistoryService, LocationHistoryEntry, LocationSearchStats } from '../../../services/locationHistoryService';
import { LocationCoordinates } from '../../../services/locationService';

export interface LocationHistoryProps {
  onLocationSelect: (coordinates: LocationCoordinates, address: string, placeId?: string) => void;
  showStats?: boolean;
  maxItems?: number;
  title?: string;
  containerStyle?: object;
}

export const LocationHistory: React.FC<LocationHistoryProps> = ({
  onLocationSelect,
  showStats = false,
  maxItems = 20,
  title = "Recent Searches",
  containerStyle
}) => {
  // State
  const [history, setHistory] = useState<LocationHistoryEntry[]>([]);
  const [stats, setStats] = useState<LocationSearchStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LocationHistoryEntry | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  
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
    loadData();
  }, []);
  
  /**
   * Load history and stats data
   */
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [historyData, statsData] = await Promise.all([
        locationHistoryService.getLocationHistory(maxItems),
        showStats ? locationHistoryService.getLocationStats() : Promise.resolve(null)
      ]);
      
      setHistory(historyData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load location history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [maxItems, showStats]);
  
  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);
  
  /**
   * Handle history item selection
   */
  const handleItemSelect = useCallback((item: LocationHistoryEntry) => {
    onLocationSelect(item.coordinates, item.address, item.placeId);
  }, [onLocationSelect]);
  
  /**
   * Handle item deletion
   */
  const handleItemDelete = useCallback(async (item: LocationHistoryEntry) => {
    try {
      await locationHistoryService.removeHistoryEntry(item.id);
      setHistory(prev => prev.filter(h => h.id !== item.id));
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  }, []);
  
  /**
   * Handle clear all history
   */
  const handleClearAll = useCallback(async () => {
    try {
      await locationHistoryService.clearHistory();
      setHistory([]);
      setShowClearDialog(false);
      if (showStats) {
        setStats({
          totalSearches: 0,
          uniqueLocations: 0,
          mostSearchedLocation: 'None',
          averageSearchesPerDay: 0,
          recentActivity: { today: 0, thisWeek: 0, thisMonth: 0 }
        });
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }, [showStats]);
  
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
   * Get source icon
   */
  const getSourceIcon = useCallback((source: string): string => {
    switch (source) {
      case 'gps': return 'my-location';
      case 'manual': return 'edit-location';
      case 'bookmark': return 'bookmark';
      case 'search':
      default: return 'search';
    }
  }, []);
  
  /**
   * Get source color
   */
  const getSourceColor = useCallback((source: string): string => {
    switch (source) {
      case 'gps': return 'blue.500';
      case 'manual': return 'green.500';
      case 'bookmark': return 'purple.500';
      case 'search':
      default: return 'gray.500';
    }
  }, []);
  
  /**
   * Render stats section
   */
  const renderStats = () => {
    if (!showStats || !stats) return null;
    
    return (
      <Box p={4} bg={itemBgColor} borderRadius="md" mb={4}>
        <Text fontSize="md" fontWeight="semibold" color={textColor} mb={3}>
          Search Statistics
        </Text>
        
        <VStack space={2}>
          <HStack justifyContent="space-between">
            <Text fontSize="sm" color={subtextColor}>Total Searches</Text>
            <Text fontSize="sm" fontWeight="medium" color={textColor}>
              {stats.totalSearches}
            </Text>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text fontSize="sm" color={subtextColor}>Unique Locations</Text>
            <Text fontSize="sm" fontWeight="medium" color={textColor}>
              {stats.uniqueLocations}
            </Text>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text fontSize="sm" color={subtextColor}>Most Searched</Text>
            <Text fontSize="sm" fontWeight="medium" color={textColor} flex={1} textAlign="right" numberOfLines={1}>
              {stats.mostSearchedLocation}
            </Text>
          </HStack>
          
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="sm" color={subtextColor}>Recent Activity</Text>
            <HStack space={2}>
              <Badge colorScheme="blue" variant="subtle">
                Today: {stats.recentActivity.today}
              </Badge>
              <Badge colorScheme="green" variant="subtle">
                Week: {stats.recentActivity.thisWeek}
              </Badge>
            </HStack>
          </HStack>
        </VStack>
      </Box>
    );
  };
  
  /**
   * Render history item
   */
  const renderHistoryItem = ({ item }: { item: LocationHistoryEntry }) => {
    const relativeTime = getRelativeTime(item.lastUsed);
    
    return (
      <Box bg={bgColor} borderBottomWidth={1} borderBottomColor={borderColor}>
        <Pressable onPress={() => handleItemSelect(item)}>
          <HStack space={3} p={4} alignItems="center">
            {/* Source Icon */}
            <Icon
              as={MaterialIcons}
              name={getSourceIcon(item.source)}
              size="sm"
              color={getSourceColor(item.source)}
            />
            
            {/* Location Details */}
            <VStack flex={1} space={1}>
              <HStack justifyContent="space-between" alignItems="flex-start">
                <Text fontSize="md" color={textColor} flex={1} numberOfLines={1} mr={2}>
                  {item.query}
                </Text>
                <Text fontSize="xs" color={subtextColor}>
                  {relativeTime}
                </Text>
              </HStack>
              
              <Text fontSize="sm" color={subtextColor} numberOfLines={1}>
                {item.address}
              </Text>
              
              <HStack space={2} alignItems="center">
                {item.searchCount > 1 && (
                  <Badge colorScheme="gray" variant="subtle" size="sm">
                    {item.searchCount}x
                  </Badge>
                )}
                
                <Badge colorScheme="blue" variant="subtle" size="sm">
                  {item.source}
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
              <Menu.Item onPress={() => handleItemDelete(item)}>
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
      <Icon as={MaterialIcons} name="history" size="3xl" color={subtextColor} mb={4} />
      <Text fontSize="lg" color={textColor} fontWeight="medium" mb={2}>
        No Search History
      </Text>
      <Text fontSize="sm" color={subtextColor} textAlign="center">
        Your recent location searches will appear here
      </Text>
    </Box>
  );
  
  return (
    <Box style={containerStyle} flex={1}>
      <VStack space={4} flex={1}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            {title}
          </Text>
          
          {history.length > 0 && (
            <Menu
              trigger={(triggerProps) => (
                <Pressable {...triggerProps}>
                  <Icon as={MaterialIcons} name="more-vert" size="md" color={subtextColor} />
                </Pressable>
              )}
            >
              <Menu.Item onPress={() => setShowClearDialog(true)}>
                <HStack space={2} alignItems="center">
                  <Icon as={MaterialIcons} name="clear-all" size="xs" />
                  <Text>Clear All</Text>
                </HStack>
              </Menu.Item>
            </Menu>
          )}
        </HStack>
        
        {/* Stats Section */}
        {renderStats()}
        
        {/* History List */}
        <Box flex={1}>
          {isLoading ? (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Text color={subtextColor}>Loading history...</Text>
            </Box>
          ) : history.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
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
        
        {/* Clear All Confirmation Dialog */}
        <AlertDialog isOpen={showClearDialog} onClose={() => setShowClearDialog(false)}>
          <AlertDialog.Content>
            <AlertDialog.CloseButton />
            <AlertDialog.Header>Clear All History</AlertDialog.Header>
            <AlertDialog.Body>
              Are you sure you want to clear all location search history? This action cannot be undone.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button.Group space={2}>
                <Button
                  variant="unstyled"
                  colorScheme="coolGray"
                  onPress={() => setShowClearDialog(false)}
                >
                  Cancel
                </Button>
                <Button colorScheme="danger" onPress={handleClearAll}>
                  Clear All
                </Button>
              </Button.Group>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>
      </VStack>
    </Box>
  );
};