import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const DAY_SIZE = (width - 40) / 7; // 7 days per week with padding

export const calendarStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  navButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  monthTitleDark: {
    color: '#ffffff',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  weekdayHeaders: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  weekdayText: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
  },
  weekdayTextDark: {
    color: '#a0a0a0',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 20,
  },
  calendarDay: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 6,
    marginBottom: 4,
    position: 'relative',
  },
  calendarDayDark: {
    backgroundColor: 'transparent',
  },
  calendarDayToday: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  calendarDaySelected: {
    backgroundColor: '#007bff',
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  calendarDayTextDark: {
    color: '#ffffff',
  },
  calendarDayTextToday: {
    color: '#2196f3',
    fontWeight: 'bold',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  calendarDayTextOtherMonth: {
    color: '#adb5bd',
  },
  eventIndicators: {
    position: 'absolute',
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  moreEventsText: {
    fontSize: 8,
    color: '#6c757d',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  selectedDateHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  selectedDateTitleDark: {
    color: '#ffffff',
  },
  eventListWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  eventListContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noEventsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noEventsText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  noEventsTextDark: {
    color: '#a0a0a0',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  eventItemDark: {
    backgroundColor: '#2d2d2d',
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 80,
  },
  eventColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 8,
  },
  eventTimeInfo: {
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  eventTimeDark: {
    color: '#ffffff',
  },
  eventDuration: {
    fontSize: 10,
    color: '#6c757d',
  },
  eventDurationDark: {
    color: '#a0a0a0',
  },
  eventDetails: {
    flex: 1,
    paddingRight: 12,
  },
  eventCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  eventCustomerNameDark: {
    color: '#ffffff',
  },
  eventServiceType: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  eventServiceTypeDark: {
    color: '#a0a0a0',
  },
  eventAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
  },
  eventAmountDark: {
    color: '#40d17a',
  },
  eventStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});