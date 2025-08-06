import { LocationCoordinates } from '../../services/locationService';

export interface LocationSuggestion {
  id: string;
  title: string;
  subtitle: string;
  coordinates: LocationCoordinates;
  placeId?: string;
  source: 'history' | 'saved' | 'places' | 'current';
  icon: string;
}

export interface LocationValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

export interface AddressComponents {
  streetNumber?: string;
  route?: string;
  locality?: string;
  administrativeAreaLevel1?: string;
  administrativeAreaLevel2?: string;
  country?: string;
  postalCode?: string;
}

export interface LocationSearchResult {
  formattedAddress: string;
  coordinates: LocationCoordinates;
  components: AddressComponents;
  placeId?: string;
  types: string[];
  confidence?: number;
}

export interface ZipCodeExpansionInfo {
  zipCode: string;
  center: LocationCoordinates;
  bounds: {
    northeast: LocationCoordinates;
    southwest: LocationCoordinates;
  };
  radius: number; // in kilometers
  cities: string[];
  state: string;
  country: string;
  isUrban: boolean;
}

export interface LocationSearchFilters {
  category?: 'home' | 'work' | 'favorite' | 'custom';
  maxDistance?: number; // in km
  minAccuracy?: number; // in meters
  excludePlaceTypes?: string[];
  includePlaceTypes?: string[];
}

export interface LocationSearchOptions {
  enableHistory?: boolean;
  enableSaved?: boolean;
  enableCurrentLocation?: boolean;
  enableZipExpansion?: boolean;
  maxSuggestions?: number;
  debounceMs?: number;
  searchRadius?: number;
  filters?: LocationSearchFilters;
}

export interface LocationPermissionInfo {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'blocked' | 'unavailable';
  backgroundLocationGranted?: boolean;
  preciseLocationGranted?: boolean;
  whenInUseGranted?: boolean;
  alwaysLocationGranted?: boolean;
}

export interface LocationErrorInfo {
  code: number;
  message: string;
  type: 'permission' | 'network' | 'timeout' | 'accuracy' | 'unavailable';
  recoverable: boolean;
  suggestions: string[];
}