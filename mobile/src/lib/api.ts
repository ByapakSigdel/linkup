import axios from 'axios';
import { API_URL } from './env';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';

/** Clear the session and tell the user why, then let the layout route to login. */
function endExpiredSession() {
  try {
    if (useAuthStore.getState().isAuthenticated) {
      useToastStore.getState().push({
        title: 'Session expired',
        body: 'Please log in again.',
        variant: 'info',
      });
    }
    useAuthStore.getState().forceLogout();
  } catch {
    /* store not ready */
  }
}

/**
 * Axios client for the LinkUp API. Tokens are read from the in-memory auth store
 * (the source of truth, kept on disk by the store's persist middleware) — NOT by
 * read-modify-writing the persisted blob, which would race the store's own writer
 * and could resurrect a session after logout.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Request: attach the current access token from the store (always up to date).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: the refresh token ROTATES on the server (the old one is
// revoked when a new pair is issued). If several requests 401 at once — common on
// cold start — and each refreshes independently, the first revokes the token the
// others are about to use, and everyone gets logged out. So all concurrent 401s
// share ONE in-flight refresh.
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
let refreshInFlight: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  const before = useAuthStore.getState();
  const epochBefore = before.sessionEpoch;
  const refreshToken = before.tokens?.refreshToken;
  if (!refreshToken) return null;

  const { data } = await axios.post(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { timeout: 20000 },
  );
  const d = data.data ?? data;
  const tokens: Tokens = {
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    expiresIn: d.expiresIn ?? 900,
  };

  // If the user logged out (or the session was otherwise cleared) while this
  // refresh was in flight, do NOT write the tokens back — that would resurrect a
  // session the user just ended.
  const after = useAuthStore.getState();
  if (!after.isAuthenticated || after.sessionEpoch !== epochBefore) {
    return null;
  }
  after.setTokens(tokens); // store owns serialization to disk
  return tokens;
}

// Response: refresh once on 401, then retry.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      let tokens: Tokens | null;
      try {
        if (!refreshInFlight) {
          refreshInFlight = refreshTokens().finally(() => {
            refreshInFlight = null;
          });
        }
        tokens = await refreshInFlight;
      } catch (refreshErr) {
        // Only end the session if the refresh token itself was rejected. A
        // transient failure (offline, timeout, 5xx) must NOT log out a user whose
        // refresh token is still valid — a flaky network shouldn't end a session
        // that's meant to last months.
        const rs = (refreshErr as { response?: { status?: number } })?.response?.status;
        if (rs === 401 || rs === 403) endExpiredSession();
        return Promise.reject(error);
      }
      if (tokens?.accessToken) {
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      }
      // No refresh token (or the session was cleared mid-flight) → logged out.
      endExpiredSession();
      return Promise.reject(error);
    }

    // A request already retried with a fresh token that STILL 401s means the new
    // token is rejected (deactivated account, clock skew, backend change) — end
    // the session instead of leaving the user on perpetually-401ing screens.
    if (status === 401 && originalRequest?._retry) {
      endExpiredSession();
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an axios error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    e?.response?.data?.error?.message ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

export default api;
