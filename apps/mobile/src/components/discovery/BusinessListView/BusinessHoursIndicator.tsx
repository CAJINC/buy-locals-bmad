import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessHoursIndicatorProps } from './types';
import { BusinessSearchResult } from '../../../services/enhancedLocationSearchService';

export const BusinessHoursIndicator: React.FC<BusinessHoursIndicatorProps> = ({
  hours,
  isOpen,
  status,
  nextChange,
  timezone,
  size = 'medium',
  showText = true,
  showNextChange = true,
  testID = 'business-hours-indicator'
}) => {
  // Use enhanced status data if available, otherwise fall back to calculation
  const isCurrentlyOpen = (): boolean => {
    if (isOpen !== undefined) {
      return isOpen;
    }
    if (!hours || Object.keys(hours).length === 0) {
      return false;
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    const todayHours = hours[currentDay];
    
    if (!todayHours || todayHours.closed) {
      return false;
    }

    if (!todayHours.open || !todayHours.close) {
      return false;
    }

    // Convert time strings to minutes for comparison
    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const currentMinutes = timeToMinutes(currentTime);
    const openMinutes = timeToMinutes(todayHours.open);
    const closeMinutes = timeToMinutes(todayHours.close);

    // Handle cases where closing time is after midnight (next day)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  };

  const getNextChangeTime = (): string | null => {
    // Use enhanced next change data if available
    if (nextChange && showNextChange) {
      const now = new Date();
      const diffMs = nextChange.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffMs <= 0) {
        return null; // Change has already occurred
      }
      
      if (isCurrentlyOpen()) {
        // Currently open, showing when it closes
        if (diffMins < 60) {
          return `Closes in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
          return `Closes at ${nextChange.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        } else {
          return `Closes ${nextChange.toLocaleDateString([], { weekday: 'short' })} at ${nextChange.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }
      } else {
        // Currently closed, showing when it opens
        if (diffMins < 60) {
          return `Opens in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
          return `Opens at ${nextChange.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        } else {
          return `Opens ${nextChange.toLocaleDateString([], { weekday: 'short' })} at ${nextChange.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }
      }
    }

    // Fallback to legacy calculation
    return getNextOpenTime();
  };

  const getNextOpenTime = (): string | null => {
    if (!hours || Object.keys(hours).length === 0) {
      return null;
    }

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayIndex = now.getDay();
    
    // Check today first (if currently closed)
    const currentDay = dayNames[currentDayIndex];
    const todayHours = hours[currentDay];
    
    if (todayHours && !todayHours.closed && todayHours.open) {
      const currentTime = now.toTimeString().slice(0, 5);
      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const currentMinutes = timeToMinutes(currentTime);
      const openMinutes = timeToMinutes(todayHours.open);
      
      // If it's before opening time today
      if (currentMinutes < openMinutes) {
        return `Opens at ${todayHours.open}`;
      }
    }
    
    // Check next 6 days
    for (let i = 1; i <= 6; i++) {
      const dayIndex = (currentDayIndex + i) % 7;
      const dayName = dayNames[dayIndex];
      const dayHours = hours[dayName];
      
      if (dayHours && !dayHours.closed && dayHours.open) {
        const dayDisplayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        return `Opens ${i === 1 ? 'tomorrow' : dayDisplayName} at ${dayHours.open}`;
      }
    }
    
    return null;
  };

  const isOpen = isCurrentlyOpen();
  const nextChangeTime = getNextChangeTime();

  return (
    <View style={[styles.container, styles[size]]} testID={testID}>
      <Icon
        name={isOpen ? 'schedule' : 'schedule'}
        size={styles[`icon_${size}`].fontSize}
        color={isOpen ? '#4CAF50' : '#F44336'}
      />
      {showText && (
        <Text style={[
          styles.statusText, 
          styles[`statusText_${size}`],
          isOpen ? styles.openText : styles.closedText
        ]}>
          {isOpen ? 'Open' : 'Closed'}
        </Text>
      )}
      {nextChangeTime && showText && (
        <Text style={[styles.nextOpenText, styles[`nextOpenText_${size}`]]}>
          • {nextChangeTime}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  small: {
    gap: 2,
  },
  medium: {
    gap: 4,
  },
  large: {
    gap: 6,
  },
  icon_small: {
    fontSize: 12,
  },
  icon_medium: {
    fontSize: 14,
  },
  icon_large: {
    fontSize: 16,
  },
  statusText: {
    fontWeight: '600',
  },
  statusText_small: {
    fontSize: 11,
  },
  statusText_medium: {
    fontSize: 12,
  },
  statusText_large: {
    fontSize: 14,
  },
  openText: {
    color: '#4CAF50',
  },
  closedText: {
    color: '#F44336',
  },
  nextOpenText: {
    color: '#888',
    fontWeight: '400',
  },
  nextOpenText_small: {
    fontSize: 10,
  },
  nextOpenText_medium: {
    fontSize: 11,
  },
  nextOpenText_large: {
    fontSize: 12,
  },
});