import React, { useCallback, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResultActionsProps } from '../types';
import { generateShareMessage } from '../utils/searchResultUtils';

export const ResultActions: React.FC<ResultActionsProps> = ({
  result,
  onBookmark,
  onShare,
  onGetDirections,
  isBookmarked,
  testID = 'result-actions'
}) => {
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);

  // Handle bookmark toggle
  const handleBookmark = useCallback(() => {
    onBookmark(result.id);
  }, [onBookmark, result.id]);

  // Handle share with fallback
  const handleShare = useCallback(async () => {
    try {
      if (onShare) {
        onShare(result);
        return;
      }

      // Fallback to native sharing
      const { subject, message } = generateShareMessage([result], '', 'single');
      
      const shareOptions = {
        title: subject,
        message: message,
        ...(Platform.OS === 'ios' && { url: result.website }),
      };

      const shareResult = await Share.share(shareOptions);
      
      if (shareResult.action === Share.sharedAction) {
        // Handle successful share
        console.log('Successfully shared business');
      }
    } catch (error) {
      console.error('Error sharing business:', error);
      Alert.alert(
        'Share Error',
        'Unable to share this business. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [onShare, result]);

  // Handle directions with fallback
  const handleDirections = useCallback(async () => {
    try {
      if (onGetDirections) {
        onGetDirections(result);
        return;
      }

      // Fallback to native maps
      const { latitude, longitude } = result.coordinates;
      const label = encodeURIComponent(result.name);
      
      let url;
      if (Platform.OS === 'ios') {
        url = `maps://?q=${label}&ll=${latitude},${longitude}`;
      } else {
        url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const webUrl = `https://maps.google.com?q=${latitude},${longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert(
        'Directions Error',
        'Unable to open directions. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [onGetDirections, result]);

  // Handle call business
  const handleCall = useCallback(async () => {
    if (!result.phone) {
      Alert.alert('No Phone', 'Phone number not available for this business.');
      return;
    }

    try {
      const phoneUrl = `tel:${result.phone.replace(/[^0-9+]/g, '')}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert(
          'Call Error',
          'Unable to make a call. Please check your device settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert(
        'Call Error',
        'Unable to make a call. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [result.phone]);

  // Handle website visit
  const handleWebsite = useCallback(async () => {
    if (!result.website) {
      Alert.alert('No Website', 'Website not available for this business.');
      return;
    }

    try {
      let url = result.website;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Website Error',
          'Unable to open website. Please check the URL.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening website:', error);
      Alert.alert(
        'Website Error',
        'Unable to open website. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [result.website]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Primary Actions Row */}
      <View style={styles.primaryActions}>
        {/* Bookmark */}
        <TouchableOpacity
          style={[styles.actionButton, isBookmarked && styles.bookmarkedButton]}
          onPress={handleBookmark}
          activeOpacity={0.7}
          testID={`${testID}-bookmark`}
        >
          <Ionicons 
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'} 
            size={18} 
            color={isBookmarked ? '#007AFF' : '#8E8E93'} 
          />
        </TouchableOpacity>

        {/* Directions */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleDirections}
          activeOpacity={0.7}
          testID={`${testID}-directions`}
        >
          <Ionicons name="navigate" size={18} color="#007AFF" />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          activeOpacity={0.7}
          testID={`${testID}-share`}
        >
          <Ionicons name="share" size={18} color="#8E8E93" />
        </TouchableOpacity>

        {/* Call (if phone available) */}
        {result.phone && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCall}
            activeOpacity={0.7}
            testID={`${testID}-call`}
          >
            <Ionicons name="call" size={18} color="#34C759" />
          </TouchableOpacity>
        )}

        {/* Website (if available) */}
        {result.website && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleWebsite}
            activeOpacity={0.7}
            testID={`${testID}-website`}
          >
            <Ionicons name="globe" size={18} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookmarkedButton: {
    backgroundColor: '#F0F8FF',
  },
});