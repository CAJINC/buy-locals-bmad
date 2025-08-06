import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { PaymentMethod } from '../../services/paymentService';
import { styles } from './styles';
import { logger } from '../../utils/logger';

export interface PaymentMethodSelectorProps {
  selectedMethod: 'card' | 'apple_pay' | 'google_pay' | 'saved_card';
  onMethodSelect: (method: 'card' | 'apple_pay' | 'google_pay' | 'saved_card', paymentMethodId?: string) => void;
  theme?: 'light' | 'dark';
  showSavedMethods?: boolean;
  allowNewCard?: boolean;
}

/**
 * PaymentMethodSelector Component
 * 
 * Allows users to select between different payment methods:
 * - New credit/debit card
 * - Apple Pay (iOS only)
 * - Google Pay (Android only)  
 * - Saved payment methods
 */
export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodSelect,
  theme = 'light',
  showSavedMethods = true,
  allowNewCard = true,
}) => {
  const { paymentMethods, isLoading, loadPaymentMethods } = usePaymentMethods();
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string>();

  useEffect(() => {
    if (showSavedMethods) {
      loadPaymentMethods();
    }
  }, [showSavedMethods, loadPaymentMethods]);

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: 'card' | 'apple_pay' | 'google_pay' | 'saved_card', paymentMethodId?: string) => {
    logger.debug('Payment method selected', { method, paymentMethodId });
    
    if (method === 'saved_card' && paymentMethodId) {
      setSelectedSavedMethodId(paymentMethodId);
    }
    
    onMethodSelect(method, paymentMethodId);
  }, [onMethodSelect]);

  // Format card brand name
  const formatCardBrand = useCallback((brand: string): string => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'Visa';
      case 'mastercard':
        return 'Mastercard';
      case 'amex':
        return 'American Express';
      case 'discover':
        return 'Discover';
      case 'diners':
        return 'Diners Club';
      case 'jcb':
        return 'JCB';
      case 'unionpay':
        return 'UnionPay';
      default:
        return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }, []);

  // Get card brand icon
  const getCardIcon = useCallback((brand: string) => {
    // In a real app, you would use actual card brand icons
    const icons = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳',
      diners: '💳',
      jcb: '💳',
      unionpay: '💳',
    };
    return icons[brand.toLowerCase() as keyof typeof icons] || '💳';
  }, []);

  // Render saved payment method
  const renderSavedMethod = useCallback((method: PaymentMethod) => {
    const isSelected = selectedMethod === 'saved_card' && selectedSavedMethodId === method.id;
    
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.paymentMethodOption,
          isSelected && styles.paymentMethodOptionSelected,
          theme === 'dark' && styles.paymentMethodOptionDark,
          isSelected && theme === 'dark' && styles.paymentMethodOptionSelectedDark,
        ]}
        onPress={() => handleMethodSelect('saved_card', method.id)}
        accessibilityLabel={`Saved ${method.card?.brand || 'card'} ending in ${method.card?.last4}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.paymentMethodContent}>
          <View style={styles.paymentMethodIcon}>
            <Text style={styles.cardIcon}>
              {method.card ? getCardIcon(method.card.brand) : '💳'}
            </Text>
          </View>
          
          <View style={styles.paymentMethodInfo}>
            <Text style={[styles.paymentMethodTitle, theme === 'dark' && styles.paymentMethodTitleDark]}>
              {method.card ? formatCardBrand(method.card.brand) : 'Card'}
            </Text>
            <Text style={[styles.paymentMethodDescription, theme === 'dark' && styles.paymentMethodDescriptionDark]}>
              {method.card ? `•••• •••• •••• ${method.card.last4}` : 'Saved payment method'}
            </Text>
            {method.card && (
              <Text style={[styles.paymentMethodExpiry, theme === 'dark' && styles.paymentMethodExpiryDark]}>
                Expires {String(method.card.expMonth).padStart(2, '0')}/{method.card.expYear}
              </Text>
            )}
          </View>

          {method.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>

        <View style={[
          styles.radioButton,
          isSelected && styles.radioButtonSelected,
          theme === 'dark' && styles.radioButtonDark,
        ]}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>
    );
  }, [selectedMethod, selectedSavedMethodId, theme, handleMethodSelect, formatCardBrand, getCardIcon]);

  return (
    <View style={[styles.selectorContainer, theme === 'dark' && styles.selectorContainerDark]}>
      <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
        Payment Method
      </Text>

      <ScrollView
        style={styles.methodsList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* New Card Option */}
        {allowNewCard && (
          <TouchableOpacity
            style={[
              styles.paymentMethodOption,
              selectedMethod === 'card' && styles.paymentMethodOptionSelected,
              theme === 'dark' && styles.paymentMethodOptionDark,
              selectedMethod === 'card' && theme === 'dark' && styles.paymentMethodOptionSelectedDark,
            ]}
            onPress={() => handleMethodSelect('card')}
            accessibilityLabel="Pay with new card"
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedMethod === 'card' }}
          >
            <View style={styles.paymentMethodContent}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.cardIcon}>💳</Text>
              </View>
              
              <View style={styles.paymentMethodInfo}>
                <Text style={[styles.paymentMethodTitle, theme === 'dark' && styles.paymentMethodTitleDark]}>
                  Credit or Debit Card
                </Text>
                <Text style={[styles.paymentMethodDescription, theme === 'dark' && styles.paymentMethodDescriptionDark]}>
                  Enter card details manually
                </Text>
              </View>
            </View>

            <View style={[
              styles.radioButton,
              selectedMethod === 'card' && styles.radioButtonSelected,
              theme === 'dark' && styles.radioButtonDark,
            ]}>
              {selectedMethod === 'card' && <View style={styles.radioButtonInner} />}
            </View>
          </TouchableOpacity>
        )}

        {/* Apple Pay Option (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              styles.paymentMethodOption,
              selectedMethod === 'apple_pay' && styles.paymentMethodOptionSelected,
              theme === 'dark' && styles.paymentMethodOptionDark,
              selectedMethod === 'apple_pay' && theme === 'dark' && styles.paymentMethodOptionSelectedDark,
            ]}
            onPress={() => handleMethodSelect('apple_pay')}
            accessibilityLabel="Pay with Apple Pay"
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedMethod === 'apple_pay' }}
          >
            <View style={styles.paymentMethodContent}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.cardIcon}>🍎</Text>
              </View>
              
              <View style={styles.paymentMethodInfo}>
                <Text style={[styles.paymentMethodTitle, theme === 'dark' && styles.paymentMethodTitleDark]}>
                  Apple Pay
                </Text>
                <Text style={[styles.paymentMethodDescription, theme === 'dark' && styles.paymentMethodDescriptionDark]}>
                  Pay securely with Touch ID or Face ID
                </Text>
              </View>
            </View>

            <View style={[
              styles.radioButton,
              selectedMethod === 'apple_pay' && styles.radioButtonSelected,
              theme === 'dark' && styles.radioButtonDark,
            ]}>
              {selectedMethod === 'apple_pay' && <View style={styles.radioButtonInner} />}
            </View>
          </TouchableOpacity>
        )}

        {/* Google Pay Option (Android only) */}
        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[
              styles.paymentMethodOption,
              selectedMethod === 'google_pay' && styles.paymentMethodOptionSelected,
              theme === 'dark' && styles.paymentMethodOptionDark,
              selectedMethod === 'google_pay' && theme === 'dark' && styles.paymentMethodOptionSelectedDark,
            ]}
            onPress={() => handleMethodSelect('google_pay')}
            accessibilityLabel="Pay with Google Pay"
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedMethod === 'google_pay' }}
          >
            <View style={styles.paymentMethodContent}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.cardIcon}>🟢</Text>
              </View>
              
              <View style={styles.paymentMethodInfo}>
                <Text style={[styles.paymentMethodTitle, theme === 'dark' && styles.paymentMethodTitleDark]}>
                  Google Pay
                </Text>
                <Text style={[styles.paymentMethodDescription, theme === 'dark' && styles.paymentMethodDescriptionDark]}>
                  Pay securely with your saved cards
                </Text>
              </View>
            </View>

            <View style={[
              styles.radioButton,
              selectedMethod === 'google_pay' && styles.radioButtonSelected,
              theme === 'dark' && styles.radioButtonDark,
            ]}>
              {selectedMethod === 'google_pay' && <View style={styles.radioButtonInner} />}
            </View>
          </TouchableOpacity>
        )}

        {/* Saved Payment Methods */}
        {showSavedMethods && (
          <>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme === 'dark' ? '#4F46E5' : '#3B82F6'} />
                <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
                  Loading saved methods...
                </Text>
              </View>
            ) : paymentMethods.length > 0 ? (
              <>
                <Text style={[styles.subsectionTitle, theme === 'dark' && styles.subsectionTitleDark]}>
                  Saved Payment Methods
                </Text>
                {paymentMethods.map(renderSavedMethod)}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};