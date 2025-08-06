# Coding Standards

## Critical Fullstack Rules

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

## Naming Conventions

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
