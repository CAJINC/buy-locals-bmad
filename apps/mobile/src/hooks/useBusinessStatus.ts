import { useState, useEffect, useCallback, useRef } from 'react';

export interface BusinessStatus {
  businessId: string;
  isOpen: boolean;
  status: string;
  reason: string;
  nextChange: string | null;
  timestamp: string;
}

export interface LocationFilter {
  lat: number;
  lng: number;
  radius: number;
}

export interface UseBusinessStatusOptions {
  businessIds?: string[];
  locationFilter?: LocationFilter;
  autoConnect?: boolean;
  reconnectInterval?: number;
}

export interface UseBusinessStatusReturn {
  statuses: Map<string, BusinessStatus>;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  subscribe: (businessId: string) => void;
  unsubscribe: (businessId: string) => void;
  setLocationFilter: (filter: LocationFilter | null) => void;
  reconnect: () => void;
  disconnect: () => void;
}

export const useBusinessStatus = (
  options: UseBusinessStatusOptions = {}
): UseBusinessStatusReturn => {
  const {
    businessIds = [],
    locationFilter,
    autoConnect = true,
    reconnectInterval = 5000,
  } = options;

  const [statuses, setStatuses] = useState<Map<string, BusinessStatus>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set(businessIds));
  const locationFilterRef = useRef<LocationFilter | null>(locationFilter || null);

  const getWebSocketUrl = () => {
    // TODO: Make this configurable based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = __DEV__ ? 'localhost:3001' : window.location.host;
    return `${protocol}//${host}/ws/business-status`;
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);

        // Subscribe to existing business IDs
        subscriptionsRef.current.forEach(businessId => {
          ws.send(JSON.stringify({
            type: 'subscribe_business',
            businessId,
          }));
        });

        // Subscribe to location filter if set
        if (locationFilterRef.current) {
          ws.send(JSON.stringify({
            type: 'subscribe_location',
            ...locationFilterRef.current,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'business_status':
            case 'business_status_update':
              const status: BusinessStatus = message.data;
              setStatuses(prev => new Map(prev.set(status.businessId, status)));
              break;

            case 'location_businesses':
            case 'location_businesses_update':
              // Handle location-based business updates
              const businesses = message.data;
              setStatuses(prev => {
                const newMap = new Map(prev);
                businesses.forEach((business: any) => {
                  newMap.set(business.businessId, {
                    businessId: business.businessId,
                    isOpen: business.isOpen,
                    status: business.status,
                    reason: business.reason || 'Regular hours',
                    nextChange: business.nextChange,
                    timestamp: new Date().toISOString(),
                  });
                });
                return newMap;
              });
              break;

            case 'error':
              console.error('WebSocket error:', message.error);
              setError(message.error);
              break;

            case 'connected':
            case 'pong':
              // Connection acknowledgments
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);

        // Auto-reconnect if not intentionally closed
        if (event.code !== 1000 && autoConnect) {
          setError('Connection lost. Attempting to reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnecting(false);
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to establish connection');
      setIsConnecting(false);
    }
  }, [autoConnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  const subscribe = useCallback((businessId: string) => {
    subscriptionsRef.current.add(businessId);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_business',
        businessId,
      }));
    }
  }, []);

  const unsubscribe = useCallback((businessId: string) => {
    subscriptionsRef.current.delete(businessId);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe_business',
        businessId,
      }));
    }

    // Remove from local state
    setStatuses(prev => {
      const newMap = new Map(prev);
      newMap.delete(businessId);
      return newMap;
    });
  }, []);

  const setLocationFilter = useCallback((filter: LocationFilter | null) => {
    locationFilterRef.current = filter;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (filter) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe_location',
          ...filter,
        }));
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe_location',
        }));
      }
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    statuses,
    isConnected,
    isConnecting,
    error,
    subscribe,
    unsubscribe,
    setLocationFilter,
    reconnect,
    disconnect,
  };
};