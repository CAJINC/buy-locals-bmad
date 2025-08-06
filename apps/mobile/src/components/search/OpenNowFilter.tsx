import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface OpenNowFilterProps {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
  businessCount?: number;
  isLoading?: boolean;
  testID?: string;
}

export const OpenNowFilter: React.FC<OpenNowFilterProps> = ({
  isActive,
  onToggle,
  businessCount,
  isLoading = false,
  testID = 'open-now-filter'
}) => {
  const [scaleAnimation] = useState(new Animated.Value(1));

  const handlePress = useCallback(() => {
    // Add haptic feedback animation
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onToggle(!isActive);
  }, [isActive, onToggle, scaleAnimation]);

  const formatBusinessCount = (count?: number): string => {
    if (count === undefined || isLoading) return '';
    if (count === 0) return 'None open';
    if (count === 1) return '1 open now';
    return `${count} open now`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isActive && styles.activeContainer,
        { transform: [{ scale: scaleAnimation }] }
      ]}
      testID={testID}
    >
      <TouchableOpacity
        style={[styles.button, isActive && styles.activeButton]}
        onPress={handlePress}
        disabled={isLoading}
        testID={`${testID}-button`}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Icon
            name="schedule"
            size={18}
            color={isActive ? '#FFF' : '#4CAF50'}
            style={styles.icon}
          />
          {isActive && (
            <View style={styles.activeBadge}>
              <Icon name="check" size={12} color="#4CAF50" />
            </View>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.label, isActive && styles.activeLabel]}>
            Open Now
          </Text>
          
          {businessCount !== undefined && (
            <Text style={[styles.count, isActive && styles.activeCount]}>
              {formatBusinessCount(businessCount)}
            </Text>
          )}
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Icon
              name="refresh"
              size={16}
              color={isActive ? '#FFF' : '#666'}
              style={[styles.loadingIcon, isLoading && styles.spinning]}
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Enhanced Open Now Filter with Time-based Recommendations
export interface EnhancedOpenNowFilterProps extends OpenNowFilterProps {
  showRecommendations?: boolean;
  nextOpeningCount?: number;
  closingSoonCount?: number;
  onRecommendationPress?: (type: 'closing-soon' | 'next-opening') => void;
}

export const EnhancedOpenNowFilter: React.FC<EnhancedOpenNowFilterProps> = ({
  isActive,
  onToggle,
  businessCount,
  isLoading = false,
  showRecommendations = false,
  nextOpeningCount,
  closingSoonCount,
  onRecommendationPress,
  testID = 'enhanced-open-now-filter'
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleMainToggle = useCallback((newState: boolean) => {
    onToggle(newState);
    if (newState && showRecommendations) {
      setShowDetails(true);
    }
  }, [onToggle, showRecommendations]);

  const renderRecommendations = () => {
    if (!showRecommendations || !showDetails) return null;

    return (
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>Quick Filters</Text>
        
        <View style={styles.recommendationButtons}>
          {closingSoonCount && closingSoonCount > 0 && (
            <TouchableOpacity
              style={styles.recommendationButton}
              onPress={() => onRecommendationPress?.('closing-soon')}
              testID={`${testID}-closing-soon`}
            >
              <Icon name="warning" size={16} color="#FF9800" />
              <Text style={styles.recommendationText}>
                Closing Soon ({closingSoonCount})
              </Text>
            </TouchableOpacity>
          )}

          {nextOpeningCount && nextOpeningCount > 0 && (
            <TouchableOpacity
              style={styles.recommendationButton}
              onPress={() => onRecommendationPress?.('next-opening')}
              testID={`${testID}-next-opening`}
            >
              <Icon name="schedule" size={16} color="#2196F3" />
              <Text style={styles.recommendationText}>
                Opening Soon ({nextOpeningCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.enhancedContainer} testID={testID}>
      <OpenNowFilter
        isActive={isActive}
        onToggle={handleMainToggle}
        businessCount={businessCount}
        isLoading={isLoading}
        testID={`${testID}-main`}
      />
      
      {renderRecommendations()}
      
      {showRecommendations && isActive && (
        <TouchableOpacity
          style={styles.detailsToggle}
          onPress={() => setShowDetails(!showDetails)}
          testID={`${testID}-details-toggle`}
        >
          <Icon
            name={showDetails ? 'expand-less' : 'expand-more'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeContainer: {
    shadowColor: '#4CAF50',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
  },
  activeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
  },
  activeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activeLabel: {
    color: '#FFF',
  },
  count: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  activeCount: {
    color: '#E8F5E8',
  },
  loadingContainer: {
    marginLeft: 8,
  },
  loadingIcon: {
    // Animation will be added via transform
  },
  spinning: {
    // Rotation animation would be applied here
  },
  
  // Enhanced Filter Styles
  enhancedContainer: {
    position: 'relative',
  },
  recommendationsContainer: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  recommendationButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  recommendationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recommendationText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  detailsToggle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});