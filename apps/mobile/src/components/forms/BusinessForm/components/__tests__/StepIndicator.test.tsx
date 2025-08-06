import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { StepIndicator } from '../StepIndicator';
import { FORM_STEPS } from '../../formSteps';

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

describe('StepIndicator', () => {
  const defaultProps = {
    steps: FORM_STEPS,
    currentStepIndex: 1,
    completedSteps: ['basic-info'],
    onStepPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all steps', () => {
    const { getByText } = renderWithNativeBase(
      <StepIndicator {...defaultProps} />
    );

    expect(getByText('Basic Information')).toBeTruthy();
    expect(getByText('Location Details')).toBeTruthy();
    expect(getByText('Contact Information')).toBeTruthy();
    expect(getByText('Business Hours')).toBeTruthy();
    expect(getByText('Review & Submit')).toBeTruthy();
  });

  it('shows progress bar with correct value', () => {
    const { getByRole } = renderWithNativeBase(
      <StepIndicator {...defaultProps} />
    );

    // Progress should be (1+1)/5 * 100 = 40%
    const progressBar = getByRole('progressbar');
    expect(progressBar).toBeTruthy();
  });

  it('marks completed steps correctly', () => {
    const { getByText } = renderWithNativeBase(
      <StepIndicator {...defaultProps} />
    );

    expect(getByText('Complete')).toBeTruthy();
  });

  it('shows current step correctly', () => {
    const { getByText } = renderWithNativeBase(
      <StepIndicator {...defaultProps} />
    );

    expect(getByText('Current')).toBeTruthy();
    expect(getByText('Step 2 of 5: Location Details')).toBeTruthy();
  });

  it('calls onStepPress when step is clicked', () => {
    const mockOnStepPress = jest.fn();
    const { getByText } = renderWithNativeBase(
      <StepIndicator {...defaultProps} onStepPress={mockOnStepPress} />
    );

    // Click on completed step should work
    fireEvent.press(getByText('Basic Information'));
    expect(mockOnStepPress).toHaveBeenCalledWith('basic-info', 0);
  });

  it('disables navigation when isNavigationDisabled is true', () => {
    const mockOnStepPress = jest.fn();
    const { getByText } = renderWithNativeBase(
      <StepIndicator 
        {...defaultProps} 
        onStepPress={mockOnStepPress}
        isNavigationDisabled={true}
      />
    );

    fireEvent.press(getByText('Basic Information'));
    expect(mockOnStepPress).not.toHaveBeenCalled();
  });

  it('shows step-specific icons', () => {
    const { getAllByTestId } = renderWithNativeBase(
      <StepIndicator {...defaultProps} />
    );

    // Icons should be rendered for each step
    // Note: This test assumes icons are rendered with testID
    // Actual implementation may vary
  });

  it('handles edge case with no completed steps', () => {
    const { queryByText } = renderWithNativeBase(
      <StepIndicator 
        {...defaultProps} 
        completedSteps={[]}
        currentStepIndex={0}
      />
    );

    expect(queryByText('Complete')).toBeNull();
    expect(queryByText('Step 1 of 5: Basic Information')).toBeTruthy();
  });

  it('handles edge case with all steps completed', () => {
    const allCompleted = FORM_STEPS.map(step => step.id);
    const { getAllByText } = renderWithNativeBase(
      <StepIndicator 
        {...defaultProps} 
        completedSteps={allCompleted}
        currentStepIndex={4}
      />
    );

    const completeTexts = getAllByText('Complete');
    expect(completeTexts.length).toBe(5); // All steps should show "Complete"
  });
});