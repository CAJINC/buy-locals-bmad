# Buy Locals Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for Buy Locals, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project

**N/A - Greenfield project**

The Buy Locals platform is a greenfield project designed from scratch to meet the specific requirements of a community-driven local business marketplace. While we will leverage existing open-source libraries and frameworks, no specific starter template constrains the architectural decisions.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-05 | 1.0 | Initial architecture creation from PRD | Winston (Architect Agent) |

## High Level Architecture

### Technical Summary

Buy Locals implements a cloud-native microservices architecture within a monorepo structure, leveraging AWS infrastructure for scalability and reliability. The platform features React Native mobile applications and a React.js web dashboard communicating with Node.js/Express microservices through RESTful APIs. Key integration points include real-time WebSocket connections for notifications, Redis caching for performance optimization, and PostgreSQL for persistent data storage. The architecture emphasizes horizontal scalability, supporting multi-market expansion while maintaining sub-second response times and 99.5% uptime requirements through auto-scaling Lambda functions and managed AWS services.

### Platform and Infrastructure Choice

**Platform:** AWS (Amazon Web Services)

**Key Services:** 
- AWS Lambda (serverless compute)
- Amazon API Gateway (API management)  
- Amazon RDS PostgreSQL (managed database)
- Amazon ElastiCache Redis (caching)
- Amazon S3 (file storage)
- Amazon CloudFront (CDN)
- Amazon Cognito (authentication)
- AWS AppSync (real-time features)

**Deployment Host and Regions:** Primary deployment in US-East-1 (N. Virginia) with CloudFront global edge locations for optimal performance across target markets.

**Rationale:** AWS provides the most comprehensive serverless ecosystem with proven scalability for marketplace applications. The serverless-first approach aligns with the startup's need for cost optimization while supporting rapid scaling to 25+ markets. AWS managed services reduce operational overhead while providing enterprise-grade security and compliance capabilities required for payment processing.

### Repository Structure

**Structure:** Monorepo with Turborepo

**Monorepo Tool:** Turborepo for build optimization and caching

**Package Organization:** Domain-driven packages with shared libraries for cross-platform consistency

The monorepo approach facilitates code sharing between React Native mobile apps and React.js web dashboard while maintaining clear boundaries between frontend and backend concerns. Turborepo's intelligent caching system optimizes build times across the entire codebase.

### High Level Architecture Diagram

```mermaid
graph TB
    Users[Users: Consumers & Business Owners]
    Mobile[React Native Mobile Apps]
    Web[React.js Web Dashboard]
    CDN[CloudFront CDN]
    
    Users --> Mobile
    Users --> Web
    Mobile --> CDN
    Web --> CDN
    
    CDN --> Gateway[API Gateway]
    Gateway --> Auth[Lambda: Auth Service]
    Gateway --> Business[Lambda: Business Service]
    Gateway --> Booking[Lambda: Booking Service]
    Gateway --> Payment[Lambda: Payment Service]
    Gateway --> Review[Lambda: Review Service]
    Gateway --> Notification[Lambda: Notification Service]
    
    Auth --> RDS[(RDS PostgreSQL)]
    Business --> RDS
    Booking --> RDS
    Payment --> RDS
    Review --> RDS
    
    Business --> Redis[(ElastiCache Redis)]
    Booking --> Redis
    Review --> Redis
    
    Business --> S3[S3 Bucket: Media Storage]
    Notification --> SNS[SNS: Push Notifications]
    Notification --> SES[SES: Email Service]
    
    Payment --> Stripe[Stripe API]
    Business --> GoogleMaps[Google Maps API]
    Notification --> Twilio[Twilio SMS API]
    
    Gateway --> AppSync[AWS AppSync: Real-time]
    AppSync --> Mobile
    AppSync --> Web
```

### Architectural Patterns

- **Serverless Microservices:** Lambda-based services for automatic scaling and cost optimization - _Rationale:_ Eliminates server management overhead while providing infinite scaling potential for marketplace growth
- **API Gateway Pattern:** Centralized API management with authentication, rate limiting, and monitoring - _Rationale:_ Provides single entry point for all client requests with built-in security and observability
- **Event-Driven Architecture:** Asynchronous processing using SNS/SQS for notifications and background tasks - _Rationale:_ Ensures responsive user experience while handling time-intensive operations like payment processing and email delivery
- **CQRS Pattern:** Separate read/write models for complex queries and high-performance data access - _Rationale:_ Optimizes database performance for marketplace scenarios with heavy read operations (business discovery) and critical write operations (bookings/payments)
- **Component-Driven Development:** Reusable React components with TypeScript for both mobile and web platforms - _Rationale:_ Maximizes code reuse and maintains consistency across all user touchpoints
- **Repository Pattern:** Abstract data access layer for database operations - _Rationale:_ Enables testability and potential database migration flexibility as the platform scales

## Tech Stack

### Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3+ | Type-safe development across mobile and web | Prevents runtime errors and improves developer productivity in large codebase |
| Frontend Framework | React Native | 0.73+ | Cross-platform mobile application development | Single codebase for iOS/Android reduces development time and maintenance overhead |
| UI Component Library | NativeBase | 3.5+ | Consistent UI components across platforms | Provides accessible, customizable components with React Native and web support |
| State Management | Zustand | 4.5+ | Lightweight state management for React applications | Simpler than Redux with TypeScript support and minimal boilerplate |
| Backend Language | Node.js | 20 LTS | JavaScript runtime for serverless functions | Consistent language across frontend and backend, excellent AWS Lambda support |
| Backend Framework | Express.js | 4.18+ | Web framework for API development | Mature, lightweight framework with extensive middleware ecosystem |
| API Style | REST | - | HTTP-based API communication | Proven, cacheable, and widely understood by developers and tools |
| Database | PostgreSQL | 15+ | Primary relational database for structured data | ACID compliance, excellent geospatial support for location features, JSON capabilities |
| Cache | Redis | 7.0+ | In-memory caching and session storage | High-performance caching for frequently accessed data and real-time features |
| File Storage | Amazon S3 | - | Scalable object storage for media files | Cost-effective, highly available storage with CDN integration |
| Authentication | AWS Cognito | - | Managed authentication and user management | Reduces security implementation complexity while providing OAuth integration |
| Frontend Testing | Jest + React Testing Library | Latest | Unit and integration testing for React components | Industry standard testing tools with excellent React support |
| Backend Testing | Jest + Supertest | Latest | API testing and business logic validation | Comprehensive testing framework for Node.js applications |
| E2E Testing | Detox | 20+ | End-to-end testing for React Native | React Native-specific E2E testing with device simulation capabilities |
| Build Tool | Turborepo | 1.11+ | Monorepo build orchestration and caching | Optimizes build performance across multiple packages in monorepo |
| Bundler | Metro (RN) / Vite (Web) | Latest | Application bundling and optimization | Platform-specific bundlers optimized for their respective environments |
| IaC Tool | AWS CDK | 2.110+ | Infrastructure as Code for AWS resources | Type-safe infrastructure definition with excellent AWS integration |
| CI/CD | GitHub Actions | - | Continuous integration and deployment | Integrated with GitHub repository, extensive AWS deployment actions |
| Monitoring | AWS CloudWatch + Sentry | - | Application monitoring and error tracking | Comprehensive observability with real-time error reporting |
| Logging | AWS CloudWatch Logs | - | Centralized logging for all services | Native AWS integration with searchable, structured logging |
| CSS Framework | NativeWind | 4.0+ | Tailwind CSS for React Native styling | Consistent utility-first styling approach across mobile and web |

