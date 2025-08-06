import { APIGatewayProxyHandler } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateParams } from '../../middleware/validation.js';
import { AuthenticatedRequest, authenticateToken } from '../../middleware/auth.js';
import { MediaService } from '../../services/mediaService.js';
import { BusinessService } from '../../services/businessService.js';
import { businessIdParamSchema } from '../../schemas/businessSchemas.js';
import { S3_CONFIG } from '../../config/s3.js';

validateEnvironment();

const app = express();
const mediaService = new MediaService();
const businessService = new BusinessService();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: S3_CONFIG.maxFileSize,
    files: 1, // One file at a time
  },
  fileFilter: (req, file, cb) => {
    const validation = mediaService.validateMediaFile({
      size: 0, // Size will be checked by multer limits
      mimetype: file.mimetype,
      originalname: file.originalname,
    });

    if (validation.isValid) {
      cb(null, true);
    } else {
      cb(new Error(validation.errors.join(', ')));
    }
  },
});

// POST /businesses/{businessId}/media - Upload business media
app.post(
  '/businesses/:businessId/media',
  authenticateToken,
  validateParams(businessIdParamSchema),
  upload.single('media'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user?.id;
      const { businessId } = req.params;
      const { type = 'photo', description } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate media type
      if (!['logo', 'photo'].includes(type)) {
        return res.status(400).json({ error: 'Media type must be either "logo" or "photo"' });
      }

      // Verify business ownership
      const business = await businessService.getBusinessById(businessId);
      if (business.owner_id !== userId) {
        return res
          .status(403)
          .json({ error: 'Access denied: You can only upload media to your own business' });
      }

      // Check if business already has max photos
      const currentMediaCount = business.media?.length || 0;
      if (type === 'photo' && currentMediaCount >= S3_CONFIG.maxPhotosPerBusiness) {
        return res.status(400).json({
          error: `Maximum ${S3_CONFIG.maxPhotosPerBusiness} photos allowed per business`,
        });
      }

      // Validate file again with actual size
      const validation = mediaService.validateMediaFile({
        size: req.file.size,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });

      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      // Generate signed upload URL (for direct upload approach)
      const signedUrl = await mediaService.generateSignedUploadUrl(
        businessId,
        req.file.originalname,
        req.file.mimetype,
        type
      );

      // For immediate upload, we would process the file here
      // But for this implementation, we'll return the signed URL for client-side upload
      res.status(200).json({
        success: true,
        message: 'Upload URL generated successfully',
        upload: {
          uploadUrl: signedUrl.uploadUrl,
          mediaId: signedUrl.mediaId,
          expiresAt: signedUrl.expiresAt,
          type,
          description,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /businesses/{businessId}/media/process - Process uploaded media
app.post(
  '/businesses/:businessId/media/process',
  authenticateToken,
  validateParams(businessIdParamSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user?.id;
      const { businessId } = req.params;
      const { mediaId, type, description } = req.body;

      if (!userId || !mediaId || !type) {
        return res.status(400).json({ error: 'Missing required fields: mediaId, type' });
      }

      // Verify business ownership
      const business = await businessService.getBusinessById(businessId);
      if (business.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Process the uploaded media
      const mediaItem = await mediaService.processUploadedMedia(
        businessId,
        mediaId,
        type,
        description
      );

      // Update business media array
      const currentMedia = business.media || [];
      const updatedMedia = [
        ...currentMedia,
        {
          id: mediaItem.id,
          url: mediaItem.mediumUrl,
          type: mediaItem.type,
          description: mediaItem.description,
        },
      ];

      await businessService.updateBusiness(businessId, userId, { media: updatedMedia });

      res.status(201).json({
        success: true,
        message: 'Media uploaded and processed successfully',
        media: mediaItem,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /businesses/{businessId}/media/{mediaId} - Delete business media
app.delete(
  '/businesses/:businessId/media/:mediaId',
  authenticateToken,
  validateParams(businessIdParamSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user?.id;
      const { businessId, mediaId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify business ownership
      const business = await businessService.getBusinessById(businessId);
      if (business.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Find media item in business
      const currentMedia = business.media || [];
      const mediaToDelete = currentMedia.find(m => m.id === mediaId);

      if (!mediaToDelete) {
        return res.status(404).json({ error: 'Media not found' });
      }

      // Delete from S3
      await mediaService.deleteMediaFile(businessId, mediaId, mediaToDelete.type);

      // Update business media array
      const updatedMedia = currentMedia.filter(m => m.id !== mediaId);
      await businessService.updateBusiness(businessId, userId, { media: updatedMedia });

      res.json({
        success: true,
        message: 'Media deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /businesses/{businessId}/media - List business media
app.get(
  '/businesses/:businessId/media',
  validateParams(businessIdParamSchema),
  async (req, res, next) => {
    try {
      const { businessId } = req.params;

      const business = await businessService.getBusinessById(businessId);
      const media = business.media || [];

      res.json({
        success: true,
        media: media.sort((a, _b) => (a.type === 'logo' ? -1 : 1)), // Logo first
      });
    } catch (error) {
      next(error);
    }
  }
);

app.use(errorHandler);

export const handler: APIGatewayProxyHandler = serverless(app);
