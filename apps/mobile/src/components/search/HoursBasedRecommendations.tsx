import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessSearchResult } from '../../services/enhancedLocationSearchService';
import { BusinessListItem } from '../discovery/BusinessListView/BusinessListItem';

export interface HoursBasedRecommendationsProps {
  businesses: BusinessSearchResult[];
  currentLocation?: { latitude: number; longitude: number };
  onBusinessPress: (business: BusinessSearchResult) => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  testID?: string;
}

interface RecommendationSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  businesses: BusinessSearchResult[];
  priority: number;
}

export const HoursBasedRecommendations: React.FC<HoursBasedRecommendationsProps> = ({
  businesses,
  currentLocation,
  onBusinessPress,
  onRefresh,
  isLoading = false,
  testID = 'hours-based-recommendations'
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['open-now']));

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh]);

  const toggleSection = useCallback((sectionId: string) => {
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

  const generateRecommendationSections = useCallback((): RecommendationSection[] => {
    const now = new Date();
    const currentHour = now.getHours();
    const sections: RecommendationSection[] = [];

    // Open Now - Highest Priority
    const openNow = businesses.filter(business => business.isCurrentlyOpen);
    if (openNow.length > 0) {
      sections.push({
        id: 'open-now',
        title: 'Open Now',
        subtitle: `${openNow.length} business${openNow.length !== 1 ? 'es' : ''} currently open`,
        icon: 'schedule',
        iconColor: '#4CAF50',
        businesses: openNow.slice(0, 10), // Limit to 10 for performance
        priority: 1,
      });
    }

    // Closing Soon (next 2 hours)
    const closingSoon = businesses.filter(business => {
      if (!business.isCurrentlyOpen || !business.nextChange) return false;
      const hoursUntilClose = (business.nextChange.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilClose <= 2 && hoursUntilClose > 0;
    });
    if (closingSoon.length > 0) {
      sections.push({
        id: 'closing-soon',
        title: 'Closing Soon',
        subtitle: `${closingSoon.length} business${closingSoon.length !== 1 ? 'es' : ''} closing within 2 hours`,
        icon: 'warning',
        iconColor: '#FF9800',
        businesses: closingSoon.slice(0, 8),
        priority: 2,
      });
    }

    // Opening Soon (next 2 hours)
    const openingSoon = businesses.filter(business => {
      if (business.isCurrentlyOpen || !business.nextChange) return false;
      const hoursUntilOpen = (business.nextChange.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilOpen <= 2 && hoursUntilOpen > 0;
    });
    if (openingSoon.length > 0) {
      sections.push({
        id: 'opening-soon',
        title: 'Opening Soon',
        subtitle: `${openingSoon.length} business${openingSoon.length !== 1 ? 'es' : ''} opening within 2 hours`,
        icon: 'access-time',
        iconColor: '#2196F3',
        businesses: openingSoon.slice(0, 8),
        priority: 3,
      });
    }

    // Extended Hours (open past 10 PM)
    if (currentHour >= 18) { // After 6 PM
      const extendedHours = businesses.filter(business => {
        if (!business.isCurrentlyOpen || !business.nextChange) return false;
        const closeHour = business.nextChange.getHours();
        return closeHour >= 22 || closeHour <= 4; // Open past 10 PM or past midnight
      });
      if (extendedHours.length > 0) {
        sections.push({
          id: 'extended-hours',
          title: 'Open Late',
          subtitle: `${extendedHours.length} business${extendedHours.length !== 1 ? 'es' : ''} with extended hours`,
          icon: 'nightlight-round',
          iconColor: '#9C27B0',
          businesses: extendedHours.slice(0, 6),
          priority: 4,
        });
      }
    }

    // Early Birds (open before 7 AM)
    if (currentHour <= 10) { // Before 10 AM
      const earlyBirds = businesses.filter(business => {
        if (!business.isCurrentlyOpen) return false;
        // Check if they opened before 7 AM today
        const today = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
        const todayHours = business.hours?.[today];
        if (!todayHours || todayHours.closed || !todayHours.open) return false;
        
        const [hour] = todayHours.open.split(':').map(Number);
        return hour <= 7;
      });
      if (earlyBirds.length > 0) {
        sections.push({
          id: 'early-birds',
          title: 'Early Birds',
          subtitle: `${earlyBirds.length} business${earlyBirds.length !== 1 ? 'es' : ''} open early`,
          icon: 'wb-sunny',
          iconColor: '#FF5722',
          businesses: earlyBirds.slice(0, 6),
          priority: 5,
        });
      }
    }

    // Weekend Special (different hours on weekends)
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend) {
      const weekendSpecial = businesses.filter(business => {
        const today = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
        const mondayHours = business.hours?.['monday'];
        const todayHours = business.hours?.[today];
        
        if (!mondayHours || !todayHours || todayHours.closed || mondayHours.closed) {
          return false;
        }
        
        // Different hours compared to Monday
        return mondayHours.open !== todayHours.open || mondayHours.close !== todayHours.close;
      });
      if (weekendSpecial.length > 0) {
        sections.push({
          id: 'weekend-special',
          title: 'Weekend Hours',
          subtitle: `${weekendSpecial.length} business${weekendSpecial.length !== 1 ? 'es' : ''} with special weekend hours`,
          icon: 'weekend',
          iconColor: '#607D8B',
          businesses: weekendSpecial.slice(0, 6),
          priority: 6,
        });
      }
    }

    // Sort by priority
    return sections.sort((a, b) => a.priority - b.priority);
  }, [businesses]);

  const sections = generateRecommendationSections();

  const renderSectionHeader = (section: RecommendationSection) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(section.id)}
      testID={`${testID}-${section.id}-header`}
    >
      <View style={styles.sectionTitleRow}>
        <Icon name={section.icon} size={24} color={section.iconColor} />
        <View style={styles.sectionTitleText}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
        </View>
      </View>
      
      <Icon
        name={expandedSections.has(section.id) ? 'expand-less' : 'expand-more'}
        size={24}
        color="#666"
      />
    </TouchableOpacity>
  );

  const renderSection = (section: RecommendationSection) => {
    const isExpanded = expandedSections.has(section.id);
    
    return (
      <View key={section.id} style={styles.section}>
        {renderSectionHeader(section)}
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            {section.businesses.map((business, index) => (
              <BusinessListItem
                key={business.id}
                business={business}
                currentLocation={currentLocation}
                onPress={onBusinessPress}
                showDistance={true}
                showRating={true}
                testID={`${testID}-${section.id}-item-${index}`}
              />
            ))}
            
            {section.businesses.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>
                  No businesses found for this category
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (sections.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Icon name="schedule" size={48} color="#CCC" />
        <Text style={styles.emptyTitle}>No Recommendations</Text>
        <Text style={styles.emptySubtitle}>
          No businesses match the current time-based filters.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recommendations</Text>
        <Text style={styles.headerSubtitle}>
          Based on current time and business hours
        </Text>
      </View>
      
      {sections.map(renderSection)}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Hours updated in real-time • Last updated: {new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sectionTitleText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sectionContent: {
    backgroundColor: '#FAFAFA',
  },
  emptySection: {
    padding: 32,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 16,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  footer: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});