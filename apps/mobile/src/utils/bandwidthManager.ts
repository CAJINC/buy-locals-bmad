import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

// Types for bandwidth management
export interface NetworkCondition {
  type: string;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  details: {
    isConnectionExpensive?: boolean;
    cellularGeneration?: '2g' | '3g' | '4g' | '5g' | null;
    carrier?: string | null;
    strength?: number;
  };
  timestamp: number;
}

export interface BandwidthStrategy {
  name: string;
  maxConcurrentRequests: number;
  debounceMs: number;
  requestTimeout: number;
  enableCompression: boolean;
  enableCaching: boolean;
  cacheExpiryMs: number;
  requestPriority: 'high' | 'normal' | 'low';
  dataLimits: {
    maxRequestSize: number; // bytes
    maxResponseSize: number; // bytes
    dailyDataLimit?: number; // bytes
  };
  updateFrequency: {
    highBandwidth: number; // ms between updates
    mediumBandwidth: number;
    lowBandwidth: number;
  };
}

export interface DataUsageMetrics {
  totalRequestsToday: number;
  totalDataUsedToday: number; // bytes
  requestSizeStats: {
    min: number;
    max: number;
    average: number;
  };
  responseSizeStats: {
    min: number;
    max: number;
    average: number;
  };
  networkTypeUsage: {
    [type: string]: {
      requests: number;
      dataUsed: number;
      averageSpeed: number;
    };
  };
  peakUsageHours: number[];
  lastResetDate: string;
}

export interface RequestThrottling {
  requestQueue: {
    id: string;
    priority: 'high' | 'normal' | 'low';
    timestamp: number;
    estimatedSize: number;
    retryCount: number;
    maxRetries: number;
  }[];
  activeRequests: Map<string, {
    startTime: number;
    estimatedSize: number;
    actualSize?: number;
  }>;
  rateLimits: {
    requestsPerMinute: number;
    bytesPerMinute: number;
    burstAllowance: number;
  };
}

/**
 * Enterprise-grade bandwidth management system
 * Provides intelligent throttling, data usage tracking, and adaptive strategies
 */
export class BandwidthManager extends EventEmitter {
  private static readonly STORAGE_KEY_METRICS = '@buy_locals:bandwidth_metrics';
  private static readonly STORAGE_KEY_SETTINGS = '@buy_locals:bandwidth_settings';
  
