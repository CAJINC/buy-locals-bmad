import { UserRepository } from '../repositories/userRepository.js';
import { createError } from '../middleware/errorHandler.js';
export class UserService {
    constructor() {
        this.userRepository = new UserRepository();
    }
    async createUser(userData) {
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw createError('User with this email already exists', 409);
        }
        if (!['consumer', 'business_owner', 'admin'].includes(userData.role)) {
            throw createError('Invalid user role', 400);
        }
        const user = await this.userRepository.createUser(userData);
        return this.mapToResponseDto(user);
    }
    async getUserProfile(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw createError('User not found', 404);
        }
        return this.mapToResponseDto(user);
    }
    async updateUserProfile(userId, updates) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw createError('User not found', 404);
        }
        const updatedUser = await this.userRepository.updateProfile(userId, updates);
        if (!updatedUser) {
            throw createError('Failed to update user profile', 500);
        }
        return this.mapToResponseDto(updatedUser);
    }
    async getUserByEmail(email) {
        return await this.userRepository.findByEmail(email);
    }
    async verifyUserPassword(email, password) {
        return await this.userRepository.verifyPassword(email, password);
    }
    async updateLastLogin(userId) {
        await this.userRepository.updateLastLogin(userId);
    }
    async verifyEmail(userId) {
        const user = await this.userRepository.verifyEmail(userId);
        if (!user) {
            throw createError('User not found', 404);
        }
        return this.mapToResponseDto(user);
    }
    async getUsers(page = 1, limit = 10, role) {
        const { users, totalCount } = await this.userRepository.findUsersWithPagination(page, limit, role);
        return {
            users: users.map(user => this.mapToResponseDto(user)),
            totalCount,
        };
    }
    async updatePassword(userId, newPassword) {
        const success = await this.userRepository.updatePassword(userId, newPassword);
        if (!success) {
            throw createError('Failed to update password', 500);
        }
    }
    async deleteUser(userId) {
        const success = await this.userRepository.delete(userId);
        if (!success) {
            throw createError('User not found or failed to delete', 404);
        }
    }
    mapToResponseDto(user) {
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.profile,
            is_email_verified: user.is_email_verified,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login_at: user.last_login_at,
        };
    }
    checkUserRole(user, requiredRoles) {
        return requiredRoles.includes(user.role);
    }
    async healthCheck() {
        return await this.userRepository.healthCheck();
    }
}
//# sourceMappingURL=userService.js.map