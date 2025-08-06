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
  lat: Joi.number().min(-90).max(90).optional().messages({
    'number.min': 'Latitude must be between -90 and 90 degrees',
    'number.max': 'Latitude must be between -90 and 90 degrees',
  }),
  lng: Joi.number().min(-180).max(180).optional().messages({
    'number.min': 'Longitude must be between -180 and 180 degrees',
    'number.max': 'Longitude must be between -180 and 180 degrees',
  }),
  radius: Joi.number().min(1).max(100).default(25).optional().messages({
    'number.min': 'Search radius must be at least 1 km',
    'number.max': 'Search radius cannot exceed 100 km',
  }),
  includeSubcategories: Joi.boolean().default(true).optional(),
  includeCounts: Joi.boolean().default(true).optional(),
  limit: Joi.number().integer().min(1).max(50).default(20).optional().messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 50',
  }),
}).and('lat', 'lng').messages({
  'object.and': 'Both latitude and longitude are required when using location-based filtering',
});

export const businessMediaUploadSchema = Joi.object({
  media: Joi.array().items(Joi.string().uri()).max(10).required().messages({
    'array.max': 'Maximum 10 media items allowed',
    'string.uri': 'Each media item must be a valid URL',
    'any.required': 'Media array is required',
  }),
});

// Location Search Validation Schemas
export const locationSearchSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    'any.required': 'Latitude is required for location search',
    'number.min': 'Latitude must be between -90 and 90 degrees',
    'number.max': 'Latitude must be between -90 and 90 degrees',
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    'any.required': 'Longitude is required for location search', 
    'number.min': 'Longitude must be between -180 and 180 degrees',
    'number.max': 'Longitude must be between -180 and 180 degrees',
  }),
  radius: Joi.number().min(0.1).max(100).default(25).optional().messages({
    'number.min': 'Search radius must be at least 0.1 km',
    'number.max': 'Search radius cannot exceed 100 km',
  }),
  category: Joi.alternatives().try(
    // Single category (backward compatibility)
    Joi.string()
      .valid(...getAllCategories())
      .messages({
        'any.only': 'Category must be one of the predefined business categories',
      }),
    // Multiple categories with OR logic
    Joi.array()
      .items(
        Joi.string()
          .valid(...getAllCategories())
          .messages({
            'any.only': 'Category must be one of the predefined business categories',
          })
      )
      .max(5)
      .unique()
      .messages({
        'array.max': 'Maximum 5 categories can be selected for filtering',
        'array.unique': 'Categories must be unique',
      })
  ).optional(),
  search: Joi.string().max(100).optional().messages({
    'string.max': 'Search query cannot exceed 100 characters',
  }),
  page: Joi.number().integer().min(1).max(100).default(1).optional().messages({
    'number.min': 'Page number must be at least 1',
    'number.max': 'Page number cannot exceed 100',
  }),
  limit: Joi.number().integer().min(1).max(50).default(10).optional().messages({
    'number.min': 'Results limit must be at least 1',
    'number.max': 'Results limit cannot exceed 50',
  }),
  sortBy: Joi.string().valid('distance', 'rating', 'newest').default('distance').optional().messages({
    'any.only': 'Sort criteria must be one of: distance, rating, newest',
  }),
  priceRange: Joi.array().ordered(
    Joi.number().min(0).max(10000),
    Joi.number().min(0).max(10000)
  ).optional().custom((value, helpers) => {
    if (value && value.length === 2 && value[0] > value[1]) {
      return helpers.error('priceRange.invalid');
    }
    return value;
  }).messages({
    'priceRange.invalid': 'Price range minimum cannot be greater than maximum',
  }),
  amenities: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .unique()
    .optional()
    .messages({
      'array.max': 'Maximum 10 amenities can be selected',
      'string.max': 'Amenity name cannot exceed 50 characters',
    }),
  isOpen: Joi.boolean().optional(),
});

// Advanced Location Search Schema with category analytics
export const advancedLocationSearchSchema = locationSearchSchema.keys({
  sortBy: Joi.string().valid('distance', 'rating', 'newest', 'popular', 'price').default('distance').optional(),
  rating: Joi.number().min(0).max(5).optional().messages({
    'number.min': 'Rating filter must be at least 0',
    'number.max': 'Rating filter cannot exceed 5',
  }),
  verified: Joi.boolean().optional(),
  maxDistance: Joi.number().min(0.1).max(radius || 100).optional().messages({
    'number.min': 'Maximum distance must be at least 0.1 km',
    'number.max': 'Maximum distance cannot exceed search radius',
  }),
  includeCategoryStats: Joi.boolean().default(false).optional(),
  categoryPopularity: Joi.boolean().default(false).optional(),
});

