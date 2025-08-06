import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { redisClient } from '../config/redis.js';

// Rate limiting per IP for location requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const RATE_LIMIT_PREFIX = 'location_rate_limit';

// Security thresholds
const MAX_RADIUS_KM = 500; // Maximum search radius
const MIN_RADIUS_KM = 0.1;  // Minimum search radius
const MAX_SEARCH_LENGTH = 100; // Maximum search string length
const SUSPICIOUS_PATTERN_THRESHOLD = 10; // Requests to flag as suspicious

export interface LocationSecurityContext {
  ipAddress: string;
  userAgent?: string;
  coordinates: { lat: number; lng: number };
  radius?: number;
  searchText?: string;
  timestamp: number;
}

export interface SecurityViolation {
  type: 'rate_limit' | 'invalid_coordinates' | 'suspicious_pattern' | 'malicious_input' | 'excessive_radius';
  severity: 'low' | 'medium' | 'high';
  description: string;
  context: LocationSecurityContext;
}

/**
 * Comprehensive location request security middleware
 */
export const locationSecurityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const securityContext: LocationSecurityContext = {
      ipAddress: getClientIpAddress(req),
      userAgent: req.headers['user-agent'],
      coordinates: {
        lat: parseFloat(req.query.lat as string),
        lng: parseFloat(req.query.lng as string)
      },
      radius: req.query.radius ? parseFloat(req.query.radius as string) : undefined,
      searchText: req.query.search as string,
      timestamp: Date.now()
    };

    // 1. Rate limiting check
    const rateLimitResult = await checkRateLimit(securityContext.ipAddress);
    if (!rateLimitResult.allowed) {
      await logSecurityViolation({
        type: 'rate_limit',
        severity: 'medium',
        description: `Rate limit exceeded: ${rateLimitResult.requests}/${RATE_LIMIT_MAX_REQUESTS} requests in last minute`,
        context: securityContext
      });

      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateLimitResult.resetTime / 1000)
      });
      return;
    }

    // 2. Coordinate validation and security checks
    const coordinateValidation = validateCoordinates(securityContext.coordinates);
    if (!coordinateValidation.valid) {
      await logSecurityViolation({
        type: 'invalid_coordinates',
        severity: 'low',
        description: coordinateValidation.reason || 'Invalid coordinates',
        context: securityContext
      });

      res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        details: coordinateValidation.reason
      });
      return;
    }

    // 3. Radius validation
    if (securityContext.radius) {
      const radiusValidation = validateRadius(securityContext.radius);
      if (!radiusValidation.valid) {
        await logSecurityViolation({
          type: 'excessive_radius',
          severity: radiusValidation.severity,
          description: radiusValidation.reason || 'Invalid radius',
          context: securityContext
        });

        res.status(400).json({
          success: false,
          error: 'Invalid radius',
          details: radiusValidation.reason
        });
        return;
      }
    }

    // 4. Input sanitization and malicious pattern detection
    if (securityContext.searchText) {
      const inputValidation = validateSearchInput(securityContext.searchText);
      if (!inputValidation.valid) {
        await logSecurityViolation({
          type: 'malicious_input',
          severity: inputValidation.severity,
          description: inputValidation.reason || 'Malicious input detected',
          context: securityContext
        });

        res.status(400).json({
          success: false,
          error: 'Invalid search input',
          details: 'Search text contains invalid characters'
        });
        return;
      }

      // Sanitize the search input
      req.query.search = sanitizeSearchInput(securityContext.searchText);
    }

    // 5. Suspicious behavior pattern detection
    const behaviorCheck = await checkSuspiciousBehavior(securityContext);
    if (behaviorCheck.suspicious) {
      await logSecurityViolation({
        type: 'suspicious_pattern',
        severity: 'medium',
        description: behaviorCheck.reason || 'Suspicious behavior detected',
        context: securityContext
      });

      // Don't block, but log for monitoring
      console.warn('Suspicious location request pattern detected:', {
        ip: securityContext.ipAddress,
        reason: behaviorCheck.reason
      });
    }

    // Add security context to request for downstream use
    (req as any).securityContext = securityContext;

    next();
  } catch (error) {
    console.error('Location security middleware error:', error);
    
    // Don't block requests due to security middleware errors
    next();
  }
};

/**
 * Rate limiting for location requests
 */
