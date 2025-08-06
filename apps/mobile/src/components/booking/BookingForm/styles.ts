import { StyleSheet, Dimensions } from 'react-native';

const { width: _screenWidth } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  containerDark: {
    backgroundColor: '#1a1a1a',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100, // Space for action buttons
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },

  // Booking Summary Section
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  summaryContainerDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },

  summaryTitleDark: {
    color: '#ffffff',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  summaryLabel: {
    fontSize: 16,
    color: '#666666',
    flex: 1,
  },

  summaryLabelDark: {
    color: '#cccccc',
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    flex: 2,
    textAlign: 'right',
  },

  summaryValueDark: {
    color: '#ffffff',
  },

  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    flex: 1,
    textAlign: 'right',
  },

  summaryPriceDark: {
    color: '#66b3ff',
  },

  // Form Section
  formSection: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 20,
  },

  sectionTitleDark: {
    color: '#ffffff',
  },

  fieldContainer: {
    marginBottom: 20,
  },

  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },

  fieldLabelDark: {
    color: '#ffffff',
  },

  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#333333',
  },

  textInputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
    color: '#ffffff',
  },

  textInputMultiline: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  textInputError: {
    borderColor: '#dc3545',
  },

  errorText: {
    fontSize: 14,
    color: '#dc3545',
    marginTop: 4,
  },

  characterCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },

  characterCountDark: {
    color: '#666666',
  },

  // Action Buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32, // Account for safe area
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },

  actionContainerDark: {
    backgroundColor: '#1a1a1a',
    borderTopColor: '#404040',
  },

  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },

  cancelButtonDark: {
    borderColor: '#666666',
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },

  cancelButtonTextDark: {
    color: '#cccccc',
  },

  submitButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonDark: {
    backgroundColor: '#0056b3',
  },

  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Responsive design for tablets
  '@media (min-width: 768px)': {
    scrollContent: {
      paddingHorizontal: 40,
    },
    
    summaryContainer: {
      paddingHorizontal: 32,
    },
    
    actionContainer: {
      paddingHorizontal: 40,
    },
  },
});