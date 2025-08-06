import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Buy Locals API',
      version: '1.0.0',
      description: 'Community-driven local business discovery and reservation platform API',
      contact: {
        name: 'Buy Locals Development Team',
        email: 'dev@buylocals.com',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api-staging.buylocals.com',
        description: 'Staging server',
      },
      {
        url: 'https://api.buylocals.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            statusCode: {
              type: 'integer',
              example: 400,
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-05T20:00:00.000Z',
            },
            details: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Validation error details'],
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            role: {
              type: 'string',
              enum: ['consumer', 'business_owner', 'admin'],
              example: 'consumer',
            },
            profile: {
              type: 'object',
              properties: {
                firstName: {
                  type: 'string',
                  example: 'John',
                },
                lastName: {
                  type: 'string',
                  example: 'Doe',
                },
                phone: {
                  type: 'string',
                  example: '+1234567890',
                },
                locationPreferences: {
                  type: 'object',
                  properties: {
                    city: {
                      type: 'string',
                      example: 'San Francisco',
                    },
                    state: {
                      type: 'string',
                      example: 'CA',
                    },
                  },
                },
              },
            },
            is_email_verified: {
              type: 'boolean',
              example: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-05T20:00:00.000Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-05T20:00:00.000Z',
            },
          },
        },
        Business: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            owner_id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            name: {
              type: 'string',
              example: 'Local Coffee House',
            },
            description: {
              type: 'string',
              example: 'Artisanal coffee and pastries in the heart of downtown',
            },
            location: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  example: '123 Main St',
                },
                city: {
                  type: 'string',
                  example: 'San Francisco',
                },
                state: {
                  type: 'string',
                  example: 'CA',
                },
                zipCode: {
                  type: 'string',
                  example: '94102',
                },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: {
                      type: 'number',
                      example: 37.7749,
                    },
                    lng: {
                      type: 'number',
                      example: -122.4194,
                    },
                  },
                },
              },
            },
            categories: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['coffee', 'restaurant', 'bakery'],
            },
            hours: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  open: {
                    type: 'string',
                    example: '09:00',
                  },
                  close: {
                    type: 'string',
                    example: '17:00',
                  },
                  closed: {
                    type: 'boolean',
                    example: false,
                  },
                },
              },
            },
            contact: {
              type: 'object',
              properties: {
                phone: {
                  type: 'string',
                  example: '+14155551234',
                },
                email: {
                  type: 'string',
                  example: 'info@business.com',
                },
                website: {
                  type: 'string',
                  example: 'https://business.com',
                },
              },
            },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'Haircut',
                  },
                  description: {
                    type: 'string',
                    example: 'Professional haircut service',
                  },
                  price: {
                    type: 'number',
                    example: 35.00,
                  },
                  duration: {
                    type: 'integer',
                    example: 30,
                  },
                },
              },
            },
            is_active: {
              type: 'boolean',
              example: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-05T20:00:00.000Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-05T20:00:00.000Z',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/schemas/*.ts',
  ],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Only enable Swagger in development and staging
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Buy Locals API Documentation',
    }));

    console.log(`📚 API Documentation available at: http://localhost:${process.env.PORT || 3000}/api-docs`);
  }
};

export default specs;