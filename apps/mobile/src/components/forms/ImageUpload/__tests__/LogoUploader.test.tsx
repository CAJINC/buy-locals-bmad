import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { LogoUploader } from '../LogoUploader';
import { UploadedImage } from '../types';

// Mock dependencies - using native React Native approach
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('../../../services/businessService', () => ({
  businessService: {
    uploadBusinessMedia: jest.fn().mockResolvedValue({
      success: true,
      url: 'https://example.com/uploaded-logo.png',
    }),
  },
}));

const MockedLogoUploader = (props: any) => (
  <NativeBaseProvider>
    <LogoUploader {...props} />
  </NativeBaseProvider>
);

describe('LogoUploader', () => {
  const mockOnLogoChange = jest.fn();
  const mockOnUploadComplete = jest.fn();
  const mockOnUploadError = jest.fn();

  const defaultProps = {
    logo: null,
    onLogoChange: mockOnLogoChange,
    businessId: 'test-business-id',
    onUploadComplete: mockOnUploadComplete,
    onUploadError: mockOnUploadError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<MockedLogoUploader {...defaultProps} />);
    expect(getByText('Business Logo')).toBeTruthy();
  });

  it('shows add logo placeholder when no logo', () => {
    const { getByText } = render(<MockedLogoUploader {...defaultProps} />);
    expect(getByText('Add Logo')).toBeTruthy();
    expect(getByText('🏢')).toBeTruthy();
  });

  it('shows camera and gallery buttons when no logo', () => {
    const { getByText } = render(<MockedLogoUploader {...defaultProps} />);
    expect(getByText('Camera')).toBeTruthy();
    expect(getByText('Gallery')).toBeTruthy();
  });

  it('displays logo when provided', () => {
    const testLogo: UploadedImage = {
      id: 'logo-1',
      uri: 'file://test-logo.png',
      type: 'logo',
      fileName: 'logo.png',
      fileSize: 2048,
    };

    const { getByLabelText } = render(
      <MockedLogoUploader {...defaultProps} logo={testLogo} />
    );
    
    expect(getByLabelText('Business logo')).toBeTruthy();
  });

  it('shows change and remove buttons when logo exists', () => {
    const testLogo: UploadedImage = {
      id: 'logo-1',
      uri: 'file://test-logo.png',
      type: 'logo',
      fileName: 'logo.png',
      fileSize: 2048,
    };

    const { getByText } = render(
      <MockedLogoUploader {...defaultProps} logo={testLogo} />
    );
    
    expect(getByText('Change')).toBeTruthy();
    expect(getByText('Remove')).toBeTruthy();
  });

  it('shows ready badge for uploaded logo', () => {
    const uploadedLogo: UploadedImage = {
      id: 'logo-1',
      uri: 'https://example.com/logo.png',
      type: 'logo',
      fileName: 'logo.png',
      fileSize: 2048,
    };

    const { getByText } = render(
      <MockedLogoUploader {...defaultProps} logo={uploadedLogo} />
    );
    
    expect(getByText('Ready')).toBeTruthy();
  });

  it('shows uploading badge for logo in progress', () => {
    const uploadingLogo: UploadedImage = {
      id: 'logo-1',
      uri: 'file://test-logo.png',
      type: 'logo',
      fileName: 'logo.png',
      fileSize: 2048,
      isUploading: true,
      uploadProgress: 75,
    };

    const { getByText } = render(
      <MockedLogoUploader {...defaultProps} logo={uploadingLogo} />
    );
    
    expect(getByText('Uploading')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy();
  });

  it('shows error badge for failed upload', () => {
    const failedLogo: UploadedImage = {
      id: 'logo-1',
      uri: 'file://test-logo.png',
      type: 'logo',
      fileName: 'logo.png',
      fileSize: 2048,
      error: 'Upload failed',
    };

    const { getByText } = render(
      <MockedLogoUploader {...defaultProps} logo={failedLogo} />
    );
    
    expect(getByText('Error')).toBeTruthy();
  });

  it('shows help text with logo requirements', () => {
    const { getByText } = render(<MockedLogoUploader {...defaultProps} />);
    expect(getByText(/Upload a square logo/)).toBeTruthy();
    expect(getByText(/400x400px/)).toBeTruthy();
  });
});