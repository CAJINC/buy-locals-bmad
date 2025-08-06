import { StyleSheet } from 'react-native';

export const filterStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6c757d',
    borderRadius: 16,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  sectionTitleDark: {
    color: '#ffffff',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionButtonDark: {
    backgroundColor: '#2d2d2d',
    borderColor: '#495057',
  },
  optionButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  optionText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  optionTextDark: {
    color: '#ffffff',
  },
  optionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  customDateRange: {
    marginTop: 16,
    gap: 12,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  datePickerButtonDark: {
    backgroundColor: '#2d2d2d',
    borderColor: '#495057',
  },
  datePickerLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  datePickerText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  datePickerTextDark: {
    color: '#ffffff',
  },
  sortOptions: {
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    marginBottom: 8,
  },
  sortLabelDark: {
    color: '#a0a0a0',
  },
  sortButtonsContainer: {
    gap: 8,
    paddingRight: 20,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sortButtonDark: {
    backgroundColor: '#2d2d2d',
    borderColor: '#495057',
  },
  sortButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '500',
  },
  sortButtonTextDark: {
    color: '#ffffff',
  },
  sortButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sortOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortOrderToggle: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 20,
    padding: 2,
  },
  sortOrderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  sortOrderButtonSelected: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sortOrderText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  sortOrderTextSelected: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInputDark: {
    backgroundColor: '#2d2d2d',
    borderColor: '#495057',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#007bff',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});