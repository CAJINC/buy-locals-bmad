import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { ApiError } from './errorHandler.js';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const validationError: ApiError = new Error('Validation failed') as ApiError;
      validationError.statusCode = 400;
      validationError.isOperational = true;
      validationError.details = error.details.map(detail => detail.message);
      return next(validationError);
    }
    
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const validationError: ApiError = new Error('Validation failed') as ApiError;
      validationError.statusCode = 400;
      validationError.isOperational = true;
      validationError.details = error.details.map(detail => detail.message);
      return next(validationError);
    }
    
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      const validationError: ApiError = new Error('Validation failed') as ApiError;
      validationError.statusCode = 400;
      validationError.isOperational = true;
      validationError.details = error.details.map(detail => detail.message);
      return next(validationError);
    }
    
    next();
  };
};


export const validationErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Handle Joi validation errors specifically
  if (err.isJoi) {
    const validationError: ApiError = new Error('Validation failed') as ApiError;
    validationError.statusCode = 400;
    validationError.isOperational = true;
    validationError.details = err.details.map((detail: any) => detail.message);
    return next(validationError);
  }
  
  next(err);
};