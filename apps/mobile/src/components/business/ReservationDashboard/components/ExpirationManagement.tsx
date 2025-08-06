import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  TextInput
} from 'react-native';
import type { ExpirationManagementProps, ExpiringReservation } from '../types';
import { expirationStyles as styles } from './ExpirationManagement.styles';

interface ExtendModalProps {
  visible: boolean;
  reservation: ExpiringReservation | null;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
}

const ExtendModal: React.FC<ExtendModalProps> = ({
  visible,
  reservation,
  onConfirm,
  onCancel,
  theme = 'light'
}) => {
  const [extensionMinutes, setExtensionMinutes] = useState('30');
  
  const predefinedOptions = [15, 30, 60, 120];

  const handleConfirm = () => {
    const minutes = parseInt(extensionMinutes);
    if (minutes > 0 && minutes <= 1440) { // Max 24 hours
      onConfirm(minutes);
      setExtensionMinutes('30');
    } else {
      Alert.alert('Invalid Duration', 'Please enter a valid extension time (1-1440 minutes).');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[
          styles.extensionModal,
          theme === 'dark' && styles.extensionModalDark
        ]}>
          <Text style={[
            styles.extensionModalTitle,
            theme === 'dark' && styles.extensionModalTitleDark
          ]}>
            Extend Reservation
          </Text>
          
          {reservation && (
            <Text style={[
              styles.extensionModalSubtitle,
              theme === 'dark' && styles.extensionModalSubtitleDark
            ]}>
              {reservation.customerName} - {reservation.serviceType}
            </Text>
          )}

          <Text style={[
            styles.extensionLabel,
            theme === 'dark' && styles.extensionLabelDark
          ]}>
            Extend by (minutes):
          </Text>

          <View style={styles.predefinedOptions}>
            {predefinedOptions.map(minutes => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.predefinedOption,
                  extensionMinutes === minutes.toString() && styles.predefinedOptionSelected,
                  theme === 'dark' && styles.predefinedOptionDark
                ]}
                onPress={() => setExtensionMinutes(minutes.toString())}
              >
                <Text style={[
                  styles.predefinedOptionText,
                  extensionMinutes === minutes.toString() && styles.predefinedOptionTextSelected,
                  theme === 'dark' && styles.predefinedOptionTextDark
                ]}>
                  {minutes}min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[
              styles.extensionInput,
              theme === 'dark' && styles.extensionInputDark
            ]}
            value={extensionMinutes}
            onChangeText={setExtensionMinutes}
            placeholder="Custom minutes"
            placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
            keyboardType="numeric"
          />

          <View style={styles.extensionModalActions}>
            <TouchableOpacity
              style={[styles.extensionModalButton, styles.extensionCancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.extensionCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.extensionModalButton, styles.extensionConfirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.extensionConfirmButtonText}>Extend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const ExpirationManagement: React.FC<ExpirationManagementProps> = ({
  expiringReservations,
  onAction,
  onClose,
  theme = 'light',
  businessId
}) => {
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ExpiringReservation | null>(null);

  // Handle reservation actions
  const handleAction = async (reservationId: string, action: string, data?: any) => {
    try {
      switch (action) {
        case 'extend':
          const reservation = expiringReservations.find(r => r.id === reservationId);
          setSelectedReservation(reservation || null);
          setShowExtendModal(true);
          break;

        case 'confirm_extend':
          await onAction(reservationId, 'extend', { additionalMinutes: data.minutes });
          setShowExtendModal(false);
          setSelectedReservation(null);
          break;

        case 'confirm':
          Alert.alert(
            'Confirm Reservation',
            'This will confirm the reservation and stop the expiration timer.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Confirm',
                onPress: () => onAction(reservationId, 'confirm')
              }
            ]
          );
          break;

        case 'cancel':
          Alert.alert(
            'Cancel Reservation',
            'This will permanently cancel the reservation. This action cannot be undone.',
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: () => onAction(reservationId, 'cancel', { reason: 'Expired' })
              }
            ]
          );
          break;

        case 'contact':
          Alert.alert(
            'Contact Customer',
            'Choose how to contact the customer:',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Call',
                onPress: () => onAction(reservationId, 'contact', { method: 'phone' })
              },
              {
                text: 'Email',
                onPress: () => onAction(reservationId, 'contact', { method: 'email' })
              }
            ]
          );
          break;

        default:
          await onAction(reservationId, action, data);
      }
    } catch (error) {
      console.error('Error handling expiration action:', error);
      Alert.alert('Error', 'Failed to perform action. Please try again.');
    }
  };

  // Get urgency level based on minutes until expiry
  const getUrgencyLevel = (minutesUntilExpiry: number): 'critical' | 'warning' | 'normal' => {
    if (minutesUntilExpiry <= 5) return 'critical';
    if (minutesUntilExpiry <= 15) return 'warning';
    return 'normal';
  };

  // Get urgency color
  const getUrgencyColor = (level: string): string => {
    switch (level) {
      case 'critical': return '#dc3545';
      case 'warning': return '#ffc107';
      default: return '#28a745';
    }
  };

  // Format time remaining
  const formatTimeRemaining = (minutes: number): string => {
    if (minutes <= 0) return 'Expired';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Render individual expiring reservation
  const renderExpiringReservation = (reservation: ExpiringReservation) => {
    const urgencyLevel = getUrgencyLevel(reservation.minutesUntilExpiry);
    const urgencyColor = getUrgencyColor(urgencyLevel);

    return (
      <View
        key={reservation.id}
        style={[
          styles.reservationCard,
          theme === 'dark' && styles.reservationCardDark
        ]}
      >
        {/* Header */}
        <View style={styles.reservationHeader}>
          <View style={styles.customerInfo}>
            <Text style={[
              styles.customerName,
              theme === 'dark' && styles.customerNameDark
            ]}>
              {reservation.customerName}
            </Text>
            <Text style={[
              styles.serviceType,
              theme === 'dark' && styles.serviceTypeDark
            ]}>
              {reservation.serviceType}
            </Text>
          </View>
          
          <View style={[
            styles.urgencyBadge,
            { backgroundColor: urgencyColor }
          ]}>
            <Text style={styles.urgencyText}>
              {urgencyLevel === 'critical' ? '🚨' : 
               urgencyLevel === 'warning' ? '⚠️' : '⏰'}
            </Text>
          </View>
        </View>

        {/* Time Info */}
        <View style={styles.timeInfo}>
          <View style={styles.timeItem}>
            <Text style={[
              styles.timeLabel,
              theme === 'dark' && styles.timeLabelDark
            ]}>
              Scheduled:
            </Text>
            <Text style={[
              styles.timeValue,
              theme === 'dark' && styles.timeValueDark
            ]}>
              {reservation.scheduledAt.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </Text>
          </View>

          <View style={styles.timeItem}>
            <Text style={[
              styles.timeLabel,
              theme === 'dark' && styles.timeLabelDark
            ]}>
              Expires:
            </Text>
            <Text style={[
              styles.timeValue,
              { color: urgencyColor }
            ]}>
              {formatTimeRemaining(reservation.minutesUntilExpiry)}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={[
            styles.amountLabel,
            theme === 'dark' && styles.amountLabelDark
          ]}>
            Amount:
          </Text>
          <Text style={[
            styles.amountValue,
            theme === 'dark' && styles.amountValueDark
          ]}>
            ${reservation.totalAmount.toFixed(2)}
          </Text>
        </View>

        {/* Warnings sent info */}
        {reservation.warningsSent.length > 0 && (
          <View style={styles.warningsInfo}>
            <Text style={[
              styles.warningsText,
              theme === 'dark' && styles.warningsTextDark
            ]}>
              {reservation.warningsSent.length} warning{reservation.warningsSent.length !== 1 ? 's' : ''} sent
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.extendButton]}
            onPress={() => handleAction(reservation.id, 'extend')}
          >
            <Text style={styles.extendButtonText}>⏰ Extend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={() => handleAction(reservation.id, 'confirm')}
          >
            <Text style={styles.confirmButtonText}>✓ Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => handleAction(reservation.id, 'contact')}
          >
            <Text style={styles.contactButtonText}>📞 Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => handleAction(reservation.id, 'cancel')}
          >
            <Text style={styles.cancelButtonText}>✗ Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>✅</Text>
      <Text style={[
        styles.emptyStateTitle,
        theme === 'dark' && styles.emptyStateTitleDark
      ]}>
        No Expiring Reservations
      </Text>
      <Text style={[
        styles.emptyStateMessage,
        theme === 'dark' && styles.emptyStateMessageDark
      ]}>
        All reservations are confirmed or have sufficient time remaining.
      </Text>
    </View>
  );

  // Get summary statistics
  const stats = {
    critical: expiringReservations.filter(r => getUrgencyLevel(r.minutesUntilExpiry) === 'critical').length,
    warning: expiringReservations.filter(r => getUrgencyLevel(r.minutesUntilExpiry) === 'warning').length,
    total: expiringReservations.length,
    totalValue: expiringReservations.reduce((sum, r) => sum + r.totalAmount, 0)
  };

  return (
    <SafeAreaView style={[
      styles.container,
      theme === 'dark' && styles.containerDark
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[
            styles.headerTitle,
            theme === 'dark' && styles.headerTitleDark
          ]}>
            Expiring Reservations
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        {stats.total > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.critical}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.warning}</Text>
              <Text style={styles.statLabel}>Warning</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${stats.totalValue.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Value</Text>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          expiringReservations.length === 0 && styles.emptyContentContainer
        ]}
        showsVerticalScrollIndicator={false}
      >
        {expiringReservations.length > 0 ? (
          expiringReservations
            .sort((a, b) => a.minutesUntilExpiry - b.minutesUntilExpiry)
            .map(renderExpiringReservation)
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* Bulk Actions Footer */}
      {stats.total > 0 && (
        <View style={styles.bulkActionsFooter}>
          <Text style={[
            styles.bulkActionsLabel,
            theme === 'dark' && styles.bulkActionsLabelDark
          ]}>
            Bulk Actions:
          </Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkActionButton, styles.bulkExtendButton]}
              onPress={() => {
                Alert.alert(
                  'Bulk Extend',
                  `Extend all ${stats.total} reservations by 30 minutes?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Extend All',
                      onPress: () => {
                        expiringReservations.forEach(r => {
                          onAction(r.id, 'extend', { additionalMinutes: 30 });
                        });
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.bulkExtendButtonText}>⏰ Extend All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bulkActionButton, styles.bulkContactButton]}
              onPress={() => {
                Alert.alert(
                  'Bulk Contact',
                  `Send reminder to all ${stats.total} customers?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Send Reminders',
                      onPress: () => {
                        expiringReservations.forEach(r => {
                          onAction(r.id, 'send_reminder');
                        });
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.bulkContactButtonText}>📧 Remind All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Extend Modal */}
      <ExtendModal
        visible={showExtendModal}
        reservation={selectedReservation}
        theme={theme}
        onConfirm={(minutes) => {
          if (selectedReservation) {
            handleAction(selectedReservation.id, 'confirm_extend', { minutes });
          }
        }}
        onCancel={() => {
          setShowExtendModal(false);
          setSelectedReservation(null);
        }}
      />
    </SafeAreaView>
  );
};