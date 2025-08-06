import { NextFunction, Response } from 'express';
import {
  CognitoAuthenticatedRequest,
  authenticateCognito,
  requireAdmin,
  requireBusinessOwner,
  requireConsumer,
  requireRole,
} from '../../middleware/cognitoAuth';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Mock aws-jwt-verify
jest.mock('aws-jwt-verify');

describe('CognitoAuth Middleware', () => {
  let mockReq: Partial<CognitoAuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockVerifier: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock the verifier
    mockVerifier = {
      verify: jest.fn(),
    };

    (CognitoJwtVerifier.create as jest.Mock).mockReturnValue(mockVerifier);
  });

  describe('authenticateCognito', () => {
    it('should authenticate valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        'custom:role': 'consumer',
        email_verified: true,
      };

      mockReq.headers!.authorization = 'Bearer valid-token';
      mockVerifier.verify.mockResolvedValue(mockPayload);

      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'consumer',
        emailVerified: true,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      mockReq.headers!.authorization = 'Invalid token';

      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired or invalid token', async () => {
      mockReq.headers!.authorization = 'Bearer expired-token';
      mockVerifier.verify.mockRejectedValue(new Error('Token expired'));

      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing email in token', async () => {
      const mockPayload = {
        sub: 'user-123',
        'custom:role': 'consumer',
        email_verified: true,
      };

      mockReq.headers!.authorization = 'Bearer valid-token';
      mockVerifier.verify.mockResolvedValue(mockPayload);

      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user?.email).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing role in token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
      };

      mockReq.headers!.authorization = 'Bearer valid-token';
      mockVerifier.verify.mockResolvedValue(mockPayload);

      await authenticateCognito(
        mockReq as CognitoAuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user?.role).toBe('consumer');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'consumer',
        emailVerified: true,
      };
    });

    it('should allow access with correct role', () => {
      const middleware = requireRole(['consumer', 'business_owner']);

      middleware(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access with incorrect role', () => {
      const middleware = requireRole(['admin']);

      middleware(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access without authentication', () => {
      mockReq.user = undefined;
      const middleware = requireRole(['consumer']);

      middleware(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('convenience role middlewares', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'business_owner',
        emailVerified: true,
      };
    });

    it('requireConsumer should work for consumer role', () => {
      mockReq.user!.role = 'consumer';

      requireConsumer(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('requireBusinessOwner should work for business_owner role', () => {
      requireBusinessOwner(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAdmin should deny non-admin access', () => {
      requireAdmin(mockReq as CognitoAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
