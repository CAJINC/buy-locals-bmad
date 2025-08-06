import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ConfirmationDialog, useConfirmationDialog, DialogConfigs } from '../ConfirmationDialog';

const renderWithNativeBase = (component: React.ReactElement) => {
  return render(
    <NativeBaseProvider initialWindowMetrics={{
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
      {component}
    </NativeBaseProvider>
  );
};

describe('ConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Test Title',
    message: 'Test message',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title and message', () => {
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} />
    );

    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Test message')).toBeTruthy();
  });

  it('shows default button text', () => {
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} />
    );

    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('shows custom button text', () => {
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog 
        {...defaultProps}
        confirmText="Delete"
        cancelText="Keep"
      />
    );

    expect(getByText('Delete')).toBeTruthy();
    expect(getByText('Keep')).toBeTruthy();
  });

  it('calls onConfirm when confirm button is pressed', () => {
    const mockOnConfirm = jest.fn();
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} onConfirm={mockOnConfirm} />
    );

    fireEvent.press(getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is pressed', () => {
    const mockOnClose = jest.fn();
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} onClose={mockOnClose} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows different icons for different types', () => {
    const { rerender } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} type="danger" />
    );

    // Re-render with different type
    rerender(
      <NativeBaseProvider initialWindowMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
        <ConfirmationDialog {...defaultProps} type="info" />
      </NativeBaseProvider>
    );
  });

  it('disables buttons when loading', () => {
    const { getByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} isLoading={true} />
    );

    const cancelButton = getByText('Cancel');
    const confirmButton = getByText('Please wait...');

    expect(cancelButton.props.accessibilityState?.disabled).toBe(true);
    expect(confirmButton).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { queryByText } = renderWithNativeBase(
      <ConfirmationDialog {...defaultProps} isOpen={false} />
    );

    expect(queryByText('Test Title')).toBeNull();
    expect(queryByText('Test message')).toBeNull();
  });
});

describe('DialogConfigs', () => {
  it('has correct config for CANCEL_FORM', () => {
    const config = DialogConfigs.CANCEL_FORM;
    
    expect(config.title).toBe('Cancel Business Registration?');
    expect(config.type).toBe('warning');
    expect(config.confirmText).toBe('Yes, Cancel');
    expect(config.cancelText).toBe('Keep Editing');
  });

  it('has correct config for DELETE_DRAFT', () => {
    const config = DialogConfigs.DELETE_DRAFT;
    
    expect(config.title).toBe('Delete Draft?');
    expect(config.type).toBe('danger');
    expect(config.confirmText).toBe('Delete Draft');
    expect(config.cancelText).toBe('Keep Draft');
  });
});

// Test the hook
const TestComponent: React.FC = () => {
  const { dialog, showDialog, hideDialog } = useConfirmationDialog();

  return (
    <>
      <button
        testID="show-dialog"
        onPress={() => showDialog({ title: 'Test', message: 'Test message' })}
      >
        Show Dialog
      </button>
      <button testID="hide-dialog" onPress={hideDialog}>
        Hide Dialog
      </button>
      <ConfirmationDialog {...dialog} />
    </>
  );
};

describe('useConfirmationDialog hook', () => {
  it('shows and hides dialog correctly', async () => {
    const { getByTestId, getByText, queryByText } = renderWithNativeBase(
      <TestComponent />
    );

    // Initially dialog should be closed
    expect(queryByText('Test')).toBeNull();

    // Show dialog
    fireEvent.press(getByTestId('show-dialog'));
    await waitFor(() => {
      expect(getByText('Test')).toBeTruthy();
    });

    // Hide dialog
    fireEvent.press(getByTestId('hide-dialog'));
    await waitFor(() => {
      expect(queryByText('Test')).toBeNull();
    });
  });
});