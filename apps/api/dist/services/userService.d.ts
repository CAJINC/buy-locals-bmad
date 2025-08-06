import { User, CreateUserRequest, UpdateUserProfileRequest, UserResponseDto } from '../types/User.js';
export declare class UserService {
    private userRepository;
    constructor();
    createUser(userData: CreateUserRequest): Promise<UserResponseDto>;
    getUserProfile(userId: string): Promise<UserResponseDto>;
    updateUserProfile(userId: string, updates: UpdateUserProfileRequest): Promise<UserResponseDto>;
    getUserByEmail(email: string): Promise<User | null>;
    verifyUserPassword(email: string, password: string): Promise<User | null>;
    updateLastLogin(userId: string): Promise<void>;
    verifyEmail(userId: string): Promise<UserResponseDto>;
    getUsers(page?: number, limit?: number, role?: string): Promise<{
        users: UserResponseDto[];
        totalCount: number;
    }>;
    updatePassword(userId: string, newPassword: string): Promise<void>;
    deleteUser(userId: string): Promise<void>;
    private mapToResponseDto;
    checkUserRole(user: User, requiredRoles: string[]): boolean;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=userService.d.ts.map