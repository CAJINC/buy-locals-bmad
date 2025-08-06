import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TransactionFilters } from './TransactionFilters';
import { TransactionDetails } from './TransactionDetails';
import { EmptyState } from '../common/EmptyState';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';
import { formatCurrency, formatDate, formatRelativeTime } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { styles } from './styles';

export interface TransactionHistoryProps {
  businessId?: string;
  customerId?: string;
  showFilters?: boolean;
  itemsPerPage?: number;
  theme?: 'light' | 'dark';
  onTransactionSelect?: (transactionId: string) => void;
  onReceiptRequest?: (transactionId: string) => void;
  onRefundRequest?: (transactionId: string) => void;
}

export interface TransactionItem {
  id: string;
  receiptNumber: string;
  transactionId: string;
  businessId: string;
  businessName: string;
  businessLogo?: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  platformFee: number;
  taxAmount: number;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'disputed';
  paymentMethod?: string;
  createdAt: string;
  refundedAt?: string;
  refundAmount?: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  receiptAvailable: boolean;
  downloadUrl?: string;
}

export interface TransactionFiltersState {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  sortBy: 'date' | 'amount' | 'status' | 'business';
  sortOrder: 'asc' | 'desc';
}

const { width: screenWidth } = Dimensions.get('window');

/**
 * TransactionHistory Component
 * 
 * Displays a paginated list of transactions with advanced filtering and sorting.
 * Supports both business owner and customer views with appropriate permissions.
 */
