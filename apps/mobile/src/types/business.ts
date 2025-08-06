export interface DaySchedule {
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface BusinessContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface BusinessLocation {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface BusinessMedia {
  type: 'logo' | 'photo' | 'video';
  url: string;
  alt?: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  location: BusinessLocation;
  categories: string[];
  hours?: BusinessHours;
  contact?: BusinessContact;
  media?: BusinessMedia[];
  services?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  timezone?: string;
}