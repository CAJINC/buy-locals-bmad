export interface UploadedImage {
  id: string;
  uri: string;
  type: 'logo' | 'photo';
  fileName: string;
  fileSize: number;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

export interface ImageUploadProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  businessId?: string;
  isLoading?: boolean;
  onUploadStart?: (imageId: string) => void;
  onUploadProgress?: (imageId: string, progress: number) => void;
  onUploadComplete?: (imageId: string, url: string) => void;
  onUploadError?: (imageId: string, error: string) => void;
}

export interface PhotoUploadProps extends ImageUploadProps {
  maxPhotos?: number;
  enableReordering?: boolean;
}

export interface LogoUploadProps {
  logo: UploadedImage | null;
  onLogoChange: (logo: UploadedImage | null) => void;
  businessId?: string;
  isLoading?: boolean;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (url: string) => void;
  onUploadError?: (error: string) => void;
}

export interface CompressionOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'png';
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}