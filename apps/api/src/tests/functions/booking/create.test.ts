import { handler } from '../../../functions/booking/create';
import { bookingService } from '../../../services/bookingService';
import { responseUtils } from '../../../utils/lambdaResponseUtils';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock dependencies
jest.mock('../../../services/bookingService');
jest.mock('../../../utils/responseUtils');

const mockBookingService = bookingService as jest.Mocked<typeof bookingService>;
const mockResponseUtils = responseUtils as jest.Mocked<typeof responseUtils>;

describe('Booking Create Handler', () => {
  const mockContext: Context = {} as Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default response utils mocks
    mockResponseUtils.badRequest.mockReturnValue({
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request' })
    } as any);
    
    mockResponseUtils.unauthorized.mockReturnValue({
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    } as any);
    
    mockResponseUtils.created.mockReturnValue({
      statusCode: 201,
      body: JSON.stringify({ message: 'Created' })
    } as any);
    
    mockResponseUtils.internalServerError.mockReturnValue({
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    } as any);
  });

  it('should create booking successfully with valid data', async () => {
    const validBookingData = {
      businessId: '123e4567-e89b-12d3-a456-426614174000',
      serviceId: 'haircut-service',
      scheduledAt: new Date('2024-12-31T10:00:00.000Z').toISOString(),
      duration: 60,
      customerInfo: {
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com'
      },
      totalAmount: 50.00,
      notes: 'First time customer'
    };

    const mockBooking = {
      id: 'booking-123',
      ...validBookingData,
      consumerId: 'user-123',
      status: 'pending' as const,
      scheduledAt: new Date(validBookingData.scheduledAt),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify(validBookingData),
      requestContext: {
        authorizer: { principalId: 'user-123' }
      } as any
    };

    mockBookingService.createBooking.mockResolvedValue(mockBooking);

    const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockBookingService.createBooking).toHaveBeenCalledWith({
      ...validBookingData,
      consumerId: 'user-123',
      scheduledAt: new Date(validBookingData.scheduledAt)
    });
    expect(mockResponseUtils.created).toHaveBeenCalledWith({
      booking: mockBooking,
      message: 'Booking created successfully'
    });
  });

  it('should return bad request when body is missing', async () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: null,
      requestContext: {
        authorizer: { principalId: 'user-123' }
      } as any
    };

    await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockResponseUtils.badRequest).toHaveBeenCalledWith('Request body is required');
  });

  it('should return unauthorized when user is not authenticated', async () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({}),
      requestContext: {
        authorizer: null
      } as any
    };

    await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockResponseUtils.unauthorized).toHaveBeenCalledWith('User authentication required');
  });

  it('should handle validation errors', async () => {
    const invalidBookingData = {
      businessId: 'invalid-uuid',
      // Missing required fields
    };

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify(invalidBookingData),
      requestContext: {
        authorizer: { principalId: 'user-123' }
      } as any
    };

    await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockResponseUtils.badRequest).toHaveBeenCalledWith(
      expect.stringMatching(/Validation error:/)
    );
  });

  it('should handle time slot unavailable error', async () => {
    const validBookingData = {
      businessId: '123e4567-e89b-12d3-a456-426614174000',
      serviceId: 'haircut-service',
      scheduledAt: new Date('2024-12-31T10:00:00.000Z').toISOString(),
      duration: 60,
      customerInfo: {
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com'
      },
      totalAmount: 50.00
    };

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify(validBookingData),
      requestContext: {
        authorizer: { principalId: 'user-123' }
      } as any
    };

    mockBookingService.createBooking.mockRejectedValue(
      new Error('Time slot no longer available')
    );

    await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockResponseUtils.badRequest).toHaveBeenCalledWith('Time slot no longer available');
  });

  it('should handle business not found error', async () => {
    const validBookingData = {
      businessId: '123e4567-e89b-12d3-a456-426614174000',
      serviceId: 'haircut-service',
      scheduledAt: new Date('2024-12-31T10:00:00.000Z').toISOString(),
      duration: 60,
      customerInfo: {
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com'
      },
      totalAmount: 50.00
    };

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify(validBookingData),
      requestContext: {
        authorizer: { principalId: 'user-123' }
      } as any
    };

    mockBookingService.createBooking.mockRejectedValue(
      new Error('Business not found')
    );
    
    mockResponseUtils.notFound.mockReturnValue({
      statusCode: 404,
      body: JSON.stringify({ error: 'Business not found' })
    } as any);

    await handler(mockEvent as APIGatewayProxyEvent, mockContext, jest.fn());

    expect(mockResponseUtils.notFound).toHaveBeenCalledWith('Business not found');
  });
});