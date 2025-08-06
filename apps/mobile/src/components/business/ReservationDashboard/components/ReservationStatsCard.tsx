import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { ReservationStatsCardProps, BusinessMetric } from '../types';
import { statsStyles as styles } from '../styles';

export const ReservationStatsCard: React.FC<ReservationStatsCardProps> = ({
  stats,
  theme = 'light',
  onStatsPress
}) => {
  // Format number with appropriate suffix
  const formatNumber = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'duration':
        return `${Math.round(value)}min`;
      default:
        return value.toLocaleString();
    }
  };

  // Get change indicator
  const getChangeIndicator = (change: number) => {
    if (change > 0) return { symbol: '↗', color: '#28a745' };
    if (change < 0) return { symbol: '↘', color: '#dc3545' };
    return { symbol: '→', color: '#6c757d' };
  };

  // Create metrics array from stats
  const metrics: BusinessMetric[] = [
    {
      label: 'Today',
      value: stats.todayReservations,
      change: stats.trends.reservationsChange,
      format: 'number',
      icon: '📅'
    },
    {
      label: 'Upcoming',
      value: stats.upcomingReservations,
      format: 'number',
      icon: '⏭'
    },
    {
      label: 'Pending',
      value: stats.pendingConfirmations,
      format: 'number',
      icon: '⏳'
    },
    {
      label: 'Completed',
      value: stats.completedToday,
      format: 'number',
      icon: '✅'
    },
    {
      label: 'Revenue Today',
      value: stats.revenue.today,
      change: stats.trends.revenueChange,
      format: 'currency',
      icon: '💰'
    },
    {
      label: 'Completion Rate',
      value: stats.trends.completionRate,
      format: 'percentage',
      icon: '📊'
    }
  ];

  // Render individual metric card
  const renderMetricCard = (metric: BusinessMetric, index: number) => {
    const changeIndicator = metric.change !== undefined ? getChangeIndicator(metric.change) : null;
    
    return (
      <TouchableOpacity
        key={`${metric.label}-${index}`}
        style={[
          styles.metricCard,
          theme === 'dark' && styles.metricCardDark
        ]}
        onPress={() => {
          if (onStatsPress) {
            const pressType = metric.label.toLowerCase().includes('today') ? 'today' :
                            metric.label.toLowerCase().includes('pending') ? 'pending' :
                            metric.label.toLowerCase().includes('upcoming') ? 'upcoming' :
                            'general';
            onStatsPress(pressType);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricIcon}>{metric.icon}</Text>
          <Text style={[
            styles.metricLabel,
            theme === 'dark' && styles.metricLabelDark
          ]}>
            {metric.label}
          </Text>
        </View>
        
        <View style={styles.metricContent}>
          <Text style={[
            styles.metricValue,
            theme === 'dark' && styles.metricValueDark
          ]}>
            {formatNumber(
              typeof metric.value === 'number' ? metric.value : 0, 
              metric.format || 'number'
            )}
          </Text>
          
          {changeIndicator && metric.change !== undefined && (
            <View style={styles.changeIndicator}>
              <Text style={[
                styles.changeSymbol,
                { color: changeIndicator.color }
              ]}>
                {changeIndicator.symbol}
              </Text>
              <Text style={[
                styles.changeValue,
                { color: changeIndicator.color }
              ]}>
                {Math.abs(metric.change).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render revenue summary
  const renderRevenueSummary = () => (
    <View style={[
      styles.revenueSummary,
      theme === 'dark' && styles.revenueSummaryDark
    ]}>
      <View style={styles.revenueSummaryHeader}>
        <Text style={[
          styles.revenueSummaryTitle,
          theme === 'dark' && styles.revenueSummaryTitleDark
        ]}>
          Revenue Overview
        </Text>
      </View>
      
      <View style={styles.revenueRow}>
        <View style={styles.revenueItem}>
          <Text style={[
            styles.revenueLabel,
            theme === 'dark' && styles.revenueLabelDark
          ]}>
            This Week
          </Text>
          <Text style={[
            styles.revenueValue,
            theme === 'dark' && styles.revenueValueDark
          ]}>
            {formatNumber(stats.revenue.week, 'currency')}
          </Text>
        </View>
        
        <View style={styles.revenueItem}>
          <Text style={[
            styles.revenueLabel,
            theme === 'dark' && styles.revenueLabelDark
          ]}>
            This Month
          </Text>
          <Text style={[
            styles.revenueValue,
            theme === 'dark' && styles.revenueValueDark
          ]}>
            {formatNumber(stats.revenue.month, 'currency')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[
      styles.container,
      theme === 'dark' && styles.containerDark
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[
          styles.headerTitle,
          theme === 'dark' && styles.headerTitleDark
        ]}>
          Today's Overview
        </Text>
        <Text style={[
          styles.headerSubtitle,
          theme === 'dark' && styles.headerSubtitleDark
        ]}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </Text>
      </View>

      {/* Metrics Grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsScrollContainer}
        style={styles.metricsScroll}
      >
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            {metrics.slice(0, 3).map((metric, index) => 
              renderMetricCard(metric, index)
            )}
          </View>
          <View style={styles.metricsRow}>
            {metrics.slice(3, 6).map((metric, index) => 
              renderMetricCard(metric, index + 3)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Revenue Summary */}
      {renderRevenueSummary()}

      {/* Warning Banner for Expiring Reservations */}
      {stats.expiringCount > 0 && (
        <TouchableOpacity
          style={styles.warningBanner}
          onPress={() => onStatsPress && onStatsPress('expiring')}
        >
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              {stats.expiringCount} Reservation{stats.expiringCount !== 1 ? 's' : ''} Expiring Soon
            </Text>
            <Text style={styles.warningSubtitle}>
              Tap to review and take action
            </Text>
          </View>
          <Text style={styles.warningArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Quick Insights */}
      <View style={[
        styles.quickInsights,
        theme === 'dark' && styles.quickInsightsDark
      ]}>
        <Text style={[
          styles.quickInsightsTitle,
          theme === 'dark' && styles.quickInsightsTitleDark
        ]}>
          Quick Insights
        </Text>
        
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>⏱</Text>
          <Text style={[
            styles.insightText,
            theme === 'dark' && styles.insightTextDark
          ]}>
            Average booking duration: {Math.round(stats.averageDuration)} minutes
          </Text>
        </View>
        
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>📈</Text>
          <Text style={[
            styles.insightText,
            theme === 'dark' && styles.insightTextDark
          ]}>
            {stats.trends.reservationsChange >= 0 ? 'Growing' : 'Declining'} by{' '}
            {Math.abs(stats.trends.reservationsChange).toFixed(1)}% this week
          </Text>
        </View>
        
        {stats.cancelledToday > 0 && (
          <View style={styles.insightItem}>
            <Text style={styles.insightIcon}>❌</Text>
            <Text style={[
              styles.insightText,
              theme === 'dark' && styles.insightTextDark
            ]}>
              {stats.cancelledToday} cancellation{stats.cancelledToday !== 1 ? 's' : ''} today
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};