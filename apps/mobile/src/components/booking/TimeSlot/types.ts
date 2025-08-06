export interface TimeSlotData {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  serviceId?: string;
  isSelected: boolean;
}

export interface TimeSlotProps {
  timeSlot: TimeSlotData;
  onPress: (slot: TimeSlotData) => void;
  isSelected?: boolean;
  showPrice?: boolean;
  theme?: 'light' | 'dark';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}