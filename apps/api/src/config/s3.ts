import { S3Client } from '@aws-sdk/client-s3';
import { config } from './environment.js';

export const s3Client = new S3Client({
  region: config.awsRegion,
  // Credentials are automatically loaded from environment or IAM role
});

export const S3_CONFIG = {
  bucketName: config.s3BucketName,
  region: config.awsRegion,
  mediaPrefix: 'business-media/',
  logoPrefix: 'business-logos/',
  photoPrefix: 'business-photos/',
  tempPrefix: 'temp-uploads/',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  maxPhotosPerBusiness: 10,
  imageSizes: {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 300 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 900 },
    logo: { width: 300, height: 300 }
  }
} as const;