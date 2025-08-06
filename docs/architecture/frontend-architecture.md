# Frontend Architecture

## Component Architecture

### Component Organization

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

### Component Template

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

## State Management Architecture

### State Structure

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

### State Management Patterns

- **Authentication State:** Managed globally with automatic token refresh and persistence
- **Business Data:** Cached with TTL for search results, real-time updates for user's own businesses
- **Booking State:** Optimistic updates for better UX, with rollback on failure
- **UI State:** Local component state for ephemeral data, global state for persistent UI preferences
- **Error Handling:** Centralized error state with automatic retry mechanisms
- **Loading States:** Granular loading states to prevent UI blocking during async operations

## Routing Architecture

### Route Organization

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

### Protected Route Pattern

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

## Frontend Services Layer

### API Client Setup

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

### Service Example

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
