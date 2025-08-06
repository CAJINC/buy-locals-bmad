import crypto from 'crypto';
export const securityHeaders = (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https:; " +
        "font-src 'self' https:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()');
    next();
};
export const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanKey = key.replace(/[<>]/g, '');
                sanitized[cleanKey] = sanitize(value);
            }
            return sanitized;
        }
        return obj;
    };
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    next();
};
export class SuspiciousActivityDetector {
    static async trackActivity(ip, activity) {
        console.log(`Tracking suspicious activity: ${ip} - ${activity}`);
        return { isSuspicious: false, isBlocked: false };
    }
    static async isIPBlocked(ip) {
        console.log(`Checking if IP is blocked: ${ip}`);
        return false;
    }
    static async blockIP(ip, reason) {
        console.log(`Blocking IP ${ip}: ${reason}`);
    }
}
SuspiciousActivityDetector.SUSPICIOUS_PREFIX = 'suspicious:';
SuspiciousActivityDetector.BLOCK_PREFIX = 'blocked_ip:';
SuspiciousActivityDetector.SUSPICIOUS_THRESHOLD = 10;
SuspiciousActivityDetector.BLOCK_DURATION = 60 * 60;
export const auditLogger = (req, res, next) => {
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    const logData = {
        correlationId,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    };
    console.log('AUTH_REQUEST:', JSON.stringify(logData));
    const originalJson = res.json;
    res.json = function (body) {
        const duration = Date.now() - startTime;
        const responseLog = {
            correlationId,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode,
            duration,
        };
        console.log('AUTH_RESPONSE:', JSON.stringify(responseLog));
        return originalJson.call(this, body);
    };
    next();
};
export const passwordComplexity = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    validate(password) {
        const errors = [];
        if (password.length < this.minLength) {
            errors.push(`Password must be at least ${this.minLength} characters long`);
        }
        if (this.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (this.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (this.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        const commonPatterns = [
            /123456/,
            /password/i,
            /qwerty/i,
            /abc123/i,
        ];
        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                errors.push('Password contains common patterns and is not secure');
                break;
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
};
export const csrfProtection = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    const origin = req.get('Origin');
    const allowedOrigins = [
        process.env.CORS_ORIGIN || 'http://localhost:3000',
        'http://localhost:3001',
    ];
    if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid origin',
        });
    }
    next();
};
//# sourceMappingURL=security.js.map