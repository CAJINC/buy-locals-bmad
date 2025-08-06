import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessHoursIndicatorProps } from './types';
import { useBusinessStatus } from '../../../hooks/useBusinessStatus';
import { OpenStatus } from '../../hours/OpenStatus';
import { CountdownTimer } from '../../hours/CountdownTimer';

export const BusinessHoursIndicator: React.FC<BusinessHoursIndicatorProps> = ({
  businessId,
  hours,
  isOpen,
  status,
  nextChange,
  _timezone,
  size = 'medium',
  showText = true,
  showNextChange = true,
  enableRealTime = false,
  testID = 'business-hours-indicator'
}) => {
  const [currentStatus, setCurrentStatus] = useState({ 
    isOpen: isOpen || false, 
    status: status || 'unknown',
    nextChange: nextChange || null 
  });

  // Real-time status hook (only if enabled and businessId provided)
  const { statuses, subscribe, unsubscribe } = useBusinessStatus({
    autoConnect: enableRealTime && !!businessId,
  });

  // Subscribe/unsubscribe to real-time updates
  useEffect(() => {
    if (enableRealTime && businessId) {
      subscribe(businessId);
      return () => unsubscribe(businessId);
    }
  }, [businessId, enableRealTime, subscribe, unsubscribe]);

  // Update local status when real-time data changes
  useEffect(() => {
    if (businessId && statuses.has(businessId)) {
      const realtimeStatus = statuses.get(businessId);
      if (realtimeStatus) {
        setCurrentStatus({
          isOpen: realtimeStatus.isOpen,
          status: realtimeStatus.status,
          nextChange: realtimeStatus.nextChange,
        });
      }
    }
  }, [businessId, statuses]);

  // Handle status updates from countdown timer
  const handleStatusUpdate = (newStatus: { isOpen: boolean; nextChange: string | null }) => {
    setCurrentStatus(prev => ({
      ...prev,
      ...newStatus,
    }));
  };
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

  // Use real-time status if available, otherwise fallback to calculated
  const displayIsOpen = currentStatus.isOpen !== undefined ? currentStatus.isOpen : isCurrentlyOpen();
  const displayNextChange = currentStatus.nextChange || getNextChangeTime();

  // For compact display, use our new components
  if (size === 'small') {
    return (
      <View style={[styles.container, styles[size]]} testID={testID}>
        <OpenStatus
          isOpen={displayIsOpen}
          status={currentStatus.status}
          compact={true}
          testID={`${testID}-status`}
        />
        {displayNextChange && showNextChange && (
          <CountdownTimer
            targetTime={displayNextChange}
            isOpen={displayIsOpen}
            compact={true}
            onStatusUpdate={handleStatusUpdate}
            testID={`${testID}-countdown`}
          />
        )}
      </View>
    );
  }

  // Legacy display for medium/large sizes
  const nextChangeTime = getNextChangeTime();
  
  return (
    <View style={[styles.container, styles[size]]} testID={testID}>
      <Icon
        name={displayIsOpen ? 'schedule' : 'schedule'}
        size={styles[`icon_${size}`].fontSize}
        color={displayIsOpen ? '#4CAF50' : '#F44336'}
      />
      {showText && (
        <Text style={[
          styles.statusText, 
          styles[`statusText_${size}`],
          displayIsOpen ? styles.openText : styles.closedText
        ]}>
          {displayIsOpen ? 'Open' : 'Closed'}
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
  // eslint-disable-next-line react-native/no-unused-styles
  small: {
    gap: 2,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  medium: {
    gap: 4,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  large: {
    gap: 6,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  icon_small: {
    fontSize: 12,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  icon_medium: {
    fontSize: 14,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  icon_large: {
    fontSize: 16,
  },
  statusText: {
    fontWeight: '600',
  },
  // eslint-disable-next-line react-native/no-unused-styles
  statusText_small: {
    fontSize: 11,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  statusText_medium: {
    fontSize: 12,
  },
  // eslint-disable-next-line react-native/no-unused-styles
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
  // eslint-disable-next-line react-native/no-unused-styles
  nextOpenText_small: {
    fontSize: 10,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  nextOpenText_medium: {
    fontSize: 11,
  },
  // eslint-disable-next-line react-native/no-unused-styles
  nextOpenText_large: {
    fontSize: 12,
  },
});