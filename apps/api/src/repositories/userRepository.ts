import { BaseRepository } from './BaseRepository.js';
import { CreateUserRequest, User, UserProfile } from '../types/User.js';
import bcrypt from 'bcryptjs';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Create a new user with hashed password
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    // Hash the password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(userData.password, saltRounds);

    // Prepare profile object
    const profile: UserProfile = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      locationPreferences: userData.locationPreferences,
    };

    const query = `
      INSERT INTO users (email, password_hash, role, profile, is_email_verified)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      userData.email,
      password_hash,
      userData.role,
      JSON.stringify(profile),
      false, // Default to unverified
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, profileUpdates: Partial<UserProfile>): Promise<User | null> {
    // First get the current profile
    const currentUser = await this.findById(userId);
    if (!currentUser) {
      return null;
    }

    // Merge the updates with existing profile
    const updatedProfile = {
      ...currentUser.profile,
      ...profileUpdates,
    };

    const query = `
      UPDATE users 
      SET profile = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, [userId, JSON.stringify(updatedProfile)]);
    return result.rows[0] || null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await this.query(query, [userId]);
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    return isValidPassword ? user : null;
  }

  /**
   * Update email verification status
   */
  async verifyEmail(userId: string): Promise<User | null> {
    const query = `
      UPDATE users 
      SET is_email_verified = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC';
    const result = await this.query(query, [role]);
    return result.rows;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    const query = `
      UPDATE users 
      SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const result = await this.query(query, [userId, password_hash]);
    return result.rowCount > 0;
  }

  /**
   * Get users with pagination and filtering
   */
  async findUsersWithPagination(
    page: number = 1,
    limit: number = 10,
    role?: string
  ): Promise<{ users: User[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let countWhereClause = '';
    const params = [limit, offset];
    const countParams: any[] = [];

    if (role) {
      whereClause = 'WHERE role = $3';
      countWhereClause = 'WHERE role = $1';
      params.push(role);
      countParams.push(role);
    }

    const query = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `SELECT COUNT(*) FROM users ${countWhereClause}`;

    const [usersResult, countResult] = await Promise.all([
      this.query(query, params),
      this.query(countQuery, countParams),
    ]);

    return {
      users: usersResult.rows,
      totalCount: parseInt(countResult.rows[0].count),
    };
  }
}