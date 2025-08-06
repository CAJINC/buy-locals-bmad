import { BaseRepository } from './BaseRepository.js';
import bcrypt from 'bcryptjs';
export class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }
    async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await this.query(query, [email]);
        return result.rows[0] || null;
    }
    async createUser(userData) {
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(userData.password, saltRounds);
        const profile = {
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
            false,
        ];
        const result = await this.query(query, values);
        return result.rows[0];
    }
    async updateProfile(userId, profileUpdates) {
        const currentUser = await this.findById(userId);
        if (!currentUser) {
            return null;
        }
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
    async updateLastLogin(userId) {
        const query = `
      UPDATE users 
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
        await this.query(query, [userId]);
    }
    async verifyPassword(email, password) {
        const user = await this.findByEmail(email);
        if (!user) {
            return null;
        }
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        return isValidPassword ? user : null;
    }
    async verifyEmail(userId) {
        const query = `
      UPDATE users 
      SET is_email_verified = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const result = await this.query(query, [userId]);
        return result.rows[0] || null;
    }
    async findByRole(role) {
        const query = 'SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC';
        const result = await this.query(query, [role]);
        return result.rows;
    }
    async updatePassword(userId, newPassword) {
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
    async findUsersWithPagination(page = 1, limit = 10, role) {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let countWhereClause = '';
        let params = [limit, offset];
        let countParams = [];
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
//# sourceMappingURL=userRepository.js.map