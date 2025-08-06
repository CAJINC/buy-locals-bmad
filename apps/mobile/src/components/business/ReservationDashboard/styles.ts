import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 3; // 3 cards per row with spacing

// Main dashboard styles
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  headerSubtitleDark: {
    color: '#a0a0a0',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonDark: {
    backgroundColor: '#0d6efd',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextDark: {
    color: '#ffffff',
  },
  warningButton: {
    backgroundColor: '#ffc107',
  },
  warningButtonText: {
    color: '#000000',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 20,
    padding: 2,
  },
  viewModeToggleDark: {
    backgroundColor: '#343a40',
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  viewModeButtonDark: {
    backgroundColor: 'transparent',
  },
  viewModeButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  viewModeButtonTextDark: {
    color: '#a0a0a0',
  },
  viewModeButtonTextActive: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
  },
  loadingTextDark: {
    color: '#a0a0a0',
  },
});

// Stats card styles
export const statsStyles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  headerSubtitleDark: {
    color: '#a0a0a0',
  },
  metricsScroll: {
    marginBottom: 20,
  },
  metricsScrollContainer: {
    paddingRight: 20,
  },
  metricsGrid: {
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricCardDark: {
    backgroundColor: '#2d2d2d',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    flex: 1,
  },
  metricLabelDark: {
    color: '#a0a0a0',
  },
  metricContent: {
    alignItems: 'flex-start',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  metricValueDark: {
    color: '#ffffff',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeSymbol: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  changeValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  revenueSummary: {
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
  revenueSummaryDark: {
    backgroundColor: '#2d2d2d',
  },
  revenueSummaryHeader: {
    marginBottom: 12,
  },
  revenueSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  revenueSummaryTitleDark: {
    color: '#ffffff',
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueItem: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  revenueLabelDark: {
    color: '#a0a0a0',
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  revenueValueDark: {
    color: '#40d17a',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#856404',
  },
  warningArrow: {
    fontSize: 16,
    color: '#856404',
  },
  quickInsights: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickInsightsDark: {
    backgroundColor: '#2d2d2d',
  },
  quickInsightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  quickInsightsTitleDark: {
    color: '#ffffff',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
  },
  insightText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  insightTextDark: {
    color: '#ffffff',
  },
});

// Reservation list styles
export const listStyles = StyleSheet.create({
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  reservationItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reservationItemDark: {
    backgroundColor: '#2d2d2d',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  customerNameDark: {
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  amountDark: {
    color: '#40d17a',
  },
  serviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceType: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  serviceTypeDark: {
    color: '#ffffff',
  },
  duration: {
    fontSize: 14,
    color: '#6c757d',
  },
  durationDark: {
    color: '#a0a0a0',
  },
  dateTimeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
  },
  dateDark: {
    color: '#0d6efd',
  },
  time: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
  },
  timeDark: {
    color: '#0d6efd',
  },
  contactInfo: {
    marginBottom: 8,
  },
  contactText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  contactTextDark: {
    color: '#a0a0a0',
  },
  notesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 4,
  },
  notesLabelDark: {
    color: '#a0a0a0',
  },
  notesText: {
    fontSize: 12,
    color: '#2c3e50',
    lineHeight: 16,
  },
  notesTextDark: {
    color: '#ffffff',
  },
  expirationWarning: {
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expirationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  expirationText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
  },
  quickActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
  },
  confirmButton: {
    backgroundColor: '#d4edda',
  },
  cancelButton: {
    backgroundColor: '#f8d7da',
  },
  completeButton: {
    backgroundColor: '#d1ecf1',
  },
  rescheduleButton: {
    backgroundColor: '#fff3cd',
  },
  contactButton: {
    backgroundColor: '#e2e3e5',
  },
  separator: {
    height: 12,
  },
  separatorDark: {
    backgroundColor: 'transparent',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateDark: {
    backgroundColor: 'transparent',
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
  },
  emptyStateMessageDark: {
    color: '#a0a0a0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingContainerDark: {
    backgroundColor: 'transparent',
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
  },
  loadingTextDark: {
    color: '#a0a0a0',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: 320,
    width: '90%',
  },
  quickActionsModalDark: {
    backgroundColor: '#2d2d2d',
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalTitleDark: {
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  modalSubtitleDark: {
    color: '#a0a0a0',
  },
  modalActions: {
    gap: 12,
  },
  modalActionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    textAlign: 'center',
  },
  modalConfirmButton: {
    backgroundColor: '#d4edda',
  },
  modalCancelButton: {
    backgroundColor: '#f8d7da',
  },
  modalCompleteButton: {
    backgroundColor: '#d1ecf1',
  },
  modalRescheduleButton: {
    backgroundColor: '#fff3cd',
  },
  modalModifyButton: {
    backgroundColor: '#e2e3e5',
  },
  modalContactButton: {
    backgroundColor: '#cfe2ff',
  },
});