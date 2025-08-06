import { MediaService } from '../../services/mediaService.js';
import { S3_CONFIG } from '../../config/s3.js';

// Mock S3 client
jest.mock('../../config/s3.js', () => ({
  s3Client: {},
  S3_CONFIG: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    maxPhotosPerBusiness: 10
  }
}));

describe('MediaService', () => {
  let mediaService: MediaService;

  beforeEach(() => {
    mediaService = new MediaService();
  });

  describe('validateMediaFile', () => {
    it('should validate correct image files', () => {
      const validFile = {
        size: 1024 * 1024, // 1MB
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg'
      };

      const result = mediaService.validateMediaFile(validFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject files that are too large', () => {
      const largeFile = {
        size: 15 * 1024 * 1024, // 15MB
        mimetype: 'image/jpeg',
        originalname: 'large-photo.jpg'
      };

      const result = mediaService.validateMediaFile(largeFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum allowed size of 10MB');
    });

    it('should reject invalid mime types', () => {
      const invalidFile = {
        size: 1024 * 1024,
        mimetype: 'application/pdf',
        originalname: 'document.pdf'
      };

      const result = mediaService.validateMediaFile(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
    });

    it('should reject invalid file extensions', () => {
      const invalidFile = {
        size: 1024 * 1024,
        mimetype: 'image/jpeg',
        originalname: 'photo.exe'
      };

      const result = mediaService.validateMediaFile(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid file extension. Only .jpg, .jpeg, .png, .webp, .gif files are allowed.');
    });

    it('should reject files with malicious filenames', () => {
      const maliciousFiles = [
        { size: 1024, mimetype: 'image/jpeg', originalname: '../../../etc/passwd.jpg' },
        { size: 1024, mimetype: 'image/png', originalname: 'photo<script>.png' },
        { size: 1024, mimetype: 'image/gif', originalname: 'CON.gif' },
        { size: 1024, mimetype: 'image/webp', originalname: '.hidden.webp' },
        { size: 1024, mimetype: 'image/jpeg', originalname: 'virus.exe.jpg' }
      ];

      maliciousFiles.forEach(file => {
        const result = mediaService.validateMediaFile(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Filename contains invalid characters or patterns.');
      });
    });

    it('should allow valid image files with various extensions', () => {
      const validFiles = [
        { size: 1024, mimetype: 'image/jpeg', originalname: 'photo.jpg' },
        { size: 1024, mimetype: 'image/jpeg', originalname: 'photo.jpeg' },
        { size: 1024, mimetype: 'image/png', originalname: 'logo.png' },
        { size: 1024, mimetype: 'image/webp', originalname: 'modern.webp' },
        { size: 1024, mimetype: 'image/gif', originalname: 'animation.gif' }
      ];

      validFiles.forEach(file => {
        const result = mediaService.validateMediaFile(file);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should handle multiple validation errors', () => {
      const invalidFile = {
        size: 20 * 1024 * 1024, // Too large
        mimetype: 'application/pdf', // Wrong type
        originalname: '../malicious.exe' // Malicious filename
      };

      const result = mediaService.validateMediaFile(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });
});