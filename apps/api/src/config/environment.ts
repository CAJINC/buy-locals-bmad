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
  
  // External API Keys
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  
  // AWS S3 Configuration
  s3BucketName: process.env.S3_BUCKET_NAME || 'buy-locals-media-dev',
  
  // AWS Cognito Configuration
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
  cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
  cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET || '',
} as const;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

export const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};