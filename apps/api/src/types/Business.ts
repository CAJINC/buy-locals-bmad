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
}

export interface BusinessService {
  name: string;
  description?: string;
  price: number;
  duration?: number; // in minutes
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
  radius?: number; // in miles
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
  distance?: number; // Added for location-based searches
  rating?: number; // Calculated from reviews
  review_count?: number;
}