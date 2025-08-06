import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ExpandableText } from '../ExpandableText';

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

describe('ExpandableText', () => {
  const longText = 'This is a very long text that should be truncated when displayed initially because it exceeds the maximum number of lines that are allowed to be shown in the component by default settings.';
  const shortText = 'Short text';

  it('renders short text without expand button', () => {
    const { queryByText, getByText } = renderWithNativeBase(
      <ExpandableText text={shortText} />
    );

    expect(getByText(shortText)).toBeTruthy();
    expect(queryByText('Show More')).toBeNull();
    expect(queryByText('Show Less')).toBeNull();
  });

  it('renders long text with Show More button', () => {
    const { getByText } = renderWithNativeBase(
      <ExpandableText text={longText} />
    );

    expect(getByText('Show More')).toBeTruthy();
  });

  it('expands text when Show More is pressed', () => {
    const { getByText } = renderWithNativeBase(
      <ExpandableText text={longText} />
    );

    const showMoreButton = getByText('Show More');
    fireEvent.press(showMoreButton);

    expect(getByText('Show Less')).toBeTruthy();
  });

  it('collapses text when Show Less is pressed', () => {
    const { getByText } = renderWithNativeBase(
      <ExpandableText text={longText} />
    );

    // Expand first
    fireEvent.press(getByText('Show More'));
    expect(getByText('Show Less')).toBeTruthy();

    // Then collapse
    fireEvent.press(getByText('Show Less'));
    expect(getByText('Show More')).toBeTruthy();
  });

  it('uses custom button texts', () => {
    const { getByText } = renderWithNativeBase(
      <ExpandableText 
        text={longText} 
        showMoreText="Read More"
        showLessText="Read Less"
      />
    );

    expect(getByText('Read More')).toBeTruthy();

    fireEvent.press(getByText('Read More'));
    expect(getByText('Read Less')).toBeTruthy();
  });

  it('handles empty text', () => {
    const { container } = renderWithNativeBase(
      <ExpandableText text="" />
    );

    expect(container.children).toHaveLength(1);
  });

  it('handles undefined text', () => {
    const { container } = renderWithNativeBase(
      <ExpandableText text={undefined as any} />
    );

    expect(container.children).toHaveLength(1);
  });

  it('respects custom max lines', () => {
    const { getByText } = renderWithNativeBase(
      <ExpandableText text={longText} maxLines={2} />
    );

    expect(getByText('Show More')).toBeTruthy();
  });
});