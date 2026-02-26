// ============================================
// Media Types
// ============================================

export interface Photo {
  id: string;
  coupleId: string;
  uploadedBy: string;

  // File info
  originalUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;

  // Dimensions
  width: number;
  height: number;
  aspectRatio: number;

  // Metadata
  takenAt?: string;
  location?: MediaLocation;

  // Organization
  albumIds: string[];
  tags: string[];
  description?: string;
  isFavorite: boolean;

  // Privacy
  visibility: ContentVisibility;

  uploadedAt: string;
  createdAt: string;
}

export interface Video {
  id: string;
  coupleId: string;
  uploadedBy: string;

  // File info
  originalUrl: string;
  streamingUrls: Record<string, string>;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;

  // Video properties
  duration: number;
  width: number;
  height: number;
  fps: number;

  // Metadata
  takenAt?: string;
  location?: MediaLocation;

  // Organization
  albumIds: string[];
  tags: string[];
  description?: string;
  isFavorite: boolean;

  // Processing
  processingStatus: 'uploading' | 'processing' | 'ready' | 'failed';
  processingProgress?: number;

  uploadedAt: string;
  createdAt: string;
}

export interface Album {
  id: string;
  coupleId: string;
  name: string;
  description?: string;
  coverPhotoId?: string;
  coverPhotoUrl?: string;
  type: 'manual' | 'smart';
  photoCount: number;
  lastPhotoAddedAt?: string;
  isShared: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
}

export type ContentVisibility =
  | 'private'
  | 'friends'
  | 'selected_friends'
  | 'circles'
  | 'friends_and_circles';
