export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export interface BookingFormData {
  customerInfo: CustomerInfo;
  notes: string;
  totalAmount: number;
}

export interface ValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  timeSlot?: string;
}

export interface TimeSlotData {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  price?: number;
  serviceId?: string;
}

export interface BusinessInfo {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ServiceInfo {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price?: number;
}

export interface CreateBookingData {
  businessId: string;
  serviceId: string;
  scheduledAt: Date;
  duration: number;
  customerInfo: CustomerInfo;
  notes?: string;
  totalAmount: number;
}

export interface Booking {
  id: string;
  businessId: string;
  serviceId: string;
  scheduledAt: Date;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  customerInfo: CustomerInfo;
  notes?: string;
  totalAmount: number;
  createdAt: Date;
}

export interface BookingFormProps {
  selectedTimeSlot?: TimeSlotData;
  businessInfo?: BusinessInfo;
  serviceInfo?: ServiceInfo;
  onSubmit: (bookingData: CreateBookingData) => Promise<Booking>;
  onCancel: () => void;
  onSuccess?: (booking: Booking) => void;
  onError?: (error: string) => void;
  theme?: 'light' | 'dark';
  prefillUserData?: Partial<CustomerInfo>;
}