  // Predefined bandwidth strategies
  private static readonly STRATEGIES: { [key: string]: BandwidthStrategy } = {
    wifi_optimal: {
      name: 'WiFi Optimal',
      maxConcurrentRequests: 4,
      debounceMs: 500,
      requestTimeout: 10000,
      enableCompression: false,
      enableCaching: true,
      cacheExpiryMs: 300000, // 5 minutes
      requestPriority: 'high',
      dataLimits: {
        maxRequestSize: 1024 * 1024, // 1MB
        maxResponseSize: 5 * 1024 * 1024, // 5MB
      },
      updateFrequency: {
        highBandwidth: 1000,
        mediumBandwidth: 2000,
        lowBandwidth: 5000,
      }
    },
    cellular_5g: {
      name: 'Cellular 5G',
      maxConcurrentRequests: 3,
      debounceMs: 800,
      requestTimeout: 8000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiryMs: 600000, // 10 minutes
      requestPriority: 'high',
      dataLimits: {
        maxRequestSize: 512 * 1024, // 512KB
        maxResponseSize: 2 * 1024 * 1024, // 2MB
        dailyDataLimit: 100 * 1024 * 1024, // 100MB
      },
      updateFrequency: {
        highBandwidth: 1500,
        mediumBandwidth: 3000,
        lowBandwidth: 6000,
      }
    },
    cellular_4g: {
      name: 'Cellular 4G',
      maxConcurrentRequests: 2,
      debounceMs: 1200,
      requestTimeout: 12000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiryMs: 900000, // 15 minutes
      requestPriority: 'normal',
      dataLimits: {
        maxRequestSize: 256 * 1024, // 256KB
        maxResponseSize: 1 * 1024 * 1024, // 1MB
        dailyDataLimit: 50 * 1024 * 1024, // 50MB
      },
      updateFrequency: {
        highBandwidth: 2000,
        mediumBandwidth: 4000,
        lowBandwidth: 8000,
      }
    },
    cellular_3g: {
      name: 'Cellular 3G',
      maxConcurrentRequests: 1,
      debounceMs: 2000,
      requestTimeout: 15000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiryMs: 1800000, // 30 minutes
      requestPriority: 'normal',
      dataLimits: {
        maxRequestSize: 128 * 1024, // 128KB
        maxResponseSize: 512 * 1024, // 512KB
        dailyDataLimit: 25 * 1024 * 1024, // 25MB
      },
      updateFrequency: {
        highBandwidth: 4000,
        mediumBandwidth: 8000,
        lowBandwidth: 15000,
      }
    },
    cellular_2g: {
      name: 'Cellular 2G',
      maxConcurrentRequests: 1,
      debounceMs: 4000,
      requestTimeout: 30000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiryMs: 3600000, // 1 hour
      requestPriority: 'low',
      dataLimits: {
        maxRequestSize: 64 * 1024, // 64KB
        maxResponseSize: 256 * 1024, // 256KB
        dailyDataLimit: 10 * 1024 * 1024, // 10MB
      },
      updateFrequency: {
        highBandwidth: 8000,
        mediumBandwidth: 15000,
        lowBandwidth: 30000,
      }
    },
    data_saver: {
      name: 'Data Saver',
      maxConcurrentRequests: 1,
      debounceMs: 3000,
      requestTimeout: 20000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiryMs: 7200000, // 2 hours
      requestPriority: 'low',
      dataLimits: {
        maxRequestSize: 32 * 1024, // 32KB
        maxResponseSize: 128 * 1024, // 128KB
        dailyDataLimit: 5 * 1024 * 1024, // 5MB
      },
      updateFrequency: {
        highBandwidth: 10000,
        mediumBandwidth: 20000,
        lowBandwidth: 45000,
      }
    }
  };

  // Service state
  private currentNetworkCondition: NetworkCondition | null = null;
  private currentStrategy: BandwidthStrategy = BandwidthManager.STRATEGIES.wifi_optimal;
  private dataUsageMetrics: DataUsageMetrics;
  private requestThrottling: RequestThrottling;
  private networkUnsubscribe: (() => void) | null = null;
  
  // Monitoring and optimization
  private metricsUpdateTimer: NodeJS.Timeout | null = null;
  private adaptiveOptimizationTimer: NodeJS.Timeout | null = null;
  private requestSpeedSamples: number[] = [];

  constructor() {
    super();
    
    // Initialize data usage metrics
    this.dataUsageMetrics = {
      totalRequestsToday: 0,
      totalDataUsedToday: 0,
      requestSizeStats: { min: 0, max: 0, average: 0 },
      responseSizeStats: { min: 0, max: 0, average: 0 },
      networkTypeUsage: {},
      peakUsageHours: [],
      lastResetDate: new Date().toDateString()
    };
    
    // Initialize request throttling
    this.requestThrottling = {
      requestQueue: [],
      activeRequests: new Map(),
      rateLimits: {
        requestsPerMinute: 20,
        bytesPerMinute: 5 * 1024 * 1024, // 5MB
        burstAllowance: 3
      }
    };
    
    this.initialize();
  }

  /**
   * Initialize bandwidth manager
   */
  private async initialize(): Promise<void> {
    try {
      // Load stored metrics and settings
      await this.loadStoredData();
      
      // Start network monitoring
      await this.startNetworkMonitoring();
      
      // Start metrics updates
      this.startMetricsUpdates();
      
      // Start adaptive optimization
      this.startAdaptiveOptimization();
      
      console.log('BandwidthManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BandwidthManager:', error);
    }
  }