async function checkRateLimit(ipAddress: string): Promise<{
  allowed: boolean;
  requests: number;
  resetTime: number;
}> {
  if (!redisClient.isReady) {
    return { allowed: true, requests: 0, resetTime: 0 };
  }

  const key = `${RATE_LIMIT_PREFIX}:${ipAddress}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  try {
    // Remove expired entries
    await redisClient.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const requestCount = await redisClient.zcard(key);
    
    if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      const resetTime = await redisClient.zrange(key, 0, 0, 'WITHSCORES');
      const oldestRequest = resetTime.length > 1 ? parseInt(resetTime[1]) : now;
      
      return {
        allowed: false,
        requests: requestCount,
        resetTime: oldestRequest + RATE_LIMIT_WINDOW
      };
    }

    // Add current request
    await redisClient.zadd(key, now, `${now}-${Math.random()}`);
    await redisClient.expire(key, Math.ceil(RATE_LIMIT_WINDOW / 1000));

    return {
      allowed: true,
      requests: requestCount + 1,
      resetTime: 0
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, requests: 0, resetTime: 0 };
  }
}

/**
 * Validate coordinate security and reasonableness
 */
function validateCoordinates(coordinates: { lat: number; lng: number }): {
  valid: boolean;
  reason?: string;
} {
  const { lat, lng } = coordinates;

  // Check for NaN or undefined
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, reason: 'Coordinates must be valid numbers' };
  }

  // Check coordinate ranges
  if (lat < -90 || lat > 90) {
    return { valid: false, reason: 'Latitude must be between -90 and 90' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, reason: 'Longitude must be between -180 and 180' };
  }

  // Check for suspicious precision (potential bot/scraping behavior)
  const latDecimalPlaces = getDecimalPlaces(lat);
  const lngDecimalPlaces = getDecimalPlaces(lng);
  
  if (latDecimalPlaces > 10 || lngDecimalPlaces > 10) {
    return { valid: false, reason: 'Excessive coordinate precision detected' };
  }

  // Check for common invalid coordinates
  if (lat === 0 && lng === 0) {
    return { valid: false, reason: 'Null island coordinates not allowed' };
  }

  return { valid: true };
}

/**
 * Validate search radius
 */
function validateRadius(radius: number): {
  valid: boolean;
  severity: 'low' | 'medium' | 'high';
  reason?: string;
} {
  if (isNaN(radius) || radius <= 0) {
    return { 
      valid: false, 
      severity: 'low',
      reason: 'Radius must be a positive number' 
    };
  }

  if (radius < MIN_RADIUS_KM) {
    return { 
      valid: false, 
      severity: 'low',
      reason: `Radius must be at least ${MIN_RADIUS_KM} km` 
    };
  }

  if (radius > MAX_RADIUS_KM) {
    return { 
      valid: false, 
      severity: radius > 1000 ? 'high' : 'medium',
      reason: `Radius cannot exceed ${MAX_RADIUS_KM} km` 
    };
  }

  return { valid: true, severity: 'low' };
}

/**
 * Validate and detect malicious search input
 */
function validateSearchInput(searchText: string): {
  valid: boolean;
  severity: 'low' | 'medium' | 'high';
  reason?: string;
} {
  if (!searchText || typeof searchText !== 'string') {
    return { valid: true, severity: 'low' };
  }

  // Check length
  if (searchText.length > MAX_SEARCH_LENGTH) {
    return { 
      valid: false, 
      severity: 'low',
      reason: `Search text cannot exceed ${MAX_SEARCH_LENGTH} characters` 
    };
  }

  // SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /('|('')|;|--|\/\*|\*\/)/i,
    /((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(searchText)) {
      return { 
        valid: false, 
        severity: 'high',
        reason: 'Potential SQL injection detected' 
      };
    }
  }

  // XSS patterns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(searchText)) {
      return { 
        valid: false, 
        severity: 'high',
        reason: 'Potential XSS attack detected' 
      };
    }
  }

  // Command injection patterns
  const commandPatterns = [
    /[;&|`$(){}[\]]/,
    /\b(rm|mkdir|cp|mv|cat|echo|wget|curl|nc|netcat)\b/i
  ];

  for (const pattern of commandPatterns) {
    if (pattern.test(searchText)) {
      return { 
        valid: false, 
        severity: 'medium',
        reason: 'Potential command injection detected' 
      };
    }
  }

  return { valid: true, severity: 'low' };
}

/**
 * Sanitize search input
 */
function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim()
    .substring(0, MAX_SEARCH_LENGTH); // Ensure length limit
}

/**
 * Check for suspicious behavior patterns
 */
