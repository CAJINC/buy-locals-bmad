export class ValidationService {
    static normalizeAddress(location) {
        return {
            address: this.normalizeStreetAddress(location.address),
            city: this.normalizeCityName(location.city),
            state: location.state.toUpperCase(),
            zipCode: this.normalizeZipCode(location.zipCode),
            country: location.country?.toUpperCase() || 'US',
            coordinates: location.coordinates
        };
    }
    static normalizeStreetAddress(address) {
        return address
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\b\w+/g, (word) => {
            const upperWords = ['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'AVE', 'ST', 'RD', 'DR', 'LN', 'CT', 'PL', 'BLVD'];
            const lowerWords = ['and', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with'];
            const upperWord = word.toUpperCase();
            const lowerWord = word.toLowerCase();
            if (upperWords.includes(upperWord))
                return upperWord;
            if (lowerWords.includes(lowerWord))
                return lowerWord;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
    }
    static normalizeCityName(city) {
        return city
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\b\w+/g, (word) => {
            const lowerWords = ['and', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with'];
            const lowerWord = word.toLowerCase();
            if (lowerWords.includes(lowerWord))
                return lowerWord;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
    }
    static normalizeZipCode(zipCode) {
        const cleaned = zipCode.replace(/\s+/g, '');
        if (/^\d{5}$/.test(cleaned)) {
            return cleaned;
        }
        if (/^\d{9}$/.test(cleaned)) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        return cleaned;
    }
    static normalizePhoneNumber(phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        if (digits.length === 11 && digits.startsWith('1')) {
            const number = digits.slice(1);
            return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
        }
        return phone;
    }
    static normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    static normalizeWebsiteUrl(url) {
        let normalized = url.trim().toLowerCase();
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `https://${normalized}`;
        }
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }
    static normalizeContact(contact) {
        const normalized = {};
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
    static validateBusinessHours(hours) {
        const errors = [];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const day of days) {
            if (!hours[day])
                continue;
            const dayHours = hours[day];
            if (dayHours.closed) {
                if (dayHours.open || dayHours.close) {
                    errors.push(`${day}: Cannot have opening hours when marked as closed`);
                }
                continue;
            }
            if (!dayHours.open || !dayHours.close) {
                errors.push(`${day}: Must specify both opening and closing times`);
                continue;
            }
            const openTime = this.parseTime(dayHours.open);
            const closeTime = this.parseTime(dayHours.close);
            if (!openTime || !closeTime) {
                errors.push(`${day}: Invalid time format`);
                continue;
            }
            if (openTime >= closeTime) {
                errors.push(`${day}: Opening time must be before closing time`);
            }
            if (openTime < 4 * 60 || closeTime > 26 * 60) {
                errors.push(`${day}: Business hours seem unusual (too early or too late)`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static parseTime(timeStr) {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match)
            return null;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        return hours * 60 + minutes;
    }
    static validateBusinessName(name) {
        const errors = [];
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
        const specialCharCount = (name.match(/[^a-zA-Z0-9\s\-&'.]/g) || []).length;
        if (specialCharCount > 3) {
            errors.push('Business name contains too many special characters');
        }
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
//# sourceMappingURL=validationService.js.map