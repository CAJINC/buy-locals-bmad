export const config = {
    stage: process.env.STAGE || 'dev',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    jwtSecret: process.env.JWT_SECRET || (() => {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET is required in production');
        }
        return 'dev-only-secret-key-change-in-production';
    })(),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME || 'buy-locals-media-dev',
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
    cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET || '',
};
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
export const validateEnvironment = () => {
    const missing = requiredEnvVars.filter(key => !config[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
//# sourceMappingURL=environment.js.map