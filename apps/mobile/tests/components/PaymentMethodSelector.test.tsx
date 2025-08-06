import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import PaymentMethodSelector from '../../src/components/payment/PaymentMethodSelector';
import { usePaymentMethods } from '../../src/hooks/usePaymentMethods';

// Mock hooks
jest.mock('../../src/hooks/usePaymentMethods', () => ({
  usePaymentMethods: jest.fn(),
}));

// Mock Stripe components
jest.mock('@stripe/stripe-react-native', () => ({
  CardField: ({ onCardChange, ...props }: any) => {
    const MockCardField = require('react-native').TextInput;
    return (
      <MockCardField
        testID="card-field"
        placeholder="Card details"
        onChangeText={(text: string) => {
          if (onCardChange) {
            const isComplete = text.length >= 16;
            const isValid = /^\d+$/.test(text);
            onCardChange({
              complete: isComplete,
              valid: isValid,
              last4: text.slice(-4),
              brand: text.startsWith('4') ? 'visa' : 'mastercard',
              expiryMonth: 12,
              expiryYear: 2025,
            });
          }
        }}
        {...props}
      />
    );
  },
  useStripe: () => ({
    createPaymentMethod: jest.fn().mockResolvedValue({
      paymentMethod: {
        id: 'pm_new_test_123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
        },
      },
      error: null,
    }),
  }),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

describe('PaymentMethodSelector', () => {
  const mockUsePaymentMethods = usePaymentMethods as jest.MockedFunction<typeof usePaymentMethods>;

  const defaultProps = {
    onSelect: jest.fn(),
    onError: jest.fn(),
    customerId: 'cus_test_customer',
    allowAddNew: true,
  };

  beforeEach(() => {
    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [
        {
          id: 'pm_test_visa',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025,
          },
        },
        {
          id: 'pm_test_mastercard',
          type: 'card',
          card: {
            brand: 'mastercard',
            last4: '8888',
            expMonth: 6,
            expYear: 2026,
          },
        },
      ],
      selectedPaymentMethod: null,
      setSelectedPaymentMethod: jest.fn(),
      addPaymentMethod: jest.fn().mockResolvedValue({
        success: true,
        paymentMethod: {
          id: 'pm_new_test_123',
          type: 'card',
          card: { brand: 'visa', last4: '4242' },
        },
      }),
      removePaymentMethod: jest.fn().mockResolvedValue({ success: true }),
      loading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render saved payment methods', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('•••• 4242')).toBeTruthy();
      expect(screen.getByText('•••• 8888')).toBeTruthy();
      expect(screen.getByText('12/25')).toBeTruthy(); // Expiry date
      expect(screen.getByText('06/26')).toBeTruthy(); // Expiry date
    });

    it('should show card brand icons', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      const mastercardCard = screen.getByTestId('payment-method-pm_test_mastercard');

      expect(visaCard).toBeTruthy();
      expect(mastercardCard).toBeTruthy();
    });

    it('should show add new payment method option when allowed', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('Add New Payment Method')).toBeTruthy();
      expect(screen.getByTestId('add-payment-method-button')).toBeTruthy();
    });

    it('should hide add new payment method option when not allowed', () => {
      const propsWithoutAddNew = {
        ...defaultProps,
        allowAddNew: false,
      };

      render(<PaymentMethodSelector {...propsWithoutAddNew} />);

      expect(screen.queryByText('Add New Payment Method')).toBeNull();
    });

    it('should show empty state when no payment methods exist', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('No saved payment methods')).toBeTruthy();
      expect(screen.getByText('Add your first payment method to get started')).toBeTruthy();
    });

    it('should show loading state', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: true,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByTestID('loading-indicator')).toBeTruthy();
    });
  });

  describe('Payment Method Selection', () => {
    it('should select payment method when pressed', () => {
      const mockSetSelectedPaymentMethod = jest.fn();
      
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: mockSetSelectedPaymentMethod,
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent.press(visaCard);

      expect(mockSetSelectedPaymentMethod).toHaveBeenCalledWith('pm_test_visa');
      expect(defaultProps.onSelect).toHaveBeenCalledWith({
        id: 'pm_test_visa',
        type: 'card',
        card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
      });
    });

    it('should show selected payment method visually', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: 'pm_test_visa',
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      expect(visaCard.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: expect.any(String) })
      );
    });

    it('should handle payment method deselection', () => {
      const mockSetSelectedPaymentMethod = jest.fn();
      
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: 'pm_test_visa',
        setSelectedPaymentMethod: mockSetSelectedPaymentMethod,
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent.press(visaCard);

      expect(mockSetSelectedPaymentMethod).toHaveBeenCalledWith(null);
      expect(defaultProps.onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Adding New Payment Methods', () => {
    it('should show add new payment method form', async () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const addButton = screen.getByTestId('add-payment-method-button');
      fireEvent.press(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('card-field')).toBeTruthy();
        expect(screen.getByText('Save Payment Method')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();
      });
    });

    it('should validate new payment method input', async () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const addButton = screen.getByTestId('add-payment-method-button');
      fireEvent.press(addButton);

      const cardField = await screen.findByTestId('card-field');
      
      // Enter incomplete card details
      fireEvent.changeText(cardField, '4242');
      
      await waitFor(() => {
        const saveButton = screen.getByText('Save Payment Method');
        expect(saveButton).toBeDisabled();
      });

      // Enter complete card details
      fireEvent.changeText(cardField, '4242424242424242');
      
      await waitFor(() => {
        const saveButton = screen.getByText('Save Payment Method');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should save new payment method successfully', async () => {
      const mockAddPaymentMethod = jest.fn().mockResolvedValue({
        success: true,
        paymentMethod: {
          id: 'pm_new_test_123',
          type: 'card',
          card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
        },
      });

      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: mockAddPaymentMethod,
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const addButton = screen.getByTestId('add-payment-method-button');
      fireEvent.press(addButton);

      const cardField = await screen.findByTestId('card-field');
      fireEvent.changeText(cardField, '4242424242424242');

      const saveButton = await screen.findByText('Save Payment Method');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockAddPaymentMethod).toHaveBeenCalled();
        expect(screen.getByText('Payment method saved successfully')).toBeTruthy();
      });
    });

    it('should handle payment method save errors', async () => {
      const mockAddPaymentMethod = jest.fn().mockResolvedValue({
        success: false,
        error: 'Card declined',
      });

      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: mockAddPaymentMethod,
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const addButton = screen.getByTestId('add-payment-method-button');
      fireEvent.press(addButton);

      const cardField = await screen.findByTestId('card-field');
      fireEvent.changeText(cardField, '4242424242424242');

      const saveButton = await screen.findByText('Save Payment Method');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Card declined')).toBeTruthy();
        expect(defaultProps.onError).toHaveBeenCalledWith('Card declined');
      });
    });

    it('should cancel adding new payment method', async () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const addButton = screen.getByTestId('add-payment-method-button');
      fireEvent.press(addButton);

      const cancelButton = await screen.findByText('Cancel');
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('card-field')).toBeNull();
        expect(screen.getByTestId('add-payment-method-button')).toBeTruthy();
      });
    });
  });

  describe('Payment Method Management', () => {
    it('should show delete option for saved payment methods', async () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      
      // Long press to show context menu
      fireEvent(visaCard, 'longPress');

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();
      });
    });

    it('should delete payment method successfully', async () => {
      const mockRemovePaymentMethod = jest.fn().mockResolvedValue({ success: true });

      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: mockRemovePaymentMethod,
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent(visaCard, 'longPress');

      const deleteButton = await screen.findByText('Delete');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(mockRemovePaymentMethod).toHaveBeenCalledWith('pm_test_visa');
        expect(screen.getByText('Payment method deleted')).toBeTruthy();
      });
    });

    it('should handle payment method deletion errors', async () => {
      const mockRemovePaymentMethod = jest.fn().mockResolvedValue({
        success: false,
        error: 'Cannot delete default payment method',
      });

      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: mockRemovePaymentMethod,
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent(visaCard, 'longPress');

      const deleteButton = await screen.findByText('Delete');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Cannot delete default payment method')).toBeTruthy();
        expect(defaultProps.onError).toHaveBeenCalledWith('Cannot delete default payment method');
      });
    });

    it('should show confirmation dialog before deletion', async () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent(visaCard, 'longPress');

      const deleteButton = await screen.findByText('Delete');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Payment Method')).toBeTruthy();
        expect(screen.getByText('Are you sure you want to delete this payment method?')).toBeTruthy();
        expect(screen.getByText('Delete')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();
      });
    });
  });

  describe('Card Brand Detection', () => {
    it('should display correct card brand icons', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaIcon = screen.getByTestId('card-brand-visa');
      const mastercardIcon = screen.getByTestId('card-brand-mastercard');

      expect(visaIcon).toBeTruthy();
      expect(mastercardIcon).toBeTruthy();
    });

    it('should handle unknown card brands gracefully', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_unknown',
            type: 'card',
            card: {
              brand: 'unknown',
              last4: '1234',
              expMonth: 12,
              expYear: 2025,
            },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('•••• 1234')).toBeTruthy();
      expect(screen.getByTestId('card-brand-unknown')).toBeTruthy();
    });

    it('should show expiry date for all cards', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('12/25')).toBeTruthy();
      expect(screen.getByText('06/26')).toBeTruthy();
    });

    it('should highlight expired cards', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_expired',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              expMonth: 12,
              expYear: 2020, // Expired
            },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const expiredCard = screen.getByTestId('payment-method-pm_test_expired');
      expect(expiredCard.props.style).toContainEqual(
        expect.objectContaining({ opacity: expect.any(Number) })
      );
      expect(screen.getByText('Expired')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      expect(visaCard.props.accessibilityLabel).toBe('Visa ending in 4242, expires 12/25');

      const addButton = screen.getByTestId('add-payment-method-button');
      expect(addButton.props.accessibilityLabel).toBe('Add new payment method');
    });

    it('should support screen readers', () => {
      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      expect(visaCard.props.accessibilityRole).toBe('button');
      expect(visaCard.props.accessible).toBe(true);
    });

    it('should announce selection changes', () => {
      const mockSetSelectedPaymentMethod = jest.fn();
      
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_visa',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: mockSetSelectedPaymentMethod,
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      const visaCard = screen.getByTestId('payment-method-pm_test_visa');
      fireEvent.press(visaCard);

      expect(visaCard.props.accessibilityState).toEqual({ selected: true });
    });
  });

  describe('Error Handling', () => {
    it('should display hook errors', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: 'Failed to load payment methods',
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('Failed to load payment methods')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('should handle network connectivity issues', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: 'Network error',
      });

      render(<PaymentMethodSelector {...defaultProps} />);

      expect(screen.getByText('Network error')).toBeTruthy();
      expect(screen.getByText('Check your connection and try again')).toBeTruthy();
    });

    it('should handle empty customer ID', () => {
      const propsWithoutCustomerId = {
        ...defaultProps,
        customerId: '',
      };

      render(<PaymentMethodSelector {...propsWithoutCustomerId} />);

      expect(screen.getByText('Unable to load payment methods')).toBeTruthy();
      expect(screen.getByText('Customer information is missing')).toBeTruthy();
    });
  });
});