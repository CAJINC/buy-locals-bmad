export interface TimeSlotData {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  serviceId?: string;
  isSelected: boolean;
}

export interface AvailabilityGridProps {
  timeSlots: TimeSlotData[];
  onTimeSlotPress: (slot: TimeSlotData) => void;
  selectedSlot?: TimeSlotData | null;
  numColumns?: number;
  theme?: 'light' | 'dark';
  showPricing?: boolean;
  groupByPeriod?: boolean;
}