export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Booking {
  id: string;
  consumerId: string;
  businessId: string;
  serviceId: string;
  scheduledAt: Date;
  duration: number; // in minutes
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  totalAmount: number;
  customerInfo: CustomerInfo;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface CreateBookingInput {
  consumerId: string;
  businessId: string;
  serviceId: string;
  scheduledAt: Date;
  duration: number;
  customerInfo: CustomerInfo;
  notes?: string;
  totalAmount: number;
}

export interface CreateBookingData extends CreateBookingInput {
  status: 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateBookingData {
  status?: Booking['status'];
  notes?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  updatedAt: Date;
}

export interface CancelBookingInput {
  bookingId: string;
  userId: string;
  reason?: string;
  notifyBusiness?: boolean;
}

export interface GetBookingsOptions {
  userId: string;
  status?: string;
  businessId?: string;
  limit: number;
  offset: number;
}

export interface BookingNotificationData {
  booking: Booking;
  businessName?: string;
  consumerName?: string;
  refundAmount?: number;
  reason?: string;
}

export interface BookingStats {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
}

export interface BusinessBookingSettings {
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  cancellationNoticeHours: number;
  allowOnlineBooking: boolean;
  requireApproval: boolean;
  bufferTime: number;
  maxBookingsPerDay?: number;
  bookingConfirmationRequired: boolean;
}