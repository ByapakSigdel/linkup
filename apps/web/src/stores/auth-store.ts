import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Couple, AuthTokens } from '@linkup/types';
import api from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useThemeStore } from '@/stores/theme-store';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  couple: Couple | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Transient flag set while an account deletion is in flight + navigating to
   *  /goodbye. The dashboard layout's /login redirect guards on this so the
   *  goodbye redirect always wins the race against the layout's auth effect.
   *  Cleared on the goodbye page mount (or any reset()). */
  isWindingDown: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    dateOfBirth?: string;
  }) => Promise<{ verificationCode?: string }>;
  loginWithGoogle: (credential: string) => Promise<void>;
  /** Re-fetch the couple so the shell re-gates (e.g. on a `couple:ended` event). */
  refreshCouple: () => Promise<void>;
  /** Permanently delete this account (anonymized into a tombstone server-side),
   *  then clear the local session. Re-verifies the password server-side. */
  deleteAccount: (password: string) => Promise<void>;
  /** Survivor of an ended couple keeps going solo: archive the relationship
   *  read-only (unpair) and re-hydrate so the shell re-gates. */
  archiveAndGoSolo: () => Promise<void>;
  logout: () => Promise<void>;
  /** Clear the session locally (no network) — used after account deletion. */
  forceLogout: () => void;
  /** Reset the transient winding-down flag (called once /goodbye mounts). */
  clearWindingDown: () => void;
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
  isWindingDown: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data: body } = await api.post('/auth/login', {
            email,
            password,
          });
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

      loginWithGoogle: async (credential) => {
        set({ isLoading: true });
        try {
          const { data: body } = await api.post('/auth/google', { credential });
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

      /** Load the full user record (with coupleId) and the couple object. */
      hydrate: async () => {
        try {
          const { data: meBody } = await api.post('/auth/me');
          const fullUser: User = meBody.data.user;
          set({ user: fullUser });
          // The active couple wins; otherwise fall back to the survivor's archived
          // couple so the read-only memorial / "Memories" entry loads after she has
          // gone solo (coupleId=null, archivedCoupleId set).
          const coupleId = fullUser.coupleId ?? fullUser.archivedCoupleId ?? null;
          if (coupleId) {
            const { data: cBody } = await api.get(`/couples/${coupleId}`);
            const couple = cBody.data.couple ?? null;
            set({ couple });
            // The couple's shared theme is authoritative for both partners.
            if (couple?.sharedThemeId) {
              useThemeStore.getState().setTheme(couple.sharedThemeId);
            }
          } else {
            set({ couple: null });
          }
        } catch {
          // Non-fatal: keep whatever we have
        }
      },

      /** Re-fetch the couple (e.g. on a `couple:ended` realtime event). */
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
        // This action is navigation-agnostic (mirrors mobile): forceLogout()
        // clears isAuthenticated, which the layout's auth effect routes to
        // /login. Caller MUST router.replace('/goodbye') immediately after this
        // resolves to land on the farewell screen instead — same contract as
        // mobile/src/app/memorial.tsx:305 and (app)/settings.tsx.
        await api.delete('/users/me', { data: { confirm: true, password } });
        // Clear the session, then mark winding-down. forceLogout() resets to
        // initialState (isWindingDown:false), so we set the flag AFTER it. Both
        // set() calls batch synchronously before any re-render, so the layout's
        // /login redirect effect — which guards on isWindingDown — sees `true`
        // and stands down, letting the caller's router.replace('/goodbye') win
        // the race (Next.js App Router gives no ordering guarantee between the
        // two router.replace calls). The goodbye page calls clearWindingDown()
        // on mount. Mirrors mobile's deleteAccount → forceLogout → /goodbye.
        get().forceLogout();
        set({ isWindingDown: true });
      },

      archiveAndGoSolo: async () => {
        await api.post('/couples/me/survivor-decision', {
          decision: 'archived_solo',
        });
        // The backend sets users.coupleId=null and users.archivedCoupleId=<id>.
        // Re-hydrate so the user row (coupleId=null, archivedCoupleId set) and the
        // archived couple reload, and the shell re-gates out of the memorial.
        await get().hydrate();
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
          disconnectSocket();
          set(initialState);
        }
      },

      forceLogout: () => {
        // Drop the session locally (no network) — used after account deletion,
        // where the refresh token is already revoked server-side.
        disconnectSocket();
        set(initialState);
      },

      clearWindingDown: () => set({ isWindingDown: false }),

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
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        couple: state.couple,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// ─── Lifecycle selectors (pure; no new data) ─────────────────────────────────
// Derived from the couple/user already on the auth store. Kept as standalone
// functions so the app shell + screens can gate consistently. Mirrors mobile's
// mobile/src/stores/auth-store.ts selectors.

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
