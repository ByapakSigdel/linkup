import { create } from 'zustand';

// §Phase2 DM — a tiny global store for the Circles direct-message unread state.
// It exists so the unread badge can render in app chrome (the sidebar Circles
// nav + the Circles home header) without each of those mounting an inbox.
//
// `byConversation` maps conversationId -> unread count; `totalUnread` is the
// sum (recomputed on every mutation so subscribers re-render). The inbox seeds
// it from GET /circles/conversations; the RealtimeProvider bumps it on an
// incoming `circle:dm:new` and clears a conversation on `circle:dm:read`.

interface CircleDmState {
  byConversation: Record<string, number>;
  totalUnread: number;
  /** Replace the whole map from a fresh inbox fetch. */
  setFromInbox: (entries: { id: string; unreadCount: number }[]) => void;
  /** Increment one conversation's unread count (incoming message). */
  bump: (conversationId: string, by?: number) => void;
  /** Zero a single conversation's unread (opened / marked read). */
  clear: (conversationId: string) => void;
  /** Set an exact count for one conversation (inbox row reconciliation). */
  setConversation: (conversationId: string, count: number) => void;
  /** Reset everything (e.g. on sign-out). */
  reset: () => void;
}

function sum(map: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(map)) total += v;
  return total;
}

export const useCircleDmStore = create<CircleDmState>()((set) => ({
  byConversation: {},
  totalUnread: 0,

  setFromInbox: (entries) =>
    set(() => {
      const byConversation: Record<string, number> = {};
      for (const e of entries) {
        if (e.unreadCount > 0) byConversation[e.id] = e.unreadCount;
      }
      return { byConversation, totalUnread: sum(byConversation) };
    }),

  bump: (conversationId, by = 1) =>
    set((state) => {
      const byConversation = {
        ...state.byConversation,
        [conversationId]: (state.byConversation[conversationId] ?? 0) + by,
      };
      return { byConversation, totalUnread: sum(byConversation) };
    }),

  clear: (conversationId) =>
    set((state) => {
      if (!state.byConversation[conversationId]) return state;
      const byConversation = { ...state.byConversation };
      delete byConversation[conversationId];
      return { byConversation, totalUnread: sum(byConversation) };
    }),

  setConversation: (conversationId, count) =>
    set((state) => {
      const byConversation = { ...state.byConversation };
      if (count > 0) byConversation[conversationId] = count;
      else delete byConversation[conversationId];
      return { byConversation, totalUnread: sum(byConversation) };
    }),

  reset: () => set({ byConversation: {}, totalUnread: 0 }),
}));
