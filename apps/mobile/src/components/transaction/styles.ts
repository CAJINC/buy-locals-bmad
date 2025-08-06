import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const styles = StyleSheet.create({
  // Common Container Styles
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },

  // Transaction History Styles
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  summaryContainerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },

  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueDark: {
    color: '#F9FAFB',
  },
  refundValue: {
    color: '#EF4444',
  },
  refundValueDark: {
    color: '#F87171',
  },

  // Filters Bar
  filtersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersBarDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },

  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterButtonDark: {
    borderColor: '#4B5563',
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#374151',
  },
  filterButtonTextDark: {
    color: '#D1D5DB',
  },

  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  sortButtonDark: {
    borderColor: '#4B5563',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#6B7280',
  },
  sortButtonTextDark: {
    color: '#9CA3AF',
  },

  // Transaction Card
  transactionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  transactionCardDark: {
    backgroundColor: '#1F2937',
  },

  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  businessNameDark: {
    color: '#F9FAFB',
  },
  receiptNumber: {
    fontSize: 12,
    color: '#6B7280',
  },
  receiptNumberDark: {
    color: '#9CA3AF',
  },

  transactionMeta: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  transactionAmountDark: {
    color: '#F9FAFB',
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusPaidDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  statusRefunded: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusRefundedDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  statusPartialRefund: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPartialRefundDark: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  statusDisputed: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statusDisputedDark: {
    backgroundColor: '#374151',
    borderColor: '#6B7280',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
    textTransform: 'uppercase',
  },

  transactionDetails: {
    marginBottom: 12,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  transactionDateDark: {
    color: '#9CA3AF',
  },
  transactionItems: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  transactionItemsDark: {
    color: '#9CA3AF',
  },

  refundInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  refundText: {
    fontSize: 12,
    color: '#D97706',
    marginLeft: 4,
  },
  refundTextDark: {
    color: '#F59E0B',
  },

  // Action Buttons
  transactionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  actionButtonDark: {
    borderColor: '#4B5563',
  },
  actionButtonText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  receiptButton: {
    borderColor: '#3B82F6',
  },
  receiptButtonText: {
    color: '#3B82F6',
  },
  receiptButtonTextDark: {
    color: '#60A5FA',
  },
  refundButton: {
    borderColor: '#EF4444',
  },
  refundButtonText: {
    color: '#EF4444',
  },
  refundButtonTextDark: {
    color: '#F87171',
  },

  // Loading and Error States
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  loadingTextDark: {
    color: '#9CA3AF',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorTitleDark: {
    color: '#F9FAFB',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorMessageDark: {
    color: '#9CA3AF',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonDark: {
    backgroundColor: '#60A5FA',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
  },

  // Transaction Details Modal
  modal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalDark: {
    backgroundColor: '#111827',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },

  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
  },

  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalSubtitleDark: {
    color: '#9CA3AF',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContainerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },

  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3B82F6',
  },
  tabButtonDark: {
    backgroundColor: '#1F2937',
  },
  tabButtonActiveDark: {
    borderBottomColor: '#60A5FA',
  },
  tabButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabButtonTextDark: {
    color: '#9CA3AF',
  },
  tabButtonTextActiveDark: {
    color: '#60A5FA',
  },

  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },

  // Details Section
  detailsSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailsSectionDark: {
    backgroundColor: '#1F2937',
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

  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailsRowDark: {
    borderBottomColor: '#374151',
  },

  detailsLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  detailsLabelDark: {
    color: '#9CA3AF',
  },
  detailsValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  detailsValueDark: {
    color: '#F9FAFB',
  },

  // Status Badge in Details
  detailsStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  detailsStatusPaid: {
    backgroundColor: '#D1FAE5',
  },
  detailsStatusPaidDark: {
    backgroundColor: '#064E3B',
  },
  detailsStatusRefunded: {
    backgroundColor: '#FEE2E2',
  },
  detailsStatusRefundedDark: {
    backgroundColor: '#7F1D1D',
  },
  detailsStatusPartialRefund: {
    backgroundColor: '#FEF3C7',
  },
  detailsStatusPartialRefundDark: {
    backgroundColor: '#78350F',
  },
  detailsStatusDisputed: {
    backgroundColor: '#F3F4F6',
  },
  detailsStatusDisputedDark: {
    backgroundColor: '#374151',
  },
  detailsStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
    textTransform: 'uppercase',
  },

  // Business Details
  businessDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailsBusinessLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  businessTextDetails: {
    flex: 1,
  },
  businessDetailsName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  businessDetailsNameDark: {
    color: '#F9FAFB',
  },
  businessDetailsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  businessDetailsTextDark: {
    color: '#9CA3AF',
  },

  businessContactRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  contactButtonText: {
    fontSize: 12,
    color: '#3B82F6',
    marginLeft: 4,
    fontWeight: '500',
  },
  contactButtonTextDark: {
    color: '#60A5FA',
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemNameDark: {
    color: '#F9FAFB',
  },
  itemDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemDescriptionDark: {
    color: '#9CA3AF',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemQuantityDark: {
    color: '#9CA3AF',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  itemTotalDark: {
    color: '#F9FAFB',
  },

  // Totals
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalLabelDark: {
    color: '#F9FAFB',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  totalValueDark: {
    color: '#F9FAFB',
  },

  // Refund Section
  refundSection: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  refundSectionDark: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  refundTitle: {
    color: '#92400E',
  },
  refundTitleDark: {
    color: '#FCD34D',
  },
  refundAmount: {
    color: '#D97706',
  },
  refundAmountDark: {
    color: '#F59E0B',
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineMarker: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineDotActive: {
    backgroundColor: '#3B82F6',
  },
  timelineDotDark: {
    backgroundColor: '#4B5563',
    borderColor: '#1F2937',
  },
  timelineDotActiveDark: {
    backgroundColor: '#60A5FA',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
  },
  timelineLineDark: {
    backgroundColor: '#374151',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timelineTitleDark: {
    color: '#F9FAFB',
  },
  timelineDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timelineDescriptionDark: {
    color: '#9CA3AF',
  },
  timelineTimestamp: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  timelineTimestampDark: {
    color: '#6B7280',
  },

  // Action Buttons (Modal)
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  actionButtonsDark: {
    borderTopColor: '#374151',
  },

  receiptActionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  receiptActionButtonDark: {
    backgroundColor: '#60A5FA',
  },
  refundActionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  refundActionButtonDark: {
    backgroundColor: '#F87171',
  },

  // Receipt Viewer
  receiptViewerContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  receiptViewerContainerDark: {
    backgroundColor: '#111827',
  },

  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  receiptHeaderDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },

  receiptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  receiptTitleDark: {
    color: '#F9FAFB',
  },
  receiptSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  receiptSubtitleDark: {
    color: '#9CA3AF',
  },

  refreshButton: {
    padding: 8,
    borderRadius: 4,
  },
  refreshButtonDark: {
    backgroundColor: '#374151',
  },

  // View Mode Toggle
  viewModeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  viewModeToggleDark: {
    backgroundColor: '#374151',
  },

  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  viewModeButtonDark: {
    backgroundColor: 'transparent',
  },
  viewModeButtonActiveDark: {
    backgroundColor: '#1F2937',
  },

  viewModeButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  viewModeButtonTextActive: {
    color: '#111827',
    fontWeight: '500',
  },
  viewModeButtonTextDark: {
    color: '#9CA3AF',
  },
  viewModeButtonTextActiveDark: {
    color: '#F9FAFB',
  },

  // Receipt Content
  receiptContent: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  receiptWebView: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  receiptWebViewDark: {
    backgroundColor: '#1F2937',
  },

  webViewLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },

  nativeReceiptView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
  },
  nativeReceiptContent: {
    paddingBottom: 20,
  },
  nativeReceiptText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  nativeReceiptTextDark: {
    color: '#9CA3AF',
  },

  // Receipt Actions
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  receiptActionsDark: {
    backgroundColor: '#1F2937',
    borderTopColor: '#374151',
  },

  receiptActionButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  receiptActionButtonDark: {
    backgroundColor: 'transparent',
  },

  receiptActionText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    fontWeight: '500',
  },
  receiptActionTextDark: {
    color: '#60A5FA',
  },

  // Receipt Footer
  receiptFooter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  receiptFooterDark: {
    backgroundColor: '#111827',
    borderTopColor: '#374151',
  },

  receiptFooterText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  receiptFooterTextDark: {
    color: '#9CA3AF',
  },

  // Transaction Filters Modal
  modalOverlay: {
    flex: 1,
  },
  filtersModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  filtersModalDark: {
    backgroundColor: '#111827',
  },

  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersHeaderDark: {
    borderBottomColor: '#374151',
  },

  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filtersTitleDark: {
    color: '#F9FAFB',
  },

  filtersBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  filtersBadgeDark: {
    backgroundColor: '#60A5FA',
  },
  filtersBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  clearButtonDark: {
    borderColor: '#4B5563',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  clearButtonTextDark: {
    color: '#9CA3AF',
  },

  filtersContent: {
    flex: 1,
  },

  // Filter Sections
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterSectionDark: {
    borderBottomColor: '#374151',
  },

  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  filterSectionTitleDark: {
    color: '#F9FAFB',
  },

  // Search
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },

  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  searchInputDark: {
    color: '#F9FAFB',
  },

  // Quick Date Filters
  quickFilters: {
    marginBottom: 12,
  },
  quickFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  quickFilterButtonDark: {
    backgroundColor: '#374151',
  },
  quickFilterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  quickFilterTextDark: {
    color: '#D1D5DB',
  },

  // Date Inputs
  dateInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  dateInputText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  dateInputTextDark: {
    color: '#F9FAFB',
  },

  // Status Options
  statusOptions: {
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusOptionSelected: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  statusOptionDark: {
    borderColor: '#4B5563',
  },
  statusOptionSelectedDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#60A5FA',
  },

  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  statusOptionTextSelected: {
    color: '#1D4ED8',
    fontWeight: '500',
  },
  statusOptionTextDark: {
    color: '#D1D5DB',
  },
  statusOptionTextSelectedDark: {
    color: '#93C5FD',
  },

  // Amount Inputs
  amountInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  amountInputContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  currencySymbolDark: {
    color: '#9CA3AF',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 4,
    fontSize: 14,
    color: '#111827',
  },
  amountInputDark: {
    color: '#F9FAFB',
  },
  amountSeparator: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountSeparatorDark: {
    color: '#9CA3AF',
  },

  // Sort Options
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sortOptionSelected: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  sortOptionDark: {
    borderColor: '#4B5563',
  },
  sortOptionSelectedDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#60A5FA',
  },
  sortOptionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#374151',
  },
  sortOptionTextSelected: {
    color: '#1D4ED8',
    fontWeight: '500',
  },
  sortOptionTextDark: {
    color: '#D1D5DB',
  },
  sortOptionTextSelectedDark: {
    color: '#93C5FD',
  },

  // Filters Footer
  filtersFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  filtersFooterDark: {
    borderTopColor: '#374151',
  },

  applyButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonDark: {
    backgroundColor: '#60A5FA',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Dashboard Styles
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dashboardHeaderDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },

  dashboardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  dashboardTitleDark: {
    color: '#F9FAFB',
  },

  // Time Range Selector
  timeRangeSelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  timeRangeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  timeRangeButtonDark: {
    backgroundColor: '#374151',
  },
  timeRangeButtonActiveDark: {
    backgroundColor: '#60A5FA',
  },
  timeRangeButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  timeRangeButtonTextDark: {
    color: '#D1D5DB',
  },
  timeRangeButtonTextActiveDark: {
    color: '#1F2937',
  },

  // KPI Cards
  kpiContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 160,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  kpiCardDark: {
    backgroundColor: '#1F2937',
  },

  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  kpiChangePositive: {
    backgroundColor: '#D1FAE5',
  },
  kpiChangeNegative: {
    backgroundColor: '#FEE2E2',
  },
  kpiChangeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  kpiChangeTextPositive: {
    color: '#065F46',
  },
  kpiChangeTextNegative: {
    color: '#991B1B',
  },

  kpiTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  kpiTitleDark: {
    color: '#9CA3AF',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  kpiValueDark: {
    color: '#F9FAFB',
  },

  // Charts
  chartContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  chartContainerDark: {
    backgroundColor: '#1F2937',
  },

  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  chartTitleDark: {
    color: '#F9FAFB',
  },

  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },

  // Section Container
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionContainerDark: {
    backgroundColor: '#1F2937',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },

  // Customer Row
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerNameDark: {
    color: '#F9FAFB',
  },
  customerStats: {
    fontSize: 12,
    color: '#6B7280',
  },
  customerStatsDark: {
    color: '#9CA3AF',
  },
  customerSpent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerSpentDark: {
    color: '#F9FAFB',
  },

  // Dashboard Tabs
  dashboardTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dashboardTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dashboardTabDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  dashboardTabActiveDark: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  dashboardTabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dashboardTabTextActive: {
    color: '#FFFFFF',
  },
  dashboardTabTextDark: {
    color: '#D1D5DB',
  },
  dashboardTabTextActiveDark: {
    color: '#1F2937',
  },
});