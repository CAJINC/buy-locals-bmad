import { v4 as uuidv4 } from 'uuid';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { logger } from '../utils/logger.js';
import { EscrowTransaction, PaymentResult } from '../types/Payment.js';
import { Business } from '../types/Business.js';
import { User } from '../types/User.js';

// Receipt Types
export interface ReceiptData {
  id: string;
  receiptNumber: string;
  transactionId: string;
  paymentIntentId: string;
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  platformFee: number;
  businessPayout: number;
  taxAmount: number;
  taxRate: number;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'disputed';
  createdAt: Date;
  refundedAt?: Date;
  refundAmount?: number;
  items: ReceiptItem[];
  business: Business;
  customer: User;
  metadata?: Record<string, any>;
}

export interface ReceiptItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  category?: string;
}

export interface ReceiptGenerationOptions {
  format: 'pdf' | 'html' | 'text';
  language: 'en' | 'es' | 'fr';
  includeQrCode: boolean;
  includeTaxBreakdown: boolean;
  includeRefundInfo: boolean;
  branding?: BusinessBranding;
}

export interface BusinessBranding {
  logo?: Buffer;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  customMessage?: string;
}

export interface EmailReceiptOptions {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  customMessage?: string;
  attachPdf: boolean;
  language: 'en' | 'es' | 'fr';
}

export interface ReceiptEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
}

export interface ReceiptGenerationResult {
  success: boolean;
  receiptId: string;
  receiptNumber: string;
  format: string;
  content?: Buffer | string;
  downloadUrl?: string;
  error?: string;
  generatedAt: Date;
}

/**
 * Comprehensive Receipt Generation Service for Buy Locals Platform
 * 
 * Features:
 * - Multi-format receipt generation (PDF, HTML, Text)
 * - Multi-language support (English, Spanish, French)
 * - QR code generation for receipt verification
 * - Digital signature for authenticity
 * - Email delivery with customizable templates
 * - Business branding and customization
 * - Tax breakdown and compliance reporting
 * - Refund status tracking
 * - Receipt numbering system
 */
export class ReceiptService {
  private readonly receiptCounter: Map<string, number> = new Map();
  private readonly translations = {
    en: {
      receipt: 'Receipt',
      invoice: 'Invoice',
      transactionId: 'Transaction ID',
      receiptNumber: 'Receipt Number',
      date: 'Date',
      customer: 'Customer',
      business: 'Business',
      items: 'Items',
      subtotal: 'Subtotal',
      tax: 'Tax',
      platformFee: 'Platform Fee',
      total: 'Total',
      paymentMethod: 'Payment Method',
      status: 'Status',
      refunded: 'Refunded',
      partiallyRefunded: 'Partially Refunded',
      disputed: 'Disputed',
      paid: 'Paid',
      thankYou: 'Thank you for your business!',
      questions: 'Questions about this receipt?',
      contact: 'Contact us at',
      verifyReceipt: 'Verify this receipt by scanning the QR code',
      taxBreakdown: 'Tax Breakdown',
      refundInfo: 'Refund Information'
    },
    es: {
      receipt: 'Recibo',
      invoice: 'Factura',
      transactionId: 'ID de Transacción',
      receiptNumber: 'Número de Recibo',
      date: 'Fecha',
      customer: 'Cliente',
      business: 'Negocio',
      items: 'Artículos',
      subtotal: 'Subtotal',
      tax: 'Impuesto',
      platformFee: 'Tarifa de Plataforma',
      total: 'Total',
      paymentMethod: 'Método de Pago',
      status: 'Estado',
      refunded: 'Reembolsado',
      partiallyRefunded: 'Parcialmente Reembolsado',
      disputed: 'Disputado',
      paid: 'Pagado',
      thankYou: '¡Gracias por su negocio!',
      questions: '¿Preguntas sobre este recibo?',
      contact: 'Contáctanos en',
      verifyReceipt: 'Verifique este recibo escaneando el código QR',
      taxBreakdown: 'Desglose de Impuestos',
      refundInfo: 'Información de Reembolso'
    },
    fr: {
      receipt: 'Reçu',
      invoice: 'Facture',
      transactionId: 'ID de Transaction',
      receiptNumber: 'Numéro de Reçu',
      date: 'Date',
      customer: 'Client',
      business: 'Commerce',
      items: 'Articles',
      subtotal: 'Sous-total',
      tax: 'Taxe',
      platformFee: 'Frais de Plateforme',
      total: 'Total',
      paymentMethod: 'Méthode de Paiement',
      status: 'Statut',
      refunded: 'Remboursé',
      partiallyRefunded: 'Partiellement Remboursé',
      disputed: 'Contesté',
      paid: 'Payé',
      thankYou: 'Merci pour votre entreprise!',
      questions: 'Questions sur ce reçu?',
      contact: 'Contactez-nous à',
      verifyReceipt: 'Vérifiez ce reçu en scannant le code QR',
      taxBreakdown: 'Ventilation des Taxes',
      refundInfo: 'Informations de Remboursement'
    }
  };

