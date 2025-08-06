export interface BusinessLocation {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}
export interface BusinessHours {
    [key: string]: {
        open?: string;
        close?: string;
        closed?: boolean;
    };
}
export interface BusinessContact {
    phone?: string;
    email?: string;
    website?: string;
    socialMedia?: {
        platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
        url: string;
        handle?: string;
    }[];
}
export interface BusinessService {
    name: string;
    description?: string;
    price: number;
    duration?: number;
    isActive?: boolean;
}
export interface Business {
    id: string;
    owner_id: string;
    name: string;
    description?: string;
    location: BusinessLocation;
    categories: string[];
    hours: BusinessHours;
    contact: BusinessContact;
    media: {
        id: string;
        url: string;
        type: 'logo' | 'photo';
        description?: string;
    }[];
    services: BusinessService[];
    is_active: boolean;
    rating?: number;
    reviewCount?: number;
    isVerified?: boolean;
    verificationLevel?: 'basic' | 'premium' | 'enterprise';
    verificationDate?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface CreateBusinessRequest {
    name: string;
    description?: string;
    location: BusinessLocation;
    categories: string[];
    hours: BusinessHours;
    contact: BusinessContact;
    services?: BusinessService[];
}
export interface UpdateBusinessRequest {
    name?: string;
    description?: string;
    location?: BusinessLocation;
    categories?: string[];
    hours?: BusinessHours;
    contact?: BusinessContact;
    services?: BusinessService[];
    is_active?: boolean;
}
export interface BusinessSearchQuery {
    lat?: number;
    lng?: number;
    radius?: number;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export interface BusinessResponseDto {
    id: string;
    owner_id: string;
    name: string;
    description?: string;
    location: BusinessLocation;
    categories: string[];
    hours: BusinessHours;
    contact: BusinessContact;
    media: {
        id: string;
        url: string;
        type: 'logo' | 'photo';
        description?: string;
    }[];
    services: BusinessService[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    distance?: number;
    rating?: number;
    review_count?: number;
}
export interface BusinessSearchFilters {
    page?: number;
    limit?: number;
    category?: string;
    city?: string;
    search?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
}
//# sourceMappingURL=business.d.ts.map