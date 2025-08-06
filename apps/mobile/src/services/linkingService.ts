import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as Linking from 'expo-linking';

/**
 * URL scheme configuration for deep linking
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    // Production URLs
    'https://buylocals.app',
    'https://www.buylocals.app',
    // Development URLs
    'http://localhost:3000',
    // Custom URL scheme
    'buylocals://',
  ],
  config: {
    screens: {
      Main: {
        screens: {
          Home: '',
          Search: 'search',
          Bookings: 'bookings',
          Profile: 'profile',
        },
      },
      BusinessForm: 'business/create',
      BusinessProfile: {
        path: '/business/:businessId',
        parse: {
          businessId: (businessId: string) => businessId,
        },
        stringify: {
          businessId: (businessId: string) => businessId,
        },
      },
    },
  },
};

/**
 * Service for handling deep links and URL generation
 */
class LinkingService {
  /**
   * Generate a shareable URL for a business profile
   */
  generateBusinessProfileUrl(businessId: string, businessName?: string): string {
    const baseUrl = __DEV__ ? 'http://localhost:3000' : 'https://buylocals.app';
    const cleanName = businessName 
      ? `-${businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}` 
      : '';
    
    return `${baseUrl}/business/${businessId}${cleanName}`;
  }

  /**
   * Generate a custom scheme URL for mobile-to-mobile sharing
   */
  generateMobileBusinessUrl(businessId: string): string {
    return `buylocals://business/${businessId}`;
  }

  /**
   * Open business profile URL externally (for sharing)
   */
  async openBusinessProfile(businessId: string, businessName?: string): Promise<void> {
    const url = this.generateBusinessProfileUrl(businessId, businessName);
    
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open business profile URL:', error);
      throw new Error('Failed to open business profile');
    }
  }

  /**
   * Check if the app can handle a specific URL
   */
  async canOpenURL(url: string): Promise<boolean> {
    try {
      return await Linking.canOpenURL(url);
    } catch (error) {
      console.error('Error checking URL capability:', error);
      return false;
    }
  }

  /**
   * Get the initial URL that opened the app (for cold start deep links)
   */
  async getInitialURL(): Promise<string | null> {
    try {
      return await Linking.getInitialURL();
    } catch (error) {
      console.error('Error getting initial URL:', error);
      return null;
    }
  }

  /**
   * Parse business ID from a deep link URL
   */
  parseBusinessIdFromUrl(url: string): string | null {
    try {
      // Match patterns like /business/123 or /business/123-business-name
      const match = url.match(/\/business\/([^\/\?#]+)/);
      if (match && match[1]) {
        // Extract just the business ID (before any dash if present)
        const businessId = match[1].split('-')[0];
        return businessId;
      }
      return null;
    } catch (error) {
      console.error('Error parsing business ID from URL:', error);
      return null;
    }
  }

  /**
   * Create a universal link that works on both web and mobile
   */
  createUniversalBusinessLink(businessId: string, businessName?: string): {
    web: string;
    mobile: string;
    universal: string;
  } {
    const webUrl = this.generateBusinessProfileUrl(businessId, businessName);
    const mobileUrl = this.generateMobileBusinessUrl(businessId);
    
    return {
      web: webUrl,
      mobile: mobileUrl,
      universal: webUrl, // Universal links use web URLs but open the app if installed
    };
  }

  /**
   * Share a business profile using the platform's native sharing
   */
  async shareBusinessProfile(businessId: string, businessName?: string, businessDescription?: string): Promise<void> {
    const { universal } = this.createUniversalBusinessLink(businessId, businessName);
    
    const shareData = {
      title: businessName ? `Check out ${businessName}` : 'Check out this business',
      text: businessDescription || 'Found this great local business on Buy Locals!',
      url: universal,
    };

    try {
      // Use Web Share API if available (mainly for web)
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to opening the URL
        await this.openBusinessProfile(businessId, businessName);
      }
    } catch (error) {
      console.error('Error sharing business profile:', error);
      // If sharing fails, just copy URL to clipboard as fallback
      // This would need to be implemented with a clipboard library
      throw new Error('Failed to share business profile');
    }
  }

  /**
   * Handle incoming deep links
   */
  handleDeepLink(url: string): {
    type: 'business' | 'unknown';
    businessId?: string;
    action?: string;
  } {
    const businessId = this.parseBusinessIdFromUrl(url);
    
    if (businessId) {
      return {
        type: 'business',
        businessId,
        action: 'view',
      };
    }

    return {
      type: 'unknown',
    };
  }
}

export const linkingService = new LinkingService();