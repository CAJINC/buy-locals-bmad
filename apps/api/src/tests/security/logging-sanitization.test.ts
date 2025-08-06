/**
 * SECURITY CRITICAL: Comprehensive tests for logging sanitization
 * These tests verify that sensitive data is properly masked in all logging scenarios
 */

import { logger } from '../../utils/logger';
import winston from 'winston';

// Mock transport to capture log output for testing
class TestTransport extends winston.Transport {
  public logs: any[] = [];

  log(info: any, callback: () => void) {
    this.logs.push(info);
    callback();
  }

  clear() {
    this.logs = [];
  }
}

describe('SECURITY: Logging Sanitization Tests', () => {
  let testTransport: TestTransport;

  beforeEach(() => {
    testTransport = new TestTransport();
    // Add our test transport to capture logs
    (logger as any).logger.add(testTransport);
  });

  afterEach(() => {
    testTransport.clear();
    (logger as any).logger.remove(testTransport);
  });

  describe('Password Sanitization', () => {
    test('should mask password in object', () => {
      logger.info('User authentication', {
        username: 'testuser',
        password: 'super-secret-password-123',
        timestamp: new Date().toISOString(),
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.password).toBe('***REDACTED***');
      expect(logEntry.username).toBe('testuser');
    });

    test('should mask password variants', () => {
      logger.info('Multiple password fields', {
        password: 'secret123',
        passwd: 'secret456',
        pass: 'secret789',
        pwd: 'secret000',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.password).toBe('***REDACTED***');
      expect(logEntry.passwd).toBe('***REDACTED***');
      expect(logEntry.pass).toBe('***REDACTED***');
      expect(logEntry.pwd).toBe('***REDACTED***');
    });

    test('should mask password in nested objects', () => {
      logger.info('Nested authentication data', {
        user: {
          id: '12345',
          credentials: {
            password: 'nested-secret-password',
            email: 'user@example.com',
          },
        },
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.user.credentials.password).toBe('***REDACTED***');
      expect(logEntry.user.id).toBe('12345');
    });
  });

  describe('Token and API Key Sanitization', () => {
    test('should mask various token types', () => {
      logger.info('API authentication', {
        api_key: 'ak_1234567890abcdef',
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        refresh_token: 'rt_9876543210fedcba',
        client_secret: 'cs_secret_key_here',
        bearer_token: 'bearer_abc123def456',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.api_key).toBe('***REDACTED***');
      expect(logEntry.access_token).toBe('***REDACTED***');
      expect(logEntry.refresh_token).toBe('***REDACTED***');
      expect(logEntry.client_secret).toBe('***REDACTED***');
      expect(logEntry.bearer_token).toBe('***REDACTED***');
    });

    test('should mask tokens in string values', () => {
      logger.info('API request with authorization', {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature',
          'x-api-key': 'ak_1234567890abcdef1234567890abcdef',
        },
        body: 'some request data',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.headers.authorization).toBe('***REDACTED***');
      expect(logEntry.headers['x-api-key']).toBe('***REDACTED***');
      expect(logEntry.body).toBe('some request data');
    });
  });

  describe('Database Credential Sanitization', () => {
    test('should mask database connection strings', () => {
      logger.info('Database connection', {
        database_url: 'postgres://user:password@localhost:5432/dbname',
        connection_string: 'mongodb://admin:secret@mongo.example.com:27017/db',
        db_password: 'db_secret_123',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.database_url).toBe('***REDACTED***');
      expect(logEntry.connection_string).toBe('***REDACTED***');
      expect(logEntry.db_password).toBe('***REDACTED***');
    });
  });

  describe('PII Sanitization', () => {
    test('should mask Social Security Numbers', () => {
      logger.info('User data with SSN', {
        user: 'John Doe',
        ssn: '123-45-6789',
        another_ssn: '987654321',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.ssn).toContain('***PII_REDACTED***');
      expect(logEntry.another_ssn).toContain('***PII_REDACTED***');
      expect(logEntry.user).toBe('John Doe');
    });

    test('should mask credit card numbers', () => {
      logger.info('Payment data', {
        card_number: '4532-1234-5678-9012',
        another_card: '4532123456789012',
        cvv: '123',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.card_number).toContain('***PII_REDACTED***');
      expect(logEntry.another_card).toContain('***PII_REDACTED***');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values', () => {
      logger.info('Null/undefined test', {
        password: null,
        api_key: undefined,
        valid_field: 'valid_value',
      });

      const logEntry = testTransport.logs[0];
      expect(logEntry.password).toBe('***REDACTED***');
      expect(logEntry.api_key).toBe('***REDACTED***');
      expect(logEntry.valid_field).toBe('valid_value');
    });

    test('should prevent infinite recursion on circular references', () => {
      const obj: any = { id: 1, password: 'secret' };
      obj.self = obj; // Create circular reference

      expect(() => {
        logger.info('Circular reference test', { data: obj });
      }).not.toThrow();

      const logEntry = testTransport.logs[0];
      expect(logEntry.data.password).toBe('***REDACTED***');
    });
  });

  describe('Performance and Security', () => {
    test('should not expose original sensitive values', () => {
      const sensitiveData = {
        password: 'super-secret-password-never-log-this',
        api_key: 'ak_never_expose_this_key_in_logs',
      };

      logger.info('Security test', sensitiveData);

      const logEntry = testTransport.logs[0];
      const logString = JSON.stringify(logEntry);

      expect(logString).not.toContain('super-secret-password-never-log-this');
      expect(logString).not.toContain('ak_never_expose_this_key_in_logs');
      expect(logString).toContain('***REDACTED***');
    });

    test('should handle large objects efficiently', () => {
      const largeObject: any = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`field${i}`] = `value${i}`;
      }
      largeObject.password = 'secret_in_large_object';

      const startTime = Date.now();
      logger.info('Large object test', largeObject);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      const logEntry = testTransport.logs[0];
      expect(logEntry.password).toBe('***REDACTED***');
      expect(logEntry.field0).toBe('value0');
    });
  });
});

/**
 * Integration tests for real logging scenarios
 */
describe('SECURITY: Real-world Logging Scenarios', () => {
  let testTransport: TestTransport;

  beforeEach(() => {
    testTransport = new TestTransport();
    (logger as any).logger.add(testTransport);
  });

  afterEach(() => {
    testTransport.clear();
    (logger as any).logger.remove(testTransport);
  });

  test('should sanitize database connection logs', () => {
    logger.database('Connection established', {
      host: 'localhost',
      port: 5432,
      database: 'myapp',
      password: 'db_secret_password',
      ssl: true,
    });

    const logEntry = testTransport.logs[0];
    expect(logEntry.password).toBe('***REDACTED***');
    expect(logEntry.host).toBe('localhost');
  });

  test('should sanitize authentication logs', () => {
    logger.auth('User login attempt', {
      userId: '12345',
      email: 'user@example.com',
      password: 'user_entered_password',
      success: false,
      ip: '192.168.1.100',
    });

    const logEntry = testTransport.logs[0];
    expect(logEntry.password).toBe('***REDACTED***');
    expect(logEntry.email).toBe('us***@example.com');
    expect(logEntry.userId).toBe('12345');
  });
});
