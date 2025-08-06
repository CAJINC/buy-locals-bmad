import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, internalServerError, success, unauthorized } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { TaxService } from '../../services/taxService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';
import { validateBody } from '../../middleware/validation.js';

interface CalculateTaxRequest {
  businessId: string;
  customerAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: TaxCalculationItem[];
  currency?: string;
  transactionType?: 'sale' | 'refund' | 'adjustment';
}

interface TaxCalculationItem {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  taxCategory?: string;
  taxExempt?: boolean;
}

interface CalculateTaxResponse {
  businessId: string;
  totalAmount: number;
  taxableAmount: number;
  totalTaxAmount: number;
  taxExemptAmount: number;
  currency: string;
  taxBreakdown: TaxBreakdown[];
  itemTaxDetails: ItemTaxDetail[];
  calculatedAt: Date;
  taxProvider: string;
  jurisdiction: string;
}

interface TaxBreakdown {
  type: 'federal' | 'state' | 'county' | 'city' | 'district';
  name: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  jurisdiction: string;
}

interface ItemTaxDetail {
  itemId: string;
  taxableAmount: number;
  taxAmount: number;
  taxExempt: boolean;
  exemptionReason?: string;
  applicableTaxes: {
    type: string;
    rate: number;
    amount: number;
  }[];
}

// Validation schema for calculate tax
const calculateTaxSchema = {
  type: 'object',
  required: ['businessId', 'customerAddress', 'items'],
  properties: {
    businessId: {
      type: 'string',
      format: 'uuid'
    },
    customerAddress: {
      type: 'object',
      required: ['city', 'state', 'postalCode', 'country'],
      properties: {
        street: { type: 'string', maxLength: 200 },
        city: { type: 'string', maxLength: 100 },
        state: { type: 'string', minLength: 2, maxLength: 3 },
        postalCode: { type: 'string', maxLength: 20 },
        country: { type: 'string', minLength: 2, maxLength: 3 }
      }
    },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['id', 'description', 'amount'],
        properties: {
          id: { type: 'string', maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          amount: { type: 'number', minimum: 0 },
          quantity: { type: 'number', minimum: 1, maximum: 1000 },
          taxCategory: { type: 'string', maxLength: 100 },
          taxExempt: { type: 'boolean' }
        }
      }
    },
    currency: {
      type: 'string',
      enum: ['USD', 'CAD', 'EUR', 'GBP']
    },
    transactionType: {
      type: 'string',
      enum: ['sale', 'refund', 'adjustment']
    }
  },
  additionalProperties: false
};

