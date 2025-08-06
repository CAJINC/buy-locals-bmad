import React, { useCallback, useState } from 'react';
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
import type { BookingConfirmationProps } from './types';

export const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  booking,
  businessInfo,
  serviceInfo,
  onClose,
  onAddToCalendar,
  onShare,
  onViewBookings,
  theme = 'light',
}) => {
  const [loading, setLoading] = useState(false);

  // Format time display
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  // Format date display
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Format date for calendar display
  const formatDateShort = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Handle add to calendar
  const handleAddToCalendar = useCallback(async () => {
    if (onAddToCalendar) {
      setLoading(true);
      try {
        await onAddToCalendar(booking);
      } catch (error) {
        Alert.alert('Error', 'Failed to add to calendar. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // Default calendar integration
      const startDate = booking.scheduledAt;
      const endDate = new Date(startDate.getTime() + booking.duration * 60000);
      
      const title = encodeURIComponent(`${serviceInfo?.name || 'Appointment'} at ${businessInfo?.name || 'Business'}`);
      const details = encodeURIComponent(booking.notes || '');
      const location = encodeURIComponent(businessInfo?.address || '');
      
      const startDateString = `${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
      const endDateString = `${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
      
      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateString}/${endDateString}&details=${details}&location=${location}`;
      
      try {
        await Linking.openURL(calendarUrl);
      } catch (error) {
        Alert.alert('Error', 'Unable to open calendar app.');
      }
    }
  }, [booking, businessInfo, serviceInfo, onAddToCalendar]);

  // Handle share booking
  const handleShare = useCallback(async () => {
    const shareContent = {
      title: 'Booking Confirmation',
      message: `Booking confirmed!\n\n${businessInfo?.name || 'Business'}\n${formatDate(booking.scheduledAt)} at ${formatTime(booking.scheduledAt)}\n\nBooking ID: ${booking.id}`,
    };

    if (onShare) {
      try {
        await onShare(shareContent);
      } catch (error) {
        Alert.alert('Error', 'Failed to share booking details.');
      }
    } else {
      try {
        await Share.share(shareContent);
      } catch (error) {
        Alert.alert('Error', 'Failed to share booking details.');
      }
    }
  }, [booking, businessInfo, formatDate, formatTime, onShare]);

  // Handle call business
  const handleCallBusiness = useCallback(() => {
    if (businessInfo?.phone) {
      const phoneUrl = `tel:${businessInfo.phone}`;
      Linking.openURL(phoneUrl).catch(() => {
        Alert.alert('Error', 'Unable to make phone call.');
      });
    }
  }, [businessInfo]);

  // Generate confirmation number (first 8 chars of booking ID)
  const confirmationNumber = booking.id.substring(0, 8).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, theme === 'dark' && styles.containerDark]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Success Header */}
      <View style={styles.headerContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={[styles.successTitle, theme === 'dark' && styles.successTitleDark]}>
          Booking Confirmed!
        </Text>
        <Text style={[styles.successSubtitle, theme === 'dark' && styles.successSubtitleDark]}>
          Your appointment has been successfully booked
        </Text>
      </View>

      {/* Confirmation Number */}
      <View style={[styles.confirmationContainer, theme === 'dark' && styles.confirmationContainerDark]}>
        <Text style={[styles.confirmationLabel, theme === 'dark' && styles.confirmationLabelDark]}>
          Confirmation Number
        </Text>
        <Text style={[styles.confirmationNumber, theme === 'dark' && styles.confirmationNumberDark]}>
          {confirmationNumber}
        </Text>
      </View>

      {/* Booking Details */}
      <View style={[styles.detailsContainer, theme === 'dark' && styles.detailsContainerDark]}>
        <Text style={[styles.detailsTitle, theme === 'dark' && styles.detailsTitleDark]}>
          Booking Details
        </Text>

        {/* Date and Time Card */}
        <View style={[styles.detailCard, theme === 'dark' && styles.detailCardDark]}>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateContainer}>
              <Text style={[styles.dateText, theme === 'dark' && styles.dateTextDark]}>
                {formatDateShort(booking.scheduledAt)}
              </Text>
              <Text style={[styles.dayText, theme === 'dark' && styles.dayTextDark]}>
                {booking.scheduledAt.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, theme === 'dark' && styles.timeTextDark]}>
                {formatTime(booking.scheduledAt)}
              </Text>
              <Text style={[styles.durationText, theme === 'dark' && styles.durationTextDark]}>
                {booking.duration} min
              </Text>
            </View>
          </View>
        </View>

        {/* Business Info */}
        <View style={[styles.detailCard, theme === 'dark' && styles.detailCardDark]}>
          <Text style={[styles.cardTitle, theme === 'dark' && styles.cardTitleDark]}>
            Business
          </Text>
          <Text style={[styles.businessName, theme === 'dark' && styles.businessNameDark]}>
            {businessInfo?.name || 'Business Name'}
          </Text>
          {businessInfo?.address && (
            <Text style={[styles.businessAddress, theme === 'dark' && styles.businessAddressDark]}>
              {businessInfo.address}
            </Text>
          )}
        </View>

        {/* Service Info */}
        <View style={[styles.detailCard, theme === 'dark' && styles.detailCardDark]}>
          <Text style={[styles.cardTitle, theme === 'dark' && styles.cardTitleDark]}>
            Service
          </Text>
          <Text style={[styles.serviceName, theme === 'dark' && styles.serviceNameDark]}>
            {serviceInfo?.name || 'Service'}
          </Text>
          {serviceInfo?.description && (
            <Text style={[styles.serviceDescription, theme === 'dark' && styles.serviceDescriptionDark]}>
              {serviceInfo.description}
            </Text>
          )}
        </View>

        {/* Customer Info */}
        <View style={[styles.detailCard, theme === 'dark' && styles.detailCardDark]}>
          <Text style={[styles.cardTitle, theme === 'dark' && styles.cardTitleDark]}>
            Your Information
          </Text>
          <Text style={[styles.customerName, theme === 'dark' && styles.customerNameDark]}>
            {booking.customerInfo.name}
          </Text>
          <Text style={[styles.customerContact, theme === 'dark' && styles.customerContactDark]}>
            {booking.customerInfo.phone}
          </Text>
          <Text style={[styles.customerContact, theme === 'dark' && styles.customerContactDark]}>
            {booking.customerInfo.email}
          </Text>
        </View>

        {/* Notes */}
        {booking.notes && (
          <View style={[styles.detailCard, theme === 'dark' && styles.detailCardDark]}>
            <Text style={[styles.cardTitle, theme === 'dark' && styles.cardTitleDark]}>
              Special Requests
            </Text>
            <Text style={[styles.notesText, theme === 'dark' && styles.notesTextDark]}>
              {booking.notes}
            </Text>
          </View>
        )}

        {/* Price */}
        {booking.totalAmount > 0 && (
          <View style={[styles.detailCard, styles.priceCard, theme === 'dark' && styles.detailCardDark]}>
            <Text style={[styles.cardTitle, theme === 'dark' && styles.cardTitleDark]}>
              Total Amount
            </Text>
            <Text style={[styles.priceText, theme === 'dark' && styles.priceTextDark]}>
              ${booking.totalAmount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={handleAddToCalendar}
          disabled={loading}
          accessibilityLabel="Add to calendar"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>Add to Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction, theme === 'dark' && styles.secondaryActionDark]}
          onPress={handleShare}
          accessibilityLabel="Share booking"
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryActionText, theme === 'dark' && styles.secondaryActionTextDark]}>
            Share
          </Text>
        </TouchableOpacity>

        {businessInfo?.phone && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryAction, theme === 'dark' && styles.secondaryActionDark]}
            onPress={handleCallBusiness}
            accessibilityLabel="Call business"
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryActionText, theme === 'dark' && styles.secondaryActionTextDark]}>
              Call Business
            </Text>
          </TouchableOpacity>
        )}

        {onViewBookings && (
          <TouchableOpacity
            style={[styles.actionButton, styles.tertiaryAction]}
            onPress={onViewBookings}
            accessibilityLabel="View all bookings"
            accessibilityRole="button"
          >
            <Text style={[styles.tertiaryActionText, theme === 'dark' && styles.tertiaryActionTextDark]}>
              View My Bookings
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, theme === 'dark' && styles.closeButtonDark]}
        onPress={onClose}
        accessibilityLabel="Close confirmation"
        accessibilityRole="button"
      >
        <Text style={[styles.closeButtonText, theme === 'dark' && styles.closeButtonTextDark]}>
          Done
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};