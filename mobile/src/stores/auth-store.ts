import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Couple, AuthTokens } from '@/types';
import api from '@/lib/api';
import { zustandStorage } from '@/lib/storage';
import { disconnectSocket } from '@/lib/socket';
import { useThemeStore } from '@/stores/theme-store';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  couple: Couple | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True until the persisted store has rehydrated (gates the splash screen). */
  hydrated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    dateOfBirth?: string;
  }) => Promise<{ verificationCode?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
  setCouple: (couple: Couple | null) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  tokens: null,
  couple: null,
  isAuthenticated: false,
  isLoading: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,
      hydrated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data: body } = await api.post('/auth/login', { email, password });
          const d = body.data;
          set({
            user: d.user,
            tokens: { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresIn: d.expiresIn ?? 900 },
            isAuthenticated: true,
            isLoading: false,
          });
          await get().hydrate();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (registerData) => {
        set({ isLoading: true });
        try {
          const { data: body } = await api.post('/auth/register', registerData);
          const d = body.data;
          set({
            user: d.user,
            tokens: { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresIn: d.expiresIn ?? 900 },
            isAuthenticated: true,
            isLoading: false,
          });
          await get().hydrate();
          return { verificationCode: d.verificationCode };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      hydrate: async () => {
        try {
          const { data: meBody } = await api.post('/auth/me');
          const fullUser: User = meBody.data.user;
          set({ user: fullUser });
          if (fullUser.coupleId) {
            const { data: cBody } = await api.get(`/couples/${fullUser.coupleId}`);
            const couple = cBody.data.couple ?? null;
            set({ couple });
            if (couple?.sharedThemeId) {
              useThemeStore.getState().setTheme(couple.sharedThemeId);
            }
          } else {
            set({ couple: null });
          }
        } catch {
          // Non-fatal: keep whatever we have.
        }
      },

      logout: async () => {
        try {
          const { tokens } = get();
          if (tokens?.refreshToken) {
            await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
          }
        } catch {
          // Logout endpoint failure is not critical.
        } finally {
          disconnectSocket();
          set(initialState);
        }
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) return;
        try {
          const { data: body } = await api.post('/auth/refresh', {
            refreshToken: tokens.refreshToken,
          });
          const d = body.data;
          set({
            tokens: { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresIn: d.expiresIn ?? 900 },
          });
        } catch {
          disconnectSocket();
          set(initialState);
        }
      },

      setUser: (user) => set({ user }),
      setCouple: (couple) => set({ couple }),
      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      storage: zustandStorage,
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        couple: state.couple,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Flag rehydration complete so the root layout can leave the splash.
        useAuthStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);
