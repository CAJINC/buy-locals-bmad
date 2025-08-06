import React from 'react';
import { render } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { BusinessRating } from '../BusinessRating';

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

describe('BusinessRating', () => {
  it('renders rating with stars correctly', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessRating rating={4.5} reviewCount={100} />
    );

    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('100 reviews')).toBeTruthy();
  });

  it('handles single review count correctly', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessRating rating={5.0} reviewCount={1} />
    );

    expect(getByText('1 review')).toBeTruthy();
  });

  it('renders in compact mode', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessRating rating={3.7} reviewCount={25} compact={true} />
    );

    expect(getByText('3.7')).toBeTruthy();
    expect(getByText('(25)')).toBeTruthy();
  });

  it('handles zero reviews', () => {
    const { getByText, queryByText } = renderWithNativeBase(
      <BusinessRating rating={4.0} reviewCount={0} />
    );

    expect(getByText('4.0')).toBeTruthy();
    expect(queryByText('reviews')).toBeNull();
  });

  it('does not show review count when disabled', () => {
    const { getByText, queryByText } = renderWithNativeBase(
      <BusinessRating rating={4.2} reviewCount={50} showReviewCount={false} />
    );

    expect(getByText('4.2')).toBeTruthy();
    expect(queryByText('50 reviews')).toBeNull();
  });

  it('handles edge case ratings', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessRating rating={0} reviewCount={1} />
    );

    expect(getByText('0.0')).toBeTruthy();
  });

  it('handles maximum rating', () => {
    const { getByText } = renderWithNativeBase(
      <BusinessRating rating={5.0} reviewCount={200} />
    );

    expect(getByText('5.0')).toBeTruthy();
    expect(getByText('200 reviews')).toBeTruthy();
  });
});