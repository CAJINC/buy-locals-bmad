import { CognitoService } from '../../services/cognitoService';
import { CreateUserRequest } from '@buy-locals/shared';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('CognitoService', () => {
  let cognitoService: CognitoService;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    cognitoService = new CognitoService();
    
    // Mock the client
    mockCognitoClient = new CognitoIdentityProviderClient({}) as jest.Mocked<CognitoIdentityProviderClient>;
    (CognitoIdentityProviderClient as jest.Mock).mockImplementation(() => mockCognitoClient);
  });

  describe('registerUser', () => {
    const mockUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'Test123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    };

    it('should successfully register a user', async () => {
      // Mock successful responses
      mockCognitoClient.send
        .mockResolvedValueOnce({ // AdminCreateUserCommand
          User: { Username: 'test@example.com' }
        })
        .mockResolvedValueOnce({}); // AdminSetUserPasswordCommand

      const result = await cognitoService.registerUser(mockUserData);

      expect(result.userId).toBe('test@example.com');
      expect(result.tempPassword).toBeDefined();
      expect(mockCognitoClient.send).toHaveBeenCalledTimes(2);
    });

    it('should handle registration errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('User already exists'));

      await expect(cognitoService.registerUser(mockUserData))
        .rejects.toThrow('Failed to register user');
    });

    it('should set correct user attributes', async () => {
      mockCognitoClient.send
        .mockResolvedValueOnce({ User: { Username: 'test@example.com' } })
        .mockResolvedValueOnce({});

      await cognitoService.registerUser(mockUserData);

      const createUserCall = mockCognitoClient.send.mock.calls[0][0] as AdminCreateUserCommand;
      const userAttributes = createUserCall.input.UserAttributes;

      expect(userAttributes).toContainEqual({ Name: 'email', Value: 'test@example.com' });
      expect(userAttributes).toContainEqual({ Name: 'custom:role', Value: 'consumer' });
      expect(userAttributes).toContainEqual({ Name: 'given_name', Value: 'John' });
      expect(userAttributes).toContainEqual({ Name: 'family_name', Value: 'Doe' });
    });
  });

  describe('loginUser', () => {
    it('should successfully authenticate user', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          RefreshToken: 'mock-refresh-token',
          IdToken: 'mock-id-token',
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockAuthResult);

      const result = await cognitoService.loginUser('test@example.com', 'password');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.idToken).toBe('mock-id-token');
    });

    it('should handle login errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('Invalid credentials'));

      await expect(cognitoService.loginUser('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle missing authentication result', async () => {
      mockCognitoClient.send.mockResolvedValue({});

      await expect(cognitoService.loginUser('test@example.com', 'password'))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockAuthResult);

      const result = await cognitoService.refreshToken('mock-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.idToken).toBe('new-id-token');
    });

    it('should handle refresh errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(cognitoService.refreshToken('invalid-token'))
        .rejects.toThrow('Failed to refresh token');
    });
  });

  describe('getUser', () => {
    it('should successfully get user information', async () => {
      const mockUserResult = {
        Username: 'test@example.com',
        UserAttributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'custom:role', Value: 'consumer' },
          { Name: 'given_name', Value: 'John' },
          { Name: 'family_name', Value: 'Doe' },
          { Name: 'email_verified', Value: 'true' },
        ],
        UserCreateDate: new Date('2025-01-01'),
        UserLastModifiedDate: new Date('2025-01-01'),
      };

      mockCognitoClient.send.mockResolvedValue(mockUserResult);

      const result = await cognitoService.getUser('test@example.com');

      expect(result.id).toBe('test@example.com');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('consumer');
      expect(result.profile?.firstName).toBe('John');
      expect(result.profile?.lastName).toBe('Doe');
      expect(result.isEmailVerified).toBe(true);
    });

    it('should handle user not found', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('UserNotFoundException'));

      await expect(cognitoService.getUser('nonexistent@example.com'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should successfully update user profile', async () => {
      mockCognitoClient.send.mockResolvedValue({});

      await expect(cognitoService.updateUserProfile('test@example.com', {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1234567890',
      })).resolves.not.toThrow();

      expect(mockCognitoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle update errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('User not found'));

      await expect(cognitoService.updateUserProfile('test@example.com', {
        firstName: 'Jane',
      })).rejects.toThrow('Failed to update profile');
    });
  });

  describe('forgotPassword', () => {
    it('should successfully initiate password reset', async () => {
      mockCognitoClient.send.mockResolvedValue({});

      await expect(cognitoService.forgotPassword('test@example.com'))
        .resolves.not.toThrow();

      expect(mockCognitoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle forgot password errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('User not found'));

      await expect(cognitoService.forgotPassword('test@example.com'))
        .rejects.toThrow('Failed to initiate password reset');
    });
  });

  describe('confirmForgotPassword', () => {
    it('should successfully confirm password reset', async () => {
      mockCognitoClient.send.mockResolvedValue({});

      await expect(cognitoService.confirmForgotPassword('test@example.com', '123456', 'NewPass123!'))
        .resolves.not.toThrow();

      expect(mockCognitoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle confirm password errors', async () => {
      mockCognitoClient.send.mockRejectedValue(new Error('Invalid code'));

      await expect(cognitoService.confirmForgotPassword('test@example.com', '123456', 'NewPass123!'))
        .rejects.toThrow('Failed to reset password');
    });
  });
});