import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SpecialHours, HoursTimeSlot } from '../../../types/business';
import { DatePickerModal } from './DatePickerModal';
import { TimePickerModal } from './TimePickerModal';
import { SpecialHoursService } from '../../../services/specialHoursService';

interface SpecialHoursManagerProps {
  businessId: string;
  currentSpecialHours?: SpecialHours[];
  onSave: (specialHours: SpecialHours[]) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  testID?: string;
}

interface EditingSpecialHours extends SpecialHours {
  isEditing?: boolean;
  isNew?: boolean;
}

const HOLIDAY_TEMPLATES = [
  { name: 'Christmas Day', date: '2024-12-25', closed: true },
  { name: 'New Year\'s Day', date: '2025-01-01', closed: true },
  { name: 'Independence Day', date: '2024-07-04', closed: true },
  { name: 'Thanksgiving', date: '2024-11-28', closed: true },
  { name: 'Black Friday', date: '2024-11-29', hours: { closed: false, open: '06:00', close: '23:00' } },
  { name: 'Christmas Eve', date: '2024-12-24', hours: { closed: false, open: '09:00', close: '15:00' } },
  { name: 'New Year\'s Eve', date: '2024-12-31', hours: { closed: false, open: '10:00', close: '18:00' } },
];

export const SpecialHoursManager: React.FC<SpecialHoursManagerProps> = ({
  businessId,
  currentSpecialHours = [],
  onSave,
  onCancel,
  isLoading = false,
  testID = 'special-hours-manager'
}) => {
  const [specialHours, setSpecialHours] = useState<EditingSpecialHours[]>(
    currentSpecialHours.map(item => ({ ...item, isEditing: false }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [activeModal, setActiveModal] = useState<{
    type: 'date' | 'time';
    itemId: string;
    timeType?: 'open' | 'close';
  } | null>(null);

  const specialHoursService = new SpecialHoursService();

  // Sort special hours by date
  const sortedSpecialHours = [...specialHours].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const addNewSpecialHours = useCallback(() => {
    const newItem: EditingSpecialHours = {
      id: `new-${Date.now()}`,
      businessId,
      name: '',
      date: new Date().toISOString().split('T')[0],
      isActive: true,
      closed: false,
      hours: { closed: false, open: '09:00', close: '17:00' },
      isEditing: true,
      isNew: true,
    };

    setSpecialHours(prev => [...prev, newItem]);
    setIsDirty(true);
  }, [businessId]);

  const addHolidayTemplate = useCallback((template: typeof HOLIDAY_TEMPLATES[0]) => {
    const existing = specialHours.find(item => item.date === template.date);
    if (existing) {
      Alert.alert('Duplicate Date', 'Special hours for this date already exist.');
      return;
    }

    const newItem: EditingSpecialHours = {
      id: `template-${Date.now()}`,
      businessId,
      name: template.name,
      date: template.date,
      isActive: true,
      closed: template.closed || false,
      hours: template.hours || { closed: false, open: '09:00', close: '17:00' },
      isEditing: false,
      isNew: true,
    };

    setSpecialHours(prev => [...prev, newItem]);
    setIsDirty(true);
  }, [businessId, specialHours]);

  const updateSpecialHours = useCallback((id: string, updates: Partial<EditingSpecialHours>) => {
    setSpecialHours(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
    setIsDirty(true);
  }, []);

  const deleteSpecialHours = useCallback((id: string) => {
    const item = specialHours.find(h => h.id === id);
    Alert.alert(
      'Delete Special Hours',
      `Are you sure you want to delete "${item?.name || 'this special hours entry'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSpecialHours(prev => prev.filter(h => h.id !== id));
            setIsDirty(true);
          }
        }
      ]
    );
  }, [specialHours]);

  const toggleClosed = useCallback((id: string) => {
    const item = specialHours.find(h => h.id === id);
    if (!item) return;

    const updates: Partial<EditingSpecialHours> = {
      closed: !item.closed,
      hours: !item.closed 
        ? { closed: true }
        : { closed: false, open: '09:00', close: '17:00' }
    };

    updateSpecialHours(id, updates);
  }, [specialHours, updateSpecialHours]);

  const updateTime = useCallback((id: string, type: 'open' | 'close', time: string) => {
    const item = specialHours.find(h => h.id === id);
    if (!item || item.closed) return;

    const updatedHours = { ...item.hours, [type]: time };
    updateSpecialHours(id, { hours: updatedHours });
  }, [specialHours, updateSpecialHours]);

  const validateSpecialHours = useCallback((): string[] => {
    const errors: string[] = [];
    const seenDates = new Set<string>();

    specialHours.forEach(item => {
      // Check for empty names
      if (!item.name.trim()) {
        errors.push('All special hours entries must have a name');
      }

      // Check for duplicate dates
      if (seenDates.has(item.date)) {
        errors.push(`Duplicate date found: ${item.date}`);
      }
      seenDates.add(item.date);

      // Check for valid time ranges
      if (!item.closed && item.hours && !item.hours.closed) {
        const openTime = item.hours.open;
        const closeTime = item.hours.close;
        
        if (!openTime || !closeTime) {
          errors.push(`${item.name}: Both open and close times are required`);
        } else if (openTime >= closeTime) {
          errors.push(`${item.name}: Close time must be after open time`);
        }
      }

      // Check for past dates (warning, not error)
      const itemDate = new Date(item.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (itemDate < today && item.isActive) {
        errors.push(`${item.name}: Date is in the past. Consider deactivating.`);
      }
    });

    return errors;
  }, [specialHours]);

  const handleSave = useCallback(async () => {
    const errors = validateSpecialHours();
    if (errors.length > 0) {
      Alert.alert(
        'Validation Errors',
        'Please fix the following issues:\n\n' + errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    // Remove editing flags before saving
    const cleanedHours: SpecialHours[] = specialHours.map(({
      isEditing,
      isNew,
      ...cleanItem
    }) => cleanItem);

    try {
      await onSave(cleanedHours);
      setIsDirty(false);
    } catch (error) {
      Alert.alert(
        'Save Error',
        'Unable to save special hours. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [specialHours, validateSpecialHours, onSave]);

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

  const renderSpecialHoursItem = (item: EditingSpecialHours, index: number) => {
    const isPast = new Date(item.date) < new Date();

    return (
      <View key={item.id} style={[styles.itemContainer, isPast && styles.pastItemContainer]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            {item.isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={item.name}
                onChangeText={(name) => updateSpecialHours(item.id, { name })}
                placeholder="Enter name (e.g., Holiday, Event)"
                testID={`${testID}-${item.id}-name-input`}
              />
            ) : (
              <Text style={styles.itemName}>{item.name}</Text>
            )}
            
            <View style={styles.itemActions}>
              {!item.isEditing && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => updateSpecialHours(item.id, { isEditing: true })}
                  testID={`${testID}-${item.id}-edit`}
                >
                  <Icon name="edit" size={20} color="#007AFF" />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => deleteSpecialHours(item.id)}
                testID={`${testID}-${item.id}-delete`}
              >
                <Icon name="delete" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setActiveModal({ type: 'date', itemId: item.id })}
              testID={`${testID}-${item.id}-date`}
            >
              <Icon name="calendar-today" size={16} color="#666" />
              <Text style={styles.dateText}>
                {new Date(item.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </TouchableOpacity>

            <View style={styles.activeToggle}>
              <Text style={styles.activeLabel}>Active</Text>
              <Switch
                value={item.isActive}
                onValueChange={(isActive) => updateSpecialHours(item.id, { isActive })}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                thumbColor={item.isActive ? '#FFF' : '#F4F3F4'}
                testID={`${testID}-${item.id}-active-toggle`}
              />
            </View>
          </View>
        </View>

        <View style={styles.hoursSection}>
          <View style={styles.closedToggleRow}>
            <Text style={styles.closedLabel}>Closed all day</Text>
            <Switch
              value={item.closed}
              onValueChange={() => toggleClosed(item.id)}
              trackColor={{ false: '#E0E0E0', true: '#F44336' }}
              thumbColor={item.closed ? '#FFF' : '#F4F3F4'}
              testID={`${testID}-${item.id}-closed-toggle`}
            />
          </View>

          {!item.closed && item.hours && !item.hours.closed && (
            <View style={styles.timeControls}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setActiveModal({ 
                  type: 'time', 
                  itemId: item.id, 
                  timeType: 'open' 
                })}
                testID={`${testID}-${item.id}-open-time`}
              >
                <Text style={styles.timeLabel}>Open</Text>
                <Text style={styles.timeValue}>{item.hours.open || '09:00'}</Text>
              </TouchableOpacity>

              <Icon name="arrow-forward" size={20} color="#666" style={styles.arrowIcon} />

              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setActiveModal({ 
                  type: 'time', 
                  itemId: item.id, 
                  timeType: 'close' 
                })}
                testID={`${testID}-${item.id}-close-time`}
              >
                <Text style={styles.timeLabel}>Close</Text>
                <Text style={styles.timeValue}>{item.hours.close || '17:00'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {item.isEditing && (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.editActionButton, styles.cancelEditButton]}
              onPress={() => updateSpecialHours(item.id, { isEditing: false })}
              testID={`${testID}-${item.id}-cancel-edit`}
            >
              <Text style={styles.cancelEditText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionButton, styles.saveEditButton]}
              onPress={() => updateSpecialHours(item.id, { isEditing: false })}
              testID={`${testID}-${item.id}-save-edit`}
            >
              <Text style={styles.saveEditText}>Done</Text>
            </TouchableOpacity>
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
        <Text style={styles.title}>Special Hours</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          testID={`${testID}-save`}
        >
          <Text style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addSection}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={addNewSpecialHours}
          testID={`${testID}-add-custom`}
        >
          <Icon name="add" size={24} color="#007AFF" />
          <Text style={styles.addButtonText}>Add Custom Hours</Text>
        </TouchableOpacity>

        <View style={styles.templateSection}>
          <Text style={styles.sectionTitle}>Holiday Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
            {HOLIDAY_TEMPLATES.map((template, index) => (
              <TouchableOpacity
                key={index}
                style={styles.templateButton}
                onPress={() => addHolidayTemplate(template)}
                testID={`${testID}-template-${index}`}
              >
                <Text style={styles.templateButtonText}>{template.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {sortedSpecialHours.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="event" size={48} color="#CCC" />
            <Text style={styles.emptyStateTitle}>No Special Hours</Text>
            <Text style={styles.emptyStateSubtitle}>
              Add special hours for holidays, events, or temporary schedule changes.
            </Text>
          </View>
        ) : (
          sortedSpecialHours.map((item, index) => renderSpecialHoursItem(item, index))
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      {activeModal?.type === 'date' && (
        <DatePickerModal
          isVisible={true}
          initialDate={specialHours.find(h => h.id === activeModal.itemId)?.date || ''}
          onDateSelect={(date) => {
            updateSpecialHours(activeModal.itemId, { date });
            setActiveModal(null);
          }}
          onCancel={() => setActiveModal(null)}
          testID={`${testID}-date-picker`}
        />
      )}

      {/* Time Picker Modal */}
      {activeModal?.type === 'time' && activeModal.timeType && (
        <TimePickerModal
          isVisible={true}
          initialTime={
            specialHours.find(h => h.id === activeModal.itemId)?.hours?.[activeModal.timeType!] || 
            (activeModal.timeType === 'open' ? '09:00' : '17:00')
          }
          onTimeSelect={(time) => {
            updateTime(activeModal.itemId, activeModal.timeType!, time);
            setActiveModal(null);
          }}
          onCancel={() => setActiveModal(null)}
          title={`Select ${activeModal.timeType === 'open' ? 'Opening' : 'Closing'} Time`}
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
  addSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  templateSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  templateScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  templateButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  templateButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  itemContainer: {
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
  pastItemContainer: {
    opacity: 0.7,
    backgroundColor: '#F8F8F8',
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeLabel: {
    fontSize: 14,
    color: '#666',
  },
  hoursSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  closedToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closedLabel: {
    fontSize: 14,
    color: '#666',
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
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  editActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelEditButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelEditText: {
    fontSize: 14,
    color: '#666',
  },
  saveEditButton: {
    backgroundColor: '#007AFF',
  },
  saveEditText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});