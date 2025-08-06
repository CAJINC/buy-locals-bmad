import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessCard } from '../BusinessCard';
import { Business } from 'packages/shared/src/types/business';

const mockBusiness: Business = {
  id: '1',
  owner_id: 'user-1',
  name: 'Test Business',
  description: 'A test business for unit testing',
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
  categories: ['restaurants', 'retail', 'services'],
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
  },
  media: [
    {
      id: 'logo-1',
      url: 'https://example.com/logo.jpg',
      type: 'logo',
      description: 'Business logo',
    },
  ],
  services: [],
  is_active: true,
  created_at: new Date('2023-01-01'),
  updated_at: new Date('2023-01-01'),
  distance: 2.5,
  rating: 4.5,
  review_count: 12,
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

describe('BusinessCard', () => {
  it('renders business name and description', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} />
    );

    expect(getByText('Test Business')).toBeTruthy();
    expect(getByText('A test business for unit testing')).toBeTruthy();
  });

  it('shows categories as badges', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} />
    );

    expect(getByText('restaurants')).toBeTruthy();
    expect(getByText('retail')).toBeTruthy();
    expect(getByText('services')).toBeTruthy();
  });

  it('shows distance when showDistance is true', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} showDistance={true} />
    );

    expect(getByText('2.5 mi')).toBeTruthy();
  });

  it('hides distance when showDistance is false', () => {
    const { queryByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} showDistance={false} />
    );

    expect(queryByText('2.5 mi')).toBeNull();
  });

  it('shows rating when available', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} />
    );

    expect(getByText('4.5 (12)')).toBeTruthy();
  });

  it('shows address in compact mode', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} compact={false} />
    );

    expect(getByText('123 Main St, Test City')).toBeTruthy();
  });

  it('hides address in compact mode', () => {
    const { queryByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} compact={true} />
    );

    expect(queryByText('123 Main St, Test City')).toBeNull();
  });

  it('limits categories in compact mode', () => {
    const { getByText, queryByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} compact={true} />
    );

    expect(getByText('restaurants')).toBeTruthy();
    expect(getByText('retail')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy(); // +1 more categories
    expect(queryByText('services')).toBeNull();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} onPress={onPress} />
    );

    fireEvent.press(getByText('Test Business'));
    expect(onPress).toHaveBeenCalledWith(mockBusiness);
  });

  it('handles business without description', () => {
    const businessWithoutDescription = {
      ...mockBusiness,
      description: undefined,
    };

    const { getByText, queryByText } = renderWithNativeBase(
      <BusinessCard business={businessWithoutDescription} />
    );

    expect(getByText('Test Business')).toBeTruthy();
    expect(queryByText('A test business for unit testing')).toBeNull();
  });

  it('handles business without rating', () => {
    const businessWithoutRating = {
      ...mockBusiness,
      rating: undefined,
      review_count: undefined,
    };

    const { queryByText } = renderWithNativeBase(
      <BusinessCard business={businessWithoutRating} />
    );

    expect(queryByText('4.5 (12)')).toBeNull();
  });

  it('shows open/closed status', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessCard business={mockBusiness} />
    );

    // Note: The actual status depends on current time, so we just check that status text exists
    const openElement = getByText(/Open|Closed/);
    expect(openElement).toBeTruthy();
  });

  it('handles business with empty categories', () => {
    const businessWithoutCategories = {
      ...mockBusiness,
      categories: [],
    };

    const { queryByText } = renderWithNativeBase(
      <BusinessCard business={businessWithoutCategories} />
    );

    expect(queryByText('restaurants')).toBeNull();
    expect(queryByText('retail')).toBeNull();
  });

  it('handles business without distance', () => {
    const businessWithoutDistance = {
      ...mockBusiness,
      distance: undefined,
    };

    const { queryByText } = renderWithNativeBase(
      <BusinessCard business={businessWithoutDistance} showDistance={true} />
    );

    expect(queryByText(/mi/)).toBeNull();
  });
});