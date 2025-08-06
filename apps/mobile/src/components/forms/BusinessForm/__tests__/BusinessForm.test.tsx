import React from 'react';
import { render } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessForm } from '../BusinessForm';

// Mock the store
jest.mock('../../../../stores/businessStore', () => ({
  useBusinessStore: () => ({
    createBusiness: jest.fn(),
    updateBusiness: jest.fn(),
    clearDraft: jest.fn(),
    isLoading: false,
    error: null,
    saveDraft: jest.fn(),
    loadDraft: jest.fn().mockReturnValue(null),
  }),
}));

// Mock the service
jest.mock('../../../../services/businessService', () => ({
  businessService: {
    createBusiness: jest.fn(),
    updateBusiness: jest.fn(),
    geocodeAddress: jest.fn(),
  },
}));

const MockedBusinessForm = (props: any) => (
  <NativeBaseProvider>
    <BusinessForm {...props} />
  </NativeBaseProvider>
);

describe('BusinessForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  };

  it('renders without crashing', () => {
    const { getByText } = render(<MockedBusinessForm {...defaultProps} />);
    expect(getByText('Create Business')).toBeTruthy();
  });

  it('renders with editing mode', () => {
    const { getByText } = render(
      <MockedBusinessForm {...defaultProps} isEditing={true} businessId="test-id" />
    );
    expect(getByText('Edit Business')).toBeTruthy();
  });

  it('shows the first step by default', () => {
    const { getByText } = render(<MockedBusinessForm {...defaultProps} />);
    expect(getByText('Basic Information')).toBeTruthy();
    expect(getByText('Tell us about your business')).toBeTruthy();
  });
});