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
export declare class MediaService {
    private s3;
    constructor();
    generateSignedUploadUrl(businessId: string, filename: string, mimetype: string, type: 'logo' | 'photo'): Promise<SignedUploadUrl>;
    processUploadedMedia(businessId: string, mediaId: string, type: 'logo' | 'photo', description?: string): Promise<MediaItem>;
    private createImageVariants;
    private uploadVariant;
    deleteMediaFile(businessId: string, mediaId: string, type: 'logo' | 'photo'): Promise<void>;
    validateMediaFile(file: {
        size: number;
        mimetype: string;
        originalname: string;
    }): {
        isValid: boolean;
        errors: string[];
    };
    private generateS3Key;
    private findS3KeyByMediaId;
    private getPublicUrl;
    private getFileExtension;
    private containsMaliciousPatterns;
    private streamToBuffer;
}
//# sourceMappingURL=mediaService.d.ts.map