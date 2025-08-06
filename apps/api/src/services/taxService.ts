import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxExemption,
  TaxJurisdictionBreakdown,
  TaxServiceInterface
} from '../types/Payment.js';
import { 
  PaymentProcessingError,
  PaymentValidationError 
} from '../errors/PaymentErrors.js';

interface TaxReport {
  businessId: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalTransactions: number;
    totalRevenue: number;
    totalTaxCollected: number;
    taxByJurisdiction: Record<string, number>;
  };
  transactions: TaxableTransaction[];
  exemptions: TaxExemption[];
  generatedAt: string;
  correlationId: string;
}

interface TaxableTransaction {
  id: string;
  businessId: string;
  amount: number;
  taxAmount: number;
  jurisdiction: string;
  date: Date;
  exemptionApplied: boolean;
  exemptionType?: string;
}

/**
 * Comprehensive Tax Calculation Service for Buy Locals Platform
 * 
 * Features:
 * - Multi-jurisdiction tax calculation (Federal, State, Local)
 * - Tax exemption handling and validation
 * - Support for different product/service types
 * - Tax compliance reporting
 * - Integration with external tax services (TaxJar, Avalara)
 */
export class TaxService implements TaxServiceInterface {
  // Tax rates database (in production, this would be fetched from external services)
  private readonly taxRates: Map<string, TaxJurisdictionBreakdown[]> = new Map();
  private readonly taxExemptions: Map<string, TaxExemption[]> = new Map();