  /**
   * Load stored metrics and settings
   */
  private async loadStoredData(): Promise<void> {
    try {
      // Load metrics
      const metricsData = await AsyncStorage.getItem(BandwidthManager.STORAGE_KEY_METRICS);
      if (metricsData) {
        const storedMetrics = JSON.parse(metricsData);
        
        // Check if metrics are from today
        const today = new Date().toDateString();
        if (storedMetrics.lastResetDate === today) {
          this.dataUsageMetrics = storedMetrics;
        } else {
          // Reset daily metrics
          this.dataUsageMetrics.lastResetDate = today;
          await this.saveMetrics();
        }
      }

      // Load settings (custom strategies, user preferences)
      const settingsData = await AsyncStorage.getItem(BandwidthManager.STORAGE_KEY_SETTINGS);
      if (settingsData) {
        const settings = JSON.parse(settingsData);
        // Apply user preferences
        console.log('Loaded bandwidth settings:', settings);
      }

    } catch (error) {
      console.warn('Failed to load bandwidth data:', error);
    }
  }

  /**
   * Start network monitoring
   */
  private async startNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network state
      const networkState = await NetInfo.fetch();
      this.updateNetworkCondition(networkState);
      
      // Subscribe to network changes
      this.networkUnsubscribe = NetInfo.addEventListener((state) => {
        this.updateNetworkCondition(state);
      });
      
    } catch (error) {
      console.error('Failed to start network monitoring:', error);
    }
  }

  /**
   * Update network condition and adapt strategy
   */
  private updateNetworkCondition(networkState: any): void {
    const condition: NetworkCondition = {
      type: networkState.type || 'unknown',
      isConnected: networkState.isConnected || false,
      isInternetReachable: networkState.isInternetReachable,
      details: {
        isConnectionExpensive: networkState.details?.isConnectionExpensive,
        cellularGeneration: networkState.details?.cellularGeneration,
        carrier: networkState.details?.carrier,
        strength: networkState.details?.strength
      },
      timestamp: Date.now()
    };
    
    const previousCondition = this.currentNetworkCondition;
    this.currentNetworkCondition = condition;
    
    // Adapt strategy if network changed significantly
    if (!previousCondition || this.shouldAdaptStrategy(previousCondition, condition)) {
      this.adaptBandwidthStrategy(condition);
    }
    
    // Emit network change event
    this.emit('network_changed', condition);
    
    console.log('Network condition updated:', {
      type: condition.type,
      isConnected: condition.isConnected,
      generation: condition.details.cellularGeneration,
      strategy: this.currentStrategy.name
    });
  }

  /**
   * Check if strategy adaptation is needed
   */
  private shouldAdaptStrategy(previous: NetworkCondition, current: NetworkCondition): boolean {
    // Type changed
    if (previous.type !== current.type) return true;
    
    // Connection state changed
    if (previous.isConnected !== current.isConnected) return true;
    
    // Cellular generation changed
    if (previous.details.cellularGeneration !== current.details.cellularGeneration) return true;
    
    // Connection became expensive/inexpensive
    if (previous.details.isConnectionExpensive !== current.details.isConnectionExpensive) return true;
    
    return false;
  }

  /**
   * Adapt bandwidth strategy based on network condition
   */
  private adaptBandwidthStrategy(condition: NetworkCondition): void {
    let strategyKey = 'wifi_optimal';
    
    if (!condition.isConnected) {
      // Offline - use most conservative strategy
      strategyKey = 'data_saver';
    } else if (condition.type === 'wifi') {
      strategyKey = 'wifi_optimal';
    } else if (condition.type === 'cellular') {
      switch (condition.details.cellularGeneration) {
        case '5g':
          strategyKey = 'cellular_5g';
          break;
        case '4g':
          strategyKey = 'cellular_4g';
          break;
        case '3g':
          strategyKey = 'cellular_3g';
          break;
        case '2g':
          strategyKey = 'cellular_2g';
          break;
        default:
          strategyKey = 'cellular_4g'; // Default to 4G
      }
      
      // Check if connection is expensive
      if (condition.details.isConnectionExpensive) {
        strategyKey = 'data_saver';
      }
    }
    
    const newStrategy = BandwidthManager.STRATEGIES[strategyKey];
    if (newStrategy && newStrategy.name !== this.currentStrategy.name) {
      const previousStrategy = this.currentStrategy;
      this.currentStrategy = newStrategy;
      
      // Update rate limits based on new strategy
      this.updateRateLimits(newStrategy);
      
      // Emit strategy change event
      this.emit('strategy_changed', { previous: previousStrategy, current: newStrategy });
      
      console.log('Bandwidth strategy adapted:', {
        from: previousStrategy.name,
        to: newStrategy.name,
        reason: `Network: ${condition.type} ${condition.details.cellularGeneration || ''}`
      });
    }
  }

  /**
   * Update rate limits based on strategy
   */
  private updateRateLimits(strategy: BandwidthStrategy): void {
    const baseRequestsPerMinute = Math.max(1, strategy.maxConcurrentRequests * 10);
    const baseBytesPerMinute = Math.max(
      strategy.dataLimits.maxRequestSize * 5,
      strategy.dataLimits.maxResponseSize
    );
    
    this.requestThrottling.rateLimits = {
      requestsPerMinute: baseRequestsPerMinute,
      bytesPerMinute: baseBytesPerMinute,
      burstAllowance: Math.max(1, Math.floor(strategy.maxConcurrentRequests / 2))
    };
  }

  /**
   * Check if request should be allowed based on current limits
   */
  canMakeRequest(estimatedSize: number = 0, priority: 'high' | 'normal' | 'low' = 'normal'): boolean {
    // Check if offline
    if (!this.currentNetworkCondition?.isConnected) {
      return false;
    }
    
    // Check daily data limit
    if (this.currentStrategy.dataLimits.dailyDataLimit) {
      if (this.dataUsageMetrics.totalDataUsedToday >= this.currentStrategy.dataLimits.dailyDataLimit) {
        return false;
      }
    }
    
    // Check request size limits
    if (estimatedSize > this.currentStrategy.dataLimits.maxRequestSize) {
      return false;
    }
    
    // Check active request limits
    if (this.requestThrottling.activeRequests.size >= this.currentStrategy.maxConcurrentRequests) {
      return false;
    }
    
    // Check rate limits (requests per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestThrottling.requestQueue.filter(req => req.timestamp > oneMinuteAgo);
    
    if (recentRequests.length >= this.requestThrottling.rateLimits.requestsPerMinute) {
      return false;
    }
    
    // Check bandwidth rate limits (bytes per minute)
    const recentDataUsage = recentRequests.reduce((sum, req) => sum + req.estimatedSize, 0);
    if (recentDataUsage + estimatedSize > this.requestThrottling.rateLimits.bytesPerMinute) {
      return false;
    }
    
    return true;
  }

  /**
   * Queue request for processing
   */
  queueRequest(
    id: string,
    estimatedSize: number = 0,
    priority: 'high' | 'normal' | 'low' = 'normal',
    maxRetries: number = 3
  ): boolean {
    if (!this.canMakeRequest(estimatedSize, priority)) {
      return false;
    }
    
    const request = {
      id,
      priority,
      timestamp: Date.now(),
      estimatedSize,
      retryCount: 0,
      maxRetries
    };
    
    // Insert based on priority
    const insertIndex = this.requestThrottling.requestQueue.findIndex(req => 
      this.getPriorityValue(req.priority) < this.getPriorityValue(priority)
    );
    
    if (insertIndex === -1) {
      this.requestThrottling.requestQueue.push(request);
    } else {
      this.requestThrottling.requestQueue.splice(insertIndex, 0, request);
    }
    
    // Start request if possible
    this.processRequestQueue();
    
    return true;
  }

  /**
   * Mark request as started
   */
  startRequest(id: string, actualSize?: number): void {
    const queuedRequest = this.requestThrottling.requestQueue.find(req => req.id === id);
    if (!queuedRequest) return;
    
    // Move to active requests
    this.requestThrottling.activeRequests.set(id, {
      startTime: Date.now(),
      estimatedSize: queuedRequest.estimatedSize,
      actualSize
    });
    
    // Remove from queue
    const queueIndex = this.requestThrottling.requestQueue.findIndex(req => req.id === id);
    if (queueIndex !== -1) {
      this.requestThrottling.requestQueue.splice(queueIndex, 1);
    }
  }

  /**
   * Mark request as completed and update metrics
   */
  completeRequest(id: string, responseSize: number, success: boolean = true): void {
    const activeRequest = this.requestThrottling.activeRequests.get(id);
    if (!activeRequest) return;
    
    const duration = Date.now() - activeRequest.startTime;
    const actualRequestSize = activeRequest.actualSize || activeRequest.estimatedSize;
    
    // Update metrics
    this.updateDataUsageMetrics(actualRequestSize, responseSize, duration, success);
    
    // Remove from active requests
    this.requestThrottling.activeRequests.delete(id);
    
    // Process next request in queue
    this.processRequestQueue();
    
    // Emit completion event
    this.emit('request_completed', {
      id,
      duration,
      requestSize: actualRequestSize,
      responseSize,
      success
    });
  }

  /**
   * Handle request failure and retry logic
   */
  failRequest(id: string, error: any): void {
    const activeRequest = this.requestThrottling.activeRequests.get(id);
    if (!activeRequest) return;
    
    // Remove from active requests
    this.requestThrottling.activeRequests.delete(id);
    
    // Check if we can retry
    const queuedRequest = this.requestThrottling.requestQueue.find(req => req.id === id);
    if (queuedRequest && queuedRequest.retryCount < queuedRequest.maxRetries) {
      queuedRequest.retryCount++;
      queuedRequest.timestamp = Date.now() + (queuedRequest.retryCount * 2000); // Exponential backoff
      
      // Re-queue with delay
      setTimeout(() => this.processRequestQueue(), queuedRequest.retryCount * 2000);
    }
    
    // Update failure metrics
    this.updateDataUsageMetrics(activeRequest.estimatedSize, 0, 0, false);
    
    // Emit failure event
    this.emit('request_failed', { id, error, canRetry: queuedRequest?.retryCount < queuedRequest?.maxRetries });
  }

  /**
   * Process request queue
   */
  private processRequestQueue(): void {
    // Process high priority requests first
    this.requestThrottling.requestQueue.sort((a, b) => {
      const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // FIFO for same priority
    });
    
    // Start as many requests as allowed
    while (
      this.requestThrottling.activeRequests.size < this.currentStrategy.maxConcurrentRequests &&
      this.requestThrottling.requestQueue.length > 0
    ) {
      const nextRequest = this.requestThrottling.requestQueue[0];
      
      // Check if request time has come (for retries with delay)
      if (nextRequest.timestamp > Date.now()) {
        break;
      }
      
      if (this.canMakeRequest(nextRequest.estimatedSize, nextRequest.priority)) {
        this.emit('request_ready', nextRequest);
        break; // Let the consumer start the request
      } else {
        // Can't make request - wait
        break;
      }
    }
  }

  /**
   * Update data usage metrics
   */
  private updateDataUsageMetrics(
    requestSize: number,
    responseSize: number,
    duration: number,
    success: boolean
  ): void {
    const metrics = this.dataUsageMetrics;
    const networkType = this.currentNetworkCondition?.type || 'unknown';
    
    // Update request count
    metrics.totalRequestsToday++;
    
    // Update data usage
    const totalSize = requestSize + responseSize;
    metrics.totalDataUsedToday += totalSize;
    
    // Update size statistics
    if (success) {
      // Request size stats
      if (metrics.requestSizeStats.min === 0 || requestSize < metrics.requestSizeStats.min) {
        metrics.requestSizeStats.min = requestSize;
      }
      if (requestSize > metrics.requestSizeStats.max) {
        metrics.requestSizeStats.max = requestSize;
      }
      
      // Response size stats
      if (metrics.responseSizeStats.min === 0 || responseSize < metrics.responseSizeStats.min) {
        metrics.responseSizeStats.min = responseSize;
      }
      if (responseSize > metrics.responseSizeStats.max) {
        metrics.responseSizeStats.max = responseSize;
      }
      
      // Update averages
      const totalRequests = metrics.totalRequestsToday;
      metrics.requestSizeStats.average = (
        (metrics.requestSizeStats.average * (totalRequests - 1)) + requestSize
      ) / totalRequests;
      
      metrics.responseSizeStats.average = (
        (metrics.responseSizeStats.average * (totalRequests - 1)) + responseSize
      ) / totalRequests;
    }
    
    // Update network type usage
    if (!metrics.networkTypeUsage[networkType]) {
      metrics.networkTypeUsage[networkType] = {
        requests: 0,
        dataUsed: 0,
        averageSpeed: 0
      };
    }
    
    const networkUsage = metrics.networkTypeUsage[networkType];
    networkUsage.requests++;
    networkUsage.dataUsed += totalSize;
    
    if (success && duration > 0) {
      const speed = totalSize / (duration / 1000); // bytes per second
      networkUsage.averageSpeed = (
        (networkUsage.averageSpeed * (networkUsage.requests - 1)) + speed
      ) / networkUsage.requests;
      
      // Store speed sample for adaptive optimization
      this.requestSpeedSamples.push(speed);
      if (this.requestSpeedSamples.length > 50) {
        this.requestSpeedSamples.shift();
      }
    }
    
    // Update peak usage hours
    const currentHour = new Date().getHours();
    if (!metrics.peakUsageHours.includes(currentHour)) {
      metrics.peakUsageHours.push(currentHour);
    }
    
    // Save metrics periodically
    if (metrics.totalRequestsToday % 10 === 0) {
      this.saveMetrics();
    }
  }

  /**
   * Get current bandwidth strategy
   */
  getCurrentStrategy(): BandwidthStrategy {
    return { ...this.currentStrategy };
  }

  /**
   * Get current network condition
   */
  getCurrentNetworkCondition(): NetworkCondition | null {
    return this.currentNetworkCondition ? { ...this.currentNetworkCondition } : null;
  }

  /**
   * Get data usage metrics
   */
  getDataUsageMetrics(): DataUsageMetrics {
    return { ...this.dataUsageMetrics };
  }

  /**
   * Get optimal update frequency based on current conditions
   */
  getOptimalUpdateFrequency(): number {
    const strategy = this.currentStrategy;
    const condition = this.currentNetworkCondition;
    
    if (!condition?.isConnected) {
      return strategy.updateFrequency.lowBandwidth;
    }
    
    // Use recent speed samples to determine bandwidth level
    if (this.requestSpeedSamples.length > 0) {
      const averageSpeed = this.requestSpeedSamples.reduce((sum, speed) => sum + speed, 0) / this.requestSpeedSamples.length;
      
      // Speed thresholds (bytes per second)
      const highSpeedThreshold = 1024 * 1024; // 1 MB/s
      const mediumSpeedThreshold = 256 * 1024; // 256 KB/s
      
      if (averageSpeed >= highSpeedThreshold) {
        return strategy.updateFrequency.highBandwidth;
      } else if (averageSpeed >= mediumSpeedThreshold) {
        return strategy.updateFrequency.mediumBandwidth;
      } else {
        return strategy.updateFrequency.lowBandwidth;
      }
    }
    
    // Fall back to network type-based frequency
    if (condition.type === 'wifi') {
      return strategy.updateFrequency.highBandwidth;
    } else if (condition.type === 'cellular') {
      switch (condition.details.cellularGeneration) {
        case '5g':
        case '4g':
          return strategy.updateFrequency.mediumBandwidth;
        default:
          return strategy.updateFrequency.lowBandwidth;
      }
    }
    
    return strategy.updateFrequency.mediumBandwidth;
  }

  /**
   * Check if data usage is approaching limits
   */
  isApproachingDataLimit(threshold: number = 0.8): boolean {
    const dailyLimit = this.currentStrategy.dataLimits.dailyDataLimit;
    if (!dailyLimit) return false;
    
    return this.dataUsageMetrics.totalDataUsedToday >= (dailyLimit * threshold);
  }

  /**
   * Get recommendation for data usage optimization
   */
  getDataUsageRecommendation(): {
    shouldOptimize: boolean;
    reason: string;
    recommendations: string[];
  } {
    const metrics = this.dataUsageMetrics;
    const strategy = this.currentStrategy;
    const recommendations: string[] = [];
    let shouldOptimize = false;
    let reason = '';
    
    // Check daily data limit
    if (this.isApproachingDataLimit(0.8)) {
      shouldOptimize = true;
      reason = 'Approaching daily data limit';
      recommendations.push('Enable data saver mode');
      recommendations.push('Reduce update frequency');
      recommendations.push('Use cached results when possible');
    }
    
    // Check if using expensive connection
    if (this.currentNetworkCondition?.details.isConnectionExpensive) {
      shouldOptimize = true;
      reason = 'Using expensive cellular connection';
      recommendations.push('Switch to WiFi when available');
      recommendations.push('Enable aggressive caching');
      recommendations.push('Compress requests and responses');
    }
    
    // Check if on slow connection
    if (this.currentStrategy.name.includes('2g') || this.currentStrategy.name.includes('3g')) {
      shouldOptimize = true;
      reason = 'Slow network connection detected';
      recommendations.push('Increase debounce time');
      recommendations.push('Reduce concurrent requests');
      recommendations.push('Enable request compression');
    }
    
    // Check if high data usage pattern
    const avgRequestSize = metrics.requestSizeStats.average;
    const avgResponseSize = metrics.responseSizeStats.average;
    if (avgRequestSize + avgResponseSize > 500 * 1024) { // 500KB
      shouldOptimize = true;
      reason = 'High average data usage per request';
      recommendations.push('Implement response compression');
      recommendations.push('Optimize request payloads');
      recommendations.push('Increase cache retention');
    }
    
    return {
      shouldOptimize,
      reason,
      recommendations
    };
  }

  /**
   * Apply data saver mode
   */
  enableDataSaverMode(enabled: boolean = true): void {
    if (enabled) {
      this.currentStrategy = BandwidthManager.STRATEGIES.data_saver;
      this.updateRateLimits(this.currentStrategy);
      this.emit('data_saver_enabled', true);
    } else {
      // Restore strategy based on current network condition
      if (this.currentNetworkCondition) {
        this.adaptBandwidthStrategy(this.currentNetworkCondition);
      }
      this.emit('data_saver_enabled', false);
    }
  }

  // Helper methods
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private startMetricsUpdates(): void {
    this.metricsUpdateTimer = setInterval(() => {
      this.saveMetrics();
    }, 60000); // Save every minute
  }

  private startAdaptiveOptimization(): void {
    this.adaptiveOptimizationTimer = setInterval(() => {
      this.optimizeBasedOnUsagePatterns();
    }, 300000); // Every 5 minutes
  }

  private optimizeBasedOnUsagePatterns(): void {
    const recommendation = this.getDataUsageRecommendation();
    
    if (recommendation.shouldOptimize) {
      console.log('Bandwidth optimization recommended:', recommendation);
      this.emit('optimization_recommended', recommendation);
    }
    
    // Auto-adapt strategy if needed
    const metrics = this.dataUsageMetrics;
    const condition = this.currentNetworkCondition;
    
    if (condition?.details.isConnectionExpensive && metrics.totalDataUsedToday > 10 * 1024 * 1024) {
      // Auto-enable data saver on expensive connections with high usage
      this.enableDataSaverMode(true);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        BandwidthManager.STORAGE_KEY_METRICS,
        JSON.stringify(this.dataUsageMetrics)
      );
    } catch (error) {
      console.warn('Failed to save bandwidth metrics:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer);
    }
    
    if (this.adaptiveOptimizationTimer) {
      clearInterval(this.adaptiveOptimizationTimer);
    }
    
    this.removeAllListeners();
    console.log('BandwidthManager cleanup completed');
  }

  /**
   * Get service statistics
   */
  getStatistics(): any {
    return {
      currentStrategy: this.currentStrategy.name,
      networkCondition: this.currentNetworkCondition,
      dataUsage: this.dataUsageMetrics,
      activeRequests: this.requestThrottling.activeRequests.size,
      queuedRequests: this.requestThrottling.requestQueue.length,
      averageSpeed: this.requestSpeedSamples.length > 0 
        ? this.requestSpeedSamples.reduce((sum, speed) => sum + speed, 0) / this.requestSpeedSamples.length 
        : 0
    };
  }
}

// Export singleton instance
export const bandwidthManager = new BandwidthManager();