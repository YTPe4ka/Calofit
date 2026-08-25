import axios from 'axios';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const baseURL = cleanApiUrl.endsWith('/api/v1') ? cleanApiUrl : `${cleanApiUrl}/api/v1`;

export const api = axios.create({
  baseURL,
  withCredentials: true, // For HttpOnly cookie support
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Attach Access Token & Admin Key ────────
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        config.headers['x-refresh-token'] = refreshToken;
      }

      const adminKey = localStorage.getItem('calofit_admin_key');
      if (adminKey) {
        config.headers['x-admin-key'] = adminKey;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: 401 Silent Refresh ────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 on refresh or login endpoint — clear session quietly
    if (
      error.response?.status === 401 &&
      (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/telegram/login'))
    ) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
      return Promise.reject(error);
    }

    // Other 401s — attempt graceful refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        const { data } = await api.post('/auth/refresh', {
          refreshToken: storedRefresh || undefined,
        });

        const newToken = data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', newToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          // Do not delete token immediately on network loss
          if (refreshError && (refreshError as any).response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            const locale = window.location.pathname.split('/')[1] || 'ru';
            window.location.href = `/${locale}/login`;
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
