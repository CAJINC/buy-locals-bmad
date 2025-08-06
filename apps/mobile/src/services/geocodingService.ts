import { LocationCoordinates } from './locationService';

export interface GeocodingResult {
  formattedAddress: string;
  coordinates: LocationCoordinates;
  components: {
    streetNumber?: string;
    route?: string;
    locality?: string;
    administrativeAreaLevel1?: string;
    administrativeAreaLevel2?: string;
    country?: string;
    postalCode?: string;
  };
  placeId?: string;
  types: string[];
}

export interface ReverseGeocodingResult {
  formattedAddress: string;
  components: {
    streetNumber?: string;
    route?: string;
    locality?: string;
    administrativeAreaLevel1?: string;
    administrativeAreaLevel2?: string;
    country?: string;
    postalCode?: string;
  };
  placeId?: string;
  types: string[];
}

export interface ZipCodeExpansion {
  center: LocationCoordinates;
  bounds: {
    northeast: LocationCoordinates;
    southwest: LocationCoordinates;
  };
  radius: number; // in kilometers
  cities: string[];
  state: string;
  country: string;
}

class GeocodingService {
  private readonly API_BASE_URL = 'https://maps.googleapis.com/maps/api';
  private readonly API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
  
  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult[]> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `${this.API_BASE_URL}/geocode/json?address=${encodedAddress}&key=${this.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      return data.results.map((result: any) => this.parseGeocodingResult(result));
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }
  
  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult[]> {
    try {
      const url = `${this.API_BASE_URL}/geocode/json?latlng=${latitude},${longitude}&key=${this.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Reverse geocoding failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      return data.results.map((result: any) => this.parseReverseGeocodingResult(result));
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }
  
