import { Request, Response, NextFunction } from 'express';
export interface CognitoAuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        emailVerified: boolean;
    };
}
export declare const authenticateCognito: (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const requireRole: (allowedRoles: string[]) => (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const requireConsumer: (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const requireBusinessOwner: (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const requireAdmin: (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const requireConsumerOrBusinessOwner: (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=cognitoAuth.d.ts.map