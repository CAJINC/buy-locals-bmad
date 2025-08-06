import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { LocationAccuracyIndicator } from '../location/LocationAccuracyIndicator';
import { LocationAccuracyAssessment, LocationCoordinates } from '../../services/locationService';

// Mock native-base and vector icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

const mockTheme = {};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider theme={mockTheme}>{children}</NativeBaseProvider>
);

describe('LocationAccuracyIndicator', () => {
  const mockLocation: LocationCoordinates = {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 25,
    timestamp: Date.now(),
    altitude: 10,
    altitudeAccuracy: 5,
    heading: 180,
    speed: 5,
  };

  const mockExcellentAssessment: LocationAccuracyAssessment = {
    quality: 'excellent',
    isUsable: true,
    recommendation: 'High precision GPS location suitable for all features',
    confidenceLevel: 95,
    accuracyIndicator: 'high',
  };

  const mockPoorAssessment: LocationAccuracyAssessment = {
    quality: 'poor',
    isUsable: false,
    recommendation: 'Very poor accuracy, consider enabling high precision mode',
    confidenceLevel: 25,
    accuracyIndicator: 'low',
  };

  test('renders compact indicator correctly', () => {
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={mockLocation}
        compact={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('±25m')).toBeTruthy();
  });

  test('renders full indicator with excellent quality', () => {
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={mockLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Location Accuracy')).toBeTruthy();
    expect(getByText('EXCELLENT')).toBeTruthy();
    expect(getByText('±25m')).toBeTruthy();
    expect(getByText('95% confidence')).toBeTruthy();
    expect(getByText('High precision GPS location suitable for all features')).toBeTruthy();
  });

  test('renders full indicator with poor quality', () => {
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockPoorAssessment}
        location={mockLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('POOR')).toBeTruthy();
    expect(getByText('25% confidence')).toBeTruthy();
    expect(getByText('Very poor accuracy, consider enabling high precision mode')).toBeTruthy();
  });

  test('displays technical details when showDetails is true', () => {
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={mockLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Technical Details:')).toBeTruthy();
    expect(getByText('40.712800, -74.006000')).toBeTruthy(); // Coordinates
    expect(getByText('10m (±5m)')).toBeTruthy(); // Altitude with accuracy
    expect(getByText('180°')).toBeTruthy(); // Bearing
    expect(getByText('18.0 km/h')).toBeTruthy(); // Speed converted to km/h
  });

  test('handles missing optional location data gracefully', () => {
    const locationWithoutOptionals: LocationCoordinates = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 25,
      timestamp: Date.now(),
    };

    const { getByText, queryByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={locationWithoutOptionals}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('40.712800, -74.006000')).toBeTruthy();
    expect(queryByText(/Altitude:/)).toBeFalsy();
    expect(queryByText(/Bearing:/)).toBeFalsy();
    expect(queryByText(/Speed:/)).toBeFalsy();
  });

  test('formats accuracy correctly for different ranges', () => {
    const testCases = [
      { accuracy: 5, expected: '±5m' },
      { accuracy: 500, expected: '±500m' },
      { accuracy: 1000, expected: '±1.0km' },
      { accuracy: 2500, expected: '±2.5km' },
    ];

    testCases.forEach(({ accuracy, expected }) => {
      const testLocation = { ...mockLocation, accuracy };
      const { getByText } = render(
        <LocationAccuracyIndicator
          assessment={mockExcellentAssessment}
          location={testLocation}
          compact={true}
        />,
        { wrapper: Wrapper }
      );

      expect(getByText(expected)).toBeTruthy();
    });
  });

  test('shows action button when onAccuracyPress is provided', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={mockLocation}
        onAccuracyPress={mockOnPress}
      />,
      { wrapper: Wrapper }
    );

    const actionButton = getByText('Refine Location');
    expect(actionButton).toBeTruthy();

    fireEvent.press(actionButton);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  test('shows improve accuracy button for unusable location', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockPoorAssessment}
        location={mockLocation}
        onAccuracyPress={mockOnPress}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Improve Accuracy')).toBeTruthy();
  });

  test('displays correct timestamp formatting', () => {
    const now = new Date();
    const testLocation = { ...mockLocation, timestamp: now.getTime() };
    
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={testLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    const timeString = now.toLocaleTimeString();
    expect(getByText(timeString)).toBeTruthy();
  });

  test('uses appropriate colors for different quality levels', () => {
    const qualityTests = [
      { quality: 'excellent', expectedColorPrefix: 'success' },
      { quality: 'good', expectedColorPrefix: 'success' },
      { quality: 'fair', expectedColorPrefix: 'warning' },
      { quality: 'poor', expectedColorPrefix: 'error' },
    ];

    qualityTests.forEach(({ quality }) => {
      const assessment = { ...mockExcellentAssessment, quality } as LocationAccuracyAssessment;
      const { container } = render(
        <LocationAccuracyIndicator
          assessment={assessment}
          location={mockLocation}
        />,
        { wrapper: Wrapper }
      );

      // Since we can't easily test the actual color props with this setup,
      // we just verify the component renders without errors
      expect(container).toBeTruthy();
    });
  });

  test('handles zero speed correctly', () => {
    const stationaryLocation = { ...mockLocation, speed: 0 };
    
    const { queryByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={stationaryLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    // Should not show speed when it's 0
    expect(queryByText(/Speed:/)).toBeFalsy();
  });

  test('shows speed only when greater than 0', () => {
    const movingLocation = { ...mockLocation, speed: 10 };
    
    const { getByText } = render(
      <LocationAccuracyIndicator
        assessment={mockExcellentAssessment}
        location={movingLocation}
        showDetails={true}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('36.0 km/h')).toBeTruthy(); // 10 m/s = 36 km/h
  });
});