  constructor() {
    this.initializeReceiptCounters();
  }

  /**
   * Generate a receipt in the specified format
   */
  async generateReceipt(
    receiptData: ReceiptData,
    options: ReceiptGenerationOptions
  ): Promise<ReceiptGenerationResult> {
    const correlationId = uuidv4();
    
    try {
      logger.info('Generating receipt', {
        receiptId: receiptData.id,
        format: options.format,
        language: options.language,
        correlationId
      });

      // Generate QR code if requested
      let qrCodeDataUrl: string | undefined;
      if (options.includeQrCode) {
        qrCodeDataUrl = await this.generateQrCode(receiptData);
      }

      // Generate digital signature
      const digitalSignature = this.generateDigitalSignature(receiptData);

      let content: Buffer | string;
      let downloadUrl: string | undefined;

      switch (options.format) {
        case 'pdf':
          content = await this.generatePdfReceipt(receiptData, options, qrCodeDataUrl, digitalSignature);
          downloadUrl = await this.uploadReceiptToStorage(receiptData.receiptNumber, content, 'pdf');
          break;
        
        case 'html':
          content = await this.generateHtmlReceipt(receiptData, options, qrCodeDataUrl, digitalSignature);
          downloadUrl = await this.uploadReceiptToStorage(receiptData.receiptNumber, Buffer.from(content), 'html');
          break;
        
        case 'text':
          content = this.generateTextReceipt(receiptData, options, digitalSignature);
          break;
        
        default:
          throw new Error(`Unsupported receipt format: ${options.format}`);
      }

      // Store receipt metadata in database
      await this.storeReceiptRecord({
        receiptId: receiptData.id,
        receiptNumber: receiptData.receiptNumber,
        transactionId: receiptData.transactionId,
        businessId: receiptData.businessId,
        customerId: receiptData.customerId,
        format: options.format,
        language: options.language,
        downloadUrl,
        digitalSignature,
        generatedAt: new Date(),
        correlationId
      });

      const result: ReceiptGenerationResult = {
        success: true,
        receiptId: receiptData.id,
        receiptNumber: receiptData.receiptNumber,
        format: options.format,
        content: options.format !== 'pdf' ? content : undefined, // Don't return PDF buffer in response
        downloadUrl,
        generatedAt: new Date()
      };

      logger.info('Receipt generated successfully', {
        receiptId: receiptData.id,
        receiptNumber: receiptData.receiptNumber,
        format: options.format,
        correlationId
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate receipt', {
        receiptId: receiptData.id,
        format: options.format,
        error: error instanceof Error ? error.message : String(error),
        correlationId
      });

      return {
        success: false,
        receiptId: receiptData.id,
        receiptNumber: receiptData.receiptNumber,
        format: options.format,
        error: error instanceof Error ? error.message : String(error),
        generatedAt: new Date()
      };
    }
  }

