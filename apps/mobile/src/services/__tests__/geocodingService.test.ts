import { geocodingService } from '../geocodingService';

// Mock fetch
global.fetch = jest.fn();

describe('GeocodingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('geocodeAddress', () => {
    it('should geocode an address successfully', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
            geometry: {
              location: {
                lat: 37.4224764,
                lng: -122.0842499
              }
            },
            place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
            types: ['street_address'],
            address_components: [
              {
                long_name: '1600',
                types: ['street_number']
              },
              {
                long_name: 'Amphitheatre Parkway',
                types: ['route']
              },
              {
                long_name: 'Mountain View',
                types: ['locality']
              },
              {
                short_name: 'CA',
                types: ['administrative_area_level_1']
              },
              {
                long_name: '94043',
                types: ['postal_code']
              }
            ]
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');

      expect(result).toHaveLength(1);
      expect(result[0].formattedAddress).toBe('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
      expect(result[0].coordinates.latitude).toBe(37.4224764);
      expect(result[0].coordinates.longitude).toBe(-122.0842499);
      expect(result[0].placeId).toBe('ChIJ2eUgeAK6j4ARbn5u_wAGqWA');
    });

    it('should handle API errors', async () => {
      const mockErrorResponse = {
        status: 'ZERO_RESULTS',
        error_message: 'No results found'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockErrorResponse)
      });

      await expect(geocodingService.geocodeAddress('invalid address'))
        .rejects.toThrow('Geocoding failed: ZERO_RESULTS - No results found');
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates successfully', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
            place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
            types: ['street_address'],
            address_components: [
              {
                long_name: 'Mountain View',
                types: ['locality']
              },
              {
                short_name: 'CA',
                types: ['administrative_area_level_1']
              }
            ]
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.reverseGeocode(37.4224764, -122.0842499);

      expect(result).toHaveLength(1);
      expect(result[0].formattedAddress).toBe('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
      expect(result[0].components.locality).toBe('Mountain View');
      expect(result[0].components.administrativeAreaLevel1).toBe('CA');
    });
  });

  describe('expandZipCodeArea', () => {
    it('should expand zip code to area bounds', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '94043, USA',
            geometry: {
              location: {
                lat: 37.4224764,
                lng: -122.0842499
              }
            },
            types: ['postal_code'],
            address_components: [
              {
                long_name: '94043',
                types: ['postal_code']
              },
              {
                long_name: 'Mountain View',
                types: ['locality']
              },
              {
                short_name: 'CA',
                types: ['administrative_area_level_1']
              },
              {
                long_name: 'United States',
                types: ['country']
              }
            ]
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.expandZipCodeArea('94043');

      expect(result).toBeTruthy();
      expect(result!.center.latitude).toBe(37.4224764);
      expect(result!.center.longitude).toBe(-122.0842499);
      expect(result!.radius).toBeGreaterThan(0);
      expect(result!.bounds).toHaveProperty('northeast');
      expect(result!.bounds).toHaveProperty('southwest');
      expect(result!.cities).toContain('Mountain View');
      expect(result!.state).toBe('CA');
      expect(result!.country).toBe('United States');
    });

    it('should return null for invalid zip code', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await geocodingService.expandZipCodeArea('invalid');

      expect(result).toBeNull();
    });
  });

  describe('validateAddress', () => {
    it('should validate complete address', () => {
      const result = geocodingService.validateAddress('1600 Amphitheatre Parkway, Mountain View, CA 94043');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify incomplete address', () => {
      const result = geocodingService.validateAddress('Main Street');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Address appears incomplete');
      expect(result.suggestions).toContain('Include street number');
      expect(result.suggestions).toContain('Include ZIP code for better accuracy');
    });

    it('should identify invalid ZIP code format', () => {
      const result = geocodingService.validateAddress('1234 Main St, City, ST 123456');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid ZIP code format');
      expect(result.suggestions).toContain('Use 5-digit ZIP code or ZIP+4 format');
    });

    it('should handle empty address', () => {
      const result = geocodingService.validateAddress('');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Address too short');
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize street types', () => {
      const result = geocodingService.normalizeAddress('123 Main Street, City, State');

      expect(result).toBe('123 Main St, City, State');
    });

    it('should normalize whitespace', () => {
      const result = geocodingService.normalizeAddress('  123   Main   St  ');

      expect(result).toBe('123 Main St');
    });

    it('should handle multiple street type abbreviations', () => {
      const result = geocodingService.normalizeAddress('123 Main Avenue, 456 Oak Boulevard');

      expect(result).toBe('123 Main Ave, 456 Oak Blvd');
    });
  });
});