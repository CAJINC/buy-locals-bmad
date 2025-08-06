import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'blocked' | 'unavailable';
}

export interface LocationSearchArea {
  center: LocationCoordinates;
  radius: number; // in kilometers
  bounds?: {
    northeast: LocationCoordinates;
    southwest: LocationCoordinates;
  };
}

class LocationService {
  private currentLocation: LocationCoordinates | null = null;
  private watchId: number | null = null;
  private locationUpdateCallbacks: ((location: LocationCoordinates) => void)[] = [];
  private isWatching = false;
  private lastLocationUpdate = 0;
  private readonly LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly HIGH_ACCURACY_TIMEOUT = 15000; // 15 seconds
  private readonly MAXIMUM_AGE = 60000; // 1 minute

  /**
   * Request location permissions with comprehensive error handling
   */
  async requestLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        return await this.requestAndroidLocationPermission();
      } else {
        return await this.requestIOSLocationPermission();
      }
    } catch (error) {
      console.error('Location permission request failed:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
      };
    }
  }

  /**
   * Android-specific permission handling
   */
  private async requestAndroidLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      const fineLocationPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Buy Locals needs access to your location to find nearby businesses.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      const status = fineLocationPermission === PermissionsAndroid.RESULTS.GRANTED;
      
      return {
        granted: status,
        canAskAgain: fineLocationPermission !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        status: status ? 'granted' : 'denied',
      };
    } catch (error) {
      console.error('Android location permission error:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
      };
    }
  }

  /**
   * iOS-specific permission handling
   */
  private async requestIOSLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      const permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      const currentStatus = await check(permission);
      
      if (currentStatus === RESULTS.GRANTED) {
        return {
          granted: true,
          canAskAgain: true,
          status: 'granted',
        };
      }

      if (currentStatus === RESULTS.BLOCKED) {
        return {
          granted: false,
          canAskAgain: false,
          status: 'blocked',
        };
      }

      const requestResult = await request(permission);
      
      return {
        granted: requestResult === RESULTS.GRANTED,
        canAskAgain: requestResult !== RESULTS.BLOCKED,
        status: requestResult === RESULTS.GRANTED ? 'granted' : 
                requestResult === RESULTS.BLOCKED ? 'blocked' : 'denied',
      };
    } catch (error) {
      console.error('iOS location permission error:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
      };
    }
  }

  /**
   * Get current location with high accuracy and comprehensive fallback strategies
   */
  async getCurrentLocation(highAccuracy = true): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: highAccuracy,
        timeout: this.HIGH_ACCURACY_TIMEOUT,
        maximumAge: this.MAXIMUM_AGE,
      };

      Geolocation.getCurrentPosition(
        (position) => {
          const location: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp,
          };

          // Assess location accuracy and quality
          const accuracyAssessment = this.assessLocationAccuracy(location);
          
          console.log('Location obtained:', {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            quality: accuracyAssessment.quality,
            isUsable: accuracyAssessment.isUsable,
          });

          // If location quality is too poor, try fallback strategies
          if (!accuracyAssessment.isUsable && highAccuracy) {
            console.log('Location accuracy too poor, trying fallback strategies...');
            this.executeLocationFallbackStrategy()
              .then(resolve)
              .catch(() => {
                // If all fallbacks fail, return the original location with warning
                console.warn('All location fallback strategies failed, using original location');
                this.currentLocation = location;
                this.lastLocationUpdate = Date.now();
                resolve(location);
              });
            return;
          }

          this.currentLocation = location;
          this.lastLocationUpdate = Date.now();
          resolve(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          
          // Execute fallback strategy based on error type
          this.handleLocationError(error, highAccuracy)
            .then(resolve)
            .catch(reject);
        },
        options
      );
    });
  }

  /**
   * Assess location accuracy and provide quality metrics
   */
  private assessLocationAccuracy(location: LocationCoordinates): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    isUsable: boolean;
    recommendation: string;
  } {
    const accuracy = location.accuracy;

    if (accuracy <= 10) {
      return {
        quality: 'excellent',
        isUsable: true,
        recommendation: 'High precision location suitable for all features'
      };
    } else if (accuracy <= 50) {
      return {
        quality: 'good',
        isUsable: true,
        recommendation: 'Good location accuracy for business search'
      };
    } else if (accuracy <= 100) {
      return {
        quality: 'fair',
        isUsable: true,
        recommendation: 'Moderate accuracy, may show businesses slightly out of range'
      };
    } else {
      return {
        quality: 'poor',
        isUsable: accuracy <= 1000, // Usable up to 1km accuracy
        recommendation: 'Poor accuracy, consider enabling high precision mode'
      };
    }
  }

  /**
   * Handle location errors with intelligent fallback strategies
   */
  private async handleLocationError(error: any, wasHighAccuracy: boolean): Promise<LocationCoordinates> {
    console.log('Handling location error:', { code: error.code, message: error.message });

    // Strategy 1: Try lower accuracy if high accuracy failed
    if (wasHighAccuracy && (error.code === 3 || error.code === 2)) { // TIMEOUT or POSITION_UNAVAILABLE
      console.log('Trying lower accuracy location...');
      try {
        return await this.getCurrentLocation(false);
      } catch (lowAccuracyError) {
        console.log('Lower accuracy also failed, trying cached location...');
      }
    }

    // Strategy 2: Use cached location if available and recent
    const cachedLocation = this.getCachedLocation();
    if (cachedLocation) {
      console.log('Using cached location as fallback');
      return cachedLocation;
    }

    // Strategy 3: Try passive location (background location)
    if (error.code === 3) { // TIMEOUT
      try {
        return await this.getPassiveLocation();
      } catch (passiveError) {
        console.log('Passive location failed:', passiveError);
      }
    }

    // Strategy 4: Use last known good location from storage
    try {
      const storedLocation = await this.getStoredLastLocation();
      if (storedLocation) {
        console.log('Using stored last known location as fallback');
        return storedLocation;
      }
    } catch (storageError) {
      console.log('Failed to get stored location:', storageError);
    }

    // All strategies failed
    throw new Error(this.getLocationErrorMessage(error.code));
  }

  /**
   * Execute comprehensive location fallback strategy
   */
  private async executeLocationFallbackStrategy(): Promise<LocationCoordinates> {
    const strategies = [
      // Strategy 1: Multiple quick attempts with different settings
      () => this.getLocationWithSettings({ enableHighAccuracy: false, timeout: 10000 }),
      () => this.getLocationWithSettings({ enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 }),
      
      // Strategy 2: Passive/background location
      () => this.getPassiveLocation(),
      
      // Strategy 3: Network-based location estimate
      () => this.getNetworkBasedLocation(),
    ];

    for (const [index, strategy] of strategies.entries()) {
      try {
        console.log(`Executing fallback strategy ${index + 1}...`);
        const location = await strategy();
        const assessment = this.assessLocationAccuracy(location);
        
        if (assessment.isUsable) {
          console.log(`Fallback strategy ${index + 1} succeeded with ${assessment.quality} quality`);
          return location;
        }
      } catch (error) {
        console.log(`Fallback strategy ${index + 1} failed:`, error);
      }
    }

    throw new Error('All location fallback strategies failed');
  }

  /**
   * Get location with custom settings
   */
  private getLocationWithSettings(options: any): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp,
          });
        },
        reject,
        options
      );
    });
  }

  /**
   * Get passive location (lower power consumption)
   */
  private async getPassiveLocation(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 600000, // 10 minutes
      };

      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp,
          });
        },
        reject,
        options
      );
    });
  }

  /**
   * Get network-based location estimate (IP-based)
   */
  private async getNetworkBasedLocation(): Promise<LocationCoordinates> {
    // In a real implementation, this could use IP geolocation services
    // For now, we'll simulate a network-based location
    throw new Error('Network-based location not implemented');
  }

  /**
   * Store last known good location for fallback
   */
  private async storeLastKnownLocation(location: LocationCoordinates): Promise<void> {
    try {
      // In React Native, you'd use AsyncStorage
      // await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(location));
      
      // For now, we'll just store in memory
      this.currentLocation = location;
    } catch (error) {
      console.warn('Failed to store last known location:', error);
    }
  }

  /**
   * Get stored last known location
   */
  private async getStoredLastLocation(): Promise<LocationCoordinates | null> {
    try {
      // In React Native, you'd use AsyncStorage
      // const stored = await AsyncStorage.getItem('lastKnownLocation');
      // return stored ? JSON.parse(stored) : null;
      
      // For now, return cached location
      return this.currentLocation;
    } catch (error) {
      console.warn('Failed to get stored location:', error);
      return null;
    }
  }

  /**
   * Enhanced location validation
   */
  private validateLocationCoordinates(location: LocationCoordinates): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Basic coordinate validation
    if (!this.isValidCoordinate(location.latitude, location.longitude)) {
      issues.push('Invalid coordinate range');
    }

    // Accuracy validation
    if (location.accuracy > 5000) { // 5km
      issues.push('Location accuracy too poor (>5km)');
    }

    // Timestamp validation
    const now = Date.now();
    const locationAge = now - location.timestamp;
    if (locationAge > 3600000) { // 1 hour
      issues.push('Location data too old (>1 hour)');
    }

    // Check for impossible movement (if we have previous location)
    if (this.currentLocation) {
      const distance = this.calculateDistance(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        location.latitude,
        location.longitude
      );
      
      const timeDiff = (location.timestamp - this.currentLocation.timestamp) / 1000; // seconds
      const maxSpeed = 200; // 200 km/h (faster than most ground transport)
      const maxPossibleDistance = (maxSpeed * timeDiff) / 3600; // km
      
      if (distance > maxPossibleDistance && timeDiff > 0) {
        issues.push('Impossible movement detected (teleportation)');
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get location with quality assessment and validation
   */
  async getValidatedCurrentLocation(): Promise<{
    location: LocationCoordinates;
    quality: string;
    validation: { isValid: boolean; issues: string[] };
  }> {
    const location = await this.getCurrentLocation();
    const assessment = this.assessLocationAccuracy(location);
    const validation = this.validateLocationCoordinates(location);

    // Store if valid
    if (validation.isValid && assessment.isUsable) {
      await this.storeLastKnownLocation(location);
    }

    return {
      location,
      quality: assessment.quality,
      validation
    };
  }

  /**
   * Start watching location changes for real-time updates
   */
  startLocationWatch(): void {
    if (this.isWatching) {
      console.log('Location watch already active');
      return;
    }

    const options = {
      enableHighAccuracy: false, // Use lower accuracy for continuous tracking
      timeout: 30000,
      maximumAge: this.LOCATION_UPDATE_INTERVAL,
      distanceFilter: 50, // Update only if moved 50+ meters
    };

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: LocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          timestamp: position.timestamp,
        };

        this.currentLocation = location;
        this.lastLocationUpdate = Date.now();

        // Notify all callbacks
        this.locationUpdateCallbacks.forEach(callback => {
          try {
            callback(location);
          } catch (error) {
            console.error('Location callback error:', error);
          }
        });
      },
      (error) => {
        console.error('Location watch error:', error);
        // Don't stop watching on errors, just log them
      },
      options
    );

    this.isWatching = true;
    console.log('Location watch started');
  }

  /**
   * Stop watching location changes
   */
  stopLocationWatch(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isWatching = false;
    console.log('Location watch stopped');
  }

  /**
   * Subscribe to location updates
   */
  subscribeToLocationUpdates(callback: (location: LocationCoordinates) => void): () => void {
    this.locationUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.locationUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.locationUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get cached location if available and recent
   */
  getCachedLocation(): LocationCoordinates | null {
    if (!this.currentLocation) return null;
    
    const age = Date.now() - this.lastLocationUpdate;
    if (age > this.MAXIMUM_AGE) {
      return null; // Location too old
    }
    
    return this.currentLocation;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Calculate bearing between two coordinates
   */
  calculateBearing(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLng = this.toRadians(lng2 - lng1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Generate search area bounds from center point and radius
   */
  generateSearchArea(
    center: LocationCoordinates,
    radiusKm: number
  ): LocationSearchArea {
    // Approximate degrees per km (varies by latitude)
    const latDegreePerKm = 1 / 111.32;
    const lngDegreePerKm = 1 / (111.32 * Math.cos(this.toRadians(center.latitude)));

    const latDelta = latDegreePerKm * radiusKm;
    const lngDelta = lngDegreePerKm * radiusKm;

    return {
      center,
      radius: radiusKm,
      bounds: {
        northeast: {
          latitude: center.latitude + latDelta,
          longitude: center.longitude + lngDelta,
          accuracy: center.accuracy,
          timestamp: center.timestamp,
        },
        southwest: {
          latitude: center.latitude - latDelta,
          longitude: center.longitude - lngDelta,
          accuracy: center.accuracy,
          timestamp: center.timestamp,
        },
      },
    };
  }

  /**
   * Check if location services are available
   */
  async isLocationAvailable(): Promise<boolean> {
    try {
      const permission = await this.requestLocationPermission();
      return permission.granted;
    } catch {
      return false;
    }
  }

  /**
   * Utility functions
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate coordinate values
   */
  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' &&
      !isNaN(latitude) && 
      !isNaN(longitude) &&
      latitude >= -90 && 
      latitude <= 90 && 
      longitude >= -180 && 
      longitude <= 180
    );
  }

  private getLocationErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Location access denied. Please enable location permissions in settings.';
      case 2:
        return 'Location unavailable. Please check your device\'s location settings.';
      case 3:
        return 'Location request timed out. Please try again.';
      case 5:
        return 'Location request cancelled.';
      default:
        return 'An unknown location error occurred.';
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopLocationWatch();
    this.locationUpdateCallbacks = [];
    this.currentLocation = null;
  }
}

export const locationService = new LocationService();