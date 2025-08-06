import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, AccessibilityInfo } from 'react-native';
import { styles } from './styles';
import type { TimeSlotProps } from './types';

export const TimeSlot: React.FC<TimeSlotProps> = ({
  timeSlot,
  onPress,
  isSelected = false,
  showPrice = true,
  theme = 'light',
  disabled = false,
  size = 'medium',
}) => {
  // Format time display
  const formattedTime = useMemo(() => {
    const startTime = timeSlot.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    const endTime = timeSlot.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return `${startTime} - ${endTime}`;
  }, [timeSlot.startTime, timeSlot.endTime]);

  // Format price display
  const formattedPrice = useMemo(() => {
    if (!timeSlot.price) return null;
    return `$${timeSlot.price.toFixed(2)}`;
  }, [timeSlot.price]);

  // Handle press with accessibility feedback
  const handlePress = () => {
    if (disabled || !timeSlot.isAvailable) return;
    
    AccessibilityInfo.announceForAccessibility(
      `Selected time slot ${formattedTime}${formattedPrice ? ` for ${formattedPrice}` : ''}`
    );
    
    onPress(timeSlot);
  };

  // Determine slot state for styling
  const slotState = useMemo(() => {
    if (disabled) return 'disabled';
    if (!timeSlot.isAvailable) return 'unavailable';
    if (isSelected) return 'selected';
    return 'available';
  }, [disabled, timeSlot.isAvailable, isSelected]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        styles[`container${size.charAt(0).toUpperCase() + size.slice(1)}`],
        styles[`${slotState}Container`],
        theme === 'dark' && styles[`${slotState}ContainerDark`],
      ]}
      onPress={handlePress}
      disabled={disabled || !timeSlot.isAvailable}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Time slot ${formattedTime}${formattedPrice ? `, price ${formattedPrice}` : ''}`}
      accessibilityState={{
        selected: isSelected,
        disabled: disabled || !timeSlot.isAvailable,
      }}
      accessibilityHint={
        timeSlot.isAvailable && !disabled
          ? 'Double tap to select this time slot'
          : 'This time slot is not available'
      }
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.timeText,
            styles[`timeText${size.charAt(0).toUpperCase() + size.slice(1)}`],
            styles[`${slotState}TimeText`],
            theme === 'dark' && styles[`${slotState}TimeTextDark`],
          ]}
          numberOfLines={1}
        >
          {formattedTime}
        </Text>
        
        {showPrice && formattedPrice && (
          <Text
            style={[
              styles.priceText,
              styles[`priceText${size.charAt(0).toUpperCase() + size.slice(1)}`],
              styles[`${slotState}PriceText`],
              theme === 'dark' && styles[`${slotState}PriceTextDark`],
            ]}
            numberOfLines={1}
          >
            {formattedPrice}
          </Text>
        )}
        
        {slotState === 'unavailable' && (
          <View style={styles.unavailableOverlay}>
            <Text style={[styles.unavailableText, theme === 'dark' && styles.unavailableTextDark]}>
              Booked
            </Text>
          </View>
        )}
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIcon}>✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};