## Data Models

### User

**Purpose:** Core user entity supporting both consumers and business owners with role-based access control

**Key Attributes:**
- id: UUID - Unique identifier for the user
- email: string - Primary authentication identifier
- passwordHash: string - Encrypted password storage
- role: enum (consumer, business_owner, admin) - User access level
- profile: object - Personal information (name, phone, location preferences)
- createdAt: timestamp - Account creation date
- lastLoginAt: timestamp - Last authentication timestamp
- isEmailVerified: boolean - Email verification status

#### TypeScript Interface

```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'consumer' | 'business_owner' | 'admin';
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    locationPreferences?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isEmailVerified: boolean;
}
```

#### Relationships
- One-to-many with Business (as owner)
- One-to-many with Booking (as consumer)
- One-to-many with Review (as author)
- One-to-many with Transaction (as payer)

### Business

**Purpose:** Local business entity with comprehensive profile information, location data, and operational details

**Key Attributes:**
- id: UUID - Unique business identifier
- ownerId: UUID - Reference to User who owns the business
- name: string - Business display name
- description: text - Detailed business description
- location: object - Address and geographical coordinates
- categories: array - Business type classifications
- hours: object - Operating hours and availability
- contact: object - Communication details
- media: array - Photos and promotional images
- services: array - Available services/products with pricing

#### TypeScript Interface

```typescript
interface Business {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
  };
  categories: string[];
  hours: {
    [key: string]: {
      open: string;
      close: string;
      isClosed: boolean;
    };
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  media: {
    id: string;
    url: string;
    type: 'logo' | 'photo';
    description?: string;
  }[];
  services: {
    id: string;
    name: string;
    description: string;
    price?: number;
    duration?: number;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Relationships
- Many-to-one with User (owner)
- One-to-many with Booking
- One-to-many with Review
- One-to-many with Transaction

### Booking

**Purpose:** Reservation/appointment entity linking consumers with businesses for scheduled services

**Key Attributes:**
- id: UUID - Unique booking identifier
- consumerId: UUID - Reference to User making the booking
- businessId: UUID - Reference to Business being booked
- serviceId: UUID - Specific service being booked
- scheduledAt: timestamp - Appointment date and time
- status: enum - Current booking state
- notes: text - Special requests or instructions
- totalAmount: decimal - Total booking cost

#### TypeScript Interface

```typescript
interface Booking {
  id: string;
  consumerId: string;
  businessId: string;
  serviceId: string;
  scheduledAt: Date;
  duration: number; // in minutes
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  totalAmount: number;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}
```

#### Relationships
- Many-to-one with User (consumer)
- Many-to-one with Business
- One-to-one with Transaction
- One-to-one with Review (after completion)

### Review

**Purpose:** Community feedback system enabling consumers to rate and review business experiences

**Key Attributes:**
- id: UUID - Unique review identifier
- authorId: UUID - Reference to User who wrote the review
- businessId: UUID - Reference to Business being reviewed
- rating: decimal - Star rating (1-5 with half-star precision)
- content: text - Written review content
- isVerifiedPurchase: boolean - Indicates if reviewer has transacted with business

#### TypeScript Interface

```typescript
interface Review {
  id: string;
  authorId: string;
  businessId: string;
  bookingId?: string; // Optional link to specific booking
  rating: number; // 1.0 to 5.0
  content: string;
  photos?: string[]; // URLs to review photos
  isVerifiedPurchase: boolean;
  helpfulVotes: number;
  businessResponse?: {
    content: string;
    respondedAt: Date;
    responderId: string;
  };
  status: 'published' | 'flagged' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}
