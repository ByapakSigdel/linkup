import { create } from 'zustand';
import api from '@/lib/api';

interface StreakData {
  id: string;
  coupleId: string;
  currentStreak: number;
  longestStreak: number;
  lastPhotoDate: string | null;
  lastPhotoId: string | null;
  freezesAvailable: number;
  freezeHistory: Array<{ date: string; reason: string }>;
  canRecover: boolean;
  recoveryDeadline: string | null;
  totalPhotos: number;
  totalPoints: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface StreakHistoryEntry {
  id: string;
  streakId: string;
  eventType: string;
  streakLength: number;
  photoId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface StreaksState {
  streak: StreakData | null;
  history: StreakHistoryEntry[];
  isLoading: boolean;
  isContributing: boolean;
  error: string | null;

  fetchStreak: () => Promise<void>;
  contributePhoto: (photoId: string) => Promise<{
    pointsEarned: number;
    milestoneReached: number | null;
  } | null>;
  freezeStreak: () => Promise<void>;
  recoverStreak: () => Promise<void>;
  fetchHistory: (limit?: number, offset?: number) => Promise<void>;
}

export const useStreaksStore = create<StreaksState>((set, get) => ({
  streak: null,
  history: [],
  isLoading: false,
  isContributing: false,
  error: null,

  fetchStreak: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/streaks');
      set({ streak: data.data.streak, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch streak';
      set({ error: message, isLoading: false });
    }
  },

  contributePhoto: async (photoId: string) => {
    set({ isContributing: true, error: null });
    try {
      const { data } = await api.post('/streaks/photo', { photoId });
      set({
        streak: data.data.streak,
        isContributing: false,
      });
      return {
        pointsEarned: data.data.pointsEarned,
        milestoneReached: data.data.milestoneReached,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to contribute photo';
      set({ error: message, isContributing: false });
      return null;
    }
  },

  freezeStreak: async () => {
    set({ error: null });
    try {
      const { data } = await api.post('/streaks/freeze');
      set({ streak: data.data.streak });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to freeze streak';
      set({ error: message });
    }
  },

  recoverStreak: async () => {
    set({ error: null });
    try {
      const { data } = await api.post('/streaks/recover');
      set({ streak: data.data.streak });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to recover streak';
      set({ error: message });
    }
  },

  fetchHistory: async (limit = 20, offset = 0) => {
    try {
      const { data } = await api.get('/streaks/history', {
        params: { limit, offset },
      });
      if (offset === 0) {
        set({ history: data.data.history });
      } else {
        set({ history: [...get().history, ...data.data.history] });
      }
    } catch {
      // Silently fail for history
    }
  },
}));
