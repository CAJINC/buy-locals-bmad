import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ReceiptService, ReceiptData, ReceiptGenerationOptions, EmailReceiptOptions } from '../../src/services/receiptService.js';
import PaymentTestData from '../utils/paymentTestData.js';
import { readFileSync } from 'fs';

// Mock external dependencies
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    end: jest.fn(),
    pipe: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 10);
      }
    }),
  }));
});

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id-123',
      accepted: ['test@example.com'],
      rejected: [],
      response: '250 Message queued',
    }),
  })),
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('ReceiptService', () => {
  let receiptService: ReceiptService;
  let mockReadFileSync: jest.MockedFunction<typeof readFileSync>;

  beforeEach(() => {
    receiptService = new ReceiptService();
    mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
    
    // Mock template file reading
    mockReadFileSync.mockReturnValue(Buffer.from(`
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Receipt</h1>
          <p>Amount: {{amount}}</p>
          <p>Business: {{businessName}}</p>
        </body>
      </html>
    `));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateReceipt', () => {
    it('should generate PDF receipt successfully', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'pdf',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.receiptId).toBe(receiptData.id);
      expect(result.receiptNumber).toBe(receiptData.receiptNumber);
      expect(result.format).toBe('pdf');
      expect(result.content).toBeDefined();
      expect(result.downloadUrl).toBeDefined();
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should generate HTML receipt successfully', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(result.content).toContain('<html>');
      expect(result.content).toContain(receiptData.business.name);
      expect(result.content).toContain('$100.00'); // Formatted amount
    });

    it('should generate text receipt successfully', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'text',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('text');
      expect(result.content).toContain(receiptData.business.name);
      expect(result.content).toContain(receiptData.receiptNumber);
      expect(typeof result.content).toBe('string');
    });

    it('should include QR code when requested', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('data:image/png;base64'); // QR code data URL
    });

    it('should include tax breakdown when requested', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData({
        taxAmount: 875, // $8.75
        taxRate: 0.0875, // 8.75%
      });
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: true,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('8.75%'); // Tax rate
      expect(result.content).toContain('$8.75'); // Tax amount
    });

    it('should handle refunded receipts', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData({
        status: 'refunded',
        refundedAt: new Date(),
        refundAmount: 5000, // $50.00 refunded
      });
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: true,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('REFUNDED');
      expect(result.content).toContain('$50.00'); // Refund amount
    });

    it('should support multiple languages', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();

      // Test Spanish
      const spanishOptions: ReceiptGenerationOptions = {
        format: 'html',
        language: 'es',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const spanishResult = await receiptService.generateReceipt(receiptData, spanishOptions);
      expect(spanishResult.success).toBe(true);
      // Content should be localized to Spanish
      expect(spanishResult.content).toContain('Recibo'); // Receipt in Spanish

      // Test French
      const frenchOptions: ReceiptGenerationOptions = {
        format: 'html',
        language: 'fr',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const frenchResult = await receiptService.generateReceipt(receiptData, frenchOptions);
      expect(frenchResult.success).toBe(true);
      // Content should be localized to French
      expect(frenchResult.content).toContain('Reçu'); // Receipt in French
    });

    it('should apply business branding when provided', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
        branding: {
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          fontFamily: 'Arial, sans-serif',
          customMessage: 'Thank you for your business!',
        },
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('#007bff'); // Primary color
      expect(result.content).toContain('Arial, sans-serif'); // Font family
      expect(result.content).toContain('Thank you for your business!'); // Custom message
    });
  });

  describe('emailReceipt', () => {
    it('should send email receipt successfully', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: EmailReceiptOptions = {
        to: 'customer@example.com',
        attachPdf: true,
        language: 'en',
        customMessage: 'Thank you for your purchase!',
      };

      const result = await receiptService.emailReceipt(receiptData, options);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id-123');
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it('should include PDF attachment when requested', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: EmailReceiptOptions = {
        to: 'customer@example.com',
        attachPdf: true,
        language: 'en',
      };

      const mockTransport = require('nodemailer').createTransport();
      await receiptService.emailReceipt(receiptData, options);

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: expect.stringContaining('.pdf'),
              content: expect.any(Buffer),
            }),
          ]),
        })
      );
    });

    it('should send HTML-only email when PDF not requested', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: EmailReceiptOptions = {
        to: 'customer@example.com',
        attachPdf: false,
        language: 'en',
      };

      const mockTransport = require('nodemailer').createTransport();
      await receiptService.emailReceipt(receiptData, options);

      const sendMailCall = mockTransport.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toBeDefined();
      expect(sendMailCall.attachments).toBeUndefined();
    });

    it('should handle CC and BCC recipients', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: EmailReceiptOptions = {
        to: 'customer@example.com',
        cc: ['manager@business.com'],
        bcc: ['accounting@business.com'],
        attachPdf: false,
        language: 'en',
      };

      const mockTransport = require('nodemailer').createTransport();
      await receiptService.emailReceipt(receiptData, options);

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['manager@business.com'],
          bcc: ['accounting@business.com'],
        })
      );
    });

    it('should handle email sending failures', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: EmailReceiptOptions = {
        to: 'invalid-email@nonexistent-domain.com',
        attachPdf: false,
        language: 'en',
      };

      const mockTransport = require('nodemailer').createTransport();
      mockTransport.sendMail.mockRejectedValueOnce(new Error('Email delivery failed'));

      const result = await receiptService.emailReceipt(receiptData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email delivery failed');
    });
  });

  describe('getTransactionHistory', () => {
    it('should retrieve transaction history successfully', async () => {
      const customerId = 'cus_test_customer';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const history = await receiptService.getTransactionHistory(customerId, startDate, endDate);

      expect(history).toBeDefined();
      expect(history.customerId).toBe(customerId);
      expect(history.transactions).toBeInstanceOf(Array);
      expect(history.summary).toBeDefined();
      expect(history.summary.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(history.summary.totalSpent).toBeGreaterThanOrEqual(0);
    });

    it('should filter transactions by date range', async () => {
      const customerId = 'cus_test_customer';
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-20');

      const history = await receiptService.getTransactionHistory(customerId, startDate, endDate);

      history.transactions.forEach(transaction => {
        const transactionDate = new Date(transaction.createdAt);
        expect(transactionDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(transactionDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should include refund information in history', async () => {
      const customerId = 'cus_test_customer_with_refunds';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const history = await receiptService.getTransactionHistory(customerId, startDate, endDate);

      const refundedTransactions = history.transactions.filter(t => t.status === 'refunded');
      expect(refundedTransactions.length).toBeGreaterThanOrEqual(0);
      
      refundedTransactions.forEach(transaction => {
        expect(transaction.refundedAt).toBeDefined();
        expect(transaction.refundAmount).toBeGreaterThan(0);
      });
    });

    it('should paginate large transaction histories', async () => {
      const customerId = 'cus_customer_with_many_transactions';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const page1 = await receiptService.getTransactionHistory(customerId, startDate, endDate, 1, 10);
      const page2 = await receiptService.getTransactionHistory(customerId, startDate, endDate, 2, 10);

      expect(page1.transactions).toHaveLength(10);
      expect(page2.transactions).toHaveLength(10);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.totalPages).toBeGreaterThan(1);
      
      // Ensure pages contain different transactions
      const page1Ids = page1.transactions.map(t => t.id);
      const page2Ids = page2.transactions.map(t => t.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });
  });

  describe('downloadReceipt', () => {
    it('should generate download URL for receipt', async () => {
      const receiptId = 'receipt-test-123';
      const format = 'pdf';

      const downloadUrl = await receiptService.downloadReceipt(receiptId, format);

      expect(downloadUrl).toBeDefined();
      expect(downloadUrl).toContain(receiptId);
      expect(downloadUrl).toContain(format);
      expect(downloadUrl).toMatch(/^https?:\/\//); // Should be a valid URL
    });

    it('should handle different formats for download', async () => {
      const receiptId = 'receipt-test-123';
      
      const pdfUrl = await receiptService.downloadReceipt(receiptId, 'pdf');
      const htmlUrl = await receiptService.downloadReceipt(receiptId, 'html');
      
      expect(pdfUrl).toContain('pdf');
      expect(htmlUrl).toContain('html');
      expect(pdfUrl).not.toBe(htmlUrl);
    });

    it('should generate secure, time-limited URLs', async () => {
      const receiptId = 'receipt-test-123';
      const format = 'pdf';

      const url1 = await receiptService.downloadReceipt(receiptId, format);
      
      // Wait a moment and generate another URL
      await new Promise(resolve => setTimeout(resolve, 10));
      const url2 = await receiptService.downloadReceipt(receiptId, format);

      // URLs should be different (contain different tokens/timestamps)
      expect(url1).not.toBe(url2);
    });

    it('should validate receipt exists before generating download URL', async () => {
      const nonExistentReceiptId = 'receipt-nonexistent-999';
      const format = 'pdf';

      await expect(receiptService.downloadReceipt(nonExistentReceiptId, format))
        .rejects
        .toThrow('Receipt not found');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', async () => {
      const formatted = receiptService.formatCurrency(10000, 'USD'); // $100.00
      expect(formatted).toBe('$100.00');
    });

    it('should format different currencies correctly', async () => {
      expect(receiptService.formatCurrency(10000, 'CAD')).toBe('CA$100.00');
      expect(receiptService.formatCurrency(10000, 'EUR')).toBe('€100.00');
      expect(receiptService.formatCurrency(10000, 'GBP')).toBe('£100.00');
    });

    it('should handle zero amounts', async () => {
      const formatted = receiptService.formatCurrency(0, 'USD');
      expect(formatted).toBe('$0.00');
    });

    it('should handle large amounts', async () => {
      const formatted = receiptService.formatCurrency(1234567890, 'USD'); // $12,345,678.90
      expect(formatted).toBe('$12,345,678.90');
    });
  });

  describe('Error Handling', () => {
    it('should handle PDF generation errors', async () => {
      const PDFKit = require('pdfkit');
      PDFKit.mockImplementationOnce(() => {
        throw new Error('PDF generation failed');
      });

      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'pdf',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation failed');
    });

    it('should handle QR code generation errors', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL.mockRejectedValueOnce(new Error('QR code generation failed'));

      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      // Should still succeed but without QR code
      expect(result.success).toBe(true);
      expect(result.content).not.toContain('data:image/png;base64');
    });

    it('should handle missing template files gracefully', async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('Template file not found');
      });

      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(receiptData, options);

      // Should fall back to basic template
      expect(result.success).toBe(true);
      expect(result.content).toContain(receiptData.business.name);
    });

    it('should validate receipt data completeness', async () => {
      const incompleteReceiptData = {
        id: 'receipt-123',
        receiptNumber: 'RCP-123',
        // Missing required fields
      } as ReceiptData;

      const options: ReceiptGenerationOptions = {
        format: 'pdf',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      const result = await receiptService.generateReceipt(incompleteReceiptData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid receipt data');
    });
  });

  describe('Performance', () => {
    it('should generate receipts within acceptable time limits', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'pdf',
        language: 'en',
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: false,
      };

      const start = Date.now();
      await receiptService.generateReceipt(receiptData, options);
      const end = Date.now();

      // Should complete within 3 seconds
      expect(end - start).toBeLessThan(3000);
    });

    it('should handle concurrent receipt generation', async () => {
      const receiptData: ReceiptData = PaymentTestData.createReceiptData();
      const options: ReceiptGenerationOptions = {
        format: 'html',
        language: 'en',
        includeQrCode: false,
        includeTaxBreakdown: false,
        includeRefundInfo: false,
      };

      // Generate 5 receipts concurrently
      const promises = Array.from({ length: 5 }, () =>
        receiptService.generateReceipt(receiptData, options)
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
      });
    });
  });
});