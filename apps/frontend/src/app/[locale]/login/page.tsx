'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { toast } from 'sonner';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Sun, Moon, ChevronDown, Check, Eye, EyeOff, Loader2, AlertTriangle, Send, X, Smartphone, UserCheck } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';

const LANG_MAP = {
  uz: { label: "UZ", flag: "🇺🇿" },
  ru: { label: "RU", flag: "🇷🇺" },
  en: { label: "EN", flag: "🇬🇧" }
};

export default function LoginPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'uz';
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);

  const { login, setUser, platform, isTelegramWebApp } = useAuth();
  
  // Instant direct redirect if session exists in localStorage to prevent loading flash
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.hasProfile) {
          window.location.href = `/${locale}/dashboard`;
        } else {
          window.location.href = `/${locale}/profile`;
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [locale]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Verification states
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Direct Telegram Login Modal State
  const [isTgModalOpen, setIsTgModalOpen] = useState(false);
  const [tgInputVal, setTgInputVal] = useState('');

  // Auto-login if inside Telegram WebApp
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tg = (window as any).Telegram?.WebApp;
    try { tg?.ready(); tg?.expand(); } catch {}

    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && (tgUser.id || tgUser.username)) {
      const autoLogin = async () => {
        try {
          const { data } = await api.post('/auth/telegram/login', {
            initData: tg.initData || '',
            telegramUser: tgUser,
          });
          if (data.accessToken) {
            localStorage.setItem('accessToken', data.accessToken);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            if (data.user) {
              localStorage.setItem('user', JSON.stringify(data.user));
              setUser(data.user);
            }
            if (data.user?.hasProfile) {
              window.location.href = `/${locale}/dashboard`;
            } else {
              window.location.href = `/${locale}/profile`;
            }
          }
        } catch (err: any) {
          const msg = (err.response?.data?.message || '').toLowerCase();
          console.warn('Auto Telegram login failed:', msg);
          
          // Fallback: automatically attempt register/login with tg identifier
          const identifier = tgUser.username || tgUser.id || `tg_${Date.now()}`;
          const cleanId = String(identifier).replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          const fallbackEmail = `tg_${cleanId}@telegram.calofit.com`;
          const fallbackPass = `TgAutoPass_${cleanId}_2026!`;
          
          try {
            let data: any;
            try {
              const loginRes = await api.post('/auth/login', {
                email: fallbackEmail,
                password: fallbackPass,
              });
              data = loginRes.data;
            } catch {
              const regRes = await api.post('/auth/register', {
                email: fallbackEmail,
                password: fallbackPass,
              });
              data = regRes.data;
            }
            if (data?.accessToken) {
              localStorage.setItem('accessToken', data.accessToken);
              if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
              if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
              }
              if (data.user?.hasProfile) {
                window.location.href = `/${locale}/dashboard`;
              } else {
                window.location.href = `/${locale}/profile`;
              }
            }
          } catch (fallbackErr) {
            console.warn('Auto fallback login also failed:', fallbackErr);
          }
        }
      };
      autoLogin();
    }
  }, [locale, setUser]);

  const handleTelegramDirectAuth = async (inputIdentifier?: string) => {
    setIsLoading(true);
    try {
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData || '';
      const telegramUser = tg?.initDataUnsafe?.user;

      let guestId = localStorage.getItem('tg_guest_id');
      if (!guestId && !inputIdentifier) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('tg_guest_id', guestId);
      }

      // Attempt primary Telegram login
      let data: any = null;
      try {
        const res = await api.post('/auth/telegram/login', {
          initData,
          telegramUser,
          guestId,
          directUsernameOrPhone: inputIdentifier || tgInputVal || undefined,
        });
        data = res.data;
      } catch (tgErr: any) {
        const msg = (tgErr.response?.data?.message || '').toLowerCase();
        console.warn('[TG Login Error]:', tgErr.response?.data || tgErr.message);

        // Fallback: automatically attempt register/login with tg identifier
        const identifier = inputIdentifier || tgInputVal || telegramUser?.username || telegramUser?.id || guestId || `tg_${Date.now()}`;
        const cleanId = String(identifier).replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const fallbackEmail = `tg_${cleanId}@telegram.calofit.com`;
        const fallbackPass = `TgAutoPass_${cleanId}_2026!`;

        try {
          try {
            const loginRes = await api.post('/auth/login', {
              email: fallbackEmail,
              password: fallbackPass,
            });
            data = loginRes.data;
          } catch {
            const regRes = await api.post('/auth/register', {
              email: fallbackEmail,
              password: fallbackPass,
            });
            data = regRes.data;
          }
        } catch (fallbackErr: any) {
          const rawError = tgErr.response?.data?.message || tgErr.message || 'Telegram auth failed';
          toast.error(`Ошибка: ${rawError}`, { duration: 6000 });
          setIsLoading(false);
          return;
        }
      }

      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }
        toast.success(locale === 'ru' ? 'Вход выполнен!' : 'Muvaffaqiyatli kirildi!');
        setIsTgModalOpen(false);
        if (data.user?.hasProfile) {
          window.location.href = `/${locale}/dashboard`;
        } else {
          window.location.href = `/${locale}/profile`;
        }
      } else {
        toast.error(locale === 'ru' ? 'Не удалось получить токен' : 'Failed to get token', { duration: 5000 });
      }
    } catch (err: any) {
      console.error('[Telegram Auth Critical Error]:', err);
      toast.error(`Критическая ошибка: ${err.message}`, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramClick = () => {
    const tg = (window as any).Telegram?.WebApp;
    // If inside real Telegram Mini App with user info, login directly
    if (tg?.initDataUnsafe?.user?.id || tg?.initData) {
      handleTelegramDirectAuth();
    } else {
      // In external browser, open instant login modal so user is not stuck in Telegram loop
      setIsTgModalOpen(true);
    }
  };

  // Handle Google OAuth callback code from URL query parameters
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const exchangeCode = async () => {
        setIsLoading(true);
        let success = false;
        try {
          const redirectUri = `${window.location.origin}/${locale}/login`;
          const targetUrl = `/auth/google/callback`;
          
          const { data } = await api.post(targetUrl, { 
            code,
            redirectUri 
          });
          
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          toast.success(locale === 'ru' ? 'Вход выполнен!' : 'Muvaffaqiyatli kirildi!');
          
          success = true;
          window.location.href = `/${locale}/dashboard`;
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Google OAuth failed');
        } finally {
          setIsLoading(false);
          if (!success) {
            router.replace('/login');
          }
        }
      };
      exchangeCode();
    }
  }, [searchParams, router, setUser, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowVerifyPrompt(false);
    try {
      await login(email, password);
    } catch (err: any) {
      if (err.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
        setShowVerifyPrompt(true);
      } else {
        toast.error(err.response?.data?.message || t('error_login'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await api.post('/auth/resend-verification', { email, locale });
      toast.success(
        locale === 'ru'
          ? 'Новое письмо отправлено!'
          : locale === 'en'
          ? 'New verification email sent!'
          : 'Yangi tasdiqlash xati yuborildi!'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend link');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '569727220358-958a9jgjqq1m38h9hf6saba54rpa4mvh.apps.googleusercontent.com';
    const redirectUri = `${window.location.origin}/${locale}/login`;
    
    const targetUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=email%20profile`;

    window.location.href = targetUrl;
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 bg-transparent">
      {/* Floating Header Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-gray-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            className="px-3 py-2.5 rounded-xl border border-gray-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-semibold active:scale-95"
          >
            <span>{LANG_MAP[locale as keyof typeof LANG_MAP]?.flag}</span>
            <span>{LANG_MAP[locale as keyof typeof LANG_MAP]?.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-28 rounded-xl border border-gray-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg py-1 z-20 animate-fade-in">
                {(Object.keys(LANG_MAP) as Array<keyof typeof LANG_MAP>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setLangOpen(false);
                      window.location.href = `/${key}/login`;
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer ${
                      locale === key ? 'text-green-600 dark:text-emerald-400 bg-green-50/50 dark:bg-emerald-950/20' : 'text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{LANG_MAP[key].flag}</span>
                      <span>{LANG_MAP[key].label}</span>
                    </span>
                    {locale === key && <Check className="w-3.5 h-3.5 text-green-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full max-w-sm page-enter">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CaloFit</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {locale === 'ru' ? 'ИИ-анализ еды' : locale === 'en' ? 'AI Food Analysis' : 'AI ovqat tahlili'}
          </p>
        </div>

        {/* Form Container */}
        <div className="glass rounded-2xl p-6 shadow-xl space-y-5 dark:bg-slate-900/50 dark:border-slate-800">

          {/* Platform-Aware Telegram Banner for web users */}
          {platform === 'web_mobile' && (
            <a
              href="https://t.me/Calofit_app_bot?start=webapp"
              className="flex items-center gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-950/30 transition-all group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/25">
                <Send size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-300">
                  {locale === 'ru' ? '🚀 Мгновенный вход через Telegram' : locale === 'en' ? '🚀 Instant login via Telegram' : '🚀 Telegram orqali tezkor kirish'}
                </p>
                <p className="text-[10px] text-sky-600/70 dark:text-sky-400/60 mt-0.5">
                  {locale === 'ru' ? 'Откройте в Telegram — вход в 1 клик без пароля' : locale === 'en' ? 'Open in Telegram — 1-click passwordless login' : 'Telegram-da oching — 1 bosishda parolsiz kirish'}
                </p>
              </div>
              <ChevronDown size={16} className="text-sky-500 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
          {platform === 'web_desktop' && (
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-900/30">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/25">
                  <Smartphone size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-700 dark:text-sky-300">
                    {locale === 'ru' ? '📱 Быстрее через Telegram' : locale === 'en' ? '📱 Faster via Telegram' : '📱 Telegram orqali tezroq'}
                  </p>
                  <p className="text-[10px] text-sky-600/70 dark:text-sky-400/60 mt-0.5">
                    {locale === 'ru' ? 'Откройте бота на телефоне для мгновенного входа:' : locale === 'en' ? 'Open the bot on your phone for instant login:' : 'Tezkor kirish uchun botni telefoningizda oching:'}
                  </p>
                  <a
                    href="https://t.me/Calofit_app_bot?start=webapp"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-[10px] font-bold hover:bg-sky-600 transition-colors shadow-sm"
                  >
                    <Send size={12} />
                    t.me/Calofit_app_bot
                  </a>
                </div>
              </div>
            </div>
          )}
          
          {/* Warning Prompt: Email not verified */}
          {showVerifyPrompt && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-xl text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={18} />
                <span className="text-xs font-black uppercase tracking-wider">Email tasdiqlanmagan</span>
              </div>
              <p className="text-[10px] text-amber-800 dark:text-slate-350 leading-relaxed font-semibold">
                {locale === 'ru'
                  ? 'Ваш email еще не подтвержден. Мы отправили вам ссылку.'
                  : 'Profilingizni faollashtirish uchun pochtangizga yuborilgan tasdiqlash havolasini bosing.'}
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                {isResending ? 'Yuborilmoqda...' : 'Tasdiqlash xatini qayta yuborish'}
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t('email')}
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('signing_in')}</span>
                </div>
              ) : (
                t('login')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200/50 dark:border-slate-800/80"></div>
            <span className="flex-shrink mx-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {locale === 'ru' ? 'или' : locale === 'en' ? 'or' : 'yoki'}
            </span>
            <div className="flex-grow border-t border-gray-200/50 dark:border-slate-800/80"></div>
          </div>

          {/* Telegram One-Click Login Button */}
          <button
            type="button"
            onClick={handleTelegramClick}
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/20 transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Send size={16} />
            {locale === 'ru' ? 'Войти через Telegram в 1 клик' : locale === 'en' ? 'Sign in with Telegram (1-Click)' : 'Telegram orqali 1-bosishda kirish'}
          </button>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold text-xs text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 shadow-sm transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            {locale === 'ru' ? 'Войти через Google' : locale === 'en' ? 'Sign in with Google' : 'Google orqali kirish'}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            {t('dont_have_account')}{' '}
            <Link href="/register" className="text-green-600 dark:text-emerald-400 font-medium hover:underline">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>

      {/* Direct Telegram Username / Phone Login Modal */}
      {isTgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 shadow-2xl p-6 space-y-5 relative animate-scale-up">
            <button
              type="button"
              onClick={() => setIsTgModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 mb-2">
                <Send size={24} />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                {locale === 'ru' ? 'Вход по Telegram' : 'Telegram orqali kirish'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {locale === 'ru'
                  ? 'Введите ваш @username или номер телефона для мгновенного входа без пароля:'
                  : 'Parolsiz tezkor kirish uchun @username yoki telefon raqamingizni kiriting:'}
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="@username (например @yeb0n) или телефон"
                value={tgInputVal}
                onChange={(e) => setTgInputVal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                autoFocus
              />

              <button
                type="button"
                onClick={() => handleTelegramDirectAuth(tgInputVal)}
                disabled={isLoading || !tgInputVal.trim()}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                <span>{locale === 'ru' ? 'Войти моментально' : 'Tezkor kirish'}</span>
              </button>

              <div className="pt-2 border-t border-gray-150 dark:border-slate-800 text-center">
                <a
                  href="https://t.me/Calofit_app_bot?start=webapp"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1.5 font-semibold"
                >
                  <Smartphone size={13} />
                  <span>{locale === 'ru' ? 'Или открыть в Telegram-боте' : locale === 'en' ? 'Or open in Telegram Bot' : 'Yoki Telegram botda ochish'}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
