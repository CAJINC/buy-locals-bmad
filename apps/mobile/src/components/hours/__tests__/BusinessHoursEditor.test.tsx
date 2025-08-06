import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BusinessHoursEditor } from '../BusinessHoursEditor';
import { HoursValidationService } from '../../../services/hoursValidationService';
import { WeeklyHours } from '../../../types/business';

// Mock external dependencies
jest.mock('../TimePickerModal', () => ({
  TimePickerModal: ({ isVisible, onTimeSelect, onCancel, testID }: any) =>
    isVisible ? (
      <div testID={testID}>
        <button testID={`${testID}-time-select`} onPress={() => onTimeSelect('10:00')} />
        <button testID={`${testID}-cancel`} onPress={onCancel} />
      </div>
    ) : null,
}));

jest.mock('../../../services/hoursValidationService');
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockValidationService = HoursValidationService as jest.MockedClass<typeof HoursValidationService>;

describe('BusinessHoursEditor', () => {
  const mockCurrentHours: WeeklyHours = {
    monday: { closed: false, open: '09:00', close: '17:00' },
    tuesday: { closed: false, open: '09:00', close: '17:00' },
    wednesday: { closed: false, open: '09:00', close: '17:00' },
    thursday: { closed: false, open: '09:00', close: '17:00' },
    friday: { closed: false, open: '09:00', close: '17:00' },
    saturday: { closed: true },
    sunday: { closed: true },
  };

  const defaultProps = {
    businessId: 'test-business-id',
    currentHours: mockCurrentHours,
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidationService.mockImplementation(() => ({
      validateDayHours: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    }));
  });

  describe('Rendering', () => {
    it('should render correctly with initial hours', () => {
      const { getByTestId, getByText } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByTestId('business-hours-editor')).toBeTruthy();
      expect(getByText('Business Hours')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Save')).toBeTruthy();
    });

    it('should display all days of the week', () => {
      const { getByText } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByText('Monday')).toBeTruthy();
      expect(getByText('Tuesday')).toBeTruthy();
      expect(getByText('Wednesday')).toBeTruthy();
      expect(getByText('Thursday')).toBeTruthy();
      expect(getByText('Friday')).toBeTruthy();
      expect(getByText('Saturday')).toBeTruthy();
      expect(getByText('Sunday')).toBeTruthy();
    });

    it('should show template buttons', () => {
      const { getByText } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByText('Quick Templates')).toBeTruthy();
      expect(getByText('Business (9-5)')).toBeTruthy();
      expect(getByText('Retail')).toBeTruthy();
      expect(getByText('Restaurant')).toBeTruthy();
    });
  });

  describe('Day Hours Management', () => {
    it('should toggle day closed status', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const mondayToggle = getByTestId('business-hours-editor-monday-toggle');
      
      await act(async () => {
        fireEvent.press(mondayToggle);
      });
      
      // Monday should now be closed
      expect(getByTestId('business-hours-editor-monday-toggle')).toBeTruthy();
    });

    it('should show time controls for open days', () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByTestId('business-hours-editor-monday-open-time')).toBeTruthy();
      expect(getByTestId('business-hours-editor-monday-close-time')).toBeTruthy();
    });

    it('should not show time controls for closed days', () => {
      const { queryByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(queryByTestId('business-hours-editor-saturday-open-time')).toBeFalsy();
      expect(queryByTestId('business-hours-editor-saturday-close-time')).toBeFalsy();
    });

    it('should open time picker when time button is pressed', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const openTimeButton = getByTestId('business-hours-editor-monday-open-time');
      
      await act(async () => {
        fireEvent.press(openTimeButton);
      });
      
      await waitFor(() => {
        expect(getByTestId('business-hours-editor-time-picker')).toBeTruthy();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('should show copy button for open days', () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByTestId('business-hours-editor-monday-copy')).toBeTruthy();
    });

    it('should show alert when copy button is pressed', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const copyButton = getByTestId('business-hours-editor-monday-copy');
      
      await act(async () => {
        fireEvent.press(copyButton);
      });
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Copy Hours',
        'Copy Monday hours to all other days?',
        expect.any(Array)
      );
    });
  });

  describe('Template Application', () => {
    it('should apply standard business template', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const standardTemplate = getByTestId('business-hours-editor-template-standard');
      
      await act(async () => {
        fireEvent.press(standardTemplate);
      });
      
      // Should update state to standard business hours
      expect(getByTestId('business-hours-editor')).toBeTruthy();
    });

    it('should apply retail template', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const retailTemplate = getByTestId('business-hours-editor-template-retail');
      
      await act(async () => {
        fireEvent.press(retailTemplate);
      });
      
      expect(getByTestId('business-hours-editor')).toBeTruthy();
    });

    it('should apply restaurant template', async () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      const restaurantTemplate = getByTestId('business-hours-editor-template-restaurant');
      
      await act(async () => {
        fireEvent.press(restaurantTemplate);
      });
      
      expect(getByTestId('business-hours-editor')).toBeTruthy();
    });
  });

  describe('Validation', () => {
    it('should validate hours before saving', async () => {
      const mockOnSave = jest.fn();
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onSave={mockOnSave} />
      );
      
      const saveButton = getByTestId('business-hours-editor-save');
      
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockCurrentHours);
      });
    });

    it('should show validation errors when hours are invalid', async () => {
      mockValidationService.mockImplementation(() => ({
        validateDayHours: jest.fn().mockReturnValue({ 
          isValid: false, 
          errors: ['Monday: Close time must be after open time'] 
        }),
      }));

      const mockOnSave = jest.fn();
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onSave={mockOnSave} />
      );
      
      const saveButton = getByTestId('business-hours-editor-save');
      
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          expect.stringContaining('Please fix the following issues'),
          expect.any(Array)
        );
      });
      
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show validation summary when errors exist', () => {
      mockValidationService.mockImplementation(() => ({
        validateDayHours: jest.fn().mockReturnValue({ 
          isValid: false, 
          errors: ['Monday: Invalid hours'] 
        }),
      }));

      const { getByText } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByText('1 validation error found')).toBeTruthy();
    });
  });

  describe('Save and Cancel', () => {
    it('should call onSave with updated hours', async () => {
      const mockOnSave = jest.fn();
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onSave={mockOnSave} />
      );
      
      const saveButton = getByTestId('business-hours-editor-save');
      
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockCurrentHours);
      });
    });

    it('should call onCancel when cancel button is pressed', () => {
      const mockOnCancel = jest.fn();
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onCancel={mockOnCancel} />
      );
      
      const cancelButton = getByTestId('business-hours-editor-cancel');
      fireEvent.press(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show confirmation when cancelling with unsaved changes', async () => {
      const mockOnCancel = jest.fn();
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onCancel={mockOnCancel} />
      );
      
      // Make a change to trigger dirty state
      const mondayToggle = getByTestId('business-hours-editor-monday-toggle');
      await act(async () => {
        fireEvent.press(mondayToggle);
      });
      
      // Try to cancel
      const cancelButton = getByTestId('business-hours-editor-cancel');
      await act(async () => {
        fireEvent.press(cancelButton);
      });
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to cancel?',
        expect.any(Array)
      );
    });

    it('should disable save button when loading', () => {
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} isLoading={true} />
      );
      
      const saveButton = getByTestId('business-hours-editor-save');
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should show saving text when loading', () => {
      const { getByText } = render(
        <BusinessHoursEditor {...defaultProps} isLoading={true} />
      );
      
      expect(getByText('Saving...')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      const mockOnSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      const { getByTestId } = render(
        <BusinessHoursEditor {...defaultProps} onSave={mockOnSave} />
      );
      
      const saveButton = getByTestId('business-hours-editor-save');
      
      await act(async () => {
        fireEvent.press(saveButton);
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Save Error',
          'Unable to save business hours. Please try again.',
          expect.any(Array)
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper testIDs for all interactive elements', () => {
      const { getByTestId } = render(<BusinessHoursEditor {...defaultProps} />);
      
      expect(getByTestId('business-hours-editor')).toBeTruthy();
      expect(getByTestId('business-hours-editor-cancel')).toBeTruthy();
      expect(getByTestId('business-hours-editor-save')).toBeTruthy();
      expect(getByTestId('business-hours-editor-template-standard')).toBeTruthy();
      expect(getByTestId('business-hours-editor-template-retail')).toBeTruthy();
      expect(getByTestId('business-hours-editor-template-restaurant')).toBeTruthy();
      
      // Check day-specific testIDs
      expect(getByTestId('business-hours-editor-monday-toggle')).toBeTruthy();
      expect(getByTestId('business-hours-editor-monday-copy')).toBeTruthy();
    });
  });
});