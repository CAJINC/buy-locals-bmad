import { BaseRepository } from './BaseRepository.js';
import { User, CreateUserRequest, UserProfile } from '../types/User.js';
export declare class UserRepository extends BaseRepository<User> {
    constructor();
    findByEmail(email: string): Promise<User | null>;
    createUser(userData: CreateUserRequest): Promise<User>;
    updateProfile(userId: string, profileUpdates: Partial<UserProfile>): Promise<User | null>;
    updateLastLogin(userId: string): Promise<void>;
    verifyPassword(email: string, password: string): Promise<User | null>;
    verifyEmail(userId: string): Promise<User | null>;
    findByRole(role: string): Promise<User[]>;
    updatePassword(userId: string, newPassword: string): Promise<boolean>;
    findUsersWithPagination(page?: number, limit?: number, role?: string): Promise<{
        users: User[];
        totalCount: number;
    }>;
}
//# sourceMappingURL=userRepository.d.ts.map