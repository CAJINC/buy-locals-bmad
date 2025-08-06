import Joi from 'joi';

export const createUserSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  role: Joi.string().valid('consumer', 'business_owner', 'admin').required().messages({
    'any.only': 'Role must be one of: consumer, business_owner, admin',
    'any.required': 'Role is required',
  }),
  firstName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required',
  }),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number',
  }),
  locationPreferences: Joi.object({
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
  }).optional(),
});

export const updateUserProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  lastName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name cannot exceed 50 characters',
  }),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number',
  }),
  locationPreferences: Joi.object({
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
  }).optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  role: Joi.string().valid('consumer', 'business_owner', 'admin').optional(),
});

export const userIdParamSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
});

export const updatePasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
});