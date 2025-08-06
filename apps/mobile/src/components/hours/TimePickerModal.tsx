import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TimePickerModalProps {
  isVisible: boolean;
  initialTime: string; // HH:MM format
  onTimeSelect: (time: string) => void;
  onCancel: () => void;
  title?: string;
  testID?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isVisible,
  initialTime,
  onTimeSelect,
  onCancel,
  title = 'Select Time',
  testID = 'time-picker-modal'
}) => {
  const [selectedHour, setSelectedHour] = useState(() => {
    const [hour] = initialTime.split(':');
    return parseInt(hour, 10);
  });

  const [selectedMinute, setSelectedMinute] = useState(() => {
    const [, minute] = initialTime.split(':');
    return parseInt(minute, 10);
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45]; // 15-minute intervals

  const formatTime = useCallback((hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }, []);

  const handleConfirm = useCallback(() => {
    const timeString = formatTime(selectedHour, selectedMinute);
    onTimeSelect(timeString);
  }, [selectedHour, selectedMinute, formatTime, onTimeSelect]);

  const renderTimeColumn = (
    items: number[],
    selectedValue: number,
    onValueChange: (value: number) => void,
    suffix: string = ''
  ) => (
    <View style={styles.columnContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        snapToInterval={50}
        decelerationRate="fast"
      >
        {items.map(item => (
          <TouchableOpacity
            key={item}
            style={[
              styles.timeItem,
              selectedValue === item && styles.selectedTimeItem
            ]}
            onPress={() => onValueChange(item)}
            testID={`${testID}-${suffix}-${item}`}
          >
            <Text style={[
              styles.timeText,
              selectedValue === item && styles.selectedTimeText
            ]}>
              {item.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const formatDisplayTime = (hour: number, minute: number): string => {
    const timeString = formatTime(hour, minute);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    
    return `${timeString} (${date.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })})`;
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
              {formatDisplayTime(selectedHour, selectedMinute)}
            </Text>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Hour</Text>
              {renderTimeColumn(hours, selectedHour, setSelectedHour, 'hour')}
            </View>

            <View style={styles.separator}>
              <Text style={styles.separatorText}>:</Text>
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Minute</Text>
              {renderTimeColumn(minutes, selectedMinute, setSelectedMinute, 'minute')}
            </View>
          </View>

          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectLabel}>Quick Select</Text>
            <View style={styles.quickSelectButtons}>
              {[
                { hour: 9, minute: 0, label: '9:00 AM' },
                { hour: 12, minute: 0, label: '12:00 PM' },
                { hour: 17, minute: 0, label: '5:00 PM' },
                { hour: 21, minute: 0, label: '9:00 PM' },
              ].map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickSelectButton}
                  onPress={() => {
                    setSelectedHour(time.hour);
                    setSelectedMinute(time.minute);
                  }}
                  testID={`${testID}-quick-${index}`}
                >
                  <Text style={styles.quickSelectButtonText}>{time.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
    maxHeight: '70%',
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
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSection: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  columnContainer: {
    height: 200,
    width: 80,
  },
  scrollContainer: {
    paddingVertical: 75, // Center the initial selection
  },
  timeItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedTimeItem: {
    backgroundColor: '#007AFF',
  },
  timeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  selectedTimeText: {
    color: '#FFF',
    fontWeight: '600',
  },
  separator: {
    paddingHorizontal: 20,
    paddingTop: 32, // Align with picker labels
  },
  separatorText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  quickSelectContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  quickSelectLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  quickSelectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickSelectButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickSelectButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
});