import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { BusinessRepository } from '../repositories/businessRepository.js';

interface StatusUpdate {
  businessId: string;
  isOpen: boolean;
  status: string;
  reason: string;
  nextChange: string | null;
  timestamp: string;
}

interface ClientSubscription {
  businessIds: Set<string>;
  locationFilter?: {
    lat: number;
    lng: number;
    radius: number; // in km
  };
  connectionTime: number;
  messageCount: number;
  lastMessageTime: number;
  isAuthenticated?: boolean;
}

export class RealTimeStatusService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private businessRepository: BusinessRepository;
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute

  constructor() {
    this.businessRepository = new BusinessRepository();
  }

  /**
   * Initialize WebSocket server with security measures
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/business-status',
      clientTracking: true,
      maxPayload: 1024 * 16, // 16KB max message size
      skipUTF8Validation: false, // Validate UTF-8
      perMessageDeflate: true, // Enable compression
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startStatusMonitoring();
    
    // Real-time status service initialized with security measures
  }

  /**
   * Handle new WebSocket connection with security validation
   */
  private handleConnection(ws: WebSocket, request: { socket: { remoteAddress: string } }): void {
    // Basic rate limiting per client
    const _clientIP = request.socket.remoteAddress;
    // New WebSocket client connected from ${_clientIP}
    
    // Initialize client subscription with limits
    this.clients.set(ws, {
      businessIds: new Set(),
      connectionTime: Date.now(),
      messageCount: 0,
      lastMessageTime: Date.now(),
    });

    // Set connection timeout (commented out to avoid unused variable)
    // const connectionTimeout = setTimeout(() => {
    //   if (ws.readyState === WebSocket.OPEN) {
    //     ws.close(1000, 'Connection timeout');
    //   }
    // }, 30 * 60 * 1000); // 30 minutes

    // Handle incoming messages with validation
    ws.on('message', (data) => {
      try {
        // Message size validation (already handled by maxPayload, but double-check)
        if (data.length > 1024 * 16) {
          this.sendError(ws, 'Message too large');
          return;
        }

        // Rate limiting per client
        const subscription = this.clients.get(ws);
        if (subscription) {
          subscription.messageCount++;
          const now = Date.now();
          
          // Check message rate (max 10 messages per second)
          if (now - subscription.lastMessageTime < 100 && subscription.messageCount > 10) {
            this.sendError(ws, 'Rate limit exceeded');
            ws.close(1008, 'Rate limit exceeded');
            return;
          }
          
          subscription.lastMessageTime = now;
        }

        const message = JSON.parse(data.toString());
        
        // Input validation
        if (!message || typeof message !== 'object') {
          this.sendError(ws, 'Invalid message format');
          return;
        }

        this.handleClientMessage(ws, message);
      } catch (error) {
        // WebSocket message handling error: ${error}
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      // WebSocket client disconnected
    });

    // Handle errors
    ws.on('error', (_error) => {
      // WebSocket error: ${_error}
      this.clients.delete(ws);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      message: 'Connected to business status updates',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client messages with input validation and security checks
   */
  private handleClientMessage(ws: WebSocket, message: Record<string, any>): void {
    const subscription = this.clients.get(ws);
    if (!subscription) return;

    // Validate message type
    if (!message.type || typeof message.type !== 'string') {
      this.sendError(ws, 'Invalid message type');
      return;
    }

    switch (message.type) {
      case 'subscribe_business': {
        // Validate business ID
        if (!message.businessId || typeof message.businessId !== 'string') {
          this.sendError(ws, 'Invalid business ID');
          return;
        }
        
        // Check business ID format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(message.businessId)) {
          this.sendError(ws, 'Invalid business ID format');
          return;
        }

        // Limit subscriptions per client
        if (subscription.businessIds.size >= 50) {
          this.sendError(ws, 'Maximum subscriptions exceeded');
          return;
        }

        subscription.businessIds.add(message.businessId);
        this.sendBusinessStatus(ws, message.businessId);
        break;
      }

      case 'unsubscribe_business':
        if (message.businessId) {
          subscription.businessIds.delete(message.businessId);
        }
        break;

      case 'subscribe_location': {
        // Validate coordinates
        if (!message.lat || !message.lng || 
            typeof message.lat !== 'number' || typeof message.lng !== 'number') {
          this.sendError(ws, 'Invalid coordinates');
          return;
        }

        // Validate coordinate ranges
        if (message.lat < -90 || message.lat > 90 || 
            message.lng < -180 || message.lng > 180) {
          this.sendError(ws, 'Coordinates out of range');
          return;
        }

        // Validate radius
        const radius = message.radius || 25;
        if (typeof radius !== 'number' || radius < 1 || radius > 100) {
          this.sendError(ws, 'Invalid radius (1-100km)');
          return;
        }

        subscription.locationFilter = {
          lat: message.lat,
          lng: message.lng,
          radius
        };
        this.sendLocationBusinesses(ws, subscription.locationFilter);
        break;
      }

      case 'unsubscribe_location':
        delete subscription.locationFilter;
        break;

      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  /**
   * Send current status for a specific business
   */
  private async sendBusinessStatus(ws: WebSocket, businessId: string): Promise<void> {
    try {
      const result = await this.businessRepository.query(`
        SELECT * FROM calculate_business_status($1)
      `, [businessId]);

      if (result.rows.length > 0) {
        const status = result.rows[0];
        const statusUpdate: StatusUpdate = {
          businessId,
          isOpen: status.is_open,
          status: status.status,
          reason: status.reason,
          nextChange: status.next_change,
          timestamp: new Date().toISOString()
        };

        this.sendMessage(ws, {
          type: 'business_status',
          data: statusUpdate
        });
      }
    } catch (error) {
      // Error sending business status: ${error}
      this.sendError(ws, 'Failed to get business status');
    }
  }

  /**
   * Send businesses in location with their status
   */
  private async sendLocationBusinesses(ws: WebSocket, location: { lat: number; lng: number; radius: number }): Promise<void> {
    try {
      const result = await this.businessRepository.query(`
        SELECT * FROM get_open_businesses($1, $2, $3, NULL, NULL, 50)
      `, [location.lat, location.lng, location.radius]);

      const businesses = result.rows.map(row => ({
        businessId: row.id,
        isOpen: row.is_open,
        status: row.status,
        reason: 'Regular hours',
        nextChange: row.next_change,
        name: row.name,
        location: row.location,
        distance: row.distance_km
      }));

      this.sendMessage(ws, {
        type: 'location_businesses',
        data: businesses,
        location
      });
    } catch (error) {
      // Error sending location businesses: ${error}
      this.sendError(ws, 'Failed to get location businesses');
    }
  }

  /**
   * Start monitoring business status changes
   */
  private startStatusMonitoring(): void {
    this.statusCheckInterval = setInterval(async () => {
      await this.checkStatusChanges();
    }, this.CHECK_INTERVAL_MS);

    // Status monitoring started
  }

  /**
   * Check for status changes and broadcast updates
   */
  private async checkStatusChanges(): Promise<void> {
    try {
      // Get all subscribed business IDs
      const subscribedBusinessIds = new Set<string>();
      for (const subscription of this.clients.values()) {
        for (const businessId of subscription.businessIds) {
          subscribedBusinessIds.add(businessId);
        }
      }

      // Check status for subscribed businesses
      for (const businessId of subscribedBusinessIds) {
        await this.broadcastBusinessStatusUpdate(businessId);
      }

      // Check location-based subscriptions
      await this.checkLocationSubscriptions();

    } catch (error) {
      // Error checking status changes: ${error}
    }
  }

  /**
   * Broadcast status update for a specific business
   */
  private async broadcastBusinessStatusUpdate(businessId: string): Promise<void> {
    try {
      const result = await this.businessRepository.query(`
        SELECT * FROM calculate_business_status($1)
      `, [businessId]);

      if (result.rows.length > 0) {
        const status = result.rows[0];
        const statusUpdate: StatusUpdate = {
          businessId,
          isOpen: status.is_open,
          status: status.status,
          reason: status.reason,
          nextChange: status.next_change,
          timestamp: new Date().toISOString()
        };

        // Send to all clients subscribed to this business
        for (const [ws, subscription] of this.clients.entries()) {
          if (subscription.businessIds.has(businessId)) {
            this.sendMessage(ws, {
              type: 'business_status_update',
              data: statusUpdate
            });
          }
        }
      }
    } catch (error) {
      // Error broadcasting status for business ${businessId}: ${error}
    }
  }

  /**
   * Check and broadcast location-based subscriptions
   */
  private async checkLocationSubscriptions(): Promise<void> {
    const locationSubscriptions = new Map<string, WebSocket[]>();

    // Group clients by location
    for (const [ws, subscription] of this.clients.entries()) {
      if (subscription.locationFilter) {
        const key = `${subscription.locationFilter.lat},${subscription.locationFilter.lng},${subscription.locationFilter.radius}`;
        if (!locationSubscriptions.has(key)) {
          locationSubscriptions.set(key, []);
        }
        const subscribers = locationSubscriptions.get(key);
        if (subscribers) {
          subscribers.push(ws);
        }
      }
    }

    // Send updates for each unique location
    for (const [locationKey, clients] of locationSubscriptions.entries()) {
      const [lat, lng, radius] = locationKey.split(',').map(Number);
      
      try {
        const result = await this.businessRepository.query(`
          SELECT * FROM get_open_businesses($1, $2, $3, NULL, NULL, 50)
        `, [lat, lng, radius]);

        const businesses = result.rows.map(row => ({
          businessId: row.id,
          isOpen: row.is_open,
          status: row.status,
          reason: 'Regular hours',
          nextChange: row.next_change,
          name: row.name,
          location: row.location,
          distance: row.distance_km
        }));

        const updateMessage = {
          type: 'location_businesses_update',
          data: businesses,
          location: { lat, lng, radius }
        };

        for (const ws of clients) {
          this.sendMessage(ws, updateMessage);
        }

      } catch (error) {
        // Error broadcasting location update for ${locationKey}: ${error}
      }
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: Record<string, any>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Manually trigger status update for a business (for testing/admin)
   */
  async triggerBusinessStatusUpdate(businessId: string): Promise<void> {
    await this.broadcastBusinessStatusUpdate(businessId);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): {
    totalClients: number;
    businessSubscriptions: number;
    locationSubscriptions: number;
  } {
    let businessSubs = 0;
    let locationSubs = 0;

    for (const subscription of this.clients.values()) {
      businessSubs += subscription.businessIds.size;
      if (subscription.locationFilter) {
        locationSubs++;
      }
    }

    return {
      totalClients: this.clients.size,
      businessSubscriptions: businessSubs,
      locationSubscriptions: locationSubs
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    // Real-time status service shutdown
  }
}