```

#### Relationships
- Many-to-one with User (author)
- Many-to-one with Business
- Many-to-one with Booking (optional)

### Transaction

**Purpose:** Financial transaction record for all monetary exchanges between consumers and businesses

**Key Attributes:**
- id: UUID - Unique transaction identifier
- payerId: UUID - Reference to User making payment
- businessId: UUID - Reference to Business receiving payment
- bookingId: UUID - Reference to associated Booking
- amount: decimal - Transaction amount
- status: enum - Payment processing state
- paymentMethod: object - Payment method details
- platformFee: decimal - Commission taken by platform

#### TypeScript Interface

```typescript
interface Transaction {
  id: string;
  payerId: string;
  businessId: string;
  bookingId: string;
  amount: number;
  platformFee: number;
  netAmount: number; // amount - platformFee
  currency: string; // 'USD'
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
  paymentMethod: {
    type: 'card' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
  };
  stripePaymentIntentId: string;
  metadata?: Record<string, any>;
  processedAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Relationships
- Many-to-one with User (payer)
- Many-to-one with Business
- One-to-one with Booking

## API Specification

### REST API Specification

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

## Components

### Auth Service
**Responsibility:** User authentication, registration, password management, JWT token generation and validation, role-based access control

**Key Interfaces:**
- POST /auth/register - User registration with email verification
- POST /auth/login - User authentication with JWT tokens
- POST /auth/refresh - Token refresh and rotation
- POST /auth/forgot-password - Password reset initiation
- POST /auth/reset-password - Password reset completion
- GET /auth/verify-email - Email verification endpoint

**Dependencies:** AWS Cognito for user pool management, SES for email delivery, RDS PostgreSQL for user data storage

**Technology Stack:** Node.js/Express Lambda function, AWS Cognito integration, bcrypt for password hashing, jsonwebtoken for JWT handling

### Business Service
**Responsibility:** Business profile management, search and discovery, location-based queries, category filtering, media upload handling

**Key Interfaces:**
- GET /businesses - Search businesses with location/category filters
- POST /businesses - Create new business listing
- GET /businesses/{id} - Retrieve business details
- PUT /businesses/{id} - Update business information
- POST /businesses/{id}/media - Upload business photos
- GET /businesses/{id}/analytics - Business performance metrics

**Dependencies:** RDS PostgreSQL for business data, S3 for media storage, ElastiCache Redis for search result caching, Google Maps API for geocoding

**Technology Stack:** Node.js/Express Lambda function, PostGIS for geospatial queries, Sharp for image processing, AWS S3 SDK for file uploads

### Booking Service
**Responsibility:** Appointment scheduling, reservation management, availability tracking, calendar integration, booking lifecycle management

**Key Interfaces:**
- POST /bookings - Create new booking/reservation
- GET /bookings - List user bookings with filters
- GET /bookings/{id} - Retrieve booking details
- PUT /bookings/{id} - Update booking (reschedule/cancel)
- GET /businesses/{id}/availability - Check available time slots
- POST /bookings/{id}/confirm - Confirm pending booking

**Dependencies:** RDS PostgreSQL for booking data, ElastiCache Redis for availability caching, SNS for booking notifications, external calendar APIs (Google Calendar, Outlook)

**Technology Stack:** Node.js/Express Lambda function, node-cron for scheduled tasks, ical for calendar format handling, moment.js for date/time manipulation

### Payment Service
**Responsibility:** Payment processing, transaction management, escrow handling, refund processing, platform fee calculation, financial reporting

**Key Interfaces:**
- POST /payments/intents - Create Stripe payment intent
- POST /payments/confirm - Confirm payment completion
- POST /payments/refund - Process refund requests
- GET /payments/transactions - List transaction history
- POST /payments/payouts - Initiate business payouts
- GET /payments/fees - Calculate platform fees

**Dependencies:** Stripe API for payment processing, RDS PostgreSQL for transaction records, SNS for payment notifications, SQS for async payment processing

**Technology Stack:** Node.js/Express Lambda function, Stripe Node.js SDK, decimal.js for precise financial calculations, AWS SQS for payment queue processing

### Review Service
**Responsibility:** Review and rating management, content moderation, business response handling, review analytics, spam detection

**Key Interfaces:**
- POST /reviews - Create new review
- GET /reviews - List reviews with filters
- PUT /reviews/{id} - Update review content
- POST /reviews/{id}/response - Business response to review
- POST /reviews/{id}/helpful - Mark review as helpful
- POST /reviews/{id}/flag - Report inappropriate content

**Dependencies:** RDS PostgreSQL for review data, ElastiCache Redis for review caching, Amazon Comprehend for sentiment analysis, SNS for review notifications

**Technology Stack:** Node.js/Express Lambda function, AWS Comprehend for content analysis, node-sentiment for basic sentiment scoring, profanity-filter for content moderation

### Notification Service
**Responsibility:** Push notifications, email delivery, SMS messaging, notification preferences, delivery tracking, template management

**Key Interfaces:**
- POST /notifications/push - Send push notification
- POST /notifications/email - Send email notification  
- POST /notifications/sms - Send SMS notification
- GET /notifications/preferences - User notification settings
- PUT /notifications/preferences - Update notification preferences
- GET /notifications/history - Notification delivery history

**Dependencies:** SNS for push notifications, SES for email delivery, Twilio for SMS, RDS PostgreSQL for notification logs, AppSync for real-time updates

**Technology Stack:** Node.js/Express Lambda function, AWS SNS/SES SDKs, Twilio SDK for SMS, Handlebars for email templates, FCM for mobile push notifications

### Component Diagrams

```mermaid
graph TB
    subgraph "Client Layer"
        Mobile[React Native Mobile App]
        Web[React.js Web Dashboard]
    end
    
    subgraph "API Gateway Layer"
        Gateway[AWS API Gateway]
        Auth[Authentication Middleware]
    end
    
    subgraph "Service Layer"
        AuthSvc[Auth Service]
        BusinessSvc[Business Service]
        BookingSvc[Booking Service]
        PaymentSvc[Payment Service]
        ReviewSvc[Review Service]
        NotificationSvc[Notification Service]
    end
    
    subgraph "Data Layer"
        RDS[(PostgreSQL)]
        Redis[(ElastiCache)]
        S3[S3 Storage]
    end
    
    subgraph "External Services"
        Stripe[Stripe API]
        Maps[Google Maps]
        Twilio[Twilio SMS]
    end
    
    Mobile --> Gateway
    Web --> Gateway
    Gateway --> Auth
    Auth --> AuthSvc
    Gateway --> BusinessSvc
    Gateway --> BookingSvc
    Gateway --> PaymentSvc
    Gateway --> ReviewSvc
    Gateway --> NotificationSvc
    
    AuthSvc --> RDS
    BusinessSvc --> RDS
    BusinessSvc --> Redis
    BusinessSvc --> S3
    BusinessSvc --> Maps
    BookingSvc --> RDS
    BookingSvc --> Redis
    PaymentSvc --> RDS
    PaymentSvc --> Stripe
    ReviewSvc --> RDS
    ReviewSvc --> Redis
    NotificationSvc --> RDS
    NotificationSvc --> Twilio
```

## External APIs

### Stripe API
- **Purpose:** Payment processing, subscription management, and financial transactions
- **Documentation:** https://stripe.com/docs/api
- **Base URL(s):** https://api.stripe.com/v1
- **Authentication:** Bearer token (secret key)
- **Rate Limits:** 1000 requests per second per account

**Key Endpoints Used:**
- `POST /payment_intents` - Create payment intent for booking transactions
- `POST /payment_intents/{id}/confirm` - Confirm payment completion
- `POST /refunds` - Process refunds for cancelled bookings
- `GET /charges` - Retrieve transaction history
- `POST /transfers` - Transfer funds to business accounts

**Integration Notes:** Implement webhook endpoints for payment status updates. Use Stripe Connect for marketplace payments with automatic fee collection. Enable 3D Secure for enhanced security compliance.

### Google Maps API
- **Purpose:** Geocoding, location search, and mapping functionality
- **Documentation:** https://developers.google.com/maps/documentation
- **Base URL(s):** https://maps.googleapis.com/maps/api
- **Authentication:** API key with domain restrictions
- **Rate Limits:** 1000 requests per second with daily quotas

**Key Endpoints Used:**
- `GET /geocode/json` - Convert addresses to coordinates
- `GET /place/nearbysearch/json` - Find nearby places and businesses
- `GET /place/details/json` - Get detailed place information
- `GET /directions/json` - Calculate routes and travel times

**Integration Notes:** Implement Places API for business address validation. Use Geocoding API for location-based search functionality. Consider caching geocoding results to minimize API calls.

### Twilio API
- **Purpose:** SMS notifications for booking confirmations and updates
- **Documentation:** https://www.twilio.com/docs/api
- **Base URL(s):** https://api.twilio.com/2010-04-01
- **Authentication:** Basic auth with Account SID and Auth Token
- **Rate Limits:** Varies by message type and account plan

**Key Endpoints Used:**
- `POST /Accounts/{AccountSid}/Messages.json` - Send SMS messages
- `GET /Accounts/{AccountSid}/Messages.json` - Retrieve message history
- `POST /Accounts/{AccountSid}/IncomingPhoneNumbers.json` - Manage phone numbers

**Integration Notes:** Implement delivery status webhooks for message tracking. Use message templates for consistent formatting. Consider international SMS requirements for multi-market expansion.

### AWS Cognito
- **Purpose:** User authentication, user pool management, and OAuth integration
- **Documentation:** https://docs.aws.amazon.com/cognito/
- **Base URL(s):** Region-specific endpoints
- **Authentication:** AWS IAM credentials
- **Rate Limits:** Service-specific limits based on operation type

**Key Endpoints Used:**
- `InitiateAuth` - Start authentication flow
- `AdminCreateUser` - Create user accounts programmatically
- `ConfirmSignUp` - Complete user registration
- `ForgotPassword` - Initiate password reset flow

**Integration Notes:** Configure user pools with custom attributes for user roles. Implement OAuth flows for social login integration. Use Cognito triggers for custom authentication logic.

## Core Workflows

### User Registration and Business Onboarding

```mermaid
sequenceDiagram
    participant User as User
    participant Mobile as Mobile App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Business as Business Service
    participant Cognito as AWS Cognito
    participant SES as AWS SES
    participant RDS as PostgreSQL
    
    User->>Mobile: Register as business owner
    Mobile->>Gateway: POST /auth/register
    Gateway->>Auth: Validate request
    Auth->>Cognito: Create user in user pool
    Cognito-->>Auth: User created
    Auth->>RDS: Store user profile
    Auth->>SES: Send verification email
    Auth-->>Gateway: Registration success
    Gateway-->>Mobile: User token + profile
    
    User->>Mobile: Verify email
    Mobile->>Gateway: GET /auth/verify-email
    Gateway->>Auth: Verify token
    Auth->>Cognito: Confirm user
    Auth->>RDS: Update verification status
    
    User->>Mobile: Create business listing
    Mobile->>Gateway: POST /businesses
    Gateway->>Business: Create business
    Business->>RDS: Store business data
    Business->>Maps: Geocode address
    Maps-->>Business: Coordinates
    Business->>RDS: Update location data
    Business-->>Gateway: Business created
    Gateway-->>Mobile: Business profile
```

### Booking and Payment Flow

```mermaid
sequenceDiagram
    participant Consumer as Consumer
    participant Mobile as Mobile App
    participant Gateway as API Gateway
    participant Booking as Booking Service
    participant Payment as Payment Service
    participant Notification as Notification Service
    participant Stripe as Stripe API
    participant Business as Business Owner
    participant RDS as PostgreSQL
    
    Consumer->>Mobile: Select service and time
    Mobile->>Gateway: POST /bookings
    Gateway->>Booking: Create booking
    Booking->>RDS: Check availability
    RDS-->>Booking: Time slot available
    Booking->>RDS: Reserve time slot
    Booking-->>Gateway: Booking created (pending)
    Gateway-->>Mobile: Booking confirmation
    
    Consumer->>Mobile: Proceed to payment
    Mobile->>Gateway: POST /payments/intents
    Gateway->>Payment: Create payment intent
    Payment->>Stripe: Create payment intent
    Stripe-->>Payment: Payment intent ID
    Payment-->>Gateway: Payment intent
    Gateway-->>Mobile: Client secret
    
    Mobile->>Stripe: Confirm payment (client-side)
    Stripe->>Payment: Webhook: payment succeeded
    Payment->>RDS: Update transaction status
    Payment->>Booking: Confirm booking
    Booking->>RDS: Update booking status
    Booking->>Notification: Send confirmations
    Notification->>Business: Email/SMS notification
    Notification->>Consumer: Push notification
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('consumer', 'business_owner', 'admin')),
    profile JSONB NOT NULL DEFAULT '{}',
    is_email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Businesses table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB NOT NULL,
    categories TEXT[] DEFAULT '{}',
    hours JSONB NOT NULL DEFAULT '{}',
    contact JSONB DEFAULT '{}',
    media JSONB DEFAULT '[]',
    services JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for geo queries
CREATE INDEX idx_businesses_location ON businesses USING GIN ((location->'coordinates'));

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    customer_info JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT
);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    content TEXT NOT NULL,
    photos TEXT[] DEFAULT '{}',
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_votes INTEGER DEFAULT 0,
    business_response JSONB,
    status VARCHAR(20) DEFAULT 'published' 
        CHECK (status IN ('published', 'flagged', 'removed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate reviews per user per business
    UNIQUE(author_id, business_id)
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
    payment_method JSONB NOT NULL,
    stripe_payment_intent_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification logs table
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('push', 'email', 'sms')),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_categories ON businesses USING GIN(categories);
CREATE INDEX idx_businesses_active ON businesses(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_bookings_consumer_id ON bookings(consumer_id);
CREATE INDEX idx_bookings_business_id ON bookings(business_id);
CREATE INDEX idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX idx_bookings_status ON bookings(status);

CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_author_id ON reviews(author_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

CREATE INDEX idx_transactions_payer_id ON transactions(payer_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Functions for maintaining data integrity
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Frontend Architecture

### Component Architecture

#### Component Organization

```
src/components/
├── ui/                     # Basic UI components
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Modal/
│   └── index.ts
├── forms/                  # Form-specific components
│   ├── LoginForm/
│   ├── BusinessForm/
│   ├── BookingForm/
│   └── index.ts
├── business/               # Business-related components
│   ├── BusinessCard/
│   ├── BusinessProfile/
│   ├── BusinessList/
│   └── index.ts
├── booking/                # Booking-related components
│   ├── BookingCalendar/
│   ├── BookingCard/
│   ├── BookingHistory/
│   └── index.ts
├── layout/                 # Layout components
│   ├── Header/
│   ├── Navigation/
│   ├── Sidebar/
│   └── index.ts
└── common/                 # Shared components
    ├── LoadingSpinner/
    ├── ErrorBoundary/
    ├── EmptyState/
    └── index.ts
```

#### Component Template

```typescript
import React from 'react';
import { Box, Text } from 'native-base';
import { BusinessCardProps } from './types';

interface BusinessCardProps {
  business: Business;
  onPress?: (business: Business) => void;
  showDistance?: boolean;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  onPress,
  showDistance = false,
}) => {
  const handlePress = () => {
    onPress?.(business);
  };

  return (
    <Box
      p={4}
      bg="white"
      borderRadius="lg"
      shadow={2}
      mb={3}
      onTouchEnd={handlePress}
    >
      <Text fontSize="lg" fontWeight="bold">
        {business.name}
      </Text>
      <Text fontSize="sm" color="gray.600" mt={1}>
        {business.description}
      </Text>
      {showDistance && business.distance && (
        <Text fontSize="xs" color="blue.600" mt={2}>
          {business.distance.toFixed(1)} miles away
        </Text>
      )}
    </Box>
  );
};

