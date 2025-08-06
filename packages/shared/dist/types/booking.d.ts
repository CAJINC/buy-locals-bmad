export interface Booking {
    id: string;
    userId: string;
    businessId: string;
    serviceId?: string;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    partySize: number;
    specialRequests?: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    totalAmount: number;
    paymentStatus: 'pending' | 'paid' | 'refunded';
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateBookingRequest {
    businessId: string;
    serviceId?: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    partySize: number;
    specialRequests?: string;
}
export interface BookingFilters {
    page?: number;
    limit?: number;
    status?: Booking['status'];
    businessId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
}
//# sourceMappingURL=booking.d.ts.map