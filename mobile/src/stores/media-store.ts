import { create } from 'zustand';
import api from '@/lib/api';

export interface MediaItem {
  id: string;
  coupleId: string;
  uploaderId: string;
  type: string;
  filename: string;
  originalFilename: string;
  storageKey: string;
  storageBucket: string;
  cdnUrl: string | null;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  processingStatus: string | null;
  thumbnails: { small?: string; medium?: string; large?: string } | null;
  variants: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
  albumId: string | null;
  tags: string[] | null;
  caption: string | null;
  isStreakPhoto: boolean | null;
  streakDate: string | null;
  isFavorite: boolean | null;
  isArchived: boolean | null;
  isDeleted: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAlbum {
  id: string;
  coupleId: string;
  createdBy: string;
  name: string;
  description: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  isShared: boolean | null;
  isAuto: boolean | null;
  mediaCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * RN upload descriptor (from expo-image-picker / document-picker) used in place
 * of the browser `File`. FormData accepts `{ uri, name, type }` on React Native.
 */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

interface UploadProgress {
  id: string;
  file: UploadFile;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  result?: MediaItem;
}

interface MediaState {
  // Media items
  items: MediaItem[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;

  // Albums
  albums: MediaAlbum[];
  isLoadingAlbums: boolean;

  // Filters
  activeTab: 'all' | 'albums';
  typeFilter: string | null;
  albumFilter: string | null;
  streakFilter: boolean;
  favoriteFilter: boolean;

  // Upload
  uploads: UploadProgress[];
  isUploading: boolean;

  // Lightbox
  lightboxIndex: number | null;

  // Actions — data fetching
  fetchMedia: (coupleId: string, offset?: number) => Promise<void>;
  fetchAlbums: (coupleId: string) => Promise<void>;

  // Actions — media operations
  uploadFile: (coupleId: string, file: UploadFile, options?: { albumId?: string; tags?: string[]; caption?: string }) => Promise<MediaItem | null>;
  updateMedia: (mediaId: string, data: { tags?: string[]; albumId?: string | null; caption?: string; isFavorite?: boolean }) => Promise<void>;
  deleteMedia: (mediaId: string) => Promise<void>;
  toggleFavorite: (mediaId: string) => Promise<void>;

  // Actions — album operations
  createAlbum: (coupleId: string, data: { name: string; description?: string }) => Promise<MediaAlbum | null>;
  updateAlbum: (albumId: string, data: { name?: string; description?: string; coverMediaId?: string }) => Promise<void>;
  deleteAlbum: (albumId: string) => Promise<void>;

  // Actions — UI
  setActiveTab: (tab: 'all' | 'albums') => void;
  setTypeFilter: (type: string | null) => void;
  setAlbumFilter: (albumId: string | null) => void;
  setStreakFilter: (on: boolean) => void;
  setFavoriteFilter: (on: boolean) => void;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  lightboxNext: () => void;
  lightboxPrev: () => void;

  // Actions — reset
  reset: () => void;
}

const initialState = {
  items: [] as MediaItem[],
  total: 0,
  isLoading: false,
  hasMore: true,
  albums: [] as MediaAlbum[],
  isLoadingAlbums: false,
  activeTab: 'all' as const,
  typeFilter: null as string | null,
  albumFilter: null as string | null,
  streakFilter: false,
  favoriteFilter: false,
  uploads: [] as UploadProgress[],
  isUploading: false,
  lightboxIndex: null as number | null,
};

export const useMediaStore = create<MediaState>()((set, get) => ({
  ...initialState,

  // ─── Fetch Media ────────────────────────────────────────────────────────────

  fetchMedia: async (coupleId, offset = 0) => {
    set({ isLoading: true });
    try {
      const { typeFilter, albumFilter, streakFilter, favoriteFilter } = get();
      const params: Record<string, string | number | boolean> = {
        coupleId,
        limit: 50,
        offset,
      };
      if (typeFilter) params.type = typeFilter;
      if (albumFilter) params.albumId = albumFilter;
      if (streakFilter) params.isStreakPhoto = 'true';
      if (favoriteFilter) params.isFavorite = 'true';

      const { data } = await api.get<{
        success: boolean;
        data: { items: MediaItem[]; total: number; limit: number; offset: number };
      }>('/media', { params });

      const fetched = data.data.items;

      if (offset === 0) {
        set({
          items: fetched,
          total: data.data.total,
          hasMore: fetched.length >= 50,
        });
      } else {
        set((state) => ({
          items: [...state.items, ...fetched],
          total: data.data.total,
          hasMore: fetched.length >= 50,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // ─── Fetch Albums ──────────────────────────────────────────────────────────

  fetchAlbums: async (coupleId) => {
    set({ isLoadingAlbums: true });
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { albums: MediaAlbum[] };
      }>('/media/albums/list', { params: { coupleId } });

      set({ albums: data.data.albums });
    } catch (error) {
      console.error('Failed to fetch albums:', error);
    } finally {
      set({ isLoadingAlbums: false });
    }
  },

  // ─── Upload ────────────────────────────────────────────────────────────────

  uploadFile: async (coupleId, file, options) => {
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const uploadEntry: UploadProgress = {
      id: uploadId,
      file,
      progress: 0,
      status: 'pending',
    };

    set((state) => ({
      uploads: [...state.uploads, uploadEntry],
      isUploading: true,
    }));

    try {
      const formData = new FormData();
      // On RN, FormData accepts a file descriptor object for multipart uploads.
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
      formData.append('coupleId', coupleId);

      if (options?.albumId) formData.append('albumId', options.albumId);
      if (options?.tags) formData.append('tags', JSON.stringify(options.tags));
      if (options?.caption) formData.append('caption', options.caption);

      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === uploadId ? { ...u, status: 'uploading' as const } : u,
        ),
      }));

      const { data } = await api.post<{
        success: boolean;
        data: { media: MediaItem };
      }>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
            : 0;
          set((state) => ({
            uploads: state.uploads.map((u) =>
              u.id === uploadId ? { ...u, progress } : u,
            ),
          }));
        },
      });

      const mediaItem = data.data.media;

      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === uploadId
            ? { ...u, status: 'complete' as const, progress: 100, result: mediaItem }
            : u,
        ),
        items: [mediaItem, ...state.items],
        total: state.total + 1,
      }));

