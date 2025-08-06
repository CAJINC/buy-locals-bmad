# Data Models

## User

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

### TypeScript Interface

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

### Relationships
- One-to-many with Business (as owner)
- One-to-many with Booking (as consumer)
- One-to-many with Review (as author)
- One-to-many with Transaction (as payer)

## Business

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

### TypeScript Interface

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

### Relationships
- Many-to-one with User (owner)
- One-to-many with Booking
- One-to-many with Review
- One-to-many with Transaction

## Booking

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

### TypeScript Interface

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

### Relationships
- Many-to-one with User (consumer)
- Many-to-one with Business
- One-to-one with Transaction
- One-to-one with Review (after completion)

## Review

**Purpose:** Community feedback system enabling consumers to rate and review business experiences

**Key Attributes:**
- id: UUID - Unique review identifier
- authorId: UUID - Reference to User who wrote the review
- businessId: UUID - Reference to Business being reviewed
- rating: decimal - Star rating (1-5 with half-star precision)
- content: text - Written review content
- isVerifiedPurchase: boolean - Indicates if reviewer has transacted with business

### TypeScript Interface

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

### Relationships
- Many-to-one with User (author)
- Many-to-one with Business
- Many-to-one with Booking (optional)

## Transaction

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

### TypeScript Interface

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

### Relationships
- Many-to-one with User (payer)
- Many-to-one with Business
- One-to-one with Booking
