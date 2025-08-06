import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BusinessHours, DaySchedule } from '../../types/business';

export interface WeeklyScheduleProps {
  hours: BusinessHours;
  timezone: string;
  compact?: boolean;
  testID?: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({
  hours,
  timezone,
  compact = false,
  testID = 'weekly-schedule',
}) => {
  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];

  const getCurrentDay = () => {
    const now = new Date();
    const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Adjust to our array (Monday = 0)
    return daysOfWeek[adjustedIndex]?.key;
  };

  const currentDay = getCurrentDay();

  const formatTime = (time: string) => {
    try {
      // Handle 24-hour format (e.g., "09:00")
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      return date.toLocaleTimeString([], { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return time; // Return as-is if parsing fails
    }
  };

  const formatDaySchedule = (schedule: DaySchedule) => {
    if (!schedule || schedule.closed) {
      return 'Closed';
    }

    if (schedule.open && schedule.close) {
      const openTime = formatTime(schedule.open);
      const closeTime = formatTime(schedule.close);
      
      // Handle overnight businesses
      const openHour = parseInt(schedule.open.split(':')[0]);
      const closeHour = parseInt(schedule.close.split(':')[0]);
      
      if (closeHour < openHour || (closeHour === 0 && openHour > 0)) {
        return `${openTime} - ${closeTime} (+1)`;
      }
      
      return `${openTime} - ${closeTime}`;
    }

    return 'Closed';
  };

  const isToday = (dayKey: string) => dayKey === currentDay;

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        {daysOfWeek.map(({ key, short }) => {
          const schedule = hours[key as keyof BusinessHours] as DaySchedule;
          const today = isToday(key);
          
          return (
            <View 
              key={key}
              style={[
                styles.compactDayRow,
                today && styles.compactTodayRow
              ]}
              testID={`${testID}-day-${key}`}
            >
              <Text 
                style={[
                  styles.compactDayLabel,
                  today && styles.compactTodayLabel
                ]}
              >
                {short}
              </Text>
              <Text 
                style={[
                  styles.compactDayTime,
                  today && styles.compactTodayTime
                ]}
              >
                {formatDaySchedule(schedule)}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.header}>Weekly Hours</Text>
      <Text style={styles.timezone}>Timezone: {timezone}</Text>
      
      {daysOfWeek.map(({ key, label }) => {
        const schedule = hours[key as keyof BusinessHours] as DaySchedule;
        const today = isToday(key);
        
        return (
          <View 
            key={key}
            style={[
              styles.dayRow,
              today && styles.todayRow
            ]}
            testID={`${testID}-day-${key}`}
          >
            <Text 
              style={[
                styles.dayLabel,
                today && styles.todayLabel
              ]}
            >
              {label}
            </Text>
            <Text 
              style={[
                styles.dayTime,
                today && styles.todayTime
              ]}
            >
              {formatDaySchedule(schedule)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 8,
  },
  compactContainer: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  timezone: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  compactDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginVertical: 1,
    borderRadius: 4,
  },
  todayRow: {
    backgroundColor: '#E0F2FE',
  },
  compactTodayRow: {
    backgroundColor: '#E0F2FE',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  compactDayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  todayLabel: {
    color: '#0369A1',
    fontWeight: '600',
  },
  compactTodayLabel: {
    color: '#0369A1',
    fontWeight: '600',
  },
  dayTime: {
    fontSize: 14,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  compactDayTime: {
    fontSize: 11,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  todayTime: {
    color: '#0369A1',
    fontWeight: '500',
  },
  compactTodayTime: {
    color: '#0369A1',
    fontWeight: '500',
  },
});