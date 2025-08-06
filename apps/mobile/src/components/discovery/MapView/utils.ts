import { LocationCoordinates } from '../../../services/locationService';
import { Business, MapRegion, MarkerCluster, MapClusteringConfig } from './types';

export class MapUtils {
  /**
   * Calculate the distance between two coordinates using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = MapUtils.toRadians(lat2 - lat1);
    const dLng = MapUtils.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(MapUtils.toRadians(lat1)) * Math.cos(MapUtils.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate appropriate zoom level based on radius
   */
  static calculateZoomLevel(radiusKm: number): { latitudeDelta: number; longitudeDelta: number } {
    const earthCircumference = 40075017; // Earth's circumference in meters
    const metersPerKm = 1000;
    const radiusMeters = radiusKm * metersPerKm;
    
    // Calculate deltas based on radius (rough approximation)
    const latitudeDelta = (radiusMeters * 2) / earthCircumference * 360;
    const longitudeDelta = latitudeDelta;

    return {
      latitudeDelta: Math.max(latitudeDelta, 0.001),
      longitudeDelta: Math.max(longitudeDelta, 0.001)
    };
  }

  /**
   * Get region bounds from coordinates with padding
   */
  static getBoundsFromCoordinates(
    coordinates: LocationCoordinates[],
    paddingPercent: number = 0.1
  ): MapRegion | null {
    if (coordinates.length === 0) return null;

    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;

    coordinates.forEach(coord => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    });

