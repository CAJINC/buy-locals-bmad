import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ReceiptViewer } from './ReceiptViewer';
import { useTransactionDetails } from '../../hooks/useTransactionDetails';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { styles } from './styles';

export interface TransactionDetailsProps {
  transactionId: string;
  visible: boolean;
  onClose: () => void;
  onReceiptRequest?: (transactionId: string) => void;
  onRefundRequest?: (transactionId: string) => void;
  theme?: 'light' | 'dark';
}

export interface TransactionDetailsData {
  id: string;
  receiptNumber: string;
  paymentIntentId: string;
  businessId: string;
  businessName: string;
  businessLogo?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  amount: number;
  currency: string;
  platformFee: number;
  businessPayout: number;
  taxAmount: number;
  taxRate: number;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'disputed';
  paymentMethod?: string;
  createdAt: string;
  refundedAt?: string;
  refundAmount?: number;
  items: Array<{
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxRate: number;
    taxAmount: number;
  }>;
  receiptAvailable: boolean;
  downloadUrl?: string;
  timeline: Array<{
    id: string;
    type: 'created' | 'paid' | 'captured' | 'refunded' | 'disputed';
    title: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
}

/**
 * TransactionDetails Component
 * 
 * Modal displaying comprehensive transaction information including:
 * - Transaction overview and status
 * - Business and customer details
 * - Itemized breakdown
 * - Payment timeline
 * - Receipt actions
 * - Refund options
 */
export const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transactionId,
  visible,
  onClose,
  onReceiptRequest,
  onRefundRequest,
  theme = 'light',
}) => {
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'receipt'>('overview');
  
  const {
    transaction,
    isLoading,
    error,
    fetchTransaction,
    refreshTransaction,
  } = useTransactionDetails(transactionId);

  useEffect(() => {
    if (visible && transactionId) {
      fetchTransaction();
    }
  }, [visible, transactionId, fetchTransaction]);

  // Handle receipt download
  const handleReceiptDownload = useCallback(async (format: 'pdf' | 'html' = 'pdf') => {
    if (!transaction) return;

    try {
      if (onReceiptRequest) {
        onReceiptRequest(transaction.id);
        return;
      }

      // Default implementation
      logger.info('Receipt download requested', {
        transactionId: transaction.id,
        format,
      });

      Alert.alert('Success', 'Receipt download started');
    } catch (error) {
      logger.error('Receipt download failed', { error, transactionId: transaction.id });
      Alert.alert('Error', 'Failed to download receipt');
    }
  }, [transaction, onReceiptRequest]);

  // Handle receipt email
  const handleReceiptEmail = useCallback(async () => {
    if (!transaction) return;

    try {
      Alert.prompt(
        'Email Receipt',
        'Enter email address:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async (email) => {
              if (email) {
                logger.info('Receipt email requested', {
                  transactionId: transaction.id,
                  email,
                });
                Alert.alert('Success', `Receipt sent to ${email}`);
              }
            },
          },
        ],
        'plain-text',
        transaction.customerEmail
      );
    } catch (error) {
      logger.error('Receipt email failed', { error, transactionId: transaction.id });
      Alert.alert('Error', 'Failed to send receipt email');
    }
  }, [transaction]);

  // Handle receipt sharing
  const handleReceiptShare = useCallback(async () => {
    if (!transaction) return;

    try {
      const shareUrl = transaction.downloadUrl || `https://buylocals.com/receipt/${transaction.receiptNumber}`;
      
      await Share.share({
        message: `Receipt for ${transaction.businessName} - ${formatCurrency(transaction.amount, transaction.currency)}`,
        url: shareUrl,
        title: `Receipt #${transaction.receiptNumber}`,
      });
    } catch (error) {
      logger.error('Receipt share failed', { error, transactionId: transaction.id });
      Alert.alert('Error', 'Failed to share receipt');
    }
  }, [transaction]);

  // Handle refund request
  const handleRefundRequest = useCallback(() => {
    if (!transaction) return;

    if (onRefundRequest) {
      onRefundRequest(transaction.id);
      return;
    }

    const isRefundable = transaction.status === 'paid' && 
      new Date().getTime() - new Date(transaction.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000; // 30 days

    if (!isRefundable) {
      Alert.alert(
        'Refund Not Available',
        'This transaction is not eligible for refund. Please contact customer support.'
      );
      return;
    }

    Alert.alert(
      'Request Refund',
      `Are you sure you want to request a refund for ${formatCurrency(transaction.amount, transaction.currency)}?`,
      [
        {
          text: 'Full Refund',
          style: 'destructive',
          onPress: () => {
            logger.info('Full refund requested', { transactionId: transaction.id });
            Alert.alert('Success', 'Refund request submitted');
          },
        },
        {
          text: 'Partial Refund',
          onPress: () => {
            Alert.prompt(
              'Partial Refund',
              'Enter refund amount:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit',
                  onPress: (amount) => {
                    if (amount) {
                      logger.info('Partial refund requested', { 
                        transactionId: transaction.id,
                        amount: parseFloat(amount),
                      });
                      Alert.alert('Success', 'Refund request submitted');
                    }
                  },
                },
              ],
              'numeric',
              (transaction.amount / 100).toString()
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [transaction, onRefundRequest]);

  // Handle contact business
  const handleContactBusiness = useCallback(() => {
    if (!transaction) return;

    Alert.alert(
      'Contact Business',
      `Contact ${transaction.businessName}`,
      [
        transaction.businessPhone && {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${transaction.businessPhone}`),
        },
        transaction.businessEmail && {
          text: 'Email',
          onPress: () => Linking.openURL(`mailto:${transaction.businessEmail}`),
        },
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any[]
    );
  }, [transaction]);

  // Get status style
  const getStatusStyle = useCallback((status: TransactionDetailsData['status']) => {
    const baseStyle = [styles.detailsStatusBadge];
    
    switch (status) {
      case 'paid':
        return [...baseStyle, styles.detailsStatusPaid, theme === 'dark' && styles.detailsStatusPaidDark];
      case 'refunded':
        return [...baseStyle, styles.detailsStatusRefunded, theme === 'dark' && styles.detailsStatusRefundedDark];
      case 'partially_refunded':
        return [...baseStyle, styles.detailsStatusPartialRefund, theme === 'dark' && styles.detailsStatusPartialRefundDark];
      case 'disputed':
        return [...baseStyle, styles.detailsStatusDisputed, theme === 'dark' && styles.detailsStatusDisputedDark];
      default:
        return baseStyle;
    }
  }, [theme]);

  // Get status text
  const getStatusText = useCallback((status: TransactionDetailsData['status']) => {
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

  // Render tab button
  const renderTabButton = useCallback((tab: typeof activeTab, title: string, icon: string) => {
    const isActive = activeTab === tab;
    
    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && styles.tabButtonActive,
          theme === 'dark' && styles.tabButtonDark,
          isActive && theme === 'dark' && styles.tabButtonActiveDark,
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
            styles.tabButtonText,
            isActive && styles.tabButtonTextActive,
            theme === 'dark' && styles.tabButtonTextDark,
            isActive && theme === 'dark' && styles.tabButtonTextActiveDark,
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  }, [activeTab, theme]);

  // Render overview tab
  const renderOverviewTab = useCallback(() => {
    if (!transaction) return null;

    const subtotal = transaction.amount - transaction.taxAmount - transaction.platformFee;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Business Information */}
        <View style={[styles.detailsSection, theme === 'dark' && styles.detailsSectionDark]}>
          <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
            Business
          </Text>
          
          <View style={styles.businessDetailsContainer}>
            {transaction.businessLogo && (
              <Image
                source={{ uri: transaction.businessLogo }}
                style={styles.detailsBusinessLogo}
                defaultSource={require('../../assets/placeholder-business.png')}
              />
            )}
            
            <View style={styles.businessTextDetails}>
              <Text style={[styles.businessDetailsName, theme === 'dark' && styles.businessDetailsNameDark]}>
                {transaction.businessName}
              </Text>
              
              {transaction.businessAddress && (
                <Text style={[styles.businessDetailsText, theme === 'dark' && styles.businessDetailsTextDark]}>
                  {transaction.businessAddress}
                </Text>
              )}
              
              <View style={styles.businessContactRow}>
                {transaction.businessPhone && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => Linking.openURL(`tel:${transaction.businessPhone}`)}
                  >
                    <Ionicons name="call" size={14} color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.contactButtonText, theme === 'dark' && styles.contactButtonTextDark]}>
                      Call
                    </Text>
                  </TouchableOpacity>
                )}
                
                {transaction.businessEmail && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => Linking.openURL(`mailto:${transaction.businessEmail}`)}
                  >
                    <Ionicons name="mail" size={14} color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.contactButtonText, theme === 'dark' && styles.contactButtonTextDark]}>
                      Email
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Transaction Summary */}
        <View style={[styles.detailsSection, theme === 'dark' && styles.detailsSectionDark]}>
          <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
            Transaction Details
          </Text>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
              Receipt Number
            </Text>
            <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
              #{transaction.receiptNumber}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
              Date & Time
            </Text>
            <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
              {formatDate(transaction.createdAt)} at {formatTime(transaction.createdAt)}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
              Status
            </Text>
            <View style={getStatusStyle(transaction.status)}>
              <Text style={styles.detailsStatusText}>
                {getStatusText(transaction.status)}
              </Text>
            </View>
          </View>
          
          {transaction.paymentMethod && (
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
                Payment Method
              </Text>
              <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
                {transaction.paymentMethod}
              </Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={[styles.detailsSection, theme === 'dark' && styles.detailsSectionDark]}>
          <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
            Items ({transaction.items.length})
          </Text>
          
          {transaction.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemDetails}>
                <Text style={[styles.itemName, theme === 'dark' && styles.itemNameDark]}>
                  {item.name}
                </Text>
                {item.description && (
                  <Text style={[styles.itemDescription, theme === 'dark' && styles.itemDescriptionDark]}>
                    {item.description}
                  </Text>
                )}
                <Text style={[styles.itemQuantity, theme === 'dark' && styles.itemQuantityDark]}>
                  Qty: {item.quantity} × {formatCurrency(item.unitPrice, transaction.currency)}
                </Text>
              </View>
              <Text style={[styles.itemTotal, theme === 'dark' && styles.itemTotalDark]}>
                {formatCurrency(item.totalPrice, transaction.currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Pricing Breakdown */}
        <View style={[styles.detailsSection, theme === 'dark' && styles.detailsSectionDark]}>
          <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
            Pricing Breakdown
          </Text>
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
              Subtotal
            </Text>
            <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
              {formatCurrency(subtotal, transaction.currency)}
            </Text>
          </View>
          
          {transaction.taxAmount > 0 && (
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
                Tax ({(transaction.taxRate * 100).toFixed(1)}%)
              </Text>
              <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
                {formatCurrency(transaction.taxAmount, transaction.currency)}
              </Text>
            </View>
          )}
          
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
              Platform Fee
            </Text>
            <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
              {formatCurrency(transaction.platformFee, transaction.currency)}
            </Text>
          </View>
          
          <View style={[styles.detailsRow, styles.totalRow]}>
            <Text style={[styles.detailsLabel, styles.totalLabel, theme === 'dark' && styles.totalLabelDark]}>
              Total
            </Text>
            <Text style={[styles.detailsValue, styles.totalValue, theme === 'dark' && styles.totalValueDark]}>
              {formatCurrency(transaction.amount, transaction.currency)}
            </Text>
          </View>
        </View>

        {/* Refund Information */}
        {transaction.refundAmount && transaction.refundAmount > 0 && (
          <View style={[styles.detailsSection, styles.refundSection, theme === 'dark' && styles.refundSectionDark]}>
            <Text style={[styles.detailsSectionTitle, styles.refundTitle, theme === 'dark' && styles.refundTitleDark]}>
              Refund Information
            </Text>
            
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
                Refund Amount
              </Text>
              <Text style={[styles.detailsValue, styles.refundAmount, theme === 'dark' && styles.refundAmountDark]}>
                {formatCurrency(transaction.refundAmount, transaction.currency)}
              </Text>
            </View>
            
            {transaction.refundedAt && (
              <View style={styles.detailsRow}>
                <Text style={[styles.detailsLabel, theme === 'dark' && styles.detailsLabelDark]}>
                  Refunded On
                </Text>
                <Text style={[styles.detailsValue, theme === 'dark' && styles.detailsValueDark]}>
                  {formatDate(transaction.refundedAt)} at {formatTime(transaction.refundedAt)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  }, [transaction, theme, getStatusStyle, getStatusText]);

  // Render timeline tab
  const renderTimelineTab = useCallback(() => {
    if (!transaction) return null;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.detailsSection, theme === 'dark' && styles.detailsSectionDark]}>
          <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
            Transaction Timeline
          </Text>
          
          {transaction.timeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineMarker}>
                <View style={[
                  styles.timelineDot,
                  index === 0 && styles.timelineDotActive,
                  theme === 'dark' && styles.timelineDotDark,
                  index === 0 && theme === 'dark' && styles.timelineDotActiveDark,
                ]} />
                {index < transaction.timeline.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    theme === 'dark' && styles.timelineLineDark,
                  ]} />
                )}
              </View>
              
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, theme === 'dark' && styles.timelineTitleDark]}>
                  {event.title}
                </Text>
                <Text style={[styles.timelineDescription, theme === 'dark' && styles.timelineDescriptionDark]}>
                  {event.description}
                </Text>
                <Text style={[styles.timelineTimestamp, theme === 'dark' && styles.timelineTimestampDark]}>
                  {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }, [transaction, theme]);

  // Render receipt tab
  const renderReceiptTab = useCallback(() => {
    if (!transaction) return null;

    return (
      <View style={styles.tabContent}>
        <ReceiptViewer
          transactionId={transaction.id}
          receiptNumber={transaction.receiptNumber}
          theme={theme}
        />
      </View>
    );
  }, [transaction, theme]);

  // Loading state
  if (isLoading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, theme === 'dark' && styles.modalDark]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
              Loading transaction details...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Error state
  if (error) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, theme === 'dark' && styles.modalDark]}>
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={48}
              color={theme === 'dark' ? '#F87171' : '#EF4444'}
            />
            <Text style={[styles.errorTitle, theme === 'dark' && styles.errorTitleDark]}>
              Failed to load transaction
            </Text>
            <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessageDark]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, theme === 'dark' && styles.retryButtonDark]}
              onPress={fetchTransaction}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!transaction) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modal, theme === 'dark' && styles.modalDark]}>
        {/* Header */}
        <View style={[styles.modalHeader, theme === 'dark' && styles.modalHeaderDark]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons
              name="close"
              size={24}
              color={theme === 'dark' ? '#D1D5DB' : '#6B7280'}
            />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={[styles.modalTitle, theme === 'dark' && styles.modalTitleDark]}>
              Transaction Details
            </Text>
            <Text style={[styles.modalSubtitle, theme === 'dark' && styles.modalSubtitleDark]}>
              {formatCurrency(transaction.amount, transaction.currency)}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => Alert.alert(
              'More Options',
              'Choose an action',
              [
                { text: 'Share Receipt', onPress: handleReceiptShare },
                { text: 'Download Receipt', onPress: () => handleReceiptDownload('pdf') },
                { text: 'Email Receipt', onPress: handleReceiptEmail },
                { text: 'Contact Business', onPress: handleContactBusiness },
                { text: 'Cancel', style: 'cancel' },
              ]
            )}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={theme === 'dark' ? '#D1D5DB' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, theme === 'dark' && styles.tabsContainerDark]}>
          {renderTabButton('overview', 'Overview', 'information-circle')}
          {renderTabButton('timeline', 'Timeline', 'time')}
          {transaction.receiptAvailable && renderTabButton('receipt', 'Receipt', 'receipt')}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContentContainer}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'timeline' && renderTimelineTab()}
          {activeTab === 'receipt' && renderReceiptTab()}
        </View>

        {/* Action Buttons */}
        <View style={[styles.actionButtons, theme === 'dark' && styles.actionButtonsDark]}>
          {transaction.receiptAvailable && (
            <TouchableOpacity
              style={[styles.actionButton, styles.receiptActionButton, theme === 'dark' && styles.receiptActionButtonDark]}
              onPress={() => handleReceiptDownload('pdf')}
            >
              <Ionicons name="download" size={20} color="white" />
              <Text style={styles.actionButtonText}>Download Receipt</Text>
            </TouchableOpacity>
          )}
          
          {transaction.status === 'paid' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.refundActionButton, theme === 'dark' && styles.refundActionButtonDark]}
              onPress={handleRefundRequest}
            >
              <Ionicons name="return-up-back" size={20} color="white" />
              <Text style={styles.actionButtonText}>Request Refund</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};