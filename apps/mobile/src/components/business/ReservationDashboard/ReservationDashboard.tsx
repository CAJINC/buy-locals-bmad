import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { styles } from './styles';
import { ReservationStatsCard } from './components/ReservationStatsCard';
import { ReservationList } from './components/ReservationList';
import { FilterPanel } from './components/FilterPanel';
import { ExpirationManagement } from './components/ExpirationManagement';
import { CalendarView } from './components/CalendarView';
import type {
  ReservationDashboardProps,
  DashboardStats,
  ReservationFilter,
  ViewMode
} from './types';

export const ReservationDashboard: React.FC<ReservationDashboardProps> = ({
  businessId,
  businessInfo,
  onReservationSelect,
  onReservationAction,
  theme = 'light'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  
  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [expiringReservations, setExpiringReservations] = useState<any[]>([]);
  
  // Filter states
  const [filters, setFilters] = useState<ReservationFilter>({
    status: 'all',
    dateRange: 'today',
    serviceType: 'all',
    sortBy: 'scheduledAt',
    sortOrder: 'desc'
  });

  // Load dashboard data
  const loadDashboardData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Simulate API calls - replace with actual API integration
      await Promise.all([
        loadStats(),
        loadReservations(),
        loadExpiringReservations()
      ]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [businessId, filters]);

  // Load reservation statistics
  const loadStats = async (): Promise<void> => {
    // Mock data - replace with actual API call
    const mockStats: DashboardStats = {
      totalReservations: 127,
      todayReservations: 18,
      upcomingReservations: 45,
      pendingConfirmations: 7,
      completedToday: 12,
      cancelledToday: 2,
      expiringCount: 3,
      averageDuration: 75,
      revenue: {
        today: 1450.00,
        week: 8750.50,
        month: 32100.25
      },
      trends: {
        reservationsChange: 12.5,
        revenueChange: 8.3,
        completionRate: 94.2
      }
    };

    setStats(mockStats);
  };

  // Load reservations with current filters
  const loadReservations = async (): Promise<void> => {
    // Mock data - replace with actual API call
    const mockReservations = [
      {
        id: '1',
        customerName: 'Sarah Johnson',
        customerEmail: 'sarah@example.com',
        customerPhone: '+1-555-0101',
        serviceType: 'Hair Cut',
        scheduledAt: new Date(),
        duration: 60,
        status: 'confirmed',
        totalAmount: 85.00,
        notes: 'First time customer',
        requirements: { staffPreference: 'Any' }
      },
      {
        id: '2',
        customerName: 'Mike Chen',
        customerEmail: 'mike@example.com',
        customerPhone: '+1-555-0102',
        serviceType: 'Consultation',
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        duration: 30,
        status: 'pending',
        totalAmount: 0.00,
        notes: 'Business consultation',
        requirements: { location: 'Conference room' }
      }
    ];

    setReservations(mockReservations);
  };

  // Load reservations expiring soon
  const loadExpiringReservations = async (): Promise<void> => {
    // Mock data - replace with actual API call
    const mockExpiringReservations = [
      {
        id: '3',
        customerName: 'Alice Williams',
        customerEmail: 'alice@example.com',
        scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        status: 'warned',
        totalAmount: 120.00
      }
    ];

    setExpiringReservations(mockExpiringReservations);
  };

  // Handle reservation actions
  const handleReservationAction = useCallback(async (
    reservationId: string, 
    action: string, 
    data?: any
  ) => {
    try {
      console.log(`Performing action ${action} on reservation ${reservationId}`, data);
      
      // Call parent handler if provided
      if (onReservationAction) {
        await onReservationAction(reservationId, action, data);
      }

      // Refresh data after action
      await loadDashboardData(true);
      
    } catch (error) {
      console.error('Error performing reservation action:', error);
      Alert.alert('Error', 'Failed to perform action. Please try again.');
    }
  }, [onReservationAction, loadDashboardData]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ReservationFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Memoized filtered reservations
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations];

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    // Apply date range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (filters.dateRange) {
      case 'today':
        filtered = filtered.filter(r => {
          const date = new Date(r.scheduledAt);
          return date >= today && date < tomorrow;
        });
        break;
      case 'upcoming':
        filtered = filtered.filter(r => new Date(r.scheduledAt) > now);
        break;
      case 'past':
        filtered = filtered.filter(r => new Date(r.scheduledAt) < now);
        break;
    }

    // Apply service type filter
    if (filters.serviceType !== 'all') {
      filtered = filtered.filter(r => r.serviceType === filters.serviceType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[filters.sortBy];
      const bVal = b[filters.sortBy];
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [reservations, filters]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Render view mode toggle
  const renderViewModeToggle = () => (
    <View style={[styles.viewModeToggle, theme === 'dark' && styles.viewModeToggleDark]}>
      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'list' && styles.viewModeButtonActive,
          theme === 'dark' && styles.viewModeButtonDark
        ]}
        onPress={() => setViewMode('list')}
      >
        <Text style={[
          styles.viewModeButtonText,
          viewMode === 'list' && styles.viewModeButtonTextActive,
          theme === 'dark' && styles.viewModeButtonTextDark
        ]}>
          List
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'calendar' && styles.viewModeButtonActive,
          theme === 'dark' && styles.viewModeButtonDark
        ]}
        onPress={() => setViewMode('calendar')}
      >
        <Text style={[
          styles.viewModeButtonText,
          viewMode === 'calendar' && styles.viewModeButtonTextActive,
          theme === 'dark' && styles.viewModeButtonTextDark
        ]}>
          Calendar
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render action buttons
  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, theme === 'dark' && styles.actionButtonDark]}
        onPress={() => setShowFilters(true)}
      >
        <Text style={[styles.actionButtonText, theme === 'dark' && styles.actionButtonTextDark]}>
          Filters
        </Text>
      </TouchableOpacity>
      
      {expiringReservations.length > 0 && (
        <TouchableOpacity
          style={[styles.actionButton, styles.warningButton]}
          onPress={() => setShowExpirationModal(true)}
        >
          <Text style={[styles.actionButtonText, styles.warningButtonText]}>
            {expiringReservations.length} Expiring
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading && !stats) {
    return (
      <View style={[styles.container, styles.centerContent, theme === 'dark' && styles.containerDark]}>
        <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboardData(true)}
            colors={theme === 'dark' ? ['#ffffff'] : ['#007AFF']}
            tintColor={theme === 'dark' ? '#ffffff' : '#007AFF'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, theme === 'dark' && styles.headerTitleDark]}>
            Reservation Dashboard
          </Text>
          <Text style={[styles.headerSubtitle, theme === 'dark' && styles.headerSubtitleDark]}>
            {businessInfo?.name}
          </Text>
        </View>

        {/* Stats Cards */}
        {stats && (
          <ReservationStatsCard
            stats={stats}
            theme={theme}
            onStatsPress={(statType) => {
              // Handle stats card press - filter by stat type
              switch (statType) {
                case 'today':
                  handleFilterChange({ dateRange: 'today' });
                  break;
                case 'pending':
                  handleFilterChange({ status: 'pending' });
                  break;
                case 'upcoming':
                  handleFilterChange({ dateRange: 'upcoming' });
                  break;
              }
            }}
          />
        )}

        {/* Action Buttons and View Toggle */}
        <View style={styles.controlsRow}>
          {renderActionButtons()}
          {renderViewModeToggle()}
        </View>

        {/* Reservations Content */}
        <View style={styles.contentContainer}>
          {viewMode === 'list' ? (
            <ReservationList
              reservations={filteredReservations}
              theme={theme}
              isLoading={isLoading}
              onReservationPress={onReservationSelect}
              onReservationAction={handleReservationAction}
            />
          ) : (
            <CalendarView
              reservations={filteredReservations}
              theme={theme}
              businessInfo={businessInfo}
              onDateSelect={(date) => {
                // Filter reservations by selected date
                console.log('Selected date:', date);
              }}
              onReservationPress={onReservationSelect}
            />
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
          theme={theme}
          businessId={businessId}
        />
      </Modal>

      {/* Expiration Management Modal */}
      <Modal
        visible={showExpirationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExpirationModal(false)}
      >
        <ExpirationManagement
          expiringReservations={expiringReservations}
          onAction={handleReservationAction}
          onClose={() => setShowExpirationModal(false)}
          theme={theme}
          businessId={businessId}
        />
      </Modal>
    </View>
  );
};