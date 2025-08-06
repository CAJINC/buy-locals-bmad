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
export declare class GeocodingService {
    private apiKey;
    private baseUrl;
    private cache;
    private cacheTtl;
    constructor();
    geocodeAddress(address: string, city: string, state: string, zipCode: string): Promise<GeocodingResult>;
    reverseGeocode(lat: number, lng: number): Promise<GeocodingResult>;
    validateCoordinates(lat: number, lng: number): boolean;
    private extractAddressComponents;
}
//# sourceMappingURL=geocodingService.d.ts.map