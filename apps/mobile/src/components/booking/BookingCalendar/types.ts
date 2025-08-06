export interface TimeSlotData {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  serviceId?: string;
  isSelected: boolean;
}

export type CalendarView = 'month' | 'week' | 'day';

export interface BookingCalendarProps {
  businessId: string;
  serviceId?: string;
  serviceDuration?: number;
  onTimeSlotSelected?: (slot: TimeSlotData) => void;
  onError?: (error: string) => void;
  initialDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  timezone?: string;
  theme?: 'light' | 'dark';
}

export interface AvailabilityResponse {
  success: boolean;
  data: {
    date: string;
    businessId: string;
    serviceId?: string;
    availability: {
      startTime: string;
      endTime: string;
      isAvailable: boolean;
      price?: number;
      serviceId?: string;
    }[];
  };
}

export interface CalendarDate {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  hasAvailability?: boolean;
}