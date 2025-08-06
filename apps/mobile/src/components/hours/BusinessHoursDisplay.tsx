import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { OpenStatus } from './OpenStatus';
import { CountdownTimer } from './CountdownTimer';
import { WeeklySchedule } from './WeeklySchedule';
import { BusinessHours } from '../../types/business';

export interface BusinessHoursDisplayProps {
  businessId: string;
  hours: BusinessHours;
  timezone: string;
  isOpen: boolean;
  status: string;
  nextChange: string | null;
  reason?: string;
  compact?: boolean;
  showWeeklyView?: boolean;
  testID?: string;
  onStatusUpdate?: (status: { isOpen: boolean; nextChange: string | null }) => void;
}

export const BusinessHoursDisplay: React.FC<BusinessHoursDisplayProps> = ({
  businessId,
  hours,
  timezone,
  isOpen,
  status,
  nextChange,
  reason,
  compact = false,
  showWeeklyView = true,
  testID = 'business-hours-display',
  onStatusUpdate,
}) => {
  const [showSchedule, setShowSchedule] = useState(false);
  const [animationValue] = useState(new Animated.Value(0));

  const toggleSchedule = useCallback(() => {
    const toValue = showSchedule ? 0 : 1;
    
    Animated.timing(animationValue, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setShowSchedule(!showSchedule);
  }, [showSchedule, animationValue]);

  const handleStatusUpdate = useCallback((newStatus: { isOpen: boolean; nextChange: string | null }) => {
    onStatusUpdate?.(newStatus);
  }, [onStatusUpdate]);

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        <OpenStatus
          isOpen={isOpen}
          status={status}
          reason={reason}
          compact={true}
          testID={`${testID}-status`}
        />
        {nextChange && (
          <CountdownTimer
            targetTime={nextChange}
            isOpen={isOpen}
            compact={true}
            onStatusUpdate={handleStatusUpdate}
            testID={`${testID}-countdown`}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Current Status */}
      <View style={styles.statusSection}>
        <OpenStatus
          isOpen={isOpen}
          status={status}
          reason={reason}
          testID={`${testID}-status`}
        />
        
        {nextChange && (
          <CountdownTimer
            targetTime={nextChange}
            isOpen={isOpen}
            onStatusUpdate={handleStatusUpdate}
            testID={`${testID}-countdown`}
          />
        )}
      </View>

      {/* Weekly Schedule Toggle */}
      {showWeeklyView && (
        <>
          <TouchableOpacity
            style={styles.scheduleToggle}
            onPress={toggleSchedule}
            accessibilityRole="button"
            accessibilityLabel={showSchedule ? "Hide weekly schedule" : "Show weekly schedule"}
            testID={`${testID}-schedule-toggle`}
          >
            <Text style={styles.scheduleToggleText}>
              {showSchedule ? 'Hide Schedule' : 'View Schedule'}
            </Text>
            <Animated.View
              style={[
                styles.chevron,
                {
                  transform: [{
                    rotate: animationValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  }],
                },
              ]}
            >
              <Text style={styles.chevronText}>▼</Text>
            </Animated.View>
          </TouchableOpacity>

          {/* Weekly Schedule */}
          <Animated.View
            style={[
              styles.scheduleContainer,
              {
                maxHeight: animationValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 300],
                }),
                opacity: animationValue,
              },
            ]}
          >
            <WeeklySchedule
              hours={hours}
              timezone={timezone}
              testID={`${testID}-weekly-schedule`}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginVertical: 4,
  },
  statusSection: {
    marginBottom: 12,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  scheduleToggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  chevron: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  scheduleContainer: {
    overflow: 'hidden',
  },
});