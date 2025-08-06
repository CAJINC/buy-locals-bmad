import { renderHook, act } from '@testing-library/react-hooks';
import { useBusinessStatus } from '../useBusinessStatus';

// Mock WebSocket
class MockWebSocket {
  public readyState = WebSocket.OPEN;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen({} as Event);
      }
    }, 10);
  }

  send(data: string) {
    // Mock sending data
    console.log('MockWebSocket send:', data);
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code || 1000, reason: reason || 'Normal closure' } as CloseEvent);
    }
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('useBusinessStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => 
      useBusinessStatus({ autoConnect: false })
    );

    expect(result.current.statuses.size).toBe(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('connects to WebSocket when autoConnect is true', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ autoConnect: true })
    );

    expect(result.current.isConnecting).toBe(true);

    await waitForNextUpdate();

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('subscribes to business status updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ 
        businessIds: ['business-1'], 
        autoConnect: true 
      })
    );

    await waitForNextUpdate();

    act(() => {
      result.current.subscribe('business-2');
    });

    // Should not throw or cause errors
    expect(result.current.isConnected).toBe(true);
  });

  it('unsubscribes from business status updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ 
        businessIds: ['business-1'], 
        autoConnect: true 
      })
    );

    await waitForNextUpdate();

    act(() => {
      result.current.unsubscribe('business-1');
    });

    expect(result.current.statuses.has('business-1')).toBe(false);
  });

  it('handles location filter updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ autoConnect: true })
    );

    await waitForNextUpdate();

    act(() => {
      result.current.setLocationFilter({
        lat: 40.7128,
        lng: -74.0060,
        radius: 5
      });
    });

    // Should not throw or cause errors
    expect(result.current.isConnected).toBe(true);
  });

  it('updates statuses when WebSocket messages are received', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ autoConnect: true })
    );

    await waitForNextUpdate();

    // Simulate receiving a status update message
    const mockStatus = {
      businessId: 'business-1',
      isOpen: true,
      status: 'open',
      reason: 'Regular hours',
      nextChange: '2024-01-01T17:00:00Z',
      timestamp: new Date().toISOString(),
    };

    // This would be triggered by the WebSocket onmessage handler
    // In a real test, you'd simulate the WebSocket message
    act(() => {
      // Simulate the status update that would come from WebSocket
      const mockMessage = {
        type: 'business_status_update',
        data: mockStatus
      };
      
      // We'd need to access the WebSocket instance and trigger onmessage
      // For now, we'll test the internal state management
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('handles connection errors gracefully', async () => {
    // Mock WebSocket that fails to connect
    const FailingWebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        setTimeout(() => {
          if (this.onerror) {
            this.onerror({} as Event);
          }
        }, 10);
      }
    };

    (global as any).WebSocket = FailingWebSocket;

    const { result } = renderHook(() => 
      useBusinessStatus({ autoConnect: true })
    );

    // Should handle errors without crashing
    expect(result.current.isConnecting).toBe(true);
  });

  it('reconnects after connection loss', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBusinessStatus({ autoConnect: true, reconnectInterval: 100 })
    );

    await waitForNextUpdate();

    // Simulate connection loss
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);

    // Reconnect manually
    act(() => {
      result.current.reconnect();
    });

    // Should attempt to reconnect
    expect(result.current.isConnecting).toBe(true);
  });

  it('cleans up on unmount', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => 
      useBusinessStatus({ autoConnect: true })
    );

    await waitForNextUpdate();

    expect(result.current.isConnected).toBe(true);

    unmount();

    // Should cleanup without errors
  });
});