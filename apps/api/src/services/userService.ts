import { UserRepository } from '../repositories/userRepository.js';
import { User, CreateUserRequest, UpdateUserProfileRequest, UserResponseDto } from '../types/User.js';
import { createError } from '../middleware/errorHandler.js';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<UserResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw createError('User with this email already exists', 409);
    }

    // Validate role
    if (!['consumer', 'business_owner', 'admin'].includes(userData.role)) {
      throw createError('Invalid user role', 400);
    }

    const user = await this.userRepository.createUser(userData);
    return this.mapToResponseDto(user);
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }
    return this.mapToResponseDto(user);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: UpdateUserProfileRequest): Promise<UserResponseDto> {
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

  /**
   * Get user by email (for authentication)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  /**
   * Verify user password
   */
  async verifyUserPassword(email: string, password: string): Promise<User | null> {
    return await this.userRepository.verifyPassword(email, password);
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.updateLastLogin(userId);
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.verifyEmail(userId);
    if (!user) {
      throw createError('User not found', 404);
    }
    return this.mapToResponseDto(user);
  }

  /**
   * Get users with pagination (admin only)
   */
  async getUsers(
    page: number = 1,
    limit: number = 10,
    role?: string
  ): Promise<{ users: UserResponseDto[]; totalCount: number }> {
    const { users, totalCount } = await this.userRepository.findUsersWithPagination(page, limit, role);
    
    return {
      users: users.map(user => this.mapToResponseDto(user)),
      totalCount,
    };
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const success = await this.userRepository.updatePassword(userId, newPassword);
    if (!success) {
      throw createError('Failed to update password', 500);
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string): Promise<void> {
    const success = await this.userRepository.delete(userId);
    if (!success) {
      throw createError('User not found or failed to delete', 404);
    }
  }

  /**
   * Map User entity to response DTO (excludes password hash)
   */
  private mapToResponseDto(user: User): UserResponseDto {
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

  /**
   * Check if user has required role
   */
  checkUserRole(user: User, requiredRoles: string[]): boolean {
    return requiredRoles.includes(user.role);
  }

  /**
   * Health check for user service
   */
  async healthCheck(): Promise<boolean> {
    return await this.userRepository.healthCheck();
  }
}