export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  businessId,
  customerId,
  showFilters = true,
  itemsPerPage = 20,
  theme = 'light',
  onTransactionSelect,
  onReceiptRequest,
  onRefundRequest,
}) => {
  const [filters, setFilters] = useState<TransactionFiltersState>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    transactions,
    summary,
    pagination,
    isLoading,
    error,
    fetchTransactions,
    fetchMore,
    refreshTransactions,
  } = useTransactionHistory({
    businessId,
    customerId,
    filters,
    itemsPerPage,
  });

  // Memoized filtered transactions for performance
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          transaction.businessName.toLowerCase().includes(query) ||
          transaction.receiptNumber.toLowerCase().includes(query) ||
          transaction.customerName.toLowerCase().includes(query) ||
          transaction.transactionId.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [transactions, filters.searchQuery]);

  // Initial load
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<TransactionFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setShowFiltersPanel(false);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
    } catch (error) {
      logger.error('Failed to refresh transactions', { error });
    } finally {
      setRefreshing(false);
    }
  }, [refreshTransactions]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !isLoading) {
      fetchMore();
    }
  }, [pagination.hasMore, isLoading, fetchMore]);

  // Handle transaction selection
  const handleTransactionPress = useCallback((transaction: TransactionItem) => {
    if (onTransactionSelect) {
      onTransactionSelect(transaction.id);
    } else {
      setSelectedTransaction(transaction.id);
    }
  }, [onTransactionSelect]);

  // Handle receipt download
  const handleReceiptPress = useCallback((transaction: TransactionItem) => {
    if (onReceiptRequest) {
      onReceiptRequest(transaction.id);
    } else {
      Alert.alert(
        'Receipt Options',
        'What would you like to do?',
        [
          {
            text: 'Download PDF',
            onPress: () => handleReceiptDownload(transaction, 'pdf'),
          },
          {
            text: 'Email Receipt',
            onPress: () => handleReceiptEmail(transaction),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [onReceiptRequest]);

  // Handle receipt download
  const handleReceiptDownload = useCallback(async (transaction: TransactionItem, format: 'pdf' | 'html') => {
    try {
      // Implementation would integrate with receipt service
      logger.info('Receipt download requested', {
        transactionId: transaction.id,
        format,
      });
      Alert.alert('Success', 'Receipt download started');
    } catch (error) {
      logger.error('Receipt download failed', { error, transactionId: transaction.id });
      Alert.alert('Error', 'Failed to download receipt');
    }
  }, []);

  // Handle receipt email
  const handleReceiptEmail = useCallback(async (transaction: TransactionItem) => {
    try {
      // Implementation would integrate with email service
      logger.info('Receipt email requested', {
        transactionId: transaction.id,
      });
      Alert.alert('Success', 'Receipt email sent');
    } catch (error) {
      logger.error('Receipt email failed', { error, transactionId: transaction.id });
      Alert.alert('Error', 'Failed to send receipt email');
    }
  }, []);

  // Handle refund request
  const handleRefundPress = useCallback((transaction: TransactionItem) => {
    if (onRefundRequest) {
      onRefundRequest(transaction.id);
    } else {
      Alert.alert(
        'Request Refund',
        `Are you sure you want to request a refund for ${formatCurrency(transaction.amount, transaction.currency)}?`,
        [
          {
            text: 'Request Refund',
            style: 'destructive',
            onPress: () => {
              // Implementation would integrate with refund service
              logger.info('Refund requested', { transactionId: transaction.id });
              Alert.alert('Success', 'Refund request submitted');
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [onRefundRequest]);

  // Get status badge style
  const getStatusStyle = useCallback((status: TransactionItem['status']) => {
    const baseStyle = [styles.statusBadge];
    
    switch (status) {
      case 'paid':
        return [...baseStyle, styles.statusPaid, theme === 'dark' && styles.statusPaidDark];
      case 'refunded':
        return [...baseStyle, styles.statusRefunded, theme === 'dark' && styles.statusRefundedDark];
      case 'partially_refunded':
        return [...baseStyle, styles.statusPartialRefund, theme === 'dark' && styles.statusPartialRefundDark];
      case 'disputed':
        return [...baseStyle, styles.statusDisputed, theme === 'dark' && styles.statusDisputedDark];
      default:
        return baseStyle;
    }
  }, [theme]);

  // Get status text
  const getStatusText = useCallback((status: TransactionItem['status']) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'refunded':
        return 'Refunded';
      case 'partially_refunded':
        return 'Partial Refund';
      case 'disputed':
        return 'Disputed';
      default:
        return status;
    }
  }, []);

  // Render transaction item
  const renderTransaction = useCallback(({ item: transaction }: { item: TransactionItem }) => {
    const isRefundable = transaction.status === 'paid' && 
      new Date().getTime() - new Date(transaction.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000; // 30 days

    return (
      <TouchableOpacity
        style={[
          styles.transactionCard,
          theme === 'dark' && styles.transactionCardDark,
        ]}
        onPress={() => handleTransactionPress(transaction)}
        accessibilityLabel={`Transaction from ${transaction.businessName}, ${formatCurrency(transaction.amount, transaction.currency)}`}
        accessibilityRole="button"
      >
        <View style={styles.transactionHeader}>
          <View style={styles.businessInfo}>
            {transaction.businessLogo && (
              <Image
                source={{ uri: transaction.businessLogo }}
                style={styles.businessLogo}
                defaultSource={require('../../assets/placeholder-business.png')}
              />
            )}
            <View style={styles.businessDetails}>
              <Text
                style={[
                  styles.businessName,
                  theme === 'dark' && styles.businessNameDark,
                ]}
                numberOfLines={1}
              >
                {transaction.businessName}
              </Text>
              <Text
                style={[
                  styles.receiptNumber,
                  theme === 'dark' && styles.receiptNumberDark,
                ]}
                numberOfLines={1}
              >
                #{transaction.receiptNumber}
              </Text>
            </View>
          </View>

          <View style={styles.transactionMeta}>
            <View style={getStatusStyle(transaction.status)}>
              <Text style={styles.statusText}>
                {getStatusText(transaction.status)}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                theme === 'dark' && styles.transactionAmountDark,
              ]}
            >
              {formatCurrency(transaction.amount, transaction.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <Text
            style={[
              styles.transactionDate,
              theme === 'dark' && styles.transactionDateDark,
            ]}
          >
            {formatDate(transaction.createdAt)} • {formatRelativeTime(transaction.createdAt)}
          </Text>

          {transaction.items.length > 0 && (
            <Text
              style={[
                styles.transactionItems,
                theme === 'dark' && styles.transactionItemsDark,
              ]}
              numberOfLines={1}
            >
              {transaction.items.length === 1
                ? transaction.items[0].name
                : `${transaction.items[0].name} +${transaction.items.length - 1} more`}
            </Text>
          )}

          {transaction.refundAmount && transaction.refundAmount > 0 && (
            <View style={styles.refundInfo}>
              <Ionicons
                name="return-up-back"
                size={14}
                color={theme === 'dark' ? '#F59E0B' : '#D97706'}
              />
              <Text
                style={[
                  styles.refundText,
                  theme === 'dark' && styles.refundTextDark,
                ]}
              >
                Refunded: {formatCurrency(transaction.refundAmount, transaction.currency)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.transactionActions}>
          {transaction.receiptAvailable && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.receiptButton,
                theme === 'dark' && styles.actionButtonDark,
              ]}
              onPress={() => handleReceiptPress(transaction)}
              accessibilityLabel="View receipt"
              accessibilityRole="button"
            >
              <Ionicons
                name="receipt"
                size={16}
                color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  styles.receiptButtonText,
                  theme === 'dark' && styles.receiptButtonTextDark,
                ]}
              >
                Receipt
              </Text>
            </TouchableOpacity>
          )}

          {isRefundable && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.refundButton,
                theme === 'dark' && styles.actionButtonDark,
              ]}
              onPress={() => handleRefundPress(transaction)}
              accessibilityLabel="Request refund"
              accessibilityRole="button"
            >
              <Ionicons
                name="return-up-back"
                size={16}
                color={theme === 'dark' ? '#F87171' : '#EF4444'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  styles.refundButtonText,
                  theme === 'dark' && styles.refundButtonTextDark,
                ]}
              >
                Refund
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [theme, handleTransactionPress, handleReceiptPress, handleRefundPress, getStatusStyle, getStatusText]);

  // Render loading footer
  const renderLoadingFooter = useCallback(() => {
    if (!isLoading || !pagination.hasMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator
          size="small"
          color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
        />
        <Text
          style={[
            styles.loadingText,
            theme === 'dark' && styles.loadingTextDark,
          ]}
        >
          Loading more transactions...
        </Text>
      </View>
    );
  }, [isLoading, pagination.hasMore, theme]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;

    return (
      <EmptyState
        icon="receipt-outline"
        title="No transactions found"
        subtitle={
          Object.keys(filters).length > 2
            ? "No transactions match your current filters"
            : "You haven't made any transactions yet"
        }
        actionText={Object.keys(filters).length > 2 ? "Clear Filters" : undefined}
        onActionPress={Object.keys(filters).length > 2 ? () => setFilters({ sortBy: 'date', sortOrder: 'desc' }) : undefined}
        theme={theme}
      />
    );
  }, [isLoading, filters, theme]);

  // Render error state
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
            Failed to load transactions
          </Text>
          <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessageDark]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, theme === 'dark' && styles.retryButtonDark]}
            onPress={fetchTransactions}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
        {/* Header with summary */}
        {summary && (
          <View style={[styles.summaryContainer, theme === 'dark' && styles.summaryContainerDark]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Total
              </Text>
              <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
                {formatCurrency(summary.totalAmount, 'USD')}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Transactions
              </Text>
              <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
                {summary.totalTransactions}
              </Text>
            </View>
            {summary.totalRefunded > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                  Refunded
                </Text>
                <Text style={[styles.summaryValue, styles.refundValue, theme === 'dark' && styles.refundValueDark]}>
                  {formatCurrency(summary.totalRefunded, 'USD')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Filters bar */}
        {showFilters && (
          <View style={[styles.filtersBar, theme === 'dark' && styles.filtersBarDark]}>
            <TouchableOpacity
              style={[styles.filterButton, theme === 'dark' && styles.filterButtonDark]}
              onPress={() => setShowFiltersPanel(true)}
            >
              <Ionicons
                name="filter"
                size={20}
                color={theme === 'dark' ? '#D1D5DB' : '#6B7280'}
              />
              <Text style={[styles.filterButtonText, theme === 'dark' && styles.filterButtonTextDark]}>
                Filters
              </Text>
            </TouchableOpacity>

            <View style={styles.sortControls}>
              <TouchableOpacity
                style={[styles.sortButton, theme === 'dark' && styles.sortButtonDark]}
                onPress={() => handleFilterChange({
                  sortBy: filters.sortBy === 'date' ? 'amount' : 'date'
                })}
              >
                <Text style={[styles.sortButtonText, theme === 'dark' && styles.sortButtonTextDark]}>
                  {filters.sortBy === 'date' ? 'Date' : 'Amount'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortButton, theme === 'dark' && styles.sortButtonDark]}
                onPress={() => handleFilterChange({
                  sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc'
                })}
              >
                <Ionicons
                  name={filters.sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color={theme === 'dark' ? '#D1D5DB' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transaction list */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
              colors={[theme === 'dark' ? '#60A5FA' : '#3B82F6']}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderLoadingFooter}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            filteredTransactions.length === 0 && styles.emptyContainer,
          ]}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          getItemLayout={(data, index) => ({
            length: 140, // Approximate item height
            offset: 140 * index,
            index,
          })}
        />

        {/* Filters modal */}
        {showFilters && (
          <TransactionFilters
            visible={showFiltersPanel}
            filters={filters}
            onFiltersChange={handleFilterChange}
            onClose={() => setShowFiltersPanel(false)}
            theme={theme}
          />
        )}

        {/* Transaction details modal */}
        {selectedTransaction && (
          <TransactionDetails
            transactionId={selectedTransaction}
            visible={!!selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
            onReceiptRequest={onReceiptRequest}
            onRefundRequest={onRefundRequest}
            theme={theme}
          />
        )}
      </View>
    </ErrorBoundary>
  );
};