import { CognitoService } from '../../services/cognitoService';
import { AccountLockout } from '../../middleware/rateLimiting';
import { loginSchema, registerSchema } from '../../schemas/authSchemas';
import * as redis from 'redis';

describe('Authentication Edge Cases', () => {
  describe('CognitoService Edge Cases', () => {
    let cognitoService: CognitoService;

    beforeEach(() => {
      cognitoService = new CognitoService();
    });

    describe('Network and Service Failures', () => {
      it('should handle AWS service outages gracefully', async () => {
        const mockClient = {
          send: jest.fn().mockRejectedValue({
            name: 'ServiceUnavailableException',
            message: 'Service temporarily unavailable',
          }),
        };

        // Mock the client
        jest.spyOn(cognitoService as any, 'cognitoClient', 'get').mockReturnValue(mockClient);

        await expect(
          cognitoService.registerUser({
            email: 'test@example.com',
            password: 'Test123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'consumer',
          })
        ).rejects.toThrow('Failed to register user');
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';

        const mockClient = {
          send: jest.fn().mockRejectedValue(timeoutError),
        };

        jest.spyOn(cognitoService as any, 'cognitoClient', 'get').mockReturnValue(mockClient);

        await expect(cognitoService.loginUser('test@example.com', 'password')).rejects.toThrow(
          'Invalid credentials'
        );
      });

      it('should handle malformed responses', async () => {
        const mockClient = {
          send: jest.fn().mockResolvedValue(null), // Malformed response
        };

        jest.spyOn(cognitoService as any, 'cognitoClient', 'get').mockReturnValue(mockClient);

        await expect(cognitoService.loginUser('test@example.com', 'password')).rejects.toThrow(
          'Authentication failed'
        );
      });
    });

    describe('Edge Case Inputs', () => {
      it('should handle extremely long email addresses', async () => {
        const longEmail = `${'a'.repeat(240)}@example.com`; // 251 chars total

        const validation = registerSchema.validate({
          email: longEmail,
          password: 'Test123!',
          firstName: 'John',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
        expect(validation.error?.details[0].message).toContain('255');
      });

      it('should handle special characters in names', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'José-María',
          lastName: "O'Connor-Smith",
          role: 'consumer',
        });

        expect(validation.error).toBeUndefined();
      });

      it('should reject names with numbers', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'John123',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
      });

      it('should handle international phone numbers', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+44 20 7946 0958', // UK number
          role: 'consumer',
        });

        expect(validation.error).toBeUndefined();
      });

      it('should reject invalid phone formats', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: 'not-a-phone-number',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
      });
    });

    describe('Password Edge Cases', () => {
      it('should reject password with only uppercase letters', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'TESTPASSWORD',
          firstName: 'John',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
      });

      it('should reject password with only lowercase and numbers', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'testpassword123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
      });

      it('should accept password with minimum complexity', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'John',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeUndefined();
      });

      it('should handle extremely long passwords', async () => {
        const longPassword = 'A'.repeat(100) + 'a'.repeat(100) + '1'.repeat(28); // 228 chars

        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: longPassword,
          firstName: 'John',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeUndefined(); // Should accept long passwords
      });
    });
  });

  describe('Account Lockout Edge Cases', () => {
    describe('Race Conditions', () => {
      it('should handle concurrent failed attempts correctly', async () => {
        const mockRedisClient = {
          isOpen: true,
          connect: jest.fn(),
          exists: jest.fn().mockResolvedValue(0),
          incr: jest.fn().mockResolvedValue(4), // Just below threshold
          expire: jest.fn(),
          setEx: jest.fn(),
          del: jest.fn(),
        };

        (redis as any).createClient.mockReturnValue(mockRedisClient);

        // Simulate concurrent requests
        const promises = Array(3)
          .fill(null)
          .map(() => AccountLockout.recordFailedAttempt('test@example.com'));

        const results = await Promise.all(promises);

        // All should return same attempt count (race condition handling)
        results.forEach(result => {
          expect(result.attempts).toBe(4);
          expect(result.isLocked).toBe(false);
        });
      });

      it('should handle Redis connection issues during lockout check', async () => {
        const mockRedisClient = {
          isOpen: false,
          connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        };

        (redis as any).createClient.mockReturnValue(mockRedisClient);

        const result = await AccountLockout.isAccountLocked('test@example.com');

        // Should fail open for security
        expect(result.isLocked).toBe(false);
      });
    });

    describe('Time-based Edge Cases', () => {
      it('should handle system clock changes', async () => {
        const mockRedisClient = {
          isOpen: true,
          connect: jest.fn(),
          exists: jest.fn().mockResolvedValue(1),
          ttl: jest.fn().mockResolvedValue(-1), // Key exists but no TTL (shouldn't happen)
        };

        (redis as any).createClient.mockReturnValue(mockRedisClient);

        const result = await AccountLockout.isAccountLocked('test@example.com');

        // Should still return locked status even with corrupted TTL
        expect(result.isLocked).toBe(true);
      });

      it('should handle TTL edge case at expiration boundary', async () => {
        const mockRedisClient = {
          isOpen: true,
          connect: jest.fn(),
          exists: jest.fn().mockResolvedValue(1),
          ttl: jest.fn().mockResolvedValue(1), // 1 second remaining
        };

        (redis as any).createClient.mockReturnValue(mockRedisClient);

        const result = await AccountLockout.isAccountLocked('test@example.com');

        expect(result.isLocked).toBe(true);
        expect(result.lockoutExpires).toBeInstanceOf(Date);

        // Should expire in approximately 1 second
        const timeUntilExpiry = result.lockoutExpires!.getTime() - Date.now();
        expect(timeUntilExpiry).toBeGreaterThan(500);
        expect(timeUntilExpiry).toBeLessThan(1500);
      });
    });
  });

  describe('Validation Edge Cases', () => {
    describe('Email Validation', () => {
      const testCases = [
        { email: 'test@example.com', valid: true },
        { email: 'test+tag@example.com', valid: true },
        { email: 'test.name@example.co.uk', valid: true },
        { email: 'test@localhost', valid: true }, // Allow for dev
        { email: 'plainaddress', valid: false },
        { email: '@example.com', valid: false },
        { email: 'test@', valid: false },
        { email: 'test..test@example.com', valid: false },
        { email: '', valid: false },
      ];

      testCases.forEach(({ email, valid }) => {
        it(`should ${valid ? 'accept' : 'reject'} email: ${email}`, () => {
          const validation = loginSchema.validate({ email, password: 'Test123!' });

          if (valid) {
            expect(validation.error).toBeUndefined();
          } else {
            expect(validation.error).toBeDefined();
          }
        });
      });
    });

    describe('Unicode and Special Characters', () => {
      it('should handle unicode characters in names', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: '张三', // Chinese characters
          lastName: 'José', // Accented characters
          role: 'consumer',
        });

        // Current implementation may reject unicode - this tests the behavior
        // In a real implementation, you might want to allow unicode names
        expect(validation.error).toBeDefined();
      });

      it('should handle emoji in names gracefully', async () => {
        const validation = registerSchema.validate({
          email: 'test@example.com',
          password: 'Test123!',
          firstName: 'John😀',
          lastName: 'Doe',
          role: 'consumer',
        });

        expect(validation.error).toBeDefined();
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large request payloads gracefully', async () => {
      const largeString = 'a'.repeat(10000);

      const validation = registerSchema.validate({
        email: 'test@example.com',
        password: 'Test123!',
        firstName: largeString,
        lastName: 'Doe',
        role: 'consumer',
      });

      expect(validation.error).toBeDefined();
      expect(validation.error?.details[0].message).toContain('50'); // Max length
    });

    it('should handle concurrent validation requests', async () => {
      const requests = Array(100)
        .fill(null)
        .map((_, i) =>
          registerSchema.validate({
            email: `test${i}@example.com`,
            password: 'Test123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'consumer',
          })
        );

      const results = await Promise.all(requests);

      results.forEach(result => {
        expect(result.error).toBeUndefined();
      });
    });
  });
});
