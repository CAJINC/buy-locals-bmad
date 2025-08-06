import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreateUserRequest, LoginRequest, AuthResponse, User, UpdateProfileRequest } from '@buy-locals/shared';

// API Base URL - should be configurable per environment
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001'  // Local development
  : 'https://api.buylocals.app'; // Production

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_DATA: 'auth_user_data',
} as const;

// Types for API responses
interface ApiError {
  error: string;
  message?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class AuthService {
  private static instance: AuthService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize auth service - load tokens from storage
   */
  async initialize(): Promise<boolean> {
    try {
      const [accessToken, refreshToken, userData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      ]);

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.user = userData ? JSON.parse(userData) : null;

      // If we have tokens, try to refresh them to ensure they're valid
      if (this.accessToken && this.refreshToken) {
        try {
          await this.refreshAccessToken();
          return true;
        } catch (error) {
          console.warn('Token refresh failed during initialization:', error);
          await this.clearTokens();
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Auth initialization error:', error);
      return false;
    }
  }

  /**
   * Register a new user
   */
  async register(userData: CreateUserRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Registration failed',
          message: data.message,
        };
      }

      // Store tokens and user data
      await this.storeAuthData(data);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Network error occurred during registration',
      };
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
          message: data.message,
        };
      }

      // Store tokens and user data
      await this.storeAuthData(data);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error occurred during login',
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if we have a token
      if (this.accessToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local data regardless of API call result
      await this.clearTokens();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      if (!response.ok) {
        await this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.accessToken = data.token;
      
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.token);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.clearTokens();
      return false;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<ApiResponse<{ user: User }>> {
    try {
      const response = await this.authenticatedFetch('/user/profile');
      
      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to get profile',
        };
      }

      const data = await response.json();
      this.user = data.user;
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: UpdateProfileRequest): Promise<ApiResponse<{ user: User }>> {
    try {
      const response = await this.authenticatedFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to update profile',
        };
      }

      const data = await response.json();
      this.user = data.user;
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      return {
        success: response.ok,
        message: data.message,
        error: response.ok ? undefined : (data.error || 'Failed to send reset email'),
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.accessToken && this.user);
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Private helper methods
   */
  private async storeAuthData(authResponse: AuthResponse): Promise<void> {
    this.accessToken = authResponse.token;
    this.refreshToken = authResponse.refreshToken;
    this.user = authResponse.user;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authResponse.token),
      AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken),
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(authResponse.user)),
    ]);
  }

  private async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
    ]);
  }

  private async authenticatedFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // If token expired, try to refresh and retry
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed && this.accessToken) {
        return fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
      }
    }

    return response;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();