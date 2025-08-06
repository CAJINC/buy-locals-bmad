import { BaseRepository } from './BaseRepository.js';
import { Business, CreateBusinessRequest, BusinessSearchQuery } from '../types/Business.js';
export declare class BusinessRepository extends BaseRepository<Business> {
    constructor();
    createBusiness(ownerId: string, businessData: CreateBusinessRequest): Promise<Business>;
    findByOwnerId(ownerId: string): Promise<Business[]>;
    searchBusinesses(searchQuery: BusinessSearchQuery): Promise<{
        businesses: Business[];
        totalCount: number;
    }>;
    updateBusiness(businessId: string, updates: Partial<Business>): Promise<Business | null>;
    findByCategory(category: string, limit?: number): Promise<Business[]>;
    getCategories(): Promise<string[]>;
    getBusinessStats(businessId: string): Promise<{
        totalViews: number;
        totalBookings: number;
        averageRating: number;
        totalReviews: number;
    }>;
    isBusinessOwner(businessId: string, userId: string): Promise<boolean>;
    deactivateBusiness(businessId: string): Promise<boolean>;
}
//# sourceMappingURL=businessRepository.d.ts.map