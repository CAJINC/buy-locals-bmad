import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { RevenueChart } from './RevenueChart';
import { PayoutSummary } from './PayoutSummary';
import { TaxReport } from './TaxReport';
import { TransactionHistory } from '../transaction/TransactionHistory';
import { useBusinessTransactions } from '../../hooks/useBusinessTransactions';
import { formatCurrency, formatDate, formatPercentage } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { styles } from './styles';

export interface TransactionDashboardProps {
  businessId: string;
  theme?: 'light' | 'dark';
  timeRange?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange?: (timeRange: string) => void;
  showAdvancedMetrics?: boolean;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  totalRefunds: number;
  netRevenue: number;
  platformFees: number;
  pendingPayouts: number;
  completedPayouts: number;
  topCustomers: Array<{
    id: string;
    name: string;
    totalSpent: number;
    transactionCount: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  statusBreakdown: {
    paid: number;
    refunded: number;
    disputed: number;
  };
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    revenue: number;
  }>;
  growthMetrics: {
    revenueGrowth: number;
    transactionGrowth: number;
    customerGrowth: number;
  };
}

const { width: screenWidth } = Dimensions.get('window');
const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.5,
  useShadowColorFromDataset: false,
};

const chartConfigDark = {
  backgroundGradientFrom: '#1f2937',
  backgroundGradientTo: '#1f2937',
  color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.5,
  useShadowColorFromDataset: false,
};

const TIME_RANGES = [
  { value: 'today', label: 'Today', icon: 'today' },
  { value: 'week', label: 'This Week', icon: 'calendar' },
  { value: 'month', label: 'This Month', icon: 'calendar' },
  { value: 'quarter', label: 'This Quarter', icon: 'calendar' },
  { value: 'year', label: 'This Year', icon: 'calendar' },
];

/**
 * TransactionDashboard Component
 * 
 * Comprehensive business dashboard displaying:
 * - Key metrics and KPIs
 * - Revenue charts and trends
 * - Transaction analytics
 * - Payout summaries
 * - Tax reporting
 * - Customer insights
 * - Performance indicators
 */
