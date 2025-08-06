import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Base container styles
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },

  // Size variants
  containerSmall: {
    height: 44,
    paddingHorizontal: 12,
  },

  containerMedium: {
    height: 56,
    paddingHorizontal: 16,
  },

  containerLarge: {
    height: 68,
    paddingHorizontal: 20,
  },

  // State-based container styles - Light theme
  availableContainer: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
  },

  selectedContainer: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },

  unavailableContainer: {
    backgroundColor: '#f8f8f8',
    borderColor: '#e0e0e0',
    opacity: 0.6,
  },

  disabledContainer: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d0d0d0',
    opacity: 0.5,
  },

  // State-based container styles - Dark theme
  availableContainerDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },

  selectedContainerDark: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },

  unavailableContainerDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333333',
    opacity: 0.6,
  },

  disabledContainerDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333333',
    opacity: 0.5,
  },

  // Content container
  content: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Time text styles - Sizes
  timeText: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },

  timeTextSmall: {
    fontSize: 12,
  },

  timeTextMedium: {
    fontSize: 14,
  },

  timeTextLarge: {
    fontSize: 16,
  },

  // Time text styles - States (Light theme)
  availableTimeText: {
    color: '#333333',
  },

  selectedTimeText: {
    color: '#ffffff',
  },

  unavailableTimeText: {
    color: '#999999',
  },

  disabledTimeText: {
    color: '#cccccc',
  },

  // Time text styles - States (Dark theme)
  availableTimeTextDark: {
    color: '#ffffff',
  },

  selectedTimeTextDark: {
    color: '#ffffff',
  },

  unavailableTimeTextDark: {
    color: '#666666',
  },

  disabledTimeTextDark: {
    color: '#444444',
  },

  // Price text styles - Sizes
  priceText: {
    fontWeight: '500',
    textAlign: 'center',
  },

  priceTextSmall: {
    fontSize: 10,
  },

  priceTextMedium: {
    fontSize: 12,
  },

  priceTextLarge: {
    fontSize: 14,
  },

  // Price text styles - States (Light theme)
  availablePriceText: {
    color: '#007AFF',
  },

  selectedPriceText: {
    color: '#ffffff',
  },

  unavailablePriceText: {
    color: '#cccccc',
  },

  disabledPriceText: {
    color: '#cccccc',
  },

  // Price text styles - States (Dark theme)
  availablePriceTextDark: {
    color: '#66b3ff',
  },

  selectedPriceTextDark: {
    color: '#ffffff',
  },

  unavailablePriceTextDark: {
    color: '#555555',
  },

  disabledPriceTextDark: {
    color: '#444444',
  },

  // Overlay styles
  unavailableOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  unavailableText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },

  unavailableTextDark: {
    color: '#ffffff',
  },

  // Selected indicator
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});