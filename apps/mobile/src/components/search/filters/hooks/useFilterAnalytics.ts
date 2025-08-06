import { useCallback, useRef } from 'react';
import { FilterState, FilterAnalyticsEvent } from '../FilterPanel/types';

interface UseFilterAnalyticsOptions {
  sessionId?: string;
  enableTracking?: boolean;
  onEvent?: (event: FilterAnalyticsEvent) => void;
}

interface UseFilterAnalyticsReturn {
  trackFilterApply: (filters: FilterState, resultCount: number) => void;
  trackFilterClear: () => void;
  trackPresetSelect: (presetId: string, filters: FilterState) => void;
  trackIndividualFilter: (filterType: string, filterValue: any) => void;
  trackFilterEvent: (event: Partial<FilterAnalyticsEvent>) => void;
}

export const useFilterAnalytics = ({
  sessionId = generateSessionId(),
  enableTracking = true,
  onEvent,
}: UseFilterAnalyticsOptions = {}): UseFilterAnalyticsReturn => {
  const sessionRef = useRef(sessionId);
  const eventCountRef = useRef(0);

  // Create analytics event
  const createEvent = useCallback((
    action: FilterAnalyticsEvent['action'],
    additionalData: Partial<FilterAnalyticsEvent> = {}
  ): FilterAnalyticsEvent => {
    eventCountRef.current += 1;
    
    return {
      action,
      timestamp: Date.now(),
      sessionId: sessionRef.current,
      ...additionalData,
    };
  }, []);

  // Send event to tracking service
  const sendEvent = useCallback((event: FilterAnalyticsEvent) => {
    if (!enableTracking) return;

    // Send to custom handler if provided
    if (onEvent) {
      onEvent(event);
    }

    // Send to analytics service (implement based on your analytics provider)
    trackAnalyticsEvent(event);
  }, [enableTracking, onEvent]);

  // Track filter application
  const trackFilterApply = useCallback((filters: FilterState, resultCount: number) => {
    const event = createEvent('apply', {
      filterValue: filters,
      resultCount,
    });
    
    sendEvent(event);
  }, [createEvent, sendEvent]);

  // Track filter clear
  const trackFilterClear = useCallback(() => {
    const event = createEvent('clear');
    sendEvent(event);
  }, [createEvent, sendEvent]);

  // Track preset selection
  const trackPresetSelect = useCallback((presetId: string, filters: FilterState) => {
    const event = createEvent('preset_select', {
      filterType: 'preset',
      filterValue: {
        presetId,
        filters,
      },
    });
    
    sendEvent(event);
  }, [createEvent, sendEvent]);

  // Track individual filter changes
  const trackIndividualFilter = useCallback((filterType: string, filterValue: any) => {
    const event = createEvent('individual_filter', {
      filterType,
      filterValue,
    });
    
    sendEvent(event);
  }, [createEvent, sendEvent]);

  // Track generic filter event
  const trackFilterEvent = useCallback((eventData: Partial<FilterAnalyticsEvent>) => {
    const event = createEvent(eventData.action || 'individual_filter', eventData);
    sendEvent(event);
  }, [createEvent, sendEvent]);

  return {
    trackFilterApply,
    trackFilterClear,
    trackPresetSelect,
    trackIndividualFilter,
    trackFilterEvent,
  };
};

// Generate unique session ID
function generateSessionId(): string {
  return `filter_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Analytics event tracking function (implement based on your analytics provider)
function trackAnalyticsEvent(event: FilterAnalyticsEvent) {
  // Example implementations:
  
  // Firebase Analytics
  // analytics().logEvent('filter_interaction', {
  //   action: event.action,
  //   filter_type: event.filterType,
  //   result_count: event.resultCount,
  //   session_id: event.sessionId,
  // });
  
  // Mixpanel
  // mixpanel.track('Filter Interaction', {
  //   action: event.action,
  //   filterType: event.filterType,
  //   filterValue: event.filterValue,
  //   resultCount: event.resultCount,
  //   timestamp: event.timestamp,
  //   sessionId: event.sessionId,
  // });
  
  // Amplitude
  // amplitude.getInstance().logEvent('Filter Interaction', {
  //   action: event.action,
  //   filter_type: event.filterType,
  //   result_count: event.resultCount,
  //   session_id: event.sessionId,
  // });
  
  // Console logging for development
  if (__DEV__) {
    console.log('Filter Analytics Event:', {
      action: event.action,
      filterType: event.filterType,
      resultCount: event.resultCount,
      sessionId: event.sessionId,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  }
  
  // Custom analytics endpoint
  // fetch('/api/analytics/filter-events', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event),
  // });
}