export const TransactionDashboard: React.FC<TransactionDashboardProps> = ({
  businessId,
  theme = 'light',
  timeRange = 'month',
  onTimeRangeChange,
  showAdvancedMetrics = true,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'payouts' | 'taxes' | 'transactions'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  const {
    metrics,
    isLoading,
    error,
    fetchMetrics,
    refreshMetrics,
  } = useBusinessTransactions({
    businessId,
    timeRange: selectedTimeRange,
  });

  useEffect(() => {
    fetchMetrics();
  }, [businessId, selectedTimeRange, fetchMetrics]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((newTimeRange: string) => {
    setSelectedTimeRange(newTimeRange);
    if (onTimeRangeChange) {
      onTimeRangeChange(newTimeRange);
    }
  }, [onTimeRangeChange]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMetrics();
    } catch (error) {
      logger.error('Failed to refresh dashboard metrics', { error });
    } finally {
      setRefreshing(false);
    }
  }, [refreshMetrics]);

  // Memoized chart data
  const revenueChartData = useMemo(() => {
    if (!metrics?.revenueByDay) return null;

    return {
      labels: metrics.revenueByDay.slice(-7).map(item => 
        new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
      ),
      datasets: [
        {
          data: metrics.revenueByDay.slice(-7).map(item => item.revenue / 100),
        },
      ],
    };
  }, [metrics?.revenueByDay]);

  const transactionChartData = useMemo(() => {
    if (!metrics?.revenueByDay) return null;

    return {
      labels: metrics.revenueByDay.slice(-7).map(item => 
        new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
      ),
      datasets: [
        {
          data: metrics.revenueByDay.slice(-7).map(item => item.transactions),
        },
      ],
    };
  }, [metrics?.revenueByDay]);

  const statusPieData = useMemo(() => {
    if (!metrics?.statusBreakdown) return null;

    return [
      {
        name: 'Paid',
        population: metrics.statusBreakdown.paid,
        color: '#10B981',
        legendFontColor: theme === 'dark' ? '#F9FAFB' : '#374151',
        legendFontSize: 12,
      },
      {
        name: 'Refunded',
        population: metrics.statusBreakdown.refunded,
        color: '#EF4444',
        legendFontColor: theme === 'dark' ? '#F9FAFB' : '#374151',
        legendFontSize: 12,
      },
      {
        name: 'Disputed',
        population: metrics.statusBreakdown.disputed,
        color: '#6B7280',
        legendFontColor: theme === 'dark' ? '#F9FAFB' : '#374151',
        legendFontSize: 12,
      },
    ].filter(item => item.population > 0);
  }, [metrics?.statusBreakdown, theme]);

  // Render time range selector
  const renderTimeRangeSelector = useCallback(() => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRangeSelector}>
      {TIME_RANGES.map((range) => (
        <TouchableOpacity
          key={range.value}
          style={[
            styles.timeRangeButton,
            selectedTimeRange === range.value && styles.timeRangeButtonActive,
            theme === 'dark' && styles.timeRangeButtonDark,
            selectedTimeRange === range.value && theme === 'dark' && styles.timeRangeButtonActiveDark,
          ]}
          onPress={() => handleTimeRangeChange(range.value)}
        >
          <Ionicons
            name={range.icon as any}
            size={16}
            color={
              selectedTimeRange === range.value
                ? (theme === 'dark' ? '#1F2937' : '#FFFFFF')
                : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
            }
          />
          <Text
            style={[
              styles.timeRangeButtonText,
              selectedTimeRange === range.value && styles.timeRangeButtonTextActive,
              theme === 'dark' && styles.timeRangeButtonTextDark,
              selectedTimeRange === range.value && theme === 'dark' && styles.timeRangeButtonTextActiveDark,
            ]}
          >
            {range.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ), [selectedTimeRange, theme, handleTimeRangeChange]);

  // Render KPI cards
  const renderKPICards = useCallback(() => {
    if (!metrics) return null;

    const kpis = [
      {
        title: 'Total Revenue',
        value: formatCurrency(metrics.totalRevenue, 'USD'),
        change: metrics.growthMetrics.revenueGrowth,
        icon: 'cash',
        color: '#10B981',
      },
      {
        title: 'Transactions',
        value: metrics.totalTransactions.toLocaleString(),
        change: metrics.growthMetrics.transactionGrowth,
        icon: 'receipt',
        color: '#3B82F6',
      },
      {
        title: 'Average Value',
        value: formatCurrency(metrics.averageTransactionValue, 'USD'),
        change: (metrics.growthMetrics.revenueGrowth - metrics.growthMetrics.transactionGrowth),
        icon: 'trending-up',
        color: '#8B5CF6',
      },
      {
        title: 'Net Revenue',
        value: formatCurrency(metrics.netRevenue, 'USD'),
        change: metrics.growthMetrics.revenueGrowth * 0.9, // Approximate net growth
        icon: 'wallet',
        color: '#059669',
      },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiContainer}>
        {kpis.map((kpi, index) => (
          <View
            key={index}
            style={[
              styles.kpiCard,
              theme === 'dark' && styles.kpiCardDark,
            ]}
          >
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: `${kpi.color}20` }]}>
                <Ionicons name={kpi.icon as any} size={24} color={kpi.color} />
              </View>
              {kpi.change !== undefined && (
                <View style={[
                  styles.kpiChange,
                  kpi.change >= 0 ? styles.kpiChangePositive : styles.kpiChangeNegative,
                ]}>
                  <Ionicons
                    name={kpi.change >= 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={kpi.change >= 0 ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[
                    styles.kpiChangeText,
                    kpi.change >= 0 ? styles.kpiChangeTextPositive : styles.kpiChangeTextNegative,
                  ]}>
                    {formatPercentage(Math.abs(kpi.change))}
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.kpiTitle, theme === 'dark' && styles.kpiTitleDark]}>
              {kpi.title}
            </Text>
            <Text style={[styles.kpiValue, theme === 'dark' && styles.kpiValueDark]}>
              {kpi.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }, [metrics, theme]);

  // Render overview tab
  const renderOverviewTab = useCallback(() => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* KPI Cards */}
      {renderKPICards()}

      {/* Revenue Chart */}
      {revenueChartData && (
        <View style={[styles.chartContainer, theme === 'dark' && styles.chartContainerDark]}>
          <Text style={[styles.chartTitle, theme === 'dark' && styles.chartTitleDark]}>
            Revenue Trend (Last 7 Days)
          </Text>
          <LineChart
            data={revenueChartData}
            width={screenWidth - 60}
            height={220}
            chartConfig={theme === 'dark' ? chartConfigDark : chartConfig}
            bezier
            style={styles.chart}
            withDots={true}
            withShadow={false}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            formatYLabel={(value) => `$${parseFloat(value).toFixed(0)}`}
          />
        </View>
      )}

      {/* Transaction Volume Chart */}
      {transactionChartData && (
        <View style={[styles.chartContainer, theme === 'dark' && styles.chartContainerDark]}>
          <Text style={[styles.chartTitle, theme === 'dark' && styles.chartTitleDark]}>
            Transaction Volume (Last 7 Days)
          </Text>
          <BarChart
            data={transactionChartData}
            width={screenWidth - 60}
            height={220}
            chartConfig={theme === 'dark' ? chartConfigDark : chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            withHorizontalLabels={true}
            formatYLabel={(value) => parseInt(value).toString()}
          />
        </View>
      )}

      {/* Status Breakdown */}
      {statusPieData && statusPieData.length > 0 && (
        <View style={[styles.chartContainer, theme === 'dark' && styles.chartContainerDark]}>
          <Text style={[styles.chartTitle, theme === 'dark' && styles.chartTitleDark]}>
            Transaction Status Breakdown
          </Text>
          <PieChart
            data={statusPieData}
            width={screenWidth - 60}
            height={220}
            chartConfig={theme === 'dark' ? chartConfigDark : chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
            style={styles.chart}
          />
        </View>
      )}

      {/* Top Customers */}
      {metrics?.topCustomers && metrics.topCustomers.length > 0 && (
        <View style={[styles.sectionContainer, theme === 'dark' && styles.sectionContainerDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            Top Customers
          </Text>
          
          {metrics.topCustomers.slice(0, 5).map((customer, index) => (
            <View key={customer.id} style={styles.customerRow}>
              <View style={styles.customerInfo}>
                <View style={[styles.customerRank, { backgroundColor: index < 3 ? '#F59E0B' : '#6B7280' }]}>
                  <Text style={styles.customerRankText}>{index + 1}</Text>
                </View>
                <View>
                  <Text style={[styles.customerName, theme === 'dark' && styles.customerNameDark]}>
                    {customer.name}
                  </Text>
                  <Text style={[styles.customerStats, theme === 'dark' && styles.customerStatsDark]}>
                    {customer.transactionCount} transactions
                  </Text>
                </View>
              </View>
              <Text style={[styles.customerSpent, theme === 'dark' && styles.customerSpentDark]}>
                {formatCurrency(customer.totalSpent, 'USD')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  ), [metrics, theme, revenueChartData, transactionChartData, statusPieData, renderKPICards]);

  // Render tabs
  const renderTab = useCallback((tab: typeof activeTab, title: string, icon: string) => {
    const isActive = activeTab === tab;
    
    return (
      <TouchableOpacity
        style={[
          styles.dashboardTab,
          isActive && styles.dashboardTabActive,
          theme === 'dark' && styles.dashboardTabDark,
          isActive && theme === 'dark' && styles.dashboardTabActiveDark,
        ]}
        onPress={() => setActiveTab(tab)}
        accessibilityLabel={`${title} tab`}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={
            isActive
              ? (theme === 'dark' ? '#60A5FA' : '#3B82F6')
              : (theme === 'dark' ? '#9CA3AF' : '#6B7280')
          }
        />
        <Text
          style={[
            styles.dashboardTabText,
            isActive && styles.dashboardTabTextActive,
            theme === 'dark' && styles.dashboardTabTextDark,
            isActive && theme === 'dark' && styles.dashboardTabTextActiveDark,
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  }, [activeTab, theme]);

  if (error) {
    return (
      <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={48}
            color={theme === 'dark' ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, theme === 'dark' && styles.errorTitleDark]}>
            Failed to load dashboard
          </Text>
          <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessageDark]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, theme === 'dark' && styles.retryButtonDark]}
            onPress={fetchMetrics}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.dashboardHeader, theme === 'dark' && styles.dashboardHeaderDark]}>
        <Text style={[styles.dashboardTitle, theme === 'dark' && styles.dashboardTitleDark]}>
          Transaction Dashboard
        </Text>
        
        <TouchableOpacity
          style={[styles.refreshButton, theme === 'dark' && styles.refreshButtonDark]}
          onPress={handleRefresh}
          disabled={refreshing}
          accessibilityLabel="Refresh dashboard"
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh"
            size={20}
            color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
            style={refreshing && { opacity: 0.5 }}
          />
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      {renderTimeRangeSelector()}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {renderTab('overview', 'Overview', 'analytics')}
        {renderTab('revenue', 'Revenue', 'trending-up')}
        {renderTab('payouts', 'Payouts', 'wallet')}
        {renderTab('taxes', 'Taxes', 'document-text')}
        {renderTab('transactions', 'Transactions', 'list')}
      </ScrollView>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'overview' && renderOverviewTab()}
        
        {activeTab === 'revenue' && (
          <RevenueChart
            businessId={businessId}
            timeRange={selectedTimeRange}
            theme={theme}
          />
        )}
        
        {activeTab === 'payouts' && (
          <PayoutSummary
            businessId={businessId}
            timeRange={selectedTimeRange}
            theme={theme}
          />
        )}
        
        {activeTab === 'taxes' && (
          <TaxReport
            businessId={businessId}
            timeRange={selectedTimeRange}
            theme={theme}
          />
        )}
        
        {activeTab === 'transactions' && (
          <TransactionHistory
            businessId={businessId}
            theme={theme}
            showFilters={true}
          />
        )}
      </View>
    </View>
  );
};