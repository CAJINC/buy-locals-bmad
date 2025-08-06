import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { dynamicSearchService, SearchUpdateNotification } from '../../../services/dynamicSearchService';

const { width: screenWidth } = Dimensions.get('window');

export interface SearchNotificationProps {
  enabled?: boolean;
  position?: 'top' | 'bottom';
  animationDuration?: number;
  autoHideDuration?: number;
  onNotificationPress?: (notification: SearchUpdateNotification) => void;
  onActionPress?: (action: string, notification: SearchUpdateNotification) => void;
  maxVisibleNotifications?: number;
  testID?: string;
}

interface NotificationState {
  id: string;
  notification: SearchUpdateNotification;
  timestamp: number;
  visible: boolean;
  animatedValue: Animated.Value;
  autoHideTimer?: NodeJS.Timeout;
}

/**
 * Enterprise-grade search notification system with user feedback capabilities
 * Provides real-time updates, bandwidth notifications, and user interaction
 */
export const SearchNotificationSystem: React.FC<SearchNotificationProps> = ({
  enabled = true,
  position = 'top',
  animationDuration = 300,
  autoHideDuration = 4000,
  onNotificationPress,
  onActionPress,
  maxVisibleNotifications = 3,
  testID,
}) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const notificationIdCounter = useRef(0);
  
  // Subscribe to search notifications
  useEffect(() => {
    if (!enabled) return;

    const handleSearchNotification = (notification: SearchUpdateNotification) => {
      addNotification(notification);
    };

    dynamicSearchService.on('search_notification', handleSearchNotification);

    return () => {
      dynamicSearchService.off('search_notification', handleSearchNotification);
    };
  }, [enabled]);

  /**
   * Add new notification with animation
   */
  const addNotification = useCallback(
    (notification: SearchUpdateNotification) => {
      const id = `notification_${++notificationIdCounter.current}`;
      const animatedValue = new Animated.Value(0);

      const newNotification: NotificationState = {
        id,
        notification,
        timestamp: Date.now(),
        visible: true,
        animatedValue,
      };

      // Add notification
      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        
        // Limit visible notifications
        if (updated.length > maxVisibleNotifications) {
          const removed = updated.slice(maxVisibleNotifications);
          removed.forEach((notif) => hideNotification(notif.id));
          return updated.slice(0, maxVisibleNotifications);
        }
        
        return updated;
      });

      // Animate in
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();

      // Auto-hide for certain notification types
      if (shouldAutoHide(notification)) {
        const timer = setTimeout(() => {
          hideNotification(id);
        }, getAutoHideDuration(notification));
        
        newNotification.autoHideTimer = timer;
      }
    },
    [animationDuration, autoHideDuration, maxVisibleNotifications]
  );

  /**
   * Hide notification with animation
   */
  const hideNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === id);
        if (!notification) return prev;

        // Clear auto-hide timer
        if (notification.autoHideTimer) {
          clearTimeout(notification.autoHideTimer);
        }

        // Animate out
        Animated.timing(notification.animatedValue, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }).start(() => {
          // Remove from state after animation
          setNotifications((current) => current.filter((n) => n.id !== id));
        });

        return prev.map((n) => (n.id === id ? { ...n, visible: false } : n));
      });
    },
    [animationDuration]
  );

  /**
   * Handle notification press
   */
  const handleNotificationPress = useCallback(
    (notificationState: NotificationState) => {
      if (onNotificationPress) {
        onNotificationPress(notificationState.notification);
      } else {
        // Default behavior - show details
        showNotificationDetails(notificationState.notification);
      }
    },
    [onNotificationPress]
  );

  /**
   * Handle action button press
   */
  const handleActionPress = useCallback(
    (action: string, notificationState: NotificationState) => {
      if (onActionPress) {
        onActionPress(action, notificationState.notification);
      } else {
        // Default action handling
        handleDefaultAction(action, notificationState.notification);
      }
      
      // Hide notification after action
      hideNotification(notificationState.id);
    },
    [onActionPress, hideNotification]
  );

  /**
   * Show notification details in alert
   */
  const showNotificationDetails = (notification: SearchUpdateNotification) => {
    const title = getNotificationTitle(notification);
    const message = getNotificationMessage(notification);
    
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  /**
   * Handle default actions
   */
  const handleDefaultAction = (action: string, notification: SearchUpdateNotification) => {
    switch (action) {
      case 'retry':
        // Trigger search retry
        dynamicSearchService.handleRegionChange(notification.region, 'user_retry');
        break;
      case 'disable_updates':
        // Disable auto-search
        dynamicSearchService.updateUserPreferences({ autoSearchEnabled: false });
        Alert.alert(
          'Auto-Search Disabled',
          'Search updates have been disabled. You can re-enable them in settings.',
          [{ text: 'OK' }]
        );
        break;
      case 'show_cached':
        // Show cached results
        Alert.alert(
          'Cached Results',
          'Showing previously cached results due to connection issues.',
          [{ text: 'OK' }]
        );
        break;
      case 'wait':
        // Just dismiss - no action needed
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  };

  /**
   * Get notification title
   */
  const getNotificationTitle = (notification: SearchUpdateNotification): string => {
    switch (notification.type) {
      case 'search_started':
        return 'Searching...';
      case 'search_progress':
        return `Searching... ${notification.progress || 0}%`;
      case 'search_completed':
        return 'Search Complete';
      case 'search_failed':
        return 'Search Failed';
      case 'results_invalidated':
        return 'Results Updated';
      case 'bandwidth_limited':
        return 'Limited Connection';
      default:
        return 'Search Update';
    }
  };

  /**
   * Get notification message
   */
  const getNotificationMessage = (notification: SearchUpdateNotification): string => {
    switch (notification.type) {
      case 'search_started':
        return 'Finding businesses in your area...';
      case 'search_progress':
        return `Loading businesses... ${notification.progress || 0}%`;
      case 'search_completed':
        const count = notification.resultCount || 0;
        return `Found ${count} business${count !== 1 ? 'es' : ''} nearby`;
      case 'search_failed':
        return notification.error || 'Unable to search for businesses';
      case 'results_invalidated':
        return notification.userFeedback?.message || 'Search results have been updated';
      case 'bandwidth_limited':
        return notification.userFeedback?.message || 'Search paused due to slow connection';
      default:
        return 'Search status updated';
    }
  };

  /**
   * Get notification icon
   */
  const getNotificationIcon = (notification: SearchUpdateNotification): string => {
    switch (notification.type) {
      case 'search_started':
      case 'search_progress':
        return '🔍';
      case 'search_completed':
        return '✅';
      case 'search_failed':
        return '❌';
      case 'results_invalidated':
        return '🔄';
      case 'bandwidth_limited':
        return '📶';
      default:
        return 'ℹ️';
    }
  };

  /**
   * Get notification style
   */
  const getNotificationStyle = (notification: SearchUpdateNotification) => {
    switch (notification.type) {
      case 'search_completed':
        return styles.successNotification;
      case 'search_failed':
        return styles.errorNotification;
      case 'bandwidth_limited':
        return styles.warningNotification;
      case 'results_invalidated':
        return styles.infoNotification;
      default:
        return styles.defaultNotification;
    }
  };

  /**
   * Check if notification should auto-hide
   */
  const shouldAutoHide = (notification: SearchUpdateNotification): boolean => {
    return ['search_completed', 'search_progress'].includes(notification.type);
  };

  /**
   * Get auto-hide duration based on notification type
   */
  const getAutoHideDuration = (notification: SearchUpdateNotification): number => {
    switch (notification.type) {
      case 'search_progress':
        return 1000; // Quick progress updates
      case 'search_completed':
        return autoHideDuration;
      default:
        return autoHideDuration * 2; // Longer for important messages
    }
  };

  /**
   * Render action buttons
   */
  const renderActionButtons = (notificationState: NotificationState) => {
    const { notification } = notificationState;
    const action = notification.userFeedback?.action;
    
    if (!action) return null;

    const actionText = getActionText(action);
    
    return (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleActionPress(action, notificationState)}
        activeOpacity={0.7}
      >
        <Text style={styles.actionButtonText}>{actionText}</Text>
      </TouchableOpacity>
    );
  };

  /**
   * Get action button text
   */
  const getActionText = (action: string): string => {
    switch (action) {
      case 'retry':
        return 'Retry';
      case 'disable_updates':
        return 'Disable';
      case 'show_cached':
        return 'Show Cached';
      case 'wait':
        return 'Wait';
      default:
        return 'OK';
    }
  };

  if (!enabled || notifications.length === 0) {
    return null;
  }

  return (
    <View 
      style={[
        styles.container, 
        position === 'bottom' ? styles.containerBottom : styles.containerTop
      ]}
      testID={testID}
    >
      {notifications.map((notificationState) => (
        <Animated.View
          key={notificationState.id}
          style={[
            styles.notification,
            getNotificationStyle(notificationState.notification),
            {
              opacity: notificationState.animatedValue,
              transform: [
                {
                  translateY: notificationState.animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: position === 'top' ? [-100, 0] : [100, 0],
                  }),
                },
                {
                  scale: notificationState.animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.notificationContent}
            onPress={() => handleNotificationPress(notificationState)}
            activeOpacity={0.8}
          >
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationIcon}>
                {getNotificationIcon(notificationState.notification)}
              </Text>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>
                  {getNotificationTitle(notificationState.notification)}
                </Text>
                <Text style={styles.notificationMessage}>
                  {getNotificationMessage(notificationState.notification)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => hideNotification(notificationState.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            {/* Progress bar for search progress */}
            {notificationState.notification.type === 'search_progress' && (
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${notificationState.notification.progress || 0}%` },
                  ]}
                />
              </View>
            )}
            
            {/* Action buttons */}
            {renderActionButtons(notificationState)}
            
            {/* Bandwidth info */}
            {notificationState.notification.bandwidthInfo && (
              <View style={styles.bandwidthInfo}>
                <Text style={styles.bandwidthInfoText}>
                  Connection: {notificationState.notification.bandwidthInfo.connectionType}
                  {notificationState.notification.bandwidthInfo.estimatedSpeed && 
                    ` (${notificationState.notification.bandwidthInfo.estimatedSpeed})`}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  containerTop: {
    top: Platform.OS === 'ios' ? 60 : 40,
  },
  containerBottom: {
    bottom: Platform.OS === 'ios' ? 100 : 80,
  },
  notification: {
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  defaultNotification: {
    backgroundColor: '#FFFFFF',
  },
  successNotification: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  errorNotification: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningNotification: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoNotification: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999999',
    fontWeight: '300',
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#E0E0E0',
    borderRadius: 1.5,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 1.5,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bandwidthInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  bandwidthInfoText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
});

export default SearchNotificationSystem;