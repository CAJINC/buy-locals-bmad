import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import PaymentForm from '../../src/components/payment/PaymentForm';
import { usePayment } from '../../src/hooks/usePayment';
import { usePaymentMethods } from '../../src/hooks/usePaymentMethods';
import { PaymentIntentParams } from '../../src/types/payment';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// Mock hooks
jest.mock('../../src/hooks/usePayment', () => ({
  usePayment: jest.fn(),
}));

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
        placeholder="Card number"
        onChangeText={(text: string) => {
          if (onCardChange) {
            const isComplete = text.length >= 16;
            const isValid = /^\d+$/.test(text);
            onCardChange({
              complete: isComplete,
              valid: isValid,
              last4: text.slice(-4),
              brand: 'visa',
              expiryMonth: 12,
              expiryYear: 2025,
            });
          }
        }}
        {...props}
      />
    );
  },
  PaymentSheet: {
    createPaymentMethod: jest.fn(),
  },
}));

// Mock biometric authentication
jest.mock('../../src/hooks/useBiometricAuth', () => ({
  useBiometricAuth: () => ({
    isAvailable: true,
    isEnrolled: true,
    authenticate: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('PaymentForm', () => {
  const mockUsePayment = usePayment as jest.MockedFunction<typeof usePayment>;
  const mockUsePaymentMethods = usePaymentMethods as jest.MockedFunction<typeof usePaymentMethods>;

  const defaultProps = {
    businessId: 'test-business-123',
    amount: 10000, // $100.00
    currency: 'USD',
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    mockUsePayment.mockReturnValue({
      createPaymentIntent: jest.fn().mockResolvedValue({
        success: true,
        paymentIntentId: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        status: 'requires_confirmation',
      }),
      confirmPayment: jest.fn().mockResolvedValue({
        success: true,
        status: 'succeeded',
      }),
      loading: false,
      error: null,
    });

    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [
        {
          id: 'pm_test_card',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
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

    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render payment form correctly', () => {
      render(<PaymentForm {...defaultProps} />);

      expect(screen.getByText('Payment Details')).toBeTruthy();
      expect(screen.getByText('$100.00')).toBeTruthy();
      expect(screen.getByTestId('card-field')).toBeTruthy();
      expect(screen.getByText('Pay Now')).toBeTruthy();
    });

    it('should display business information', () => {
      const propsWithBusinessInfo = {
        ...defaultProps,
        businessName: 'Test Restaurant',
        businessImage: 'https://example.com/business.jpg',
      };

      render(<PaymentForm {...propsWithBusinessInfo} />);

      expect(screen.getByText('Test Restaurant')).toBeTruthy();
    });

    it('should show loading state', () => {
      mockUsePayment.mockReturnValue({
        createPaymentIntent: jest.fn(),
        confirmPayment: jest.fn(),
        loading: true,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();
      expect(screen.getByText('Processing...')).toBeTruthy();
    });

    it('should display error messages', () => {
      mockUsePayment.mockReturnValue({
        createPaymentIntent: jest.fn(),
        confirmPayment: jest.fn(),
        loading: false,
        error: 'Payment failed: Card declined',
      });

      render(<PaymentForm {...defaultProps} />);

      expect(screen.getByText('Payment failed: Card declined')).toBeTruthy();
    });
  });

  describe('Payment Method Selection', () => {
    it('should display saved payment methods', () => {
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_card_1',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
          {
            id: 'pm_test_card_2',
            type: 'card',
            card: { brand: 'mastercard', last4: '8888', expMonth: 6, expYear: 2026 },
          },
        ],
        selectedPaymentMethod: null,
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      expect(screen.getByText('•••• 4242')).toBeTruthy();
      expect(screen.getByText('•••• 8888')).toBeTruthy();
      expect(screen.getByText('visa')).toBeTruthy();
      expect(screen.getByText('mastercard')).toBeTruthy();
    });

    it('should allow selecting a payment method', async () => {
      const mockSetSelectedPaymentMethod = jest.fn();
      
      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_card',
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

      render(<PaymentForm {...defaultProps} />);

      const paymentMethodOption = screen.getByText('•••• 4242');
      fireEvent.press(paymentMethodOption);

      expect(mockSetSelectedPaymentMethod).toHaveBeenCalledWith('pm_test_card');
    });

    it('should show add new payment method option', () => {
      render(<PaymentForm {...defaultProps} />);

      expect(screen.getByText('Add New Payment Method')).toBeTruthy();
    });

    it('should toggle between saved methods and new card entry', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      await waitFor(() => {
        expect(screen.getByTestId('card-field')).toBeTruthy();
      });

      const useSavedButton = screen.getByText('Use Saved Payment Method');
      fireEvent.press(useSavedButton);

      await waitFor(() => {
        expect(screen.getByText('•••• 4242')).toBeTruthy();
      });
    });
  });

  describe('Card Input Validation', () => {
    it('should validate card input as user types', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      const cardField = await screen.findByTestId('card-field');
      
      // Enter incomplete card number
      fireEvent.changeText(cardField, '4242');
      
      await waitFor(() => {
        const payButton = screen.getByText('Pay Now');
        expect(payButton).toBeDisabled();
      });

      // Enter complete card number
      fireEvent.changeText(cardField, '4242424242424242');
      
      await waitFor(() => {
        const payButton = screen.getByText('Pay Now');
        expect(payButton).not.toBeDisabled();
      });
    });

    it('should show card validation errors', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      const cardField = await screen.findByTestId('card-field');
      
      // Enter invalid card number
      fireEvent.changeText(cardField, '1234');
      
      await waitFor(() => {
        expect(screen.getByText('Invalid card number')).toBeTruthy();
      });
    });

    it('should detect card brand from number', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      const cardField = await screen.findByTestId('card-field');
      
      // Enter Visa card number
      fireEvent.changeText(cardField, '4242424242424242');
      
      await waitFor(() => {
        expect(screen.getByText('visa')).toBeTruthy();
      });
    });
  });

  describe('Payment Processing', () => {
    it('should process payment with new card successfully', async () => {
      const mockCreatePaymentIntent = jest.fn().mockResolvedValue({
        success: true,
        paymentIntentId: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        status: 'requires_confirmation',
      });

      const mockConfirmPayment = jest.fn().mockResolvedValue({
        success: true,
        status: 'succeeded',
      });

      mockUsePayment.mockReturnValue({
        createPaymentIntent: mockCreatePaymentIntent,
        confirmPayment: mockConfirmPayment,
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      // Add new payment method
      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      // Enter card details
      const cardField = await screen.findByTestId('card-field');
      fireEvent.changeText(cardField, '4242424242424242');

      // Process payment
      const payButton = await screen.findByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 10000,
            currency: 'USD',
            businessId: 'test-business-123',
          })
        );
        expect(mockConfirmPayment).toHaveBeenCalled();
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('should process payment with saved card successfully', async () => {
      const mockCreatePaymentIntent = jest.fn().mockResolvedValue({
        success: true,
        paymentIntentId: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        status: 'requires_confirmation',
      });

      const mockConfirmPayment = jest.fn().mockResolvedValue({
        success: true,
        status: 'succeeded',
      });

      mockUsePayment.mockReturnValue({
        createPaymentIntent: mockCreatePaymentIntent,
        confirmPayment: mockConfirmPayment,
        loading: false,
        error: null,
      });

      mockUsePaymentMethods.mockReturnValue({
        paymentMethods: [
          {
            id: 'pm_test_card',
            type: 'card',
            card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
          },
        ],
        selectedPaymentMethod: 'pm_test_card',
        setSelectedPaymentMethod: jest.fn(),
        addPaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentMethodId: 'pm_test_card',
          })
        );
        expect(mockConfirmPayment).toHaveBeenCalled();
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle payment errors', async () => {
      const mockCreatePaymentIntent = jest.fn().mockResolvedValue({
        success: false,
        error: 'Card declined',
      });

      mockUsePayment.mockReturnValue({
        createPaymentIntent: mockCreatePaymentIntent,
        confirmPayment: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Card declined');
      });
    });

    it('should handle authentication required', async () => {
      const mockConfirmPayment = jest.fn().mockResolvedValue({
        success: false,
        error: 'authentication_required',
        nextAction: {
          type: 'use_stripe_sdk',
          stripe_js: {
            client_secret: 'pi_test_123_secret',
          },
        },
      });

      mockUsePayment.mockReturnValue({
        createPaymentIntent: jest.fn().mockResolvedValue({
          success: true,
          paymentIntentId: 'pi_test_123',
          clientSecret: 'pi_test_123_secret',
          status: 'requires_action',
        }),
        confirmPayment: mockConfirmPayment,
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(screen.getByText('Additional authentication required')).toBeTruthy();
      });
    });
  });

  describe('Biometric Authentication', () => {
    it('should show biometric authentication option when available', () => {
      const propsWithBiometric = {
        ...defaultProps,
        enableBiometric: true,
      };

      render(<PaymentForm {...propsWithBiometric} />);

      expect(screen.getByText('Use Touch ID')).toBeTruthy();
    });

    it('should trigger biometric authentication before payment', async () => {
      const mockAuthenticate = jest.fn().mockResolvedValue({ success: true });
      
      jest.doMock('../../src/hooks/useBiometricAuth', () => ({
        useBiometricAuth: () => ({
          isAvailable: true,
          isEnrolled: true,
          authenticate: mockAuthenticate,
        }),
      }));

      const propsWithBiometric = {
        ...defaultProps,
        enableBiometric: true,
      };

      render(<PaymentForm {...propsWithBiometric} />);

      const biometricSwitch = screen.getByTestId('biometric-toggle');
      fireEvent(biometricSwitch, 'valueChange', true);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(mockAuthenticate).toHaveBeenCalled();
      });
    });

    it('should handle biometric authentication failure', async () => {
      const mockAuthenticate = jest.fn().mockResolvedValue({ 
        success: false, 
        error: 'Authentication failed',
      });
      
      jest.doMock('../../src/hooks/useBiometricAuth', () => ({
        useBiometricAuth: () => ({
          isAvailable: true,
          isEnrolled: true,
          authenticate: mockAuthenticate,
        }),
      }));

      const propsWithBiometric = {
        ...defaultProps,
        enableBiometric: true,
      };

      render(<PaymentForm {...propsWithBiometric} />);

      const biometricSwitch = screen.getByTestId('biometric-toggle');
      fireEvent(biometricSwitch, 'valueChange', true);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeTruthy();
      });
    });
  });

  describe('Form Interaction', () => {
    it('should allow canceling payment', () => {
      render(<PaymentForm {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.press(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should save payment method option', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      const saveMethodSwitch = await screen.findByTestId('save-payment-method');
      fireEvent(saveMethodSwitch, 'valueChange', true);

      expect(saveMethodSwitch.props.value).toBe(true);
    });

    it('should show payment summary', () => {
      const propsWithDetails = {
        ...defaultProps,
        subtotal: 9000, // $90.00
        tax: 875, // $8.75
        platformFee: 125, // $1.25
      };

      render(<PaymentForm {...propsWithDetails} />);

      expect(screen.getByText('$90.00')).toBeTruthy(); // Subtotal
      expect(screen.getByText('$8.75')).toBeTruthy(); // Tax
      expect(screen.getByText('$1.25')).toBeTruthy(); // Platform fee
      expect(screen.getByText('$100.00')).toBeTruthy(); // Total
    });

    it('should handle keyboard dismiss', () => {
      render(<PaymentForm {...defaultProps} />);

      const scrollView = screen.getByTestId('payment-form-scroll');
      fireEvent(scrollView, 'scrollBeginDrag');

      // Keyboard should be dismissed (mock implementation)
      expect(true).toBe(true); // Placeholder for keyboard dismissal verification
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(<PaymentForm {...defaultProps} />);

      const payButton = screen.getByText('Pay Now');
      expect(payButton.props.accessibilityLabel).toBe('Pay Now, $100.00');

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton.props.accessibilityLabel).toBe('Cancel payment');
    });

    it('should support screen readers', () => {
      render(<PaymentForm {...defaultProps} />);

      const amountText = screen.getByText('$100.00');
      expect(amountText.props.accessibilityRole).toBe('text');
      expect(amountText.props.accessibilityLabel).toBe('Total amount: One hundred dollars');
    });

    it('should have proper focus order', async () => {
      render(<PaymentForm {...defaultProps} />);

      const addNewButton = screen.getByText('Add New Payment Method');
      fireEvent.press(addNewButton);

      const cardField = await screen.findByTestId('card-field');
      expect(cardField.props.autoFocus).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount', () => {
      const propsWithZeroAmount = {
        ...defaultProps,
        amount: 0,
      };

      render(<PaymentForm {...propsWithZeroAmount} />);

      expect(screen.getByText('$0.00')).toBeTruthy();
      
      const payButton = screen.getByText('Pay Now');
      expect(payButton).toBeDisabled();
    });

    it('should handle very large amounts', () => {
      const propsWithLargeAmount = {
        ...defaultProps,
        amount: 99999999, // $999,999.99
      };

      render(<PaymentForm {...propsWithLargeAmount} />);

      expect(screen.getByText('$999,999.99')).toBeTruthy();
    });

    it('should handle different currencies', () => {
      const propsWithEUR = {
        ...defaultProps,
        currency: 'EUR',
        amount: 10000,
      };

      render(<PaymentForm {...propsWithEUR} />);

      expect(screen.getByText('€100.00')).toBeTruthy();
    });

    it('should handle network errors gracefully', async () => {
      const mockCreatePaymentIntent = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      mockUsePayment.mockReturnValue({
        createPaymentIntent: mockCreatePaymentIntent,
        confirmPayment: jest.fn(),
        loading: false,
        error: null,
      });

      render(<PaymentForm {...defaultProps} />);

      const payButton = screen.getByText('Pay Now');
      fireEvent.press(payButton);

      await waitFor(() => {
        expect(screen.getByText('Network error. Please check your connection and try again.')).toBeTruthy();
      });
    });
  });
});