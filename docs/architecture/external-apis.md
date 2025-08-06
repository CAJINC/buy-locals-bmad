# External APIs

## Stripe API
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

## Google Maps API
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

## Twilio API
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

## AWS Cognito
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
