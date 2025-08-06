import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList
} from 'react-native';
import type { CalendarViewProps, ReservationListItem, CalendarEvent } from '../types';
import { calendarStyles as styles } from './CalendarView.styles';

export const CalendarView: React.FC<CalendarViewProps> = ({
  reservations,
  theme = 'light',
  businessInfo,
  onDateSelect,
  onReservationPress,
  selectedDate = new Date()
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate calendar events from reservations
  const calendarEvents = useMemo(() => {
    return reservations.map(reservation => ({
      id: reservation.id,
      title: `${reservation.customerName} - ${reservation.serviceType}`,
      startTime: reservation.scheduledAt,
      endTime: new Date(reservation.scheduledAt.getTime() + reservation.duration * 60 * 1000),
      status: reservation.status,
      customerName: reservation.customerName,
      serviceType: reservation.serviceType,
      totalAmount: reservation.totalAmount,
      color: getStatusColor(reservation.status)
    }));
  }, [reservations]);

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return '#28a745';
      case 'pending': return '#ffc107';
      case 'completed': return '#6f42c1';
      case 'cancelled': return '#dc3545';
      case 'expired': return '#6c757d';
      default: return '#007bff';
    }
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return calendarEvents.filter(event => 
      event.startTime.toDateString() === date.toDateString()
    ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  };

  // Generate calendar days for current month
  const generateCalendarDays = (): Date[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
      days.push(new Date(startDate));
      startDate.setDate(startDate.getDate() + 1);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date): boolean => {
    return date.toDateString() === selectedDate.toDateString();
  };

  // Check if date is in current month
  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // Render calendar header
  const renderCalendarHeader = () => (
    <View style={styles.calendarHeader}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigateMonth('prev')}
      >
        <Text style={styles.navButtonText}>‹</Text>
      </TouchableOpacity>
      
      <Text style={[
        styles.monthTitle,
        theme === 'dark' && styles.monthTitleDark
      ]}>
        {currentMonth.toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        })}
      </Text>
      
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigateMonth('next')}
      >
        <Text style={styles.navButtonText}>›</Text>
      </TouchableOpacity>
    </View>
  );

  // Render weekday headers
  const renderWeekdayHeaders = () => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <View style={styles.weekdayHeaders}>
        {weekdays.map(day => (
          <Text
            key={day}
            style={[
              styles.weekdayText,
              theme === 'dark' && styles.weekdayTextDark
            ]}
          >
            {day}
          </Text>
        ))}
      </View>
    );
  };

  // Render calendar day
  const renderCalendarDay = (date: Date, index: number) => {
    const dayEvents = getEventsForDate(date);
    const isCurrentMonthDay = isCurrentMonth(date);
    const isTodayDate = isToday(date);
    const isSelectedDate = isSelected(date);

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.calendarDay,
          isTodayDate && styles.calendarDayToday,
          isSelectedDate && styles.calendarDaySelected,
          !isCurrentMonthDay && styles.calendarDayOtherMonth,
          theme === 'dark' && styles.calendarDayDark
        ]}
        onPress={() => onDateSelect?.(date)}
      >
        <Text style={[
          styles.calendarDayText,
          isTodayDate && styles.calendarDayTextToday,
          isSelectedDate && styles.calendarDayTextSelected,
          !isCurrentMonthDay && styles.calendarDayTextOtherMonth,
          theme === 'dark' && styles.calendarDayTextDark
        ]}>
          {date.getDate()}
        </Text>
        
        {/* Event indicators */}
        {dayEvents.length > 0 && (
          <View style={styles.eventIndicators}>
            {dayEvents.slice(0, 3).map((event, eventIndex) => (
              <View
                key={eventIndex}
                style={[
                  styles.eventDot,
                  { backgroundColor: event.color }
                ]}
              />
            ))}
            {dayEvents.length > 3 && (
              <Text style={styles.moreEventsText}>+{dayEvents.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render calendar grid
  const renderCalendarGrid = () => (
    <View style={styles.calendarGrid}>
      {calendarDays.map((date, index) => renderCalendarDay(date, index))}
    </View>
  );

  // Render event list for selected date
  const renderEventList = () => {
    const selectedEvents = getEventsForDate(selectedDate);

    if (selectedEvents.length === 0) {
      return (
        <View style={styles.noEventsContainer}>
          <Text style={styles.noEventsIcon}>📅</Text>
          <Text style={[
            styles.noEventsText,
            theme === 'dark' && styles.noEventsTextDark
          ]}>
            No reservations on {selectedDate.toLocaleDateString()}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={selectedEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderEventItem(item)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.eventListContainer}
      />
    );
  };

  // Render individual event item
  const renderEventItem = (event: CalendarEvent) => {
    const reservation = reservations.find(r => r.id === event.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.eventItem,
          theme === 'dark' && styles.eventItemDark
        ]}
        onPress={() => {
          if (reservation && onReservationPress) {
            onReservationPress(reservation);
          }
        }}
      >
        <View style={styles.eventTimeContainer}>
          <View
            style={[
              styles.eventColorBar,
              { backgroundColor: event.color }
            ]}
          />
          <View style={styles.eventTimeInfo}>
            <Text style={[
              styles.eventTime,
              theme === 'dark' && styles.eventTimeDark
            ]}>
              {event.startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </Text>
            <Text style={[
              styles.eventDuration,
              theme === 'dark' && styles.eventDurationDark
            ]}>
              {Math.round((event.endTime.getTime() - event.startTime.getTime()) / (60 * 1000))}min
            </Text>
          </View>
        </View>

        <View style={styles.eventDetails}>
          <Text style={[
            styles.eventCustomerName,
            theme === 'dark' && styles.eventCustomerNameDark
          ]}>
            {event.customerName}
          </Text>
          <Text style={[
            styles.eventServiceType,
            theme === 'dark' && styles.eventServiceTypeDark
          ]}>
            {event.serviceType}
          </Text>
          {event.totalAmount && (
            <Text style={[
              styles.eventAmount,
              theme === 'dark' && styles.eventAmountDark
            ]}>
              ${event.totalAmount.toFixed(2)}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.eventStatusBadge,
            { backgroundColor: event.color }
          ]}
        >
          <Text style={styles.eventStatusText}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.container,
      theme === 'dark' && styles.containerDark
    ]}>
      {/* Calendar Header */}
      {renderCalendarHeader()}

      {/* Calendar */}
      <View style={styles.calendarContainer}>
        {renderWeekdayHeaders()}
        {renderCalendarGrid()}
      </View>

      {/* Selected Date Header */}
      <View style={styles.selectedDateHeader}>
        <Text style={[
          styles.selectedDateTitle,
          theme === 'dark' && styles.selectedDateTitleDark
        ]}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
      </View>

      {/* Event List */}
      <View style={styles.eventListWrapper}>
        {renderEventList()}
      </View>
    </View>
  );
};