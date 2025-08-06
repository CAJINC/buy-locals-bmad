import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HStack, VStack, Badge, Icon, Progress, Tooltip } from 'native-base';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LocationAccuracyAssessment, LocationCoordinates } from '../../services/locationService';

interface LocationAccuracyIndicatorProps {
  assessment: LocationAccuracyAssessment;
  location: LocationCoordinates;
  showDetails?: boolean;
  compact?: boolean;
  onAccuracyPress?: () => void;
}

export const LocationAccuracyIndicator: React.FC<LocationAccuracyIndicatorProps> = ({
  assessment,
  location,
  showDetails = false,
  compact = false,
  onAccuracyPress
}) => {
  const getAccuracyColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'success.500';
      case 'good': return 'success.400';
      case 'fair': return 'warning.500';
      case 'poor': return 'error.500';
      default: return 'gray.400';
    }
  };

  const getAccuracyIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'gps-fixed';
      case 'good': return 'gps-not-fixed';
      case 'fair': return 'location-searching';
      case 'poor': return 'location-disabled';
      default: return 'location-off';
    }
  };

  const formatAccuracy = (accuracy: number): string => {
    if (accuracy < 1000) {
      return `±${Math.round(accuracy)}m`;
    } else {
      return `±${(accuracy / 1000).toFixed(1)}km`;
    }
  };

  if (compact) {
    return (
      <HStack space={2} alignItems="center">
        <Icon 
          as={MaterialIcons}
          name={getAccuracyIcon(assessment.quality)}
          size="sm"
          color={getAccuracyColor(assessment.quality)}
        />
        <Text style={[styles.accuracyText, { color: getAccuracyColor(assessment.quality) }]}>
          {formatAccuracy(location.accuracy)}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack space={2} p={3} bg="white" rounded="lg" shadow={1}>
      {/* Header */}
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2} alignItems="center">
          <Icon 
            as={MaterialIcons}
            name={getAccuracyIcon(assessment.quality)}
            size="md"
            color={getAccuracyColor(assessment.quality)}
          />
          <VStack space={1}>
            <Text style={styles.titleText}>Location Accuracy</Text>
            <Badge 
              colorScheme={assessment.quality === 'excellent' || assessment.quality === 'good' ? 'success' : 
                         assessment.quality === 'fair' ? 'warning' : 'error'}
              variant="solid"
              rounded="md"
            >
              {assessment.quality.toUpperCase()}
            </Badge>
          </VStack>
        </HStack>
        
        <VStack alignItems="flex-end" space={1}>
          <Text style={styles.accuracyValue}>{formatAccuracy(location.accuracy)}</Text>
          <Text style={styles.confidenceText}>
            {assessment.confidenceLevel}% confidence
          </Text>
        </VStack>
      </HStack>

      {/* Progress Bar */}
      <VStack space={1}>
        <HStack justifyContent="space-between">
          <Text style={styles.labelText}>Signal Strength</Text>
          <Text style={styles.valueText}>{assessment.confidenceLevel}%</Text>
        </HStack>
        <Progress 
          value={assessment.confidenceLevel} 
          colorScheme={assessment.quality === 'excellent' || assessment.quality === 'good' ? 'success' : 
                     assessment.quality === 'fair' ? 'warning' : 'error'}
          size="sm"
        />
      </VStack>

      {/* Details */}
      {showDetails && (
        <VStack space={2} mt={2}>
          <Text style={styles.recommendationText}>
            {assessment.recommendation}
          </Text>
          
          <VStack space={1}>
            <Text style={styles.labelText}>Technical Details:</Text>
            <HStack justifyContent="space-between">
              <Text style={styles.detailLabel}>Coordinates:</Text>
              <Text style={styles.detailValue}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </HStack>
            
            {location.altitude && (
              <HStack justifyContent="space-between">
                <Text style={styles.detailLabel}>Altitude:</Text>
                <Text style={styles.detailValue}>
                  {Math.round(location.altitude)}m
                  {location.altitudeAccuracy && ` (±${Math.round(location.altitudeAccuracy)}m)`}
                </Text>
              </HStack>
            )}
            
            {location.heading !== undefined && (
              <HStack justifyContent="space-between">
                <Text style={styles.detailLabel}>Bearing:</Text>
                <Text style={styles.detailValue}>{Math.round(location.heading)}°</Text>
              </HStack>
            )}
            
            {location.speed !== undefined && location.speed > 0 && (
              <HStack justifyContent="space-between">
                <Text style={styles.detailLabel}>Speed:</Text>
                <Text style={styles.detailValue}>
                  {(location.speed * 3.6).toFixed(1)} km/h
                </Text>
              </HStack>
            )}

            <HStack justifyContent="space-between">
              <Text style={styles.detailLabel}>Last Updated:</Text>
              <Text style={styles.detailValue}>
                {new Date(location.timestamp).toLocaleTimeString()}
              </Text>
            </HStack>
          </VStack>
        </VStack>
      )}

      {/* Action Button */}
      {onAccuracyPress && (
        <HStack justifyContent="center" mt={2}>
          <Text 
            style={styles.actionText}
            onPress={onAccuracyPress}
          >
            {assessment.isUsable ? 'Refine Location' : 'Improve Accuracy'}
          </Text>
        </HStack>
      )}
    </VStack>
  );
};

const styles = StyleSheet.create({
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accuracyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  recommendationText: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'right',
    flex: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
});