    const latitudeDelta = (maxLat - minLat) * (1 + paddingPercent);
    const longitudeDelta = (maxLng - minLng) * (1 + paddingPercent);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latitudeDelta, 0.01),
      longitudeDelta: Math.max(longitudeDelta, 0.01),
    };
  }

  /**
   * Check if a coordinate is within a region bounds
   */
  static isCoordinateInRegion(
    coordinate: LocationCoordinates,
    region: MapRegion
  ): boolean {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const halfLatDelta = latitudeDelta / 2;
    const halfLngDelta = longitudeDelta / 2;

    return (
      coordinate.latitude >= latitude - halfLatDelta &&
      coordinate.latitude <= latitude + halfLatDelta &&
      coordinate.longitude >= longitude - halfLngDelta &&
      coordinate.longitude <= longitude + halfLngDelta
    );
  }

  /**
   * Calculate the radius in kilometers for a given region
   */
  static getRadiusFromRegion(region: MapRegion): number {
    const { latitudeDelta, longitudeDelta } = region;
    const avgDelta = (latitudeDelta + longitudeDelta) / 2;
    
    // Rough conversion from degrees to kilometers
    return avgDelta * 111.32; // 1 degree ≈ 111.32 km
  }

  /**
   * Determine if clustering should be enabled based on zoom level
   */
  static shouldEnableClustering(region: MapRegion, businesses: Business[]): boolean {
    const radius = MapUtils.getRadiusFromRegion(region);
    const businessCount = businesses.length;
    
    // Enable clustering if:
    // 1. Radius is large (zoomed out)
    // 2. Many businesses in view
    // 3. High density of businesses
    const shouldCluster = 
      radius > 10 || // More than 10km radius
      businessCount > 10 || // More than 10 businesses
      (businessCount > 5 && radius > 5); // Medium density
    
    return shouldCluster;
  }

  /**
   * Simple clustering algorithm for business markers
   */
  static clusterBusinesses(
    businesses: Business[],
    region: MapRegion,
    config: Partial<MapClusteringConfig> = {}
  ): MarkerCluster[] {
    const defaultConfig: MapClusteringConfig = {
      radius: 50, // pixels
      maxZoom: 15,
      minZoom: 3,
      extent: 512,
      nodeSize: 64,
      algorithm: 'grid'
    };

    const clusterConfig = { ...defaultConfig, ...config };
    
    if (!MapUtils.shouldEnableClustering(region, businesses)) {
      return [];
    }

    const clusters: MarkerCluster[] = [];
    const processed = new Set<string>();
    
    businesses.forEach((business, index) => {
      if (processed.has(business.id)) return;
      
      const clusteredBusinesses: Business[] = [business];
      processed.add(business.id);
      
      // Find nearby businesses to cluster
      businesses.forEach((otherBusiness, otherIndex) => {
        if (index === otherIndex || processed.has(otherBusiness.id)) return;
        
        const distance = MapUtils.calculateDistance(
          business.coordinates.latitude,
          business.coordinates.longitude,
          otherBusiness.coordinates.latitude,
          otherBusiness.coordinates.longitude
        );
        
        // Cluster if within radius (convert pixels to approximate km)
        const radiusKm = clusterConfig.radius / 100; // Rough conversion
        if (distance <= radiusKm) {
          clusteredBusinesses.push(otherBusiness);
          processed.add(otherBusiness.id);
        }
      });
      
      // Create cluster if multiple businesses or single business marker
      if (clusteredBusinesses.length > 1) {
        const centerLat = clusteredBusinesses.reduce((sum, b) => sum + b.coordinates.latitude, 0) / clusteredBusinesses.length;
        const centerLng = clusteredBusinesses.reduce((sum, b) => sum + b.coordinates.longitude, 0) / clusteredBusinesses.length;
        
        clusters.push({
          id: `cluster-${Date.now()}-${index}`,
          coordinate: {
            latitude: centerLat,
            longitude: centerLng,
          },
          pointCount: clusteredBusinesses.length,
          businesses: clusteredBusinesses,
          geometry: {
            coordinates: [centerLng, centerLat],
          },
        });
      }
    });
    
    return clusters;
  }

  /**
   * Format distance for display
   */
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000);
      return `${meters}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  }

  /**
   * Format rating for display
   */
  static formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  /**
   * Get business category icon
   */
  static getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
      'restaurant': '🍽️',
      'cafe': '☕',
      'bar': '🍺',
      'shop': '🛍️',
      'grocery': '🛒',
      'gas_station': '⛽',
      'hospital': '🏥',
      'pharmacy': '💊',
      'bank': '🏦',
      'hotel': '🏨',
      'gym': '💪',
      'beauty': '💅',
      'automotive': '🔧',
      'education': '🎓',
      'entertainment': '🎬',
      'professional': '💼',
      'home_services': '🏠',
      'pet_services': '🐕',
      'other': '📍',
    };

    return iconMap[category.toLowerCase()] || iconMap.other;
  }

  /**
   * Get business category color
   */
  static getCategoryColor(category: string): string {
    const colorMap: Record<string, string> = {
      'restaurant': '#FF6B6B',
      'cafe': '#8B4513',
      'bar': '#FFD93D',
      'shop': '#FF8C42',
      'grocery': '#6BCF7F',
      'gas_station': '#4ECDC4',
      'hospital': '#FF6B9D',
      'pharmacy': '#FF6B9D',
      'bank': '#4D96FF',
      'hotel': '#9B59B6',
      'gym': '#FF8C42',
      'beauty': '#FFB6C1',
      'automotive': '#95A5A6',
      'education': '#3498DB',
      'entertainment': '#E74C3C',
      'professional': '#2ECC71',
      'home_services': '#F39C12',
      'pet_services': '#9B59B6',
      'other': '#7F8C8D',
    };

    return colorMap[category.toLowerCase()] || colorMap.other;
  }

  /**
   * Calculate marker size based on zoom level
   */
  static getMarkerSize(region: MapRegion): 'small' | 'medium' | 'large' {
    const radius = MapUtils.getRadiusFromRegion(region);
    
    if (radius > 50) return 'small';
    if (radius > 10) return 'medium';
    return 'large';
  }

  /**
   * Throttle function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return function(this: any, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Validate map region
   */
  static validateRegion(region: MapRegion): boolean {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    
    return (
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      latitudeDelta > 0 && latitudeDelta <= 180 &&
      longitudeDelta > 0 && longitudeDelta <= 360
    );
  }

  /**
   * Create initial region from user location
   */
  static createInitialRegion(
    userLocation: LocationCoordinates,
    radiusKm: number = 5
  ): MapRegion {
    const { latitudeDelta, longitudeDelta } = MapUtils.calculateZoomLevel(radiusKm);
    
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }

  /**
   * Generate map style based on theme
   */
  static generateMapStyle(theme: 'light' | 'dark' | 'auto' = 'light'): object[] {
    if (theme === 'dark') {
      return [
        {
          elementType: 'geometry',
          stylers: [{ color: '#212121' }],
        },
        {
          elementType: 'labels.icon',
          stylers: [{ visibility: 'off' }],
        },
        {
          elementType: 'labels.text.fill',
          stylers: [{ color: '#757575' }],
        },
        {
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#212121' }],
        },
        {
          featureType: 'administrative',
          elementType: 'geometry',
          stylers: [{ color: '#757575' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry.fill',
          stylers: [{ color: '#2c2c2c' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#000000' }],
        },
      ];
    }
    
    return []; // Default light theme
  }

  /**
   * Animate value with easing
   */
  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Check if two regions are significantly different
   */
  static hasSignificantRegionChange(
    oldRegion: MapRegion,
    newRegion: MapRegion,
    threshold: number = 0.001
  ): boolean {
    const latChange = Math.abs(oldRegion.latitude - newRegion.latitude);
    const lngChange = Math.abs(oldRegion.longitude - newRegion.longitude);
    const latDeltaChange = Math.abs(oldRegion.latitudeDelta - newRegion.latitudeDelta);
    const lngDeltaChange = Math.abs(oldRegion.longitudeDelta - newRegion.longitudeDelta);
    
    return (
      latChange > threshold ||
      lngChange > threshold ||
      latDeltaChange > threshold ||
      lngDeltaChange > threshold
    );
  }
}