// Category Analytics Schema
export const categoryAnalyticsSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).default(25).optional(),
  timeframe: Joi.string().valid('24h', '7d', '30d').default('7d').optional(),
  categories: Joi.array()
    .items(Joi.string().valid(...getAllCategories()))
    .max(10)
    .unique()
    .optional(),
}).and('lat', 'lng').messages({
  'object.and': 'Both latitude and longitude are required for location-based analytics',
});

// Category Interaction Tracking Schema
export const categoryInteractionSchema = Joi.object({
  category: Joi.string()
    .valid(...getAllCategories())
    .required()
    .messages({
      'any.only': 'Category must be one of the predefined business categories',
      'any.required': 'Category is required for interaction tracking',
    }),
  interactionType: Joi.string()
    .valid('search', 'click', 'conversion')
    .required()
    .messages({
      'any.only': 'Interaction type must be one of: search, click, conversion',
      'any.required': 'Interaction type is required',
    }),
  metadata: Joi.object({
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).optional(),
    searchQuery: Joi.string().max(200).optional(),
    businessId: Joi.string().uuid().optional(),
    sessionId: Joi.string().max(100).optional(),
  }).optional(),
});

// Trending Categories Schema
export const trendingCategoriesSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).default(25).optional(),
  limit: Joi.number().integer().min(1).max(20).default(10).optional(),
  timeframe: Joi.string().valid('24h', '7d', '30d').default('24h').optional(),
}).and('lat', 'lng').messages({
  'object.and': 'Both latitude and longitude are required for location-based trending analysis',
});

// Business Density Analysis Schema
export const businessDensitySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(1).max(50).default(25).optional().messages({
    'number.min': 'Analysis radius must be at least 1 km',
    'number.max': 'Analysis radius cannot exceed 50 km',
  }),
  gridSize: Joi.number().min(0.1).max(5).default(1.0).optional().messages({
    'number.min': 'Grid size must be at least 0.1 km',
    'number.max': 'Grid size cannot exceed 5 km',
  }),
});

// Cache Invalidation Schema
export const cacheInvalidationSchema = Joi.object({
  businessId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Business ID must be a valid UUID',
  }),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).optional(),
}).or('businessId', 'coordinates').messages({
  'object.missing': 'Either business ID or coordinates must be provided',
});

// Route Parameters Schema
export const nearestBusinessesParamSchema = Joi.object({
  count: Joi.number().integer().min(1).max(20).required().messages({
    'number.min': 'Count must be at least 1',
    'number.max': 'Count cannot exceed 20 for performance reasons',
    'any.required': 'Count parameter is required',
  }),
});

// Performance and Analytics Schemas
export const performanceThresholds = {
  EXCELLENT: 200, // ms
  GOOD: 500,      // ms 
  ACCEPTABLE: 1000, // ms
  POOR: 2000,     // ms
};

// Custom error types for location search
export enum LocationSearchErrorType {
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  RADIUS_TOO_LARGE = 'RADIUS_TOO_LARGE',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',
  NO_RESULTS_FOUND = 'NO_RESULTS_FOUND',
  CACHE_ERROR = 'CACHE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_CATEGORY = 'INVALID_CATEGORY',
  PERFORMANCE_DEGRADED = 'PERFORMANCE_DEGRADED',
}

export class LocationSearchError extends Error {
  public type: LocationSearchErrorType;
  public statusCode: number;
  public metadata?: any;

  constructor(
    type: LocationSearchErrorType,
    message: string,
    statusCode: number = 400,
    metadata?: any
  ) {
    super(message);
    this.name = 'LocationSearchError';
    this.type = type;
    this.statusCode = statusCode;
    this.metadata = metadata;
    
    // Maintain proper stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LocationSearchError);
    }
  }
}

