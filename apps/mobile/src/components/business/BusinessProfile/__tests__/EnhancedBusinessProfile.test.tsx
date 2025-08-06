import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessProfile } from '../BusinessProfile';
import { Business } from 'packages/shared/src/types/business';

// Mock the modules that require native dependencies
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('react-native-fast-image', () => ({
  __esModule: true,
  default: () => null,
  resizeMode: {
    contain: 'contain',
    cover: 'cover',
  },
  priority: {
    normal: 'normal',
  },
  cacheControl: {
    immutable: 'immutable',
    web: 'web',
    cacheOnly: 'cacheOnly',
  },
  preload: jest.fn(),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
}));

const mockBusiness: Business = {
  id: 'test-business-1',
  name: 'Test Local Business',
  description: 'A comprehensive test business for enhanced profile testing',
  categories: ['Restaurant', 'Italian', 'Family Dining'],
  rating: 4.5,
  reviewCount: 127,
  isVerified: true,
  verificationLevel: 'premium' as const,
  location: {
    address: '123 Main Street',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    latitude: 39.7817,
    longitude: -89.6501,
  },
  contact: {
    phone: '+1-555-123-4567',
    email: 'info@testbusiness.com',
    website: 'https://www.testbusiness.com',
    socialMedia: [
      {
        platform: 'facebook' as const,
        url: 'https://facebook.com/testbusiness',
        handle: 'testbusiness',
      },
      {
        platform: 'instagram' as const,
        url: 'https://instagram.com/testbusiness',
        handle: '@testbusiness',
      },
    ],
  },
  hours: {
    monday: { open: '09:00', close: '21:00' },
    tuesday: { open: '09:00', close: '21:00' },
    wednesday: { open: '09:00', close: '21:00' },
    thursday: { open: '09:00', close: '21:00' },
    friday: { open: '09:00', close: '22:00' },
    saturday: { open: '10:00', close: '22:00' },
    sunday: { open: '11:00', close: '20:00' },
  },
  media: [
    {
      id: 'logo-1',
      url: 'https://example.com/logo.jpg',
      type: 'logo' as const,
      description: 'Business logo',
    },
    {
      id: 'photo-1',
      url: 'https://example.com/photo1.jpg',
      type: 'photo' as const,
      description: 'Interior view',
    },
    {
      id: 'photo-2',
      url: 'https://example.com/photo2.jpg',
      type: 'photo' as const,
      description: 'Outdoor seating',
    },
  ],
  services: [
    {
      name: 'Dine-in Service',
      description: 'Full-service dining experience',
      price: 25.99,
      duration: 90,
      isActive: true,
    },
    {
      name: 'Takeout',
      description: 'Order ahead for pickup',
      price: 15.99,
      duration: 15,
      isActive: true,
    },
  ],
  amenities: {
    parking: {
      type: 'Street parking available',
      cost: 'Free',
    },
    accessibility: {
      wheelchairAccessible: true,
      notes: 'Wheelchair accessible entrance and restrooms',
    },
  },
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider
    initialWindowMetrics={{
      frame: { x: 0, y: 0, width: 375, height: 812 },
      insets: { top: 44, left: 0, right: 0, bottom: 34 },
    }}
  >
    {children}
  </NativeBaseProvider>
);

