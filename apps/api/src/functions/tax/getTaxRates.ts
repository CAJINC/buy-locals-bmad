import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { success, badRequest, unauthorized, internalServerError } from '../../utils/lambdaResponseUtils.js';
import { logger } from '../../utils/logger.js';
import { TaxService } from '../../services/taxService.js';
import { pool } from '../../config/database.js';
import { auditLogger, sanitizeInput } from '../../middleware/security.js';

interface GetTaxRatesRequest {
  address: {
    street?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  businessId?: string;
  taxCategory?: string;
}

interface GetTaxRatesResponse {
  address: {
    street?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  jurisdiction: string;
  taxRates: TaxRate[];
  combinedRate: number;
  effectiveDate: Date;
  taxProvider: string;
  businessId?: string;
  businessTaxExempt?: boolean;
  retrievedAt: Date;
}

interface TaxRate {
  type: 'federal' | 'state' | 'county' | 'city' | 'district' | 'special';
  name: string;
  rate: number;
  taxableTypes: string[];
  exemptions?: string[];
  jurisdiction: string;
  authority: string;
  effectiveDate: Date;
  expirationDate?: Date;
}

/**
 * Get Tax Rates Lambda Handler
 * 
 * Retrieves applicable tax rates for a specific address and business context.
 * Provides detailed tax rate information by jurisdiction and tax type.
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  let requestParams: GetTaxRatesRequest;
  
  try {
    // Security headers and input sanitization
    const sanitizedInput = sanitizeInput(event);
    
    // Extract user from JWT token
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole;
    
    if (!userId) {
      await auditLogger({
        operation: 'tax_rates_get',
        entityType: 'tax_rates',
        entityId: '',
        userId: '',
        correlationId,
        success: false,
        error: 'Missing user authentication'
      });
      return unauthorized('Authentication required');
    }

    // Parse parameters from query string and path
    const queryParams = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    
    // Extract address from query parameters
    if (!queryParams.city || !queryParams.state || !queryParams.postalCode || !queryParams.country) {
      return badRequest('Address parameters (city, state, postalCode, country) are required');
    }

    requestParams = {
      address: {
        street: queryParams.street,
        city: queryParams.city,
        state: queryParams.state,
        postalCode: queryParams.postalCode,
        country: queryParams.country
      },
      businessId: queryParams.businessId || pathParams.businessId,
      taxCategory: queryParams.taxCategory
    };

    // Validate address format
    if (requestParams.address.state.length < 2 || requestParams.address.state.length > 3) {
      return badRequest('State must be 2-3 characters');
    }

    if (requestParams.address.country.length < 2 || requestParams.address.country.length > 3) {
      return badRequest('Country must be 2-3 characters (ISO code)');
    }

    // Verify business if businessId is provided
    let business = null;
    if (requestParams.businessId) {
      const businessQuery = `
        SELECT b.id, b.name, b.owner_id, b.status, b.tax_exempt, b.business_type
        FROM businesses b
        WHERE b.id = $1
      `;
      
      const businessResult = await pool.query(businessQuery, [requestParams.businessId]);
      
      if (businessResult.rows.length === 0) {
        return badRequest('Business not found');
      }

      business = businessResult.rows[0];

      // Verify user authorization for business-specific queries
      const isBusinessOwner = business.owner_id === userId;
      const isAdmin = userRole === 'admin';
      const isAccounting = userRole === 'accounting';

      if (!isBusinessOwner && !isAdmin && !isAccounting) {
        await auditLogger({
          operation: 'tax_rates_get',
          entityType: 'tax_rates',
          entityId: '',
          userId,
          businessId: requestParams.businessId,
          correlationId,
          success: false,
          error: 'Insufficient permissions'
        });
        return unauthorized('You do not have permission to get tax rates for this business');
      }

      // Verify business is active
      if (business.status !== 'active') {
        return badRequest('Business is not active');
      }
    }

    // Use tax service to retrieve rates
    const taxService = new TaxService();
    
    let taxRatesData;
    try {
      taxRatesData = await taxService.getTaxRates({
        address: requestParams.address,
        businessId: requestParams.businessId,
        businessType: business?.business_type,
        taxCategory: requestParams.taxCategory
      });
    } catch (taxServiceError) {
      logger.error('Tax service rate retrieval failed', {
        address: requestParams.address,
        businessId: requestParams.businessId,
        error: taxServiceError instanceof Error ? taxServiceError.message : 'Unknown error',
        correlationId
      });
      return internalServerError('Tax rate service unavailable. Please try again.');
    }

    // Store tax rate lookup for audit and caching
    const taxRateLookupId = uuidv4();
    const taxRateLookupInsertQuery = `
      INSERT INTO tax_rate_lookups (
        id, user_id, business_id, address, tax_category,
        jurisdiction, tax_rates, combined_rate, tax_provider,
        created_at, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    `;

    const taxRateLookupValues = [
      taxRateLookupId,
      userId,
      requestParams.businessId,
      JSON.stringify(requestParams.address),
      requestParams.taxCategory,
      taxRatesData.jurisdiction,
      JSON.stringify(taxRatesData.taxRates),
      taxRatesData.combinedRate,
      taxRatesData.taxProvider,
      correlationId
    ];

    await pool.query(taxRateLookupInsertQuery, taxRateLookupValues);

    // Audit log success
    await auditLogger({
      operation: 'tax_rates_get',
      entityType: 'tax_rates',
      entityId: taxRateLookupId,
      userId,
      businessId: requestParams.businessId,
      correlationId,
      success: true,
      metadata: {
        address: requestParams.address,
        jurisdiction: taxRatesData.jurisdiction,
        combinedRate: taxRatesData.combinedRate,
        taxCategory: requestParams.taxCategory,
        rateCount: taxRatesData.taxRates.length,
        businessTaxExempt: business?.tax_exempt
      }
    });

    // Performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Tax rates retrieved successfully', {
      taxRateLookupId,
      address: requestParams.address,
      jurisdiction: taxRatesData.jurisdiction,
      combinedRate: taxRatesData.combinedRate,
      rateCount: taxRatesData.taxRates.length,
      businessId: requestParams.businessId,
      businessName: business?.name,
      taxProvider: taxRatesData.taxProvider,
      correlationId,
      processingTimeMs: processingTime
    });

    // Prepare response
    const response: GetTaxRatesResponse = {
      address: requestParams.address,
      jurisdiction: taxRatesData.jurisdiction,
      taxRates: taxRatesData.taxRates,
      combinedRate: taxRatesData.combinedRate,
      effectiveDate: taxRatesData.effectiveDate,
      taxProvider: taxRatesData.taxProvider,
      businessId: requestParams.businessId,
      businessTaxExempt: business?.tax_exempt,
      retrievedAt: new Date()
    };

    return success(response, `Retrieved ${taxRatesData.taxRates.length} applicable tax rates`);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log unexpected errors
    logger.error('Unexpected error in get tax rates', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
      processingTimeMs: processingTime,
      userId: event.requestContext.authorizer?.userId,
      queryParams: event.queryStringParameters,
      pathParams: event.pathParameters
    });

    await auditLogger({
      operation: 'tax_rates_get',
      entityType: 'tax_rates',
      entityId: '',
      userId: event.requestContext.authorizer?.userId || '',
      businessId: requestParams?.businessId || '',
      correlationId,
      success: false,
      error: 'Internal server error'
    });

    return internalServerError('An unexpected error occurred. Please try again or contact support.');
  }
};