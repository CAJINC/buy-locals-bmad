import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface DatePickerModalProps {
  isVisible: boolean;
  initialDate: string; // YYYY-MM-DD format
  onDateSelect: (date: string) => void;
  onCancel: () => void;
  title?: string;
  testID?: string;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isVisible,
  initialDate,
  onDateSelect,
  onCancel,
  title = 'Select Date',
  testID = 'date-picker-modal'
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date(initialDate || new Date()));

  const handleConfirm = useCallback(() => {
    const dateString = selectedDate.toISOString().split('T')[0];
    onDateSelect(dateString);
  }, [selectedDate, onDateSelect]);

  const getMonthDays = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const selectDay = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(day);
    setSelectedDate(newDate);
  };

  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getMonthDays(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const selectedDay = selectedDate.getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Create calendar grid
    const calendarDays: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }

    return (
      <View style={styles.calendarContainer}>
        {/* Month/Year Header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('prev')}
            testID={`${testID}-prev-month`}
          >
            <Icon name="chevron-left" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <Text style={styles.monthYearText}>
            {monthNames[month]} {year}
          </Text>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('next')}
            testID={`${testID}-next-month`}
          >
            <Icon name="chevron-right" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Day Names Header */}
        <View style={styles.dayNamesContainer}>
          {dayNames.map(dayName => (
            <Text key={dayName} style={styles.dayNameText}>
              {dayName}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.calendarRow}>
              {calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7).map((day, colIndex) => {
                if (day === null) {
                  return <View key={colIndex} style={styles.emptyDay} />;
                }

                const dayDate = new Date(year, month, day);
                const isToday = dayDate.toDateString() === today.toDateString();
                const isSelected = day === selectedDay;
                const isPast = dayDate < today;

                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={[
                      styles.dayButton,
                      isSelected && styles.selectedDay,
                      isToday && !isSelected && styles.todayDay,
                      isPast && styles.pastDay,
                    ]}
                    onPress={() => selectDay(day)}
                    disabled={isPast}
                    testID={`${testID}-day-${day}`}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      isToday && !isSelected && styles.todayDayText,
                      isPast && styles.pastDayText,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderQuickSelect = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const quickDates = [
      { date: today, label: 'Today' },
      { date: tomorrow, label: 'Tomorrow' },
      { date: nextWeek, label: 'Next Week' },
      { date: nextMonth, label: 'Next Month' },
    ];

    return (
      <View style={styles.quickSelectContainer}>
        <Text style={styles.quickSelectLabel}>Quick Select</Text>
        <View style={styles.quickSelectButtons}>
          {quickDates.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickSelectButton}
              onPress={() => setSelectedDate(new Date(item.date))}
              testID={`${testID}-quick-${index}`}
            >
              <Text style={styles.quickSelectButtonText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} testID={`${testID}-cancel`}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} testID={`${testID}-confirm`}>
              <Text style={styles.confirmButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewContainer}>
            <Text style={styles.previewText}>
              {selectedDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {renderCalendar()}
            {renderQuickSelect()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollContainer: {
    flex: 1,
  },
  calendarContainer: {
    padding: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  dayNamesContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayNameText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    paddingVertical: 8,
  },
  calendarGrid: {
    gap: 4,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyDay: {
    flex: 1,
    height: 44,
  },
  dayButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  selectedDay: {
    backgroundColor: '#007AFF',
  },
  todayDay: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  pastDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFF',
    fontWeight: '600',
  },
  todayDayText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  pastDayText: {
    color: '#999',
  },
  quickSelectContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 20,
    paddingTop: 20,
  },
  quickSelectLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  quickSelectButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: '45%',
    alignItems: 'center',
  },
  quickSelectButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});