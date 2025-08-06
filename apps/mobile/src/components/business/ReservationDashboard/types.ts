export interface BusinessInfo {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  timezone?: string;
}

export interface DashboardStats {
  totalReservations: number;
  todayReservations: number;
  upcomingReservations: number;
  pendingConfirmations: number;
  completedToday: number;
  cancelledToday: number;
  expiringCount: number;
  averageDuration: number;
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  trends: {
    reservationsChange: number; // Percentage change
    revenueChange: number; // Percentage change
    completionRate: number; // Percentage
  };
}

export interface ReservationFilter {
  status: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
  dateRange: 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'upcoming' | 'past';
  serviceType: string; // 'all' or specific service type ID
  sortBy: 'scheduledAt' | 'createdAt' | 'customerName' | 'totalAmount' | 'status';
  sortOrder: 'asc' | 'desc';
  searchQuery?: string;
  customDateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export type ViewMode = 'list' | 'calendar';

export interface ReservationAction {
  type: 'confirm' | 'cancel' | 'reschedule' | 'extend' | 'complete' | 'modify' | 'contact';
  data?: any;
}

export interface ExpiringReservation {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceType: string;
  scheduledAt: Date;
  expiresAt: Date;
  status: 'active' | 'warned' | 'expired';
  totalAmount: number;
  warningsSent: number[];
  minutesUntilExpiry: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  customerName: string;
  serviceType: string;
  totalAmount?: number;
  color?: string;
}

export interface TimeSlotAvailability {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  reservationCount: number;
  maxCapacity: number;
}

export interface ReservationListItem {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceType: string;
  serviceName?: string;
  scheduledAt: Date;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
  totalAmount: number;
  notes?: string;
  requirements?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  canModify?: boolean;
  canCancel?: boolean;
  canReschedule?: boolean;
}

export interface ReservationDashboardProps {
  businessId: string;
  businessInfo?: BusinessInfo;
  onReservationSelect?: (reservation: ReservationListItem) => void;
  onReservationAction?: (reservationId: string, action: string, data?: any) => Promise<void>;
  theme?: 'light' | 'dark';
  refreshInterval?: number;
}

export interface ReservationStatsCardProps {
  stats: DashboardStats;
  theme?: 'light' | 'dark';
  onStatsPress?: (statType: string) => void;
}

export interface ReservationListProps {
  reservations: ReservationListItem[];
  theme?: 'light' | 'dark';
  isLoading?: boolean;
  onReservationPress?: (reservation: ReservationListItem) => void;
  onReservationAction?: (reservationId: string, action: string, data?: any) => void;
  emptyMessage?: string;
}

export interface FilterPanelProps {
  filters: ReservationFilter;
  onFilterChange: (filters: Partial<ReservationFilter>) => void;
  onClose: () => void;
  theme?: 'light' | 'dark';
  businessId: string;
}

export interface ExpirationManagementProps {
  expiringReservations: ExpiringReservation[];
  onAction: (reservationId: string, action: string, data?: any) => void;
  onClose: () => void;
  theme?: 'light' | 'dark';
  businessId: string;
}

export interface CalendarViewProps {
  reservations: ReservationListItem[];
  theme?: 'light' | 'dark';
  businessInfo?: BusinessInfo;
  onDateSelect?: (date: Date) => void;
  onReservationPress?: (reservation: ReservationListItem) => void;
  selectedDate?: Date;
}

export interface ReservationItemProps {
  reservation: ReservationListItem;
  theme?: 'light' | 'dark';
  onPress?: (reservation: ReservationListItem) => void;
  onAction?: (reservationId: string, action: string, data?: any) => void;
  showActions?: boolean;
}

export interface QuickActionsProps {
  reservation: ReservationListItem;
  theme?: 'light' | 'dark';
  onAction: (action: string, data?: any) => void;
}

export interface BusinessMetric {
  label: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  icon?: string;
}

export interface DashboardTab {
  id: string;
  name: string;
  icon?: string;
  badge?: number;
}

export interface NotificationSettings {
  expirationWarnings: boolean;
  newReservations: boolean;
  cancellations: boolean;
  modifications: boolean;
  dailySummary: boolean;
}

export interface DashboardConfig {
  refreshInterval: number;
  defaultView: ViewMode;
  autoRefresh: boolean;
  showRevenue: boolean;
  showMetrics: boolean;
  compactMode: boolean;
  notificationSettings: NotificationSettings;
}