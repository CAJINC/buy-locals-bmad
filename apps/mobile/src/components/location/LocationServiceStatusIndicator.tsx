import React, { useState, useEffect } from 'react';
import { 
  VStack, 
  HStack, 
  Text, 
  Icon, 
  Badge, 
  Progress, 
  Button,
  Alert,
  Divider,
  Collapse
} from 'native-base';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { locationService, LocationUpdateFrequencyConfig } from '../../services/locationService';

interface LocationServiceStatusIndicatorProps {
  onRefineLocation?: () => void;
  onConfigureFrequency?: (config: Partial<LocationUpdateFrequencyConfig>) => void;
  showDetails?: boolean;
}

export const LocationServiceStatusIndicator: React.FC<LocationServiceStatusIndicatorProps> = ({
  onRefineLocation,
  onConfigureFrequency,
  showDetails = false
}) => {
  const [locationStatus, setLocationStatus] = useState<any>(null);
  const [frequencyStats, setFrequencyStats] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLocationStatus();
    loadFrequencyStats();
    
    // Set up periodic status updates
    const interval = setInterval(() => {
      loadLocationStatus();
      loadFrequencyStats();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const loadLocationStatus = async () => {
    try {
      const status = await locationService.getLocationStatus();
      setLocationStatus(status);
    } catch (error) {
      console.error('Failed to load location status:', error);
    }
  };

  const loadFrequencyStats = () => {
    try {
      const stats = locationService.getLocationUpdateFrequencyStats();
      setFrequencyStats(stats);
    } catch (error) {
      console.error('Failed to load frequency stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocationStatus();
    loadFrequencyStats();
    setRefreshing(false);
  };

  const getServiceStatusColor = () => {
    if (!locationStatus) return 'gray';
    
    if (locationStatus.hasLocation && locationStatus.permission.granted) {
      return locationStatus.accuracy?.quality === 'excellent' || locationStatus.accuracy?.quality === 'good' 
        ? 'success' : 'warning';
    }
    
    return 'error';
  };

  const getServiceStatusText = () => {
    if (!locationStatus) return 'Loading...';
    
    if (!locationStatus.permission.granted) return 'Permission Denied';
    if (!locationStatus.hasLocation) return 'No Location';
    if (locationStatus.accuracy?.quality === 'excellent') return 'Excellent';
    if (locationStatus.accuracy?.quality === 'good') return 'Good';
    if (locationStatus.accuracy?.quality === 'fair') return 'Fair';
    return 'Poor';
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getMovementIcon = (pattern: string) => {
    switch (pattern) {
      case 'stationary': return 'location-on';
      case 'walking': return 'directions-walk';
      case 'driving': return 'directions-car';
      case 'transit': return 'directions-transit';
      default: return 'location-searching';
    }
  };

  const renderBasicStatus = () => (
    <VStack space={2} p={3} bg="white" rounded="lg" shadow={1}>
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2} alignItems="center">
          <Icon 
            as={MaterialIcons} 
            name="gps-fixed" 
            color={`${getServiceStatusColor()}.500`} 
            size="md" 
          />
          <VStack>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
              Location Service
            </Text>
            <Badge 
              colorScheme={getServiceStatusColor()} 
              variant="solid" 
              rounded="sm"
            >
              {getServiceStatusText()}
            </Badge>
          </VStack>
        </HStack>
        
        <HStack space={2}>
          <Button
            size="sm"
            variant="ghost"
            onPress={handleRefresh}
            isLoading={refreshing}
          >
            <Icon as={MaterialIcons} name="refresh" size="sm" />
          </Button>
          
          {showDetails && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setIsExpanded(!isExpanded)}
            >
              <Icon 
                as={MaterialIcons} 
                name={isExpanded ? 'expand-less' : 'expand-more'} 
                size="sm" 
              />
            </Button>
          )}
        </HStack>
      </HStack>

      {locationStatus?.hasLocation && (
        <HStack justifyContent="space-between" alignItems="center">
          <Text style={{ fontSize: 12, color: '#6B7280' }}>
            Last updated: {formatTimestamp(locationStatus.cacheStatus.cacheAge > 0 
              ? Date.now() - locationStatus.cacheStatus.cacheAge 
              : Date.now())}
          </Text>
          
          {onRefineLocation && locationStatus.accuracy && (
            <Button size="xs" variant="ghost" onPress={onRefineLocation}>
              Refine
            </Button>
          )}
        </HStack>
      )}
    </VStack>
  );

  const renderDetailedStatus = () => {
    if (!isExpanded || !locationStatus) return null;

    return (
      <VStack space={3} mt={3}>
        <Divider />
        
        {/* Permission Details */}
        <VStack space={2}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
            Permission Status
          </Text>
          <VStack space={1}>
            <HStack justifyContent="space-between">
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Basic Location:</Text>
              <Badge 
                colorScheme={locationStatus.permission.granted ? 'success' : 'error'}
                variant="outline"
                size="sm"
              >
                {locationStatus.permission.granted ? 'Granted' : 'Denied'}
              </Badge>
            </HStack>
            
            {locationStatus.permission.backgroundLocationGranted !== undefined && (
              <HStack justifyContent="space-between">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Background:</Text>
                <Badge 
                  colorScheme={locationStatus.permission.backgroundLocationGranted ? 'success' : 'warning'}
                  variant="outline"
                  size="sm"
                >
                  {locationStatus.permission.backgroundLocationGranted ? 'Granted' : 'Limited'}
                </Badge>
              </HStack>
            )}
          </VStack>
        </VStack>

        {/* Location Accuracy */}
        {locationStatus.accuracy && (
          <VStack space={2}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
              Accuracy Assessment
            </Text>
            <VStack space={1}>
              <HStack justifyContent="space-between">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Quality:</Text>
                <Text style={{ fontSize: 12, fontWeight: '500' }}>
                  {locationStatus.accuracy.quality.toUpperCase()}
                </Text>
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Confidence:</Text>
                <HStack space={2} alignItems="center">
                  <Progress
                    value={locationStatus.accuracy.confidenceLevel}
                    size="sm"
                    colorScheme={getServiceStatusColor()}
                    w="20"
                  />
                  <Text style={{ fontSize: 12, fontWeight: '500' }}>
                    {locationStatus.accuracy.confidenceLevel}%
                  </Text>
                </HStack>
              </HStack>
              
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                {locationStatus.accuracy.recommendation}
              </Text>
            </VStack>
          </VStack>
        )}

        {/* Service Status */}
        <VStack space={2}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
            Service Status
          </Text>
          <VStack space={1}>
            <HStack justifyContent="space-between">
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Active Watching:</Text>
              <Badge 
                colorScheme={locationStatus.isWatching ? 'success' : 'gray'}
                variant="outline"
                size="sm"
              >
                {locationStatus.isWatching ? 'Active' : 'Inactive'}
              </Badge>
            </HStack>
            
            <HStack justifyContent="space-between">
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Background Updates:</Text>
              <Badge 
                colorScheme={locationStatus.isBackgroundWatching ? 'success' : 'gray'}
                variant="outline"
                size="sm"
              >
                {locationStatus.isBackgroundWatching ? 'Active' : 'Inactive'}
              </Badge>
            </HStack>
            
            <HStack justifyContent="space-between">
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Cache Entries:</Text>
              <Text style={{ fontSize: 12, fontWeight: '500' }}>
                {locationStatus.cacheStatus.cacheEntries}
              </Text>
            </HStack>
          </VStack>
        </VStack>

        {/* Frequency Management */}
        {frequencyStats && (
          <VStack space={2}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                Update Frequency
              </Text>
              {onConfigureFrequency && (
                <Button size="xs" variant="outline" onPress={() => onConfigureFrequency({})}>
                  Configure
                </Button>
              )}
            </HStack>
            
            <VStack space={1}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Movement Pattern:</Text>
                <HStack space={1} alignItems="center">
                  <Icon
                    as={MaterialIcons}
                    name={getMovementIcon(frequencyStats.movementData.movementPattern)}
                    size="xs"
                    color="gray.600"
                  />
                  <Text style={{ fontSize: 12, fontWeight: '500' }}>
                    {frequencyStats.movementData.movementPattern.charAt(0).toUpperCase() + 
                     frequencyStats.movementData.movementPattern.slice(1)}
                  </Text>
                </HStack>
              </HStack>
              
              <HStack justifyContent="space-between">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Update Interval:</Text>
                <Text style={{ fontSize: 12, fontWeight: '500' }}>
                  {Math.round(frequencyStats.currentConfig.interval / 1000)}s
                </Text>
              </HStack>
              
              <HStack justifyContent="space-between">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Distance Filter:</Text>
                <Text style={{ fontSize: 12, fontWeight: '500' }}>
                  {frequencyStats.currentConfig.distanceFilter}m
                </Text>
              </HStack>
              
              <HStack justifyContent="space-between">
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Battery Optimized:</Text>
                <Badge 
                  colorScheme={frequencyStats.currentConfig.batteryOptimized ? 'success' : 'warning'}
                  variant="outline"
                  size="sm"
                >
                  {frequencyStats.currentConfig.batteryOptimized ? 'Yes' : 'No'}
                </Badge>
              </HStack>
            </VStack>
          </VStack>
        )}

        {/* Recommendations */}
        {locationStatus.accuracy && !locationStatus.accuracy.isUsable && (
          <Alert status="warning" colorScheme="warning">
            <VStack space={1} flexShrink={1} w="100%">
              <HStack flexShrink={1} space={2} alignItems="center">
                <Alert.Icon />
                <Text style={{ fontSize: 12, color: '#92400E' }}>
                  Location accuracy is poor. Consider refining your location for better results.
                </Text>
              </HStack>
            </VStack>
          </Alert>
        )}
      </VStack>
    );
  };

  if (!locationStatus) {
    return (
      <VStack space={2} p={3} bg="white" rounded="lg" shadow={1}>
        <HStack space={2} alignItems="center">
          <Icon as={MaterialIcons} name="location-searching" color="gray.400" size="md" />
          <Text style={{ fontSize: 14, color: '#6B7280' }}>Loading location status...</Text>
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack space={0}>
      {renderBasicStatus()}
      <Collapse isOpen={isExpanded}>
        {renderDetailedStatus()}
      </Collapse>
    </VStack>
  );
};