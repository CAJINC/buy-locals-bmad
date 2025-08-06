import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG } from '../config/s3.js';
import { createError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export interface MediaUploadRequest {
  businessId: string;
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  };
  type: 'logo' | 'photo';
  description?: string;
}

export interface MediaItem {
  id: string;
  businessId: string;
  type: 'logo' | 'photo';
  originalUrl: string;
  thumbnailUrl: string;
  smallUrl: string;
  mediumUrl: string;
  largeUrl?: string;
  description?: string;
  order: number;
  fileSize: number;
  mimetype: string;
  createdAt: Date;
}

export interface SignedUploadUrl {
  uploadUrl: string;
  key: string;
  mediaId: string;
  expiresAt: Date;
}

export class MediaService {
  private s3: S3Client;

  constructor() {
    this.s3 = s3Client;
  }

  /**
   * Generate signed URL for direct browser upload
   */
  async generateSignedUploadUrl(
    businessId: string, 
    filename: string, 
    mimetype: string,
    type: 'logo' | 'photo'
  ): Promise<SignedUploadUrl> {
    // Validate file type
    if (!S3_CONFIG.allowedMimeTypes.includes(mimetype)) {
      throw createError('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.', 400);
    }

    // Validate file extension
    const extension = this.getFileExtension(filename);
    if (!S3_CONFIG.allowedExtensions.includes(extension)) {
      throw createError('Invalid file extension. Only .jpg, .jpeg, .png, .webp, .gif files are allowed.', 400);
    }

    const mediaId = uuidv4();
    const key = this.generateS3Key(businessId, mediaId, extension, type);
    
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
      ContentType: mimetype,
      Metadata: {
        businessId,
        mediaId,
        type,
        originalFilename: filename
      }
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hour
    
    return {
      uploadUrl,
      key,
      mediaId,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };
  }

  /**
   * Process uploaded media file (resize, optimize, create variants)
   */
  async processUploadedMedia(
    businessId: string,
    mediaId: string,
    type: 'logo' | 'photo',
    description?: string
  ): Promise<MediaItem> {
    const key = this.findS3KeyByMediaId(businessId, mediaId, type);
    
    try {
      // Download original file from S3
      const getCommand = new GetObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: key
      });
      
      const response = await this.s3.send(getCommand);
      if (!response.Body) {
        throw new Error('Failed to download uploaded file');
      }

      const originalBuffer = await this.streamToBuffer(response.Body as any);
      const metadata = response.Metadata || {};
      
      // Process and upload different sizes
      const urls = await this.createImageVariants(businessId, mediaId, originalBuffer, type);
      
      // Get file info
      const fileInfo = await sharp(originalBuffer).metadata();
      
      const mediaItem: MediaItem = {
        id: mediaId,
        businessId,
        type,
        originalUrl: urls.original,
        thumbnailUrl: urls.thumbnail,
        smallUrl: urls.small,
        mediumUrl: urls.medium,
        largeUrl: type === 'photo' ? urls.large : undefined,
        description,
        order: 0, // Will be set by business service
        fileSize: originalBuffer.length,
        mimetype: metadata.contenttype || 'image/jpeg',
        createdAt: new Date()
      };

