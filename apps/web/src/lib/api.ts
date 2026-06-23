import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const accessToken = parsed?.state?.tokens?.accessToken;
          if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
          }
        } catch {
          // Malformed storage — ignore
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('auth-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            const refreshToken = parsed?.state?.tokens?.refreshToken;

            if (refreshToken) {
              const { data } = await axios.post(
                `${api.defaults.baseURL}/auth/refresh`,
                { refreshToken },
                { withCredentials: true },
              );

              // The refresh endpoint returns { success, data: { accessToken, ... } }.
              const newTokens = data?.data ?? data?.tokens;

              // Update both localStorage AND the in-memory store, so the live
              // socket (keyed on the store's token) reconnects with the fresh
              // token instead of dying once the 15-min access token rolls.
              parsed.state.tokens = newTokens;
              localStorage.setItem('auth-storage', JSON.stringify(parsed));
              try {
                useAuthStore.setState({ tokens: newTokens });
              } catch {
                /* store not ready — localStorage is enough */
              }

              // Retry the original request with new token
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              return api(originalRequest);
            }
          }
        }
      } catch {
        // Refresh failed — clear auth state and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
