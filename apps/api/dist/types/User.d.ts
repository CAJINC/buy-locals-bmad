export interface UserProfile {
    firstName: string;
    lastName: string;
    phone?: string;
    locationPreferences?: {
        city?: string;
        state?: string;
        country?: string;
    };
}
export type UserRole = 'consumer' | 'business_owner' | 'admin';
export interface User {
    id: string;
    email: string;
    password_hash: string;
    role: UserRole;
    profile: UserProfile;
    is_email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    last_login_at?: Date;
}
export interface CreateUserRequest {
    email: string;
    password: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    locationPreferences?: {
        city?: string;
        state?: string;
        country?: string;
    };
}
export interface UpdateUserProfileRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    locationPreferences?: {
        city?: string;
        state?: string;
        country?: string;
    };
}
export interface UserResponseDto {
    id: string;
    email: string;
    role: UserRole;
    profile: UserProfile;
    is_email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    last_login_at?: Date;
}
//# sourceMappingURL=User.d.ts.map