async function checkSuspiciousBehavior(context: LocationSecurityContext): Promise<{
  suspicious: boolean;
  reason?: string;
}> {
  if (!redisClient.isReady) {
    return { suspicious: false };
  }

  const { ipAddress, coordinates } = context;
  const behaviorKey = `location_behavior:${ipAddress}`;
  const now = Date.now();
  const windowStart = now - (5 * 60 * 1000); // 5 minute window

  try {
    // Track coordinate requests from this IP
    await redisClient.zadd(
      behaviorKey,
      now,
      JSON.stringify({ lat: coordinates.lat, lng: coordinates.lng, timestamp: now })
    );
    
    // Remove old entries
    await redisClient.zremrangebyscore(behaviorKey, 0, windowStart);
    await redisClient.expire(behaviorKey, 300); // 5 minutes

    // Get recent requests
    const recentRequests = await redisClient.zrange(behaviorKey, 0, -1);
    
    if (recentRequests.length > SUSPICIOUS_PATTERN_THRESHOLD) {
      const coordinates = recentRequests.map(req => {
        try {
          return JSON.parse(req);
        } catch {
          return null;
        }
      }).filter(Boolean);

      // Check for patterns that indicate bot/scraping behavior
      
      // 1. Too many requests from same location
      const locationCounts = new Map();
      coordinates.forEach(coord => {
        const key = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
        locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
      });

      const maxLocationCount = Math.max(...Array.from(locationCounts.values()));
      if (maxLocationCount > 5) {
        return { 
          suspicious: true, 
          reason: `Too many requests from same location: ${maxLocationCount}` 
        };
      }

      // 2. Grid-like search patterns (systematic scraping)
      const sortedCoords = coordinates.sort((a, b) => a.lat - b.lat || a.lng - b.lng);
      let gridLikePattern = 0;
      
      for (let i = 1; i < sortedCoords.length; i++) {
        const latDiff = Math.abs(sortedCoords[i].lat - sortedCoords[i-1].lat);
        const lngDiff = Math.abs(sortedCoords[i].lng - sortedCoords[i-1].lng);
        
        // Check for regular intervals
        if ((latDiff > 0 && latDiff < 0.1) || (lngDiff > 0 && lngDiff < 0.1)) {
          gridLikePattern++;
        }
      }

      if (gridLikePattern > coordinates.length * 0.7) {
        return { 
          suspicious: true, 
          reason: 'Grid-like search pattern detected (potential scraping)' 
        };
      }

      // 3. High frequency requests
      const timeSpans = coordinates.slice(1).map((coord, i) => 
        coord.timestamp - coordinates[i].timestamp
      );
      
      const avgTimeSpan = timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length;
      if (avgTimeSpan < 1000) { // Less than 1 second between requests
        return { 
          suspicious: true, 
          reason: `High frequency requests detected: ${avgTimeSpan.toFixed(0)}ms average` 
        };
      }
    }

    return { suspicious: false };
  } catch (error) {
    console.error('Suspicious behavior check error:', error);
    return { suspicious: false };
  }
}

/**
 * Log security violations for monitoring and analysis
 */
async function logSecurityViolation(violation: SecurityViolation): Promise<void> {
  const logEntry = {
    ...violation,
    timestamp: new Date().toISOString(),
    id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // Log to console
  console.warn('Location Security Violation:', {
    id: logEntry.id,
    type: violation.type,
    severity: violation.severity,
    ip: violation.context.ipAddress,
    coordinates: violation.context.coordinates,
    description: violation.description
  });

  // Store in Redis for analysis
  if (redisClient.isReady) {
    try {
      await Promise.all([
        redisClient.lpush('location_security_violations', JSON.stringify(logEntry)),
        redisClient.ltrim('location_security_violations', 0, 999), // Keep last 1000 violations
        redisClient.expire('location_security_violations', 7 * 24 * 3600) // 7 days
      ]);
    } catch (error) {
      console.error('Failed to store security violation:', error);
    }
  }

  // In production, integrate with security monitoring systems:
  // - SIEM systems
  // - Security alerts
  // - IP blocking services
  // - Threat intelligence feeds
}

/**
 * Get client IP address from request
 */
function getClientIpAddress(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Count decimal places in a number
 */
function getDecimalPlaces(num: number): number {
  if (Math.floor(num) === num) return 0;
  const str = num.toString();
  if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
    return str.split('.')[1].length;
  } else if (str.indexOf('e-') !== -1) {
    const parts = str.split('e-');
    return parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Get security metrics for monitoring
 */
export async function getLocationSecurityMetrics(days: number = 7): Promise<{
  totalViolations: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  topViolatingIPs: Array<{ ip: string; count: number }>;
}> {
  if (!redisClient.isReady) {
    return {
      totalViolations: 0,
      violationsByType: {},
      violationsBySeverity: {},
      topViolatingIPs: []
    };
  }

  try {
    const violations = await redisClient.lrange('location_security_violations', 0, -1);
    const parsed = violations.map(v => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Filter by time window
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentViolations = parsed.filter(v => 
      new Date(v.timestamp).getTime() > cutoff
    );

    const violationsByType: Record<string, number> = {};
    const violationsBySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};

    recentViolations.forEach((violation: any) => {
      violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1;
      violationsBySeverity[violation.severity] = (violationsBySeverity[violation.severity] || 0) + 1;
      ipCounts[violation.context.ipAddress] = (ipCounts[violation.context.ipAddress] || 0) + 1;
    });

    const topViolatingIPs = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      totalViolations: recentViolations.length,
      violationsByType,
      violationsBySeverity,
      topViolatingIPs
    };
  } catch (error) {
    console.error('Failed to get security metrics:', error);
    return {
      totalViolations: 0,
      violationsByType: {},
      violationsBySeverity: {},
      topViolatingIPs: []
    };
  }
}

export default locationSecurityMiddleware;