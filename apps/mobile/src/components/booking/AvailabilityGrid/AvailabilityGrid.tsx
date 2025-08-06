import React, { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { TimeSlot } from '../TimeSlot/TimeSlot';
import { styles } from './styles';
import type { AvailabilityGridProps, TimeSlotData } from './types';

export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
  timeSlots,
  onTimeSlotPress,
  selectedSlot,
  numColumns = 2,
  theme = 'light',
  showPricing = true,
  groupByPeriod = true,
}) => {
  // Group time slots by time period (morning, afternoon, evening)
  const groupedSlots = useMemo(() => {
    if (!groupByPeriod) {
      return [{ title: 'Available Times', slots: timeSlots }];
    }

    const groups = {
      morning: { title: 'Morning', slots: [] as TimeSlotData[] },
      afternoon: { title: 'Afternoon', slots: [] as TimeSlotData[] },
      evening: { title: 'Evening', slots: [] as TimeSlotData[] },
    };

    timeSlots.forEach(slot => {
      const hour = slot.startTime.getHours();
      if (hour < 12) {
        groups.morning.slots.push(slot);
      } else if (hour < 17) {
        groups.afternoon.slots.push(slot);
      } else {
        groups.evening.slots.push(slot);
      }
    });

    return Object.values(groups).filter(group => group.slots.length > 0);
  }, [timeSlots, groupByPeriod]);

  const renderTimeSlot = ({ item, index: _index }: { item: TimeSlotData; index: number }) => (
    <View style={[styles.slotContainer, { flex: 1 / numColumns }]}>
      <TimeSlot
        timeSlot={item}
        onPress={() => onTimeSlotPress(item)}
        isSelected={selectedSlot?.id === item.id}
        showPrice={showPricing}
        theme={theme}
      />
    </View>
  );

  const renderTimeSlotGroup = ({ item }: { item: { title: string; slots: TimeSlotData[] } }) => (
    <View style={styles.groupContainer}>
      <Text style={[styles.groupTitle, theme === 'dark' && styles.groupTitleDark]}>
        {item.title}
      </Text>
      <FlatList
        data={item.slots}
        renderItem={renderTimeSlot}
        numColumns={numColumns}
        keyExtractor={(slot) => slot.id}
        contentContainerStyle={styles.slotsGrid}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.slotSeparator} />}
      />
    </View>
  );

  if (!timeSlots || timeSlots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, theme === 'dark' && styles.emptyTextDark]}>
          No available time slots
        </Text>
        <Text style={[styles.emptySubText, theme === 'dark' && styles.emptySubTextDark]}>
          Please select a different date
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
      <FlatList
        data={groupedSlots}
        renderItem={renderTimeSlotGroup}
        keyExtractor={(group) => group.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ItemSeparatorComponent={() => <View style={styles.groupSeparator} />}
      />
    </View>
  );
};