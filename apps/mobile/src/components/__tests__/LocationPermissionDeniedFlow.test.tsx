import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { Linking } from 'react-native';
import { LocationPermissionDeniedFlow } from '../location/LocationPermissionDeniedFlow';
import { LocationPermissionDeniedFlow as LocationPermissionDeniedFlowType } from '../../services/locationService';

// Mock react-native Linking
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: {
    openURL: jest.fn(),
    openSettings: jest.fn(),
  },
}));

// Mock native-base and vector icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

const mockTheme = {};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider theme={mockTheme}>{children}</NativeBaseProvider>
);

describe('LocationPermissionDeniedFlow', () => {
  const mockSoftDenialFlow: LocationPermissionDeniedFlowType = {
    denialType: 'soft',
    canRetry: true,
    fallbackOptions: ['ip_location', 'manual_entry', 'zip_code'],
    userEducationShown: false,
    systemSettingsPrompted: false,
    retryAttempts: 1,
    maxRetryAttempts: 3,
  };

  const mockHardDenialFlow: LocationPermissionDeniedFlowType = {
    denialType: 'hard',
    canRetry: true,
    fallbackOptions: ['ip_location', 'manual_entry', 'zip_code', 'city_selection'],
    userEducationShown: true,
    systemSettingsPrompted: false,
    retryAttempts: 2,
    maxRetryAttempts: 3,
  };

  const mockSystemSettingsDenialFlow: LocationPermissionDeniedFlowType = {
    denialType: 'system_settings',
    canRetry: false,
    fallbackOptions: ['manual_entry', 'zip_code', 'city_selection'],
    userEducationShown: true,
    systemSettingsPrompted: true,
    retryAttempts: 3,
    maxRetryAttempts: 3,
  };

  const defaultProps = {
    permissionFlow: mockSoftDenialFlow,
    onRetryPermission: jest.fn(),
    onUseIPLocation: jest.fn(),
    onManualEntry: jest.fn(),
    onZipCodeEntry: jest.fn(),
    onCitySelection: jest.fn(),
    onSettingsOpen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders soft denial flow correctly', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    expect(getByText('Location Access Denied')).toBeTruthy();
    expect(getByText('Temporary')).toBeTruthy();
    expect(getByText('Continue Without GPS')).toBeTruthy();
    expect(getByText('Use Approximate Location (IP-based)')).toBeTruthy();
    expect(getByText('Enter Address Manually')).toBeTruthy();
    expect(getByText('Enter ZIP Code')).toBeTruthy();
    expect(getByText('Request Permission Again')).toBeTruthy();
  });

  test('renders hard denial flow with additional options', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockHardDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Repeated')).toBeTruthy();
    expect(getByText('Browse by City')).toBeTruthy(); // Additional option for hard denial
    expect(getByText('Attempts: 2/3')).toBeTruthy();
  });

  test('renders system settings denial flow', () => {
    const { getByText, queryByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockSystemSettingsDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Permanent')).toBeTruthy();
    expect(getByText('Enable in Settings')).toBeTruthy();
    expect(getByText('Open Settings')).toBeTruthy();
    
    // Should not show IP location option for system settings denial
    expect(queryByText('Use Approximate Location (IP-based)')).toBeFalsy();
    
    // Should not show retry button
    expect(queryByText('Request Permission Again')).toBeFalsy();
  });

  test('shows educational content when not shown before', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    expect(getByText('Why Location Access?')).toBeTruthy();
    expect(getByText(/Buy Locals uses your location/)).toBeTruthy();
  });

  test('hides educational content when already shown', () => {
    const flowWithEducation = { ...mockSoftDenialFlow, userEducationShown: true };
    const { queryByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={flowWithEducation}
      />,
      { wrapper: Wrapper }
    );

    expect(queryByText('Why Location Access?')).toBeFalsy();
  });

  test('handles fallback option callbacks correctly', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    fireEvent.press(getByText('Use Approximate Location (IP-based)'));
    expect(defaultProps.onUseIPLocation).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Enter Address Manually'));
    expect(defaultProps.onManualEntry).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Enter ZIP Code'));
    expect(defaultProps.onZipCodeEntry).toHaveBeenCalledTimes(1);
  });

  test('handles retry permission correctly', async () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    const retryButton = getByText('Request Permission Again');
    fireEvent.press(retryButton);

    await waitFor(() => {
      expect(defaultProps.onRetryPermission).toHaveBeenCalledTimes(1);
    });
  });

  test('disables retry button when cannot retry', () => {
    const noRetryFlow = { ...mockSoftDenialFlow, canRetry: false };
    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={noRetryFlow}
      />,
      { wrapper: Wrapper }
    );

    const retryButton = getByText('Request Permission Again');
    expect(retryButton.props.accessibilityState?.disabled).toBe(true);
  });

  test('opens device settings on iOS', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockSystemSettingsDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.press(getByText('Open Settings'));
    
    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
    expect(defaultProps.onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  test('opens device settings on Android', () => {
    // Mock Platform.OS to be android
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      Linking: {
        openURL: jest.fn(),
        openSettings: jest.fn(),
      },
    }));

    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockSystemSettingsDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.press(getByText('Open Settings'));
    
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  test('displays correct progress bar for retry attempts', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockHardDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Attempts: 2/3')).toBeTruthy();
    // Progress bar should show 66.67% (2/3)
  });

  test('handles city selection callback for hard denial', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={mockHardDenialFlow}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.press(getByText('Browse by City'));
    expect(defaultProps.onCitySelection).toHaveBeenCalledTimes(1);
  });

  test('does not render missing fallback options', () => {
    const limitedFlow = {
      ...mockSoftDenialFlow,
      fallbackOptions: ['manual_entry'] as ('ip_location' | 'manual_entry' | 'zip_code' | 'city_selection')[],
    };

    const { getByText, queryByText } = render(
      <LocationPermissionDeniedFlow
        {...defaultProps}
        permissionFlow={limitedFlow}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Enter Address Manually')).toBeTruthy();
    expect(queryByText('Use Approximate Location (IP-based)')).toBeFalsy();
    expect(queryByText('Enter ZIP Code')).toBeFalsy();
    expect(queryByText('Browse by City')).toBeFalsy();
  });

  test('shows loading state during retry', async () => {
    let resolveRetry: () => void;
    const retryPromise = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    
    const slowRetryProps = {
      ...defaultProps,
      onRetryPermission: jest.fn().mockReturnValue(retryPromise),
    };

    const { getByText } = render(
      <LocationPermissionDeniedFlow {...slowRetryProps} />,
      { wrapper: Wrapper }
    );

    const retryButton = getByText('Request Permission Again');
    fireEvent.press(retryButton);

    // Button should show loading state
    await waitFor(() => {
      expect(retryButton.props.accessibilityState?.disabled).toBe(true);
    });

    // Resolve the promise to clear loading state
    resolveRetry!();
    
    await waitFor(() => {
      expect(slowRetryProps.onRetryPermission).toHaveBeenCalledTimes(1);
    });
  });

  test('dismisses educational content correctly', () => {
    const { getByText, queryByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    expect(getByText('Why Location Access?')).toBeTruthy();
    
    fireEvent.press(getByText("Got it, don't show again"));
    
    expect(queryByText('Why Location Access?')).toBeFalsy();
  });

  test('renders privacy notice', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    expect(getByText(/Your privacy is important to us/)).toBeTruthy();
  });

  test('shows warning alert about manual specification', () => {
    const { getByText } = render(
      <LocationPermissionDeniedFlow {...defaultProps} />,
      { wrapper: Wrapper }
    );

    expect(getByText(/Without location access, you'll need to manually specify/)).toBeTruthy();
  });
});