import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface CountdownTimerProps {
  targetTime: string;
  isOpen: boolean;
  compact?: boolean;
  onStatusUpdate?: (status: { isOpen: boolean; nextChange: string | null }) => void;
  testID?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetTime,
  isOpen,
  compact = false,
  onStatusUpdate,
  testID = 'countdown-timer',
}) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  const calculateTimeRemaining = useCallback(() => {
    const target = new Date(targetTime);
    const now = new Date();
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      // Time has passed, trigger status update
      onStatusUpdate?.({ isOpen: !isOpen, nextChange: null });
      return { hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, total: diff };
  }, [targetTime, isOpen, onStatusUpdate]);

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining());
    };

    // Initial calculation
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  const getTimerText = () => {
    const { hours, minutes, seconds, total } = timeRemaining;
    
    if (total <= 0) {
      return 'Status changed';
    }

    if (hours > 0) {
      return compact 
        ? `${hours}h ${minutes}m`
        : `${hours}h ${minutes}m`;
    }
    
    if (minutes > 0) {
      return compact 
        ? `${minutes}m`
        : `${minutes} min`;
    }
    
    return compact 
      ? `${seconds}s`
      : `${seconds} sec`;
  };

  const getTimerLabel = () => {
    if (timeRemaining.total <= 0) {
      return '';
    }
    
    return isOpen ? 'Closes in' : 'Opens in';
  };

  const getTimerColor = () => {
    const { total } = timeRemaining;
    
    if (total <= 0) {
      return '#6B7280'; // Gray
    }
    
    if (isOpen) {
      // Closing - warning colors as time gets closer
      if (total <= 15 * 60 * 1000) { // 15 minutes
        return '#EF4444'; // Red
      } else if (total <= 30 * 60 * 1000) { // 30 minutes
        return '#F59E0B'; // Amber
      } else {
        return '#10B981'; // Green
      }
    } else {
      // Opening - positive blue color
      return '#3B82F6'; // Blue
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        <Text 
          style={[
            styles.compactTimerText,
            { color: getTimerColor() }
          ]}
          testID={`${testID}-text`}
        >
          {getTimerText()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {timeRemaining.total > 0 && (
        <>
          <Text 
            style={styles.timerLabel}
            testID={`${testID}-label`}
          >
            {getTimerLabel()}
          </Text>
          <Text 
            style={[
              styles.timerText,
              { color: getTimerColor() }
            ]}
            testID={`${testID}-text`}
          >
            {getTimerText()}
          </Text>
        </>
      )}
      
      {timeRemaining.total <= 0 && (
        <Text 
          style={[
            styles.statusChangedText,
            { color: getTimerColor() }
          ]}
          testID={`${testID}-status-changed`}
        >
          Status updating...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  compactContainer: {
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  compactTimerText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  statusChangedText: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
  },
});