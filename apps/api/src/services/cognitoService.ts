import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AttributeType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../config/environment.js';
import { CreateUserRequest, User } from '@buy-locals/shared';

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.awsRegion,
});

export class CognitoService {
  
  /**
   * Register a new user in Cognito
   */
  async registerUser(userData: CreateUserRequest): Promise<{ userId: string; tempPassword: string }> {
    const tempPassword = this.generateTempPassword();
    
    const userAttributes: AttributeType[] = [
      { Name: 'email', Value: userData.email },
      { Name: 'email_verified', Value: 'false' },
      { Name: 'custom:role', Value: userData.role || 'consumer' },
      { Name: 'given_name', Value: userData.firstName },
      { Name: 'family_name', Value: userData.lastName },
    ];

    if (userData.phone) {
      userAttributes.push({ Name: 'phone_number', Value: userData.phone });
    }

    try {
      // Create user in Cognito
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: config.cognitoUserPoolId,
        Username: userData.email,
        UserAttributes: userAttributes,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS', // Don't send welcome email initially
      });

      const createResult = await cognitoClient.send(createUserCommand);
      
      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: config.cognitoUserPoolId,
        Username: userData.email,
        Password: userData.password,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      return {
        userId: createResult.User?.Username || userData.email,
        tempPassword,
      };
    } catch (error) {
      console.error('Error registering user:', error);
      throw new Error('Failed to register user');
    }
  }

  /**
   * Authenticate user and get tokens
   */
  async loginUser(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }> {
    try {
      const authCommand = new AdminInitiateAuthCommand({
        UserPoolId: config.cognitoUserPoolId,
        ClientId: config.cognitoClientId,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: this.calculateSecretHash(email),
        },
      });

      const authResult = await cognitoClient.send(authCommand);

      if (authResult.AuthenticationResult) {
        return {
          accessToken: authResult.AuthenticationResult.AccessToken || '',
          refreshToken: authResult.AuthenticationResult.RefreshToken || '',
          idToken: authResult.AuthenticationResult.IdToken || '',
        };
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Error logging in user:', error);
      throw new Error('Invalid credentials');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    idToken: string;
  }> {
    try {
      const refreshCommand = new AdminInitiateAuthCommand({
        UserPoolId: config.cognitoUserPoolId,
        ClientId: config.cognitoClientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const refreshResult = await cognitoClient.send(refreshCommand);

      if (refreshResult.AuthenticationResult) {
        return {
          accessToken: refreshResult.AuthenticationResult.AccessToken || '',
          idToken: refreshResult.AuthenticationResult.IdToken || '',
        };
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Get user information from Cognito
   */
  async getUser(username: string): Promise<Partial<User>> {
    try {
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: config.cognitoUserPoolId,
        Username: username,
      });

      const result = await cognitoClient.send(getUserCommand);
      
      const attributes = result.UserAttributes || [];
      const getAttr = (name: string) => attributes.find(attr => attr.Name === name)?.Value || '';

      return {
        id: result.Username || username,
        email: getAttr('email'),
        role: getAttr('custom:role') as 'consumer' | 'business_owner' | 'admin',
        profile: {
          firstName: getAttr('given_name'),
          lastName: getAttr('family_name'),
          phone: getAttr('phone_number') || undefined,
        },
        isEmailVerified: getAttr('email_verified') === 'true',
        createdAt: result.UserCreateDate || new Date(),
        updatedAt: result.UserLastModifiedDate || new Date(),
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error('User not found');
    }
  }

  /**
   * Update user profile attributes
   */
  async updateUserProfile(username: string, updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<void> {
    try {
      const attributes: AttributeType[] = [];
      
      if (updates.firstName) {
        attributes.push({ Name: 'given_name', Value: updates.firstName });
      }
      if (updates.lastName) {
        attributes.push({ Name: 'family_name', Value: updates.lastName });
      }
      if (updates.phone) {
        attributes.push({ Name: 'phone_number', Value: updates.phone });
      }

      if (attributes.length > 0) {
        const updateCommand = new AdminUpdateUserAttributesCommand({
          UserPoolId: config.cognitoUserPoolId,
          Username: username,
          UserAttributes: attributes,
        });

        await cognitoClient.send(updateCommand);
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Initiate password reset
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const forgotPasswordCommand = new ForgotPasswordCommand({
        ClientId: config.cognitoClientId,
        Username: email,
        SecretHash: this.calculateSecretHash(email),
      });

      await cognitoClient.send(forgotPasswordCommand);
    } catch (error) {
      console.error('Error initiating password reset:', error);
      throw new Error('Failed to initiate password reset');
    }
  }

  /**
   * Confirm password reset with code
   */
  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    try {
      const confirmCommand = new ConfirmForgotPasswordCommand({
        ClientId: config.cognitoClientId,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword,
        SecretHash: this.calculateSecretHash(email),
      });

      await cognitoClient.send(confirmCommand);
    } catch (error) {
      console.error('Error confirming password reset:', error);
      throw new Error('Failed to reset password');
    }
  }

  /**
   * Calculate secret hash for Cognito operations (if client secret is configured)
   */
  private calculateSecretHash(username: string): string {
    if (!config.cognitoClientSecret) {
      return '';
    }
    
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', config.cognitoClientSecret)
      .update(username + config.cognitoClientId)
      .digest('base64');
  }

  /**
   * Generate a temporary password for new users
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}