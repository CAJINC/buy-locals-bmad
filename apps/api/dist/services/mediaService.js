import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG } from '../config/s3.js';
import { createError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
export class MediaService {
    constructor() {
        this.s3 = s3Client;
    }
    async generateSignedUploadUrl(businessId, filename, mimetype, type) {
        if (!S3_CONFIG.allowedMimeTypes.includes(mimetype)) {
            throw createError('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.', 400);
        }
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
        const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
        return {
            uploadUrl,
            key,
            mediaId,
            expiresAt: new Date(Date.now() + 3600 * 1000)
        };
    }
    async processUploadedMedia(businessId, mediaId, type, description) {
        const key = this.findS3KeyByMediaId(businessId, mediaId, type);
        try {
            const getCommand = new GetObjectCommand({
                Bucket: S3_CONFIG.bucketName,
                Key: key
            });
            const response = await this.s3.send(getCommand);
            if (!response.Body) {
                throw new Error('Failed to download uploaded file');
            }
            const originalBuffer = await this.streamToBuffer(response.Body);
            const metadata = response.Metadata || {};
            const urls = await this.createImageVariants(businessId, mediaId, originalBuffer, type);
            const fileInfo = await sharp(originalBuffer).metadata();
            const mediaItem = {
                id: mediaId,
                businessId,
                type,
                originalUrl: urls.original,
                thumbnailUrl: urls.thumbnail,
                smallUrl: urls.small,
                mediumUrl: urls.medium,
                largeUrl: type === 'photo' ? urls.large : undefined,
                description,
                order: 0,
                fileSize: originalBuffer.length,
                mimetype: metadata.contenttype || 'image/jpeg',
                createdAt: new Date()
            };
            return mediaItem;
        }
        catch (error) {
            await this.deleteMediaFile(businessId, mediaId, type);
            throw createError(`Failed to process uploaded media: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async createImageVariants(businessId, mediaId, originalBuffer, type) {
        const variants = {};
        const sizes = S3_CONFIG.imageSizes;
        const thumbnailBuffer = await sharp(originalBuffer)
            .resize(sizes.thumbnail.width, sizes.thumbnail.height, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
        variants.thumbnail = await this.uploadVariant(businessId, mediaId, 'thumbnail', thumbnailBuffer, type);
        const smallBuffer = await sharp(originalBuffer)
            .resize(sizes.small.width, sizes.small.height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        variants.small = await this.uploadVariant(businessId, mediaId, 'small', smallBuffer, type);
        const mediumBuffer = await sharp(originalBuffer)
            .resize(sizes.medium.width, sizes.medium.height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();
        variants.medium = await this.uploadVariant(businessId, mediaId, 'medium', mediumBuffer, type);
        if (type === 'photo') {
            const largeBuffer = await sharp(originalBuffer)
                .resize(sizes.large.width, sizes.large.height, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 95 })
                .toBuffer();
            variants.large = await this.uploadVariant(businessId, mediaId, 'large', largeBuffer, type);
        }
        variants.original = this.getPublicUrl(this.generateS3Key(businessId, mediaId, '.jpg', type));
        return variants;
    }
    async uploadVariant(businessId, mediaId, variant, buffer, type) {
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
    async deleteMediaFile(businessId, mediaId, type) {
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
            }
            catch (error) {
                console.warn(`Failed to delete variant ${variant} for media ${mediaId}:`, error);
            }
        });
        await Promise.allSettled(deletePromises);
    }
    validateMediaFile(file) {
        const errors = [];
        if (file.size > S3_CONFIG.maxFileSize) {
            errors.push(`File size exceeds maximum allowed size of ${S3_CONFIG.maxFileSize / (1024 * 1024)}MB`);
        }
        if (!S3_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
            errors.push('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
        }
        const extension = this.getFileExtension(file.originalname);
        if (!S3_CONFIG.allowedExtensions.includes(extension)) {
            errors.push('Invalid file extension. Only .jpg, .jpeg, .png, .webp, .gif files are allowed.');
        }
        if (this.containsMaliciousPatterns(file.originalname)) {
            errors.push('Filename contains invalid characters or patterns.');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    generateS3Key(businessId, mediaId, extension, type, variant) {
        const prefix = type === 'logo' ? S3_CONFIG.logoPrefix : S3_CONFIG.photoPrefix;
        const variantSuffix = variant ? `_${variant}` : '';
        return `${prefix}${businessId}/${mediaId}${variantSuffix}${extension}`;
    }
    findS3KeyByMediaId(businessId, mediaId, type) {
        return this.generateS3Key(businessId, mediaId, '.jpg', type);
    }
    getPublicUrl(key) {
        return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
    }
    getFileExtension(filename) {
        return '.' + filename.split('.').pop()?.toLowerCase() || '';
    }
    containsMaliciousPatterns(filename) {
        const maliciousPatterns = [
            /\.\./,
            /[<>:"|?*]/,
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
            /^\./,
            /\.exe$|\.bat$|\.cmd$|\.scr$|\.vbs$|\.js$/i,
        ];
        return maliciousPatterns.some(pattern => pattern.test(filename));
    }
    async streamToBuffer(stream) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }
}
//# sourceMappingURL=mediaService.js.map