export default BusinessCard;
```

### State Management Architecture

#### State Structure

```typescript
interface AppState {
  auth: {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
  };
  business: {
    businesses: Business[];
    selectedBusiness: Business | null;
    searchResults: Business[];
    filters: SearchFilters;
    isLoading: boolean;
    error: string | null;
  };
  booking: {
    bookings: Booking[];
    selectedBooking: Booking | null;
    availableSlots: TimeSlot[];
    isLoading: boolean;
    error: string | null;
  };
  ui: {
    navigation: {
      currentTab: string;
      history: string[];
    };
    modals: {
      [key: string]: boolean;
    };
    theme: 'light' | 'dark';
  };
}
```

#### State Management Patterns

- **Authentication State:** Managed globally with automatic token refresh and persistence
- **Business Data:** Cached with TTL for search results, real-time updates for user's own businesses
- **Booking State:** Optimistic updates for better UX, with rollback on failure
- **UI State:** Local component state for ephemeral data, global state for persistent UI preferences
- **Error Handling:** Centralized error state with automatic retry mechanisms
- **Loading States:** Granular loading states to prevent UI blocking during async operations

### Routing Architecture

#### Route Organization

```
src/navigation/
├── AuthNavigator.tsx       # Authentication flows
├── MainNavigator.tsx       # Main app navigation
├── BusinessNavigator.tsx   # Business management flows
├── BookingNavigator.tsx    # Booking-related screens
└── types.ts               # Navigation type definitions

Routes Structure:
├── /auth
│   ├── /login
│   ├── /register
│   ├── /forgot-password
│   └── /verify-email
├── /app
│   ├── /discover          # Business discovery
│   ├── /business/:id      # Business details
│   ├── /booking
│   │   ├── /create
│   │   ├── /history
│   │   └── /:id
│   ├── /profile
│   └── /settings
└── /business-dashboard
    ├── /profile
    ├── /bookings
    ├── /analytics
    └── /customers