  /**
   * Expand zip code to area bounds for broader searches
   */
  async expandZipCodeArea(zipCode: string): Promise<ZipCodeExpansion | null> {
    try {
      const results = await this.geocodeAddress(zipCode);
      if (results.length === 0) {
        return null;
      }
      
      const result = results[0];
      
      // Calculate approximate bounds for zip code area
      // Typical zip code covers ~10-50 km radius depending on density
      const isUrban = this.isUrbanZipCode(result);
      const radius = isUrban ? 15 : 30; // km
      
      const bounds = this.calculateBounds(result.coordinates, radius);
      
      // Extract cities and state from components
      const cities = this.extractCitiesFromZipCode(result);
      const state = result.components.administrativeAreaLevel1 || '';
      const country = result.components.country || '';
      
      return {
        center: result.coordinates,
        bounds,
        radius,
        cities,
        state,
        country
      };
    } catch (error) {
      console.error('Zip code expansion error:', error);
      return null;
    }
  }
  
  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.API_BASE_URL}/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,address_components,types&key=${this.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Place details failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      return this.parseGeocodingResult(data.result);
    } catch (error) {
      console.error('Place details error:', error);
      return null;
    }
  }
  
  /**
   * Validate address format and completeness
   */
  validateAddress(address: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Basic validation
    if (!address || address.trim().length < 3) {
      issues.push('Address too short');
      suggestions.push('Enter a more complete address');
    }
    
    // Check for common patterns
    const hasNumber = /\d/.test(address);
    const hasStreet = /street|st|avenue|ave|road|rd|blvd|boulevard|lane|ln|drive|dr|way|court|ct|place|pl/i.test(address);
    const hasZip = /\b\d{5}(-\d{4})?\b/.test(address);
    const hasState = /\b[A-Z]{2}\b/.test(address);
    
    // Scoring system for address completeness
    let completenessScore = 0;
    if (hasNumber) completenessScore += 25;
    if (hasStreet) completenessScore += 25;
    if (hasZip) completenessScore += 25;
    if (hasState) completenessScore += 25;
    
    if (completenessScore < 50) {
      issues.push('Address appears incomplete');
      if (!hasNumber) suggestions.push('Include street number');
      if (!hasStreet) suggestions.push('Include street name');
      if (!hasZip) suggestions.push('Include ZIP code for better accuracy');
      if (!hasState) suggestions.push('Include state abbreviation');
    }
    
    // Check for obvious typos or invalid formats
    if (/\b\d{6,}\b/.test(address) && !/\b\d{5}-\d{4}\b/.test(address)) {
      issues.push('Invalid ZIP code format');
      suggestions.push('Use 5-digit ZIP code or ZIP+4 format');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
  
  /**
   * Normalize address for consistent formatting
   */
  normalizeAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(street|avenue|road|boulevard|lane|drive|court|place)\b/gi, (match) => {
        // Standardize street type abbreviations
        const abbrev: { [key: string]: string } = {
          'street': 'St',
          'avenue': 'Ave', 
          'road': 'Rd',
          'boulevard': 'Blvd',
          'lane': 'Ln',
          'drive': 'Dr',
          'court': 'Ct',
          'place': 'Pl'
        };
        return abbrev[match.toLowerCase()] || match;
      });
  }
  
  /**
   * Parse geocoding API result
   */
  private parseGeocodingResult(result: any): GeocodingResult {
    const components: any = {};
    
    result.address_components?.forEach((component: any) => {
      const types = component.types;
      if (types.includes('street_number')) {
        components.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        components.route = component.long_name;
      } else if (types.includes('locality')) {
        components.locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.administrativeAreaLevel1 = component.short_name;
      } else if (types.includes('administrative_area_level_2')) {
        components.administrativeAreaLevel2 = component.long_name;
      } else if (types.includes('country')) {
        components.country = component.long_name;
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name;
      }
    });
    
    return {
      formattedAddress: result.formatted_address,
      coordinates: {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        accuracy: 10, // Geocoding typically accurate to ~10m
        timestamp: Date.now()
      },
      components,
      placeId: result.place_id,
      types: result.types || []
    };
  }
  
  /**
   * Parse reverse geocoding result
   */
  private parseReverseGeocodingResult(result: any): ReverseGeocodingResult {
    const components: any = {};
    
    result.address_components?.forEach((component: any) => {
      const types = component.types;
      if (types.includes('street_number')) {
        components.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        components.route = component.long_name;
      } else if (types.includes('locality')) {
        components.locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.administrativeAreaLevel1 = component.short_name;
      } else if (types.includes('administrative_area_level_2')) {
        components.administrativeAreaLevel2 = component.long_name;
      } else if (types.includes('country')) {
        components.country = component.long_name;
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name;
      }
    });
    
    return {
      formattedAddress: result.formatted_address,
      components,
      placeId: result.place_id,
      types: result.types || []
    };
  }
  
  /**
   * Determine if zip code is in urban area (affects search radius)
   */
  private isUrbanZipCode(result: GeocodingResult): boolean {
    // Urban indicators
    const urbanTypes = ['neighborhood', 'sublocality', 'administrative_area_level_3'];
    const hasUrbanType = result.types.some(type => urbanTypes.includes(type));
    
    // Major metropolitan areas (simplified detection)
    const majorCities = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose'];
    const cityName = result.components.locality?.toLowerCase() || '';
    const isMetro = majorCities.some(city => cityName.includes(city));
    
    return hasUrbanType || isMetro;
  }
  
  /**
   * Extract potential cities from zip code result
   */
  private extractCitiesFromZipCode(result: GeocodingResult): string[] {
    const cities: string[] = [];
    
    if (result.components.locality) {
      cities.push(result.components.locality);
    }
    
    if (result.components.administrativeAreaLevel2) {
      cities.push(result.components.administrativeAreaLevel2);
    }
    
    return cities;
  }
  
  /**
   * Calculate geographic bounds from center point and radius
   */
  private calculateBounds(center: LocationCoordinates, radiusKm: number): {
    northeast: LocationCoordinates;
    southwest: LocationCoordinates;
  } {
    // Approximate degrees per km (varies by latitude)
    const latDegreePerKm = 1 / 111.32;
    const lngDegreePerKm = 1 / (111.32 * Math.cos(center.latitude * Math.PI / 180));
    
    const latDelta = latDegreePerKm * radiusKm;
    const lngDelta = lngDegreePerKm * radiusKm;
    
    return {
      northeast: {
        latitude: center.latitude + latDelta,
        longitude: center.longitude + lngDelta,
        accuracy: center.accuracy,
        timestamp: center.timestamp
      },
      southwest: {
        latitude: center.latitude - latDelta,
        longitude: center.longitude - lngDelta,
        accuracy: center.accuracy,
        timestamp: center.timestamp
      }
    };
  }
}

export const geocodingService = new GeocodingService();