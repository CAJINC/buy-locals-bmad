import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Linking
} from 'react-native';
import type { 
  ReservationListProps, 
  ReservationListItem, 
  ReservationItemProps,
  QuickActionsProps
} from '../types';
import { listStyles as styles } from '../styles';

// Individual reservation item component
const ReservationItem: React.FC<ReservationItemProps> = ({
  reservation,
  theme = 'light',
  onPress,
  onAction,
  showActions = true
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return '#28a745';
      case 'pending': return '#ffc107';
      case 'completed': return '#6f42c1';
      case 'cancelled': return '#dc3545';
      case 'expired': return '#6c757d';
      default: return '#007bff';
    }
  };

  // Format time
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format date
  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.reservationItem,
          theme === 'dark' && styles.reservationItemDark
        ]}
        onPress={() => onPress?.(reservation)}
        onLongPress={() => showActions && setShowQuickActions(true)}
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View style={styles.reservationHeader}>
          <View style={styles.customerInfo}>
            <Text style={[
              styles.customerName,
              theme === 'dark' && styles.customerNameDark
            ]}>
              {reservation.customerName}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(reservation.status) }
              ]}
            >
              <Text style={styles.statusText}>
                {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
              </Text>
            </View>
          </View>
          
          <Text style={[
            styles.amount,
            theme === 'dark' && styles.amountDark
          ]}>
            ${reservation.totalAmount.toFixed(2)}
          </Text>
        </View>

        {/* Service Info Row */}
        <View style={styles.serviceInfo}>
          <Text style={[
            styles.serviceType,
            theme === 'dark' && styles.serviceTypeDark
          ]}>
            {reservation.serviceType}
          </Text>
          <Text style={[
            styles.duration,
            theme === 'dark' && styles.durationDark
          ]}>
            {reservation.duration}min
          </Text>
        </View>

        {/* DateTime Row */}
        <View style={styles.dateTimeInfo}>
          <Text style={[
            styles.date,
            theme === 'dark' && styles.dateDark
          ]}>
            {formatDate(reservation.scheduledAt)}
          </Text>
          <Text style={[
            styles.time,
            theme === 'dark' && styles.timeDark
          ]}>
            {formatTime(reservation.scheduledAt)}
          </Text>
        </View>

        {/* Contact Info Row */}
        <View style={styles.contactInfo}>
          <Text style={[
            styles.contactText,
            theme === 'dark' && styles.contactTextDark
          ]}>
            {reservation.customerEmail}
          </Text>
          {reservation.customerPhone && (
            <Text style={[
              styles.contactText,
              theme === 'dark' && styles.contactTextDark
            ]}>
              {reservation.customerPhone}
            </Text>
          )}
        </View>

        {/* Notes */}
        {reservation.notes && (
          <View style={styles.notesContainer}>
            <Text style={[
              styles.notesLabel,
              theme === 'dark' && styles.notesLabelDark
            ]}>
              Notes:
            </Text>
            <Text style={[
              styles.notesText,
              theme === 'dark' && styles.notesTextDark
            ]}>
              {reservation.notes}
            </Text>
          </View>
        )}

        {/* Expiration Warning */}
        {reservation.expiresAt && new Date(reservation.expiresAt) > new Date() && (
          <View style={styles.expirationWarning}>
            <Text style={styles.expirationIcon}>⏰</Text>
            <Text style={styles.expirationText}>
              Expires in {Math.ceil((new Date(reservation.expiresAt).getTime() - Date.now()) / (60 * 1000))} min
            </Text>
          </View>
        )}

        {/* Quick Action Buttons */}
        {showActions && (
          <View style={styles.quickActions}>
            {reservation.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.confirmButton]}
                  onPress={() => onAction?.(reservation.id, 'confirm')}
                >
                  <Text style={styles.quickActionButtonText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.cancelButton]}
                  onPress={() => onAction?.(reservation.id, 'cancel')}
                >
                  <Text style={styles.quickActionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
            
            {reservation.status === 'confirmed' && (
              <>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.completeButton]}
                  onPress={() => onAction?.(reservation.id, 'complete')}
                >
                  <Text style={styles.quickActionButtonText}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.rescheduleButton]}
                  onPress={() => onAction?.(reservation.id, 'reschedule')}
                >
                  <Text style={styles.quickActionButtonText}>Reschedule</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.quickActionButton, styles.contactButton]}
              onPress={() => {
                const phone = reservation.customerPhone?.replace(/[^\d+]/g, '');
                if (phone) {
                  Linking.openURL(`tel:${phone}`);
                }
              }}
            >
              <Text style={styles.quickActionButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Quick Actions Modal */}
      <Modal
        visible={showQuickActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickActions(false)}
      >
        <QuickActions
          reservation={reservation}
          theme={theme}
          onAction={(action, data) => {
            setShowQuickActions(false);
            onAction?.(reservation.id, action, data);
          }}
        />
      </Modal>
    </>
  );
};

