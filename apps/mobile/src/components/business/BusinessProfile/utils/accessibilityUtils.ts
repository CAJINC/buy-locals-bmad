import { Platform, AccessibilityInfo, AccessibilityRole } from 'react-native';
import { Business } from 'packages/shared/src/types/business';

// Accessibility enhancement utilities
export class AccessibilityHelper {
  private static isScreenReaderEnabled = false;
  private static announcements: string[] = [];

  /**
   * Initialize accessibility services
   */
  static async initialize(): Promise<void> {
    try {
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // Listen for screen reader state changes
      AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        this.handleScreenReaderChanged
      );
    } catch (error) {
      console.warn('Failed to initialize accessibility services:', error);
    }
  }

  /**
   * Handle screen reader state changes
   */
  private static handleScreenReaderChanged = (enabled: boolean): void => {
    this.isScreenReaderEnabled = enabled;
  };

  /**
   * Check if screen reader is enabled
   */
  static isScreenReaderActive(): boolean {
    return this.isScreenReaderEnabled;
  }

  /**
   * Announce message to screen reader
   */
  static announce(message: string, priority: 'low' | 'high' = 'low'): void {
    if (!this.isScreenReaderEnabled) return;

    try {
      AccessibilityInfo.announceForAccessibility(message);
      this.announcements.push(message);
    } catch (error) {
      console.warn('Failed to announce message:', error);
    }
  }

  /**
   * Generate accessibility label for business rating
   */
  static getRatingAccessibilityLabel(rating: number, reviewCount?: number): string {
    const ratingText = `Rated ${rating.toFixed(1)} out of 5 stars`;
    const reviewText = reviewCount ? ` based on ${reviewCount} reviews` : '';
    return `${ratingText}${reviewText}`;
  }

  /**
   * Generate accessibility label for business hours
   */
  static getBusinessHoursAccessibilityLabel(
    hours: Business['hours'],
    currentStatus: 'open' | 'closed' | 'unknown'
  ): string {
    const statusText = currentStatus === 'open' ? 'Currently open' : 'Currently closed';
    
    if (!hours || Object.keys(hours).length === 0) {
      return `${statusText}. Hours information not available.`;
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayHours = hours[today];
    
    if (!todayHours || todayHours.closed) {
      return `${statusText}. Closed today.`;
    }

    return `${statusText}. Today's hours: ${todayHours.open} to ${todayHours.close}.`;
  }

  /**
   * Generate accessibility label for contact information
   */
  static getContactAccessibilityLabel(contact: Business['contact']): string {
    const parts: string[] = [];
    
    if (contact.phone) {
      parts.push(`Phone: ${this.formatPhoneForScreenReader(contact.phone)}`);
    }
    
    if (contact.email) {
      parts.push(`Email: ${contact.email}`);
    }
    
    if (contact.website) {
      parts.push(`Website: ${contact.website}`);
    }

    return parts.join('. ') || 'No contact information available';
  }

  /**
   * Generate accessibility label for location
   */
  static getLocationAccessibilityLabel(location: Business['location']): string {
    if (!location) return 'Location information not available';
    
    const address = `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`;
    return `Address: ${address}`;
  }

  /**
   * Generate accessibility label for photo gallery
   */
  static getPhotoGalleryAccessibilityLabel(
    photos: Business['media'],
    currentIndex?: number
  ): string {
    if (!photos || photos.length === 0) {
      return 'No photos available';
    }

    const totalPhotos = photos.length;
    if (currentIndex !== undefined) {
      const photo = photos[currentIndex];
      const description = photo.description || 'Business photo';
      return `${description}. Photo ${currentIndex + 1} of ${totalPhotos}. Swipe to navigate photos.`;
    }

    return `Photo gallery with ${totalPhotos} photos. Tap to view photos.`;
  }

  /**
   * Generate accessibility hint for interactive elements
   */
  static getInteractionHint(action: string, element: string): string {
    const actionMap: Record<string, string> = {
      tap: 'Double tap to activate',
      call: 'Double tap to call',
      email: 'Double tap to send email',
      website: 'Double tap to open website',
      directions: 'Double tap to get directions',
      share: 'Double tap to share',
      book: 'Double tap to book service',
      expand: 'Double tap to expand',
      collapse: 'Double tap to collapse',
      navigate: 'Swipe left or right to navigate',
    };

    return actionMap[action] || 'Double tap to interact';
  }

  /**
   * Format phone number for screen reader
   */
  private static formatPhoneForScreenReader(phone: string): string {
    // Remove formatting and add spaces for better pronunciation
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  /**
   * Get semantic role for business elements
   */
  static getSemanticRole(element: string): AccessibilityRole {
    const roleMap: Record<string, AccessibilityRole> = {
      button: 'button',
      link: 'link',
      image: 'image',
      text: 'text',
      heading: 'header',
      list: 'list',
      listItem: 'listitem',
      tab: 'tab',
      tabList: 'tablist',
      progressBar: 'progressbar',
      checkbox: 'checkbox',
      radio: 'radio',
      switch: 'switch',
      slider: 'slider',
      alert: 'alert',
      menu: 'menu',
      menuItem: 'menuitem',
      toolbar: 'toolbar',
      search: 'search',
    };

    return roleMap[element] || 'button';
  }

  /**
   * Generate accessibility state for interactive elements
   */
  static getAccessibilityState(
    element: {
      selected?: boolean;
      checked?: boolean;
      disabled?: boolean;
      expanded?: boolean;
      busy?: boolean;
    }
  ): any {
    const state: any = {};
    
    if (element.selected !== undefined) state.selected = element.selected;
    if (element.checked !== undefined) state.checked = element.checked;
    if (element.disabled !== undefined) state.disabled = element.disabled;
    if (element.expanded !== undefined) state.expanded = element.expanded;
    if (element.busy !== undefined) state.busy = element.busy;

    return Object.keys(state).length > 0 ? state : undefined;
  }

  /**
   * Generate focus order for complex layouts
   */
  static getFocusOrder(elements: string[]): number[] {
    return elements.map((_, index) => index + 1);
  }

  /**
   * Check if reduced motion is preferred
   */
  static async isReducedMotionPreferred(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await AccessibilityInfo.isReduceMotionEnabled();
      }
      // Android doesn't have a direct equivalent, return false
      return false;
    } catch (error) {
      console.warn('Failed to check reduce motion preference:', error);
      return false;
    }
  }

  /**
   * Get high contrast colors if needed
   */
  static getHighContrastColors(): {
    foreground: string;
    background: string;
    accent: string;
  } {
    // These would be implemented based on system accessibility settings
    return {
      foreground: '#000000',
      background: '#FFFFFF',
      accent: '#0066CC',
    };
  }

  /**
   * Cleanup accessibility listeners
   */
  static cleanup(): void {
    try {
      AccessibilityInfo.removeEventListener(
        'screenReaderChanged',
        this.handleScreenReaderChanged
      );
    } catch (error) {
      console.warn('Failed to cleanup accessibility listeners:', error);
    }
  }
}

