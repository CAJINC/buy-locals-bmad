import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { PaymentMethod } from '../../services/paymentService';
import { styles } from './styles';
import { logger } from '../../utils/logger';

export interface SavedPaymentMethodsProps {
  onMethodSelect?: (paymentMethod: PaymentMethod) => void;
  theme?: 'light' | 'dark';
  allowSelection?: boolean;
  allowDeletion?: boolean;
  allowDefault?: boolean;
}

/**
 * SavedPaymentMethods Component
 * 
 * Displays and manages user's saved payment methods
 * Supports deletion, setting default, and selection
 */
export const SavedPaymentMethods: React.FC<SavedPaymentMethodsProps> = ({
  onMethodSelect,
  theme = 'light',
  allowSelection = false,
  allowDeletion = true,
  allowDefault = true,
}) => {
  const {
    paymentMethods,
    isLoading,
    loadPaymentMethods,
    deletePaymentMethod,
    setDefaultPaymentMethod,
  } = usePaymentMethods();

  const [refreshing, setRefreshing] = useState(false);
  const [deletingMethod, setDeletingMethod] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPaymentMethods();
    } catch (error) {
      logger.error('Failed to refresh payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadPaymentMethods]);

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    if (allowSelection && onMethodSelect) {
      logger.debug('Payment method selected', { paymentMethodId: method.id });
      onMethodSelect(method);
    }
  }, [allowSelection, onMethodSelect]);

  // Handle payment method deletion
  const handleDeleteMethod = useCallback(async (method: PaymentMethod) => {
    if (!allowDeletion) return;

    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete your ${method.card?.brand} ending in ${method.card?.last4}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingMethod(method.id);
            try {
              await deletePaymentMethod(method.id);
              logger.info('Payment method deleted successfully', {
                paymentMethodId: method.id,
                cardBrand: method.card?.brand,
                last4: method.card?.last4,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete payment method';
              Alert.alert('Error', errorMessage);
              logger.error('Failed to delete payment method', {
                error: errorMessage,
                paymentMethodId: method.id,
              });
            } finally {
              setDeletingMethod(null);
            }
          },
        },
      ],
    );
  }, [allowDeletion, deletePaymentMethod]);

  // Handle set as default
  const handleSetDefault = useCallback(async (method: PaymentMethod) => {
    if (!allowDefault || method.isDefault) return;

    setSettingDefault(method.id);
    try {
      await setDefaultPaymentMethod(method.id);
      logger.info('Default payment method set successfully', {
        paymentMethodId: method.id,
        cardBrand: method.card?.brand,
        last4: method.card?.last4,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set default payment method';
      Alert.alert('Error', errorMessage);
      logger.error('Failed to set default payment method', {
        error: errorMessage,
        paymentMethodId: method.id,
      });
    } finally {
      setSettingDefault(null);
    }
  }, [allowDefault, setDefaultPaymentMethod]);

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

  // Render individual payment method
  const renderPaymentMethod = useCallback((method: PaymentMethod) => {
    const isDeleting = deletingMethod === method.id;
    const isSettingAsDefault = settingDefault === method.id;

    return (
      <View
        key={method.id}
        style={[
          styles.savedMethodCard,
          theme === 'dark' && styles.savedMethodCardDark,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.savedMethodContent,
            allowSelection && styles.savedMethodContentSelectable,
          ]}
          onPress={() => handleMethodSelect(method)}
          disabled={!allowSelection}
          accessibilityLabel={`${method.card?.brand || 'Card'} ending in ${method.card?.last4}`}
          accessibilityRole={allowSelection ? 'button' : 'none'}
        >
          <View style={styles.savedMethodIcon}>
            <Text style={styles.cardIcon}>
              {method.card ? getCardIcon(method.card.brand) : '💳'}
            </Text>
          </View>

          <View style={styles.savedMethodInfo}>
            <View style={styles.savedMethodHeader}>
              <Text style={[styles.savedMethodTitle, theme === 'dark' && styles.savedMethodTitleDark]}>
                {method.card ? formatCardBrand(method.card.brand) : 'Payment Method'}
              </Text>
              
              {method.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
            </View>

            <Text style={[styles.savedMethodDescription, theme === 'dark' && styles.savedMethodDescriptionDark]}>
              {method.card ? `•••• •••• •••• ${method.card.last4}` : 'Saved payment method'}
            </Text>

            {method.card && (
              <Text style={[styles.savedMethodExpiry, theme === 'dark' && styles.savedMethodExpiryDark]}>
                Expires {String(method.card.expMonth).padStart(2, '0')}/{method.card.expYear}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.savedMethodActions}>
          {/* Set as Default Button */}
          {allowDefault && !method.isDefault && (
            <TouchableOpacity
              style={[styles.actionButton, styles.defaultButton, theme === 'dark' && styles.actionButtonDark]}
              onPress={() => handleSetDefault(method)}
              disabled={isSettingAsDefault}
              accessibilityLabel="Set as default payment method"
              accessibilityRole="button"
            >
              {isSettingAsDefault ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Text style={[styles.defaultButtonText, theme === 'dark' && styles.defaultButtonTextDark]}>
                  Set Default
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Delete Button */}
          {allowDeletion && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, theme === 'dark' && styles.actionButtonDark]}
              onPress={() => handleDeleteMethod(method)}
              disabled={isDeleting}
              accessibilityLabel="Delete payment method"
              accessibilityRole="button"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text style={styles.deleteButtonText}>
                  Delete
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [
    deletingMethod,
    settingDefault,
    theme,
    allowSelection,
    allowDefault,
    allowDeletion,
    handleMethodSelect,
    handleSetDefault,
    handleDeleteMethod,
    formatCardBrand,
    getCardIcon,
  ]);

  if (isLoading && paymentMethods.length === 0) {
    return (
      <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme === 'dark' ? '#4F46E5' : '#3B82F6'} />
          <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
            Loading saved payment methods...
          </Text>
        </View>
      </View>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={[styles.emptyTitle, theme === 'dark' && styles.emptyTitleDark]}>
            No Saved Payment Methods
          </Text>
          <Text style={[styles.emptyDescription, theme === 'dark' && styles.emptyDescriptionDark]}>
            Add a payment method during checkout to save it for future use.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, theme === 'dark' && styles.containerDark]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme === 'dark' ? '#4F46E5' : '#3B82F6'}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, theme === 'dark' && styles.headerTitleDark]}>
          Saved Payment Methods
        </Text>
        <Text style={[styles.headerDescription, theme === 'dark' && styles.headerDescriptionDark]}>
          Manage your saved cards and payment methods
        </Text>
      </View>

      <View style={styles.methodsList}>
        {paymentMethods.map(renderPaymentMethod)}
      </View>

      {/* Security Notice */}
      <View style={[styles.securityNotice, theme === 'dark' && styles.securityNoticeDark]}>
        <Text style={styles.securityIcon}>🔒</Text>
        <View style={styles.securityContent}>
          <Text style={[styles.securityTitle, theme === 'dark' && styles.securityTitleDark]}>
            Secure Storage
          </Text>
          <Text style={[styles.securityDescription, theme === 'dark' && styles.securityDescriptionDark]}>
            Your payment information is securely stored and encrypted. We never store your full card number on our servers.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};