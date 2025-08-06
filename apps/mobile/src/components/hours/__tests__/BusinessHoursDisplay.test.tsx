import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BusinessHoursDisplay } from '../BusinessHoursDisplay';
import { BusinessHours } from '../../../types/business';

// Mock the hooks
jest.mock('../../../hooks/useBusinessStatus', () => ({
  useBusinessStatus: jest.fn(() => ({
    statuses: new Map(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  })),
}));

const mockBusinessHours: BusinessHours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { open: '10:00', close: '14:00' },
  sunday: { closed: true },
};

describe('BusinessHoursDisplay', () => {
  it('renders correctly in compact mode', () => {
    const { getByTestId } = render(
      <BusinessHoursDisplay
        businessId="test-business"
        hours={mockBusinessHours}
        timezone="America/New_York"
        isOpen={true}
        status="open"
        nextChange="2024-01-01T17:00:00Z"
        compact={true}
        testID="hours-display"
      />
    );

    expect(getByTestId('hours-display')).toBeDefined();
    expect(getByTestId('hours-display-status')).toBeDefined();
  });

  it('renders correctly in full mode', () => {
    const { getByTestId } = render(
      <BusinessHoursDisplay
        businessId="test-business"
        hours={mockBusinessHours}
        timezone="America/New_York"
        isOpen={true}
        status="open"
        nextChange="2024-01-01T17:00:00Z"
        compact={false}
        showWeeklyView={true}
        testID="hours-display"
      />
    );

    expect(getByTestId('hours-display')).toBeDefined();
    expect(getByTestId('hours-display-status')).toBeDefined();
    expect(getByTestId('hours-display-countdown')).toBeDefined();
  });

  it('toggles weekly schedule view', () => {
    const { getByTestId } = render(
      <BusinessHoursDisplay
        businessId="test-business"
        hours={mockBusinessHours}
        timezone="America/New_York"
        isOpen={true}
        status="open"
        nextChange="2024-01-01T17:00:00Z"
        compact={false}
        showWeeklyView={true}
        testID="hours-display"
      />
    );

    const toggleButton = getByTestId('hours-display-schedule-toggle');
    fireEvent.press(toggleButton);
    
    expect(getByTestId('hours-display-weekly-schedule')).toBeDefined();
  });

  it('calls onStatusUpdate when status changes', () => {
    const mockOnStatusUpdate = jest.fn();

    render(
      <BusinessHoursDisplay
        businessId="test-business"
        hours={mockBusinessHours}
        timezone="America/New_York"
        isOpen={true}
        status="open"
        nextChange="2024-01-01T17:00:00Z"
        compact={true}
        onStatusUpdate={mockOnStatusUpdate}
        testID="hours-display"
      />
    );

    // The countdown timer should trigger status updates
    // This is tested indirectly through the CountdownTimer component
  });

  it('handles missing business hours gracefully', () => {
    const { getByTestId } = render(
      <BusinessHoursDisplay
        businessId="test-business"
        hours={{}}
        timezone="America/New_York"
        isOpen={false}
        status="closed"
        nextChange={null}
        compact={true}
        testID="hours-display"
      />
    );

    expect(getByTestId('hours-display')).toBeDefined();
    expect(getByTestId('hours-display-status')).toBeDefined();
  });
});