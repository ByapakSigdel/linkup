import { create } from 'zustand';
import type { Message, MessageStatus, HighlightCategory } from '@linkup/types';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

interface ChatState {
  // Connection
  isConnected: boolean;

  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;

  // Unread (incoming messages received while the chat isn't open)
  unread: number;
  chatOpen: boolean;

  // Partner state
  isPartnerTyping: boolean;
  isPartnerOnline: boolean;
  partnerLastSeenAt: string | undefined;

  // UI state
  replyingTo: Message | null;
  editingMessage: Message | null;
  highlightingMessage: Message | null;

  // Actions — connection
  setConnected: (connected: boolean) => void;

  // Actions — unread / open state
  setChatOpen: (open: boolean) => void;

  // Actions — messages
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus, readAt?: string) => void;
  replaceOptimisticMessage: (tempId: string, realMessage: Message) => void;
  setMessages: (messages: Message[]) => void;
  appendOlderMessages: (messages: Message[]) => void;

  // Actions — partner
  setPartnerTyping: (isTyping: boolean) => void;
  setPartnerPresence: (isOnline: boolean, lastSeenAt?: string) => void;

  // Actions — reactions
  addReaction: (
    messageId: string,
    reaction: { userId: string; emoji: string; timestamp: string },
  ) => void;
  removeReaction: (messageId: string, userId: string, emoji: string) => void;

  // Actions — highlight
  highlightMessage: (
    messageId: string,
    category: HighlightCategory,
    color: string,
    note?: string,
  ) => void;

  // Actions — UI
  setReplyingTo: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;
  setHighlightingMessage: (message: Message | null) => void;

  // Actions — API
  // Returns a status so callers (e.g. the Memorial) can distinguish a genuine
  // empty thread from a `forbidden` (archived-couple membership not honored by
  // the API) or other fetch error and show the right state. Existing callers
  // ignore the return — backward compatible with the previous `Promise<void>`.
  fetchMessages: (coupleId: string, offset?: number) => Promise<'ok' | 'forbidden' | 'error'>;

  // Actions — reset
  reset: () => void;
}

const initialState = {
  isConnected: false,
  messages: [] as Message[],
  isLoadingMessages: false,
  hasMoreMessages: true,
  unread: 0,
  chatOpen: false,
  isPartnerTyping: false,
  isPartnerOnline: false,
  partnerLastSeenAt: undefined as string | undefined,
  replyingTo: null as Message | null,
  editingMessage: null as Message | null,
  highlightingMessage: null as Message | null,
};

export const useChatStore = create<ChatState>()((set, get) => ({
  ...initialState,

  // Connection
  setConnected: (connected) => set({ isConnected: connected }),

  // Open state — opening the chat clears the unread badge.
  setChatOpen: (open) =>
    set(open ? { chatOpen: true, unread: 0 } : { chatOpen: false }),

  // Messages
  addMessage: (message) =>
    set((state) => {
      const me = useAuthStore.getState().user?.id;
      const incoming = !!me && message.senderId !== me;
      return {
        messages: [...state.messages, message],
        unread:
          incoming && !state.chatOpen ? state.unread + 1 : state.unread,
      };
    }),

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m,
      ),
    })),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, isDeleted: true, content: 'This message was deleted' }
          : m,
      ),
    })),

  updateMessageStatus: (messageId, status, readAt) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, status, ...(readAt ? { readAt } : {}) }
          : m,
      ),
    })),

  replaceOptimisticMessage: (tempId, realMessage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? realMessage : m,
      ),
    })),

  setMessages: (messages) => set({ messages }),

  appendOlderMessages: (olderMessages) =>
    set((state) => ({
      messages: [...olderMessages, ...state.messages],
      hasMoreMessages: olderMessages.length >= 50,
    })),

  // Partner
  setPartnerTyping: (isTyping) => set({ isPartnerTyping: isTyping }),

  setPartnerPresence: (isOnline, lastSeenAt) =>
    set({ isPartnerOnline: isOnline, partnerLastSeenAt: lastSeenAt }),

  // Reactions
  addReaction: (messageId, reaction) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const emojiReactions = reactions[reaction.emoji] || [];
        reactions[reaction.emoji] = [...emojiReactions, reaction];
        return { ...m, reactions };
      }),
    })),

  removeReaction: (messageId, userId, emoji) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const emojiReactions = reactions[emoji];
        if (emojiReactions) {
          reactions[emoji] = emojiReactions.filter(
            (r) => r.userId !== userId,
          );
          if (reactions[emoji]!.length === 0) {
            delete reactions[emoji];
          }
        }
        return { ...m, reactions };
      }),
    })),

  // Highlight
  highlightMessage: (messageId, category, color, note) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isHighlighted: true,
              highlightCategory: category,
              highlightColor: color,
              highlightNote: note,
            }
          : m,
      ),
    })),

  // UI
  setReplyingTo: (message) => set({ replyingTo: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  setHighlightingMessage: (message) => set({ highlightingMessage: message }),

  // API
  fetchMessages: async (coupleId, offset = 0) => {
    set({ isLoadingMessages: true });
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { messages: Message[] };
      }>(`/messages/couple/${coupleId}`, {
        params: { limit: 50, offset },
      });

      const fetchedMessages = data.data.messages;

      if (offset === 0) {
        // Initial load: messages come newest-first from API, reverse for display
        set({
          messages: [...fetchedMessages].reverse(),
          hasMoreMessages: fetchedMessages.length >= 50,
        });
      } else {
        // Pagination: prepend older messages
        get().appendOlderMessages([...fetchedMessages].reverse());
      }
      return 'ok';
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      return status === 403 ? 'forbidden' : 'error';
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  // Reset
  reset: () => set(initialState),
}));
