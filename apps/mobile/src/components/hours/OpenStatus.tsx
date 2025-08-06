import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface OpenStatusProps {
  isOpen: boolean;
  status: string;
  reason?: string;
  compact?: boolean;
  testID?: string;
}

export const OpenStatus: React.FC<OpenStatusProps> = ({
  isOpen,
  status,
  reason,
  compact = false,
  testID = 'open-status',
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'open':
        return '#10B981'; // Green
      case 'closed':
        return '#EF4444'; // Red
      case 'closing_soon':
        return '#F59E0B'; // Amber
      case 'opening_soon':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'closed':
        return 'Closed';
      case 'closing_soon':
        return 'Closing Soon';
      case 'opening_soon':
        return 'Opening Soon';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    return isOpen ? '●' : '●';
  };

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        <Text 
          style={[
            styles.compactStatusIcon,
            { color: getStatusColor() }
          ]}
          testID={`${testID}-icon`}
        >
          {getStatusIcon()}
        </Text>
        <Text 
          style={[
            styles.compactStatusText,
            { color: getStatusColor() }
          ]}
          testID={`${testID}-text`}
        >
          {getStatusText()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.statusRow}>
        <Text 
          style={[
            styles.statusIcon,
            { color: getStatusColor() }
          ]}
          testID={`${testID}-icon`}
        >
          {getStatusIcon()}
        </Text>
        <Text 
          style={[
            styles.statusText,
            { color: getStatusColor() }
          ]}
          testID={`${testID}-text`}
        >
          {getStatusText()}
        </Text>
      </View>
      
      {reason && reason !== 'Regular hours' && (
        <Text 
          style={styles.reasonText}
          testID={`${testID}-reason`}
        >
          {reason}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  compactStatusIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  compactStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
});