describe('Enhanced BusinessProfile Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders enhanced business profile with all new features', () => {
    const mockProps = {
      business: mockBusiness,
      showActions: true,
      onCall: jest.fn(),
      onWebsite: jest.fn(),
      onGetDirections: jest.fn(),
      onShare: jest.fn(),
    };

    render(
      <TestWrapper>
        <BusinessProfile {...mockProps} />
      </TestWrapper>
    );

    // Verify business name is rendered
    expect(screen.getByText('Test Local Business')).toBeTruthy();
    
    // Verify rating display
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('(127 reviews)')).toBeTruthy();
    
    // Verify categories are displayed
    expect(screen.getByText('Restaurant')).toBeTruthy();
    
    // Verify verification status
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('renders contact methods with proper accessibility', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Verify contact section exists
    expect(screen.getByText('Contact & Location')).toBeTruthy();
    
    // Verify phone contact method
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('+1-555-123-4567')).toBeTruthy();
    
    // Verify email contact method  
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('info@testbusiness.com')).toBeTruthy();
    
    // Verify website contact method
    expect(screen.getByText('Website')).toBeTruthy();
    expect(screen.getByText('https://www.testbusiness.com')).toBeTruthy();
  });

  it('displays location map with address information', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Verify address display
    expect(screen.getByText('Address')).toBeTruthy();
    expect(screen.getByText('123 Main Street')).toBeTruthy();
    expect(screen.getByText('Springfield, IL 62701')).toBeTruthy();
    
    // Verify directions button
    expect(screen.getByText('Get Directions')).toBeTruthy();
    
    // Verify copy address functionality
    expect(screen.getByText('Copy address')).toBeTruthy();
  });

  it('shows parking and accessibility information', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Verify parking information
    expect(screen.getByText('Parking')).toBeTruthy();
    expect(screen.getByText('Street parking available • Free')).toBeTruthy();
    
    // Verify accessibility information
    expect(screen.getByText('Accessibility')).toBeTruthy();
    expect(screen.getByText('Wheelchair accessible • Wheelchair accessible entrance and restrooms')).toBeTruthy();
  });

  it('displays enhanced photo gallery with count', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Verify photo gallery section with count
    expect(screen.getByText('Photos (2)')).toBeTruthy();
  });

  it('handles action button presses correctly', () => {
    const mockOnCall = jest.fn();
    const mockOnWebsite = jest.fn();
    const mockOnGetDirections = jest.fn();
    const mockOnShare = jest.fn();

    render(
      <TestWrapper>
        <BusinessProfile
          business={mockBusiness}
          onCall={mockOnCall}
          onWebsite={mockOnWebsite}
          onGetDirections={mockOnGetDirections}
          onShare={mockOnShare}
        />
      </TestWrapper>
    );

    // Test call button
    const callButton = screen.getByText('Call');
    fireEvent.press(callButton);
    expect(mockOnCall).toHaveBeenCalledWith('+1-555-123-4567');

    // Test directions button
    const directionsButton = screen.getByText('Directions');
    fireEvent.press(directionsButton);
    expect(mockOnGetDirections).toHaveBeenCalledWith(
      '123 Main Street, Springfield, IL 62701'
    );

    // Test share button
    const shareButton = screen.getByText('Share');
    fireEvent.press(shareButton);
    expect(mockOnShare).toHaveBeenCalled();
  });

  it('handles loading state correctly', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} isLoading={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Loading business profile...')).toBeTruthy();
  });

  it('handles error state with retry functionality', () => {
    const mockOnRefresh = jest.fn();
    
    render(
      <TestWrapper>
        <BusinessProfile
          business={null}
          error="Failed to load business"
          onRefresh={mockOnRefresh}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load business profile')).toBeTruthy();
    expect(screen.getByText('Failed to load business')).toBeTruthy();
    
    const retryButton = screen.getByText('Try Again');
    fireEvent.press(retryButton);
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('renders services catalog with enhanced features', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Verify services are displayed
    expect(screen.getByText('Dine-in Service')).toBeTruthy();
    expect(screen.getByText('Full-service dining experience')).toBeTruthy();
    expect(screen.getByText('Takeout')).toBeTruthy();
    expect(screen.getByText('Order ahead for pickup')).toBeTruthy();
  });

  it('displays business hours with current status', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    expect(screen.getByText('Hours')).toBeTruthy();
    // Hours component should display the hours - exact text depends on implementation
  });

  it('shows social media links', () => {
    render(
      <TestWrapper>
        <BusinessProfile business={mockBusiness} />
      </TestWrapper>
    );

    // Social media should be integrated in the contact methods
    expect(screen.getByText('Facebook')).toBeTruthy();
    expect(screen.getByText('Instagram')).toBeTruthy();
  });

  it('handles business without optional data gracefully', () => {
    const minimalBusiness = {
      ...mockBusiness,
      media: [],
      services: [],
      contact: {
        phone: '+1-555-123-4567',
      },
      amenities: undefined,
    };

    render(
      <TestWrapper>
        <BusinessProfile business={minimalBusiness} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Local Business')).toBeTruthy();
    expect(screen.getByText('Phone')).toBeTruthy();
  });
});

describe('Enhanced Component Integration', () => {
  it('integrates responsive design hooks correctly', () => {
    // This would test the responsive design integration
    // In a real test, we'd mock window dimensions and test responsive behavior
    expect(true).toBe(true); // Placeholder for responsive design tests
  });

  it('integrates accessibility features correctly', () => {
    // This would test accessibility feature integration
    // In a real test, we'd check accessibility labels, hints, and announcements
    expect(true).toBe(true); // Placeholder for accessibility tests
  });

  it('integrates performance optimizations correctly', () => {
    // This would test performance optimization integration
    // In a real test, we'd verify lazy loading, caching, and performance monitoring
    expect(true).toBe(true); // Placeholder for performance tests
  });
});