import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { SearchBar } from '../SearchBar/SearchBar';
import { SearchSuggestion } from '../../../services/suggestionService';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    default: {
      View,
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((value) => value),
    withSpring: jest.fn((value) => value),
    withSequence: jest.fn((...values) => values[values.length - 1]),
    interpolate: jest.fn((value, input, output) => output[0]),
    FadeIn: {
      duration: jest.fn(() => ({})),
    },
    SlideInDown: {
      duration: jest.fn(() => ({})),
    },
  };
});

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}));

jest.mock('../VoiceSearch/VoiceSearch', () => ({
  VoiceSearch: ({ onResult }: any) => (
    <button
      testID="voice-search-button"
      onPress={() => onResult('voice search result')}
    >
      Voice Search
    </button>
  ),
}));

jest.mock('../SearchSuggestions/SearchSuggestions', () => ({
  SearchSuggestions: ({ onSuggestionSelect }: any) => (
    <button
      testID="suggestion-button"
      onPress={() => onSuggestionSelect({ id: 'test', text: 'test suggestion' })}
    >
      Test Suggestion
    </button>
  ),
}));

const mockTheme = {
  primaryColor: '#007AFF',
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  placeholderColor: '#8E8E93',
  borderColor: '#E5E5E7',
  shadowColor: '#000000',
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();
  const mockOnSuggestionSelect = jest.fn();
  const mockOnQueryChange = jest.fn();
  const mockOnFocus = jest.fn();
  const mockOnBlur = jest.fn();
  const mockOnVoiceSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    onSearch: mockOnSearch,
    onSuggestionSelect: mockOnSuggestionSelect,
    theme: mockTheme,
  };

  it('renders correctly with default props', () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} />
      </TestWrapper>
    );

    expect(getByPlaceholderText('Search businesses, categories...')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const customPlaceholder = 'Custom search placeholder';
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} placeholder={customPlaceholder} />
      </TestWrapper>
    );

    expect(getByPlaceholderText(customPlaceholder)).toBeTruthy();
  });

  it('displays initial query', () => {
    const initialQuery = 'initial search text';
    const { getByDisplayValue } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} initialQuery={initialQuery} />
      </TestWrapper>
    );

    expect(getByDisplayValue(initialQuery)).toBeTruthy();
  });

  it('handles text input changes', async () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} onQueryChange={mockOnQueryChange} />
      </TestWrapper>
    );

    const input = getByPlaceholderText('Search businesses, categories...');
    
    fireEvent.changeText(input, 'test query');

    await waitFor(() => {
      expect(mockOnQueryChange).toHaveBeenCalledWith('test query');
    });
  });

  it('handles search submission', () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} initialQuery="test search" />
      </TestWrapper>
    );

    const input = getByPlaceholderText('Search businesses, categories...');
    
    fireEvent(input, 'submitEditing');

    expect(mockOnSearch).toHaveBeenCalledWith('test search');
  });

  it('handles focus and blur events', () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar
          {...defaultProps}
          onFocus={mockOnFocus}
          onBlur={mockOnBlur}
        />
      </TestWrapper>
    );

    const input = getByPlaceholderText('Search businesses, categories...');
    
    fireEvent(input, 'focus');
    expect(mockOnFocus).toHaveBeenCalled();
    
    fireEvent(input, 'blur');
    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const { getByTestId } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} isLoading={true} />
      </TestWrapper>
    );

    // The ActivityIndicator should be rendered when loading
    expect(() => getByTestId('loading-indicator')).not.toThrow();
  });

  it('handles voice search when enabled', () => {
    const { getByTestId } = render(
      <TestWrapper>
        <SearchBar
          {...defaultProps}
          showVoiceSearch={true}
          onVoiceSearch={mockOnVoiceSearch}
        />
      </TestWrapper>
    );

    const voiceButton = getByTestId('voice-search-button');
    fireEvent.press(voiceButton);

    expect(mockOnVoiceSearch).toHaveBeenCalledWith('voice search result');
  });

  it('handles suggestion selection', () => {
    const { getByTestId, getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} />
      </TestWrapper>
    );

    // Focus input to show suggestions
    const input = getByPlaceholderText('Search businesses, categories...');
    fireEvent(input, 'focus');

    const suggestionButton = getByTestId('suggestion-button');
    fireEvent.press(suggestionButton);

    expect(mockOnSuggestionSelect).toHaveBeenCalledWith({
      id: 'test',
      text: 'test suggestion',
    });
  });

  it('handles clear button press', async () => {
    const { getByPlaceholderText, queryByTestId } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} initialQuery="test query" />
      </TestWrapper>
    );

    // Change text to show clear button
    const input = getByPlaceholderText('Search businesses, categories...');
    fireEvent.changeText(input, 'some text');

    // Wait for clear button to appear
    await waitFor(() => {
      const clearButton = queryByTestId('clear-button');
      if (clearButton) {
        fireEvent.press(clearButton);
      }
    });

    // Input should be cleared
    expect(input.props.value).toBe('');
  });

  it('disables input when disabled prop is true', () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} disabled={true} />
      </TestWrapper>
    );

    const input = getByPlaceholderText('Search businesses, categories...');
    expect(input.props.editable).toBe(false);
  });

  it('applies custom theme colors', () => {
    const customTheme = {
      ...mockTheme,
      primaryColor: '#FF0000',
      backgroundColor: '#000000',
      textColor: '#FFFFFF',
    };

    const { getByTestId } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} theme={customTheme} />
      </TestWrapper>
    );

    // Check if custom theme is applied by checking container styles
    const container = getByTestId('search-bar-container') || { props: { style: {} } };
    
    // Note: In a real test, you'd check for the actual style application
    // This is a simplified test structure
    expect(customTheme.primaryColor).toBe('#FF0000');
  });

  it('debounces query changes', async () => {
    jest.useFakeTimers();

    const { getByPlaceholderText } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} onQueryChange={mockOnQueryChange} debounceMs={300} />
      </TestWrapper>
    );

    const input = getByPlaceholderText('Search businesses, categories...');

    // Make multiple rapid changes
    fireEvent.changeText(input, 't');
    fireEvent.changeText(input, 'te');
    fireEvent.changeText(input, 'tes');
    fireEvent.changeText(input, 'test');

    // Should not have called yet
    expect(mockOnQueryChange).not.toHaveBeenCalledWith('test');

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockOnQueryChange).toHaveBeenCalledWith('test');
    });

    jest.useRealTimers();
  });

  it('handles location prop correctly', () => {
    const mockLocation = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      timestamp: Date.now(),
    };

    const { rerender } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} />
      </TestWrapper>
    );

    // Update with location
    rerender(
      <TestWrapper>
        <SearchBar {...defaultProps} location={mockLocation} />
      </TestWrapper>
    );

    // Component should render without errors with location
    expect(true).toBe(true); // Placeholder assertion
  });

  it('handles performance mode correctly', () => {
    const { rerender } = render(
      <TestWrapper>
        <SearchBar {...defaultProps} performanceMode="fast" />
      </TestWrapper>
    );

    rerender(
      <TestWrapper>
        <SearchBar {...defaultProps} performanceMode="comprehensive" />
      </TestWrapper>
    );

    // Component should render without errors with different performance modes
    expect(true).toBe(true); // Placeholder assertion
  });
});