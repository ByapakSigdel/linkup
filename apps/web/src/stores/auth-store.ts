import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Couple, AuthTokens, AuthResponse } from '@linkup/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  couple: Couple | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    dateOfBirth?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
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

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<AuthResponse>('/auth/login', {
            email,
            password,
          });
          set({
            user: data.user,
            tokens: data.tokens,
            couple: data.couple ?? null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (registerData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<AuthResponse>(
            '/auth/register',
            registerData,
          );
          set({
            user: data.user,
            tokens: data.tokens,
            couple: data.couple ?? null,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          const { tokens } = get();
          if (tokens?.refreshToken) {
            await api.post('/auth/logout', {
              refreshToken: tokens.refreshToken,
            });
          }
        } catch {
          // Logout endpoint failure is not critical
        } finally {
          set(initialState);
        }
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) return;

        try {
          const { data } = await api.post<{ tokens: AuthTokens }>(
            '/auth/refresh',
            { refreshToken: tokens.refreshToken },
          );
          set({ tokens: data.tokens });
        } catch {
          // Refresh failed — force logout
          set(initialState);
        }
      },

      setUser: (user) => set({ user }),
      setCouple: (couple) => set({ couple }),
      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        couple: state.couple,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
