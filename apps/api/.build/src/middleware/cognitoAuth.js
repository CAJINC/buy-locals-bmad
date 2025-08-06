import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '../config/environment.js';
const verifier = CognitoJwtVerifier.create({
    userPoolId: config.cognitoUserPoolId,
    tokenUse: "access",
    clientId: config.cognitoClientId,
});
export const authenticateCognito = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const token = authHeader.substring(7);
        const payload = await verifier.verify(token);
        req.user = {
            id: payload.sub,
            email: payload.email || '',
            role: payload['custom:role'] || 'consumer',
            emailVerified: payload.email_verified || false,
        };
        next();
    }
    catch (error) {
        console.error('Token verification failed:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
export const requireConsumer = requireRole(['consumer']);
export const requireBusinessOwner = requireRole(['business_owner']);
export const requireAdmin = requireRole(['admin']);
export const requireConsumerOrBusinessOwner = requireRole(['consumer', 'business_owner']);
//# sourceMappingURL=cognitoAuth.js.map