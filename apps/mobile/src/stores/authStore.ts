import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User, CreateUserRequest, LoginRequest, UpdateProfileRequest } from '@buy-locals/shared';
import { authService } from '../services/authService';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  register: (userData: CreateUserRequest) => Promise<boolean>;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: UpdateProfileRequest) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
  refreshUserProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      // Initialize auth service and restore session
      initialize: async () => {
        set({ isLoading: true });

        try {
          const hasValidSession = await authService.initialize();
          
          if (hasValidSession) {
            const user = authService.getCurrentUser();
            set({
              user,
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            user: null,
            isAuthenticated: false,
            isInitialized: true,
            isLoading: false,
            error: 'Failed to initialize authentication',
          });
        }
      },

      // Register new user
      register: async (userData: CreateUserRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const result = await authService.register(userData);

          if (result.success && result.data) {
            set({
              user: result.data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              isLoading: false,
              error: result.error || 'Registration failed',
            });
            return false;
          }
        } catch (error) {
          console.error('Registration error:', error);
          set({
            isLoading: false,
            error: 'Registration failed. Please try again.',
          });
          return false;
        }
      },

      // Login user
      login: async (credentials: LoginRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const result = await authService.login(credentials);

          if (result.success && result.data) {
            set({
              user: result.data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              isLoading: false,
              error: result.error || 'Login failed',
            });
            return false;
          }
        } catch (error) {
          console.error('Login error:', error);
          set({
            isLoading: false,
            error: 'Login failed. Please try again.',
          });
          return false;
        }
      },

      // Logout user
      logout: async () => {
        set({ isLoading: true });

        try {
          await authService.logout();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Logout error:', error);
          // Even if logout API fails, clear local state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Update user profile
      updateProfile: async (updates: UpdateProfileRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const result = await authService.updateProfile(updates);

          if (result.success && result.data) {
            set({
              user: result.data.user,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              isLoading: false,
              error: result.error || 'Profile update failed',
            });
            return false;
          }
        } catch (error) {
          console.error('Profile update error:', error);
          set({
            isLoading: false,
            error: 'Profile update failed. Please try again.',
          });
          return false;
        }
      },

      // Forgot password
      forgotPassword: async (email: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const result = await authService.forgotPassword(email);
          
          set({
            isLoading: false,
            error: result.success ? null : (result.error || 'Failed to send reset email'),
          });
          
          return result.success;
        } catch (error) {
          console.error('Forgot password error:', error);
          set({
            isLoading: false,
            error: 'Failed to send reset email. Please try again.',
          });
          return false;
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh user profile
      refreshUserProfile: async () => {
        if (!get().isAuthenticated) return;

        try {
          const result = await authService.getUserProfile();
          
          if (result.success && result.data) {
            set({
              user: result.data.user,
              error: null,
            });
          } else {
            // If profile fetch fails, user might be unauthorized
            if (result.error?.includes('unauthorized') || result.error?.includes('token')) {
              set({
                user: null,
                isAuthenticated: false,
                error: 'Session expired. Please log in again.',
              });
            }
          }
        } catch (error) {
          console.error('Profile refresh error:', error);
        }
      },
    }),
    {
      name: 'auth-store', // Storage key for persistence
    }
  )
);

// Selectors for commonly used state combinations
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    error: store.error,
  };
};

export const useAuthActions = () => {
  const store = useAuthStore();
  return {
    initialize: store.initialize,
    register: store.register,
    login: store.login,
    logout: store.logout,
    updateProfile: store.updateProfile,
    forgotPassword: store.forgotPassword,
    clearError: store.clearError,
    refreshUserProfile: store.refreshUserProfile,
  };
};