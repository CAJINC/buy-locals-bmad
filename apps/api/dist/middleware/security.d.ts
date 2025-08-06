import { Request, Response, NextFunction } from 'express';
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare class SuspiciousActivityDetector {
    private static readonly SUSPICIOUS_PREFIX;
    private static readonly BLOCK_PREFIX;
    private static readonly SUSPICIOUS_THRESHOLD;
    private static readonly BLOCK_DURATION;
    static trackActivity(ip: string, activity: string): Promise<{
        isSuspicious: boolean;
        isBlocked: boolean;
    }>;
    static isIPBlocked(ip: string): Promise<boolean>;
    static blockIP(ip: string, reason: string): Promise<void>;
}
export declare const auditLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const passwordComplexity: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    validate(password: string): {
        isValid: boolean;
        errors: string[];
    };
};
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=security.d.ts.map