import { create } from 'zustand';
import api from '@/lib/api';

export interface CustomEmojiEntry {
  id: string;
  name: string;
  imageUrl: string;
  isAnimated?: boolean;
}

interface CustomEmojiState {
  /** Lookup of custom emoji by its shortcode name (without the colons). */
  byName: Record<string, CustomEmojiEntry>;
  loaded: boolean;
  loading: boolean;
  /** Fetch the couple's custom emojis once (idempotent). */
  load: () => Promise<void>;
  /** Add/refresh a single emoji (e.g. right after creating one). */
  add: (emoji: CustomEmojiEntry) => void;
}

/**
 * Shared registry of the couple's custom emojis so message bubbles can render
 * `:shortcode:` tokens (inserted by the chat emoji picker) as their images.
 */
export const useCustomEmojiStore = create<CustomEmojiState>((set, get) => ({
  byName: {},
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const { data } = await api.get('/creative/emojis');
      const list = (data?.data?.emojis ?? []) as CustomEmojiEntry[];
      const byName: Record<string, CustomEmojiEntry> = {};
      for (const e of list) byName[e.name] = e;
      set({ byName, loaded: true, loading: false });
    } catch {
      // Non-fatal — shortcodes just stay as text until the next load.
      set({ loading: false, loaded: true });
    }
  },
  add: (emoji) =>
    set((s) => ({ byName: { ...s.byName, [emoji.name]: emoji } })),
}));
