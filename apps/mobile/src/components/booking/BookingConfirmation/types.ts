export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
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

export interface ShareContent {
  title: string;
  message: string;
}

export interface BookingConfirmationProps {
  booking: Booking;
  businessInfo?: BusinessInfo;
  serviceInfo?: ServiceInfo;
  onClose: () => void;
  onAddToCalendar?: (booking: Booking) => Promise<void>;
  onShare?: (content: ShareContent) => Promise<void>;
  onViewBookings?: () => void;
  theme?: 'light' | 'dark';
}