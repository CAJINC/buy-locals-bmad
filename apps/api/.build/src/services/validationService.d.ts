import { BusinessLocation, BusinessContact } from '../types/Business.js';
export declare class ValidationService {
    static normalizeAddress(location: BusinessLocation): BusinessLocation;
    private static normalizeStreetAddress;
    private static normalizeCityName;
    private static normalizeZipCode;
    static normalizePhoneNumber(phone: string): string;
    static normalizeEmail(email: string): string;
    static normalizeWebsiteUrl(url: string): string;
    static normalizeContact(contact: BusinessContact): BusinessContact;
    static validateBusinessHours(hours: any): {
        isValid: boolean;
        errors: string[];
    };
    private static parseTime;
    static validateBusinessName(name: string): {
        isValid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=validationService.d.ts.map