  constructor() {
    this.initializeTaxRates();
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    const correlationId = uuidv4();

    try {
      await this.validateTaxRequest(request);

      logger.info('Calculating tax', {
        businessId: request.businessId,
        amount: request.amount,
        businessLocation: request.businessLocation,
        correlationId
      });

      // Determine tax jurisdiction based on business and customer locations
      const jurisdiction = this.determineTaxJurisdiction(request);
      
      // Get applicable tax rates
      const taxBreakdown = await this.getTaxBreakdown(jurisdiction, request);
      
      // Check for exemptions
      const exemption = await this.checkTaxExemption(request);
      
      // Calculate total tax
      let totalTax = 0;
      const applicableBreakdown: TaxJurisdictionBreakdown[] = [];

      for (const tax of taxBreakdown) {
        if (!exemption.exemptionApplied || !this.isExemptFromTax(exemption.exemptionReason || '', tax.taxType)) {
          const taxAmount = Math.round(request.amount * tax.rate);
          totalTax += taxAmount;
          
          applicableBreakdown.push({
            ...tax,
            amount: taxAmount
          });
        }
      }

      const result: TaxCalculationResult = {
        taxAmount: totalTax,
        taxRate: totalTax / request.amount,
        jurisdiction,
        exemptionApplied: exemption.exemptionApplied,
        exemptionReason: exemption.exemptionReason,
        breakdown: applicableBreakdown
      };

      logger.info('Tax calculation completed', {
        businessId: request.businessId,
        taxAmount: totalTax,
        jurisdiction,
        exemptionApplied: exemption.exemptionApplied,
        correlationId
      });

      return result;

    } catch (error) {
      logger.error('Tax calculation failed', {
        businessId: request.businessId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      if (error instanceof PaymentValidationError) {
        throw error;
      }

      throw new PaymentProcessingError(
        'Failed to calculate tax',
        true,
        error as Error
      );
    }
  }

  /**
   * Validate tax exemption
   */
  async validateTaxExemption(exemptionId: string, businessId: string): Promise<boolean> {
    try {
      const exemptions = this.taxExemptions.get(businessId) || [];
      const exemption = exemptions.find(e => e.id === exemptionId);

      if (!exemption) {
        return false;
      }

      // Check if exemption is active and within date range
      const now = new Date();
      const isActive = exemption.isActive && 
                      exemption.validFrom <= now && 
                      (!exemption.validTo || exemption.validTo >= now);

      if (!isActive) {
        logger.warn('Tax exemption validation failed', {
          exemptionId,
          businessId,
          reason: 'Exemption is inactive or expired'
        });
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Tax exemption validation error', {
        exemptionId,
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Create tax report for a business
   */
  async createTaxReport(businessId: string, startDate: Date, endDate: Date): Promise<TaxReport> {
    const correlationId = uuidv4();

    try {
      logger.info('Generating tax report', {
        businessId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        correlationId
      });

      // In a real implementation, this would query transaction data
      const mockTransactions = await this.getTaxableTransactions(businessId, startDate, endDate);
      
      const report = {
        businessId,
        reportPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: {
          totalTransactions: mockTransactions.length,
          totalRevenue: mockTransactions.reduce((sum, t) => sum + t.amount, 0),
          totalTaxCollected: mockTransactions.reduce((sum, t) => sum + t.taxAmount, 0),
          taxByJurisdiction: this.groupTaxByJurisdiction(mockTransactions)
        },
        transactions: mockTransactions,
        exemptions: await this.getActiveExemptions(businessId, startDate, endDate),
        generatedAt: new Date().toISOString(),
        correlationId
      };

      logger.info('Tax report generated successfully', {
        businessId,
        totalTransactions: report.summary.totalTransactions,
        totalTaxCollected: report.summary.totalTaxCollected,
        correlationId
      });

      return report;

    } catch (error) {
      logger.error('Tax report generation failed', {
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw new PaymentProcessingError(
        'Failed to generate tax report',
        true,
        error as Error
      );
    }
  }

  /**
   * Update tax exemption
   */
  async updateTaxExemption(exemption: TaxExemption): Promise<void> {
    try {
      await this.validateExemption(exemption);

      const businessExemptions = this.taxExemptions.get(exemption.businessId) || [];
      const existingIndex = businessExemptions.findIndex(e => e.id === exemption.id);

      if (existingIndex >= 0) {
        businessExemptions[existingIndex] = exemption;
      } else {
        businessExemptions.push(exemption);
      }

      this.taxExemptions.set(exemption.businessId, businessExemptions);

      logger.info('Tax exemption updated', {
        exemptionId: exemption.id,
        businessId: exemption.businessId,
        exemptionType: exemption.exemptionType,
        isActive: exemption.isActive
      });

    } catch (error) {
      logger.error('Tax exemption update failed', {
        exemptionId: exemption.id,
        businessId: exemption.businessId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new PaymentProcessingError(
        'Failed to update tax exemption',
        false,
        error as Error
      );
    }
  }

  // Private helper methods

  private async validateTaxRequest(request: TaxCalculationRequest): Promise<void> {
    if (!request.businessId) {
      throw new PaymentValidationError('Business ID is required for tax calculation');
    }

    if (!request.amount || request.amount <= 0) {
      throw new PaymentValidationError('Valid amount is required for tax calculation');
    }

    if (!request.businessLocation || !request.businessLocation.state) {
      throw new PaymentValidationError('Business location with state is required');
    }

    // Validate location format
    if (request.customerLocation) {
      if (!request.customerLocation.state || !request.customerLocation.postalCode) {
        throw new PaymentValidationError('Customer location must include state and postal code');
      }
    }
  }

  private determineTaxJurisdiction(request: TaxCalculationRequest): string {
    // Tax jurisdiction is primarily determined by business location
    // Some states require customer location-based taxation
    
    const businessState = request.businessLocation.state.toUpperCase();
    const customerState = request.customerLocation?.state?.toUpperCase();

    // States with origin-based sales tax (business location) - for future use
    // const originBasedStates = ['CA', 'AZ', 'IL', 'MS', 'MO', 'NM', 'OH', 'PA', 'TN', 'TX', 'UT', 'VA'];
    
    // States with destination-based sales tax (customer location)
    const destinationBasedStates = ['AL', 'AR', 'CO', 'CT', 'DC', 'FL', 'GA', 'HI', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'NE', 'NV', 'NJ', 'NY', 'NC', 'ND', 'OK', 'RI', 'SC', 'SD', 'VT', 'WA', 'WV', 'WI', 'WY'];

    let jurisdiction = businessState;

    if (customerState && destinationBasedStates.includes(businessState)) {
      jurisdiction = customerState;
    }

    // Handle interstate transactions
    if (businessState !== customerState && customerState) {
      jurisdiction = `${businessState}-${customerState}`;
    }

    return jurisdiction;
  }

  private async getTaxBreakdown(jurisdiction: string, request: TaxCalculationRequest): Promise<TaxJurisdictionBreakdown[]> {
    const breakdown = this.taxRates.get(jurisdiction) || this.getDefaultTaxRates(jurisdiction);
    
    // Apply product/service type specific rates
    if (request.productType || request.serviceType) {
      return this.adjustTaxRatesForType(breakdown, request.productType, request.serviceType);
    }

    return breakdown;
  }

  private async checkTaxExemption(request: TaxCalculationRequest): Promise<{ exemptionApplied: boolean; exemptionReason?: string }> {
    if (!request.exemptionId) {
      return { exemptionApplied: false };
    }

    const isValid = await this.validateTaxExemption(request.exemptionId, request.businessId);
    
    if (isValid) {
      const exemptions = this.taxExemptions.get(request.businessId) || [];
      const exemption = exemptions.find(e => e.id === request.exemptionId);
      
      return {
        exemptionApplied: true,
        exemptionReason: exemption?.exemptionType || 'Tax exempt'
      };
    }

    return { exemptionApplied: false };
  }

  private isExemptFromTax(exemptionReason: string, taxType: string): boolean {
    // Define exemption rules
    const exemptionRules: Record<string, string[]> = {
      'nonprofit': ['state_sales_tax', 'local_sales_tax'],
      'government': ['state_sales_tax', 'local_sales_tax', 'federal_excise_tax'],
      'educational': ['state_sales_tax'],
      'medical': ['state_sales_tax', 'local_sales_tax'],
      'food_stamps': ['state_sales_tax', 'local_sales_tax'],
      'resale': ['state_sales_tax', 'local_sales_tax']
    };

    const exemptTaxTypes = exemptionRules[exemptionReason.toLowerCase()] || [];
    return exemptTaxTypes.includes(taxType);
  }

  private getDefaultTaxRates(jurisdiction: string): TaxJurisdictionBreakdown[] {
    // Default tax rates by state (simplified - in production, use external tax service)
    const stateTaxRates: Record<string, number> = {
      'CA': 0.0725, // 7.25%
      'NY': 0.08,   // 8%
      'TX': 0.0625, // 6.25%
      'FL': 0.06,   // 6%
      'WA': 0.065,  // 6.5%
      // Add more states as needed
    };

    const state = jurisdiction.split('-')[0];
    const baseRate = stateTaxRates[state] || 0.05; // 5% default

    return [
      {
        jurisdiction: state,
        taxType: 'state_sales_tax',
        rate: baseRate,
        amount: 0 // Will be calculated later
      },
      {
        jurisdiction: `${state}_LOCAL`,
        taxType: 'local_sales_tax',
        rate: baseRate * 0.3, // Approximately 30% of state rate for local
        amount: 0
      }
    ];
  }

  private adjustTaxRatesForType(
    breakdown: TaxJurisdictionBreakdown[], 
    productType?: string, 
    serviceType?: string
  ): TaxJurisdictionBreakdown[] {
    // Adjust tax rates based on product/service type
    // Some products/services have different tax rates or exemptions
    
    const type = productType || serviceType || '';
    const lowerType = type.toLowerCase();

    // Tax-exempt or reduced rate categories
    if (lowerType.includes('food') || lowerType.includes('grocery')) {
      // Food items often have reduced tax rates
      return breakdown.map(tax => ({
        ...tax,
        rate: tax.rate * 0.5 // 50% reduction for food items
      }));
    }

    if (lowerType.includes('medical') || lowerType.includes('prescription')) {
      // Medical items are often tax-exempt
      return breakdown.map(tax => ({
        ...tax,
        rate: 0 // Tax-exempt
      }));
    }

    if (lowerType.includes('digital') || lowerType.includes('software')) {
      // Digital products may have different tax treatment
      return breakdown.filter(tax => tax.taxType !== 'local_sales_tax'); // Only state tax
    }

    return breakdown;
  }

  private async validateExemption(exemption: TaxExemption): Promise<void> {
    if (!exemption.id || !exemption.businessId || !exemption.exemptionType) {
      throw new PaymentValidationError('Exemption must have ID, business ID, and type');
    }

    if (!exemption.jurisdiction) {
      throw new PaymentValidationError('Exemption must specify jurisdiction');
    }

    if (exemption.validTo && exemption.validTo <= exemption.validFrom) {
      throw new PaymentValidationError('Exemption end date must be after start date');
    }

    const validExemptionTypes = [
      'nonprofit', 'government', 'educational', 'medical', 
      'resale', 'manufacturing', 'agriculture', 'food_stamps'
    ];

    if (!validExemptionTypes.includes(exemption.exemptionType.toLowerCase())) {
      throw new PaymentValidationError(
        `Invalid exemption type. Valid types: ${validExemptionTypes.join(', ')}`
      );
    }
  }

  private initializeTaxRates(): void {
    // Initialize with common tax rates (in production, fetch from external service)
    this.taxRates.set('CA', [
      { jurisdiction: 'CA', taxType: 'state_sales_tax', rate: 0.0725, amount: 0 },
      { jurisdiction: 'CA_LOCAL', taxType: 'local_sales_tax', rate: 0.02, amount: 0 }
    ]);

    this.taxRates.set('NY', [
      { jurisdiction: 'NY', taxType: 'state_sales_tax', rate: 0.08, amount: 0 },
      { jurisdiction: 'NY_LOCAL', taxType: 'local_sales_tax', rate: 0.025, amount: 0 }
    ]);

    this.taxRates.set('TX', [
      { jurisdiction: 'TX', taxType: 'state_sales_tax', rate: 0.0625, amount: 0 },
      { jurisdiction: 'TX_LOCAL', taxType: 'local_sales_tax', rate: 0.02, amount: 0 }
    ]);

    // Initialize sample exemptions
    this.taxExemptions.set('business-1', [
      {
        id: 'exemption-1',
        businessId: 'business-1',
        exemptionType: 'nonprofit',
        jurisdiction: 'CA',
        certificateNumber: 'NP-12345',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-12-31'),
        isActive: true
      }
    ]);
  }

  // Mock database operations (replace with actual database implementation)
  private async getTaxableTransactions(_businessId: string, _startDate: Date, _endDate: Date): Promise<TaxableTransaction[]> {
    // Mock transactions for report generation
    return [
      {
        id: 'txn-1',
        businessId: _businessId,
        amount: 10000, // $100.00
        taxAmount: 825, // $8.25
        jurisdiction: 'CA',
        date: new Date(),
        exemptionApplied: false
      },
      {
        id: 'txn-2',
        businessId: _businessId,
        amount: 5000, // $50.00
        taxAmount: 0, // Tax exempt
        jurisdiction: 'CA',
        date: new Date(),
        exemptionApplied: true,
        exemptionType: 'nonprofit'
      }
    ];
  }

  private groupTaxByJurisdiction(transactions: TaxableTransaction[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    transactions.forEach(txn => {
      if (!grouped[txn.jurisdiction]) {
        grouped[txn.jurisdiction] = 0;
      }
      grouped[txn.jurisdiction] += txn.taxAmount;
    });

    return grouped;
  }

  private async getActiveExemptions(businessId: string, startDate: Date, endDate: Date): Promise<TaxExemption[]> {
    const exemptions = this.taxExemptions.get(businessId) || [];
    
    return exemptions.filter(exemption => {
      return exemption.isActive &&
             exemption.validFrom <= endDate &&
             (!exemption.validTo || exemption.validTo >= startDate);
    });
  }
}