import 'jest';
beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/buy_locals_test';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST123456';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.AWS_REGION = 'us-east-1';
});
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
    CognitoIdentityProviderClient: jest.fn(),
    AdminCreateUserCommand: jest.fn(),
    AdminSetUserPasswordCommand: jest.fn(),
    AdminInitiateAuthCommand: jest.fn(),
    AdminRespondToAuthChallengeCommand: jest.fn(),
    AdminGetUserCommand: jest.fn(),
    AdminUpdateUserAttributesCommand: jest.fn(),
    ForgotPasswordCommand: jest.fn(),
    ConfirmForgotPasswordCommand: jest.fn(),
    AdminDeleteUserCommand: jest.fn(),
}));
jest.mock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
        create: jest.fn(() => ({
            verify: jest.fn(),
        })),
    },
}));
jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
        isOpen: true,
        connect: jest.fn(),
        disconnect: jest.fn(),
        on: jest.fn(),
        zRemRangeByScore: jest.fn(),
        zCard: jest.fn(),
        zAdd: jest.fn(),
        expire: jest.fn(),
        zRemRangeByRank: jest.fn(),
        incr: jest.fn(),
        exists: jest.fn(),
        ttl: jest.fn(),
        setEx: jest.fn(),
        del: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
    })),
}));
jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn(),
        connect: jest.fn(),
        end: jest.fn(),
    })),
}));
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
//# sourceMappingURL=setup.js.map