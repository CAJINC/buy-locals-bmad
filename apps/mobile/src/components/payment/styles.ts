import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for action buttons
  },

  // Payment Summary styles
  summaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryTitleDark: {
    color: '#F9FAFB',
  },
  summaryDetails: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  summaryValueDark: {
    color: '#F9FAFB',
  },

  // Price Breakdown styles
  breakdownSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownTitleDark: {
    color: '#F9FAFB',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  breakdownLabelDark: {
    color: '#9CA3AF',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  breakdownValueDark: {
    color: '#F9FAFB',
  },
  discountLabel: {
    color: '#059669',
  },
  discountValue: {
    color: '#059669',
  },

  // Total Section styles
  totalSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 16,
  },
  totalSectionDark: {
    borderTopColor: '#4B5563',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  totalLabelDark: {
    color: '#F9FAFB',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  totalValueDark: {
    color: '#F9FAFB',
  },

  // Security Notice styles
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  securityNoticeDark: {
    borderTopColor: '#4B5563',
  },
  securityIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },
  securityTextDark: {
    color: '#9CA3AF',
  },

  // Currency Notice styles
  currencyNotice: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  currencyNoticeDark: {
    backgroundColor: '#451A03',
    borderColor: '#92400E',
  },
  currencyNoticeText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },
  currencyNoticeTextDark: {
    color: '#FCD34D',
  },

  // Payment Method Selector styles
  selectorContainer: {
    margin: 16,
  },
  selectorContainerDark: {
    // No specific dark styling needed
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  subsectionTitleDark: {
    color: '#F9FAFB',
  },
  methodsList: {
    maxHeight: 400,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentMethodOptionDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  paymentMethodOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  paymentMethodOptionSelectedDark: {
    borderColor: '#4F46E5',
    backgroundColor: '#1E1B4B',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIcon: {
    fontSize: 20,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  paymentMethodTitleDark: {
    color: '#F9FAFB',
  },
  paymentMethodDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  paymentMethodDescriptionDark: {
    color: '#9CA3AF',
  },
  paymentMethodExpiry: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  paymentMethodExpiryDark: {
    color: '#6B7280',
  },
  defaultBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonDark: {
    borderColor: '#6B7280',
  },
  radioButtonSelected: {
    borderColor: '#3B82F6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },

  // Card Field styles
  cardFieldContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardFieldContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  cardField: {
    height: 50,
    marginVertical: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  // Saved Payment Methods styles
  savedMethodsContainer: {
    margin: 16,
  },
  savedMethodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  headerDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  headerDescriptionDark: {
    color: '#9CA3AF',
  },
  methodsList: {
    paddingHorizontal: 16,
  },
  savedMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  savedMethodCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  savedMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  savedMethodContentSelectable: {
    marginBottom: 8,
  },
  savedMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  savedMethodInfo: {
    flex: 1,
  },
  savedMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  savedMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  savedMethodTitleDark: {
    color: '#F9FAFB',
  },
  savedMethodDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  savedMethodDescriptionDark: {
    color: '#9CA3AF',
  },
  savedMethodExpiry: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  savedMethodExpiryDark: {
    color: '#6B7280',
  },
  addMethodButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addMethodButtonDark: {
    backgroundColor: '#4F46E5',
  },
  addMethodButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  savedMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  savedMethodItemDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  savedMethodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDark: {
    // Base dark styling for all action buttons
  },
  defaultButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  setDefaultButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  setDefaultButtonDark: {
    backgroundColor: '#4B5563',
  },
  setDefaultButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  defaultButtonText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  setDefaultButtonTextDark: {
    color: '#F9FAFB',
  },
  defaultButtonTextDark: {
    color: '#60A5FA',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#991B1B',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  deleteButtonTextDark: {
    color: '#FCA5A5',
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  securityTitleDark: {
    color: '#F9FAFB',
  },
  securityDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  securityDescriptionDark: {
    color: '#9CA3AF',
  },

  // Success Screen styles
  successContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  successContainerDark: {
    backgroundColor: '#1F2937',
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  successTitleDark: {
    color: '#F9FAFB',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  successSubtitleDark: {
    color: '#9CA3AF',
  },
  successDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  successDetailsDark: {
    backgroundColor: '#374151',
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailsSectionTitleDark: {
    color: '#F9FAFB',
  },
  amountValue: {
    fontWeight: '700',
    fontSize: 16,
  },
  transactionIdValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  confirmationValue: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '600',
  },
  nextStepsContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  nextStepsContainerDark: {
    backgroundColor: '#1E3A8A',
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  nextStepsTitleDark: {
    color: '#F9FAFB',
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nextStepIcon: {
    fontSize: 16,
    marginRight: 8,
    width: 24,
  },
  nextStepText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  nextStepTextDark: {
    color: '#D1D5DB',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  successDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  successDetailLabelDark: {
    color: '#9CA3AF',
  },
  successDetailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  successDetailValueDark: {
    color: '#F9FAFB',
  },
  successActions: {
    width: '100%',
    gap: 12,
  },

  // Loading states
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  loadingTextDark: {
    color: '#9CA3AF',
  },

  // Action Buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24, // Extra padding for safe area
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    gap: 12,
  },
  actionContainerDark: {
    backgroundColor: '#1F2937',
    borderTopColor: '#4B5563',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#4B5563',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  cancelButtonTextDark: {
    color: '#F9FAFB',
  },
  payButton: {
    flex: 2,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDark: {
    backgroundColor: '#4F46E5',
  },
  payButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  payButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonDark: {
    backgroundColor: '#4F46E5',
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
    width: '100%',
  },
  secondaryButtonDark: {
    borderColor: '#4F46E5',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  secondaryButtonTextDark: {
    color: '#4F46E5',
  },

  // Empty States
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyTitleDark: {
    color: '#F9FAFB',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyDescriptionDark: {
    color: '#9CA3AF',
  },

  // Biometric styles
  biometricPrompt: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  biometricPromptDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  biometricIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  biometricTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  biometricTitleDark: {
    color: '#F9FAFB',
  },
  biometricDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  biometricDescriptionDark: {
    color: '#9CA3AF',
  },
  biometricActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  biometricButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  biometricPrimaryButton: {
    backgroundColor: '#3B82F6',
  },
  biometricSecondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  biometricButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  biometricPrimaryButtonText: {
    color: '#FFFFFF',
  },
  biometricSecondaryButtonText: {
    color: '#374151',
  },
});