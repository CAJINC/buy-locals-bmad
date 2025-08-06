import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  containerDark: {
    backgroundColor: '#1a1a1a',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },

  // Header Section
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },

  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#28a745',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  successIconText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },

  successTitleDark: {
    color: '#ffffff',
  },

  successSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },

  successSubtitleDark: {
    color: '#cccccc',
  },

  // Confirmation Number
  confirmationContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  confirmationContainerDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },

  confirmationLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },

  confirmationLabelDark: {
    color: '#cccccc',
  },

  confirmationNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 2,
  },

  confirmationNumberDark: {
    color: '#66b3ff',
  },

  // Details Section
  detailsContainer: {
    marginBottom: 32,
  },

  detailsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },

  detailsTitleDark: {
    color: '#ffffff',
  },

  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  detailCardDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  cardTitleDark: {
    color: '#cccccc',
  },

  // Date and Time Card
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateContainer: {
    alignItems: 'center',
    flex: 1,
  },

  dateText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
  },

  dateTextDark: {
    color: '#ffffff',
  },

  dayText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },

  dayTextDark: {
    color: '#cccccc',
  },

  timeContainer: {
    alignItems: 'center',
    flex: 1,
  },

  timeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },

  timeTextDark: {
    color: '#66b3ff',
  },

  durationText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },

  durationTextDark: {
    color: '#cccccc',
  },

  // Business Info
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },

  businessNameDark: {
    color: '#ffffff',
  },

  businessAddress: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },

  businessAddressDark: {
    color: '#cccccc',
  },

  // Service Info
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },

  serviceNameDark: {
    color: '#ffffff',
  },

  serviceDescription: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },

  serviceDescriptionDark: {
    color: '#cccccc',
  },

  // Customer Info
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },

  customerNameDark: {
    color: '#ffffff',
  },

  customerContact: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 2,
  },

  customerContactDark: {
    color: '#cccccc',
  },

  // Notes
  notesText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
  },

  notesTextDark: {
    color: '#ffffff',
  },

  // Price
  priceCard: {
    backgroundColor: '#f8f9fa',
  },

  priceText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28a745',
  },

  priceTextDark: {
    color: '#4caf50',
  },

  // Actions
  actionsContainer: {
    marginBottom: 24,
  },

  actionButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryAction: {
    backgroundColor: '#007AFF',
  },

  secondaryAction: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cccccc',
  },

  secondaryActionDark: {
    borderColor: '#666666',
  },

  tertiaryAction: {
    backgroundColor: 'transparent',
  },

  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },

  secondaryActionTextDark: {
    color: '#ffffff',
  },

  tertiaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },

  tertiaryActionTextDark: {
    color: '#66b3ff',
  },

  // Close Button
  closeButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  closeButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },

  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },

  closeButtonTextDark: {
    color: '#cccccc',
  },
});