      // Clean up completed upload after a delay
      setTimeout(() => {
        set((state) => ({
          uploads: state.uploads.filter((u) => u.id !== uploadId),
          isUploading: state.uploads.filter((u) => u.id !== uploadId).some((u) => u.status === 'uploading'),
        }));
      }, 3000);

      return mediaItem;
    } catch (error) {
      console.error('Upload failed:', error);
      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === uploadId
            ? { ...u, status: 'error' as const, error: 'Upload failed' }
            : u,
        ),
        isUploading: state.uploads.some((u) => u.id !== uploadId && u.status === 'uploading'),
      }));
      return null;
    }
  },

  // ─── Media Operations ──────────────────────────────────────────────────────

  updateMedia: async (mediaId, data) => {
    try {
      const { data: response } = await api.patch<{
        success: boolean;
        data: { media: MediaItem };
      }>(`/media/${mediaId}`, data);

      set((state) => ({
        items: state.items.map((item) =>
          item.id === mediaId ? response.data.media : item,
        ),
      }));
    } catch (error) {
      console.error('Failed to update media:', error);
    }
  },

  deleteMedia: async (mediaId) => {
    try {
      await api.delete(`/media/${mediaId}`);
      set((state) => ({
        items: state.items.filter((item) => item.id !== mediaId),
        total: state.total - 1,
      }));
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  },

  toggleFavorite: async (mediaId) => {
    const item = get().items.find((i) => i.id === mediaId);
    if (!item) return;

    const newValue = !item.isFavorite;

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        i.id === mediaId ? { ...i, isFavorite: newValue } : i,
      ),
    }));

    try {
      await api.patch(`/media/${mediaId}`, { isFavorite: newValue });
    } catch (error) {
      // Revert on failure
      set((state) => ({
        items: state.items.map((i) =>
          i.id === mediaId ? { ...i, isFavorite: !newValue } : i,
        ),
      }));
      console.error('Failed to toggle favorite:', error);
    }
  },

  // ─── Album Operations ─────────────────────────────────────────────────────

  createAlbum: async (coupleId, data) => {
    try {
      const { data: response } = await api.post<{
        success: boolean;
        data: { album: MediaAlbum };
      }>('/media/albums', { coupleId, ...data });

      const album = response.data.album;
      set((state) => ({
        albums: [album, ...state.albums],
      }));
      return album;
    } catch (error) {
      console.error('Failed to create album:', error);
      return null;
    }
  },

  updateAlbum: async (albumId, data) => {
    try {
      const { data: response } = await api.patch<{
        success: boolean;
        data: { album: MediaAlbum };
      }>(`/media/albums/${albumId}`, data);

      set((state) => ({
        albums: state.albums.map((a) =>
          a.id === albumId ? { ...response.data.album, coverUrl: a.coverUrl } : a,
        ),
      }));
    } catch (error) {
      console.error('Failed to update album:', error);
    }
  },

  deleteAlbum: async (albumId) => {
    try {
      await api.delete(`/media/albums/${albumId}`);
      set((state) => ({
        albums: state.albums.filter((a) => a.id !== albumId),
      }));
    } catch (error) {
      console.error('Failed to delete album:', error);
    }
  },

  // ─── UI ────────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setAlbumFilter: (albumId) => set({ albumFilter: albumId }),
  setStreakFilter: (on) => set({ streakFilter: on }),
  setFavoriteFilter: (on) => set({ favoriteFilter: on }),

  openLightbox: (index) => set({ lightboxIndex: index }),
  closeLightbox: () => set({ lightboxIndex: null }),

  lightboxNext: () =>
    set((state) => {
      if (state.lightboxIndex === null) return {};
      const nextIndex = state.lightboxIndex + 1;
      return { lightboxIndex: nextIndex < state.items.length ? nextIndex : 0 };
    }),

  lightboxPrev: () =>
    set((state) => {
      if (state.lightboxIndex === null) return {};
      const prevIndex = state.lightboxIndex - 1;
      return {
        lightboxIndex: prevIndex >= 0 ? prevIndex : state.items.length - 1,
      };
    }),

  // Reset
  reset: () => set(initialState),
}));
