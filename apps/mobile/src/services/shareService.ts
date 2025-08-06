import { Share, Alert } from 'react-native';
import { Business } from 'packages/shared/src/types/business';
import { linkingService } from './linkingService';

export interface ShareOptions {
  message?: string;
  url?: string;
  title?: string;
}

export class ShareService {
  /**
   * Share a business profile using the native share dialog
   */
  static async shareBusiness(business: Business, customMessage?: string): Promise<boolean> {
    try {
      const shareUrl = linkingService.generateBusinessProfileUrl(business.id, business.name);
      const defaultMessage = this.generateBusinessShareMessage(business);
      const message = customMessage || defaultMessage;
      
      const shareOptions: ShareOptions = {
        message: `${message}\n\n${shareUrl}`,
        url: shareUrl,
        title: business.name,
      };

      const result = await Share.share(shareOptions);
      
      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing business:', error);
      this.showShareError();
      return false;
    }
  }

  /**
   * Share business with custom content
   */
  static async shareCustom(options: ShareOptions): Promise<boolean> {
    try {
      const result = await Share.share(options);
      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing custom content:', error);
      this.showShareError();
      return false;
    }
  }

  /**
   * Generate a formatted share message for a business
   */
  private static generateBusinessShareMessage(business: Business): string {
    const parts = [`Check out ${business.name} on Buy Locals!`];
    
    if (business.description) {
      parts.push(`\n${business.description}`);
    }
    
    if (business.location) {
      parts.push(`\n📍 ${business.location.address}, ${business.location.city}, ${business.location.state}`);
    }
    
    if (business.categories && business.categories.length > 0) {
      const categories = business.categories.slice(0, 3).join(', ');
      parts.push(`\n🏷️ ${categories}`);
    }
    
    if (business.contact.phone) {
      parts.push(`\n📞 ${business.contact.phone}`);
    }
    
    if (business.contact.website) {
      parts.push(`\n🌐 ${business.contact.website}`);
    }
    
    return parts.join('');
  }

  /**
   * Show error alert when sharing fails
   */
  private static showShareError(): void {
    Alert.alert(
      'Sharing Failed',
      'Unable to share at this time. Please try again later.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Check if sharing is available on the current platform
   */
  static isShareAvailable(): boolean {
    return !!Share.share;
  }

  /**
   * Get share options for different social platforms
   */
  static getSocialShareOptions(business: Business): {
    facebook: ShareOptions;
    twitter: ShareOptions;
    whatsapp: ShareOptions;
    email: ShareOptions;
    sms: ShareOptions;
  } {
    const shareUrl = linkingService.generateBusinessProfileUrl(business.id, business.name);
    const baseMessage = this.generateBusinessShareMessage(business);

    return {
      facebook: {
        message: baseMessage,
        url: shareUrl,
        title: business.name,
      },
      twitter: {
        message: `${baseMessage} ${shareUrl} #BuyLocal #SmallBusiness`,
        title: business.name,
      },
      whatsapp: {
        message: `${baseMessage}\n\n${shareUrl}`,
      },
      email: {
        message: `Hi,\n\nI wanted to share ${business.name} with you!\n\n${baseMessage}\n\nCheck them out: ${shareUrl}\n\nBest regards`,
        title: `Check out ${business.name}`,
      },
      sms: {
        message: `Check out ${business.name}! ${shareUrl}`,
      },
    };
  }

  /**
   * Generate sharing analytics data
   */
  static getShareAnalytics(business: Business, platform?: string) {
    return {
      business_id: business.id,
      business_name: business.name,
      business_category: business.categories[0] || 'unknown',
      share_platform: platform || 'native',
      share_timestamp: new Date().toISOString(),
      location: {
        city: business.location.city,
        state: business.location.state,
      },
    };
  }
}