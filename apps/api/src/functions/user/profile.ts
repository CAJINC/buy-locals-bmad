import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from '../../config/database.js';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validation.js';
import { authenticateCognito, CognitoAuthenticatedRequest } from '../../middleware/cognitoAuth.js';
import { CognitoService } from '../../services/cognitoService.js';
import { UpdateProfileRequest } from '@buy-locals/shared';
import { updateProfileSchema } from '../../schemas/authSchemas.js';

validateEnvironment();

const app = express();
const cognitoService = new CognitoService();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// GET user profile
app.get('/user/profile', authenticateCognito, async (req: CognitoAuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user data from database
    const result = await pool.query(
      'SELECT id, email, role, profile, is_email_verified, created_at, updated_at, last_login_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isEmailVerified: user.is_email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
});

// PUT update user profile
app.put('/user/profile', authenticateCognito, validateBody(updateProfileSchema), async (req: CognitoAuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const updates: UpdateProfileRequest = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get current user data
    const currentResult = await pool.query(
      'SELECT profile FROM users WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentProfile = currentResult.rows[0].profile || {};

    // Merge updates with current profile
    const updatedProfile = {
      ...currentProfile,
      ...(updates.firstName && { firstName: updates.firstName }),
      ...(updates.lastName && { lastName: updates.lastName }),
      ...(updates.phone && { phone: updates.phone }),
      ...(updates.locationPreferences && { locationPreferences: updates.locationPreferences }),
    };

    // Update profile in database
    const updateResult = await pool.query(
      'UPDATE users SET profile = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role, profile, is_email_verified, created_at, updated_at, last_login_at',
      [JSON.stringify(updatedProfile), userId]
    );

    const user = updateResult.rows[0];

    // Also update user attributes in Cognito if name or phone changed
    if (updates.firstName || updates.lastName || updates.phone) {
      try {
        await cognitoService.updateUserProfile(req.user?.email || '', {
          firstName: updates.firstName,
          lastName: updates.lastName,
          phone: updates.phone,
        });
      } catch (cognitoError) {
        console.error('Failed to update Cognito profile:', cognitoError);
        // Don't fail the request if Cognito update fails
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isEmailVerified: user.is_email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
});

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);