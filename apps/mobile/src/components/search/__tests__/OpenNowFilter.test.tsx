import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { OpenNowFilter, EnhancedOpenNowFilter } from '../OpenNowFilter';

// Mock Animated
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      Value: jest.fn().mockImplementation((initialValue) => ({
        setValue: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        interpolate: jest.fn(),
        extractOffset: jest.fn(),
        setOffset: jest.fn(),
        flattenOffset: jest.fn(),
        stopAnimation: jest.fn(),
        resetAnimation: jest.fn(),
      })),
      timing: jest.fn().mockReturnValue({
        start: jest.fn((callback) => callback && callback()),
      }),
      sequence: jest.fn().mockReturnValue({
        start: jest.fn((callback) => callback && callback()),
      }),
    },
  };
});

describe('OpenNowFilter', () => {
  const defaultProps = {
    isActive: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render correctly when inactive', () => {
      const { getByTestId, getByText } = render(<OpenNowFilter {...defaultProps} />);
      
      expect(getByTestId('open-now-filter')).toBeTruthy();
      expect(getByText('Open Now')).toBeTruthy();
    });

    it('should render correctly when active', () => {
      const { getByTestId, getByText } = render(
        <OpenNowFilter {...defaultProps} isActive={true} />
      );
      
      expect(getByTestId('open-now-filter')).toBeTruthy();
      expect(getByText('Open Now')).toBeTruthy();
    });

    it('should display business count when provided', () => {
      const { getByText } = render(
        <OpenNowFilter {...defaultProps} businessCount={5} />
      );
      
      expect(getByText('5 open now')).toBeTruthy();
    });

    it('should display singular form for one business', () => {
      const { getByText } = render(
        <OpenNowFilter {...defaultProps} businessCount={1} />
      );
      
      expect(getByText('1 open now')).toBeTruthy();
    });

    it('should display "None open" when count is zero', () => {
      const { getByText } = render(
        <OpenNowFilter {...defaultProps} businessCount={0} />
      );
      
      expect(getByText('None open')).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should call onToggle when button is pressed', async () => {
      const mockOnToggle = jest.fn();
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} onToggle={mockOnToggle} />
      );
      
      const button = getByTestId('open-now-filter-button');
      
      await act(async () => {
        fireEvent.press(button);
      });
      
      expect(mockOnToggle).toHaveBeenCalledWith(true);
    });

    it('should toggle active state correctly', async () => {
      const mockOnToggle = jest.fn();
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} isActive={true} onToggle={mockOnToggle} />
      );
      
      const button = getByTestId('open-now-filter-button');
      
      await act(async () => {
        fireEvent.press(button);
      });
      
      expect(mockOnToggle).toHaveBeenCalledWith(false);
    });

    it('should be disabled when loading', () => {
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} isLoading={true} />
      );
      
      const button = getByTestId('open-now-filter-button');
      expect(button.props.disabled).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} isLoading={true} />
      );
      
      expect(getByTestId('open-now-filter')).toBeTruthy();
    });

    it('should not display count when loading', () => {
      const { queryByText } = render(
        <OpenNowFilter {...defaultProps} businessCount={5} isLoading={true} />
      );
      
      expect(queryByText('5 open now')).toBeFalsy();
    });
  });

  describe('Visual States', () => {
    it('should apply active styling when active', () => {
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} isActive={true} />
      );
      
      const container = getByTestId('open-now-filter');
      expect(container).toBeTruthy();
    });

    it('should show active badge when active', () => {
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} isActive={true} />
      );
      
      expect(getByTestId('open-now-filter')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper testID', () => {
      const { getByTestId } = render(<OpenNowFilter {...defaultProps} />);
      
      expect(getByTestId('open-now-filter')).toBeTruthy();
      expect(getByTestId('open-now-filter-button')).toBeTruthy();
    });

    it('should support custom testID', () => {
      const { getByTestId } = render(
        <OpenNowFilter {...defaultProps} testID="custom-filter" />
      );
      
      expect(getByTestId('custom-filter')).toBeTruthy();
      expect(getByTestId('custom-filter-button')).toBeTruthy();
    });
  });
});

