import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, AUTH_STORAGE_KEY } from './env';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Axios client for the LinkUp API — mirrors the web client's behaviour, but
 * reads/writes tokens from AsyncStorage (where the zustand auth store persists
 * them) instead of localStorage. Token refresh on 401 is handled here too.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

async function readPersistedTokens(): Promise<{
  accessToken?: string;
  refreshToken?: string;
} | null> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.tokens ?? null;
  } catch {
    return null;
  }
}

// Request: attach the access token.
api.interceptors.request.use(async (config) => {
  const tokens = await readPersistedTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
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
  const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  const refreshToken = parsed?.state?.tokens?.refreshToken;
  if (!refreshToken) return null;

  const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  const d = data.data ?? data;
  const tokens: Tokens = {
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    expiresIn: d.expiresIn ?? 900,
  };
  parsed.state.tokens = tokens;
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  // Sync the in-memory store too so the live socket (keyed on the store token)
  // reconnects with the fresh token after expiry.
  try {
    useAuthStore.setState({ tokens });
  } catch {
    /* store not ready — AsyncStorage is enough */
  }
  return tokens;
}

// Response: refresh once on 401, then retry. On genuine refresh failure, clear
// the session so the app shows login instead of looping on broken screens.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshInFlight) {
          refreshInFlight = refreshTokens().finally(() => {
            refreshInFlight = null;
          });
        }
        const tokens = await refreshInFlight;
        if (tokens?.accessToken) {
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(originalRequest);
        }
        // No refresh token at all — fall through to a clean logout.
        useAuthStore.getState().forceLogout();
      } catch {
        // Refresh token is expired/revoked — log out cleanly.
        try {
          useAuthStore.getState().forceLogout();
        } catch {
          /* store not ready */
        }
      }
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
