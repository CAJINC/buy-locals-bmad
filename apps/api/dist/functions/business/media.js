import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { config, validateEnvironment } from '../../config/environment.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validateParams } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
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
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: S3_CONFIG.maxFileSize,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const validation = mediaService.validateMediaFile({
            size: 0,
            mimetype: file.mimetype,
            originalname: file.originalname
        });
        if (validation.isValid) {
            cb(null, true);
        }
        else {
            cb(new Error(validation.errors.join(', ')));
        }
    }
});
app.post('/businesses/:businessId/media', authenticateToken, validateParams(businessIdParamSchema), upload.single('media'), async (req, res, next) => {
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
        if (!['logo', 'photo'].includes(type)) {
            return res.status(400).json({ error: 'Media type must be either "logo" or "photo"' });
        }
        const business = await businessService.getBusinessById(businessId);
        if (business.owner_id !== userId) {
            return res.status(403).json({ error: 'Access denied: You can only upload media to your own business' });
        }
        const currentMediaCount = business.media?.length || 0;
        if (type === 'photo' && currentMediaCount >= S3_CONFIG.maxPhotosPerBusiness) {
            return res.status(400).json({
                error: `Maximum ${S3_CONFIG.maxPhotosPerBusiness} photos allowed per business`
            });
        }
        const validation = mediaService.validateMediaFile({
            size: req.file.size,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
        });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors.join(', ') });
        }
        const signedUrl = await mediaService.generateSignedUploadUrl(businessId, req.file.originalname, req.file.mimetype, type);
        res.status(200).json({
            success: true,
            message: 'Upload URL generated successfully',
            upload: {
                uploadUrl: signedUrl.uploadUrl,
                mediaId: signedUrl.mediaId,
                expiresAt: signedUrl.expiresAt,
                type,
                description
            }
        });
    }
    catch (error) {
        next(error);
    }
});
app.post('/businesses/:businessId/media/process', authenticateToken, validateParams(businessIdParamSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { businessId } = req.params;
        const { mediaId, type, description } = req.body;
        if (!userId || !mediaId || !type) {
            return res.status(400).json({ error: 'Missing required fields: mediaId, type' });
        }
        const business = await businessService.getBusinessById(businessId);
        if (business.owner_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const mediaItem = await mediaService.processUploadedMedia(businessId, mediaId, type, description);
        const currentMedia = business.media || [];
        const updatedMedia = [...currentMedia, {
                id: mediaItem.id,
                url: mediaItem.mediumUrl,
                type: mediaItem.type,
                description: mediaItem.description
            }];
        await businessService.updateBusiness(businessId, userId, { media: updatedMedia });
        res.status(201).json({
            success: true,
            message: 'Media uploaded and processed successfully',
            media: mediaItem
        });
    }
    catch (error) {
        next(error);
    }
});
app.delete('/businesses/:businessId/media/:mediaId', authenticateToken, validateParams(businessIdParamSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { businessId, mediaId } = req.params;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const business = await businessService.getBusinessById(businessId);
        if (business.owner_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const currentMedia = business.media || [];
        const mediaToDelete = currentMedia.find(m => m.id === mediaId);
        if (!mediaToDelete) {
            return res.status(404).json({ error: 'Media not found' });
        }
        await mediaService.deleteMediaFile(businessId, mediaId, mediaToDelete.type);
        const updatedMedia = currentMedia.filter(m => m.id !== mediaId);
        await businessService.updateBusiness(businessId, userId, { media: updatedMedia });
        res.json({
            success: true,
            message: 'Media deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
app.get('/businesses/:businessId/media', validateParams(businessIdParamSchema), async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const business = await businessService.getBusinessById(businessId);
        const media = business.media || [];
        res.json({
            success: true,
            media: media.sort((a, b) => (a.type === 'logo' ? -1 : 1))
        });
    }
    catch (error) {
        next(error);
    }
});
app.use(errorHandler);
export const handler = serverless(app);
//# sourceMappingURL=media.js.map