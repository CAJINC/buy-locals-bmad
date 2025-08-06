import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessHoursDisplay } from '../BusinessHoursDisplay';
import { EnhancedBusinessHours } from '../types';

// Mock Expo vector icons
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Test wrapper with NativeBase provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('BusinessHoursDisplay', () => {
  const mockBasicHours = {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '16:00' },
    sunday: { closed: true },
  };

  const mockEnhancedHours: EnhancedBusinessHours = {
    ...mockBasicHours,
    timezone: 'America/New_York',
    specialHours: {
      '2025-12-25': {
        open: '00:00',
        close: '00:00',
        isClosed: true,
        reason: 'Christmas Day',
      },
      '2025-12-31': {
        open: '09:00',
        close: '14:00',
        isClosed: false,
        reason: 'New Year\'s Eve',
      },
    },
    temporaryClosures: [
      {
        startDate: '2025-01-15',
        endDate: '2025-01-17',
        reason: 'Renovation',
      },
    ],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    // Set test time to Tuesday 2:00 PM
    jest.setSystemTime(new Date('2025-01-07T14:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('renders basic hours correctly', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={mockBasicHours} />
        </TestWrapper>
      );

      expect(getByText('Monday')).toBeTruthy();
      expect(getByText('9:00 AM - 5:00 PM')).toBeTruthy();
      expect(getByText('Closed')).toBeTruthy();
    });

    it('shows current status when enabled', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={mockBasicHours} showCurrentStatus={true} />
        </TestWrapper>
      );

      expect(getByText('Open Now')).toBeTruthy();
    });

    it('displays compact view correctly', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={mockBasicHours} compact={true} />
        </TestWrapper>
      );

      expect(getByText('Mon')).toBeTruthy();
      expect(getByText('Sun')).toBeTruthy();
    });
  });

  describe('Enhanced Features', () => {
    it('handles special hours correctly', () => {
      // Mock date to Christmas
      jest.setSystemTime(new Date('2025-12-25T10:00:00.000Z'));

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockEnhancedHours} 
            showCurrentStatus={true}
            showSpecialHours={true}
          />
        </TestWrapper>
      );

      expect(getByText('Closed')).toBeTruthy();
    });

    it('shows countdown timer when enabled', async () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            showCurrentStatus={true}
            showCountdown={true}
          />
        </TestWrapper>
      );

      // Should show closing countdown since it's currently open
      expect(getByText(/Closes in/)).toBeTruthy();
    });

    it('displays timezone information', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockEnhancedHours} 
            showTimezone={true}
          />
        </TestWrapper>
      );

      expect(getByText(/Times shown in/)).toBeTruthy();
    });

    it('handles expandable functionality', () => {
      const { getByRole, queryByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            compact={true}
            expandable={true}
            showCurrentStatus={true}
          />
        </TestWrapper>
      );

      // Initially expanded for compact view
      expect(queryByText('Monday')).toBeTruthy();

      // Find and tap the expand/collapse button
      const expandButton = getByRole('button');
      fireEvent.press(expandButton);

      // Should still be visible after first press (toggle)
      expect(queryByText('Monday')).toBeTruthy();
    });
  });

  describe('Status Calculations', () => {
    it('correctly identifies open status during business hours', () => {
      // Tuesday 2:00 PM
      jest.setSystemTime(new Date('2025-01-07T14:00:00.000Z'));

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={mockBasicHours} showCurrentStatus={true} />
        </TestWrapper>
      );

      expect(getByText('Open Now')).toBeTruthy();
    });

    it('correctly identifies closed status outside business hours', () => {
      // Tuesday 6:00 PM (after closing)
      jest.setSystemTime(new Date('2025-01-07T18:00:00.000Z'));

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={mockBasicHours} showCurrentStatus={true} />
        </TestWrapper>
      );

      expect(getByText('Closed')).toBeTruthy();
    });

    it('handles 24-hour businesses correctly', () => {
      const twentyFourHourHours = {
        monday: { open: '00:00', close: '23:59' },
        tuesday: { open: '00:00', close: '23:59' },
        wednesday: { open: '00:00', close: '23:59' },
        thursday: { open: '00:00', close: '23:59' },
        friday: { open: '00:00', close: '23:59' },
        saturday: { open: '00:00', close: '23:59' },
        sunday: { open: '00:00', close: '23:59' },
      };

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={twentyFourHourHours} showCurrentStatus={true} />
        </TestWrapper>
      );

      expect(getByText('Open Now')).toBeTruthy();
      expect(getByText('24 Hours')).toBeTruthy();
    });

    it('handles overnight businesses correctly', () => {
      const overnightHours = {
        monday: { open: '22:00', close: '06:00' },
        tuesday: { open: '22:00', close: '06:00' },
        wednesday: { open: '22:00', close: '06:00' },
        thursday: { open: '22:00', close: '06:00' },
        friday: { open: '22:00', close: '06:00' },
        saturday: { open: '22:00', close: '06:00' },
        sunday: { open: '22:00', close: '06:00' },
      };

      // Test at 11 PM (should be open)
      jest.setSystemTime(new Date('2025-01-07T23:00:00.000Z'));

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={overnightHours} showCurrentStatus={true} />
        </TestWrapper>
      );

      expect(getByText('Open Now')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('handles invalid hours gracefully', () => {
      const invalidHours = {
        monday: { open: '25:00', close: '17:00' }, // Invalid hour
        tuesday: { open: '09:00', close: '65:00' }, // Invalid minute
      };

      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={invalidHours} />
        </TestWrapper>
      );

      // Should still render without crashing
      expect(getByText('Monday')).toBeTruthy();
    });

    it('displays error message for completely invalid data', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={null as any} />
        </TestWrapper>
      );

      expect(getByText(/Business hours not available/)).toBeTruthy();
    });

    it('handles missing hours data', () => {
      const { getByText } = render(
        <TestWrapper>
          <BusinessHoursDisplay hours={{}} />
        </TestWrapper>
      );

      expect(getByText(/Business hours not available/)).toBeTruthy();
    });
  });

  describe('Real-time Updates', () => {
    it('updates status in real-time', async () => {
      const { getByText, rerender } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            showCurrentStatus={true}
            refreshInterval={1000}
          />
        </TestWrapper>
      );

      expect(getByText('Open Now')).toBeTruthy();

      // Fast forward time to after closing
      act(() => {
        jest.setSystemTime(new Date('2025-01-07T18:00:00.000Z'));
        jest.advanceTimersByTime(1000);
      });

      // Re-render to trigger update
      rerender(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            showCurrentStatus={true}
            refreshInterval={1000}
          />
        </TestWrapper>
      );

      expect(getByText('Closed')).toBeTruthy();
    });
  });

  describe('Callback Functions', () => {
    it('calls onStatusChange when status changes', () => {
      const mockOnStatusChange = jest.fn();

      render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            showCurrentStatus={true}
            onStatusChange={mockOnStatusChange}
          />
        </TestWrapper>
      );

      expect(mockOnStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          status: 'open',
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('provides proper accessibility labels', () => {
      const { getByRole } = render(
        <TestWrapper>
          <BusinessHoursDisplay 
            hours={mockBasicHours} 
            showCurrentStatus={true}
            expandable={true}
          />
        </TestWrapper>
      );

      expect(getByRole('button')).toBeTruthy();
    });
  });
});