// Quick actions modal component
const QuickActions: React.FC<QuickActionsProps> = ({
  reservation,
  theme = 'light',
  onAction
}) => {
  const handleAction = (action: string, data?: any) => {
    switch (action) {
      case 'confirm':
        Alert.alert(
          'Confirm Reservation',
          'Are you sure you want to confirm this reservation?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: () => onAction(action, data) }
          ]
        );
        break;
      
      case 'cancel':
        Alert.alert(
          'Cancel Reservation',
          'Are you sure you want to cancel this reservation?',
          [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => onAction(action, data) }
          ]
        );
        break;
      
      case 'complete':
        Alert.alert(
          'Complete Reservation',
          'Mark this reservation as completed?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Complete', onPress: () => onAction(action, data) }
          ]
        );
        break;
      
      default:
        onAction(action, data);
    }
  };

  return (
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={() => onAction('dismiss')}
    >
      <View style={[
        styles.quickActionsModal,
        theme === 'dark' && styles.quickActionsModalDark
      ]}>
        <View style={styles.modalHeader}>
          <Text style={[
            styles.modalTitle,
            theme === 'dark' && styles.modalTitleDark
          ]}>
            Quick Actions
          </Text>
          <Text style={[
            styles.modalSubtitle,
            theme === 'dark' && styles.modalSubtitleDark
          ]}>
            {reservation.customerName} - {reservation.serviceType}
          </Text>
        </View>

        <View style={styles.modalActions}>
          {reservation.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalConfirmButton]}
                onPress={() => handleAction('confirm')}
              >
                <Text style={styles.modalActionButtonText}>✓ Confirm Reservation</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => handleAction('cancel')}
              >
                <Text style={styles.modalActionButtonText}>✗ Cancel Reservation</Text>
              </TouchableOpacity>
            </>
          )}

          {reservation.status === 'confirmed' && (
            <>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCompleteButton]}
                onPress={() => handleAction('complete')}
              >
                <Text style={styles.modalActionButtonText}>✓ Mark Complete</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalRescheduleButton]}
                onPress={() => handleAction('reschedule')}
              >
                <Text style={styles.modalActionButtonText}>📅 Reschedule</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalModifyButton]}
                onPress={() => handleAction('modify')}
              >
                <Text style={styles.modalActionButtonText}>✏️ Modify Details</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalContactButton]}
            onPress={() => {
              const phone = reservation.customerPhone?.replace(/[^\d+]/g, '');
              if (phone) {
                Linking.openURL(`tel:${phone}`);
                onAction('contact', { method: 'phone', value: phone });
              }
            }}
          >
            <Text style={styles.modalActionButtonText}>📞 Call Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalContactButton]}
            onPress={() => {
              const email = reservation.customerEmail;
              if (email) {
                Linking.openURL(`mailto:${email}`);
                onAction('contact', { method: 'email', value: email });
              }
            }}
          >
            <Text style={styles.modalActionButtonText}>✉️ Email Customer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main reservation list component
export const ReservationList: React.FC<ReservationListProps> = ({
  reservations,
  theme = 'light',
  isLoading = false,
  onReservationPress,
  onReservationAction,
  emptyMessage = 'No reservations found'
}) => {
  const renderReservationItem = useCallback(({ item }: { item: ReservationListItem }) => (
    <ReservationItem
      reservation={item}
      theme={theme}
      onPress={onReservationPress}
      onAction={onReservationAction}
    />
  ), [theme, onReservationPress, onReservationAction]);

  const renderEmptyState = () => (
    <View style={[
      styles.emptyState,
      theme === 'dark' && styles.emptyStateDark
    ]}>
      <Text style={styles.emptyStateIcon}>📅</Text>
      <Text style={[
        styles.emptyStateTitle,
        theme === 'dark' && styles.emptyStateTitleDark
      ]}>
        No Reservations
      </Text>
      <Text style={[
        styles.emptyStateMessage,
        theme === 'dark' && styles.emptyStateMessageDark
      ]}>
        {emptyMessage}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[
        styles.loadingContainer,
        theme === 'dark' && styles.loadingContainerDark
      ]}>
        <Text style={[
          styles.loadingText,
          theme === 'dark' && styles.loadingTextDark
        ]}>
          Loading reservations...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reservations}
      renderItem={renderReservationItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContainer,
        reservations.length === 0 && styles.emptyListContainer
      ]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={renderEmptyState}
      ItemSeparatorComponent={() => (
        <View style={[
          styles.separator,
          theme === 'dark' && styles.separatorDark
        ]} />
      )}
    />
  );
};