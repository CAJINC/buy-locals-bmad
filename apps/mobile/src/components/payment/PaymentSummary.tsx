import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { styles } from './styles';

export interface PaymentSummaryProps {
  amount: number;
  currency: string;
  description?: string;
  businessName?: string;
  serviceName?: string;
  taxes?: number;
  fees?: number;
  discount?: number;
  theme?: 'light' | 'dark';
  showBreakdown?: boolean;
}

/**
 * PaymentSummary Component
 * 
 * Shows payment breakdown with taxes, fees, and total amount
 * Provides clear pricing transparency for users
 */
export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  amount,
  currency,
  description,
  businessName,
  serviceName,
  taxes = 0,
  fees = 0,
  discount = 0,
  theme = 'light',
  showBreakdown = true,
}) => {
  // Calculate amounts in proper currency format (cents to dollars)
  const subtotal = useMemo(() => (amount - taxes - fees + discount) / 100, [amount, taxes, fees, discount]);
  const taxAmount = useMemo(() => taxes / 100, [taxes]);
  const feeAmount = useMemo(() => fees / 100, [fees]);
  const discountAmount = useMemo(() => discount / 100, [discount]);
  const totalAmount = useMemo(() => amount / 100, [amount]);

  // Format currency display
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };


  return (
    <View style={[styles.summaryContainer, theme === 'dark' && styles.summaryContainerDark]}>
      <Text style={[styles.summaryTitle, theme === 'dark' && styles.summaryTitleDark]}>
        Payment Summary
      </Text>

      {/* Business and Service Info */}
      {(businessName || serviceName || description) && (
        <View style={styles.summaryDetails}>
          {businessName && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Business:
              </Text>
              <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
                {businessName}
              </Text>
            </View>
          )}

          {serviceName && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Service:
              </Text>
              <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
                {serviceName}
              </Text>
            </View>
          )}

          {description && !serviceName && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, theme === 'dark' && styles.summaryLabelDark]}>
                Description:
              </Text>
              <Text style={[styles.summaryValue, theme === 'dark' && styles.summaryValueDark]}>
                {description}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Price Breakdown */}
      {showBreakdown && (subtotal !== totalAmount || taxAmount > 0 || feeAmount > 0 || discountAmount > 0) && (
        <View style={styles.breakdownSection}>
          <Text style={[styles.breakdownTitle, theme === 'dark' && styles.breakdownTitleDark]}>
            Price Breakdown
          </Text>

          {/* Subtotal */}
          {subtotal !== totalAmount && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, theme === 'dark' && styles.breakdownLabelDark]}>
                Subtotal
              </Text>
              <Text style={[styles.breakdownValue, theme === 'dark' && styles.breakdownValueDark]}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
          )}

          {/* Discount */}
          {discountAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, styles.discountLabel, theme === 'dark' && styles.breakdownLabelDark]}>
                Discount
              </Text>
              <Text style={[styles.breakdownValue, styles.discountValue, theme === 'dark' && styles.breakdownValueDark]}>
                -{formatCurrency(discountAmount)}
              </Text>
            </View>
          )}

          {/* Taxes */}
          {taxAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, theme === 'dark' && styles.breakdownLabelDark]}>
                Taxes & Fees
              </Text>
              <Text style={[styles.breakdownValue, theme === 'dark' && styles.breakdownValueDark]}>
                {formatCurrency(taxAmount)}
              </Text>
            </View>
          )}

          {/* Processing Fees */}
          {feeAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, theme === 'dark' && styles.breakdownLabelDark]}>
                Processing Fee
              </Text>
              <Text style={[styles.breakdownValue, theme === 'dark' && styles.breakdownValueDark]}>
                {formatCurrency(feeAmount)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Total Amount */}
      <View style={[styles.totalSection, theme === 'dark' && styles.totalSectionDark]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, theme === 'dark' && styles.totalLabelDark]}>
            Total
          </Text>
          <Text style={[styles.totalValue, theme === 'dark' && styles.totalValueDark]}>
            {formatCurrency(totalAmount)}
          </Text>
        </View>
      </View>

      {/* Security Notice */}
      <View style={[styles.securityNotice, theme === 'dark' && styles.securityNoticeDark]}>
        <Text style={styles.securityIcon}>🔒</Text>
        <Text style={[styles.securityText, theme === 'dark' && styles.securityTextDark]}>
          Your payment is secured with 256-bit SSL encryption
        </Text>
      </View>

      {/* Currency Notice */}
      {currency.toUpperCase() !== 'USD' && (
        <View style={[styles.currencyNotice, theme === 'dark' && styles.currencyNoticeDark]}>
          <Text style={[styles.currencyNoticeText, theme === 'dark' && styles.currencyNoticeTextDark]}>
            Amount shown in {currency.toUpperCase()}. Your bank may apply currency conversion fees.
          </Text>
        </View>
      )}
    </View>
  );
};