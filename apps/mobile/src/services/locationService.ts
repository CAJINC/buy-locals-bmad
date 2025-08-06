import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationAccuracyAssessment {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  isUsable: boolean;
  recommendation: string;
  confidenceLevel: number; // 0-100
  accuracyIndicator: 'high' | 'medium' | 'low';
}

export interface LocationCacheEntry {
  location: LocationCoordinates;
  cacheTimestamp: number;
  source: 'gps' | 'network' | 'passive' | 'cached';
  reliability: number; // 0-100
}

export interface BackgroundLocationOptions {
  enableHighAccuracy: boolean;
  distanceFilter: number;
  interval: number;
  fastestInterval: number;
  maxWaitTime: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'blocked' | 'unavailable';
  backgroundLocationGranted?: boolean;
  preciseLocationGranted?: boolean;
  whenInUseGranted?: boolean;
  alwaysLocationGranted?: boolean;
}

export interface LocationSearchArea {
  center: LocationCoordinates;
  radius: number; // in kilometers
  bounds?: {
    northeast: LocationCoordinates;
    southwest: LocationCoordinates;
  };
}

export interface ManualLocationRefinement {
  originalLocation: LocationCoordinates;
  refinedLocation: LocationCoordinates;
  userConfidence: number; // 0-100 user's confidence in the refinement
  refinementMethod: 'manual_pin' | 'address_search' | 'landmark_selection' | 'map_tap';
  refinementTimestamp: number;
  notes?: string;
}

export interface LocationUpdateFrequencyConfig {
  interval: number; // milliseconds between updates
  distanceFilter: number; // minimum distance in meters before triggering update
  batteryOptimized: boolean;
  adaptiveFrequency: boolean; // adjust frequency based on movement patterns
  maxFrequency: number; // maximum updates per minute
  minFrequency: number; // minimum updates per minute
}

export interface LocationServiceUnavailableHandling {
  fallbackStrategy: 'cached' | 'network' | 'manual' | 'none';
  userPromptRequired: boolean;
  graceDegradation: boolean;
  serviceType: 'gps' | 'network' | 'geocoding' | 'all';
  estimatedDowntime?: number; // milliseconds
  alternativeOptions: string[];
}

export interface LocationPermissionDeniedFlow {
  denialType: 'soft' | 'hard' | 'system_settings';
  canRetry: boolean;
  fallbackOptions: ('ip_location' | 'manual_entry' | 'zip_code' | 'city_selection')[];
  userEducationShown: boolean;
  systemSettingsPrompted: boolean;
  retryAttempts: number;
  maxRetryAttempts: number;
}

class LocationService {
  private currentLocation: LocationCoordinates | null = null;
  private watchId: number | null = null;
  private backgroundWatchId: number | null = null;
  private locationUpdateCallbacks: ((location: LocationCoordinates) => void)[] = [];
  private backgroundLocationCallbacks: ((location: LocationCoordinates) => void)[] = [];
  private isWatching = false;
  private isBackgroundWatching = false;
  private lastLocationUpdate = 0;
  private locationCache: Map<string, LocationCacheEntry> = new Map();
  private appState: AppStateStatus = AppState.currentState;
  
  // Enhanced location accuracy and fallback management
  private locationRefinements: Map<string, ManualLocationRefinement> = new Map();
  private frequencyConfig: LocationUpdateFrequencyConfig;
  private permissionDenialCount = 0;
  private lastPermissionRequest = 0;
  private serviceUnavailableHandling: Map<string, LocationServiceUnavailableHandling> = new Map();
  private adaptiveFrequencyData: {
    averageSpeed: number;
    movementPattern: 'stationary' | 'walking' | 'driving' | 'transit';
    lastMovementDetected: number;
    locationHistory: Array<{ location: LocationCoordinates; timestamp: number }>;
  } = {
    averageSpeed: 0,
    movementPattern: 'stationary',
    lastMovementDetected: 0,
    locationHistory: []
  };
  
  // Configuration constants
  private readonly LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly BACKGROUND_UPDATE_INTERVAL = 30000; // 30 seconds
  private readonly HIGH_ACCURACY_TIMEOUT = 15000; // 15 seconds
  private readonly MAXIMUM_AGE = 60000; // 1 minute
  private readonly CACHE_EXPIRY_TIME = 300000; // 5 minutes
  private readonly STORAGE_KEY_LAST_LOCATION = '@buy_locals:last_location';
  private readonly STORAGE_KEY_LOCATION_CACHE = '@buy_locals:location_cache';
  private readonly MAX_CACHE_ENTRIES = 20;

  constructor() {
    // Initialize app state monitoring
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    this.initializeLocationCache();
    
    // Initialize frequency configuration with battery-optimized defaults
    this.frequencyConfig = {
      interval: this.LOCATION_UPDATE_INTERVAL,
      distanceFilter: 50, // 50 meters
      batteryOptimized: true,
      adaptiveFrequency: true,
      maxFrequency: 6, // 6 updates per minute max
      minFrequency: 1  // 1 update per minute min
    };
    
    // Initialize service unavailable handling
    this.initializeServiceUnavailableHandling();
  }

