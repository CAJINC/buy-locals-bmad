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
}

export const businessService = new BusinessService();