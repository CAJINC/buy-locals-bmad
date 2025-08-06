import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  containerDark: {
    backgroundColor: '#1a1a1a',
  },

  header: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
    padding: 2,
  },

  viewButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 6,
  },

  viewButtonActive: {
    backgroundColor: '#007AFF',
  },

  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },

  viewButtonTextActive: {
    color: '#ffffff',
  },

  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
  },

  navButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  dateButton: {
    width: (screenWidth - 40) / 7, // 7 days per week with padding
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },

  dateButtonSelected: {
    backgroundColor: '#007AFF',
  },

  dateButtonToday: {
    backgroundColor: '#e6f3ff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },

  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },

  dateTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  dateTextToday: {
    color: '#007AFF',
    fontWeight: '600',
  },

  timeSlotsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },

  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    marginBottom: 16,
  },

  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },

  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  noSlotsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },

  noSlotsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },

  noSlotsSubText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },

  // Responsive design for tablets
  '@media (min-width: 768px)': {
    dateButton: {
      width: (screenWidth - 40) / 7,
      height: 56,
    },
    
    dateText: {
      fontSize: 18,
    },
  },
});