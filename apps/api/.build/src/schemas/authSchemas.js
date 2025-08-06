import Joi from 'joi';
const passwordSchema = Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])?/)
    .required()
    .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
});
const phoneSchema = Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .min(10)
    .max(20)
    .optional()
    .messages({
    'string.pattern.base': 'Phone number format is invalid',
    'string.min': 'Phone number must be at least 10 digits',
    'string.max': 'Phone number cannot exceed 20 characters'
});
export const registerSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .max(255)
        .required()
        .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email cannot exceed 255 characters'
    }),
    password: passwordSchema,
    firstName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .required()
        .messages({
        'string.min': 'First name is required',
        'string.max': 'First name cannot exceed 50 characters',
        'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }),
    lastName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .required()
        .messages({
        'string.min': 'Last name is required',
        'string.max': 'Last name cannot exceed 50 characters',
        'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }),
    phone: phoneSchema,
    role: Joi.string()
        .valid('consumer', 'business_owner')
        .default('consumer')
        .messages({
        'any.only': 'Role must be either consumer or business_owner'
    }),
});
export const loginSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
        'string.email': 'Please provide a valid email address'
    }),
    password: Joi.string()
        .min(1)
        .required()
        .messages({
        'string.min': 'Password is required'
    }),
});
export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string()
        .required()
        .messages({
        'string.empty': 'Refresh token is required'
    }),
});
export const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
        'string.email': 'Please provide a valid email address'
    }),
});
export const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
        'string.empty': 'Reset token is required'
    }),
    newPassword: passwordSchema.label('New password'),
});
export const updateProfileSchema = Joi.object({
    firstName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .optional()
        .messages({
        'string.min': 'First name cannot be empty',
        'string.max': 'First name cannot exceed 50 characters',
        'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }),
    lastName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .optional()
        .messages({
        'string.min': 'Last name cannot be empty',
        'string.max': 'Last name cannot exceed 50 characters',
        'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }),
    phone: phoneSchema,
    locationPreferences: Joi.object({
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .required()
            .messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90'
        }),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .required()
            .messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180'
        }),
        radius: Joi.number()
            .min(1)
            .max(500)
            .default(25)
            .messages({
            'number.min': 'Radius must be at least 1 km',
            'number.max': 'Radius cannot exceed 500 km'
        }),
    }).optional(),
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
//# sourceMappingURL=authSchemas.js.map