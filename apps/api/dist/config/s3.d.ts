import { S3Client } from '@aws-sdk/client-s3';
export declare const s3Client: S3Client;
export declare const S3_CONFIG: {
    readonly bucketName: string;
    readonly region: string;
    readonly mediaPrefix: "business-media/";
    readonly logoPrefix: "business-logos/";
    readonly photoPrefix: "business-photos/";
    readonly tempPrefix: "temp-uploads/";
    readonly maxFileSize: number;
    readonly allowedMimeTypes: readonly ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    readonly allowedExtensions: readonly [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    readonly maxPhotosPerBusiness: 10;
    readonly imageSizes: {
        readonly thumbnail: {
            readonly width: 150;
            readonly height: 150;
        };
        readonly small: {
            readonly width: 400;
            readonly height: 300;
        };
        readonly medium: {
            readonly width: 800;
            readonly height: 600;
        };
        readonly large: {
            readonly width: 1200;
            readonly height: 900;
        };
        readonly logo: {
            readonly width: 300;
            readonly height: 300;
        };
    };
};
//# sourceMappingURL=s3.d.ts.map