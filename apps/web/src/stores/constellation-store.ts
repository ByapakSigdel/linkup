import { create } from 'zustand';
import api from '@/lib/api';
import type { Star } from '@/components/games/constellation/types';

interface ConstellationState {
  stars: Star[];
  loading: boolean;
  fetchStars: () => Promise<void>;
  answer: (dto: {
    constellationKey: string; promptKey?: string;
    kind: 'shared' | 'guess' | 'custom'; title: string; contribution: unknown;
  }) => Promise<void>;
  patchStar: (id: string, patch: { photoUrl?: string; matched?: boolean; text?: string }) => Promise<void>;
  applyRemote: (star: Star) => void;
  litPromptKeys: () => string[];
  reset: () => void;
}

function upsertById(list: Star[], star: Star): Star[] {
  const i = list.findIndex((s) => s.id === star.id);
  if (i === -1) return [...list, star];
  const copy = list.slice();
  copy[i] = star;
  return copy;
}

export const useConstellationStore = create<ConstellationState>()((set, get) => ({
  stars: [],
  loading: false,
  fetchStars: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/constellation');
      set({ stars: data.data.stars ?? [] });
    } catch {
      /* keep prior */
    } finally {
      set({ loading: false });
    }
  },
  answer: async (dto) => {
    const { data } = await api.post('/constellation/stars', dto);
    set({ stars: upsertById(get().stars, data.data.star) });
  },
  patchStar: async (id, patch) => {
    const { data } = await api.patch(`/constellation/stars/${id}`, patch);
    set({ stars: upsertById(get().stars, data.data.star) });
  },
  applyRemote: (star) => set({ stars: upsertById(get().stars, star) }),
  litPromptKeys: () =>
    get().stars.filter((s) => s.status === 'lit' && s.promptKey).map((s) => s.promptKey as string),
  reset: () => set({ stars: [], loading: false }),
}));
