import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';

interface AuthContextType {
  // Re-export store state and actions for easy access
  user: ReturnType<typeof useAuthStore>['user'];
  isAuthenticated: ReturnType<typeof useAuthStore>['isAuthenticated'];
  isLoading: ReturnType<typeof useAuthStore>['isLoading'];
  isInitialized: ReturnType<typeof useAuthStore>['isInitialized'];
  error: ReturnType<typeof useAuthStore>['error'];
  
  // Actions
  initialize: ReturnType<typeof useAuthStore>['initialize'];
  register: ReturnType<typeof useAuthStore>['register'];
  login: ReturnType<typeof useAuthStore>['login'];
  logout: ReturnType<typeof useAuthStore>['logout'];
  updateProfile: ReturnType<typeof useAuthStore>['updateProfile'];
  forgotPassword: ReturnType<typeof useAuthStore>['forgotPassword'];
  clearError: ReturnType<typeof useAuthStore>['clearError'];
  refreshUserProfile: ReturnType<typeof useAuthStore>['refreshUserProfile'];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authStore = useAuthStore();

  // Initialize auth on app start
  useEffect(() => {
    authStore.initialize();
  }, []);

  const contextValue: AuthContextType = {
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    isInitialized: authStore.isInitialized,
    error: authStore.error,
    
    initialize: authStore.initialize,
    register: authStore.register,
    login: authStore.login,
    logout: authStore.logout,
    updateProfile: authStore.updateProfile,
    forgotPassword: authStore.forgotPassword,
    clearError: authStore.clearError,
    refreshUserProfile: authStore.refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Convenience hook for checking auth status
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useAuthContext();
  return isAuthenticated;
};

// Hook for requiring authentication (redirects if not authenticated)
export const useRequireAuth = () => {
  const { isAuthenticated, isInitialized } = useAuthContext();
  
  return {
    isAuthenticated,
    isInitialized,
    // Can be extended to handle automatic redirects
  };
};