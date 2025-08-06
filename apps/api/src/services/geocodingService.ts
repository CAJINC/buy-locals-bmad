import { config } from '../config/environment.js';

export interface GeocodingResult {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  formattedAddress: string;
}

export class GeocodingService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
  private cache = new Map<string, { result: GeocodingResult; timestamp: number }>();
  private cacheTtl = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.apiKey = config.googleMapsApiKey;
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required for geocoding');
    }
  }

  /**
   * Validate and geocode an address using Google Maps Geocoding API
   */
  async geocodeAddress(address: string, city: string, state: string, zipCode: string): Promise<GeocodingResult> {
    const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
    
    // Check cache first
    const cacheKey = `geocode:${fullAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result;
    }
    
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.append('address', fullAddress);
      url.searchParams.append('key', this.apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Geocoding API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.length) {
        throw new Error(`Address validation failed: ${data.status || 'No results found'}`);
      }

      const result = data.results[0];
      const location = result.geometry.location;
      
      // Extract address components
      const addressComponents = result.address_components;
      const extractedAddress = this.extractAddressComponents(addressComponents);

      const geocodingResult = {
        address: extractedAddress.address || address,
        city: extractedAddress.city || city,
        state: extractedAddress.state || state,
        zipCode: extractedAddress.zipCode || zipCode,
        country: extractedAddress.country || 'US',
        coordinates: {
          lat: location.lat,
          lng: location.lng,
        },
        formattedAddress: result.formatted_address,
      };

      // Cache the successful result
      this.cache.set(cacheKey, {
        result: geocodingResult,
        timestamp: Date.now()
      });

      return geocodingResult;
    } catch (error) {
      console.error('Geocoding API error:', {
        address: fullAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reverse geocode coordinates to get address information
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.append('latlng', `${lat},${lng}`);
      url.searchParams.append('key', this.apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.length) {
        throw new Error(`Reverse geocoding failed: ${data.status || 'No results found'}`);
      }

      const result = data.results[0];
      const addressComponents = result.address_components;
      const extractedAddress = this.extractAddressComponents(addressComponents);

      return {
        address: extractedAddress.address || '',
        city: extractedAddress.city || '',
        state: extractedAddress.state || '',
        zipCode: extractedAddress.zipCode || '',
        country: extractedAddress.country || 'US',
        coordinates: {
          lat,
          lng,
        },
        formattedAddress: result.formatted_address,
      };
    } catch (error) {
      console.error('Reverse geocoding API error:', {
        coordinates: { lat, lng },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Reverse geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate coordinates are within reasonable bounds
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Extract structured address information from Google Maps address components
   */
  private extractAddressComponents(components: any[]): {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } {
    const extracted: any = {};

    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number')) {
        extracted.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        extracted.streetName = component.long_name;
      } else if (types.includes('locality')) {
        extracted.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        extracted.state = component.short_name;
      } else if (types.includes('postal_code')) {
        extracted.zipCode = component.long_name;
      } else if (types.includes('country')) {
        extracted.country = component.short_name;
      }
    }

    // Combine street number and name for full address
    if (extracted.streetNumber && extracted.streetName) {
      extracted.address = `${extracted.streetNumber} ${extracted.streetName}`;
    } else if (extracted.streetName) {
      extracted.address = extracted.streetName;
    }

    return extracted;
  }
}