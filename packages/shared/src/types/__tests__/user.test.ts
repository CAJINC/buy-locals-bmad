import { CreateUserRequest, LoginRequest, User } from '../user';

describe('User Types', () => {
  it('should have correct User interface structure', () => {
    const mockUser: User = {
      id: 'test-id',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      role: 'consumer',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isEmailVerified: true,
    };

    expect(mockUser.id).toBeDefined();
    expect(mockUser.email).toBeDefined();
    expect(['consumer', 'business_owner', 'admin']).toContain(mockUser.role);
  });

  it('should have correct CreateUserRequest interface structure', () => {
    const mockRequest: CreateUserRequest = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    };

    expect(mockRequest.email).toBeDefined();
    expect(mockRequest.password).toBeDefined();
    expect(mockRequest.firstName).toBeDefined();
    expect(mockRequest.lastName).toBeDefined();
  });

  it('should have correct LoginRequest interface structure', () => {
    const mockRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'password123',
    };

    expect(mockRequest.email).toBeDefined();
    expect(mockRequest.password).toBeDefined();
  });
});
