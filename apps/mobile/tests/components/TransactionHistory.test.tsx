import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import TransactionHistory from '../../src/components/transaction/TransactionHistory';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

// Mock hooks
const mockTransactionHistory = [
  {
    id: 'txn_1',
    receiptNumber: 'RCP-2024-001',
    transactionId: 'pi_test_123',
    businessId: 'biz_test_1',
    businessName: 'Test Restaurant',
    amount: 2500, // $25.00
    currency: 'USD',
    status: 'paid',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    refundedAt: null,
    refundAmount: null,
    items: [
      {
        id: 'item_1',
        name: 'Lunch Special',
        quantity: 1,
        unitPrice: 2500,
        totalPrice: 2500,
      },
    ],
    paymentMethod: {
      type: 'card',
      brand: 'visa',
      last4: '4242',
    },
  },
  {
    id: 'txn_2',
    receiptNumber: 'RCP-2024-002',
    transactionId: 'pi_test_456',
    businessId: 'biz_test_2',
    businessName: 'Coffee Shop',
    amount: 750, // $7.50
    currency: 'USD',
    status: 'refunded',
    createdAt: new Date('2024-01-10T14:20:00Z'),
    refundedAt: new Date('2024-01-11T09:15:00Z'),
    refundAmount: 750,
    items: [
      {
        id: 'item_2',
        name: 'Cappuccino',
        quantity: 1,
        unitPrice: 750,
        totalPrice: 750,
      },
    ],
    paymentMethod: {
      type: 'card',
      brand: 'mastercard',
      last4: '8888',
    },
  },
];

jest.mock('../../src/services/apiService', () => ({
  get: jest.fn().mockResolvedValue({
    data: {
      transactions: mockTransactionHistory,
      summary: {
        totalTransactions: 2,
        totalSpent: 3250, // $32.50
        averageTransactionAmount: 1625, // $16.25
      },
      pagination: {
        page: 1,
        totalPages: 1,
        hasMore: false,
      },
    },
  }),
}));

// Mock date picker
jest.mock('react-native-date-picker', () => {
  return ({ onDateChange, date, ...props }: any) => {
    const MockDatePicker = require('react-native').View;
    return (
      <MockDatePicker
        testID="date-picker"
        onPress={() => onDateChange && onDateChange(new Date('2024-01-01'))}
        {...props}
      />
    );
  };
});

