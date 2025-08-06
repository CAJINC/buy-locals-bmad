# Testing Strategy

## Testing Pyramid

```
              E2E Tests
             /        \
        Integration Tests
           /            \
      Frontend Unit  Backend Unit
```

## Test Organization

### Frontend Tests

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

### Backend Tests

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

### E2E Tests

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

## Test Examples

### Frontend Component Test

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

### Backend API Test

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

### E2E Test

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
