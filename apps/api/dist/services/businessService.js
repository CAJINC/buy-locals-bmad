import { BusinessRepository } from '../repositories/businessRepository.js';
import { GeocodingService } from './geocodingService.js';
import { ValidationService } from './validationService.js';
import { createError } from '../middleware/errorHandler.js';
export class BusinessService {
    constructor() {
        this.businessRepository = new BusinessRepository();
        this.geocodingService = new GeocodingService();
    }
    async createBusiness(ownerId, businessData) {
        if (!businessData.name || !businessData.location || !businessData.categories?.length) {
            throw createError('Name, location, and at least one category are required', 400);
        }
        const nameValidation = ValidationService.validateBusinessName(businessData.name);
        if (!nameValidation.isValid) {
            throw createError(`Invalid business name: ${nameValidation.errors.join(', ')}`, 400);
        }
        if (businessData.hours) {
            const hoursValidation = ValidationService.validateBusinessHours(businessData.hours);
            if (!hoursValidation.isValid) {
                throw createError(`Invalid business hours: ${hoursValidation.errors.join(', ')}`, 400);
            }
        }
        const normalizedLocation = ValidationService.normalizeAddress(businessData.location);
        const normalizedContact = ValidationService.normalizeContact(businessData.contact);
        await this.validateBusinessNameUniqueness(businessData.name, normalizedLocation, null);
        let locationData = normalizedLocation;
        if (!normalizedLocation.coordinates) {
            try {
                const geocoded = await this.geocodingService.geocodeAddress(normalizedLocation.address, normalizedLocation.city, normalizedLocation.state, normalizedLocation.zipCode);
                locationData = {
                    ...normalizedLocation,
                    coordinates: geocoded.coordinates,
                    address: geocoded.address,
                    city: geocoded.city,
                    state: geocoded.state,
                    zipCode: geocoded.zipCode,
                    country: geocoded.country,
                };
            }
            catch (error) {
                throw createError(`Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 400);
            }
        }
        else {
            const { lat, lng } = normalizedLocation.coordinates;
            if (!this.geocodingService.validateCoordinates(lat, lng)) {
                throw createError('Invalid location coordinates', 400);
            }
        }
        const businessToCreate = {
            ...businessData,
            location: locationData,
            contact: normalizedContact,
        };
        const business = await this.businessRepository.createBusiness(ownerId, businessToCreate);
        return this.mapToResponseDto(business);
    }
    async getBusinessById(businessId) {
        const business = await this.businessRepository.findById(businessId);
        if (!business) {
            throw createError('Business not found', 404);
        }
        return this.mapToResponseDto(business);
    }
    async updateBusiness(businessId, ownerId, updates) {
        const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
        if (!isOwner) {
            throw createError('Business not found or access denied', 404);
        }
        const currentBusiness = await this.businessRepository.findById(businessId);
        if (!currentBusiness) {
            throw createError('Business not found', 404);
        }
        if (updates.name && updates.name !== currentBusiness.name) {
            const locationForCheck = updates.location || currentBusiness.location;
            await this.validateBusinessNameUniqueness(updates.name, locationForCheck, businessId);
        }
        if (updates.location?.coordinates) {
            const { lat, lng } = updates.location.coordinates;
            if (!this.geocodingService.validateCoordinates(lat, lng)) {
                throw createError('Invalid location coordinates', 400);
            }
        }
        const updatedBusiness = await this.businessRepository.updateBusiness(businessId, updates);
        if (!updatedBusiness) {
            throw createError('Failed to update business', 500);
        }
        return this.mapToResponseDto(updatedBusiness);
    }
    async searchBusinesses(searchQuery) {
        const page = Math.max(1, searchQuery.page || 1);
        const limit = Math.min(Math.max(1, searchQuery.limit || 10), 50);
        if (searchQuery.lat !== undefined || searchQuery.lng !== undefined) {
            if (searchQuery.lat === undefined || searchQuery.lng === undefined) {
                throw createError('Both latitude and longitude are required for location search', 400);
            }
            if (searchQuery.lat < -90 || searchQuery.lat > 90 ||
                searchQuery.lng < -180 || searchQuery.lng > 180) {
                throw createError('Invalid location coordinates', 400);
            }
        }
        if (searchQuery.radius && (searchQuery.radius < 1 || searchQuery.radius > 100)) {
            throw createError('Radius must be between 1 and 100 miles', 400);
        }
        const normalizedQuery = {
            ...searchQuery,
            page,
            limit,
        };
        const { businesses, totalCount } = await this.businessRepository.searchBusinesses(normalizedQuery);
        return {
            businesses: businesses.map(business => this.mapToResponseDto(business)),
            totalCount,
        };
    }
    async getBusinessesByOwner(ownerId) {
        const businesses = await this.businessRepository.findByOwnerId(ownerId);
        return businesses.map(business => this.mapToResponseDto(business));
    }
    async getBusinessesByCategory(category, limit = 10) {
        const businesses = await this.businessRepository.findByCategory(category, limit);
        return businesses.map(business => this.mapToResponseDto(business));
    }
    async getCategories() {
        return await this.businessRepository.getCategories();
    }
    async getBusinessStats(businessId, ownerId) {
        const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
        if (!isOwner) {
            throw createError('Business not found or access denied', 404);
        }
        return await this.businessRepository.getBusinessStats(businessId);
    }
    async deleteBusiness(businessId, ownerId) {
        const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
        if (!isOwner) {
            throw createError('Business not found or access denied', 404);
        }
        const success = await this.businessRepository.deactivateBusiness(businessId);
        if (!success) {
            throw createError('Failed to delete business', 500);
        }
    }
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 3959;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    mapToResponseDto(business) {
        const mapped = {
            id: business.id,
            owner_id: business.owner_id,
            name: business.name,
            description: business.description,
            location: business.location,
            categories: business.categories,
            hours: business.hours,
            contact: business.contact,
            media: business.media,
            services: business.services,
            is_active: business.is_active,
            created_at: business.created_at,
            updated_at: business.updated_at,
        };
        if ('distance' in business && typeof business.distance === 'number') {
            mapped.distance = business.distance;
        }
        return mapped;
    }
    async validateBusinessNameUniqueness(name, location, excludeBusinessId) {
        if (!location.coordinates) {
            return;
        }
        const { lat, lng } = location.coordinates;
        const searchRadius = 5;
        const searchQuery = {
            lat,
            lng,
            radius: searchRadius,
            search: name,
            page: 1,
            limit: 10
        };
        const { businesses } = await this.businessRepository.searchBusinesses(searchQuery);
        const duplicates = businesses.filter(business => {
            const isDifferentBusiness = excludeBusinessId ? business.id !== excludeBusinessId : true;
            const isSameName = business.name.toLowerCase().trim() === name.toLowerCase().trim();
            return isDifferentBusiness && isSameName;
        });
        if (duplicates.length > 0) {
            throw createError(`A business with the name "${name}" already exists within 5 miles of this location. Please choose a different name or add a distinguishing detail.`, 409);
        }
    }
    async healthCheck() {
        return await this.businessRepository.healthCheck();
    }
}
//# sourceMappingURL=businessService.js.map