```

#### Protected Route Pattern

```typescript
import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'consumer' | 'business_owner' | 'admin';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <UnauthorizedScreen />;
  }

  return <>{children}</>;
};
```

### Frontend Services Layer

#### API Client Setup

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL,
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const { token } = useAuthStore.getState();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh or logout
          await this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleUnauthorized() {
    const { refreshToken, logout } = useAuthStore.getState();
    try {
      await this.refreshToken();
    } catch {
      logout();
    }
  }

  public get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  public post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  public put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  public delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
```

#### Service Example

```typescript
import { apiClient } from './apiClient';
import { Business, BusinessFilters, CreateBusinessInput } from '../types';

export class BusinessService {
  async searchBusinesses(filters: BusinessFilters): Promise<Business[]> {
    const params = new URLSearchParams();
    
    if (filters.latitude && filters.longitude) {
      params.append('latitude', filters.latitude.toString());
      params.append('longitude', filters.longitude.toString());
    }
    
    if (filters.radius) {
      params.append('radius', filters.radius.toString());
    }
    
    if (filters.category) {
      params.append('category', filters.category);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }

    const response = await apiClient.get<{
      businesses: Business[];
      total: number;
      hasMore: boolean;
    }>(`/businesses?${params.toString()}`);

    return response.data.businesses;
  }

  async getBusinessById(id: string): Promise<Business> {
    const response = await apiClient.get<Business>(`/businesses/${id}`);
    return response.data;
  }

  async createBusiness(business: CreateBusinessInput): Promise<Business> {
    const response = await apiClient.post<Business>('/businesses', business);
    return response.data;
  }

  async updateBusiness(id: string, updates: Partial<Business>): Promise<Business> {
    const response = await apiClient.put<Business>(`/businesses/${id}`, updates);
    return response.data;
  }

  async uploadBusinessMedia(id: string, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`media-${index}`, file);
    });

    const response = await apiClient.post<{ urls: string[] }>(
      `/businesses/${id}/media`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data.urls;
  }
}

export const businessService = new BusinessService();
```

## Backend Architecture

### Service Architecture

#### Function Organization

```
src/functions/
├── auth/
│   ├── register.ts
│   ├── login.ts
│   ├── refresh.ts
│   ├── forgotPassword.ts
│   └── verifyEmail.ts
├── business/
│   ├── create.ts
│   ├── search.ts
│   ├── getById.ts
│   ├── update.ts
│   └── uploadMedia.ts
├── booking/
│   ├── create.ts
│   ├── list.ts
│   ├── update.ts
│   └── getAvailability.ts
├── payment/
│   ├── createIntent.ts
│   ├── confirmPayment.ts
│   ├── processRefund.ts
│   └── webhooks.ts
├── review/
│   ├── create.ts
│   ├── list.ts
│   ├── respond.ts
│   └── moderate.ts
└── notification/
    ├── sendPush.ts
    ├── sendEmail.ts
    ├── sendSMS.ts
    └── managePreferences.ts
```

#### Function Template

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateRequest } from '../middleware/validation';
import { authenticateUser } from '../middleware/auth';
import { businessService } from '../services/businessService';
import { CreateBusinessSchema } from '../schemas/businessSchemas';
import { errorHandler } from '../utils/errorHandler';
import { successResponse, errorResponse } from '../utils/responses';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Validate request body
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateRequest(body, CreateBusinessSchema);
    if (!validationResult.isValid) {
      return errorResponse(400, 'Validation failed', validationResult.errors);
    }

    // Process business logic
    const business = await businessService.createBusiness({
      ...validationResult.data,
      ownerId: user.id,
    });

    return successResponse(201, business);
  } catch (error) {
    console.error('Error creating business:', error);
    return errorHandler(error);
  }
};
```

### Database Architecture

#### Schema Design

The PostgreSQL schema is optimized for the marketplace use case with the following key design decisions:

1. **UUID Primary Keys:** Ensures scalability and prevents ID enumeration attacks
2. **JSONB Fields:** Flexible storage for complex data structures (business hours, contact info, media arrays)
3. **Spatial Indexing:** PostGIS extensions for efficient location-based queries
4. **Audit Trails:** Created/updated timestamps with automatic triggers
5. **Referential Integrity:** Foreign key constraints ensure data consistency
6. **Performance Indexes:** Strategic indexes on commonly queried fields

#### Data Access Layer

```typescript
import { Pool, PoolClient } from 'pg';
import { Business, CreateBusinessInput, UpdateBusinessInput } from '../types';

class BusinessRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(business: CreateBusinessInput): Promise<Business> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO businesses (
          owner_id, name, description, location, categories, 
          hours, contact, services
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        business.ownerId,
        business.name,
        business.description,
        JSON.stringify(business.location),
        business.categories,
        JSON.stringify(business.hours),
        JSON.stringify(business.contact),
        JSON.stringify(business.services),
      ];

      const result = await client.query(query, values);
      return this.mapRowToBusiness(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Business | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM businesses WHERE id = $1 AND is_active = TRUE';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToBusiness(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async searchByLocation(
    latitude: number,
    longitude: number,
    radius: number,
    filters: {
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Business[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT *, 
               ST_Distance(
                 ST_Point((location->>'longitude')::float, (location->>'latitude')::float)::geography,
                 ST_Point($1, $2)::geography
               ) / 1000 as distance_km
        FROM businesses
        WHERE is_active = TRUE
          AND ST_DWithin(
            ST_Point((location->>'longitude')::float, (location->>'latitude')::float)::geography,
            ST_Point($1, $2)::geography,
            $3 * 1000
          )
      `;
      
      const params = [longitude, latitude, radius];
      let paramIndex = 4;

      if (filters.category) {
        query += ` AND $${paramIndex} = ANY(categories)`;
        params.push(filters.category);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (
          name ILIKE $${paramIndex} 
          OR description ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(services) as service
            WHERE service ILIKE $${paramIndex}
          )
        )`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ` ORDER BY distance_km`;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToBusiness(row));
    } finally {
      client.release();
    }
  }

  private mapRowToBusiness(row: any): Business {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description,
      location: row.location,
      categories: row.categories,
      hours: row.hours,
      contact: row.contact,
      media: row.media || [],
      services: row.services || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      distance: row.distance_km ? parseFloat(row.distance_km) : undefined,
    };
  }
}

export { BusinessRepository };
```

### Authentication and Authorization

#### Auth Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Cognito as AWS Cognito
    participant RDS as PostgreSQL
    
    Client->>Gateway: Login request
    Gateway->>Auth: Validate credentials
    Auth->>Cognito: Authenticate user
    Cognito-->>Auth: User confirmed
    Auth->>RDS: Get user profile
    RDS-->>Auth: User data
    Auth-->>Gateway: JWT tokens
    Gateway-->>Client: Access + Refresh tokens
    
    Note over Client: Store tokens securely
    
    Client->>Gateway: API request with token
    Gateway->>Auth: Validate JWT
    Auth->>Cognito: Verify token
    Cognito-->>Auth: Token valid
    Auth-->>Gateway: User context
    Gateway->>Service: Process request
    Service-->>Gateway: Response
    Gateway-->>Client: API response
    
    Note over Client: Token expires
    
    Client->>Gateway: Refresh token request
    Gateway->>Auth: Validate refresh token
    Auth->>Cognito: Exchange tokens
    Cognito-->>Auth: New access token
    Auth-->>Gateway: New tokens
    Gateway-->>Client: Refreshed tokens
```