      return mediaItem;
    } catch (error) {
      // Clean up failed upload
      await this.deleteMediaFile(businessId, mediaId, type);
      throw createError(`Failed to process uploaded media: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Create multiple image sizes from original
   */
  private async createImageVariants(
    businessId: string,
    mediaId: string,
    originalBuffer: Buffer,
    type: 'logo' | 'photo'
  ): Promise<{
    original: string;
    thumbnail: string;
    small: string;
    medium: string;
    large?: string;
  }> {
    const variants: any = {};
    const sizes = S3_CONFIG.imageSizes;
    
    // Create thumbnail
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(sizes.thumbnail.width, sizes.thumbnail.height, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    variants.thumbnail = await this.uploadVariant(businessId, mediaId, 'thumbnail', thumbnailBuffer, type);

    // Create small variant
    const smallBuffer = await sharp(originalBuffer)
      .resize(sizes.small.width, sizes.small.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    variants.small = await this.uploadVariant(businessId, mediaId, 'small', smallBuffer, type);

    // Create medium variant
    const mediumBuffer = await sharp(originalBuffer)
      .resize(sizes.medium.width, sizes.medium.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    
    variants.medium = await this.uploadVariant(businessId, mediaId, 'medium', mediumBuffer, type);

    // Create large variant for photos only
    if (type === 'photo') {
      const largeBuffer = await sharp(originalBuffer)
        .resize(sizes.large.width, sizes.large.height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();
      
      variants.large = await this.uploadVariant(businessId, mediaId, 'large', largeBuffer, type);
    }

    // Original URL
    variants.original = this.getPublicUrl(this.generateS3Key(businessId, mediaId, '.jpg', type));

    return variants;
  }

  /**
   * Upload image variant to S3
   */
  private async uploadVariant(
    businessId: string,
    mediaId: string,
    variant: string,
    buffer: Buffer,
    type: 'logo' | 'photo'
  ): Promise<string> {
    const key = this.generateS3Key(businessId, mediaId, '.jpg', type, variant);
    
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
      Metadata: {
        businessId,
        mediaId,
        type,
        variant
      }
    });

    await this.s3.send(command);
    return this.getPublicUrl(key);
  }

  /**
   * Delete media file and all its variants
   */
  async deleteMediaFile(businessId: string, mediaId: string, type: 'logo' | 'photo'): Promise<void> {
    const variants = ['original', 'thumbnail', 'small', 'medium'];
    if (type === 'photo') {
      variants.push('large');
    }

    const deletePromises = variants.map(async (variant) => {
      const key = variant === 'original' 
        ? this.generateS3Key(businessId, mediaId, '.jpg', type)
        : this.generateS3Key(businessId, mediaId, '.jpg', type, variant);
      
      try {
        await this.s3.send(new DeleteObjectCommand({
          Bucket: S3_CONFIG.bucketName,
          Key: key
        }));
      } catch (error) {
        // Continue deletion even if some variants fail
        console.warn(`Failed to delete variant ${variant} for media ${mediaId}:`, error);
      }
    });

    await Promise.allSettled(deletePromises);
  }

  /**
   * Validate media file
   */
  validateMediaFile(file: { size: number; mimetype: string; originalname: string }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (file.size > S3_CONFIG.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${S3_CONFIG.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check mime type
    if (!S3_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
      errors.push('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
    }

    // Check file extension
    const extension = this.getFileExtension(file.originalname);
    if (!S3_CONFIG.allowedExtensions.includes(extension)) {
      errors.push('Invalid file extension. Only .jpg, .jpeg, .png, .webp, .gif files are allowed.');
    }

    // Security: Check for malicious filenames
    if (this.containsMaliciousPatterns(file.originalname)) {
      errors.push('Filename contains invalid characters or patterns.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate S3 key for media file
   */
  private generateS3Key(
    businessId: string, 
    mediaId: string, 
    extension: string, 
    type: 'logo' | 'photo',
    variant?: string
  ): string {
    const prefix = type === 'logo' ? S3_CONFIG.logoPrefix : S3_CONFIG.photoPrefix;
    const variantSuffix = variant ? `_${variant}` : '';
    return `${prefix}${businessId}/${mediaId}${variantSuffix}${extension}`;
  }

  /**
   * Find S3 key by media ID (for cleanup)
   */
  private findS3KeyByMediaId(businessId: string, mediaId: string, type: 'logo' | 'photo'): string {
    // This is a simplified version - in production, you might store the key mapping
    return this.generateS3Key(businessId, mediaId, '.jpg', type);
  }

  /**
   * Get public URL for S3 object
   */
  private getPublicUrl(key: string): string {
    return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return '.' + filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Check for malicious filename patterns
   */
  private containsMaliciousPatterns(filename: string): boolean {
    const maliciousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid filesystem characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
      /^\./,            // Hidden files
      /\.exe$|\.bat$|\.cmd$|\.scr$|\.vbs$|\.js$/i, // Executable extensions
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}