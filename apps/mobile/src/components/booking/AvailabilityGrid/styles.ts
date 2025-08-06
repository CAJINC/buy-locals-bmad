import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  containerDark: {
    backgroundColor: '#1a1a1a',
  },

  contentContainer: {
    paddingBottom: 16,
  },

  groupContainer: {
    marginBottom: 16,
  },

  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  groupTitleDark: {
    color: '#ffffff',
  },

  slotsGrid: {
    flexDirection: 'column',
  },

  slotContainer: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },

  slotSeparator: {
    height: 8,
  },

  groupSeparator: {
    height: 24,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },

  emptyTextDark: {
    color: '#cccccc',
  },

  emptySubText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },

  emptySubTextDark: {
    color: '#888888',
  },
});