#### Middleware/Guards

```typescript
import jwt from 'jsonwebtoken';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { User } from '../types';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function authenticateUser(
  event: APIGatewayProxyEvent
): Promise<User | null> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = await verifier.verify(token);

    // Extract user information from Cognito token
    const user: User = {
      id: payload.sub,
      email: payload.email as string,
      role: payload['custom:role'] as 'consumer' | 'business_owner' | 'admin',
      // Additional user data can be fetched from database if needed
    };

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (event: APIGatewayProxyEvent): Promise<User | null> => {
    const user = await authenticateUser(event);
    
    if (!user || !allowedRoles.includes(user.role)) {
      return null;
    }

    return user;
  };
}

// Usage in Lambda functions
export const requireBusinessOwner = requireRole(['business_owner', 'admin']);
export const requireAdmin = requireRole(['admin']);
```

## Unified Project Structure

```
buy-locals/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml
│       ├── deploy-staging.yaml
│       └── deploy-production.yaml
├── apps/                       # Application packages
│   ├── mobile/                 # React Native mobile app
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── screens/        # Screen components
│   │   │   ├── navigation/     # Navigation configuration
│   │   │   ├── services/       # API client services
│   │   │   ├── stores/         # Zustand state stores
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── utils/          # Mobile-specific utilities
│   │   │   └── types/          # Mobile-specific types
│   │   ├── android/            # Android native code
│   │   ├── ios/                # iOS native code
│   │   ├── assets/             # Static assets
│   │   ├── __tests__/          # Mobile app tests
│   │   ├── metro.config.js     # Metro bundler config
│   │   └── package.json
│   ├── web/                    # React.js web dashboard
│   │   ├── src/
│   │   │   ├── components/     # Web UI components
│   │   │   ├── pages/          # Page components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API client services
│   │   │   ├── stores/         # Zustand state stores
│   │   │   ├── styles/         # Global styles/themes
│   │   │   └── utils/          # Web-specific utilities
│   │   ├── public/             # Static assets
│   │   ├── tests/              # Web app tests
│   │   ├── vite.config.ts      # Vite configuration
│   │   └── package.json
│   └── api/                    # Backend serverless functions
│       ├── src/
│       │   ├── functions/      # Lambda functions organized by domain
│       │   │   ├── auth/
│       │   │   ├── business/
│       │   │   ├── booking/
│       │   │   ├── payment/
│       │   │   ├── review/
│       │   │   └── notification/
│       │   ├── services/       # Business logic services
│       │   ├── repositories/   # Data access layer
│       │   ├── middleware/     # Express/Lambda middleware
│       │   ├── schemas/        # Validation schemas
│       │   ├── utils/          # Backend utilities
│       │   └── types/          # Backend-specific types
│       ├── tests/              # Backend tests
│       ├── serverless.yml      # Serverless Framework config
│       └── package.json
├── packages/                   # Shared packages
│   ├── shared/                 # Shared types/utilities
│   │   ├── src/
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   │   ├── user.ts
│   │   │   │   ├── business.ts
│   │   │   │   ├── booking.ts
│   │   │   │   ├── review.ts
│   │   │   │   └── transaction.ts
│   │   │   ├── constants/      # Shared constants
│   │   │   ├── utils/          # Shared utilities
│   │   │   └── schemas/        # Validation schemas
│   │   └── package.json
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   │   ├── components/     # Cross-platform components
│   │   │   ├── themes/         # Design system tokens
│   │   │   └── styles/         # Shared styles
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── eslint/
│       │   └── .eslintrc.js
│       ├── typescript/
│       │   └── tsconfig.json
│       └── jest/
│           └── jest.config.js
├── infrastructure/             # AWS CDK definitions
│   ├── lib/
│   │   ├── database-stack.ts
│   │   ├── api-stack.ts
│   │   ├── storage-stack.ts
│   │   └── monitoring-stack.ts
│   ├── bin/
│   │   └── infrastructure.ts
│   ├── cdk.json
│   └── package.json
├── scripts/                    # Build/deploy scripts
│   ├── build.sh
│   ├── deploy.sh
│   ├── setup-local.sh
│   └── seed-data.sql
├── docs/                       # Documentation
│   ├── prd.md
│   ├── brief.md
│   ├── architecture.md
│   ├── api-docs/
│   └── deployment-guide.md
├── .env.example                # Environment template
├── .gitignore
├── package.json                # Root package.json
├── turbo.json                  # Turborepo configuration
├── README.md
└── LICENSE
```

## Development Workflow

### Local Development Setup

#### Prerequisites

```bash
# Install Node.js 20+ and npm
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20

# Install global dependencies
npm install -g @aws-cdk/cli turbo

# Install mobile development tools
npm install -g @react-native-community/cli
# iOS: Install Xcode from App Store
# Android: Install Android Studio

# Install Docker for local services
# macOS: Download Docker Desktop
# Linux: Follow Docker installation guide
```

#### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd buy-locals

# Install all dependencies
npm install

# Setup local environment files
cp .env.example .env
# Edit .env with local configuration

# Start local PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start development servers
npm run dev
```

#### Development Commands

```bash
# Start all services
npm run dev

# Start frontend only
npm run dev:mobile    # React Native with Metro
npm run dev:web       # React.js with Vite

# Start backend only
npm run dev:api       # Serverless offline

# Run tests
npm run test          # All tests
npm run test:mobile   # Mobile app tests
npm run test:web      # Web app tests
npm run test:api      # Backend tests
npm run test:e2e      # End-to-end tests

# Linting and formatting
npm run lint          # ESLint
npm run format        # Prettier

# Build for production
npm run build         # All apps
npm run build:mobile  # Mobile app
npm run build:web     # Web dashboard
npm run build:api     # Backend functions
```

### Environment Configuration

#### Required Environment Variables

```bash
# Frontend (.env.local)
REACT_APP_API_BASE_URL=https://api.buylocals.com/v1
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_GOOGLE_MAPS_API_KEY=AIza...
REACT_APP_ENVIRONMENT=development

# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/buylocals
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-key
STRIPE_SECRET_KEY=sk_test_...
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=client-id
GOOGLE_MAPS_API_KEY=AIza...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# Shared
NODE_ENV=development
LOG_LEVEL=debug
SENTRY_DSN=https://...@sentry.io/...
```

## Deployment Architecture

### Deployment Strategy

**Frontend Deployment:**
- **Platform:** Vercel for web dashboard, AWS Amplify for mobile app distribution
- **Build Command:** `turbo run build --filter=web` for web, React Native build for mobile
- **Output Directory:** `apps/web/dist` for web
- **CDN/Edge:** Vercel Edge Network with global distribution

**Backend Deployment:**
- **Platform:** AWS Lambda with Serverless Framework
- **Build Command:** `turbo run build --filter=api`
- **Deployment Method:** Infrastructure as Code with AWS CDK

### CI/CD Pipeline

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: buylocals_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run tests
        run: npm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/buylocals_test
      
      - name: Build applications
        run: npm run build

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to staging
        run: npm run deploy:staging
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to production
        run: npm run deploy:production
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|--------------|-------------|---------|
| Development | http://localhost:3000 | http://localhost:8000 | Local development |
| Staging | https://staging.buylocals.com | https://staging-api.buylocals.com | Pre-production testing |
| Production | https://buylocals.com | https://api.buylocals.com | Live environment |

## Security and Performance

### Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-inline' *.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: *.amazonaws.com`
- XSS Prevention: Input sanitization, React's built-in XSS protection, Content Security Policy enforcement
- Secure Storage: Encrypted secure storage for tokens (iOS Keychain, Android Keystore), no sensitive data in AsyncStorage

