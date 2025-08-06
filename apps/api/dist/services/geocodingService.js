import { config } from '../config/environment.js';
export class GeocodingService {
    constructor() {
        this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
        this.cache = new Map();
        this.cacheTtl = 24 * 60 * 60 * 1000;
        this.apiKey = config.googleMapsApiKey;
        if (!this.apiKey) {
            throw new Error('Google Maps API key is required for geocoding');
        }
    }
    async geocodeAddress(address, city, state, zipCode) {
        const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
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
            this.cache.set(cacheKey, {
                result: geocodingResult,
                timestamp: Date.now()
            });
            return geocodingResult;
        }
        catch (error) {
            console.error('Geocoding API error:', {
                address: fullAddress,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error(`Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async reverseGeocode(lat, lng) {
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
        }
        catch (error) {
            console.error('Reverse geocoding API error:', {
                coordinates: { lat, lng },
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error(`Reverse geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateCoordinates(lat, lng) {
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }
    extractAddressComponents(components) {
        const extracted = {};
        for (const component of components) {
            const types = component.types;
            if (types.includes('street_number')) {
                extracted.streetNumber = component.long_name;
            }
            else if (types.includes('route')) {
                extracted.streetName = component.long_name;
            }
            else if (types.includes('locality')) {
                extracted.city = component.long_name;
            }
            else if (types.includes('administrative_area_level_1')) {
                extracted.state = component.short_name;
            }
            else if (types.includes('postal_code')) {
                extracted.zipCode = component.long_name;
            }
            else if (types.includes('country')) {
                extracted.country = component.short_name;
            }
        }
        if (extracted.streetNumber && extracted.streetName) {
            extracted.address = `${extracted.streetNumber} ${extracted.streetName}`;
        }
        else if (extracted.streetName) {
            extracted.address = extracted.streetName;
        }
        return extracted;
    }
}
//# sourceMappingURL=geocodingService.js.map