/**
 * Calculate Tax Lambda Handler
 * 
 * Calculates applicable taxes for transactions with detailed breakdown by jurisdiction.
 * Integrates with tax service providers and handles various tax scenarios.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestBody: CalculateTaxRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'tax_calculate',
        entityType: 'tax_calculation',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Parse and validate request body
    if (!event.body) {
      return badRequest('Request body is required');
    }

    try {
      requestBody = JSON.parse(event.body) as CalculateTaxRequest;
    } catch (parseError) {
      return badRequest('Invalid JSON in request body');
    }

    // Validate request against schema
    const validation = validateBody(calculateTaxSchema);
    const validationResult = validation(requestBody);
    if (validationResult.errors?.length) {
      return badRequest(`Validation errors: ${validationResult.errors.join(', ')}`);
    }

    // Verify business exists and user has authorization
    const businessQuery = `
      SELECT b.id, b.name, b.owner_id, b.status, b.currency, 
             b.tax_id, b.tax_exempt, b.address, b.business_type
      FROM businesses b
      WHERE b.id = $1
    `;
    
    const businessResult = await pool.query(businessQuery, [requestBody.businessId]);
    
    if (businessResult.rows.length === 0) {
      return badRequest('Business not found');
    }

    const business = businessResult.rows[0];

    // Verify user authorization (business owner, admin, or accounting role)
    const isBusinessOwner = business.owner_id === userId;
    const isAdmin = userRole === 'admin';
    const isAccounting = userRole === 'accounting';

    if (!isBusinessOwner && !isAdmin && !isAccounting) {
      await auditLogger({
        operation: 'tax_calculate',
        entityType: 'tax_calculation',
        entityId: '',
        userId,
        businessId: requestBody.businessId,
        correlationId,
        success: false,
        error: 'Insufficient permissions'
      });
      return unauthorized('You do not have permission to calculate taxes for this business');
    }

    // Verify business is active
    if (business.status !== 'active') {
      return badRequest('Business is not active');
    }

    // Set currency from business or request
    const currency = requestBody.currency || business.currency || 'USD';
    const transactionType = requestBody.transactionType || 'sale';

    // Calculate total amounts
    const totalAmount = requestBody.items.reduce((sum, item) => 
      sum + (item.amount * (item.quantity || 1)), 0
    );

    const taxExemptAmount = requestBody.items
      .filter(item => item.taxExempt)
      .reduce((sum, item) => sum + (item.amount * (item.quantity || 1)), 0);

    const taxableAmount = totalAmount - taxExemptAmount;

    // Use tax service for calculations
    const taxService = new TaxService();
    
    let taxCalculation;
    try {
      taxCalculation = await taxService.calculateTax({
        businessId: requestBody.businessId,
        businessAddress: business.address,
        customerAddress: requestBody.customerAddress,
        items: requestBody.items,
        currency,
        transactionType,
        taxId: business.tax_id,
        businessTaxExempt: business.tax_exempt
      });
    } catch (taxServiceError) {
      logger.error('Tax service calculation failed', {
        businessId: requestBody.businessId,
        error: taxServiceError instanceof Error ? taxServiceError.message : 'Unknown error',
        correlationId
      });
      return internalServerError('Tax calculation service unavailable. Please try again.');
    }

    // Store tax calculation for audit and compliance
    const taxCalculationId = uuidv4();
    const taxCalculationInsertQuery = `
      INSERT INTO tax_calculations (
        id, business_id, user_id, total_amount, taxable_amount, 
        tax_exempt_amount, total_tax_amount, currency, transaction_type,
        customer_address, business_address, tax_breakdown, item_details,
        tax_provider, jurisdiction, created_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16)
    `;

    const taxCalculationValues = [
      taxCalculationId,
      requestBody.businessId,
      userId,
      totalAmount,
      taxableAmount,
      taxExemptAmount,
      taxCalculation.totalTaxAmount,
      currency,
      transactionType,
      JSON.stringify(requestBody.customerAddress),
      JSON.stringify(business.address),
      JSON.stringify(taxCalculation.taxBreakdown),
      JSON.stringify(taxCalculation.itemTaxDetails),
      taxCalculation.taxProvider,
      taxCalculation.jurisdiction,
      correlationId
    ];

    await pool.query(taxCalculationInsertQuery, taxCalculationValues);

    // Audit log success
    await auditLogger({
      operation: 'tax_calculate',
      entityType: 'tax_calculation',
      entityId: taxCalculationId,
      userId,
      businessId: requestBody.businessId,
      correlationId,
      success: true,
      metadata: {
        totalAmount,
        taxableAmount,
        totalTaxAmount: taxCalculation.totalTaxAmount,
        currency,
        transactionType,
        itemCount: requestBody.items.length,
        customerState: requestBody.customerAddress.state,
        customerCountry: requestBody.customerAddress.country
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Tax calculation completed successfully', {
      taxCalculationId,
      businessId: requestBody.businessId,
      businessName: business.name,
      totalAmount,
      taxableAmount,
      totalTaxAmount: taxCalculation.totalTaxAmount,
      currency,
      transactionType,
      itemCount: requestBody.items.length,
      taxProvider: taxCalculation.taxProvider,
      jurisdiction: taxCalculation.jurisdiction,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: CalculateTaxResponse = {
      businessId: requestBody.businessId,
      totalAmount,
      taxableAmount,
      totalTaxAmount: taxCalculation.totalTaxAmount,
      taxExemptAmount,
      currency,
      taxBreakdown: taxCalculation.taxBreakdown,
      itemTaxDetails: taxCalculation.itemTaxDetails,
      calculatedAt: new Date(),
      taxProvider: taxCalculation.taxProvider,
      jurisdiction: taxCalculation.jurisdiction
    };

    return success(response, 'Tax calculation completed successfully');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in calculate tax', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      requestBody: requestBody || 'Failed to parse'
    });

    await auditLogger({
      operation: 'tax_calculate',
      entityType: 'tax_calculation',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      businessId: requestBody?.businessId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};