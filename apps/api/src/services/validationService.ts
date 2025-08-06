import { BusinessLocation, BusinessContact } from '../types/Business.js';

export class ValidationService {
  /**
   * Normalize and validate business address
   */
  static normalizeAddress(location: BusinessLocation): BusinessLocation {
    return {
      address: this.normalizeStreetAddress(location.address),
      city: this.normalizeCityName(location.city),
      state: location.state.toUpperCase(),
      zipCode: this.normalizeZipCode(location.zipCode),
      country: location.country?.toUpperCase() || 'US',
      coordinates: location.coordinates
    };
  }

  /**
   * Normalize street address (title case, remove extra spaces)
   */
  private static normalizeStreetAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\b\w+/g, (word) => {
        // Title case for most words, except for common abbreviations
        const upperWords = ['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'AVE', 'ST', 'RD', 'DR', 'LN', 'CT', 'PL', 'BLVD'];
        const lowerWords = ['and', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with'];
        
        const upperWord = word.toUpperCase();
        const lowerWord = word.toLowerCase();
        
        if (upperWords.includes(upperWord)) return upperWord;
        if (lowerWords.includes(lowerWord)) return lowerWord;
        
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
  }

  /**
   * Normalize city name (title case)
   */
  private static normalizeCityName(city: string): string {
    return city
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w+/g, (word) => {
        const lowerWords = ['and', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with'];
        const lowerWord = word.toLowerCase();
        
        if (lowerWords.includes(lowerWord)) return lowerWord;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
  }

  /**
   * Normalize ZIP code (remove spaces, format consistently)
   */
  private static normalizeZipCode(zipCode: string): string {
    const cleaned = zipCode.replace(/\s+/g, '');
    
    // Handle 5-digit ZIP
    if (/^\d{5}$/.test(cleaned)) {
      return cleaned;
    }
    
    // Handle 9-digit ZIP (add hyphen if missing)
    if (/^\d{9}$/.test(cleaned)) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    
    // Return as-is if already formatted correctly
    return cleaned;
  }

  /**
   * Normalize phone number to consistent format
   */
  static normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle US phone numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      const number = digits.slice(1);
      return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    
    // Return original if can't format
    return phone;
  }

  /**
   * Normalize email address (lowercase, trim)
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Normalize website URL (ensure protocol, remove trailing slash)
   */
  static normalizeWebsiteUrl(url: string): string {
    let normalized = url.trim().toLowerCase();
    
    // Add https:// if no protocol
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    
    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }

  /**
   * Normalize contact information
   */
  static normalizeContact(contact: BusinessContact): BusinessContact {
    const normalized: BusinessContact = {};
    
    if (contact.phone) {
      normalized.phone = this.normalizePhoneNumber(contact.phone);
    }
    
    if (contact.email) {
      normalized.email = this.normalizeEmail(contact.email);
    }
    
    if (contact.website) {
      normalized.website = this.normalizeWebsiteUrl(contact.website);
    }
    
    return normalized;
  }

  /**
   * Validate business hours for logical consistency
   */
  static validateBusinessHours(hours: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      if (!hours[day]) continue;
      
      const dayHours = hours[day];
      
      if (dayHours.closed) {
        // If marked as closed, shouldn't have open/close times
        if (dayHours.open || dayHours.close) {
          errors.push(`${day}: Cannot have opening hours when marked as closed`);
        }
        continue;
      }
      
      if (!dayHours.open || !dayHours.close) {
        errors.push(`${day}: Must specify both opening and closing times`);
        continue;
      }
      
      // Validate time format and logic
      const openTime = this.parseTime(dayHours.open);
      const closeTime = this.parseTime(dayHours.close);
      
      if (!openTime || !closeTime) {
        errors.push(`${day}: Invalid time format`);
        continue;
      }
      
      if (openTime >= closeTime) {
        errors.push(`${day}: Opening time must be before closing time`);
      }
      
      // Check for reasonable business hours (not earlier than 4 AM or later than 2 AM next day)
      if (openTime < 4 * 60 || closeTime > 26 * 60) {
        errors.push(`${day}: Business hours seem unusual (too early or too late)`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse time string to minutes since midnight
   */
  private static parseTime(timeStr: string): number | null {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    
    return hours * 60 + minutes;
  }

  /**
   * Validate business name for appropriate content
   */
  static validateBusinessName(name: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for inappropriate content
    const inappropriateWords = [
      'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'bastard', 'crap'
    ];
    
    const lowerName = name.toLowerCase();
    for (const word of inappropriateWords) {
      if (lowerName.includes(word)) {
        errors.push('Business name contains inappropriate language');
        break;
      }
    }
    
    // Check for excessive special characters
    const specialCharCount = (name.match(/[^a-zA-Z0-9\s\-&'.]/g) || []).length;
    if (specialCharCount > 3) {
      errors.push('Business name contains too many special characters');
    }
    
    // Check for reasonable length after trimming
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      errors.push('Business name is too short');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}