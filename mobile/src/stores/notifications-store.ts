import { create } from 'zustand';
import api from '@/lib/api';

interface Notification {
  id: string;
  userId: string;
  coupleId: string | null;
  type: string;
  priority: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  actionType: string | null;
  actionData: Record<string, unknown> | null;
  status: string;
  sentAt: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (limit?: number, offset?: number) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (limit = 20, offset = 0) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/notifications', {
        params: { limit, offset },
      });
      if (offset === 0) {
        set({
          notifications: data.data.notifications,
          unreadCount: data.data.unreadCount,
          isLoading: false,
        });
      } else {
        set({
          notifications: [...get().notifications, ...data.data.notifications],
          unreadCount: data.data.unreadCount,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, status: 'read', readAt: new Date().toISOString() } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await api.post('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          status: 'read',
          readAt: n.readAt ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },
}));
