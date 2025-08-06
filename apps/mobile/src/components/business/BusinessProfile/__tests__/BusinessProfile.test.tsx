import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessProfile } from '../BusinessProfile';
import { Business } from 'packages/shared/src/types/business';
import { ShareService } from '../../../../services/shareService';

// Mock ShareService
jest.mock('../../../../services/shareService', () => ({
  ShareService: {
    shareBusiness: jest.fn(),
  },
}));

// Mock toast
const mockToast = {
  show: jest.fn(),
};

jest.mock('native-base', () => {
  const actualNativeBase = jest.requireActual('native-base');
  return {
    ...actualNativeBase,
    useToast: () => mockToast,
  };
});

const mockBusiness: Business = {
  id: '1',
  owner_id: 'user-1',
  name: 'Test Business',
  description: 'A test business for unit testing with a very long description that should be truncated and show expandable text functionality when it exceeds the maximum number of lines allowed in the component.',
  location: {
    address: '123 Main St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    coordinates: {
      lat: 40.7128,
      lng: -74.0060,
    },
  },
  categories: ['restaurants', 'retail', 'local', 'organic', 'family-owned'],
  hours: {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { closed: true },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '16:00' },
    sunday: { closed: true },
  },
  contact: {
    phone: '(555) 123-4567',
    email: 'contact@testbusiness.com',
    website: 'https://testbusiness.com',
    socialMedia: [
      {
        platform: 'facebook',
        url: 'https://facebook.com/testbusiness',
        handle: '@testbusiness',
      },
      {
        platform: 'instagram',
        url: 'https://instagram.com/testbusiness',
        handle: '@testbusiness',
      },
    ],
  },
  media: [
    {
      id: 'logo-1',
      url: 'https://example.com/logo.jpg',
      type: 'logo',
      description: 'Business logo',
    },
    {
      id: 'photo-1',
      url: 'https://example.com/photo1.jpg',
      type: 'photo',
      description: 'Interior photo',
    },
  ],
  services: [
    {
      name: 'Service 1',
      description: 'Test service',
      price: 50,
      duration: 60,
      isActive: true,
    },
  ],
  is_active: true,
  rating: 4.5,
  reviewCount: 128,
  isVerified: true,
  verificationLevel: 'premium',
  verificationDate: new Date('2023-06-01'),
  created_at: new Date('2023-01-01'),
  updated_at: new Date('2023-01-01'),
};

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

