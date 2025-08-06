import { Booking } from './Booking';

export type ReservationType = 'service' | 'product' | 'table' | 'consultation' | 'event';

export interface Reservation extends Booking {
  type: ReservationType;
  items?: ReservationItem[];
  requirements?: ServiceRequirements;
  expiresAt?: Date;
  modificationPolicy: ModificationPolicy;
  inventoryHolds: InventoryHold[];
}

export interface ReservationItem {
  productId: string;
  quantity: number;
  price: number;
  specifications?: Record<string, unknown>;
  customizations?: string[];
  name: string;
  description?: string;
}

export interface ServiceRequirements {
  preparationTime?: number;
  resourceRequirements?: string[];
  prerequisiteDocuments?: string[];
  specialInstructions?: string;
  attendeeCount?: number;
  equipmentNeeded?: string[];
}

export interface InventoryHold {
  id: string;
  productId: string;
  quantity: number;
  holdUntil: Date;
  status: 'active' | 'confirmed' | 'expired' | 'released';
  createdAt: Date;
}

export interface ModificationPolicy {
  allowModification: boolean;
  modificationDeadline: number; // hours before reservation
  modificationFee: number;
  allowedChanges: ModificationScope[];
  requiresApproval: boolean;
  maxModifications: number;
}

export interface ModificationScope {
  field: 'time' | 'date' | 'service' | 'quantity' | 'specifications';
  restrictions?: string[];
  additionalFee?: number;
}

export interface ProductInventory {
  id: string;
  businessId: string;
  productId: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  minimumStock: number;
  isTrackingEnabled: boolean;
  lastUpdated: Date;
  productName: string;
  productDescription?: string;
  unitPrice: number;
}

export interface CreateReservationInput {
  businessId: string;
  type: ReservationType;
  scheduledAt: Date;
  duration: number;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
  };
  items?: ReservationItem[];
  requirements?: ServiceRequirements;
  notes?: string;
  totalAmount: number;
  holdDuration?: number; // minutes to hold inventory
}

export interface ModificationRequest {
  reservationId: string;
  changes: Record<string, unknown>;
  reason?: string;
  requestedBy: string;
}

export interface ModificationEvaluation {
  allowed: boolean;
  reason?: string;
  fee?: number;
  requiresApproval?: boolean;
}

export interface ReservationFilters {
  status?: string[];
  type?: ReservationType[];
  dateRange?: [Date, Date];
  customerId?: string;
  hasExpiredItems?: boolean;
  sortBy?: 'scheduledAt' | 'createdAt' | 'totalAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ReservationSummary {
  totalReservations: number;
  totalRevenue: number;
  upcomingReservations: number;
  expiringReservations: number;
  inventoryAlerts: number;
  cancellationRate: number;
  averageReservationValue: number;
  popularServices: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
}