describe('TransactionHistory', () => {
  const defaultProps = {
    customerId: 'cus_test_customer',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render transaction history list', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Transaction History')).toBeTruthy();
        expect(screen.getByText('Test Restaurant')).toBeTruthy();
        expect(screen.getByText('Coffee Shop')).toBeTruthy();
        expect(screen.getByText('$25.00')).toBeTruthy();
        expect(screen.getByText('$7.50')).toBeTruthy();
      });
    });

    it('should display transaction status correctly', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Paid')).toBeTruthy();
        expect(screen.getByText('Refunded')).toBeTruthy();
      });
    });

    it('should show transaction dates in correct format', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Jan 15, 2024')).toBeTruthy();
        expect(screen.getByText('Jan 10, 2024')).toBeTruthy();
      });
    });

    it('should display payment method information', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('•••• 4242')).toBeTruthy();
        expect(screen.getByText('•••• 8888')).toBeTruthy();
        expect(screen.getByTestId('card-brand-visa')).toBeTruthy();
        expect(screen.getByTestId('card-brand-mastercard')).toBeTruthy();
      });
    });

    it('should show loading state initially', () => {
      render(<TransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    });

    it('should display empty state when no transactions', async () => {
      const apiService = require('../../src/services/apiService');
      apiService.get.mockResolvedValueOnce({
        data: {
          transactions: [],
          summary: {
            totalTransactions: 0,
            totalSpent: 0,
            averageTransactionAmount: 0,
          },
          pagination: {
            page: 1,
            totalPages: 0,
            hasMore: false,
          },
        },
      });

      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeTruthy();
        expect(screen.getByText('Your transaction history will appear here')).toBeTruthy();
      });
    });
  });

  describe('Transaction Summary', () => {
    it('should display transaction summary statistics', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('2 transactions')).toBeTruthy();
        expect(screen.getByText('$32.50 total spent')).toBeTruthy();
        expect(screen.getByText('$16.25 average')).toBeTruthy();
      });
    });

    it('should toggle summary visibility', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const summaryToggle = screen.getByTestId('summary-toggle');
        expect(screen.getByText('2 transactions')).toBeTruthy();

        fireEvent.press(summaryToggle);
        expect(screen.queryByText('2 transactions')).toBeNull();

        fireEvent.press(summaryToggle);
        expect(screen.getByText('2 transactions')).toBeTruthy();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('should show filter options', () => {
      render(<TransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('filter-button')).toBeTruthy();
      expect(screen.getByTestId('sort-button')).toBeTruthy();
    });

    it('should open filter modal when filter button pressed', async () => {
      render(<TransactionHistory {...defaultProps} />);

      const filterButton = screen.getByTestId('filter-button');
      fireEvent.press(filterButton);

      await waitFor(() => {
        expect(screen.getByText('Filter Transactions')).toBeTruthy();
        expect(screen.getByText('Status')).toBeTruthy();
        expect(screen.getByText('Date Range')).toBeTruthy();
        expect(screen.getByText('Amount Range')).toBeTruthy();
      });
    });

    it('should filter by status', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const filterButton = screen.getByTestId('filter-button');
      fireEvent.press(filterButton);

      await waitFor(() => {
        const paidFilter = screen.getByText('Paid');
        fireEvent.press(paidFilter);

        const applyButton = screen.getByText('Apply Filters');
        fireEvent.press(applyButton);
      });

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('status=paid'),
          expect.any(Object)
        );
      });
    });

    it('should filter by date range', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const filterButton = screen.getByTestId('filter-button');
      fireEvent.press(filterButton);

      await waitFor(() => {
        const startDatePicker = screen.getByTestId('start-date-picker');
        fireEvent.press(startDatePicker);

        const endDatePicker = screen.getByTestId('end-date-picker');
        fireEvent.press(endDatePicker);

        const applyButton = screen.getByText('Apply Filters');
        fireEvent.press(applyButton);
      });

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('startDate='),
          expect.any(Object)
        );
      });
    });

    it('should sort transactions', async () => {
      render(<TransactionHistory {...defaultProps} />);

      const sortButton = screen.getByTestId('sort-button');
      fireEvent.press(sortButton);

      await waitFor(() => {
        expect(screen.getByText('Sort By')).toBeTruthy();
        expect(screen.getByText('Date (Newest First)')).toBeTruthy();
        expect(screen.getByText('Date (Oldest First)')).toBeTruthy();
        expect(screen.getByText('Amount (Highest First)')).toBeTruthy();
        expect(screen.getByText('Amount (Lowest First)')).toBeTruthy();
      });
    });

    it('should clear all filters', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const filterButton = screen.getByTestId('filter-button');
      fireEvent.press(filterButton);

      await waitFor(() => {
        const clearButton = screen.getByText('Clear All');
        fireEvent.press(clearButton);
      });

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.not.stringContaining('status='),
          expect.any(Object)
        );
      });
    });
  });

  describe('Transaction Details', () => {
    it('should navigate to transaction details when pressed', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transaction = screen.getByTestId('transaction-txn_1');
        fireEvent.press(transaction);

        expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
          transactionId: 'txn_1',
          receiptNumber: 'RCP-2024-001',
        });
      });
    });

    it('should show transaction receipt number', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('RCP-2024-001')).toBeTruthy();
        expect(screen.getByText('RCP-2024-002')).toBeTruthy();
      });
    });

    it('should display refund information for refunded transactions', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const refundedTransaction = screen.getByTestId('transaction-txn_2');
        expect(refundedTransaction).toBeTruthy();
        
        // Should show refund date and amount
        expect(screen.getByText('Refunded Jan 11, 2024')).toBeTruthy();
        expect(screen.getByText('-$7.50')).toBeTruthy();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should show search input', () => {
      render(<TransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.getByPlaceholderText('Search transactions...')).toBeTruthy();
    });

    it('should search transactions by business name', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'Coffee');

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('search=Coffee'),
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });

    it('should search transactions by receipt number', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'RCP-2024-001');

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('search=RCP-2024-001'),
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });

    it('should clear search when input is empty', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'Coffee');
      fireEvent.changeText(searchInput, '');

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.not.stringContaining('search='),
          expect.any(Object)
        );
      });
    });
  });

  describe('Pagination', () => {
    it('should load more transactions when reaching the end', async () => {
      const apiService = require('../../src/services/apiService');
      
      // Mock paginated response
      apiService.get.mockResolvedValueOnce({
        data: {
          transactions: mockTransactionHistory,
          pagination: {
            page: 1,
            totalPages: 2,
            hasMore: true,
          },
        },
      });

      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transactionList = screen.getByTestId('transaction-list');
        fireEvent(transactionList, 'endReached');

        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        );
      });
    });

    it('should show loading indicator when loading more', async () => {
      const apiService = require('../../src/services/apiService');
      
      apiService.get.mockResolvedValueOnce({
        data: {
          transactions: mockTransactionHistory,
          pagination: {
            page: 1,
            totalPages: 2,
            hasMore: true,
          },
        },
      });

      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transactionList = screen.getByTestId('transaction-list');
        fireEvent(transactionList, 'endReached');

        expect(screen.getByTestId('load-more-indicator')).toBeTruthy();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('should refresh transaction list on pull down', async () => {
      const apiService = require('../../src/services/apiService');
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transactionList = screen.getByTestId('transaction-list');
        fireEvent(transactionList, 'refresh');

        expect(apiService.get).toHaveBeenCalledTimes(2); // Initial load + refresh
      });
    });

    it('should show refresh indicator while refreshing', async () => {
      render(<TransactionHistory {...defaultProps} />);

      const transactionList = screen.getByTestId('transaction-list');
      fireEvent(transactionList, 'refresh');

      expect(screen.getByTestId('refresh-indicator')).toBeTruthy();
    });
  });

  describe('Export Functionality', () => {
    it('should show export option', () => {
      render(<TransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('export-button')).toBeTruthy();
    });

    it('should show export options modal', async () => {
      render(<TransactionHistory {...defaultProps} />);

      const exportButton = screen.getByTestId('export-button');
      fireEvent.press(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Transactions')).toBeTruthy();
        expect(screen.getByText('PDF')).toBeTruthy();
        expect(screen.getByText('CSV')).toBeTruthy();
        expect(screen.getByText('Email Report')).toBeTruthy();
      });
    });

    it('should handle PDF export', async () => {
      const apiService = require('../../src/services/apiService');
      apiService.post = jest.fn().mockResolvedValue({
        data: { downloadUrl: 'https://example.com/export.pdf' },
      });

      render(<TransactionHistory {...defaultProps} />);

      const exportButton = screen.getByTestId('export-button');
      fireEvent.press(exportButton);

      await waitFor(() => {
        const pdfOption = screen.getByText('PDF');
        fireEvent.press(pdfOption);

        expect(apiService.post).toHaveBeenCalledWith(
          expect.stringContaining('/transactions/export'),
          expect.objectContaining({ format: 'pdf' })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when API call fails', async () => {
      const apiService = require('../../src/services/apiService');
      apiService.get.mockRejectedValueOnce(new Error('Network error'));

      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load transactions')).toBeTruthy();
        expect(screen.getByText('Network error')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should retry loading when retry button pressed', async () => {
      const apiService = require('../../src/services/apiService');
      apiService.get.mockRejectedValueOnce(new Error('Network error'));
      apiService.get.mockResolvedValueOnce({
        data: {
          transactions: mockTransactionHistory,
          summary: { totalTransactions: 2, totalSpent: 3250, averageTransactionAmount: 1625 },
          pagination: { page: 1, totalPages: 1, hasMore: false },
        },
      });

      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.press(retryButton);

        expect(screen.getByText('Test Restaurant')).toBeTruthy();
      });
    });

    it('should handle empty customer ID gracefully', async () => {
      const propsWithoutCustomer = {
        customerId: '',
      };

      render(<TransactionHistory {...propsWithoutCustomer} />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load transaction history')).toBeTruthy();
        expect(screen.getByText('Customer information is missing')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transaction = screen.getByTestId('transaction-txn_1');
        expect(transaction.props.accessibilityLabel).toBe(
          'Transaction at Test Restaurant for $25.00 on Jan 15, 2024, Status: Paid'
        );

        const searchInput = screen.getByTestId('search-input');
        expect(searchInput.props.accessibilityLabel).toBe('Search transactions');
      });
    });

    it('should support screen readers', async () => {
      render(<TransactionHistory {...defaultProps} />);

      await waitFor(() => {
        const transaction = screen.getByTestId('transaction-txn_1');
        expect(transaction.props.accessibilityRole).toBe('button');
        expect(transaction.props.accessible).toBe(true);
      });
    });

    it('should have proper focus order', () => {
      render(<TransactionHistory {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      const filterButton = screen.getByTestId('filter-button');
      const sortButton = screen.getByTestId('sort-button');

      expect(searchInput.props.accessibilityElementsHidden).toBe(false);
      expect(filterButton.props.accessibilityElementsHidden).toBe(false);
      expect(sortButton.props.accessibilityElementsHidden).toBe(false);
    });
  });
});