import type { ServiceTypeConfig, ReservationType } from '../../../api/types/ServiceType';
import type { ReservationItem, ServiceRequirements } from '../../../api/types/Reservation';

export interface BusinessInfo {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
}

export interface TimeSlotData {
  startTime: Date;
  endTime: Date;
  duration: number;
  price?: number;
  isAvailable: boolean;
  serviceId?: string;
}

export interface ReservationFormData {
  type: ReservationType;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  items?: ReservationItem[];
  requirements?: ServiceRequirements;
  notes: string;
  totalAmount: number;
  formFields: Record<string, unknown>;
}

export interface CreateReservationData {
  businessId: string;
  type: ReservationType;
  serviceTypeId?: string;
  scheduledAt: Date;
  duration: number;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  items?: ReservationItem[];
  requirements?: ServiceRequirements;
  notes?: string;
  totalAmount: number;
  formFields: Record<string, unknown>;
  holdDurationMinutes?: number;
}

export interface FormValidationErrors {
  [fieldName: string]: string;
}

export interface PricingInfo {
  basePrice: number;
  modifiers: Array<{
    name: string;
    amount: number;
    type: string;
  }>;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  discounts: Array<{
    name: string;
    amount: number;
    type: string;
  }>;
  totalPrice: number;
}

export interface AdaptiveReservationFormProps {
  businessInfo: BusinessInfo;
  serviceType?: ServiceTypeConfig;
  selectedTimeSlot?: TimeSlotData;
  initialData?: Partial<ReservationFormData>;
  onSubmit: (data: CreateReservationData) => Promise<void>;
  onCancel: () => void;
  onPriceChange?: (totalPrice: number, pricingInfo: PricingInfo) => void;
  theme?: 'light' | 'dark';
  allowPartialSave?: boolean;
  showPricingBreakdown?: boolean;
}

export interface ReservationSummaryProps {
  timeSlot: TimeSlotData;
  businessInfo: BusinessInfo;
  serviceType?: ServiceTypeConfig;
  theme?: 'light' | 'dark';
}

export interface PricingCalculatorProps {
  pricingInfo: PricingInfo;
  theme?: 'light' | 'dark';
}