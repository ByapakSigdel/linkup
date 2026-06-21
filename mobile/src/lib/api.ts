import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, AUTH_STORAGE_KEY } from './env';

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

// Response: refresh once on 401, then retry.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const refreshToken = parsed?.state?.tokens?.refreshToken;
          if (refreshToken) {
            const { data } = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken,
            });
            const d = data.data ?? data;
            const tokens = {
              accessToken: d.accessToken,
              refreshToken: d.refreshToken,
              expiresIn: d.expiresIn ?? 900,
            };
            parsed.state.tokens = tokens;
            await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        // Refresh failed — leave it to the auth store / UI to handle logout.
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
