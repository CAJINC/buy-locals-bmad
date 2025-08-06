import { CreateBusinessRequest, Business, BusinessResponseDto } from '@buy-locals/shared';
import { useAppStore } from '../stores/useAppStore';

export interface BusinessFormData {
  name: string;
  description?: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  categories: string[];
  hours: {
    [key: string]: {
      open?: string;
      close?: string;
      closed?: boolean;
    };
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  services?: {
    name: string;
    description?: string;
    price: number;
    duration?: number;
    isActive?: boolean;
  }[];
}

class BusinessService {
  private baseUrl: string;

  constructor() {
    // TODO: Get from environment configuration
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  }

  private async getAuthToken(): Promise<string | null> {
    const { authToken } = useAppStore.getState();
    return authToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async createBusiness(businessData: BusinessFormData): Promise<BusinessResponseDto> {
    const createRequest: CreateBusinessRequest = {
      name: businessData.name,
      description: businessData.description,
      location: businessData.location,
      categories: businessData.categories,
      hours: businessData.hours,
      contact: businessData.contact,
      services: businessData.services,
    };

    return this.makeRequest<BusinessResponseDto>('/businesses', {
      method: 'POST',
      body: JSON.stringify(createRequest),
    });
  }

  async getBusiness(businessId: string): Promise<BusinessResponseDto> {
    return this.makeRequest<BusinessResponseDto>(`/businesses/${businessId}`);
  }

  async getUserBusinesses(): Promise<BusinessResponseDto[]> {
    return this.makeRequest<BusinessResponseDto[]>('/user/businesses');
  }

  async updateBusiness(
    businessId: string,
    updates: Partial<BusinessFormData>
  ): Promise<BusinessResponseDto> {
    return this.makeRequest<BusinessResponseDto>(`/businesses/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async geocodeAddress(address: string, city: string, state: string, zipCode: string) {
    const query = new URLSearchParams({
      address,
      city,
      state,
      zipCode,
    });

    return this.makeRequest<{
      coordinates: { lat: number; lng: number };
      formattedAddress: string;
    }>(`/geocoding/validate?${query}`);
  }

  // Get signed upload URL for media
  async getMediaUploadUrl(
    businessId: string,
    filename: string,
    mimetype: string,
    type: 'logo' | 'photo'
  ) {
    return this.makeRequest<{
      uploadUrl: string;
      key: string;
      mediaId: string;
      expiresAt: string;
    }>(`/businesses/${businessId}/media/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ filename, mimetype, type }),
    });
  }

  // Process uploaded media after S3 upload
  async processUploadedMedia(
    businessId: string,
    mediaId: string,
    type: 'logo' | 'photo',
    description?: string
  ) {
    return this.makeRequest<{
      id: string;
      urls: {
        original: string;
        thumbnail: string;
        small: string;
        medium: string;
        large?: string;
      };
    }>(`/businesses/${businessId}/media/${mediaId}/process`, {
      method: 'POST',
      body: JSON.stringify({ type, description }),
    });
  }

  // Upload media with progress tracking
  async uploadBusinessMedia(
    businessId: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const token = await this.getAuthToken();
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                url: response.url,
              });
            } catch (error) {
              resolve({
                success: false,
                error: 'Invalid response format',
              });
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              resolve({
                success: false,
                error: errorResponse.error || `HTTP ${xhr.status}`,
              });
            } catch (error) {
              resolve({
                success: false,
                error: `Upload failed with status ${xhr.status}`,
              });
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          resolve({
            success: false,
            error: 'Network error during upload',
          });
        });
        
        xhr.addEventListener('timeout', () => {
          resolve({
            success: false,
            error: 'Upload timeout',
          });
        });
        
        xhr.open('POST', `${this.baseUrl}/businesses/${businessId}/media`);
        
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        // Set timeout to 30 seconds
        xhr.timeout = 30000;
        
        xhr.send(formData);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Delete media
  async deleteMedia(businessId: string, mediaId: string) {
    return this.makeRequest<{ success: boolean }>(
      `/businesses/${businessId}/media/${mediaId}`,
      { method: 'DELETE' }
    );
  }

  // Location-based business search
  async searchBusinessesByLocation(searchQuery: {
    lat: number;
    lng: number;
    radius?: number;
    category?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    isOpen?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      businesses: BusinessResponseDto[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
      };
      searchMetadata: {
        searchRadius: number;
        searchCenter: { lat: number; lng: number };
        executionTimeMs: number;
        cacheHit: boolean;
        resultsWithinRadius: number;
      };
    };
    error?: string;
  }> {
    try {
      const query = new URLSearchParams();
      
      // Required parameters
      query.append('lat', searchQuery.lat.toString());
      query.append('lng', searchQuery.lng.toString());
      
      // Optional parameters
      if (searchQuery.radius) query.append('radius', searchQuery.radius.toString());
      if (searchQuery.category?.length) query.append('category', searchQuery.category.join(','));
      if (searchQuery.search) query.append('search', searchQuery.search);
      if (searchQuery.page) query.append('page', searchQuery.page.toString());
      if (searchQuery.limit) query.append('limit', searchQuery.limit.toString());
      if (searchQuery.sortBy) query.append('sortBy', searchQuery.sortBy);
      if (searchQuery.isOpen !== undefined) query.append('isOpen', searchQuery.isOpen.toString());

      const response = await this.makeRequest<any>(`/businesses/search/location?${query}`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Location search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Location search failed',
      };
    }
  }

  // Get categories available in specific location
  async getCategoriesInLocation(lat: number, lng: number, radius: number = 25): Promise<{
    success: boolean;
    data?: {
      categories: string[];
      location: { lat: number; lng: number; radius: number };
    };
    error?: string;
  }> {
    try {
      const query = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radius.toString(),
      });

      const response = await this.makeRequest<any>(`/businesses/search/location/categories?${query}`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Categories in location error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get categories',
      };
    }
  }

  // Get popular areas near location
  async getPopularAreas(lat: number, lng: number, radius: number = 50): Promise<{
    success: boolean;
    data?: {
      popularAreas: Array<{
        center: { lat: number; lng: number };
        businessCount: number;
        averageRating: number;
        topCategories: string[];
        name?: string;
      }>;
      searchCenter: { lat: number; lng: number; radius: number };
    };
    error?: string;
  }> {
    try {
      const query = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radius.toString(),
      });

      const response = await this.makeRequest<any>(`/businesses/search/location/popular-areas?${query}`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Popular areas error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get popular areas',
      };
    }
  }

  // Search businesses with traditional non-location filters
  async searchBusinesses(searchQuery: {
    search?: string;
    category?: string[];
    page?: number;
    limit?: number;
    sortBy?: string;
  }): Promise<{
    success: boolean;
    data?: {
      businesses: BusinessResponseDto[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
      };
    };
    error?: string;
  }> {
    try {
      const query = new URLSearchParams();
      
      if (searchQuery.search) query.append('search', searchQuery.search);
      if (searchQuery.category?.length) query.append('category', searchQuery.category.join(','));
      if (searchQuery.page) query.append('page', searchQuery.page.toString());
      if (searchQuery.limit) query.append('limit', searchQuery.limit.toString());
      if (searchQuery.sortBy) query.append('sortBy', searchQuery.sortBy);

      const response = await this.makeRequest<any>(`/businesses/search?${query}`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Business search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Business search failed',
      };
    }
  }
}

export const businessService = new BusinessService();