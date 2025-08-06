# API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Buy Locals API
  version: 1.0.0
  description: Community-driven local business marketplace API
servers:
  - url: https://api.buylocals.com/v1
    description: Production server
  - url: https://staging-api.buylocals.com/v1
    description: Staging server

paths:
  /auth/register:
    post:
      summary: Register new user account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                role:
                  type: string
                  enum: [consumer, business_owner]
                profile:
                  type: object
                  properties:
                    firstName:
                      type: string
                    lastName:
                      type: string
                    phone:
                      type: string
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  accessToken:
                    type: string
                  refreshToken:
                    type: string

  /auth/login:
    post:
      summary: Authenticate user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  accessToken:
                    type: string
                  refreshToken:
                    type: string

  /businesses:
    get:
      summary: Search and filter businesses
      parameters:
        - name: latitude
          in: query
          schema:
            type: number
        - name: longitude
          in: query
          schema:
            type: number
        - name: radius
          in: query
          schema:
            type: number
            default: 10
        - name: category
          in: query
          schema:
            type: string
        - name: search
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of businesses
          content:
            application/json:
              schema:
                type: object
                properties:
                  businesses:
                    type: array
                    items:
                      $ref: '#/components/schemas/Business'
                  total:
                    type: integer
                  hasMore:
                    type: boolean

    post:
      summary: Create new business listing
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BusinessInput'
      responses:
        '201':
          description: Business created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Business'

  /businesses/{businessId}:
    get:
      summary: Get business details
      parameters:
        - name: businessId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Business details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Business'

  /bookings:
    post:
      summary: Create new booking
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookingInput'
      responses:
        '201':
          description: Booking created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Booking'

  /bookings/{bookingId}/payment:
    post:
      summary: Process payment for booking
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                paymentMethodId:
                  type: string
                amount:
                  type: number
      responses:
        '200':
          description: Payment processed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Transaction'

  /reviews:
    post:
      summary: Create review for business
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReviewInput'
      responses:
        '201':
          description: Review created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Review'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        role:
          type: string
          enum: [consumer, business_owner, admin]
        profile:
          type: object
        createdAt:
          type: string
          format: date-time
        isEmailVerified:
          type: boolean

    Business:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        location:
          type: object
        categories:
          type: array
          items:
            type: string
        hours:
          type: object
        contact:
          type: object
        media:
          type: array
        services:
          type: array
        averageRating:
          type: number
        reviewCount:
          type: integer
        isActive:
          type: boolean

    Booking:
      type: object
      properties:
        id:
          type: string
        businessId:
          type: string
        serviceId:
          type: string
        scheduledAt:
          type: string
          format: date-time
        duration:
          type: integer
        status:
          type: string
        totalAmount:
          type: number
        customerInfo:
          type: object

    Review:
      type: object
      properties:
        id:
          type: string
        businessId:
          type: string
        rating:
          type: number
        content:
          type: string
        isVerifiedPurchase:
          type: boolean
        createdAt:
          type: string
          format: date-time

    Transaction:
      type: object
      properties:
        id:
          type: string
        amount:
          type: number
        platformFee:
          type: number
        status:
          type: string
        paymentMethod:
          type: object
        processedAt:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