**Backend Security:**
- Input Validation: Joi schema validation for all API endpoints, SQL injection prevention through parameterized queries
- Rate Limiting: API Gateway throttling at 1000 requests/minute per user, progressive rate limiting for abuse detection
- CORS Policy: Restricted to known frontend domains, credentials allowed only for authenticated requests

**Authentication Security:**
- Token Storage: Secure HTTP-only cookies for web, encrypted storage for mobile, automatic token rotation
- Session Management: AWS Cognito managed sessions with configurable timeout, device tracking for security monitoring
- Password Policy: Minimum 8 characters with complexity requirements, bcrypt hashing with salt rounds

### Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 2MB initial bundle for mobile, < 1MB for web with code splitting
- Loading Strategy: Lazy loading for non-critical screens, prefetching for likely user paths, progressive image loading
- Caching Strategy: React Query for API response caching, service worker for static assets, optimistic updates for better UX

**Backend Performance:**
- Response Time Target: < 200ms for simple queries, < 1s for complex operations including payment processing
- Database Optimization: Connection pooling, query optimization with EXPLAIN ANALYZE, strategic indexing on frequently queried fields
- Caching Strategy: Redis for session data and frequently accessed business listings, CloudFront for static assets, API Gateway response caching

## Testing Strategy

### Testing Pyramid

```
              E2E Tests
             /        \
        Integration Tests
           /            \
      Frontend Unit  Backend Unit
```

### Test Organization

#### Frontend Tests

```
apps/mobile/tests/
├── components/          # Component unit tests
│   ├── BusinessCard.test.tsx
│   ├── BookingForm.test.tsx
│   └── __snapshots__/
├── screens/            # Screen integration tests
│   ├── BusinessList.test.tsx
│   └── BookingCreate.test.tsx
├── services/           # API service tests
│   ├── businessService.test.ts
│   └── authService.test.ts
├── hooks/              # Custom hook tests
│   ├── useAuth.test.ts
│   └── useBusiness.test.ts
└── utils/              # Utility function tests
    ├── validation.test.ts
    └── formatting.test.ts
```

#### Backend Tests

```
apps/api/tests/
├── functions/          # Lambda function tests
│   ├── auth/
│   │   ├── register.test.ts
│   │   └── login.test.ts
│   ├── business/
│   │   ├── create.test.ts
│   │   └── search.test.ts
│   └── booking/
│       ├── create.test.ts
│       └── availability.test.ts
├── services/           # Business logic tests
│   ├── businessService.test.ts
│   ├── bookingService.test.ts
│   └── paymentService.test.ts
├── repositories/       # Data access tests
│   ├── businessRepository.test.ts
│   └── userRepository.test.ts
└── integration/        # API integration tests
    ├── auth-flow.test.ts
    ├── business-crud.test.ts
    └── booking-payment.test.ts
```

#### E2E Tests

```
e2e/
├── specs/
│   ├── user-registration.spec.ts
│   ├── business-discovery.spec.ts
│   ├── booking-flow.spec.ts
│   └── payment-process.spec.ts
├── page-objects/
│   ├── LoginPage.ts
│   ├── BusinessListPage.ts
│   └── BookingPage.ts
└── fixtures/
    ├── users.json
    └── businesses.json
```

### Test Examples

#### Frontend Component Test

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BusinessCard } from '../components/BusinessCard';
import { mockBusiness } from '../__mocks__/business';

describe('BusinessCard', () => {
  it('displays business information correctly', () => {
    const { getByText } = render(
      <BusinessCard business={mockBusiness} />
    );

    expect(getByText(mockBusiness.name)).toBeTruthy();
    expect(getByText(mockBusiness.description)).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(
      <BusinessCard 
        business={mockBusiness} 
        onPress={mockOnPress}
        testID="business-card"
      />
    );

    fireEvent.press(getByTestId('business-card'));
    
    await waitFor(() => {
      expect(mockOnPress).toHaveBeenCalledWith(mockBusiness);
    });
  });

  it('shows distance when provided', () => {
    const businessWithDistance = {
      ...mockBusiness,
      distance: 2.5
    };

    const { getByText } = render(
      <BusinessCard 
        business={businessWithDistance} 
        showDistance={true}
      />
    );

    expect(getByText('2.5 miles away')).toBeTruthy();
  });
});
```

#### Backend API Test

```typescript
import request from 'supertest';
import { app } from '../src/app';
import { businessRepository } from '../src/repositories/businessRepository';
import { createMockUser, createMockBusiness } from '../__mocks__';

describe('Business API', () => {
  let authToken: string;
  let mockUser: any;

  beforeEach(async () => {
    mockUser = await createMockUser({ role: 'business_owner' });
    authToken = generateJWT(mockUser);
  });

  describe('POST /businesses', () => {
    it('creates a new business listing', async () => {
      const businessData = {
        name: 'Test Business',
        description: 'A test business',
        location: {
          address: '123 Main St',
          city: 'Testville',
          state: 'TS',
          zipCode: '12345'
        },
        categories: ['restaurant'],
        hours: {
          monday: { open: '09:00', close: '17:00', isClosed: false }
        }
      };

      const response = await request(app)
        .post('/businesses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(businessData)
        .expect(201);

      expect(response.body.name).toBe(businessData.name);
      expect(response.body.ownerId).toBe(mockUser.id);
      expect(response.body.id).toBeDefined();
    });

    it('returns 400 for invalid business data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      await request(app)
        .post('/businesses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const businessData = createMockBusiness();

      await request(app)
        .post('/businesses')
        .send(businessData)
        .expect(401);
    });
  });

  describe('GET /businesses', () => {
    beforeEach(async () => {
      // Seed test businesses
      await businessRepository.create(createMockBusiness({
        location: { latitude: 40.7128, longitude: -74.0060 }
      }));
    });

    it('returns businesses near specified location', async () => {
      const response = await request(app)
        .get('/businesses')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 10
        })
        .expect(200);

      expect(response.body.businesses).toHaveLength(1);
      expect(response.body.businesses[0].distance).toBeDefined();
    });

    it('filters businesses by category', async () => {
      const response = await request(app)
        .get('/businesses')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 10,
          category: 'restaurant'
        })
        .expect(200);

      expect(response.body.businesses).toHaveLength(1);
      expect(response.body.businesses[0].categories).toContain('restaurant');
    });
  });
});
```

#### E2E Test

```typescript
import { by, device, element, expect } from 'detox';