// Screen reader optimized text utilities
export class ScreenReaderOptimizer {
  /**
   * Optimize text for screen readers by adding pauses and emphasis
   */
  static optimizeText(text: string, options: {
    addPauses?: boolean;
    emphasizeNumbers?: boolean;
    expandAbbreviations?: boolean;
  } = {}): string {
    let optimized = text;

    if (options.addPauses) {
      // Add slight pauses at punctuation for better reading flow
      optimized = optimized.replace(/[,.;]/g, '$&,');
    }

    if (options.emphasizeNumbers) {
      // Add emphasis to numbers for better clarity
      optimized = optimized.replace(/\d+/g, ' $& ');
    }

    if (options.expandAbbreviations) {
      const abbreviations: Record<string, string> = {
        'St.': 'Street',
        'Ave.': 'Avenue',
        'Blvd.': 'Boulevard',
        'Dr.': 'Drive',
        'Rd.': 'Road',
        'LLC': 'Limited Liability Company',
        'Inc.': 'Incorporated',
        'Corp.': 'Corporation',
        'Ltd.': 'Limited',
      };

      Object.entries(abbreviations).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'g');
        optimized = optimized.replace(regex, full);
      });
    }

    return optimized.trim();
  }

  /**
   * Create descriptive text for visual elements
   */
  static describeVisualElement(element: {
    type: 'image' | 'icon' | 'chart' | 'map' | 'video';
    content?: string;
    context?: string;
    purpose?: string;
  }): string {
    const { type, content, context, purpose } = element;
    
    let description = '';
    
    switch (type) {
      case 'image':
        description = content || 'Image';
        break;
      case 'icon':
        description = `${content || 'Icon'}${purpose ? ` for ${purpose}` : ''}`;
        break;
      case 'chart':
        description = `Chart showing ${content || 'data'}`;
        break;
      case 'map':
        description = `Map${content ? ` of ${content}` : ''}`;
        break;
      case 'video':
        description = `Video${content ? `: ${content}` : ''}`;
        break;
      default:
        description = content || 'Visual element';
    }

    if (context) {
      description += ` in ${context}`;
    }

    return description;
  }
}

// Keyboard navigation utilities
export class KeyboardNavigation {
  private static focusableElements: Map<string, any> = new Map();
  private static currentFocusIndex = -1;

  /**
   * Register focusable element
   */
  static registerFocusableElement(id: string, element: any): void {
    this.focusableElements.set(id, element);
  }

  /**
   * Unregister focusable element
   */
  static unregisterFocusableElement(id: string): void {
    this.focusableElements.delete(id);
  }

  /**
   * Navigate to next focusable element
   */
  static focusNext(): boolean {
    const elements = Array.from(this.focusableElements.values());
    if (elements.length === 0) return false;

    this.currentFocusIndex = (this.currentFocusIndex + 1) % elements.length;
    const nextElement = elements[this.currentFocusIndex];
    
    try {
      nextElement?.focus?.();
      return true;
    } catch (error) {
      console.warn('Failed to focus next element:', error);
      return false;
    }
  }

  /**
   * Navigate to previous focusable element
   */
  static focusPrevious(): boolean {
    const elements = Array.from(this.focusableElements.values());
    if (elements.length === 0) return false;

    this.currentFocusIndex = this.currentFocusIndex <= 0 
      ? elements.length - 1 
      : this.currentFocusIndex - 1;
    
    const previousElement = elements[this.currentFocusIndex];
    
    try {
      previousElement?.focus?.();
      return true;
    } catch (error) {
      console.warn('Failed to focus previous element:', error);
      return false;
    }
  }

  /**
   * Clear focus tracking
   */
  static clearFocus(): void {
    this.currentFocusIndex = -1;
    this.focusableElements.clear();
  }
}

export {
  AccessibilityHelper,
  ScreenReaderOptimizer,
  KeyboardNavigation,
};