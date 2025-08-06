import { CreateBusinessRequest, UpdateBusinessRequest, BusinessSearchQuery, BusinessResponseDto } from '../types/Business.js';
export declare class BusinessService {
    private businessRepository;
    private geocodingService;
    constructor();
    createBusiness(ownerId: string, businessData: CreateBusinessRequest): Promise<BusinessResponseDto>;
    getBusinessById(businessId: string): Promise<BusinessResponseDto>;
    updateBusiness(businessId: string, ownerId: string, updates: UpdateBusinessRequest): Promise<BusinessResponseDto>;
    searchBusinesses(searchQuery: BusinessSearchQuery): Promise<{
        businesses: BusinessResponseDto[];
        totalCount: number;
    }>;
    getBusinessesByOwner(ownerId: string): Promise<BusinessResponseDto[]>;
    getBusinessesByCategory(category: string, limit?: number): Promise<BusinessResponseDto[]>;
    getCategories(): Promise<string[]>;
    getBusinessStats(businessId: string, ownerId: string): Promise<{
        totalViews: number;
        totalBookings: number;
        averageRating: number;
        totalReviews: number;
    }>;
    deleteBusiness(businessId: string, ownerId: string): Promise<void>;
    private calculateDistance;
    private mapToResponseDto;
    private validateBusinessNameUniqueness;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=businessService.d.ts.map