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
  loginWithGoogle: (idToken: string) => Promise<void>;
  createCouple: () => Promise<Couple>;
  joinCouple: (pairingCode: string) => Promise<void>;
  refreshCouple: () => Promise<void>;
  /** Permanently delete this account (anonymized into a tombstone server-side),
   *  then clear the local session. Re-verifies the password server-side. */
  deleteAccount: (password: string) => Promise<void>;
  /** Survivor of an ended couple keeps going solo: archive the relationship
   *  read-only (unpair) and re-fetch the couple so the shell re-gates. */
  archiveAndGoSolo: () => Promise<void>;
  logout: () => Promise<void>;
  /** Clear the session locally (no network) — used when a token refresh fails. */
  forceLogout: () => void;
  refreshToken: () => Promise<void>;
  /** Persist freshly-refreshed tokens, but only while still signed in (guards
   *  against a refresh that resolves after the user has logged out). */
  setTokens: (tokens: AuthTokens) => void;
  /** Bumped on every session clear; refreshers compare it to detect a logout
   *  that happened mid-flight and avoid resurrecting the session. */
  sessionEpoch: number;
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
      sessionEpoch: 0,

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

      loginWithGoogle: async (idToken) => {
        set({ isLoading: true });
        try {
          const { data: body } = await api.post('/auth/google', { idToken });
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

      createCouple: async () => {
        const { data: body } = await api.post('/couples');
        const couple = body.data.couple as Couple;
        const u = get().user;
        set({ couple, user: u ? { ...u, coupleId: couple.id } : u });
        return couple;
      },

      joinCouple: async (pairingCode) => {
        const { data: body } = await api.post('/couples/join', { pairingCode });
        set({ couple: body.data.couple });
        await get().hydrate();
      },

      /** Re-fetch the couple (e.g. polling for the partner to accept the code). */
      refreshCouple: async () => {
        const c = get().couple;
        if (!c?.id) {
          await get().hydrate();
          return;
        }
        try {
          const { data: body } = await api.get(`/couples/${c.id}`);
          if (body?.data?.couple) set({ couple: body.data.couple });
        } catch {
          // keep current couple
        }
      },

      deleteAccount: async (password) => {
        // axios DELETE carries a body under `data`. The server anonymizes the
        // account + revokes refresh tokens; locally we just drop the session.
        await api.delete('/users/me', { data: { confirm: true, password } });
        get().forceLogout();
      },

      archiveAndGoSolo: async () => {
        await api.post('/couples/me/survivor-decision', { decision: 'archived_solo' });
        await get().refreshCouple();
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
          set((s) => ({ ...initialState, sessionEpoch: s.sessionEpoch + 1 }));
        }
      },

      forceLogout: () => {
        // The refresh token is dead (expired/revoked). Drop the session so the
        // app routes back to login instead of looping on 401s. Bumping the epoch
        // tells any in-flight refresh not to resurrect what we just cleared.
        disconnectSocket();
        set((s) => ({ ...initialState, sessionEpoch: s.sessionEpoch + 1 }));
      },

      setTokens: (tokens) => {
        // Ignore late-arriving refreshes once the user is logged out.
        if (!get().isAuthenticated) return;
        set({ tokens });
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

// ─── Lifecycle selectors (pure; no new data) ─────────────────────────────────
// Derived from the couple/user already on the auth store. Kept as standalone
// functions so the app shell + screens can gate consistently.

type LifecycleSlice = Pick<AuthState, 'user' | 'couple'>;

/** "Actively paired" ⇔ has a couple that has NOT ended. */
export const isActivelyPaired = (s: LifecycleSlice): boolean =>
  !!s.couple && s.couple.relationshipStatus !== 'ended';

/** The survivor still needs to choose (memorial takeover gate). */
export const isMemorialPending = (s: LifecycleSlice): boolean =>
  !!s.couple &&
  s.couple.relationshipStatus === 'ended' &&
  s.couple.survivorDecision === 'pending';

/** A past relationship is kept read-only for the now-solo survivor to revisit. */
export const hasArchive = (s: LifecycleSlice): boolean => !!s.user?.archivedCoupleId;