// Error handler mapping
export const locationSearchErrorMap = {
  [LocationSearchErrorType.INVALID_COORDINATES]: {
    message: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
    statusCode: 400,
  },
  [LocationSearchErrorType.RADIUS_TOO_LARGE]: {
    message: 'Search radius exceeds maximum allowed limit of 100 km.',
    statusCode: 400,
  },
  [LocationSearchErrorType.SEARCH_TIMEOUT]: {
    message: 'Location search request timed out. Please try again with a smaller search area.',
    statusCode: 408,
  },
  [LocationSearchErrorType.NO_RESULTS_FOUND]: {
    message: 'No businesses found within the specified search criteria.',
    statusCode: 404,
  },
  [LocationSearchErrorType.CACHE_ERROR]: {
    message: 'Temporary caching error. Results may be slower than usual.',
    statusCode: 500,
  },
  [LocationSearchErrorType.DATABASE_ERROR]: {
    message: 'Database error occurred during location search.',
    statusCode: 500,
  },
  [LocationSearchErrorType.RATE_LIMIT_EXCEEDED]: {
    message: 'Too many search requests. Please wait before making another search.',
    statusCode: 429,
  },
  [LocationSearchErrorType.INVALID_CATEGORY]: {
    message: 'One or more specified categories are invalid.',
    statusCode: 400,
  },
  [LocationSearchErrorType.PERFORMANCE_DEGRADED]: {
    message: 'Search performance temporarily degraded. Results may be incomplete.',
    statusCode: 200, // Still return results but warn user
  },
};

// Advanced Filtering Schema
export const advancedFilterSchema = Joi.object({
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(0.1).max(100).default(25).optional(),
  }).optional(),
  
  categories: Joi.array()
    .items(Joi.string().valid(...getAllCategories()))
    .max(10)
    .unique()
    .optional(),
    
  includeSubcategories: Joi.boolean().default(true).optional(),
  
  search: Joi.string().max(200).optional(),
  
  priceRange: Joi.object({
    min: Joi.number().min(0).max(10000).optional(),
    max: Joi.number().min(0).max(10000).optional(),
  }).optional(),
  
  minRating: Joi.number().min(0).max(5).optional(),
  
  businessHours: Joi.object({
    openNow: Joi.boolean().optional(),
    is24x7: Joi.boolean().optional(),
    specificHours: Joi.object({
      day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
      startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    }).optional(),
  }).optional(),
  
  maxDistance: Joi.number().min(0.1).max(100).optional(),
  
  hasPhotos: Joi.boolean().optional(),
  minReviewCount: Joi.number().min(0).optional(),
  recentlyAdded: Joi.boolean().optional(),
  verifiedOnly: Joi.boolean().optional(),
  
  sortBy: Joi.string().valid('distance', 'rating', 'price', 'newest', 'popularity', 'reviewCount').default('distance').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc').optional(),
  
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
});

// Filter Preset Schema
export const filterPresetSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  filters: advancedFilterSchema.required(),
});

// Availability Settings Schemas
export const businessHoursForDaySchema = Joi.object({
  isOpen: Joi.boolean().required(),
  open: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .when('isOpen', { is: true, then: Joi.required(), otherwise: Joi.optional() })
    .messages({
      'string.pattern.base': 'Time must be in HH:mm format (e.g., 09:30)',
    }),
  close: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .when('isOpen', { is: true, then: Joi.required(), otherwise: Joi.optional() })
    .messages({
      'string.pattern.base': 'Time must be in HH:mm format (e.g., 17:30)',
    }),
  breaks: Joi.array()
    .items(
      Joi.object({
        start: Joi.string()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': 'Break start time must be in HH:mm format',
          }),
        end: Joi.string()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': 'Break end time must be in HH:mm format',
          }),
      })
    )
    .optional(),
});

export const serviceAvailabilitySchema = Joi.object({
  id: Joi.string().optional(), // Auto-generated if not provided
  name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Service name is required',
    'string.max': 'Service name cannot exceed 255 characters',
    'any.required': 'Service name is required',
  }),
  duration: Joi.number().integer().min(15).max(480).required().messages({
    'number.base': 'Duration must be a number',
    'number.integer': 'Duration must be a whole number of minutes',
    'number.min': 'Service duration must be at least 15 minutes',
    'number.max': 'Service duration cannot exceed 480 minutes (8 hours)',
    'any.required': 'Service duration is required',
  }),
  bufferTime: Joi.number().integer().min(0).max(120).default(15).messages({
    'number.base': 'Buffer time must be a number',
    'number.integer': 'Buffer time must be a whole number of minutes',
    'number.min': 'Buffer time cannot be negative',
    'number.max': 'Buffer time cannot exceed 120 minutes',
  }),
  price: Joi.number().min(0).max(10000).optional().messages({
    'number.base': 'Price must be a number',
    'number.min': 'Price cannot be negative',
    'number.max': 'Price cannot exceed $10,000',
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': 'Service description cannot exceed 1000 characters',
  }),
  isActive: Joi.boolean().default(true),
  maxBookingsPerDay: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'Max bookings per day must be a number',
    'number.integer': 'Max bookings per day must be a whole number',
    'number.min': 'Max bookings per day must be at least 1',
    'number.max': 'Max bookings per day cannot exceed 100',
  }),
  advanceBookingDays: Joi.number().integer().min(1).max(365).optional().messages({
    'number.base': 'Advance booking days must be a number',
    'number.integer': 'Advance booking days must be a whole number',
    'number.min': 'Advance booking days must be at least 1',
    'number.max': 'Advance booking days cannot exceed 365',
  }),
  cancellationHours: Joi.number().integer().min(0).max(168).optional().messages({
    'number.base': 'Cancellation hours must be a number',
    'number.integer': 'Cancellation hours must be a whole number',
    'number.min': 'Cancellation hours cannot be negative',
    'number.max': 'Cancellation hours cannot exceed 168 (1 week)',
  }),
});

