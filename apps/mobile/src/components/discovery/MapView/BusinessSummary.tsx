import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { BusinessSummaryProps } from './types';
import { MapUtils } from './utils';

export const BusinessSummary: React.FC<BusinessSummaryProps> = ({
  business,
  visible,
  onClose,
  onGetDirections,
  onCall,
  onVisitWebsite,
}) => {
  const handleGetDirections = () => {
    if (onGetDirections) {
      onGetDirections(business);
    } else {
      // Default behavior: open Apple Maps or Google Maps
      const url = `maps://app?daddr=${business.coordinates.latitude},${business.coordinates.longitude}`;
      Linking.canOpenURL(url).then((canOpen) => {
        if (canOpen) {
          Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${business.coordinates.latitude},${business.coordinates.longitude}`;
          Linking.openURL(webUrl);
        }
      });
    }
  };

  const handleCall = () => {
    if (!business.phone) {
      Alert.alert('Phone Not Available', 'No phone number available for this business.');
      return;
    }

    if (onCall) {
      onCall(business);
    } else {
      const phoneUrl = `tel:${business.phone.replace(/[^\d+]/g, '')}`;
      Linking.canOpenURL(phoneUrl).then((canOpen) => {
        if (canOpen) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Cannot Make Call', 'Unable to make phone calls on this device.');
        }
      });
    }
  };

  const handleVisitWebsite = () => {
    if (!business.website) {
      Alert.alert('Website Not Available', 'No website available for this business.');
      return;
    }

    if (onVisitWebsite) {
      onVisitWebsite(business);
    } else {
      Linking.canOpenURL(business.website).then((canOpen) => {
        if (canOpen) {
          Linking.openURL(business.website!);
        } else {
          Alert.alert('Cannot Open Website', 'Unable to open the website.');
        }
      });
    }
  };

  const formatBusinessHours = () => {
    if (!business.businessHours) return null;

    const today = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today].toLowerCase();
    const todayHours = business.businessHours[todayName];

    if (todayHours) {
      return `Today: ${todayHours.open} - ${todayHours.close}`;
    }

    return 'Hours not available';
  };

  const getPriceLevelText = (level?: number) => {
    if (!level) return null;
    return '$'.repeat(Math.min(level, 4));
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBackground} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryIcon}>
                  {MapUtils.getCategoryIcon(business.category)}
                </Text>
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.businessName} numberOfLines={2}>
                  {business.name}
                </Text>
                <Text style={styles.category}>{business.category}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status and Basic Info */}
            <View style={styles.basicInfo}>
              {business.isOpen !== undefined && (
                <View style={[styles.statusBadge, business.isOpen ? styles.openBadge : styles.closedBadge]}>
                  <Text style={styles.statusText}>
                    {business.isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              )}
              {business.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>

            {/* Rating and Reviews */}
            {business.rating && (
              <View style={styles.ratingSection}>
                <View style={styles.ratingContainer}>
                  <Text style={styles.rating}>⭐ {MapUtils.formatRating(business.rating)}</Text>
                  {business.reviewCount && (
                    <Text style={styles.reviewCount}>({business.reviewCount} reviews)</Text>
                  )}
                </View>
                {business.priceLevel && (
                  <Text style={styles.priceLevel}>
                    {getPriceLevelText(business.priceLevel)}
                  </Text>
                )}
              </View>
            )}

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <Text style={styles.address}>{business.address}</Text>
              {business.distance && (
                <Text style={styles.distance}>
                  {MapUtils.formatDistance(business.distance)} away
                </Text>
              )}
            </View>

            {/* Business Hours */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hours</Text>
              <Text style={styles.hours}>{formatBusinessHours()}</Text>
            </View>

            {/* Contact Info */}
            {(business.phone || business.website) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact</Text>
                {business.phone && (
                  <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
                    <Text style={styles.contactIcon}>📞</Text>
                    <Text style={styles.contactText}>{business.phone}</Text>
                  </TouchableOpacity>
                )}
                {business.website && (
                  <TouchableOpacity style={styles.contactItem} onPress={handleVisitWebsite}>
                    <Text style={styles.contactIcon}>🌐</Text>
                    <Text style={styles.contactText}>Visit Website</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleGetDirections}>
              <Text style={styles.primaryButtonText}>Get Directions</Text>
            </TouchableOpacity>
            {business.phone && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleCall}>
                <Text style={styles.secondaryButtonText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayBackground: {
    flex: 1,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  categoryIcon: {
    fontSize: 24,
  },
  titleContainer: {
    flex: 1,
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  category: {
    fontSize: 16,
    color: '#666666',
    textTransform: 'capitalize',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  basicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  openBadge: {
    backgroundColor: '#E8F5E8',
  },
  closedBadge: {
    backgroundColor: '#FFF0F0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  verifiedBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  reviewCount: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 8,
  },
  priceLevel: {
    fontSize: 16,
    color: '#FF8C42',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  address: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
  },
  distance: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 4,
  },
  hours: {
    fontSize: 15,
    color: '#666666',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 20,
  },
  contactText: {
    fontSize: 15,
    color: '#007AFF',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BusinessSummary;