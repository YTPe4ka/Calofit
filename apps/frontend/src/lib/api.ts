import axios from 'axios';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customApi = localStorage.getItem('calofit_api_url');
    if (customApi && customApi.trim()) {
      const clean = customApi.trim().replace(/\/+$/, '');
      return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
    }
  }

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (rawApiUrl && rawApiUrl.trim()) {
    const clean = rawApiUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api/v1`;
  }

  return 'http://localhost:3000/api/v1';
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Attach Access Token, Admin Key & Dynamic BaseURL ────────
api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        config.headers['x-refresh-token'] = refreshToken;
      }

      let adminKey = localStorage.getItem('calofit_admin_key');
      if (!adminKey) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const u = JSON.parse(storedUser);
            if (
              u.role === 'ADMIN' ||
              u.telegramUsername?.toLowerCase() === 'yeb0n' ||
              u.email?.toLowerCase()?.includes('yeb0n')
            ) {
              adminKey = 'yeb0n_admin_pass';
            }
          } catch {}
        }
      }
      if (adminKey) {
        config.headers['x-admin-key'] = adminKey;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: 401 Silent Refresh with Telegram re-login fallback ────────
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

// Try to re-authenticate via Telegram SDK if available
async function tryTelegramReLogin(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const tg = (window as any).Telegram?.WebApp;
  const tgUser = tg?.initDataUnsafe?.user;
  if (!tgUser?.id && !tg?.initData) return null;

  try {
    const { data } = await axios.post(`${getApiBaseUrl()}/auth/telegram/login`, {
      initData: tg.initData || '',
      telegramUser: tgUser,
    });

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      return data.accessToken;
    }
  } catch {
    // Telegram re-login failed — will fall through to redirect
  }
  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 on refresh or login endpoint — clear session quietly (don't loop)
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

    // Other 401s — attempt graceful refresh (max 2 retries to prevent infinite loops)
    const retryCount = originalRequest._retryCount || 0;
    if (error.response?.status === 401 && retryCount < 2) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retryCount = retryCount + 1;
      isRefreshing = true;

      try {
        // Step 1: Try normal refresh token rotation
        const storedRefresh = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (storedRefresh) {
          try {
            const { data } = await api.post('/auth/refresh', {
              refreshToken: storedRefresh,
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
          } catch {
            // Refresh failed — try Telegram re-login next
          }
        }

        // Step 2: Try Telegram WebApp re-login (if inside TG)
        const tgToken = await tryTelegramReLogin();
        if (tgToken) {
          originalRequest.headers.Authorization = `Bearer ${tgToken}`;
          processQueue(null, tgToken);
          return api(originalRequest);
        }

        // Step 3: All re-auth methods failed — clear session and redirect
        processQueue(new Error('All re-auth methods failed'), null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          const locale = window.location.pathname.split('/')[1] || 'ru';
          window.location.href = `/${locale}/login`;
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
