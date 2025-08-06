import { BusinessRepository } from '../repositories/businessRepository.js';
import { GeocodingService } from './geocodingService.js';
import { ValidationService } from './validationService.js';
import { 
  Business, 
  BusinessLocation,
  BusinessResponseDto, 
  BusinessSearchQuery, 
  CreateBusinessRequest, 
  UpdateBusinessRequest 
} from '../types/Business.js';
import { createError } from '../middleware/errorHandler.js';

export class BusinessService {
  private businessRepository: BusinessRepository;
  private geocodingService: GeocodingService;

  constructor() {
    this.businessRepository = new BusinessRepository();
    this.geocodingService = new GeocodingService();
  }

  /**
   * Create a new business
   */
  async createBusiness(ownerId: string, businessData: CreateBusinessRequest): Promise<BusinessResponseDto> {
    // Validate required fields
    if (!businessData.name || !businessData.location || !businessData.categories?.length) {
      throw createError('Name, location, and at least one category are required', 400);
    }

    // Validate business name content
    const nameValidation = ValidationService.validateBusinessName(businessData.name);
    if (!nameValidation.isValid) {
      throw createError(`Invalid business name: ${nameValidation.errors.join(', ')}`, 400);
    }

    // Validate business hours
    if (businessData.hours) {
      const hoursValidation = ValidationService.validateBusinessHours(businessData.hours);
      if (!hoursValidation.isValid) {
        throw createError(`Invalid business hours: ${hoursValidation.errors.join(', ')}`, 400);
      }
    }

    // Normalize address and contact data
    const normalizedLocation = ValidationService.normalizeAddress(businessData.location);
    const normalizedContact = ValidationService.normalizeContact(businessData.contact);

    // Check business name uniqueness within geographic area (5-mile radius)
    await this.validateBusinessNameUniqueness(businessData.name, normalizedLocation, null);

    // Geocode the address if coordinates are not provided
    let locationData = normalizedLocation;
    if (!normalizedLocation.coordinates) {
      try {
        const geocoded = await this.geocodingService.geocodeAddress(
          normalizedLocation.address,
          normalizedLocation.city,
          normalizedLocation.state,
          normalizedLocation.zipCode
        );
        
        locationData = {
          ...normalizedLocation,
          coordinates: geocoded.coordinates,
          // Update with validated/formatted address data from geocoding
          address: geocoded.address,
          city: geocoded.city,
          state: geocoded.state,
          zipCode: geocoded.zipCode,
          country: geocoded.country,
        };
      } catch (error) {
        throw createError(`Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 400);
      }
    } else {
      // Validate provided coordinates
      const { lat, lng } = normalizedLocation.coordinates;
      if (!this.geocodingService.validateCoordinates(lat, lng)) {
        throw createError('Invalid location coordinates', 400);
      }
    }

    // Create business with validated and normalized data
    const businessToCreate = {
      ...businessData,
      location: locationData,
      contact: normalizedContact,
    };

    const business = await this.businessRepository.createBusiness(ownerId, businessToCreate);
    return this.mapToResponseDto(business);
  }

  /**
   * Get business by ID
   */
  async getBusinessById(businessId: string): Promise<BusinessResponseDto> {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw createError('Business not found', 404);
    }
    return this.mapToResponseDto(business);
  }

  /**
   * Update business
   */
  async updateBusiness(
    businessId: string, 
    ownerId: string, 
    updates: UpdateBusinessRequest
  ): Promise<BusinessResponseDto> {
    // Check if user owns the business
    const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
    if (!isOwner) {
      throw createError('Business not found or access denied', 404);
    }

    // Get current business data for validation
    const currentBusiness = await this.businessRepository.findById(businessId);
    if (!currentBusiness) {
      throw createError('Business not found', 404);
    }

    // Check business name uniqueness if name is being updated
    if (updates.name && updates.name !== currentBusiness.name) {
      const locationForCheck = updates.location || currentBusiness.location;
      await this.validateBusinessNameUniqueness(updates.name, locationForCheck, businessId);
    }

    // Validate coordinates if provided
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

  /**
   * Search businesses with location and filters
   */
  async searchBusinesses(searchQuery: BusinessSearchQuery): Promise<{
    businesses: BusinessResponseDto[];
    totalCount: number;
  }> {
    // Validate pagination parameters
    const page = Math.max(1, searchQuery.page || 1);
    const limit = Math.min(Math.max(1, searchQuery.limit || 10), 50);

    // Validate location coordinates if provided
    if (searchQuery.lat !== undefined || searchQuery.lng !== undefined) {
      if (searchQuery.lat === undefined || searchQuery.lng === undefined) {
        throw createError('Both latitude and longitude are required for location search', 400);
      }
      
      if (searchQuery.lat < -90 || searchQuery.lat > 90 || 
          searchQuery.lng < -180 || searchQuery.lng > 180) {
        throw createError('Invalid location coordinates', 400);
      }
    }

    // Validate radius
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

  /**
   * Get businesses owned by user
   */
  async getBusinessesByOwner(ownerId: string): Promise<BusinessResponseDto[]> {
    const businesses = await this.businessRepository.findByOwnerId(ownerId);
    return businesses.map(business => this.mapToResponseDto(business));
  }

  /**
   * Get businesses by category
   */
  async getBusinessesByCategory(category: string, limit: number = 10): Promise<BusinessResponseDto[]> {
    const businesses = await this.businessRepository.findByCategory(category, limit);
    return businesses.map(business => this.mapToResponseDto(business));
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    return await this.businessRepository.getCategories();
  }

  /**
   * Get business statistics for owner
   */
  async getBusinessStats(businessId: string, ownerId: string): Promise<{
    totalViews: number;
    totalBookings: number;
    averageRating: number;
    totalReviews: number;
  }> {
    // Check if user owns the business
    const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
    if (!isOwner) {
      throw createError('Business not found or access denied', 404);
    }

    return await this.businessRepository.getBusinessStats(businessId);
  }

  /**
   * Delete business (deactivate)
   */
  async deleteBusiness(businessId: string, ownerId: string): Promise<void> {
    // Check if user owns the business
    const isOwner = await this.businessRepository.isBusinessOwner(businessId, ownerId);
    if (!isOwner) {
      throw createError('Business not found or access denied', 404);
    }

    const success = await this.businessRepository.deactivateBusiness(businessId);
    if (!success) {
      throw createError('Failed to delete business', 500);
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Map Business entity to response DTO
   */
  private mapToResponseDto(business: Business): BusinessResponseDto {
    const mapped: BusinessResponseDto = {
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

    // Add distance if it exists (from location-based searches)
    if ('distance' in business && typeof (business as any).distance === 'number') {
      mapped.distance = (business as any).distance;
    }

    return mapped;
  }

  /**
   * Validate business name uniqueness within geographic area
   */
  private async validateBusinessNameUniqueness(
    name: string, 
    location: BusinessLocation, 
    excludeBusinessId?: string | null
  ): Promise<void> {
    if (!location.coordinates) {
      // Skip uniqueness check if no coordinates (will be geocoded later)
      return;
    }

    const { lat, lng } = location.coordinates;
    const searchRadius = 5; // 5-mile radius for name uniqueness check

    const searchQuery = {
      lat,
      lng,
      radius: searchRadius,
      search: name,
      page: 1,
      limit: 10
    };

    const { businesses } = await this.businessRepository.searchBusinesses(searchQuery);
    
    // Check for exact name matches (case-insensitive)
    const duplicates = businesses.filter(business => {
      const isDifferentBusiness = excludeBusinessId ? business.id !== excludeBusinessId : true;
      const isSameName = business.name.toLowerCase().trim() === name.toLowerCase().trim();
      return isDifferentBusiness && isSameName;
    });

    if (duplicates.length > 0) {
      throw createError(
        `A business with the name "${name}" already exists within 5 miles of this location. Please choose a different name or add a distinguishing detail.`,
        409
      );
    }
  }

  /**
   * Health check for business service
   */
  async healthCheck(): Promise<boolean> {
    return await this.businessRepository.healthCheck();
  }
}