describe('BusinessProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders business information correctly', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} />
    );

    expect(getByText('Test Business')).toBeTruthy();
    expect(getByText('A test business for unit testing')).toBeTruthy();
    expect(getByText('123 Main St')).toBeTruthy();
    expect(getByText('Test City, TS 12345')).toBeTruthy();
    expect(getByText('(555) 123-4567')).toBeTruthy();
    expect(getByText('contact@testbusiness.com')).toBeTruthy();
  });

  it('shows categories as badges', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} />
    );

    expect(getByText('restaurants')).toBeTruthy();
    expect(getByText('retail')).toBeTruthy();
  });

  it('displays business hours correctly', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} />
    );

    expect(getByText('Hours')).toBeTruthy();
    // The component should show formatted hours
  });

  it('shows services when available', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} />
    );

    expect(getByText('Services')).toBeTruthy();
    expect(getByText('Service 1')).toBeTruthy();
    expect(getByText('Test service')).toBeTruthy();
    expect(getByText('$50')).toBeTruthy();
  });

  it('shows photos when available', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} />
    );

    expect(getByText('Photos')).toBeTruthy();
  });

  it('shows action buttons when showActions is true', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} showActions={true} />
    );

    expect(getByText('Call')).toBeTruthy();
    expect(getByText('Directions')).toBeTruthy();
    expect(getByText('Share')).toBeTruthy();
  });

  it('hides action buttons when showActions is false', () => {
    const { queryByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} showActions={false} />
    );

    expect(queryByText('Call')).toBeNull();
    expect(queryByText('Directions')).toBeNull();
    expect(queryByText('Share')).toBeNull();
  });

  it('calls onCall when call button is pressed', () => {
    const onCall = jest.fn();
    const { getByText } = renderWithNativeBase(
      <BusinessProfile
        business={mockBusiness}
        onCall={onCall}
        showActions={true}
      />
    );

    fireEvent.press(getByText('Call'));
    expect(onCall).toHaveBeenCalledWith('(555) 123-4567');
  });

  it('calls onGetDirections when directions button is pressed', () => {
    const onGetDirections = jest.fn();
    const { getByText } = renderWithNativeBase(
      <BusinessProfile
        business={mockBusiness}
        onGetDirections={onGetDirections}
        showActions={true}
      />
    );

    fireEvent.press(getByText('Directions'));
    expect(onGetDirections).toHaveBeenCalledWith(
      '123 Main St, Test City, TS 12345'
    );
  });

  it('uses ShareService when share button is pressed without custom onShare', async () => {
    (ShareService.shareBusiness as jest.Mock).mockResolvedValue(true);

    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} showActions={true} />
    );

    fireEvent.press(getByText('Share'));

    await waitFor(() => {
      expect(ShareService.shareBusiness).toHaveBeenCalledWith(mockBusiness);
    });

    expect(mockToast.show).toHaveBeenCalledWith({
      title: "Shared successfully",
      description: "Business profile shared!",
      status: "success",
    });
  });

  it('calls custom onShare when provided', () => {
    const onShare = jest.fn();
    const { getByText } = renderWithNativeBase(
      <BusinessProfile
        business={mockBusiness}
        onShare={onShare}
        showActions={true}
      />
    );

    fireEvent.press(getByText('Share'));
    expect(onShare).toHaveBeenCalled();
    expect(ShareService.shareBusiness).not.toHaveBeenCalled();
  });

  it('shows edit button when onEdit is provided', () => {
    const onEdit = jest.fn();
    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} onEdit={onEdit} />
    );

    expect(getByText('Edit Business Profile')).toBeTruthy();

    fireEvent.press(getByText('Edit Business Profile'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('handles business with no services', () => {
    const businessWithoutServices = {
      ...mockBusiness,
      services: [],
    };

    const { queryByText } = renderWithNativeBase(
      <BusinessProfile business={businessWithoutServices} />
    );

    expect(queryByText('Services')).toBeNull();
  });

  it('handles business with no photos', () => {
    const businessWithoutPhotos = {
      ...mockBusiness,
      media: [mockBusiness.media[0]], // Only keep logo
    };

    const { queryByText } = renderWithNativeBase(
      <BusinessProfile business={businessWithoutPhotos} />
    );

    expect(queryByText('Photos')).toBeNull();
  });

  it('handles sharing error gracefully', async () => {
    (ShareService.shareBusiness as jest.Mock).mockRejectedValue(new Error('Share failed'));

    const { getByText } = renderWithNativeBase(
      <BusinessProfile business={mockBusiness} showActions={true} />
    );

    fireEvent.press(getByText('Share'));

    await waitFor(() => {
      expect(mockToast.show).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to share business profile",
        status: "error",
      });
    });
  });

  // Enhanced feature tests
  describe('Enhanced Features', () => {
    it('displays business rating when available', () => {
      const { getByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      expect(getByText('4.5')).toBeTruthy();
      expect(getByText('128 reviews')).toBeTruthy();
    });

    it('displays verification status', () => {
      const { getByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      expect(getByText('Premium Verified')).toBeTruthy();
    });

    it('shows expandable text for long descriptions', () => {
      const { getByText, queryByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      // Should show truncated text initially
      expect(getByText('Read More')).toBeTruthy();
      
      // Full description should not be visible initially
      expect(queryByText(/when it exceeds the maximum number of lines/)).toBeNull();
    });

    it('expands text when Read More is pressed', () => {
      const { getByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      const readMoreButton = getByText('Read More');
      fireEvent.press(readMoreButton);

      expect(getByText('Read Less')).toBeTruthy();
    });

    it('displays social media links', () => {
      const { getByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      expect(getByText('Follow Us')).toBeTruthy();
      expect(getByText('Facebook')).toBeTruthy();
      expect(getByText('Instagram')).toBeTruthy();
    });

    it('handles more than 3 categories with +more indicator', () => {
      const { getByText } = renderWithNativeBase(
        <BusinessProfile business={mockBusiness} />
      );

      expect(getByText('restaurants')).toBeTruthy();
      expect(getByText('retail')).toBeTruthy();
      expect(getByText('local')).toBeTruthy();
      expect(getByText('+2 more')).toBeTruthy(); // Should show +2 more for remaining categories
    });

    it('handles business without rating gracefully', () => {
      const businessWithoutRating = {
        ...mockBusiness,
        rating: undefined,
        reviewCount: undefined,
      };

      const { queryByText } = renderWithNativeBase(
        <BusinessProfile business={businessWithoutRating} />
      );

      expect(queryByText('4.5')).toBeNull();
      expect(queryByText('reviews')).toBeNull();
    });

    it('handles business without verification gracefully', () => {
      const businessWithoutVerification = {
        ...mockBusiness,
        isVerified: false,
        verificationLevel: undefined,
      };

      const { queryByText } = renderWithNativeBase(
        <BusinessProfile business={businessWithoutVerification} />
      );

      expect(queryByText('Verified')).toBeNull();
      expect(queryByText('Premium Verified')).toBeNull();
    });

    it('handles business without social media gracefully', () => {
      const businessWithoutSocial = {
        ...mockBusiness,
        contact: {
          ...mockBusiness.contact,
          socialMedia: undefined,
        },
      };

      const { queryByText } = renderWithNativeBase(
        <BusinessProfile business={businessWithoutSocial} />
      );

      expect(queryByText('Follow Us')).toBeNull();
      expect(queryByText('Facebook')).toBeNull();
    });

    it('handles short description without expandable text', () => {
      const businessWithShortDescription = {
        ...mockBusiness,
        description: 'Short description',
      };

      const { queryByText } = renderWithNativeBase(
        <BusinessProfile business={businessWithShortDescription} />
      );

      expect(queryByText('Read More')).toBeNull();
      expect(queryByText('Read Less')).toBeNull();
    });
  });
});