  /**
   * Initialize location cache from storage
   */
  private async initializeLocationCache(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.STORAGE_KEY_LOCATION_CACHE);
      if (cacheData) {
        const cache = JSON.parse(cacheData) as { [key: string]: LocationCacheEntry };
        Object.entries(cache).forEach(([key, entry]) => {
          // Only restore non-expired cache entries
          if (Date.now() - entry.cacheTimestamp < this.CACHE_EXPIRY_TIME) {
            this.locationCache.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to initialize location cache:', error);
    }
  }

  /**
   * Initialize service unavailable handling strategies
   */
  private initializeServiceUnavailableHandling(): void {
    // GPS service unavailable handling
    this.serviceUnavailableHandling.set('gps', {
      fallbackStrategy: 'network',
      userPromptRequired: false,
      graceDegradation: true,
      serviceType: 'gps',
      alternativeOptions: ['Use IP-based location', 'Enter location manually', 'Browse by city']
    });

    // Network service unavailable handling
    this.serviceUnavailableHandling.set('network', {
      fallbackStrategy: 'cached',
      userPromptRequired: true,
      graceDegradation: true,
      serviceType: 'network',
      alternativeOptions: ['Use cached location', 'Enter ZIP code', 'Try again later']
    });

    // Geocoding service unavailable handling
    this.serviceUnavailableHandling.set('geocoding', {
      fallbackStrategy: 'manual',
      userPromptRequired: true,
      graceDegradation: false,
      serviceType: 'geocoding',
      alternativeOptions: ['Enter coordinates manually', 'Use map picker', 'Skip location entry']
    });
  }

  /**
   * Handle app state changes for background location management
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.appState;
    this.appState = nextAppState;

    // Handle background/foreground transitions
    if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
      console.log('App moved to background');
      this.handleBackgroundTransition();
    } else if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App moved to foreground');
      this.handleForegroundTransition();
    }
  }

  /**
   * Handle transition to background mode
   */
  private handleBackgroundTransition(): void {
    // Continue background location if enabled
    if (this.isWatching && !this.isBackgroundWatching) {
      this.startBackgroundLocationUpdates({
        enableHighAccuracy: false,
        distanceFilter: 100,
        interval: this.BACKGROUND_UPDATE_INTERVAL,
        fastestInterval: 15000,
        maxWaitTime: 60000
      });
    }
  }

  /**
   * Handle transition to foreground mode
   */
  private handleForegroundTransition(): void {
    // Stop background updates and resume foreground updates if needed
    if (this.isBackgroundWatching) {
      this.stopBackgroundLocationUpdates();
    }
    
    // Resume normal location watching if it was active
    if (this.isWatching) {
      this.startLocationWatch();
    }
  }

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
   * iOS-specific permission handling with background location support
   */
  private async requestIOSLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      const whenInUsePermission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      const alwaysPermission = PERMISSIONS.IOS.LOCATION_ALWAYS;
      
      // Check current permissions
      const whenInUseStatus = await check(whenInUsePermission);
      const alwaysStatus = await check(alwaysPermission);
      
      let result: LocationPermissionStatus = {
        granted: false,
        canAskAgain: true,
        status: 'denied',
        whenInUseGranted: whenInUseStatus === RESULTS.GRANTED,
        alwaysLocationGranted: alwaysStatus === RESULTS.GRANTED,
        backgroundLocationGranted: alwaysStatus === RESULTS.GRANTED
      };

      // If already granted when in use, return success
      if (whenInUseStatus === RESULTS.GRANTED) {
        result.granted = true;
        result.status = 'granted';
        return result;
      }

      // If blocked, return blocked status
      if (whenInUseStatus === RESULTS.BLOCKED) {
        result.status = 'blocked';
        result.canAskAgain = false;
        return result;
      }

      // Request when in use permission first
      const whenInUseRequestResult = await request(whenInUsePermission);
      
      result.granted = whenInUseRequestResult === RESULTS.GRANTED;
      result.whenInUseGranted = whenInUseRequestResult === RESULTS.GRANTED;
      result.canAskAgain = whenInUseRequestResult !== RESULTS.BLOCKED;
      result.status = whenInUseRequestResult === RESULTS.GRANTED ? 'granted' : 
                      whenInUseRequestResult === RESULTS.BLOCKED ? 'blocked' : 'denied';

      return result;
    } catch (error) {
      console.error('iOS location permission error:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
        whenInUseGranted: false,
        alwaysLocationGranted: false,
        backgroundLocationGranted: false
      };
    }
  }

  /**
   * Request background location permission (iOS Always permission)
   */
  async requestBackgroundLocationPermission(): Promise<LocationPermissionStatus> {
    if (Platform.OS === 'android') {
      return await this.requestAndroidBackgroundLocationPermission();
    } else {
      return await this.requestIOSBackgroundLocationPermission();
    }
  }

  /**
   * Request iOS background location permission
   */
  private async requestIOSBackgroundLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      const alwaysPermission = PERMISSIONS.IOS.LOCATION_ALWAYS;
      const alwaysStatus = await check(alwaysPermission);
      
