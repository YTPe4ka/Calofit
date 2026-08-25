'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { CheckCircle2, Mail, RefreshCw, Sun, Moon, ChevronDown, Check, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';

const LANG_MAP = {
  uz: { label: "UZ", flag: "🇺🇿" },
  ru: { label: "RU", flag: "🇷🇺" },
  en: { label: "EN", flag: "🇬🇧" }
};

export default function RegisterPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = (params?.locale as string) || 'uz';
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  
  const { register, setUser, user } = useAuth();
  
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
  
  const [isPendingVerification, setIsPendingVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await register(email, password);
      if (res && !res.isEmailVerified) {
        setIsPendingVerification(true);
        toast.success(
          locale === 'ru'
            ? 'Письмо для подтверждения отправлено!'
            : locale === 'en'
            ? 'Verification email sent!'
            : 'Tasdiqlash xati yuborildi!'
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('error_register'));
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
      toast.error(
        err.response?.data?.message ||
          (locale === 'ru'
            ? 'Не удалось отправить письмо'
            : locale === 'en'
            ? 'Failed to send email'
            : 'Xatni yuborib bo‘lmadi')
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 bg-transparent">
      {/* Floating Header Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Theme switch button */}
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
                      router.replace(pathname, { locale: key });
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
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{t('register')}</p>
        </div>

        {/* Verification Pending View */}
        {isPendingVerification ? (
          <div className="glass rounded-2xl p-6 shadow-xl space-y-6 dark:bg-slate-900/50 dark:border-slate-800 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 dark:bg-emerald-950/30 text-green-500">
              <Mail size={24} className="animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {locale === 'ru' ? 'Подтвердите email' : locale === 'en' ? 'Verify your email' : 'Emailni tasdiqlang'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {locale === 'ru'
                  ? `Мы отправили ссылку на ${email}. Пожалуйста, перейдите по ней для активации вашего аккаунта.`
                  : locale === 'en'
                  ? `We have sent a link to ${email}. Please check your inbox and click it to activate your account.`
                  : `Biz ${email} pochtasiga faollashtirish havolasini yubordik. Ro'yxatdan o'tishni yakunlash uchun havolani bosing.`}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-150/50 dark:border-slate-850 space-y-3">
              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isResending ? 'animate-spin' : ''} />
                {locale === 'ru' ? 'Отправить повторно' : locale === 'en' ? 'Resend Link' : 'Qayta yuborish'}
              </button>
              
              <Link
                href="/login"
                className="block text-xs font-bold text-gray-500 dark:text-slate-400 hover:underline"
              >
                {locale === 'ru' ? 'Вернуться к входу' : locale === 'en' ? 'Back to Login' : 'Kirishga qaytish'}
              </Link>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 shadow-xl space-y-5 dark:bg-slate-900/50 dark:border-slate-800">
            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t('email')}
              </label>
              <input
                id="register-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-955 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Kamida 8 belgi, katta harf va raqam</p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? t('signing_up') : t('register')}
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200/50 dark:border-slate-800/80"></div>
              <span className="flex-shrink mx-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {locale === 'ru' ? 'или' : locale === 'en' ? 'or' : 'yoki'}
              </span>
              <div className="flex-grow border-t border-gray-200/50 dark:border-slate-800/80"></div>
            </div>

            {/* Telegram One-Click Register Button */}
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                try {
                  const tg = (window as any).Telegram?.WebApp;
                  try { tg?.ready(); tg?.expand(); } catch {}

                  const initData = tg?.initData || '';
                  const telegramUser = tg?.initDataUnsafe?.user;
                  let guestId = localStorage.getItem('tg_guest_id');
                  if (!guestId) {
                    guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
                    localStorage.setItem('tg_guest_id', guestId);
                  }

                  const { data } = await api.post('/auth/telegram/login', { initData, telegramUser, guestId });
                  if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
                  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                  if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setUser(data.user);
                  }
                  toast.success(locale === 'ru' ? 'Регистрация успешна!' : 'Muvaffaqiyatli ro‘yxatdan o‘tildi!');
                  if (data.user?.hasProfile) {
                    window.location.href = `/${locale}/dashboard`;
                  } else {
                    window.location.href = `/${locale}/profile`;
                  }
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Telegram auth failed');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/20 transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              {locale === 'ru' ? 'Регистрация через Telegram в 1 клик' : locale === 'en' ? 'Sign up with Telegram (1-Click)' : 'Telegram orqali 1-bosishda ro‘yxatdan o‘tish'}
            </button>

            <p className="text-center text-sm text-gray-500 dark:text-slate-400">
              {t('already_have_account')}{' '}
              <Link href="/login" className="text-green-600 dark:text-emerald-400 font-medium hover:underline">
                {t('login')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
