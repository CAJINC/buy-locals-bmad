import Joi from 'joi';
import { getAllCategories } from '../constants/businessCategories.js';

const locationSchema = Joi.object({
  address: Joi.string().min(5).max(255).required().messages({
    'any.required': 'Street address is required',
    'string.min': 'Address must be at least 5 characters long',
    'string.max': 'Address cannot exceed 255 characters',
  }),
  city: Joi.string().min(2).max(100).required().messages({
    'any.required': 'City is required',
    'string.min': 'City must be at least 2 characters long',
    'string.max': 'City cannot exceed 100 characters',
  }),
  state: Joi.string().length(2).uppercase().required().messages({
    'any.required': 'State is required',
    'string.length': 'State must be a 2-letter abbreviation (e.g., NY, CA)',
  }),
  zipCode: Joi.string()
    .pattern(/^\d{5}(-\d{4})?$/)
    .required()
    .messages({
      'any.required': 'ZIP code is required',
      'string.pattern.base': 'ZIP code must be in format 12345 or 12345-6789',
    }),
  country: Joi.string().length(2).uppercase().default('US').messages({
    'string.length': 'Country must be a 2-letter code (e.g., US, CA)',
  }),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required().messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
    }),
  }).optional(),
});

const hoursSchema = Joi.object()
  .pattern(
    Joi.string().valid(
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ),
    Joi.object({
      open: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional()
        .messages({
          'string.pattern.base': 'Opening time must be in HH:MM format (e.g., 09:00, 17:30)',
        }),
      close: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional()
        .messages({
          'string.pattern.base': 'Closing time must be in HH:MM format (e.g., 09:00, 17:30)',
        }),
      closed: Joi.boolean().optional(),
    })
      .or('open', 'closed')
      .and('open', 'close')
      .messages({
        'object.missing':
          'Each day must specify either opening/closing times or be marked as closed',
        'object.and': 'If open time is specified, close time is also required',
      })
  )
  .custom((value, helpers) => {
    // Validate business hours logic
    for (const [day, hours] of Object.entries(value)) {
      if (hours.open && hours.close) {
        const openTime = hours.open.split(':').map(Number);
        const closeTime = hours.close.split(':').map(Number);
        const openMinutes = openTime[0] * 60 + openTime[1];
        const closeMinutes = closeTime[0] * 60 + closeTime[1];

        // Allow closing after midnight (e.g., 22:00 to 02:00)
        // Only flag as error if opening and closing are the same time
        if (openMinutes === closeMinutes) {
          return helpers.error('custom.sameTime', { day });
        }

        // Warn about very short operating hours (less than 1 hour, unless crossing midnight)
        if (openMinutes < closeMinutes && closeMinutes - openMinutes < 60) {
          // This is just a validation warning, not an error - allow it
        }
      }
    }
    return value;
  })
  .messages({
    'custom.sameTime': 'Opening and closing times cannot be the same for {{#day}}',
  });

const contactSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/)
    .optional()
    .messages({
      'string.pattern.base':
        'Please provide a valid US phone number (e.g., (555) 123-4567, 555-123-4567)',
    }),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(254)
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address cannot exceed 254 characters',
    }),
  website: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .optional()
    .custom((value, _helpers) => {
      // Normalize website URL to include protocol
      if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
        return `https://${value}`;
      }
      return value;
    })
    .messages({
      'string.uri': 'Please provide a valid website URL (e.g., https://example.com)',
      'string.max': 'Website URL cannot exceed 2048 characters',
    }),
});

const serviceSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': 'Service name is required',
  }),
  description: Joi.string().optional(),
  price: Joi.number().min(0).required().messages({
    'number.min': 'Price must be a positive number',
    'any.required': 'Price is required',
  }),
  duration: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Duration must be at least 1 minute',
  }),
  isActive: Joi.boolean().optional(),
});

export const createBusinessSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Business name cannot be empty',
    'string.max': 'Business name cannot exceed 255 characters',
    'any.required': 'Business name is required',
  }),
  description: Joi.string().max(2000).optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),
  location: locationSchema.required(),
  categories: Joi.array()
    .items(
      Joi.string()
        .valid(...getAllCategories())
        .messages({
          'any.only': 'Category must be one of the predefined business categories',
        })
    )
    .min(1)
    .max(3)
    .unique()
    .required()
    .messages({
      'array.min': 'At least one category is required',
      'array.max': 'Maximum 3 categories allowed',
      'array.unique': 'Categories must be unique',
      'any.required': 'Categories are required',
    }),
  hours: hoursSchema.required(),
  contact: contactSchema.required(),
  services: Joi.array().items(serviceSchema).optional(),
});

export const updateBusinessSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional().messages({
    'string.min': 'Business name cannot be empty',
    'string.max': 'Business name cannot exceed 255 characters',
  }),
  description: Joi.string().max(2000).optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),
  location: locationSchema.optional(),
  categories: Joi.array()
    .items(
      Joi.string()
        .valid(...getAllCategories())
        .messages({
          'any.only': 'Category must be one of the predefined business categories',
        })
    )
    .min(1)
    .max(3)
    .unique()
    .optional()
    .messages({
      'array.min': 'At least one category is required',
      'array.max': 'Maximum 3 categories allowed',
      'array.unique': 'Categories must be unique',
    }),
  hours: hoursSchema.optional(),
  contact: contactSchema.optional(),
  services: Joi.array().items(serviceSchema).optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

export const businessSearchSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).default(25).optional(),
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(50).default(10).optional(),
});

export const businessIdParamSchema = Joi.object({
  businessId: Joi.string().uuid().required().messages({
    'string.uuid': 'Business ID must be a valid UUID',
    'any.required': 'Business ID is required',
  }),
});

export const categoryQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10).optional(),
});

export const businessMediaUploadSchema = Joi.object({
  media: Joi.array().items(Joi.string().uri()).max(10).required().messages({
    'array.max': 'Maximum 10 media items allowed',
    'string.uri': 'Each media item must be a valid URL',
    'any.required': 'Media array is required',
  }),
});
