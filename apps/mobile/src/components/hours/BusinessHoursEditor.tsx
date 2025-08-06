import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Animated,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { HoursTimeSlot, WeeklyHours } from '../../../types/business';
import { TimePickerModal } from './TimePickerModal';
import { HoursValidationService } from '../../../services/hoursValidationService';

interface BusinessHoursEditorProps {
  businessId: string;
  currentHours: WeeklyHours;
  onSave: (hours: WeeklyHours) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  testID?: string;
}

interface DaySchedule {
  day: string;
  displayName: string;
  hours: HoursTimeSlot;
  isExpanded: boolean;
}

const DAYS_OF_WEEK: { key: string; display: string }[] = [
  { key: 'monday', display: 'Monday' },
  { key: 'tuesday', display: 'Tuesday' },
  { key: 'wednesday', display: 'Wednesday' },
  { key: 'thursday', display: 'Thursday' },
  { key: 'friday', display: 'Friday' },
  { key: 'saturday', display: 'Saturday' },
  { key: 'sunday', display: 'Sunday' },
];

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({
  businessId,
  currentHours,
  onSave,
  onCancel,
  isLoading = false,
  testID = 'business-hours-editor'
}) => {
  const [hours, setHours] = useState<WeeklyHours>(currentHours);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTimeSlot, setActiveTimeSlot] = useState<{
    day: string;
    type: 'open' | 'close';
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Animation values for drag-and-drop
  const panY = useRef(new Animated.Value(0)).current;
  const draggedItemIndex = useRef<number | null>(null);

  const schedules: DaySchedule[] = DAYS_OF_WEEK.map(day => ({
    day: day.key,
    displayName: day.display,
    hours: hours[day.key] || { closed: true },
    isExpanded: false,
  }));

  // Validation service
  const validationService = new HoursValidationService();

  const validateHours = useCallback((hoursToValidate: WeeklyHours): string[] => {
    const errors: string[] = [];
    
    Object.entries(hoursToValidate).forEach(([day, dayHours]) => {
      if (!dayHours.closed) {
        const validation = validationService.validateDayHours(day, dayHours);
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
      }
    });

    return errors;
  }, [validationService]);

  const updateDayHours = useCallback((day: string, newHours: HoursTimeSlot) => {
    const updatedHours = { ...hours, [day]: newHours };
    setHours(updatedHours);
    setIsDirty(true);
    
    // Real-time validation
    const errors = validateHours(updatedHours);
    setValidationErrors(errors);
  }, [hours, validateHours]);

  const toggleDayClosed = useCallback((day: string) => {
    const currentDayHours = hours[day] || { closed: true };
    const newHours: HoursTimeSlot = currentDayHours.closed
      ? { closed: false, open: '09:00', close: '17:00' }
      : { closed: true };
    
    updateDayHours(day, newHours);
  }, [hours, updateDayHours]);

  const updateTime = useCallback((day: string, type: 'open' | 'close', time: string) => {
    const currentDayHours = hours[day] || { closed: false, open: '09:00', close: '17:00' };
    if (!currentDayHours.closed) {
      const updatedDayHours = { ...currentDayHours, [type]: time };
      updateDayHours(day, updatedDayHours);
    }
  }, [hours, updateDayHours]);

  const copyToAllDays = useCallback((sourceDay: string) => {
    const sourceHours = hours[sourceDay];
    if (!sourceHours) return;

    Alert.alert(
      'Copy Hours',
      `Copy ${DAYS_OF_WEEK.find(d => d.key === sourceDay)?.display} hours to all other days?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            const updatedHours = { ...hours };
            DAYS_OF_WEEK.forEach(day => {
              if (day.key !== sourceDay) {
                updatedHours[day.key] = { ...sourceHours };
              }
            });
            setHours(updatedHours);
            setIsDirty(true);
          }
        }
      ]
    );
  }, [hours]);

  const applyBusinessHoursTemplate = useCallback((template: 'standard' | 'retail' | 'restaurant' | 'custom') => {
    let templateHours: WeeklyHours;

    switch (template) {
      case 'standard':
        templateHours = {
          monday: { closed: false, open: '09:00', close: '17:00' },
          tuesday: { closed: false, open: '09:00', close: '17:00' },
          wednesday: { closed: false, open: '09:00', close: '17:00' },
          thursday: { closed: false, open: '09:00', close: '17:00' },
          friday: { closed: false, open: '09:00', close: '17:00' },
          saturday: { closed: true },
          sunday: { closed: true },
        };
        break;
      case 'retail':
        templateHours = {
          monday: { closed: false, open: '10:00', close: '19:00' },
          tuesday: { closed: false, open: '10:00', close: '19:00' },
          wednesday: { closed: false, open: '10:00', close: '19:00' },
          thursday: { closed: false, open: '10:00', close: '19:00' },
          friday: { closed: false, open: '10:00', close: '20:00' },
          saturday: { closed: false, open: '10:00', close: '20:00' },
          sunday: { closed: false, open: '11:00', close: '18:00' },
        };
        break;
      case 'restaurant':
        templateHours = {
          monday: { closed: true },
          tuesday: { closed: false, open: '11:00', close: '22:00' },
          wednesday: { closed: false, open: '11:00', close: '22:00' },
          thursday: { closed: false, open: '11:00', close: '22:00' },
          friday: { closed: false, open: '11:00', close: '23:00' },
          saturday: { closed: false, open: '11:00', close: '23:00' },
          sunday: { closed: false, open: '11:00', close: '21:00' },
        };
        break;
      default:
        return;
    }

    setHours(templateHours);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const errors = validateHours(hours);
    if (errors.length > 0) {
      Alert.alert(
        'Validation Error',
        'Please fix the following issues:\n' + errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await onSave(hours);
      setIsDirty(false);
    } catch (error) {
      Alert.alert(
        'Save Error',
        'Unable to save business hours. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [hours, validateHours, onSave]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to cancel?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', onPress: onCancel }
        ]
      );
    } else {
      onCancel();
    }
  }, [isDirty, onCancel]);

  const renderDayEditor = (schedule: DaySchedule, index: number) => {
    const { day, displayName, hours: dayHours } = schedule;
    const hasError = validationErrors.some(error => error.includes(displayName));

    return (
      <View key={day} style={[styles.dayContainer, hasError && styles.errorContainer]}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayName}>{displayName}</Text>
          <View style={styles.dayControls}>
            <Text style={styles.closedLabel}>Closed</Text>
            <Switch
              value={!dayHours.closed}
              onValueChange={() => toggleDayClosed(day)}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={dayHours.closed ? '#F4F3F4' : '#FFF'}
              testID={`${testID}-${day}-toggle`}
            />
            {!dayHours.closed && (
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyToAllDays(day)}
                testID={`${testID}-${day}-copy`}
              >
                <Icon name="content-copy" size={20} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!dayHours.closed && (
          <View style={styles.timeControls}>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setActiveTimeSlot({ day, type: 'open' })}
              testID={`${testID}-${day}-open-time`}
            >
              <Text style={styles.timeLabel}>Open</Text>
              <Text style={styles.timeValue}>{dayHours.open || '09:00'}</Text>
            </TouchableOpacity>

            <Icon name="arrow-forward" size={20} color="#666" style={styles.arrowIcon} />

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setActiveTimeSlot({ day, type: 'close' })}
              testID={`${testID}-${day}-close-time`}
            >
              <Text style={styles.timeLabel}>Close</Text>
              <Text style={styles.timeValue}>{dayHours.close || '17:00'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasError && (
          <View style={styles.errorMessages}>
            {validationErrors
              .filter(error => error.includes(displayName))
              .map((error, idx) => (
                <Text key={idx} style={styles.errorText}>{error}</Text>
              ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} testID={`${testID}-cancel`}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Business Hours</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading || validationErrors.length > 0}
          testID={`${testID}-save`}
        >
          <Text style={[
            styles.saveButton,
            (isLoading || validationErrors.length > 0) && styles.saveButtonDisabled
          ]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.templateSection}>
        <Text style={styles.sectionTitle}>Quick Templates</Text>
        <View style={styles.templateButtons}>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => applyBusinessHoursTemplate('standard')}
            testID={`${testID}-template-standard`}
          >
            <Text style={styles.templateButtonText}>Business (9-5)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => applyBusinessHoursTemplate('retail')}
            testID={`${testID}-template-retail`}
          >
            <Text style={styles.templateButtonText}>Retail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => applyBusinessHoursTemplate('restaurant')}
            testID={`${testID}-template-restaurant`}
          >
            <Text style={styles.templateButtonText}>Restaurant</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {schedules.map((schedule, index) => renderDayEditor(schedule, index))}
      </ScrollView>

      {validationErrors.length > 0 && (
        <View style={styles.validationSummary}>
          <Icon name="error" size={16} color="#F44336" />
          <Text style={styles.validationSummaryText}>
            {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}

      {activeTimeSlot && (
        <TimePickerModal
          isVisible={true}
          initialTime={
            hours[activeTimeSlot.day]?.[activeTimeSlot.type] || 
            (activeTimeSlot.type === 'open' ? '09:00' : '17:00')
          }
          onTimeSelect={(time) => {
            updateTime(activeTimeSlot.day, activeTimeSlot.type, time);
            setActiveTimeSlot(null);
          }}
          onCancel={() => setActiveTimeSlot(null)}
          title={`Select ${activeTimeSlot.type === 'open' ? 'Opening' : 'Closing'} Time`}
          testID={`${testID}-time-picker`}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
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
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButtonDisabled: {
    color: '#CCC',
  },
  templateSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  templateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  templateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  dayContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  errorContainer: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closedLabel: {
    fontSize: 14,
    color: '#666',
  },
  copyButton: {
    padding: 4,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  arrowIcon: {
    marginHorizontal: 12,
  },
  errorMessages: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginBottom: 2,
  },
  validationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  validationSummaryText: {
    fontSize: 14,
    color: '#F44336',
  },
});