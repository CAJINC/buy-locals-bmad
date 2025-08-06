import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { styles } from './styles';
import { AvailabilityGrid } from '../AvailabilityGrid/AvailabilityGrid';
import type { TimeSlotData, BookingCalendarProps, CalendarView } from './types';

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  businessId,
  serviceId,
  serviceDuration = 60,
  onTimeSlotSelected,
  onError,
  initialDate = new Date(),
  minDate = new Date(),
  maxDate,
  timezone: _timezone = 'America/New_York',
  theme = 'light'
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlotData | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>('month');

  // Generate calendar dates for current view
  const calendarDates = useMemo(() => {
    const dates: Date[] = [];
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    if (view === 'month') {
      // Start from first day of month
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      
      // Add dates from first day to last day of month
      for (let date = 1; date <= lastDay.getDate(); date++) {
        const fullDate = new Date(currentYear, currentMonth, date);
        if (fullDate >= minDate) {
          if (!maxDate || fullDate <= maxDate) {
            dates.push(fullDate);
          }
        }
      }
    } else if (view === 'week') {
      // Get current week
      const startOfWeek = new Date(selectedDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        if (date >= minDate) {
          if (!maxDate || date <= maxDate) {
            dates.push(date);
          }
        }
      }
    }

    return dates;
  }, [selectedDate, view, minDate, maxDate]);

  // Fetch available time slots for selected date
  const fetchAvailability = useCallback(async (date: Date) => {
    if (!businessId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/availability?date=${date.toISOString().split('T')[0]}${serviceId ? `&serviceId=${serviceId}` : ''}&duration=${serviceDuration}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data.availability) {
        const slots: TimeSlotData[] = data.data.availability.map((slot: Record<string, unknown>) => ({
          id: `${slot.startTime}-${slot.endTime}`,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          isAvailable: slot.isAvailable,
          price: slot.price,
          serviceId: slot.serviceId,
          isSelected: false,
        }));
        
        setAvailableSlots(slots);
      } else {
        setAvailableSlots([]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available time slots';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, serviceId, serviceDuration, onError, getAuthToken]);

  // Handle date selection
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
  }, []);

  // Handle time slot selection
  const handleTimeSlotSelect = useCallback((slot: TimeSlotData) => {
    if (!slot.isAvailable) return;
    
    setSelectedTimeSlot(slot);
    
    // Update availability grid to show selection
    setAvailableSlots(prevSlots =>
      prevSlots.map(s => ({
        ...s,
        isSelected: s.id === slot.id
      }))
    );
    
    onTimeSlotSelected?.(slot);
  }, [onTimeSlotSelected]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailability(selectedDate);
  }, [selectedDate, fetchAvailability]);

  // Navigation helpers
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  }, [selectedDate]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setSelectedDate(newDate);
  }, [selectedDate]);

  // Format date for display
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatMonthYear = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Get auth token (placeholder - implement based on your auth system)
  const getAuthToken = useCallback(async (): Promise<string> => {
    // TODO: Implement actual token retrieval
    return 'mock-token';
  }, []);

  // Effects
  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, fetchAvailability]);

  const isToday = useCallback((date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  const isSelected = useCallback((date: Date): boolean => {
    return date.toDateString() === selectedDate.toDateString();
  }, [selectedDate]);

  return (
    <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
      {/* Header with view toggle and navigation */}
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, view === 'month' && styles.viewButtonActive]}
            onPress={() => setView('month')}
            accessibilityLabel="Month view"
          >
            <Text style={[styles.viewButtonText, view === 'month' && styles.viewButtonTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, view === 'week' && styles.viewButtonActive]}
            onPress={() => setView('week')}
            accessibilityLabel="Week view"
          >
            <Text style={[styles.viewButtonText, view === 'week' && styles.viewButtonTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
            accessibilityLabel={`Previous ${view}`}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            {view === 'month' ? formatMonthYear(selectedDate) : `Week of ${formatDate(selectedDate)}`}
          </Text>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}
            accessibilityLabel={`Next ${view}`}
          >
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme === 'dark' ? '#ffffff' : '#000000'}
          />
        }
      >
        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDates.map((date, index) => {
            const isDateSelected = isSelected(date);
            const isDateToday = isToday(date);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateButton,
                  isDateSelected && styles.dateButtonSelected,
                  isDateToday && styles.dateButtonToday,
                ]}
                onPress={() => handleDateSelect(date)}
                accessibilityLabel={`Select date ${formatDate(date)}`}
                accessibilityState={{ selected: isDateSelected }}
              >
                <Text style={[
                  styles.dateText,
                  isDateSelected && styles.dateTextSelected,
                  isDateToday && styles.dateTextToday,
                ]}>
                  {view === 'month' ? date.getDate() : formatDate(date)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time Slots Section */}
        <View style={styles.timeSlotsSection}>
          <Text style={styles.sectionTitle}>
            Available Times for {formatDate(selectedDate)}
          </Text>
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading available times...</Text>
            </View>
          )}
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => fetchAvailability(selectedDate)}
                accessibilityLabel="Retry loading availability"
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!loading && !error && (
            <AvailabilityGrid
              timeSlots={availableSlots}
              onTimeSlotPress={handleTimeSlotSelect}
              selectedSlot={selectedTimeSlot}
              theme={theme}
            />
          )}
          
          {!loading && !error && availableSlots.length === 0 && (
            <View style={styles.noSlotsContainer}>
              <Text style={styles.noSlotsText}>
                No available time slots for this date
              </Text>
              <Text style={styles.noSlotsSubText}>
                Try selecting a different date or contact the business directly
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};