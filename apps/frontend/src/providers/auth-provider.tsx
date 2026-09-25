'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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

export type AppPlatform = 'tg_mobile' | 'tg_desktop' | 'web_mobile' | 'web_desktop';

// ─── Platform Detection ─────────────────────────────────────
function detectPlatform(): AppPlatform {
  if (typeof window === 'undefined') return 'web_desktop';

  const tg = (window as any).Telegram?.WebApp;
  const hasTelegramSDK = !!(tg?.initData || tg?.initDataUnsafe?.user?.id);
  const screenWidth = window.innerWidth || window.screen?.width || 1024;

  // Mobile threshold: <= 768px (standard tablet/phone breakpoint)
  const isMobileScreen = screenWidth <= 768;

  if (hasTelegramSDK) {
    return isMobileScreen ? 'tg_mobile' : 'tg_desktop';
  }
  return isMobileScreen ? 'web_mobile' : 'web_desktop';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasAccess: boolean;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  daysRemaining: number;
  platform: AppPlatform;
  isTelegramWebApp: boolean;
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
  const [platform, setPlatform] = useState<AppPlatform>('web_desktop');
  const router = useRouter();

  // Detect platform on mount
  useEffect(() => {
    setPlatform(detectPlatform());

    // Re-detect on resize (e.g. desktop TG window resized)
    const handleResize = () => setPlatform(detectPlatform());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTelegramWebApp = platform === 'tg_mobile' || platform === 'tg_desktop';

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
    let isMounted = true;

    async function initAuth() {
      if (typeof window === 'undefined') return;

      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (e) {
          console.warn('Telegram SDK initialization warning:', e);
        }
      }

      const initData = tg?.initData || '';
      const telegramUser = tg?.initDataUnsafe?.user;

      // 1. If running inside Telegram WebApp with user credentials
      if (initData || (telegramUser && telegramUser.id)) {
        setIsLoading(true);
        try {
          const { data } = await api.post('/auth/telegram/login', {
            initData,
            telegramUser,
          });

          if (!isMounted) return;

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

          const pathname = window.location.pathname;
          if (pathname.includes('/login') || pathname.includes('/register')) {
            if (data.user?.hasProfile) {
              router.push('/dashboard');
            } else {
              router.push('/profile');
            }
          }
        } catch (err: any) {
          console.error('Telegram WebApp auto-login error:', err);
          // Fallback to existing local storage session
          const token = localStorage.getItem('accessToken');
          const storedUser = localStorage.getItem('user');
          if (token && storedUser && isMounted) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
            }
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      // 2. Normal Web Browser check from localStorage
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (isMounted) setUser(parsed);
          // Background sync to refresh latest subscription status
          api
            .get('/auth/me')
            .then(({ data }) => {
              if (data && isMounted) {
                setUser(data);
                localStorage.setItem('user', JSON.stringify(data));
              }
            })
            .catch(() => {});
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }

      if (isMounted) setIsLoading(false);
    }

    initAuth();

    return () => {
      isMounted = false;
    };
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
        platform,
        isTelegramWebApp,
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
