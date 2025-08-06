export interface User {
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

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'consumer' | 'business_owner';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  locationPreferences?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
}