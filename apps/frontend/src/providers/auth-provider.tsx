'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useRouter } from '@/i18n/routing';

export interface User {
  id: string;
  email: string;
  role?: 'USER' | 'ADMIN';
  hasProfile: boolean;
  name?: string;
  telegramId?: string;
  telegramUsername?: string;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string | null;
  isSubscriptionActive?: boolean;
  isTrialActive?: boolean;
  hasAccess?: boolean;
  subscriptionTier?: 'TRIAL' | 'PREMIUM' | 'EXPIRED' | 'ADMIN';
  daysRemaining?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasAccess: boolean;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  daysRemaining: number;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<{ isEmailVerified: boolean } | void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refreshSession: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshSession = useCallback(async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/auth/me');
      if (data) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        return data;
      }
    } catch {
      // Ignore if unauthenticated
    }
    return null;
  }, []);

  // Boshlang'ich auth holatini tekshirish
  useEffect(() => {
    // 1. If running inside Telegram WebApp with initData, perform Telegram login
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (e) {
          console.warn('Telegram SDK initialization warning:', e);
        }

        const initData = tg.initData || '';
        const telegramUser = tg.initDataUnsafe?.user;

        if (initData || (telegramUser && telegramUser.id)) {
          setIsLoading(true);
          api
            .post('/auth/telegram/login', { initData, telegramUser })
            .then(({ data }) => {
              if (data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
              }
              if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
              }
              if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
              }

              if (data.user?.hasProfile) {
                router.push('/dashboard');
              } else {
                router.push('/profile');
              }
            })
            .catch((err) => {
              console.error('Telegram WebApp auto-login error:', err);
              // Fallback to local storage if network glitch
              const token = localStorage.getItem('accessToken');
              const storedUser = localStorage.getItem('user');
              if (token && storedUser) {
                try {
                  setUser(JSON.parse(storedUser));
                } catch {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  localStorage.removeItem('user');
                }
              }
            })
            .finally(() => {
              setIsLoading(false);
            });
          return;
        }
      }
    }

    // 2. Normal Web Browser check
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        // Background sync to refresh latest subscription status
        api.get('/auth/me').then(({ data }) => {
          if (data) {
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
          }
        }).catch(() => {});
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }

      if (data.user?.hasProfile) {
        router.push('/dashboard');
      } else {
        router.push('/profile');
      }
    },
    [router],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const locale = window.location.pathname.split('/')[1] || 'uz';
      const { data } = await api.post('/auth/register', { email, password, locale });
      
      if (!data.accessToken) {
        return { isEmailVerified: false };
      }

      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
      router.push('/profile'); // Yangi user → profil onboarding
      return { isEmailVerified: true };
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || undefined;
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasAccess = user ? (user.role === 'ADMIN' || user.hasAccess !== false) : false;
  const isTrialActive = !!user?.isTrialActive;
  const isSubscriptionActive = !!user?.isSubscriptionActive;
  const daysRemaining = user?.daysRemaining ?? 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasAccess,
        isTrialActive,
        isSubscriptionActive,
        daysRemaining,
        login,
        register,
        logout,
        setUser,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
