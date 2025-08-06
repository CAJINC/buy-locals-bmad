import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ImageUploader } from '../ImageUploader';
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
      url: 'https://example.com/uploaded-image.jpg',
    }),
  },
}));

const MockedImageUploader = (props: any) => (
  <NativeBaseProvider>
    <ImageUploader {...props} />
  </NativeBaseProvider>
);

describe('ImageUploader', () => {
  const mockImages: UploadedImage[] = [];
  const mockOnImagesChange = jest.fn();
  const mockOnUploadComplete = jest.fn();
  const mockOnUploadError = jest.fn();

  const defaultProps = {
    images: mockImages,
    onImagesChange: mockOnImagesChange,
    businessId: 'test-business-id',
    onUploadComplete: mockOnUploadComplete,
    onUploadError: mockOnUploadError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<MockedImageUploader {...defaultProps} />);
    expect(getByText('Business Photos')).toBeTruthy();
  });

  it('shows photo count correctly', () => {
    const imagesWithData: UploadedImage[] = [
      {
        id: '1',
        uri: 'file://test1.jpg',
        type: 'photo',
        fileName: 'test1.jpg',
        fileSize: 1024,
      },
    ];

    const { getByText } = render(
      <MockedImageUploader {...defaultProps} images={imagesWithData} />
    );
    
    expect(getByText('1 / 5')).toBeTruthy();
  });

  it('shows add photo button when under max limit', () => {
    const { getByText } = render(<MockedImageUploader {...defaultProps} />);
    expect(getByText('Add Photo')).toBeTruthy();
  });

  it('shows camera and gallery buttons', () => {
    const { getByText } = render(<MockedImageUploader {...defaultProps} />);
    expect(getByText('Camera')).toBeTruthy();
    expect(getByText('Gallery')).toBeTruthy();
  });

  it('displays uploaded images', () => {
    const imagesWithData: UploadedImage[] = [
      {
        id: '1',
        uri: 'file://test1.jpg',
        type: 'photo',
        fileName: 'test1.jpg',
        fileSize: 1024,
      },
    ];

    const { getByLabelText } = render(
      <MockedImageUploader {...defaultProps} images={imagesWithData} />
    );
    
    expect(getByLabelText('Business photo')).toBeTruthy();
  });

  it('shows upload progress for uploading images', () => {
    const uploadingImages: UploadedImage[] = [
      {
        id: '1',
        uri: 'file://test1.jpg',
        type: 'photo',
        fileName: 'test1.jpg',
        fileSize: 1024,
        isUploading: true,
        uploadProgress: 50,
      },
    ];

    const { getByText } = render(
      <MockedImageUploader {...defaultProps} images={uploadingImages} />
    );
    
    expect(getByText('50%')).toBeTruthy();
  });

  it('shows error state for failed uploads', () => {
    const errorImages: UploadedImage[] = [
      {
        id: '1',
        uri: 'file://test1.jpg',
        type: 'photo',
        fileName: 'test1.jpg',
        fileSize: 1024,
        error: 'Upload failed',
      },
    ];

    const { getByText } = render(
      <MockedImageUploader {...defaultProps} images={errorImages} />
    );
    
    expect(getByText('❌ Failed')).toBeTruthy();
  });
});