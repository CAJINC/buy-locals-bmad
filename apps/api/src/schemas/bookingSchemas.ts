import * as Joi from 'joi';

export const bookingSchema = Joi.object({
  businessId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Business ID must be a valid UUID',
      'any.required': 'Business ID is required'
    }),

  serviceId: Joi.string()
    .max(255)
    .required()
    .messages({
      'string.max': 'Service ID cannot exceed 255 characters',
      'any.required': 'Service ID is required'
    }),

  scheduledAt: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.format': 'Scheduled time must be in ISO format',
      'date.min': 'Scheduled time cannot be in the past',
      'any.required': 'Scheduled time is required'
    }),

  duration: Joi.number()
    .integer()
    .min(15)
    .max(480) // 8 hours max
    .required()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be a whole number of minutes',
      'number.min': 'Duration must be at least 15 minutes',
      'number.max': 'Duration cannot exceed 480 minutes (8 hours)',
      'any.required': 'Duration is required'
    }),

  customerInfo: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Customer name is required'
      }),

    phone: Joi.string()
      .pattern(/^\+?[\d\s-().]+$/)
      .min(10)
      .max(20)
      .required()
      .messages({
        'string.pattern.base': 'Phone number format is invalid',
        'string.min': 'Phone number must be at least 10 characters',
        'string.max': 'Phone number cannot exceed 20 characters',
        'any.required': 'Phone number is required'
      }),

    email: Joi.string()
      .email()
      .max(255)
      .required()
      .messages({
        'string.email': 'Email address format is invalid',
        'string.max': 'Email address cannot exceed 255 characters',
        'any.required': 'Email address is required'
      })
  })
    .required()
    .messages({
      'any.required': 'Customer information is required'
    }),

  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    }),

  totalAmount: Joi.number()
    .precision(2)
    .min(0)
    .max(10000)
    .required()
    .messages({
      'number.base': 'Total amount must be a number',
      'number.precision': 'Total amount can have at most 2 decimal places',
      'number.min': 'Total amount cannot be negative',
      'number.max': 'Total amount cannot exceed $10,000',
      'any.required': 'Total amount is required'
    })
});

export const cancellationSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(500)
    .optional()
    .messages({
      'string.min': 'Cancellation reason must be at least 10 characters if provided',
      'string.max': 'Cancellation reason cannot exceed 500 characters'
    }),

  notifyBusiness: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'Notify business flag must be true or false'
    })
});

export const availabilityQuerySchema = Joi.object({
  date: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.format': 'Date must be in ISO format (YYYY-MM-DD)',
      'date.min': 'Date cannot be in the past',
      'any.required': 'Date is required'
    }),

  serviceId: Joi.string()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Service ID cannot exceed 255 characters'
    }),

  duration: Joi.number()
    .integer()
    .min(15)
    .max(480)
    .optional()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be a whole number of minutes',
      'number.min': 'Duration must be at least 15 minutes',
      'number.max': 'Duration cannot exceed 480 minutes (8 hours)'
    })
});

export const bookingQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, completed, cancelled, no_show'
    }),

  businessId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Business ID must be a valid UUID'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .optional()
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be a whole number',
      'number.min': 'Offset cannot be negative'
    })
});

export const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show')
    .required()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, completed, cancelled, no_show',
      'any.required': 'Status is required'
    }),

  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Reason cannot exceed 500 characters'
    })
});