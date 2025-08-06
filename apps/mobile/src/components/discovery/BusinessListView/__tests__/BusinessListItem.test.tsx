import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BusinessListItem } from '../BusinessListItem';
import { BusinessWithDistance } from '../types';

// Mock vector icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

const mockBusiness: BusinessWithDistance = {
  id: '1',
  owner_id: 'owner1',
  name: 'Test Restaurant',
  description: 'A great place to eat with delicious food and excellent service',
  location: {
    address: '123 Main St',
    city: 'Test City',
    state: 'TC',
    zipCode: '12345',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  categories: ['Restaurant', 'Italian'],
  hours: {
    monday: { open: '09:00', close: '21:00' },
    tuesday: { open: '09:00', close: '21:00' },
    wednesday: { closed: true }
  },
  contact: {
    phone: '555-0123',
    email: 'test@restaurant.com',
    website: 'https://testrestaurant.com'
  },
  media: [
    {
      id: '1',
      url: 'https://example.com/logo.jpg',
      type: 'logo'
    }
  ],
  services: [],
  is_active: true,
  rating: 4.5,
  reviewCount: 25,
  isVerified: true,
  created_at: new Date('2023-01-01'),
  updated_at: new Date('2023-01-01'),
  distance: 0.5,
  estimatedTravelTime: 5
};

const mockCurrentLocation = {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: Date.now()
};

describe('BusinessListItem', () => {
  const defaultProps = {
    business: mockBusiness,
    currentLocation: mockCurrentLocation,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders business information correctly', () => {
      const { getByTestId, getByText } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item')).toBeTruthy();
      expect(getByText('Test Restaurant')).toBeTruthy();
      expect(getByText('Restaurant')).toBeTruthy();
      expect(getByText('123 Main St, Test City')).toBeTruthy();
    });

    it('displays business image when available', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item-image')).toBeTruthy();
    });

    it('displays placeholder when no image available', () => {
      const businessWithoutImage = {
        ...mockBusiness,
        media: []
      };
      
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutImage} />
      );
      
      expect(getByTestId('business-list-item')).toBeTruthy();
    });

    it('displays verified badge for verified businesses', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item-verified-badge')).toBeTruthy();
    });

    it('does not display verified badge for unverified businesses', () => {
      const unverifiedBusiness = {
        ...mockBusiness,
        isVerified: false
      };
      
      const { queryByTestId } = render(
        <BusinessListItem {...defaultProps} business={unverifiedBusiness} />
      );
      
      expect(queryByTestId('business-list-item-verified-badge')).toBeNull();
    });

    it('displays rating when showRating is true', () => {
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} showRating={true} />
      );
      
      expect(getByTestId('business-list-item-rating')).toBeTruthy();
    });

    it('does not display rating when showRating is false', () => {
      const { queryByTestId } = render(
        <BusinessListItem {...defaultProps} showRating={false} />
      );
      
      expect(queryByTestId('business-list-item-rating')).toBeNull();
    });

    it('displays distance when showDistance is true', () => {
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} showDistance={true} />
      );
      
      expect(getByTestId('business-list-item-distance')).toBeTruthy();
    });

    it('does not display distance when showDistance is false', () => {
      const { queryByTestId } = render(
        <BusinessListItem {...defaultProps} showDistance={false} />
      );
      
      expect(queryByTestId('business-list-item-distance')).toBeNull();
    });

    it('truncates long descriptions', () => {
      const longDescription = 'A'.repeat(150);
      const businessWithLongDescription = {
        ...mockBusiness,
        description: longDescription
      };
      
      const { getByText } = render(
        <BusinessListItem {...defaultProps} business={businessWithLongDescription} />
      );
      
      const descriptionText = getByText(/A+\.\.\.$/);
      expect(descriptionText).toBeTruthy();
    });

    it('displays phone number when available', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item-phone')).toBeTruthy();
    });

    it('displays primary category', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item-category')).toBeTruthy();
    });

    it('displays business hours indicator', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item-hours')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('calls onPress when item is pressed', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} onPress={onPress} />
      );
      
      fireEvent.press(getByTestId('business-list-item'));
      expect(onPress).toHaveBeenCalledWith(mockBusiness);
    });

    it('has proper touch opacity', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      const touchable = getByTestId('business-list-item');
      expect(touchable.props.activeOpacity).toBe(0.7);
    });
  });

  describe('Data Handling', () => {
    it('handles business without description', () => {
      const businessWithoutDescription = {
        ...mockBusiness,
        description: undefined
      };
      
      const { getByText } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutDescription} />
      );
      
      expect(getByText('No description available')).toBeTruthy();
    });

    it('handles business without categories', () => {
      const businessWithoutCategories = {
        ...mockBusiness,
        categories: []
      };
      
      const { getByText } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutCategories} />
      );
      
      expect(getByText('Business')).toBeTruthy();
    });

    it('handles business without rating', () => {
      const businessWithoutRating = {
        ...mockBusiness,
        rating: undefined
      };
      
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutRating} showRating={true} />
      );
      
      expect(getByTestId('business-list-item-rating')).toBeTruthy();
    });

    it('handles business without phone', () => {
      const businessWithoutPhone = {
        ...mockBusiness,
        contact: {
          email: 'test@example.com'
        }
      };
      
      const { queryByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutPhone} />
      );
      
      expect(queryByTestId('business-list-item-phone')).toBeNull();
    });

    it('handles business without hours', () => {
      const businessWithoutHours = {
        ...mockBusiness,
        hours: {}
      };
      
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithoutHours} />
      );
      
      expect(getByTestId('business-list-item-hours')).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('applies correct styles', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      const container = getByTestId('business-list-item');
      expect(container.props.style).toMatchObject(
        expect.objectContaining({
          flexDirection: 'row'
        })
      );
    });

    it('has shadow properties', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      const container = getByTestId('business-list-item');
      expect(container.props.style).toMatchObject(
        expect.objectContaining({
          shadowColor: '#000'
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper testID', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      expect(getByTestId('business-list-item')).toBeTruthy();
    });

    it('accepts custom testID', () => {
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} testID="custom-test-id" />
      );
      
      expect(getByTestId('custom-test-id')).toBeTruthy();
    });

    it('has accessible props', () => {
      const { getByTestId } = render(<BusinessListItem {...defaultProps} />);
      
      const touchable = getByTestId('business-list-item');
      expect(touchable.props.accessible).toBe(true);
    });
  });

  describe('Image Handling', () => {
    it('prioritizes logo over photo', () => {
      const businessWithBothImages = {
        ...mockBusiness,
        media: [
          {
            id: '1',
            url: 'https://example.com/photo.jpg',
            type: 'photo' as const
          },
          {
            id: '2',
            url: 'https://example.com/logo.jpg',
            type: 'logo' as const
          }
        ]
      };
      
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithBothImages} />
      );
      
      const image = getByTestId('business-list-item-image');
      expect(image.props.source.uri).toBe('https://example.com/logo.jpg');
    });

    it('falls back to photo when no logo available', () => {
      const businessWithPhotoOnly = {
        ...mockBusiness,
        media: [
          {
            id: '1',
            url: 'https://example.com/photo.jpg',
            type: 'photo' as const
          }
        ]
      };
      
      const { getByTestId } = render(
        <BusinessListItem {...defaultProps} business={businessWithPhotoOnly} />
      );
      
      const image = getByTestId('business-list-item-image');
      expect(image.props.source.uri).toBe('https://example.com/photo.jpg');
    });
  });
});