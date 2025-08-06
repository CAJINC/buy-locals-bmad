import { StyleSheet } from 'react-native';

export const expirationStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  reservationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reservationCardDark: {
    backgroundColor: '#2d2d2d',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  customerNameDark: {
    color: '#ffffff',
  },
  serviceType: {
    fontSize: 14,
    color: '#6c757d',
  },
  serviceTypeDark: {
    color: '#a0a0a0',
  },
  urgencyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 16,
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  timeItem: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  timeLabelDark: {
    color: '#a0a0a0',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  timeValueDark: {
    color: '#ffffff',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  amountLabelDark: {
    color: '#a0a0a0',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  amountValueDark: {
    color: '#40d17a',
  },
  warningsInfo: {
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  warningsText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  warningsTextDark: {
    color: '#856404',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  extendButton: {
    backgroundColor: '#cfe2ff',
  },
  extendButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#084298',
  },
  confirmButton: {
    backgroundColor: '#d1ecf1',
  },
  confirmButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c5460',
  },
  contactButton: {
    backgroundColor: '#e2e3e5',
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#41464b',
  },
  cancelButton: {
    backgroundColor: '#f8d7da',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#721c24',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptyStateTitleDark: {
    color: '#ffffff',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  emptyStateMessageDark: {
    color: '#a0a0a0',
  },
  bulkActionsFooter: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bulkActionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  bulkActionsLabelDark: {
    color: '#ffffff',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bulkExtendButton: {
    backgroundColor: '#cfe2ff',
  },
  bulkExtendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#084298',
  },
  bulkContactButton: {
    backgroundColor: '#e2e3e5',
  },
  bulkContactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#41464b',
  },
  
  // Extension Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extensionModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 320,
    width: '90%',
  },
  extensionModalDark: {
    backgroundColor: '#2d2d2d',
  },
  extensionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  extensionModalTitleDark: {
    color: '#ffffff',
  },
  extensionModalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  extensionModalSubtitleDark: {
    color: '#a0a0a0',
  },
  extensionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  extensionLabelDark: {
    color: '#ffffff',
  },
  predefinedOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  predefinedOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  predefinedOptionDark: {
    backgroundColor: '#343a40',
    borderColor: '#495057',
  },
  predefinedOptionSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  predefinedOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
  },
  predefinedOptionTextDark: {
    color: '#ffffff',
  },
  predefinedOptionTextSelected: {
    color: '#ffffff',
  },
  extensionInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  extensionInputDark: {
    backgroundColor: '#343a40',
    borderColor: '#495057',
    color: '#ffffff',
  },
  extensionModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  extensionModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  extensionCancelButton: {
    backgroundColor: '#6c757d',
  },
  extensionCancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  extensionConfirmButton: {
    backgroundColor: '#007bff',
  },
  extensionConfirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});