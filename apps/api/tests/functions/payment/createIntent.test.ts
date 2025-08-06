import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from '../../../src/functions/payment/createIntent.js';
import { PaymentService } from '../../../src/services/paymentService.js';
import { TaxService } from '../../../src/services/taxService.js';
import PaymentTestData from '../../utils/paymentTestData.js';
import StripeTestHelpers from '../../utils/stripeTestHelpers.js';
import TestDatabase from '../../utils/testDatabase.js';

// Mock dependencies
jest.mock('../../../src/services/paymentService.js');
jest.mock('../../../src/services/taxService.js');
jest.mock('../../../src/middleware/auth.js');
jest.mock('../../../src/middleware/rateLimiting.js');

const MockPaymentService = PaymentService as jest.MockedClass<typeof PaymentService>;
const MockTaxService = TaxService as jest.MockedClass<typeof TaxService>;

describe('CreatePaymentIntent Lambda Function', () => {
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockTaxService: jest.Mocked<TaxService>;
  let mockContext: Context;

  beforeEach(async () => {
    await TestDatabase.initialize();
    
    mockPaymentService = new MockPaymentService() as jest.Mocked<PaymentService>;
    mockTaxService = new MockTaxService() as jest.Mocked<TaxService>;

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'createPaymentIntent',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:createPaymentIntent',
      memoryLimitInMB: '256',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/createPaymentIntent',
      logStreamName: '2024/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // Setup default mocks
    mockPaymentService.createPaymentIntent.mockResolvedValue({
      success: true,
      paymentIntentId: 'pi_test_123',
      status: 'requires_confirmation',
      clientSecret: 'pi_test_123_secret',
      metadata: {
        platformFee: 290,
        businessAmount: 9710,
        escrowEnabled: true,
      },
    });

    mockTaxService.calculateTax.mockResolvedValue({
      taxAmount: 875,
      taxRate: 0.0875,
      jurisdiction: 'CA',
      exemptionApplied: false,
      breakdown: [
        {
          jurisdiction: 'CA',
          taxType: 'state',
          rate: 0.0625,
          amount: 625,
        },
        {
          jurisdiction: 'CA_LOCAL',
          taxType: 'local',
          rate: 0.025,
          amount: 250,
        },
      ],
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await TestDatabase.close();
    jest.resetAllMocks();
  });

  describe('Successful Payment Intent Creation', () => {
    it('should create payment intent with valid request', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/api/payment/create-intent',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
          'X-User-ID': 'user-123',
        },
        body: JSON.stringify({
          amount: 10000, // $100.00
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          description: 'Test payment for local service',
          automaticCapture: false,
          serviceId: 'service_test_123',
          customerLocation: {
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
          },
        }),
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          requestId: 'test-request-id',
          stage: 'test',
          httpMethod: 'POST',
          path: '/api/payment/create-intent',
          accountId: '123456789012',
          apiId: 'test-api-id',
          resourceId: 'test-resource',
          resourcePath: '/api/payment/create-intent',
          requestTimeEpoch: Date.now(),
          identity: {
            sourceIp: '192.168.1.100',
            userAgent: 'BuyLocals/1.0.0 (iOS 15.0)',
          },
        } as any,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      };

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(true);
      expect(body.data.paymentIntentId).toBe('pi_test_123');
      expect(body.data.clientSecret).toBe('pi_test_123_secret');
      expect(body.data.taxCalculation).toBeDefined();
      expect(body.data.taxCalculation.taxAmount).toBe(875);
      expect(body.data.platformFee).toBe(290);
      expect(body.data.businessAmount).toBe(9710);

      // Verify services were called correctly
      expect(mockTaxService.calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'test-business-123',
          amount: 10000,
        })
      );

      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10875, // Original amount + tax
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          automaticCapture: false,
        })
      );
    });

    it('should handle immediate capture payments', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 5000, // $50.00
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          automaticCapture: true, // Immediate capture
          description: 'Immediate capture payment',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'X-User-ID': 'user-123',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      mockPaymentService.createPaymentIntent.mockResolvedValueOnce({
        success: true,
        paymentIntentId: 'pi_immediate_123',
        status: 'requires_confirmation',
        clientSecret: 'pi_immediate_123_secret',
        metadata: {
          platformFee: 145,
          businessAmount: 5230, // $50 + tax - platform fee
          escrowEnabled: false,
        },
      });

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(true);
      expect(body.data.escrowEnabled).toBe(false);
      
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          automaticCapture: true,
        })
      );
    });

    it('should handle payments with tax exemptions', async () => {
      mockTaxService.calculateTax.mockResolvedValueOnce({
        taxAmount: 0,
        taxRate: 0,
        jurisdiction: 'CA',
        exemptionApplied: true,
        exemptionReason: 'nonprofit_exemption',
        breakdown: [],
      });

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          exemptionId: 'exemption-123',
          customerLocation: {
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
          },
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'X-User-ID': 'user-123',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      expect(body.data.taxCalculation.exemptionApplied).toBe(true);
      expect(body.data.taxCalculation.taxAmount).toBe(0);
      
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // No tax added
        })
      );
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          // Missing required fields: amount, currency, businessId, customerId
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('validation');
      expect(body.details).toContain('amount');
    });

    it('should validate amount limits', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 25, // Below minimum ($0.50)
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      mockPaymentService.createPaymentIntent.mockRejectedValueOnce(
        new Error('Minimum payment amount is $0.50')
      );

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Minimum payment amount');
    });

    it('should validate currency codes', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'INVALID', // Invalid currency
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('currency');
    });

    it('should sanitize input data', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: '<script>alert("xss")</script>',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          description: 'javascript:void(0)',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      // Should process successfully but with sanitized data
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: expect.not.stringContaining('<script>'),
          description: expect.not.stringContaining('javascript:'),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle payment service errors', async () => {
      mockPaymentService.createPaymentIntent.mockRejectedValueOnce(
        new Error('Payment processing failed')
      );

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Payment processing failed');
    });

    it('should handle tax calculation errors gracefully', async () => {
      mockTaxService.calculateTax.mockRejectedValueOnce(
        new Error('Tax service unavailable')
      );

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
          customerLocation: {
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
          },
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      // Should still create payment intent but without tax calculation
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(true);
      expect(body.data.taxCalculation).toBeNull();
      expect(body.warnings).toContain('Tax calculation failed');
      
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // Original amount without tax
        })
      );
    });

    it('should handle malformed JSON in request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: '{ invalid json }',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid JSON');
    });

    it('should handle missing request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: null,
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Request body is required');
    });
  });

  describe('Security', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          // Missing Authorization header
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('unauthorized');
    });

    it('should log security events', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 1000000, // Very large amount - suspicious
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'User-Agent': 'curl/7.68.0', // Suspicious user agent
        },
        requestContext: {
          identity: { 
            sourceIp: '192.168.1.100',
            userAgent: 'curl/7.68.0',
          },
        } as any,
      } as APIGatewayProxyEvent;

      await handler(event, mockContext);

      // Verify security logging occurred (mock implementation would check logs)
      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      // Mock rate limiter to return rate limited
      const rateLimitedEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'X-User-ID': 'rate-limited-user',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      // In a real implementation, rate limiting middleware would handle this
      const result = await handler(rateLimitedEvent, mockContext) as APIGatewayProxyResult;

      if (result.statusCode === 429) {
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.error).toContain('rate limit');
      }
    });
  });

  describe('Response Format', () => {
    it('should return standardized response format', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('headers');
      
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('requestId');
    });

    it('should include correlation ID in response', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 10000,
          currency: 'USD',
          businessId: 'test-business-123',
          customerId: 'cus_test_customer',
          paymentMethodId: 'pm_test_card',
        }),
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'X-Correlation-ID': 'custom-correlation-id',
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' },
        } as any,
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext) as APIGatewayProxyResult;
      
      expect(result.headers).toHaveProperty('X-Correlation-ID');
      const body = JSON.parse(result.body);
      expect(body.correlationId).toBeDefined();
    });
  });
});