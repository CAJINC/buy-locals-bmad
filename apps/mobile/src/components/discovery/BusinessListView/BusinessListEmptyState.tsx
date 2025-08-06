import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BusinessListEmptyStateProps } from './types';

export const BusinessListEmptyState: React.FC<BusinessListEmptyStateProps> = ({
  message,
  subtitle,
  action,
  actionLabel,
  testID = 'business-list-empty-state'
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconContainer}>
        <Icon name="search-off" size={80} color="#E0E0E0" />
      </View>
      
      <Text style={styles.message} testID={`${testID}-message`}>
        {message}
      </Text>
      
      {subtitle && (
        <Text style={styles.subtitle} testID={`${testID}-subtitle`}>
          {subtitle}
        </Text>
      )}
      
      {action && actionLabel && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={action}
          testID={`${testID}-action-button`}
          activeOpacity={0.7}
        >
          <Icon name="refresh" size={20} color="#007AFF" style={styles.actionIcon} />
          <Text style={styles.actionText}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.suggestions}>
        <Text style={styles.suggestionsTitle}>Try:</Text>
        <View style={styles.suggestionsList}>
          <Text style={styles.suggestionItem}>• Expanding your search radius</Text>
          <Text style={styles.suggestionItem}>• Removing some filters</Text>
          <Text style={styles.suggestionItem}>• Checking your location permissions</Text>
          <Text style={styles.suggestionItem}>• Searching in a different area</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#F8F9FA',
  },
  iconContainer: {
    marginBottom: 24,
    opacity: 0.6,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  suggestions: {
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 280,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  suggestionsList: {
    alignItems: 'flex-start',
  },
  suggestionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});