      if (alwaysStatus === RESULTS.GRANTED) {
        return {
          granted: true,
          status: 'granted',
          canAskAgain: true,
          backgroundLocationGranted: true,
          alwaysLocationGranted: true
        };
      }

      if (alwaysStatus === RESULTS.BLOCKED) {
        return {
          granted: false,
          status: 'blocked',
          canAskAgain: false,
          backgroundLocationGranted: false,
          alwaysLocationGranted: false
        };
      }

      const requestResult = await request(alwaysPermission);
      
      return {
        granted: requestResult === RESULTS.GRANTED,
        status: requestResult === RESULTS.GRANTED ? 'granted' : 
                requestResult === RESULTS.BLOCKED ? 'blocked' : 'denied',
        canAskAgain: requestResult !== RESULTS.BLOCKED,
        backgroundLocationGranted: requestResult === RESULTS.GRANTED,
        alwaysLocationGranted: requestResult === RESULTS.GRANTED
      };
    } catch (error) {
      console.error('iOS background location permission error:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
        backgroundLocationGranted: false,
        alwaysLocationGranted: false
      };
    }
  }

  /**
   * Request Android background location permission
   */
  private async requestAndroidBackgroundLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      if (Platform.Version >= 29) {
        // Android 10+ requires separate background location permission
        const backgroundPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Permission',
            message: 'Buy Locals needs background location access to provide location-based services when the app is closed.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        return {
          granted: backgroundPermission === PermissionsAndroid.RESULTS.GRANTED,
          canAskAgain: backgroundPermission !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
          status: backgroundPermission === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
          backgroundLocationGranted: backgroundPermission === PermissionsAndroid.RESULTS.GRANTED
        };
      } else {
        // Android < 10 doesn't have separate background permission
        return {
          granted: true,
          canAskAgain: true,
          status: 'granted',
          backgroundLocationGranted: true
        };
      }
    } catch (error) {
      console.error('Android background location permission error:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unavailable',
        backgroundLocationGranted: false
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
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
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

          this.storeLastKnownLocation(location, 'gps');
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
   * Assess location accuracy and provide comprehensive quality metrics
   */
  private assessLocationAccuracy(location: LocationCoordinates): LocationAccuracyAssessment {
    const accuracy = location.accuracy;
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    let confidenceLevel: number;
    let accuracyIndicator: 'high' | 'medium' | 'low';
    let recommendation: string;
    let isUsable: boolean;

    if (accuracy <= 10) {
      quality = 'excellent';
      confidenceLevel = 95;
      accuracyIndicator = 'high';
      isUsable = true;
      recommendation = 'High precision GPS location suitable for all features';
    } else if (accuracy <= 50) {
      quality = 'good';
      confidenceLevel = 85;
      accuracyIndicator = 'high';
      isUsable = true;
      recommendation = 'Good location accuracy for business search and navigation';
    } else if (accuracy <= 100) {
      quality = 'fair';
      confidenceLevel = 70;
      accuracyIndicator = 'medium';
      isUsable = true;
      recommendation = 'Moderate accuracy, may show businesses slightly out of range';
    } else if (accuracy <= 500) {
      quality = 'poor';
      confidenceLevel = 50;
      accuracyIndicator = 'low';
      isUsable = true;
      recommendation = 'Poor accuracy, recommend moving to open area for better signal';
    } else {
      quality = 'poor';
      confidenceLevel = 25;
      accuracyIndicator = 'low';
      isUsable = accuracy <= 1000; // Usable up to 1km accuracy
      recommendation = 'Very poor accuracy, consider enabling high precision mode or checking location settings';
    }

    return {
      quality,
      isUsable,
      recommendation,
      confidenceLevel,
      accuracyIndicator
    };
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
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
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
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          });
        },
        reject,
        options
      );
    });
  }

  /**
   * Get network-based location estimate (IP-based) with multiple fallback providers
   */
  private async getNetworkBasedLocation(): Promise<LocationCoordinates> {
    const providers = [
      'https://ipapi.co/json/',
      'https://get.geojs.io/v1/ip/geo.json',
      'https://ipinfo.io/json'
    ];

    for (const provider of providers) {
      try {
        console.log(`Attempting IP-based location from: ${provider}`);
        const response = await fetch(provider, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BuyLocals/1.0'
          }
        });

        if (!response.ok) {
          console.log(`Provider ${provider} failed with status: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const location = this.parseIPLocationResponse(data, provider);
        
        if (location) {
          console.log(`Successfully obtained IP-based location from ${provider}`);
          await this.storeLastKnownLocation(location, 'network');
          return location;
        }
      } catch (error) {
        console.log(`IP geolocation provider ${provider} failed:`, error);
        continue;
      }
    }

    throw new Error('All IP-based location providers failed');
  }

  /**
   * Parse IP geolocation response from different providers
   */
  private parseIPLocationResponse(data: any, provider: string): LocationCoordinates | null {
    try {
      let latitude: number;
      let longitude: number;
      let accuracy = 5000; // Default 5km accuracy for IP-based location

      // Parse based on provider format
      if (provider.includes('ipapi.co')) {
        latitude = parseFloat(data.latitude);
        longitude = parseFloat(data.longitude);
      } else if (provider.includes('geojs.io')) {
        latitude = parseFloat(data.latitude);
        longitude = parseFloat(data.longitude);
      } else if (provider.includes('ipinfo.io')) {
        const [lat, lng] = data.loc.split(',');
        latitude = parseFloat(lat);
        longitude = parseFloat(lng);
      } else {
        return null;
      }

      // Validate coordinates
      if (!this.isValidCoordinate(latitude, longitude)) {
        console.warn('Invalid coordinates from IP geolocation:', { latitude, longitude });
        return null;
      }

      return {
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
        altitude: undefined,
        altitudeAccuracy: undefined,
        heading: undefined,
        speed: undefined,
      };
    } catch (error) {
      console.error('Failed to parse IP geolocation response:', error);
      return null;
    }
  }

  /**
   * Store last known good location with comprehensive caching
   */
  private async storeLastKnownLocation(location: LocationCoordinates, source: string = 'gps'): Promise<void> {
    try {
      // Store in memory
      this.currentLocation = location;
      this.lastLocationUpdate = Date.now();

      // Create cache entry
      const cacheEntry: LocationCacheEntry = {
        location,
        cacheTimestamp: Date.now(),
        source: source as 'gps' | 'network' | 'passive' | 'cached',
        reliability: this.calculateLocationReliability(location, source)
      };

      // Store in cache with location-based key
      const cacheKey = this.generateLocationCacheKey(location);
      this.locationCache.set(cacheKey, cacheEntry);

      // Persist to AsyncStorage
      await AsyncStorage.setItem(this.STORAGE_KEY_LAST_LOCATION, JSON.stringify(location));
      
      // Persist cache (limited entries to prevent storage bloat)
      await this.persistLocationCache();
      
    } catch (error) {
      console.warn('Failed to store last known location:', error);
    }
  }

  /**
   * Calculate location reliability score
   */
  private calculateLocationReliability(location: LocationCoordinates, source: string): number {
    let baseScore = 50;
    
    // Accuracy factor (0-40 points)
    if (location.accuracy <= 10) baseScore += 40;
    else if (location.accuracy <= 50) baseScore += 30;
    else if (location.accuracy <= 100) baseScore += 20;
    else if (location.accuracy <= 500) baseScore += 10;
    
    // Source factor (0-30 points)
    switch (source) {
      case 'gps': baseScore += 30; break;
      case 'network': baseScore += 20; break;
      case 'passive': baseScore += 15; break;
      case 'cached': baseScore += 10; break;
    }
    
    // Age factor (0-30 points)
    const age = Date.now() - location.timestamp;
    if (age < 30000) baseScore += 30; // < 30 seconds
    else if (age < 300000) baseScore += 20; // < 5 minutes
    else if (age < 1800000) baseScore += 10; // < 30 minutes
    
    return Math.min(100, Math.max(0, baseScore));
  }

  /**
   * Generate cache key for location
   */
  private generateLocationCacheKey(location: LocationCoordinates): string {
    // Round to ~100m precision for cache efficiency
    const lat = Math.round(location.latitude * 1000) / 1000;
    const lng = Math.round(location.longitude * 1000) / 1000;
    return `${lat},${lng}`;
  }

  /**
   * Persist location cache to storage
   */
  private async persistLocationCache(): Promise<void> {
    try {
      // Limit cache size
      if (this.locationCache.size > this.MAX_CACHE_ENTRIES) {
        const entries = Array.from(this.locationCache.entries());
        // Sort by timestamp and keep most recent
        entries.sort((a, b) => b[1].cacheTimestamp - a[1].cacheTimestamp);
        
        this.locationCache.clear();
        entries.slice(0, this.MAX_CACHE_ENTRIES).forEach(([key, entry]) => {
          this.locationCache.set(key, entry);
        });
      }

      const cacheObject = Object.fromEntries(this.locationCache);
      await AsyncStorage.setItem(this.STORAGE_KEY_LOCATION_CACHE, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to persist location cache:', error);
    }
  }

  /**
   * Get stored last known location with cache validation
   */
  private async getStoredLastLocation(): Promise<LocationCoordinates | null> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY_LAST_LOCATION);
      if (!stored) return this.currentLocation;
      
      const location: LocationCoordinates = JSON.parse(stored);
      
      // Validate stored location isn't too old
      const age = Date.now() - location.timestamp;
      if (age > this.CACHE_EXPIRY_TIME) {
        console.log('Stored location too old, discarding');
        return this.currentLocation;
      }
      
      return location;
    } catch (error) {
      console.warn('Failed to get stored location:', error);
      return this.currentLocation;
    }
  }

  /**
   * Get best cached location near given coordinates
   */
  getBestCachedLocation(nearLocation?: LocationCoordinates): LocationCacheEntry | null {
    if (this.locationCache.size === 0) return null;
    
    const cacheEntries = Array.from(this.locationCache.values());
    
    // Filter out expired entries
    const validEntries = cacheEntries.filter(entry => {
      const age = Date.now() - entry.cacheTimestamp;
      return age < this.CACHE_EXPIRY_TIME;
    });
    
    if (validEntries.length === 0) return null;
    
    if (!nearLocation) {
      // Return highest reliability entry
      return validEntries.reduce((best, current) => 
        current.reliability > best.reliability ? current : best
      );
    }
    
    // Return closest high-reliability entry
    let bestEntry = validEntries[0];
    let bestScore = 0;
    
    validEntries.forEach(entry => {
      const distance = this.calculateDistance(
        nearLocation.latitude, nearLocation.longitude,
        entry.location.latitude, entry.location.longitude
      );
      
      // Score based on reliability and proximity (closer is better)
      const proximityScore = Math.max(0, 100 - distance * 10); // 10 points per km penalty
      const totalScore = (entry.reliability * 0.7) + (proximityScore * 0.3);
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestEntry = entry;
      }
    });
    
    return bestEntry;
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
   * Start watching location changes for real-time updates with battery optimization
   */
  startLocationWatch(highAccuracy: boolean = false): void {
    if (this.isWatching) {
      console.log('Location watch already active');
      return;
    }

    const options = {
      enableHighAccuracy: highAccuracy || !this.frequencyConfig.batteryOptimized,
      timeout: 30000,
      maximumAge: this.frequencyConfig.interval,
      distanceFilter: this.frequencyConfig.distanceFilter,
      interval: this.frequencyConfig.interval,
      fastestInterval: Math.max(5000, this.frequencyConfig.interval / 3),
    };

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: LocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          timestamp: position.timestamp,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
        };

        // Validate location before processing
        const validation = this.validateLocationCoordinates(location);
        if (!validation.isValid) {
          console.warn('Invalid location received:', validation.issues);
          return;
        }

        // Store location with caching
        this.storeLastKnownLocation(location, 'gps');

        // Analyze movement pattern for adaptive frequency
        this.analyzeMovementPatternAndAdjustFrequency(location);

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
        this.handleLocationWatchError(error);
      },
      options
    );

    this.isWatching = true;
    console.log('Location watch started');
  }

  /**
   * Handle location watch errors with intelligent recovery
   */
  private handleLocationWatchError(error: any): void {
    console.log('Handling location watch error:', { code: error.code, message: error.message });
    
    // Don't stop watching immediately, try recovery strategies
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        console.error('Location permission denied during watch');
        this.stopLocationWatch();
        break;
      
      case 2: // POSITION_UNAVAILABLE
        console.warn('Location temporarily unavailable, continuing watch');
        // Don't stop watching, GPS might recover
        break;
        
      case 3: // TIMEOUT
        console.warn('Location timeout, continuing watch with reduced accuracy');
        // Could restart with lower accuracy settings
        break;
        
      default:
        console.warn('Unknown location error, continuing watch');
        break;
    }
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
   * Start background location updates for improved user experience
   */
  async startBackgroundLocationUpdates(options?: BackgroundLocationOptions): Promise<boolean> {
    try {
      // Check background location permission
      const backgroundPermission = await this.requestBackgroundLocationPermission();
      if (!backgroundPermission.granted) {
        console.warn('Background location permission not granted');
        return false;
      }

      if (this.isBackgroundWatching) {
        console.log('Background location watch already active');
        return true;
      }

      const defaultOptions: BackgroundLocationOptions = {
        enableHighAccuracy: false,
        distanceFilter: 100,
        interval: this.BACKGROUND_UPDATE_INTERVAL,
        fastestInterval: 15000,
        maxWaitTime: 60000
      };

      const watchOptions = { ...defaultOptions, ...options };

      this.backgroundWatchId = Geolocation.watchPosition(
        (position) => {
          const location: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          };

          // Store background location
          this.storeLastKnownLocation(location, 'passive');

          // Notify background callbacks
          this.backgroundLocationCallbacks.forEach(callback => {
            try {
              callback(location);
            } catch (error) {
              console.error('Background location callback error:', error);
            }
          });
        },
        (error) => {
          console.error('Background location error:', error);
        },
        {
          enableHighAccuracy: watchOptions.enableHighAccuracy,
          timeout: 60000,
          maximumAge: watchOptions.interval,
          distanceFilter: watchOptions.distanceFilter,
          interval: watchOptions.interval,
          fastestInterval: watchOptions.fastestInterval,
        }
      );

      this.isBackgroundWatching = true;
      console.log('Background location updates started');
      return true;

    } catch (error) {
      console.error('Failed to start background location updates:', error);
      return false;
    }
  }

  /**
   * Stop background location updates
   */
  stopBackgroundLocationUpdates(): void {
    if (this.backgroundWatchId !== null) {
      Geolocation.clearWatch(this.backgroundWatchId);
      this.backgroundWatchId = null;
    }
    this.isBackgroundWatching = false;
    console.log('Background location updates stopped');
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
   * Subscribe to background location updates
   */
  subscribeToBackgroundLocationUpdates(callback: (location: LocationCoordinates) => void): () => void {
    this.backgroundLocationCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.backgroundLocationCallbacks.indexOf(callback);
      if (index > -1) {
        this.backgroundLocationCallbacks.splice(index, 1);
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
   * Check if location services are available with comprehensive validation
   */
  async isLocationAvailable(): Promise<{
    available: boolean;
    permission: LocationPermissionStatus;
    gpsEnabled: boolean;
    networkLocationEnabled: boolean;
  }> {
    try {
      const permission = await this.requestLocationPermission();
      
      // Basic availability check
      const available = permission.granted;
      
      return {
        available,
        permission,
        gpsEnabled: available, // Simplified - would need native module for detailed GPS status
        networkLocationEnabled: available // Simplified - would need native module for network location status
      };
    } catch (error) {
      console.error('Location availability check failed:', error);
      return {
        available: false,
        permission: {
          granted: false,
          canAskAgain: false,
          status: 'unavailable'
        },
        gpsEnabled: false,
        networkLocationEnabled: false
      };
    }
  }

  /**
   * Get comprehensive location status including accuracy and confidence levels
   */
  async getLocationStatus(): Promise<{
    hasLocation: boolean;
    location: LocationCoordinates | null;
    accuracy: LocationAccuracyAssessment | null;
    cacheStatus: {
      hasCache: boolean;
      cacheAge: number;
      cacheEntries: number;
    };
    permission: LocationPermissionStatus;
    isWatching: boolean;
    isBackgroundWatching: boolean;
  }> {
    const permission = await this.requestLocationPermission();
    const location = this.getCachedLocation();
    const accuracy = location ? this.assessLocationAccuracy(location) : null;
    
    return {
      hasLocation: location !== null,
      location,
      accuracy,
      cacheStatus: {
        hasCache: this.locationCache.size > 0,
        cacheAge: location ? Date.now() - this.lastLocationUpdate : 0,
        cacheEntries: this.locationCache.size
      },
      permission,
      isWatching: this.isWatching,
      isBackgroundWatching: this.isBackgroundWatching
    };
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
   * Manual location refinement for inaccurate GPS
   */
  async refineLocationManually(
    originalLocation: LocationCoordinates,
    refinedLocation: LocationCoordinates,
    method: 'manual_pin' | 'address_search' | 'landmark_selection' | 'map_tap',
    userConfidence: number,
    notes?: string
  ): Promise<LocationCoordinates> {
    try {
      const refinement: ManualLocationRefinement = {
        originalLocation,
        refinedLocation,
        userConfidence,
        refinementMethod: method,
        refinementTimestamp: Date.now(),
        notes
      };

      // Generate refinement key
      const refinementKey = this.generateLocationCacheKey(originalLocation);
      this.locationRefinements.set(refinementKey, refinement);

      // Store the refined location as current location
      this.currentLocation = refinedLocation;
      this.lastLocationUpdate = Date.now();

      // Store in cache with high reliability score due to manual refinement
      await this.storeLastKnownLocation(refinedLocation, 'gps');

      // Update location cache with refined entry
      const cacheEntry: LocationCacheEntry = {
        location: refinedLocation,
        cacheTimestamp: Date.now(),
        source: 'gps',
        reliability: Math.min(100, 80 + (userConfidence * 0.2)) // Base 80 + user confidence factor
      };

      this.locationCache.set(this.generateLocationCacheKey(refinedLocation), cacheEntry);

      console.log('Location manually refined:', {
        method,
        userConfidence,
        improvement: this.calculateDistance(
          originalLocation.latitude, originalLocation.longitude,
          refinedLocation.latitude, refinedLocation.longitude
        )
      });

      // Notify callbacks about the refined location
      this.locationUpdateCallbacks.forEach(callback => {
        try {
          callback(refinedLocation);
        } catch (error) {
          console.error('Location refinement callback error:', error);
        }
      });

      return refinedLocation;
    } catch (error) {
      console.error('Failed to refine location manually:', error);
      throw error;
    }
  }

  /**
   * Get location refinement history
   */
  getLocationRefinementHistory(): ManualLocationRefinement[] {
    return Array.from(this.locationRefinements.values())
      .sort((a, b) => b.refinementTimestamp - a.refinementTimestamp);
  }

  /**
   * Configure location update frequency with adaptive management
   */
  configureLocationUpdateFrequency(config: Partial<LocationUpdateFrequencyConfig>): void {
    this.frequencyConfig = { ...this.frequencyConfig, ...config };
    
    console.log('Location update frequency configured:', this.frequencyConfig);

    // If adaptive frequency is enabled, start movement pattern detection
    if (this.frequencyConfig.adaptiveFrequency) {
      this.startMovementPatternDetection();
    } else {
      this.stopMovementPatternDetection();
    }

    // Restart location watching with new frequency if currently active
    if (this.isWatching) {
      this.stopLocationWatch();
      this.startLocationWatch();
    }
  }

  /**
   * Start movement pattern detection for adaptive frequency
   */
  private startMovementPatternDetection(): void {
    // Clear existing movement data
    this.adaptiveFrequencyData.locationHistory = [];
    this.adaptiveFrequencyData.lastMovementDetected = Date.now();
    
    console.log('Movement pattern detection started');
  }

  /**
   * Stop movement pattern detection
   */
  private stopMovementPatternDetection(): void {
    this.adaptiveFrequencyData.locationHistory = [];
    console.log('Movement pattern detection stopped');
  }

  /**
   * Analyze movement pattern and adjust update frequency
   */
  private analyzeMovementPatternAndAdjustFrequency(location: LocationCoordinates): void {
    if (!this.frequencyConfig.adaptiveFrequency) return;

    const now = Date.now();
    const historyEntry = { location, timestamp: now };
    
    // Add to movement history (keep last 10 entries)
    this.adaptiveFrequencyData.locationHistory.push(historyEntry);
    if (this.adaptiveFrequencyData.locationHistory.length > 10) {
      this.adaptiveFrequencyData.locationHistory.shift();
    }

    // Analyze movement pattern if we have enough history
    if (this.adaptiveFrequencyData.locationHistory.length >= 3) {
      const speeds: number[] = [];
      const history = this.adaptiveFrequencyData.locationHistory;

      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        
        const distance = this.calculateDistance(
          prev.location.latitude, prev.location.longitude,
          curr.location.latitude, curr.location.longitude
        ) * 1000; // Convert to meters
        
        const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds
        const speed = distance / timeDiff; // meters per second

        if (speed < 100) { // Filter out unrealistic speeds (>360 km/h)
          speeds.push(speed);
        }
      }

      if (speeds.length > 0) {
        this.adaptiveFrequencyData.averageSpeed = speeds.reduce((a, b) => a + b) / speeds.length;
        this.adaptiveFrequencyData.movementPattern = this.determineMovementPattern(this.adaptiveFrequencyData.averageSpeed);
        
        // Adjust update frequency based on movement pattern
        this.adjustUpdateFrequencyBasedOnMovement();
      }
    }
  }

  /**
   * Determine movement pattern based on average speed
   */
  private determineMovementPattern(avgSpeed: number): 'stationary' | 'walking' | 'driving' | 'transit' {
    if (avgSpeed < 0.5) return 'stationary'; // < 1.8 km/h
    if (avgSpeed < 2) return 'walking'; // < 7.2 km/h
    if (avgSpeed < 15) return 'transit'; // < 54 km/h
    return 'driving'; // >= 54 km/h
  }

  /**
   * Adjust update frequency based on movement pattern
   */
  private adjustUpdateFrequencyBasedOnMovement(): void {
    let newInterval = this.LOCATION_UPDATE_INTERVAL;
    let newDistanceFilter = 50;

    switch (this.adaptiveFrequencyData.movementPattern) {
      case 'stationary':
        newInterval = 60000; // 1 minute - slower updates when not moving
        newDistanceFilter = 100; // 100m filter
        break;
      case 'walking':
        newInterval = 30000; // 30 seconds - moderate updates
        newDistanceFilter = 25; // 25m filter
        break;
      case 'driving':
        newInterval = 5000; // 5 seconds - frequent updates when driving
        newDistanceFilter = 100; // 100m filter for driving
        break;
      case 'transit':
        newInterval = 15000; // 15 seconds - balanced updates
        newDistanceFilter = 50; // 50m filter
        break;
    }

    // Apply frequency limits
    const maxInterval = 60000 / this.frequencyConfig.minFrequency; // Convert to milliseconds
    const minInterval = 60000 / this.frequencyConfig.maxFrequency; // Convert to milliseconds
    
    newInterval = Math.max(minInterval, Math.min(maxInterval, newInterval));

    // Update frequency configuration if changed significantly
    if (Math.abs(newInterval - this.frequencyConfig.interval) > 2000) { // 2 second threshold
      this.frequencyConfig.interval = newInterval;
      this.frequencyConfig.distanceFilter = newDistanceFilter;

      console.log(`Adaptive frequency adjusted for ${this.adaptiveFrequencyData.movementPattern}:`, {
        interval: newInterval,
        distanceFilter: newDistanceFilter,
        avgSpeed: this.adaptiveFrequencyData.averageSpeed
      });

      // Restart location watching with new settings if active
      if (this.isWatching) {
        this.stopLocationWatch();
        this.startLocationWatch();
      }
    }
  }

  /**
   * Handle location permission denied with comprehensive flow management
   */
  async handleLocationPermissionDenied(): Promise<LocationPermissionDeniedFlow> {
    this.permissionDenialCount++;
    const now = Date.now();
    
    // Determine denial type
    let denialType: 'soft' | 'hard' | 'system_settings' = 'soft';
    if (this.permissionDenialCount >= 3) {
      denialType = 'system_settings';
    } else if (this.permissionDenialCount >= 2) {
      denialType = 'hard';
    }

    // Check if we can retry (not too frequent requests)
    const canRetry = denialType === 'soft' && (now - this.lastPermissionRequest) > 300000; // 5 minutes
    
    const flow: LocationPermissionDeniedFlow = {
      denialType,
      canRetry,
      fallbackOptions: this.determineFallbackOptions(denialType),
      userEducationShown: false,
      systemSettingsPrompted: denialType === 'system_settings',
      retryAttempts: this.permissionDenialCount,
      maxRetryAttempts: 3
    };

    console.log('Location permission denied flow:', flow);
    return flow;
  }

  /**
   * Determine fallback options based on denial type
   */
  private determineFallbackOptions(denialType: 'soft' | 'hard' | 'system_settings'): ('ip_location' | 'manual_entry' | 'zip_code' | 'city_selection')[] {
    switch (denialType) {
      case 'soft':
        return ['ip_location', 'manual_entry', 'zip_code'];
      case 'hard':
        return ['ip_location', 'manual_entry', 'zip_code', 'city_selection'];
      case 'system_settings':
        return ['manual_entry', 'zip_code', 'city_selection'];
      default:
        return ['manual_entry'];
    }
  }

  /**
   * Handle service unavailable scenarios with graceful degradation
   */
  async handleServiceUnavailable(serviceType: 'gps' | 'network' | 'geocoding'): Promise<LocationServiceUnavailableHandling> {
    const handling = this.serviceUnavailableHandling.get(serviceType);
    
    if (!handling) {
      throw new Error(`No handling strategy configured for service: ${serviceType}`);
    }

    console.log(`Service ${serviceType} unavailable, applying handling strategy:`, handling);

    // Execute fallback strategy
    try {
      switch (handling.fallbackStrategy) {
        case 'cached':
          const cachedLocation = this.getCachedLocation();
          if (cachedLocation) {
            console.log('Using cached location as fallback');
            return handling;
          }
          break;
        case 'network':
          if (serviceType !== 'network') {
            try {
              await this.getNetworkBasedLocation();
              console.log('Network-based fallback successful');
              return handling;
            } catch (error) {
              console.log('Network fallback failed:', error);
            }
          }
          break;
        case 'manual':
          console.log('Manual location entry required');
          return handling;
        default:
          console.log('No fallback strategy available');
          break;
      }
    } catch (error) {
      console.error('Fallback strategy execution failed:', error);
    }

    return handling;
  }

  /**
   * Get location update frequency statistics
   */
  getLocationUpdateFrequencyStats(): {
    currentConfig: LocationUpdateFrequencyConfig;
    movementData: typeof this.adaptiveFrequencyData;
    updateHistory: {
      lastUpdate: number;
      updateCount: number;
      averageInterval: number;
    };
  } {
    return {
      currentConfig: { ...this.frequencyConfig },
      movementData: { ...this.adaptiveFrequencyData },
      updateHistory: {
        lastUpdate: this.lastLocationUpdate,
        updateCount: this.locationUpdateCallbacks.length,
        averageInterval: this.frequencyConfig.interval
      }
    };
  }

  /**
   * Reset location accuracy and fallback systems
   */
  resetLocationAccuracySystem(): void {
    this.locationRefinements.clear();
    this.permissionDenialCount = 0;
    this.lastPermissionRequest = 0;
    this.adaptiveFrequencyData = {
      averageSpeed: 0,
      movementPattern: 'stationary',
      lastMovementDetected: 0,
      locationHistory: []
    };
    
    // Reset to default frequency configuration
    this.frequencyConfig = {
      interval: this.LOCATION_UPDATE_INTERVAL,
      distanceFilter: 50,
      batteryOptimized: true,
      adaptiveFrequency: true,
      maxFrequency: 6,
      minFrequency: 1
    };

    console.log('Location accuracy system reset to defaults');
  }

  /**
   * Cleanup resources with comprehensive cleanup
   */
  cleanup(): void {
    console.log('Cleaning up LocationService resources');
    
    // Stop all location watching
    this.stopLocationWatch();
    this.stopBackgroundLocationUpdates();
    
    // Clear callbacks
    this.locationUpdateCallbacks = [];
    this.backgroundLocationCallbacks = [];
    
    // Clear cache and location data
    this.currentLocation = null;
    this.locationCache.clear();
    this.lastLocationUpdate = 0;
    
    // Remove app state listener
    AppState.removeEventListener('change', this.handleAppStateChange.bind(this));
    
    console.log('LocationService cleanup completed');
  }

  /**
   * Clear location cache
   */
  async clearLocationCache(): Promise<void> {
    try {
      this.locationCache.clear();
      await AsyncStorage.removeItem(this.STORAGE_KEY_LOCATION_CACHE);
      await AsyncStorage.removeItem(this.STORAGE_KEY_LAST_LOCATION);
      console.log('Location cache cleared');
    } catch (error) {
      console.error('Failed to clear location cache:', error);
    }
  }

  /**
   * Get cache statistics for debugging and monitoring
   */
  getCacheStatistics(): {
    cacheSize: number;
    oldestEntry: number;
    newestEntry: number;
    averageReliability: number;
    sourceCounts: { [key: string]: number };
  } {
    const entries = Array.from(this.locationCache.values());
    
    if (entries.length === 0) {
      return {
        cacheSize: 0,
        oldestEntry: 0,
        newestEntry: 0,
        averageReliability: 0,
        sourceCounts: {}
      };
    }
    
    const timestamps = entries.map(e => e.cacheTimestamp);
    const reliabilities = entries.map(e => e.reliability);
    const sources = entries.reduce((acc, entry) => {
      acc[entry.source] = (acc[entry.source] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      cacheSize: entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      averageReliability: reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length,
      sourceCounts: sources
    };
  }
}

export const locationService = new LocationService();