import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BusinessHoursEditor } from '../components/hours/BusinessHoursEditor';
import { SpecialHoursManager } from '../components/hours/SpecialHoursManager';
import { WeeklySchedule } from '../components/hours/WeeklySchedule';
import { BusinessHoursDisplay } from '../components/hours/BusinessHoursDisplay';
import { WeeklyHours, SpecialHours, BusinessInfo } from '../types/business';
import { BusinessService } from '../services/businessService';
import { NotificationService } from '../services/notificationService';

interface BusinessHoursManagementScreenProps {
  route: {
    params: {
      businessId: string;
    };
  };
}

type ManagementMode = 'overview' | 'edit-hours' | 'special-hours';

export const BusinessHoursManagementScreen: React.FC<BusinessHoursManagementScreenProps> = ({
  route,
}) => {
  const navigation = useNavigation();
  const { businessId } = route.params;

  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [currentHours, setCurrentHours] = useState<WeeklyHours>({});
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([]);
  const [mode, setMode] = useState<ManagementMode>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const businessService = new BusinessService();
  const notificationService = new NotificationService();

  const loadBusinessData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [businessData, hoursData, specialHoursData] = await Promise.all([
        businessService.getBusinessInfo(businessId),
        businessService.getBusinessHours(businessId),
        businessService.getSpecialHours(businessId),
      ]);

      setBusiness(businessData);
      setCurrentHours(hoursData || {});
      setSpecialHours(specialHoursData || []);
    } catch (error) {
      console.error('Failed to load business data:', error);
      Alert.alert(
        'Error',
        'Failed to load business information. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [businessId, businessService]);

  const handleSaveHours = useCallback(async (newHours: WeeklyHours) => {
    setIsSaving(true);
    try {
      await businessService.updateBusinessHours(businessId, newHours);
      setCurrentHours(newHours);
      setMode('overview');
      
      // Send notification to business owner
      await notificationService.sendBusinessHoursUpdateNotification(businessId, {
        type: 'hours_updated',
        message: 'Your business hours have been updated successfully.',
      });

      Alert.alert(
        'Hours Updated',
        'Your business hours have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to save business hours:', error);
      Alert.alert(
        'Save Failed',
        'Failed to update business hours. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  }, [businessId, businessService, notificationService]);

  const handleSaveSpecialHours = useCallback(async (newSpecialHours: SpecialHours[]) => {
    setIsSaving(true);
    try {
      await businessService.updateSpecialHours(businessId, newSpecialHours);
      setSpecialHours(newSpecialHours);
      setMode('overview');
      
      // Send notification for special hours changes
      await notificationService.sendBusinessHoursUpdateNotification(businessId, {
        type: 'special_hours_updated',
        message: 'Your special hours have been updated successfully.',
      });

      Alert.alert(
        'Special Hours Updated',
        'Your special hours have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to save special hours:', error);
      Alert.alert(
        'Save Failed',
        'Failed to update special hours. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  }, [businessId, businessService, notificationService]);

  const handleQuickToggle = useCallback(async (isOpen: boolean) => {
    Alert.alert(
      isOpen ? 'Close Business' : 'Open Business',
      `Are you sure you want to ${isOpen ? 'close' : 'open'} your business now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOpen ? 'Close' : 'Open',
          onPress: async () => {
            try {
              setIsSaving(true);
              await businessService.setBusinessStatus(businessId, !isOpen);
              
              // Refresh business data to get updated status
              await loadBusinessData();
              
              // Send notification
              await notificationService.sendBusinessHoursUpdateNotification(businessId, {
                type: 'status_changed',
                message: `Your business is now ${!isOpen ? 'open' : 'closed'}.`,
              });
            } catch (error) {
              Alert.alert(
                'Error',
                `Failed to ${isOpen ? 'close' : 'open'} business. Please try again.`,
                [{ text: 'OK' }]
              );
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  }, [businessId, businessService, notificationService, loadBusinessData]);

  // Load data on mount and when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadBusinessData();
    }, [loadBusinessData])
  );

  const renderOverviewMode = () => {
    if (!business) return null;

    const upcomingSpecialHours = specialHours
      .filter(sh => sh.isActive && new Date(sh.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);

    return (
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadBusinessData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Current Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <BusinessHoursDisplay
              businessId={businessId}
              hours={currentHours}
              timezone={business.timezone}
              size="large"
              showNextChange={true}
              enableRealTime={true}
            />
            
            <TouchableOpacity
              style={[
                styles.quickToggleButton,
                business.isCurrentlyOpen && styles.closeButton
              ]}
              onPress={() => handleQuickToggle(business.isCurrentlyOpen)}
              disabled={isSaving}
              testID="quick-toggle-button"
            >
              <Icon 
                name={business.isCurrentlyOpen ? 'pause' : 'play-arrow'} 
                size={20} 
                color="#FFF" 
              />
              <Text style={styles.quickToggleText}>
                {business.isCurrentlyOpen ? 'Close Now' : 'Open Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly Schedule Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly Schedule</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setMode('edit-hours')}
              testID="edit-hours-button"
            >
              <Icon name="edit" size={20} color="#007AFF" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <WeeklySchedule
            hours={currentHours}
            timezone={business.timezone}
            compact={false}
            showCurrentTime={true}
            testID="weekly-schedule-display"
          />
        </View>

        {/* Special Hours Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Special Hours</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setMode('special-hours')}
              testID="edit-special-hours-button"
            >
              <Icon name="event" size={20} color="#007AFF" />
              <Text style={styles.editButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>
          
          {upcomingSpecialHours.length > 0 ? (
            <View style={styles.specialHoursList}>
              {upcomingSpecialHours.map((specialHour, index) => (
                <View key={specialHour.id} style={styles.specialHourItem}>
                  <View style={styles.specialHourInfo}>
                    <Text style={styles.specialHourName}>{specialHour.name}</Text>
                    <Text style={styles.specialHourDate}>
                      {new Date(specialHour.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                  <Text style={styles.specialHourStatus}>
                    {specialHour.closed ? 'Closed' : 
                     `${specialHour.hours?.open} - ${specialHour.hours?.close}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptySpecialHours}>
              <Text style={styles.emptySpecialHoursText}>
                No upcoming special hours
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                // Navigate to template selection
                Alert.alert(
                  'Apply Template',
                  'Choose a template to quickly set up your hours',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Business Hours', onPress: () => setMode('edit-hours') },
                    { text: 'Retail Hours', onPress: () => setMode('edit-hours') },
                    { text: 'Restaurant Hours', onPress: () => setMode('edit-hours') },
                  ]
                );
              }}
              testID="apply-template-button"
            >
              <Icon name="schedule" size={24} color="#007AFF" />
              <Text style={styles.quickActionText}>Apply Template</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                // Copy current week to next week
                Alert.alert(
                  'Copy Schedule',
                  'Copy this week\'s schedule to next week?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Copy', onPress: () => {
                      // Implementation for copying schedule
                      Alert.alert('Feature Coming Soon', 'This feature will be available soon.');
                    }},
                  ]
                );
              }}
              testID="copy-schedule-button"
            >
              <Icon name="content-copy" size={24} color="#007AFF" />
              <Text style={styles.quickActionText}>Copy Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setMode('special-hours')}
              testID="add-holiday-button"
            >
              <Icon name="celebration" size={24} color="#007AFF" />
              <Text style={styles.quickActionText}>Add Holiday</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading business hours...</Text>
        </View>
      );
    }

    switch (mode) {
      case 'edit-hours':
        return (
          <BusinessHoursEditor
            businessId={businessId}
            currentHours={currentHours}
            onSave={handleSaveHours}
            onCancel={() => setMode('overview')}
            isLoading={isSaving}
            testID="business-hours-editor"
          />
        );
      
      case 'special-hours':
        return (
          <SpecialHoursManager
            businessId={businessId}
            currentSpecialHours={specialHours}
            onSave={handleSaveSpecialHours}
            onCancel={() => setMode('overview')}
            isLoading={isSaving}
            testID="special-hours-manager"
          />
        );
      
      default:
        return renderOverviewMode();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="business-hours-management-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {mode === 'edit-hours' ? 'Edit Hours' :
           mode === 'special-hours' ? 'Special Hours' :
           'Business Hours'}
        </Text>
        
        <View style={styles.headerRight}>
          {business && (
            <Text style={styles.businessName}>{business.name}</Text>
          )}
        </View>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  businessName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  closeButton: {
    backgroundColor: '#F44336',
  },
  quickToggleText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  specialHoursList: {
    gap: 12,
  },
  specialHourItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  specialHourInfo: {
    flex: 1,
  },
  specialHourName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  specialHourDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  specialHourStatus: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptySpecialHours: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySpecialHoursText: {
    fontSize: 16,
    color: '#999',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});