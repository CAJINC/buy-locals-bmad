import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Linking,
} from 'react-native';
import { styles } from './styles';
import { logger } from '../../utils/logger';
import { PaymentIntent } from '../../services/paymentService';

export interface PaymentSuccessScreenProps {
  paymentResult: {
    paymentIntent?: PaymentIntent;
    amount: number;
    currency: string;
    paymentMethod?: string;
    transactionId?: string;
    businessName?: string;
    serviceName?: string;
    confirmationCode?: string;
    receiptUrl?: string;
    estimatedDelivery?: string;
  };
  onContinueShopping: () => void;
  onViewReceipt?: () => void;
  onContactBusiness?: () => void;
  onShareReceipt?: () => void;
  theme?: 'light' | 'dark';
  showActions?: boolean;
}

/**
 * PaymentSuccessScreen Component
 * 
 * Displays payment confirmation after successful transaction
 * Shows transaction details, receipt access, and next actions
 */
export const PaymentSuccessScreen: React.FC<PaymentSuccessScreenProps> = ({
  paymentResult,
  onContinueShopping,
  onViewReceipt,
  onContactBusiness,
  onShareReceipt,
  theme = 'light',
  showActions = true,
}) => {
  const [receiptShared, setReceiptShared] = useState(false);

  useEffect(() => {
    // Log successful payment for analytics
    logger.info('Payment success screen displayed', {
      transactionId: paymentResult.transactionId,
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      paymentMethod: paymentResult.paymentMethod,
      businessName: paymentResult.businessName,
    });
  }, [paymentResult]);

  // Format currency display
  const formatCurrency = useCallback((value: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }, []);

  // Format payment method display
  const formatPaymentMethod = useCallback((method?: string): string => {
    if (!method) return 'Payment Method';
    
    switch (method.toLowerCase()) {
      case 'card':
        return 'Credit/Debit Card';
      case 'apple_pay':
        return 'Apple Pay';
      case 'google_pay':
        return 'Google Pay';
      case 'saved_card':
        return 'Saved Card';
      default:
        return method.charAt(0).toUpperCase() + method.slice(1);
    }
  }, []);

  // Handle receipt sharing
  const handleShareReceipt = useCallback(async () => {
    try {
      if (onShareReceipt) {
        onShareReceipt();
        return;
      }

      const shareMessage = `Payment Confirmation\n\n` +
        `Business: ${paymentResult.businessName || 'Buy Locals Business'}\n` +
        `Amount: ${formatCurrency(paymentResult.amount, paymentResult.currency)}\n` +
        `Transaction ID: ${paymentResult.transactionId || 'N/A'}\n` +
        `Confirmation: ${paymentResult.confirmationCode || 'N/A'}\n\n` +
        `Thank you for supporting local businesses!`;

      await Share.share({
        message: shareMessage,
        title: 'Payment Receipt - Buy Locals',
      });

      setReceiptShared(true);
      logger.info('Receipt shared successfully', {
        transactionId: paymentResult.transactionId,
      });

    } catch (error) {
      logger.error('Failed to share receipt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: paymentResult.transactionId,
      });
      Alert.alert('Error', 'Failed to share receipt. Please try again.');
    }
  }, [onShareReceipt, paymentResult, formatCurrency]);

  // Handle receipt viewing
  const handleViewReceipt = useCallback(async () => {
    try {
      if (onViewReceipt) {
        onViewReceipt();
        return;
      }

      if (paymentResult.receiptUrl) {
        const supported = await Linking.canOpenURL(paymentResult.receiptUrl);
        if (supported) {
          await Linking.openURL(paymentResult.receiptUrl);
        } else {
          Alert.alert('Error', 'Unable to open receipt. Please check your internet connection.');
        }
      } else {
        Alert.alert('Receipt', 'Receipt will be sent to your email address.');
      }
    } catch (error) {
      logger.error('Failed to open receipt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        receiptUrl: paymentResult.receiptUrl,
      });
      Alert.alert('Error', 'Unable to open receipt. Please try again.');
    }
  }, [onViewReceipt, paymentResult.receiptUrl]);

  // Handle contact business
  const handleContactBusiness = useCallback(() => {
    if (onContactBusiness) {
      onContactBusiness();
    } else {
      Alert.alert(
        'Contact Business',
        'You can contact the business directly through their profile or the booking details.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [onContactBusiness]);

  // Get estimated delivery/completion text
  const getDeliveryText = useCallback((): string => {
    if (!paymentResult.estimatedDelivery) return '';
    
    const deliveryDate = new Date(paymentResult.estimatedDelivery);
    const now = new Date();
    const diffTime = deliveryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return 'Available now';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return deliveryDate.toLocaleDateString();
    }
  }, [paymentResult.estimatedDelivery]);

  return (
    <ScrollView
      style={[styles.successContainer, theme === 'dark' && styles.successContainerDark]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Success Icon and Title */}
      <View style={styles.successHeader}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={[styles.successTitle, theme === 'dark' && styles.successTitleDark]}>
          Payment Successful!
        </Text>
        <Text style={[styles.successSubtitle, theme === 'dark' && styles.successSubtitleDark]}>
          Your payment has been processed successfully
        </Text>
      </View>

      {/* Transaction Details */}
      <View style={[styles.successDetails, theme === 'dark' && styles.successDetailsDark]}>
        <Text style={[styles.detailsSectionTitle, theme === 'dark' && styles.detailsSectionTitleDark]}>
          Transaction Details
        </Text>

        {/* Business Name */}
        {paymentResult.businessName && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Business:
            </Text>
            <Text style={[styles.successDetailValue, theme === 'dark' && styles.successDetailValueDark]}>
              {paymentResult.businessName}
            </Text>
          </View>
        )}

        {/* Service Name */}
        {paymentResult.serviceName && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Service:
            </Text>
            <Text style={[styles.successDetailValue, theme === 'dark' && styles.successDetailValueDark]}>
              {paymentResult.serviceName}
            </Text>
          </View>
        )}

        {/* Amount */}
        <View style={styles.successDetailRow}>
          <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
            Amount:
          </Text>
          <Text style={[styles.successDetailValue, styles.amountValue, theme === 'dark' && styles.successDetailValueDark]}>
            {formatCurrency(paymentResult.amount, paymentResult.currency)}
          </Text>
        </View>

        {/* Payment Method */}
        {paymentResult.paymentMethod && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Payment Method:
            </Text>
            <Text style={[styles.successDetailValue, theme === 'dark' && styles.successDetailValueDark]}>
              {formatPaymentMethod(paymentResult.paymentMethod)}
            </Text>
          </View>
        )}

        {/* Transaction ID */}
        {paymentResult.transactionId && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Transaction ID:
            </Text>
            <Text style={[styles.successDetailValue, styles.transactionIdValue, theme === 'dark' && styles.successDetailValueDark]}>
              {paymentResult.transactionId}
            </Text>
          </View>
        )}

        {/* Confirmation Code */}
        {paymentResult.confirmationCode && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Confirmation:
            </Text>
            <Text style={[styles.successDetailValue, styles.confirmationValue, theme === 'dark' && styles.successDetailValueDark]}>
              {paymentResult.confirmationCode}
            </Text>
          </View>
        )}

        {/* Estimated Delivery */}
        {paymentResult.estimatedDelivery && (
          <View style={styles.successDetailRow}>
            <Text style={[styles.successDetailLabel, theme === 'dark' && styles.successDetailLabelDark]}>
              Estimated Completion:
            </Text>
            <Text style={[styles.successDetailValue, theme === 'dark' && styles.successDetailValueDark]}>
              {getDeliveryText()}
            </Text>
          </View>
        )}
      </View>

      {/* Next Steps */}
      <View style={[styles.nextStepsContainer, theme === 'dark' && styles.nextStepsContainerDark]}>
        <Text style={[styles.nextStepsTitle, theme === 'dark' && styles.nextStepsTitleDark]}>
          What&apos;s Next?
        </Text>
        
        <View style={styles.nextStepItem}>
          <Text style={styles.nextStepIcon}>📧</Text>
          <Text style={[styles.nextStepText, theme === 'dark' && styles.nextStepTextDark]}>
            A receipt will be sent to your email
          </Text>
        </View>

        {paymentResult.businessName && (
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepIcon}>📱</Text>
            <Text style={[styles.nextStepText, theme === 'dark' && styles.nextStepTextDark]}>
              The business will contact you with booking details
            </Text>
          </View>
        )}

        <View style={styles.nextStepItem}>
          <Text style={styles.nextStepIcon}>⭐</Text>
          <Text style={[styles.nextStepText, theme === 'dark' && styles.nextStepTextDark]}>
            Don&apos;t forget to leave a review after your experience
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.successActions}>
          {/* Primary Actions */}
          <TouchableOpacity
            style={[styles.primaryButton, theme === 'dark' && styles.primaryButtonDark]}
            onPress={onContinueShopping}
            accessibilityLabel="Continue shopping"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Continue Shopping</Text>
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            {/* View Receipt */}
            {(paymentResult.receiptUrl || onViewReceipt) && (
              <TouchableOpacity
                style={[styles.secondaryButton, theme === 'dark' && styles.secondaryButtonDark]}
                onPress={handleViewReceipt}
                accessibilityLabel="View receipt"
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryButtonText, theme === 'dark' && styles.secondaryButtonTextDark]}>
                  View Receipt
                </Text>
              </TouchableOpacity>
            )}

            {/* Share Receipt */}
            <TouchableOpacity
              style={[styles.secondaryButton, theme === 'dark' && styles.secondaryButtonDark]}
              onPress={handleShareReceipt}
              accessibilityLabel="Share receipt"
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryButtonText, theme === 'dark' && styles.secondaryButtonTextDark]}>
                {receiptShared ? 'Shared ✓' : 'Share Receipt'}
              </Text>
            </TouchableOpacity>

            {/* Contact Business */}
            {paymentResult.businessName && (
              <TouchableOpacity
                style={[styles.secondaryButton, theme === 'dark' && styles.secondaryButtonDark]}
                onPress={handleContactBusiness}
                accessibilityLabel="Contact business"
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryButtonText, theme === 'dark' && styles.secondaryButtonTextDark]}>
                  Contact Business
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Security Notice */}
      <View style={[styles.securityNotice, theme === 'dark' && styles.securityNoticeDark]}>
        <Text style={styles.securityIcon}>🔒</Text>
        <Text style={[styles.securityText, theme === 'dark' && styles.securityTextDark]}>
          Your transaction is secure and protected by bank-level encryption
        </Text>
      </View>
    </ScrollView>
  );
};