describe('Booking Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete a booking from discovery to payment', async () => {
    // Login as consumer
    await element(by.id('login-email')).typeText('consumer@test.com');
    await element(by.id('login-password')).typeText('password123');
    await element(by.id('login-submit')).tap();

    // Wait for home screen
    await waitFor(element(by.id('discover-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Search for business
    await element(by.id('search-input')).typeText('Test Salon');
    await element(by.id('search-submit')).tap();

    // Select first business
    await element(by.id('business-card-0')).tap();

    // Wait for business profile
    await waitFor(element(by.id('business-profile')))
      .toBeVisible()
      .withTimeout(3000);

    // Tap book service
    await element(by.id('book-service-button')).tap();

    // Select service
    await element(by.id('service-haircut')).tap();

    // Select time slot
    await element(by.id('time-slot-0')).tap();

    // Continue to payment
    await element(by.id('continue-payment')).tap();

    // Enter payment details
    await element(by.id('card-number')).typeText('4242424242424242');
    await element(by.id('card-expiry')).typeText('12/25');
    await element(by.id('card-cvc')).typeText('123');

    // Complete booking
    await element(by.id('complete-booking')).tap();

    // Verify success screen
    await waitFor(element(by.id('booking-success')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.text('Booking confirmed!'))).toBeVisible();
  });
});
```

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there - never duplicate type definitions across frontend and backend
- **API Calls:** Never make direct HTTP calls - always use the service layer with proper error handling and loading states
- **Environment Variables:** Access only through config objects, never process.env directly - use validation for required variables
- **Error Handling:** All API routes must use the standard error handler with consistent error response format
- **State Updates:** Never mutate state directly - use proper state management patterns with immutable updates
- **Database Queries:** Always use parameterized queries to prevent SQL injection - never string concatenation
- **Authentication:** All protected routes must validate JWT tokens - no client-side only protection
- **Validation:** Input validation required on both client and server - client for UX, server for security
- **Logging:** Use structured logging with correlation IDs - never log sensitive data like passwords or tokens
- **Testing:** Unit tests required for business logic - integration tests for API endpoints

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfile.tsx` |
| Hooks | camelCase with 'use' | - | `useAuth.ts` |
| API Routes | - | kebab-case | `/api/user-profile` |
| Database Tables | - | snake_case | `user_profiles` |
| Constants | SCREAMING_SNAKE_CASE | SCREAMING_SNAKE_CASE | `API_BASE_URL` |
| Functions | camelCase | camelCase | `getUserById` |
| Files | kebab-case | kebab-case | `user-service.ts` |
| Directories | kebab-case | kebab-case | `user-management/` |

## Error Handling Strategy

### Error Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant API as API Gateway
    participant Service as Lambda Service
    participant DB as Database
    participant Logger as CloudWatch
    
    Client->>API: API Request
    API->>Service: Forward request
    Service->>DB: Database query
    DB-->>Service: Error response
    Service->>Logger: Log error details
    Service->>Service: Transform to API error
    Service-->>API: Standardized error
    API-->>Client: HTTP error response
    Client->>Client: Display user-friendly message
    Client->>Client: Log to error tracking
```

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
import { toast } from 'react-native-toast-message';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  fallbackMessage?: string;
}

export class ErrorHandler {
  static handle(
    error: any, 
    options: ErrorHandlerOptions = {}
  ): void {
    const {
      showToast = true,
      logError = true,
      fallbackMessage = 'Something went wrong. Please try again.',
    } = options;

    let message = fallbackMessage;
    let errorCode = 'UNKNOWN_ERROR';

    // Parse API error response
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      message = apiError.message || fallbackMessage;
      errorCode = apiError.code || 'API_ERROR';
    } else if (error.message) {
      message = error.message;
      errorCode = 'CLIENT_ERROR';
    }

    // Log error for debugging
    if (logError) {
      console.error('Error occurred:', {
        code: errorCode,
        message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      // Send to error tracking service
      if (process.env.NODE_ENV === 'production') {
        // Sentry.captureException(error);
      }
    }

    // Show user-friendly message
    if (showToast) {
      toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
        visibilityTime: 4000,
      });
    }
  }

  static async handleAsync<T>(
    asyncFunction: () => Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> {
    try {
      return await asyncFunction();
    } catch (error) {
      this.handle(error, options);
      return null;
    }
  }
}

// Usage in components
export const useBusinessService = () => {
  const searchBusinesses = useCallback(async (filters: BusinessFilters) => {
    return ErrorHandler.handleAsync(
      () => businessService.searchBusinesses(filters),
      { fallbackMessage: 'Failed to search businesses. Please try again.' }
    );
  }, []);

  return { searchBusinesses };
};
```

### Backend Error Handling

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(error: any): APIGatewayProxyResult {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  // Log error details
  console.error('API Error:', {
    requestId,
    timestamp,
    error: error.message,
    stack: error.stack,
    code: error.code || 'UNKNOWN',
  });

  // Handle known error types
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp,
          requestId,
        },
      }),
    };
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.details,
          timestamp,
          requestId,
        },
      }),
    };
  }

  // Handle database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    return {
      statusCode: 409,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        error: {
          code: ErrorCode.CONFLICT,
          message: 'Resource already exists',
          timestamp,
          requestId,
        },
      }),
    };
  }

  // Generic server error
  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify({
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp,
        requestId,
      },
    }),
  };
}

// Helper functions for common errors
export const notFound = (resource: string) => 
  new ApiError(ErrorCode.NOT_FOUND, `${resource} not found`, 404);

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(ErrorCode.AUTHENTICATION_ERROR, message, 401);

export const forbidden = (message = 'Access denied') =>
  new ApiError(ErrorCode.AUTHORIZATION_ERROR, message, 403);

export const validationError = (details: Record<string, any>) =>
  new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', 400, details);

// Usage in Lambda functions
export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const user = await authenticateUser(event);
    if (!user) {
      throw unauthorized();
    }

    const business = await businessService.getById(event.pathParameters?.id);
    if (!business) {
      throw notFound('Business');
    }

    return successResponse(200, business);
  } catch (error) {
    return errorHandler(error);
  }
};
```

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Sentry for error tracking, Google Analytics for user behavior, React Native Performance for mobile metrics
- **Backend Monitoring:** AWS CloudWatch for infrastructure metrics, AWS X-Ray for distributed tracing, Sentry for error aggregation
- **Error Tracking:** Sentry with real-time alerts for critical errors, error rate monitoring with automatic escalation
- **Performance Monitoring:** AWS CloudWatch Insights for API performance, New Relic for application performance monitoring

### Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP, FID, CLS) tracked via Google PageSpeed Insights integration
- JavaScript errors captured with stack traces, user context, and reproduction steps
- API response times measured from client perspective with 95th percentile tracking
- User interactions tracked for conversion funnel analysis and feature usage metrics

**Backend Metrics:**
- Request rate monitored per endpoint with alerting on unusual spikes or drops
- Error rate tracked with breakdown by error type and automatic incident creation at >5%
- Response time measured at p50, p95, p99 percentiles with SLA monitoring
- Database query performance tracked with slow query identification and optimization alerts

**Business Metrics:**
- User registration and activation rates with cohort analysis
- Booking completion rates and abandonment points in the funnel
- Revenue metrics including GMV, average transaction value, and platform fee collection
- Business satisfaction scores through NPS surveys and retention analysis

---

This comprehensive architecture document provides the technical foundation for building Buy Locals as a scalable, secure, and maintainable local business marketplace platform. The architecture emphasizes modern best practices, cloud-native design patterns, and developer productivity while ensuring the platform can grow from MVP to multi-market success.