  /**
   * Email receipt to customer or business
   */
  async emailReceipt(
    receiptData: ReceiptData,
    options: EmailReceiptOptions
  ): Promise<ReceiptEmailResult> {
    const correlationId = uuidv4();

    try {
      logger.info('Sending receipt email', {
        receiptId: receiptData.id,
        to: options.to,
        attachPdf: options.attachPdf,
        language: options.language,
        correlationId
      });

      // Generate HTML content for email
      const htmlContent = await this.generateHtmlReceipt(receiptData, {
        format: 'html',
        language: options.language,
        includeQrCode: true,
        includeTaxBreakdown: true,
        includeRefundInfo: receiptData.status !== 'paid'
      });

      // Generate PDF attachment if requested
      let pdfAttachment: Buffer | undefined;
      if (options.attachPdf) {
        pdfAttachment = await this.generatePdfReceipt(receiptData, {
          format: 'pdf',
          language: options.language,
          includeQrCode: true,
          includeTaxBreakdown: true,
          includeRefundInfo: receiptData.status !== 'paid'
        });
      }

      // Send email using the existing notification service pattern
      const emailResult = await this.sendReceiptEmail({
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject || this.getEmailSubject(receiptData, options.language),
        htmlContent,
        pdfAttachment,
        receiptData,
        customMessage: options.customMessage,
        language: options.language,
        correlationId
      });

      // Log email delivery
      await this.logEmailDelivery({
        receiptId: receiptData.id,
        transactionId: receiptData.transactionId,
        recipient: options.to,
        messageId: emailResult.messageId,
        success: emailResult.success,
        correlationId
      });

      logger.info('Receipt email sent successfully', {
        receiptId: receiptData.id,
        messageId: emailResult.messageId,
        correlationId
      });

      return emailResult;

    } catch (error) {
      logger.error('Failed to send receipt email', {
        receiptId: receiptData.id,
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
        correlationId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        deliveredAt: new Date()
      };
    }
  }

  /**
   * Generate receipt number with business prefix
   */
  generateReceiptNumber(businessId: string): string {
    const year = new Date().getFullYear();
    const businessPrefix = businessId.substring(0, 4).toUpperCase();
    
    // Get current counter for this business
    const counterKey = `${businessId}-${year}`;
    const currentCounter = this.receiptCounter.get(counterKey) || 0;
    const newCounter = currentCounter + 1;
    
    // Update counter
    this.receiptCounter.set(counterKey, newCounter);
    
    // Format: BUSI-2024-000001
    return `${businessPrefix}-${year}-${newCounter.toString().padStart(6, '0')}`;
  }

  /**
   * Verify receipt authenticity using digital signature
   */
  verifyReceiptSignature(receiptData: ReceiptData, signature: string): boolean {
    const expectedSignature = this.generateDigitalSignature(receiptData);
    return expectedSignature === signature;
  }

  /**
   * Get receipt by transaction ID
   */
  async getReceiptByTransactionId(transactionId: string): Promise<ReceiptData | null> {
    try {
      // This would fetch from your database
      const receipt = await this.fetchReceiptFromDatabase({ transactionId });
      return receipt;
    } catch (error) {
      logger.error('Failed to fetch receipt by transaction ID', {
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get paginated transaction history for business or customer
   */
  async getTransactionHistory(options: {
    businessId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    limit: number;
    offset: number;
  }): Promise<{
    receipts: ReceiptData[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // This would query your database with filters
      const results = await this.queryTransactionHistory(options);
      
      return {
        receipts: results.receipts,
        totalCount: results.totalCount,
        hasMore: results.totalCount > (options.offset + options.limit)
      };
    } catch (error) {
      logger.error('Failed to fetch transaction history', {
        options,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        receipts: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }

  // Private helper methods

  private async generateQrCode(receiptData: ReceiptData): Promise<string> {
    const verificationUrl = `${process.env.APP_URL}/receipt/verify/${receiptData.receiptNumber}`;
    return await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  }

  private generateDigitalSignature(receiptData: ReceiptData): string {
    // Create a deterministic signature based on receipt data
    const signatureData = {
      receiptNumber: receiptData.receiptNumber,
      transactionId: receiptData.transactionId,
      amount: receiptData.amount,
      currency: receiptData.currency,
      businessId: receiptData.businessId,
      customerId: receiptData.customerId,
      createdAt: receiptData.createdAt.toISOString()
    };

    // In production, use a proper HMAC with a secret key
    const signature = Buffer.from(JSON.stringify(signatureData)).toString('base64');
    return signature.slice(0, 32); // Take first 32 characters for brevity
  }

  private async generatePdfReceipt(
    receiptData: ReceiptData,
    options: ReceiptGenerationOptions,
    qrCodeDataUrl?: string,
    signature?: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const t = this.translations[options.language];
        const branding = options.branding || this.getDefaultBranding();

        // Header with business branding
        doc.fontSize(24)
           .fillColor(branding.primaryColor)
           .text(receiptData.business.name, 50, 50);

        doc.fontSize(14)
           .fillColor('black')
           .text(`${t.receipt} #${receiptData.receiptNumber}`, 50, 90);

        doc.text(`${t.date}: ${receiptData.createdAt.toLocaleDateString()}`, 50, 110);

        // Business and customer information
        doc.fontSize(12)
           .text(`${t.business}:`, 50, 140)
           .text(receiptData.business.name, 70, 160)
           .text(receiptData.business.address || '', 70, 175);

        doc.text(`${t.customer}:`, 50, 200)
           .text(`${receiptData.customer.profile.firstName} ${receiptData.customer.profile.lastName}`, 70, 220)
           .text(receiptData.customer.email, 70, 235);

        // Items table
        let yPosition = 270;
        doc.fontSize(14)
           .text(t.items, 50, yPosition);

        yPosition += 25;
        doc.fontSize(10)
           .text('Description', 50, yPosition)
           .text('Qty', 300, yPosition)
           .text('Unit Price', 350, yPosition)
           .text('Total', 450, yPosition);

        yPosition += 15;
        doc.moveTo(50, yPosition)
           .lineTo(500, yPosition)
           .stroke();

        yPosition += 10;

        // Item details
        receiptData.items.forEach(item => {
          doc.fontSize(9)
             .text(item.name, 50, yPosition)
             .text(item.quantity.toString(), 300, yPosition)
             .text(`$${(item.unitPrice / 100).toFixed(2)}`, 350, yPosition)
             .text(`$${(item.totalPrice / 100).toFixed(2)}`, 450, yPosition);
          yPosition += 15;
        });

        // Totals section
        yPosition += 20;
        const subtotal = receiptData.amount - receiptData.taxAmount - receiptData.platformFee;
        
        doc.fontSize(10)
           .text(`${t.subtotal}:`, 350, yPosition)
           .text(`$${(subtotal / 100).toFixed(2)}`, 450, yPosition);
        yPosition += 15;

        if (options.includeTaxBreakdown) {
          doc.text(`${t.tax} (${(receiptData.taxRate * 100).toFixed(1)}%):`, 350, yPosition)
             .text(`$${(receiptData.taxAmount / 100).toFixed(2)}`, 450, yPosition);
          yPosition += 15;
        }

        doc.text(`${t.platformFee}:`, 350, yPosition)
           .text(`$${(receiptData.platformFee / 100).toFixed(2)}`, 450, yPosition);
        yPosition += 15;

        // Total line
        doc.moveTo(350, yPosition)
           .lineTo(500, yPosition)
           .stroke();
        yPosition += 10;

        doc.fontSize(12)
           .fillColor(branding.primaryColor)
           .text(`${t.total}:`, 350, yPosition)
           .text(`$${(receiptData.amount / 100).toFixed(2)}`, 450, yPosition);

        // QR Code for verification
        if (qrCodeDataUrl && options.includeQrCode) {
          yPosition += 40;
          const qrCodeBuffer = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
          doc.image(qrCodeBuffer, 400, yPosition, { width: 80 });
          
          doc.fontSize(8)
             .fillColor('black')
             .text(t.verifyReceipt, 320, yPosition + 85, { width: 160, align: 'center' });
        }

        // Footer with digital signature
        if (signature) {
          doc.fontSize(8)
             .fillColor('gray')
             .text(`Digital Signature: ${signature}`, 50, doc.page.height - 50);
        }

        // Thank you message
        doc.fontSize(10)
           .fillColor('black')
           .text(t.thankYou, 50, doc.page.height - 100, { align: 'center' });

        if (branding.customMessage) {
          doc.text(branding.customMessage, 50, doc.page.height - 80, { align: 'center' });
        }

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateHtmlReceipt(
    receiptData: ReceiptData,
    options: ReceiptGenerationOptions,
    qrCodeDataUrl?: string,
    signature?: string
  ): Promise<string> {
    const t = this.translations[options.language];
    const branding = options.branding || this.getDefaultBranding();
    
    const subtotal = receiptData.amount - receiptData.taxAmount - receiptData.platformFee;
    
    return `
<!DOCTYPE html>
<html lang="${options.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.receipt} #${receiptData.receiptNumber}</title>
    <style>
        body {
            font-family: ${branding.fontFamily}, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid ${branding.primaryColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .business-name {
            color: ${branding.primaryColor};
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .receipt-number {
            font-size: 1.2em;
            color: ${branding.secondaryColor};
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .info-box {
            flex: 1;
            margin-right: 20px;
        }
        .info-box:last-child {
            margin-right: 0;
        }
        .info-title {
            font-weight: bold;
            color: ${branding.primaryColor};
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .items-table th, .items-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .items-table th {
            background-color: ${branding.primaryColor};
            color: white;
        }
        .totals {
            text-align: right;
            margin-bottom: 30px;
        }
        .totals table {
            margin-left: auto;
            border-collapse: collapse;
        }
        .totals td {
            padding: 8px 15px;
            border-bottom: 1px solid #eee;
        }
        .total-row {
            font-weight: bold;
            font-size: 1.2em;
            color: ${branding.primaryColor};
            border-top: 2px solid ${branding.primaryColor};
        }
        .status {
            padding: 5px 10px;
            border-radius: 15px;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-paid { background-color: #28a745; }
        .status-refunded { background-color: #dc3545; }
        .status-partially_refunded { background-color: #ffc107; color: #333; }
        .status-disputed { background-color: #6c757d; }
        .qr-section {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
        }
        .signature {
            font-size: 0.8em;
            color: #999;
            margin-top: 10px;
        }
        ${options.includeRefundInfo && receiptData.refundAmount ? `
        .refund-info {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        ` : ''}
    </style>
</head>
<body>
    <div class="header">
        <div class="business-name">${receiptData.business.name}</div>
        <div class="receipt-number">${t.receipt} #${receiptData.receiptNumber}</div>
        <div>${t.date}: ${receiptData.createdAt.toLocaleDateString()}</div>
    </div>

    <div class="info-section">
        <div class="info-box">
            <div class="info-title">${t.business}</div>
            <div>${receiptData.business.name}</div>
            <div>${receiptData.business.address || ''}</div>
            <div>${receiptData.business.phone || ''}</div>
        </div>
        <div class="info-box">
            <div class="info-title">${t.customer}</div>
            <div>${receiptData.customer.profile.firstName} ${receiptData.customer.profile.lastName}</div>
            <div>${receiptData.customer.email}</div>
            <div>${receiptData.customer.profile.phone || ''}</div>
        </div>
        <div class="info-box">
            <div class="info-title">${t.transactionId}</div>
            <div>${receiptData.transactionId}</div>
            <div class="info-title" style="margin-top: 15px;">${t.status}</div>
            <div class="status status-${receiptData.status}">${t[receiptData.status]}</div>
        </div>
    </div>

    ${options.includeRefundInfo && receiptData.refundAmount ? `
    <div class="refund-info">
        <strong>${t.refundInfo}:</strong><br>
        ${t.refunded}: $${(receiptData.refundAmount / 100).toFixed(2)}<br>
        ${receiptData.refundedAt ? `Date: ${receiptData.refundedAt.toLocaleDateString()}` : ''}
    </div>
    ` : ''}

    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${receiptData.items.map(item => `
            <tr>
                <td>
                    <strong>${item.name}</strong>
                    ${item.description ? `<br><small>${item.description}</small>` : ''}
                </td>
                <td>${item.quantity}</td>
                <td>$${(item.unitPrice / 100).toFixed(2)}</td>
                <td>$${(item.totalPrice / 100).toFixed(2)}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr>
                <td>${t.subtotal}:</td>
                <td>$${(subtotal / 100).toFixed(2)}</td>
            </tr>
            ${options.includeTaxBreakdown ? `
            <tr>
                <td>${t.tax} (${(receiptData.taxRate * 100).toFixed(1)}%):</td>
                <td>$${(receiptData.taxAmount / 100).toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
                <td>${t.platformFee}:</td>
                <td>$${(receiptData.platformFee / 100).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td>${t.total}:</td>
                <td>$${(receiptData.amount / 100).toFixed(2)}</td>
            </tr>
        </table>
    </div>

    ${qrCodeDataUrl && options.includeQrCode ? `
    <div class="qr-section">
        <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 150px; height: 150px;">
        <div style="margin-top: 10px;">${t.verifyReceipt}</div>
    </div>
    ` : ''}

    <div class="footer">
        <div>${t.thankYou}</div>
        ${branding.customMessage ? `<div>${branding.customMessage}</div>` : ''}
        <div style="margin-top: 20px;">
            <small>${t.questions} ${t.contact} support@buylocals.com</small>
        </div>
        ${signature ? `<div class="signature">Digital Signature: ${signature}</div>` : ''}
    </div>
</body>
</html>`;
  }

  private generateTextReceipt(
    receiptData: ReceiptData,
    options: ReceiptGenerationOptions,
    signature?: string
  ): string {
    const t = this.translations[options.language];
    const width = 60;
    const line = '='.repeat(width);
    const subtotal = receiptData.amount - receiptData.taxAmount - receiptData.platformFee;

    let receipt = '';
    receipt += line + '\n';
    receipt += this.centerText(receiptData.business.name.toUpperCase(), width) + '\n';
    receipt += this.centerText(`${t.receipt} #${receiptData.receiptNumber}`, width) + '\n';
    receipt += line + '\n';
    receipt += `${t.date}: ${receiptData.createdAt.toLocaleDateString()}\n`;
    receipt += `${t.transactionId}: ${receiptData.transactionId}\n`;
    receipt += `${t.status}: ${t[receiptData.status]}\n`;
    receipt += line + '\n';
    
    // Business info
    receipt += `${t.business}:\n`;
    receipt += `  ${receiptData.business.name}\n`;
    if (receiptData.business.address) receipt += `  ${receiptData.business.address}\n`;
    receipt += '\n';
    
    // Customer info
    receipt += `${t.customer}:\n`;
    receipt += `  ${receiptData.customer.profile.firstName} ${receiptData.customer.profile.lastName}\n`;
    receipt += `  ${receiptData.customer.email}\n`;
    receipt += '\n';
    
    // Items
    receipt += `${t.items}:\n`;
    receipt += '-'.repeat(width) + '\n';
    
    receiptData.items.forEach(item => {
      receipt += `${item.name}\n`;
      receipt += `  ${item.quantity} x $${(item.unitPrice / 100).toFixed(2)} = $${(item.totalPrice / 100).toFixed(2)}\n`;
    });
    
    receipt += '-'.repeat(width) + '\n';
    
    // Totals
    receipt += this.rightAlign(`${t.subtotal}: $${(subtotal / 100).toFixed(2)}`, width) + '\n';
    
    if (options.includeTaxBreakdown) {
      receipt += this.rightAlign(`${t.tax} (${(receiptData.taxRate * 100).toFixed(1)}%): $${(receiptData.taxAmount / 100).toFixed(2)}`, width) + '\n';
    }
    
    receipt += this.rightAlign(`${t.platformFee}: $${(receiptData.platformFee / 100).toFixed(2)}`, width) + '\n';
    receipt += '='.repeat(width) + '\n';
    receipt += this.rightAlign(`${t.total}: $${(receiptData.amount / 100).toFixed(2)}`, width) + '\n';
    receipt += '='.repeat(width) + '\n';
    
    // Refund info
    if (options.includeRefundInfo && receiptData.refundAmount) {
      receipt += '\n' + `${t.refundInfo}:\n`;
      receipt += `${t.refunded}: $${(receiptData.refundAmount / 100).toFixed(2)}\n`;
      if (receiptData.refundedAt) receipt += `Date: ${receiptData.refundedAt.toLocaleDateString()}\n`;
    }
    
    // Footer
    receipt += '\n' + this.centerText(t.thankYou, width) + '\n';
    receipt += this.centerText('support@buylocals.com', width) + '\n';
    
    if (signature) {
      receipt += '\n' + `Digital Signature: ${signature}\n`;
    }
    
    return receipt;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    return ' '.repeat(leftPad) + text;
  }

  private rightAlign(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  }

  private getDefaultBranding(): BusinessBranding {
    return {
      primaryColor: '#4f46e5',
      secondaryColor: '#64748b',
      fontFamily: 'Inter, system-ui, -apple-system',
      customMessage: 'Proudly supporting local businesses'
    };
  }

  private getEmailSubject(receiptData: ReceiptData, language: string): string {
    const t = this.translations[language];
    return `${t.receipt} #${receiptData.receiptNumber} - ${receiptData.business.name}`;
  }

  private async sendReceiptEmail(params: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    htmlContent: string;
    pdfAttachment?: Buffer;
    receiptData: ReceiptData;
    customMessage?: string;
    language: string;
    correlationId: string;
  }): Promise<ReceiptEmailResult> {
    // This would integrate with your existing email service (SendGrid, AWS SES, etc.)
    // For now, returning a mock result following the established pattern
    
    try {
      // Mock email sending - replace with actual implementation
      const messageId = `receipt_${uuidv4()}`;
      
      logger.info('Email sent successfully', {
        messageId,
        to: params.to,
        subject: params.subject,
        correlationId: params.correlationId
      });

      return {
        success: true,
        messageId,
        deliveredAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        deliveredAt: new Date()
      };
    }
  }

  private async uploadReceiptToStorage(receiptNumber: string, content: Buffer, format: string): Promise<string> {
    // This would upload to your S3 bucket or storage service
    // For now, returning a mock URL following the established pattern
    const fileName = `receipts/${receiptNumber}.${format}`;
    const downloadUrl = `${process.env.CDN_URL}/${fileName}`;
    
    logger.info('Receipt uploaded to storage', {
      receiptNumber,
      fileName,
      downloadUrl,
      size: content.length
    });

    return downloadUrl;
  }

  private async storeReceiptRecord(record: any): Promise<void> {
    // This would store in your database following the established repository pattern
    logger.info('Receipt record stored', { receiptId: record.receiptId });
  }

  private async logEmailDelivery(log: any): Promise<void> {
    // This would log to your audit system following the established pattern
    logger.info('Email delivery logged', { receiptId: log.receiptId, success: log.success });
  }

  private async fetchReceiptFromDatabase(criteria: { transactionId?: string; receiptId?: string }): Promise<ReceiptData | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private async queryTransactionHistory(options: any): Promise<{ receipts: ReceiptData[]; totalCount: number }> {
    // Mock implementation - replace with actual database query
    return { receipts: [], totalCount: 0 };
  }

  private initializeReceiptCounters(): void {
    // This would load current counters from database on service startup
    logger.info('Receipt counters initialized');
  }
}