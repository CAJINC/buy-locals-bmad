import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BusinessHoursManagementScreen } from '../BusinessHoursManagementScreen';
import { BusinessService } from '../../services/businessService';
import { NotificationService } from '../../services/notificationService';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useFocusEffect: jest.fn(),
}));

// Mock services
jest.mock('../../services/businessService');
jest.mock('../../services/notificationService');

// Mock components
jest.mock('../../components/hours/BusinessHoursEditor', () => ({
  BusinessHoursEditor: ({ onSave, onCancel, testID }: any) => (
    <div testID={testID}>
      <button testID={`${testID}-save`} onPress={() => onSave({})} />
      <button testID={`${testID}-cancel`} onPress={onCancel} />
    </div>
  ),
}));

jest.mock('../../components/hours/SpecialHoursManager', () => ({
  SpecialHoursManager: ({ onSave, onCancel, testID }: any) => (
    <div testID={testID}>
      <button testID={`${testID}-save`} onPress={() => onSave([])} />
      <button testID={`${testID}-cancel`} onPress={onCancel} />
    </div>
  ),
}));

jest.mock('../../components/hours/WeeklySchedule', () => ({
  WeeklySchedule: ({ testID }: any) => <div testID={testID} />,
}));

jest.mock('../../components/hours/BusinessHoursDisplay', () => ({
  BusinessHoursDisplay: ({ testID }: any) => <div testID={testID} />,
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockBusinessService = BusinessService as jest.MockedClass<typeof BusinessService>;
const mockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('BusinessHoursManagementScreen', () => {
  const mockRoute = {
    params: {
      businessId: 'test-business-id',
    },
  };

  const mockBusinessInfo = {
    id: 'test-business-id',
    name: 'Test Business',
    timezone: 'America/New_York',
    isCurrentlyOpen: true,
  };

  const mockHours = {
    monday: { closed: false, open: '09:00', close: '17:00' },
    tuesday: { closed: false, open: '09:00', close: '17:00' },
    wednesday: { closed: false, open: '09:00', close: '17:00' },
    thursday: { closed: false, open: '09:00', close: '17:00' },
    friday: { closed: false, open: '09:00', close: '17:00' },
    saturday: { closed: true },
    sunday: { closed: true },
  };

  const mockSpecialHours = [
    {
      id: '1',
      businessId: 'test-business-id',
      name: 'Christmas Day',
      date: '2024-12-25',
      isActive: true,
      closed: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useFocusEffect to call the callback immediately
    (useFocusEffect as jest.Mock).mockImplementation((callback) => callback());

    // Setup service mocks
    mockBusinessService.mockImplementation(() => ({
      getBusinessInfo: jest.fn().mockResolvedValue(mockBusinessInfo),
      getBusinessHours: jest.fn().mockResolvedValue(mockHours),
      getSpecialHours: jest.fn().mockResolvedValue(mockSpecialHours),
      updateBusinessHours: jest.fn().mockResolvedValue(undefined),
      updateSpecialHours: jest.fn().mockResolvedValue(undefined),
      setBusinessStatus: jest.fn().mockResolvedValue(undefined),
    }));

    mockNotificationService.mockImplementation(() => ({
      sendBusinessHoursUpdateNotification: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      const { getByText } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      expect(getByText('Loading business hours...')).toBeTruthy();
    });

    it('should render main screen after loading', async () => {
      const { getByTestId, getByText } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByTestId('business-hours-management-screen')).toBeTruthy();
        expect(getByText('Business Hours')).toBeTruthy();
        expect(getByText('Test Business')).toBeTruthy();
      });
    });

    it('should show back button', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is pressed', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const backButton = getByTestId('back-button');
        fireEvent.press(backButton);
      });
      
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Data Loading', () => {
    it('should load business data on mount', async () => {
      const mockGetBusinessInfo = jest.fn().mockResolvedValue(mockBusinessInfo);
      const mockGetBusinessHours = jest.fn().mockResolvedValue(mockHours);
      const mockGetSpecialHours = jest.fn().mockResolvedValue(mockSpecialHours);

      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: mockGetBusinessInfo,
        getBusinessHours: mockGetBusinessHours,
        getSpecialHours: mockGetSpecialHours,
        updateBusinessHours: jest.fn(),
        updateSpecialHours: jest.fn(),
        setBusinessStatus: jest.fn(),
      }));

      render(<BusinessHoursManagementScreen route={mockRoute} />);
      
      await waitFor(() => {
        expect(mockGetBusinessInfo).toHaveBeenCalledWith('test-business-id');
        expect(mockGetBusinessHours).toHaveBeenCalledWith('test-business-id');
        expect(mockGetSpecialHours).toHaveBeenCalledWith('test-business-id');
      });
    });

    it('should handle loading errors', async () => {
      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: jest.fn().mockRejectedValue(new Error('Load failed')),
        getBusinessHours: jest.fn().mockRejectedValue(new Error('Load failed')),
        getSpecialHours: jest.fn().mockRejectedValue(new Error('Load failed')),
        updateBusinessHours: jest.fn(),
        updateSpecialHours: jest.fn(),
        setBusinessStatus: jest.fn(),
      }));

      render(<BusinessHoursManagementScreen route={mockRoute} />);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load business information. Please try again.',
          expect.any(Array)
        );
      });
    });
  });

  describe('Mode Management', () => {
    it('should start in overview mode', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByTestId('weekly-schedule-display')).toBeTruthy();
      });
    });

    it('should switch to edit hours mode', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const editButton = getByTestId('edit-hours-button');
        fireEvent.press(editButton);
      });
      
      expect(getByTestId('business-hours-editor')).toBeTruthy();
    });

    it('should switch to special hours mode', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const editButton = getByTestId('edit-special-hours-button');
        fireEvent.press(editButton);
      });
      
      expect(getByTestId('special-hours-manager')).toBeTruthy();
    });
  });

  describe('Quick Toggle', () => {
    it('should show quick toggle button', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByTestId('quick-toggle-button')).toBeTruthy();
      });
    });

    it('should show Close Now when business is open', async () => {
      const { getByText } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByText('Close Now')).toBeTruthy();
      });
    });

    it('should show Open Now when business is closed', async () => {
      const closedBusinessInfo = { ...mockBusinessInfo, isCurrentlyOpen: false };
      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: jest.fn().mockResolvedValue(closedBusinessInfo),
        getBusinessHours: jest.fn().mockResolvedValue(mockHours),
        getSpecialHours: jest.fn().mockResolvedValue(mockSpecialHours),
        updateBusinessHours: jest.fn(),
        updateSpecialHours: jest.fn(),
        setBusinessStatus: jest.fn(),
      }));

      const { getByText } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        expect(getByText('Open Now')).toBeTruthy();
      });
    });

    it('should show confirmation dialog when quick toggle is pressed', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const quickToggleButton = getByTestId('quick-toggle-button');
        fireEvent.press(quickToggleButton);
      });
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Close Business',
        'Are you sure you want to close your business now?',
        expect.any(Array)
      );
    });
  });

  describe('Hours Saving', () => {
    it('should save hours and return to overview', async () => {
      const mockUpdateBusinessHours = jest.fn().mockResolvedValue(undefined);
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);

      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: jest.fn().mockResolvedValue(mockBusinessInfo),
        getBusinessHours: jest.fn().mockResolvedValue(mockHours),
        getSpecialHours: jest.fn().mockResolvedValue(mockSpecialHours),
        updateBusinessHours: mockUpdateBusinessHours,
        updateSpecialHours: jest.fn(),
        setBusinessStatus: jest.fn(),
      }));

      mockNotificationService.mockImplementation(() => ({
        sendBusinessHoursUpdateNotification: mockSendNotification,
      }));

      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      // Switch to edit mode
      await waitFor(() => {
        const editButton = getByTestId('edit-hours-button');
        fireEvent.press(editButton);
      });
      
      // Save hours
      const saveButton = getByTestId('business-hours-editor-save');
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(mockUpdateBusinessHours).toHaveBeenCalledWith('test-business-id', {});
        expect(mockSendNotification).toHaveBeenCalledWith('test-business-id', {
          type: 'hours_updated',
          message: 'Your business hours have been updated successfully.',
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          'Hours Updated',
          'Your business hours have been updated successfully.',
          expect.any(Array)
        );
      });
    });

    it('should handle hours save errors', async () => {
      const mockUpdateBusinessHours = jest.fn().mockRejectedValue(new Error('Save failed'));

      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: jest.fn().mockResolvedValue(mockBusinessInfo),
        getBusinessHours: jest.fn().mockResolvedValue(mockHours),
        getSpecialHours: jest.fn().mockResolvedValue(mockSpecialHours),
        updateBusinessHours: mockUpdateBusinessHours,
        updateSpecialHours: jest.fn(),
        setBusinessStatus: jest.fn(),
      }));

      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      // Switch to edit mode
      await waitFor(() => {
        const editButton = getByTestId('edit-hours-button');
        fireEvent.press(editButton);
      });
      
      // Save hours
      const saveButton = getByTestId('business-hours-editor-save');
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Save Failed',
          'Failed to update business hours. Please try again.',
          expect.any(Array)
        );
      });
    });
  });

  describe('Special Hours Saving', () => {
    it('should save special hours and return to overview', async () => {
      const mockUpdateSpecialHours = jest.fn().mockResolvedValue(undefined);
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);

      mockBusinessService.mockImplementation(() => ({
        getBusinessInfo: jest.fn().mockResolvedValue(mockBusinessInfo),
        getBusinessHours: jest.fn().mockResolvedValue(mockHours),
        getSpecialHours: jest.fn().mockResolvedValue(mockSpecialHours),
        updateBusinessHours: jest.fn(),
        updateSpecialHours: mockUpdateSpecialHours,
        setBusinessStatus: jest.fn(),
      }));

      mockNotificationService.mockImplementation(() => ({
        sendBusinessHoursUpdateNotification: mockSendNotification,
      }));

      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      // Switch to special hours mode
      await waitFor(() => {
        const editButton = getByTestId('edit-special-hours-button');
        fireEvent.press(editButton);
      });
      
      // Save special hours
      const saveButton = getByTestId('special-hours-manager-save');
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(mockUpdateSpecialHours).toHaveBeenCalledWith('test-business-id', []);
        expect(mockSendNotification).toHaveBeenCalledWith('test-business-id', {
          type: 'special_hours_updated',
          message: 'Your special hours have been updated successfully.',
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          'Special Hours Updated',
          'Your special hours have been updated successfully.',
          expect.any(Array)
        );
      });
    });
  });

  describe('Quick Actions', () => {
    it('should show template selection dialog', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const templateButton = getByTestId('apply-template-button');
        fireEvent.press(templateButton);
      });
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Apply Template',
        'Choose a template to quickly set up your hours',
        expect.any(Array)
      );
    });

    it('should show copy schedule dialog', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const copyButton = getByTestId('copy-schedule-button');
        fireEvent.press(copyButton);
      });
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Copy Schedule',
        'Copy this week\'s schedule to next week?',
        expect.any(Array)
      );
    });

    it('should navigate to special hours when add holiday is pressed', async () => {
      const { getByTestId } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      await waitFor(() => {
        const holidayButton = getByTestId('add-holiday-button');
        fireEvent.press(holidayButton);
      });
      
      expect(getByTestId('special-hours-manager')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      const { getByText } = render(
        <BusinessHoursManagementScreen route={mockRoute} />
      );
      
      // Should still show loading initially
      expect(getByText('Loading business hours...')).toBeTruthy();
    });
  });
});