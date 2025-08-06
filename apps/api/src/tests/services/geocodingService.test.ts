import { GeocodingService } from '../../services/geocodingService.js';
import { config } from '../../config/environment.js';

// Mock config
jest.mock('../../config/environment.js', () => ({
  config: {
    googleMapsApiKey: 'test-api-key'
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('GeocodingService', () => {
  let geocodingService: GeocodingService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    geocodingService = new GeocodingService();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('geocodeAddress', () => {
    it('should successfully geocode an address', async () => {
      const mockResponse = {
        status: 'OK',
        results: [{
          formatted_address: '123 Main St, New York, NY 10001, USA',
          geometry: {
            location: { lat: 40.7128, lng: -74.0060 }
          },
          address_components: [
            { types: ['street_number'], long_name: '123' },
            { types: ['route'], long_name: 'Main St' },
            { types: ['locality'], long_name: 'New York' },
            { types: ['administrative_area_level_1'], short_name: 'NY' },
            { types: ['postal_code'], long_name: '10001' },
            { types: ['country'], short_name: 'US' }
          ]
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await geocodingService.geocodeAddress('123 Main St', 'New York', 'NY', '10001');

      expect(result).toEqual({
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        formattedAddress: '123 Main St, New York, NY 10001, USA'
      });
    });

    it('should use cache for repeated requests', async () => {
      const mockResponse = {
        status: 'OK',
        results: [{
          formatted_address: '123 Main St, New York, NY 10001, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          address_components: []
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      // First call
      await geocodingService.geocodeAddress('123 Main St', 'New York', 'NY', '10001');
      
      // Second call - should use cache
      await geocodingService.geocodeAddress('123 Main St', 'New York', 'NY', '10001');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle geocoding API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      } as Response);

      await expect(
        geocodingService.geocodeAddress('Invalid Address', 'Invalid City', 'XX', '00000')
      ).rejects.toThrow('Geocoding failed: Geocoding API request failed: 403');
    });

    it('should handle no results response', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        results: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await expect(
        geocodingService.geocodeAddress('Invalid Address', 'Invalid City', 'XX', '00000')
      ).rejects.toThrow('Geocoding failed: Address validation failed: ZERO_RESULTS');
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(geocodingService.validateCoordinates(40.7128, -74.0060)).toBe(true);
      expect(geocodingService.validateCoordinates(0, 0)).toBe(true);
      expect(geocodingService.validateCoordinates(90, 180)).toBe(true);
      expect(geocodingService.validateCoordinates(-90, -180)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(geocodingService.validateCoordinates(91, 0)).toBe(false);
      expect(geocodingService.validateCoordinates(-91, 0)).toBe(false);
      expect(geocodingService.validateCoordinates(0, 181)).toBe(false);
      expect(geocodingService.validateCoordinates(0, -181)).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      jest.doMock('../../config/environment.js', () => ({
        config: { googleMapsApiKey: '' }
      }));

      expect(() => {
        new GeocodingService();
      }).toThrow('Google Maps API key is required for geocoding');
    });
  });
});