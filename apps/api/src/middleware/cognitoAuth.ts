import { NextFunction, Request, Response } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '../config/environment';

export interface CognitoAuthenticatedRequest extends Request {
  user?: {
    id: string; // sub claim from Cognito
    email: string;
    role: string; // custom:role attribute
    emailVerified: boolean;
  };
}

// Create JWT verifier for Cognito tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: config.cognitoUserPoolId,
  tokenUse: 'access',
  clientId: config.cognitoClientId,
});

export const authenticateCognito = async (
  req: CognitoAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Cognito
    const payload = await verifier.verify(token);

    // Extract user information from token payload
    req.user = {
      id: payload.sub,
      email: String(payload.email || ''),
      role: String(payload['custom:role'] || 'consumer'),
      emailVerified: Boolean(payload.email_verified || false),
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to require specific roles
export const requireRole = (allowedRoles: string[]) => {
  return (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Convenience middlewares for common role checks
export const requireConsumer = requireRole(['consumer']);
export const requireBusinessOwner = requireRole(['business_owner']);
export const requireAdmin = requireRole(['admin']);
export const requireConsumerOrBusinessOwner = requireRole(['consumer', 'business_owner']);