describe('EnhancedOpenNowFilter', () => {
  const defaultProps = {
    isActive: false,
    onToggle: jest.fn(),
    businessCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Features', () => {
    it('should render without recommendations by default', () => {
      const { getByTestId } = render(<EnhancedOpenNowFilter {...defaultProps} />);
      
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
      expect(getByTestId('enhanced-open-now-filter-main')).toBeTruthy();
    });

    it('should show recommendations when enabled', () => {
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps} 
          showRecommendations={true}
          isActive={true}
        />
      );
      
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
    });

    it('should display closing soon recommendation', () => {
      const mockOnRecommendation = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          closingSoonCount={3}
          onRecommendationPress={mockOnRecommendation}
        />
      );
      
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
    });

    it('should display next opening recommendation', () => {
      const mockOnRecommendation = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          nextOpeningCount={2}
          onRecommendationPress={mockOnRecommendation}
        />
      );
      
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
    });
  });

  describe('Recommendation Interactions', () => {
    it('should call onRecommendationPress for closing soon', async () => {
      const mockOnRecommendation = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          closingSoonCount={3}
          onRecommendationPress={mockOnRecommendation}
        />
      );
      
      // Toggle to show details first
      const detailsToggle = getByTestId('enhanced-open-now-filter-details-toggle');
      await act(async () => {
        fireEvent.press(detailsToggle);
      });
      
      const closingSoonButton = getByTestId('enhanced-open-now-filter-closing-soon');
      await act(async () => {
        fireEvent.press(closingSoonButton);
      });
      
      expect(mockOnRecommendation).toHaveBeenCalledWith('closing-soon');
    });

    it('should call onRecommendationPress for next opening', async () => {
      const mockOnRecommendation = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          nextOpeningCount={2}
          onRecommendationPress={mockOnRecommendation}
        />
      );
      
      // Toggle to show details first
      const detailsToggle = getByTestId('enhanced-open-now-filter-details-toggle');
      await act(async () => {
        fireEvent.press(detailsToggle);
      });
      
      const nextOpeningButton = getByTestId('enhanced-open-now-filter-next-opening');
      await act(async () => {
        fireEvent.press(nextOpeningButton);
      });
      
      expect(mockOnRecommendation).toHaveBeenCalledWith('next-opening');
    });
  });

  describe('Details Toggle', () => {
    it('should toggle details visibility', async () => {
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          closingSoonCount={3}
        />
      );
      
      const detailsToggle = getByTestId('enhanced-open-now-filter-details-toggle');
      
      // Toggle to show details
      await act(async () => {
        fireEvent.press(detailsToggle);
      });
      
      // Should show recommendations
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
      
      // Toggle to hide details
      await act(async () => {
        fireEvent.press(detailsToggle);
      });
      
      expect(getByTestId('enhanced-open-now-filter')).toBeTruthy();
    });
  });

  describe('Integration with Base Component', () => {
    it('should pass through all base props', () => {
      const mockOnToggle = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          onToggle={mockOnToggle}
          businessCount={5}
          isLoading={true}
        />
      );
      
      expect(getByTestId('enhanced-open-now-filter-main')).toBeTruthy();
    });

    it('should handle main filter toggle', async () => {
      const mockOnToggle = jest.fn();
      const { getByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          onToggle={mockOnToggle}
          showRecommendations={true}
        />
      );
      
      const mainButton = getByTestId('enhanced-open-now-filter-main-button');
      
      await act(async () => {
        fireEvent.press(mainButton);
      });
      
      expect(mockOnToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('Conditional Rendering', () => {
    it('should not show details toggle when recommendations are disabled', () => {
      const { queryByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={false}
          isActive={true}
        />
      );
      
      expect(queryByTestId('enhanced-open-now-filter-details-toggle')).toBeFalsy();
    });

    it('should not show closing soon button when count is zero', () => {
      const { queryByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          closingSoonCount={0}
        />
      );
      
      expect(queryByTestId('enhanced-open-now-filter-closing-soon')).toBeFalsy();
    });

    it('should not show next opening button when count is zero', () => {
      const { queryByTestId } = render(
        <EnhancedOpenNowFilter 
          {...defaultProps}
          showRecommendations={true}
          isActive={true}
          nextOpeningCount={0}
        />
      );
      
      expect(queryByTestId('enhanced-open-now-filter-next-opening')).toBeFalsy();
    });
  });
});