import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateBody: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateQuery: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateParams: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validationErrorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map