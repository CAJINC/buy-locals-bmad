import { Response } from 'express';
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    statusCode: number;
    timestamp: string;
}
export declare const successResponse: <T>(res: Response, statusCode?: number, data?: T, message?: string) => Response;
export declare const errorResponse: (res: Response, statusCode?: number, error?: string, details?: string[]) => Response;
export declare const paginatedResponse: <T>(res: Response, data: T[], totalCount: number, page?: number, limit?: number, statusCode?: number) => Response;
//# sourceMappingURL=responseUtils.d.ts.map