export const specialHoursSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format',
      'any.required': 'Date is required',
    }),
  hours: Joi.object({
    isOpen: Joi.boolean().required(),
    open: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .when('isOpen', { is: true, then: Joi.required(), otherwise: Joi.optional() })
      .messages({
        'string.pattern.base': 'Open time must be in HH:mm format',
      }),
    close: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .when('isOpen', { is: true, then: Joi.required(), otherwise: Joi.optional() })
      .messages({
        'string.pattern.base': 'Close time must be in HH:mm format',
      }),
  }).required(),
  reason: Joi.string().max(255).optional().messages({
    'string.max': 'Reason cannot exceed 255 characters',
  }),
});

export const bookingSettingsSchema = Joi.object({
  minAdvanceBookingHours: Joi.number().integer().min(0).max(168).default(2).messages({
    'number.base': 'Min advance booking hours must be a number',
    'number.integer': 'Min advance booking hours must be a whole number',
    'number.min': 'Min advance booking hours cannot be negative',
    'number.max': 'Min advance booking hours cannot exceed 168 (1 week)',
  }),
  maxAdvanceBookingDays: Joi.number().integer().min(1).max(365).default(90).messages({
    'number.base': 'Max advance booking days must be a number',
    'number.integer': 'Max advance booking days must be a whole number',
    'number.min': 'Max advance booking days must be at least 1',
    'number.max': 'Max advance booking days cannot exceed 365',
  }),
  defaultServiceDuration: Joi.number().integer().min(15).max(480).default(60).messages({
    'number.base': 'Default service duration must be a number',
    'number.integer': 'Default service duration must be a whole number',
    'number.min': 'Default service duration must be at least 15 minutes',
    'number.max': 'Default service duration cannot exceed 480 minutes',
  }),
  defaultBufferTime: Joi.number().integer().min(0).max(120).default(15).messages({
    'number.base': 'Default buffer time must be a number',
    'number.integer': 'Default buffer time must be a whole number',
    'number.min': 'Default buffer time cannot be negative',
    'number.max': 'Default buffer time cannot exceed 120 minutes',
  }),
  allowOnlineBooking: Joi.boolean().default(true),
  requireApproval: Joi.boolean().default(false),
  autoConfirm: Joi.boolean().default(true),
});

export const availabilitySettingsSchema = Joi.object({
  businessHours: Joi.object()
    .pattern(
      Joi.number().integer().min(0).max(6), // Day of week (0=Sunday, 6=Saturday)
      businessHoursForDaySchema
    )
    .optional(),
  services: Joi.array().items(serviceAvailabilitySchema).max(20).optional().messages({
    'array.max': 'Maximum 20 services can be configured',
  }),
  holidayDates: Joi.array()
    .items(
      Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .messages({
          'string.pattern.base': 'Holiday dates must be in YYYY-MM-DD format',
        })
    )
    .max(50)
    .unique()
    .optional()
    .messages({
      'array.max': 'Maximum 50 holiday dates can be configured',
      'array.unique': 'Holiday dates must be unique',
    }),
  specialHours: Joi.array().items(specialHoursSchema).max(100).optional().messages({
    'array.max': 'Maximum 100 special hours entries can be configured',
  }),
  bookingSettings: bookingSettingsSchema.optional(),
  timezone: Joi.string()
    .valid(
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney'
    )
    .default('America/New_York')
    .optional()
    .messages({
      'any.only': 'Timezone must be a valid timezone identifier',
    }),
});
