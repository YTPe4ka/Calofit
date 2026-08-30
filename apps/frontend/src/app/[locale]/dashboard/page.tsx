'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { Camera, LogOut, TrendingUp, MessageSquare, Sparkles, Sun, Moon, Globe, ChevronDown, Check, X, Trash2, User, Scale, Ruler, Calendar, Target, Edit3, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import { toast } from 'sonner';

import { TrialBanner } from '@/components/TrialBanner';

interface ProfileInfo {
  name: string | null;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE';
  heightCm?: number;
  weightKg?: number;
  goal?: 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_WEIGHT';
  dailyCalorieGoal: number;
}

interface DashboardData {
  profile: ProfileInfo;
  today: {
    date: string;
    consumed: { calories: number; protein: number; fat: number; carbs: number };
    remaining: { calories: number };
    progress: number;
  };
  recentLogs: Array<{
    id: string;
    mealType: string;
    foodName: string;
    portionSize?: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    imageUrl: string | null;
    loggedAt: string;
    ingredients?: string[];
    healthAdvice?: string | null;
    portionBreakdown?: string | null;
  }>;
}

const MEAL_EMOJI: Record<string, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
  SNACK: '🍎',
};

const LANG_MAP = {
  uz: { label: "UZ", flag: "🇺🇿" },
  ru: { label: "RU", flag: "🇷🇺" },
  en: { label: "EN", flag: "🇬🇧" }
};

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('dashboard');
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState('uz');
  const [langOpen, setLangOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((resolved) => {
      setLocale(resolved?.locale || 'uz');
    });
  }, [params]);

  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data;
    },
    retry: 2,
  });

  // Handle unauthorized / token expiration cleanly
  useEffect(() => {
    if (error) {
      const status = (error as any)?.response?.status;
      if (status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = `/${locale}/login`;
      }
    }
  }, [error, locale]);

  const [selectedMealLog, setSelectedMealLog] = useState<any | null>(null);

  // Profile Form state for editing inside modal
  const [profileForm, setProfileForm] = useState({
    name: '',
    dobYear: '',
    dobMonth: '',
    dobDay: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    heightCm: 170,
    weightKg: 70,
    goal: 'MAINTAIN' as 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_WEIGHT',
  });

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Populate profile form whenever dashboard data updates
  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      let y = '', m = '', d = '';
      if (p.dateOfBirth) {
        const dateObj = new Date(p.dateOfBirth);
        if (!isNaN(dateObj.getTime())) {
          y = String(dateObj.getFullYear());
          m = String(dateObj.getMonth() + 1);
          d = String(dateObj.getDate());
        }
      }
      setProfileForm({
        name: p.name || '',
        dobYear: y,
        dobMonth: m,
        dobDay: d,
        gender: p.gender || 'MALE',
        heightCm: p.heightCm || 170,
        weightKg: p.weightKg || 70,
        goal: p.goal || 'MAINTAIN',
      });
    }
  }, [data?.profile]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/meals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(locale === 'ru' ? 'Успешно удалено!' : locale === 'en' ? 'Deleted successfully!' : "O'chirildi!");
      setSelectedMealLog(null);
    },
    onError: () => {
      toast.error(locale === 'ru' ? 'Ошибка удаления' : locale === 'en' ? 'Failed to delete' : "O'chirishda xatolik");
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-2xl font-bold">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {locale === 'ru' ? 'Не удалось загрузить данные' : locale === 'en' ? 'Failed to load dashboard' : 'Ma\'lumotlarni yuklab bo\'lmadi'}
        </h2>
        <p className="text-xs text-gray-500 max-w-sm">
          {(error as any)?.response?.data?.message || (error as any)?.message || (locale === 'ru' ? 'Проверьте соединение с сервером' : 'Check server connection')}
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
          >
            {locale === 'ru' ? 'Повторить попытку' : locale === 'en' ? 'Retry' : 'Qayta urinish'}
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = `/${locale}/login`;
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-300 transition-all cursor-pointer"
          >
            {locale === 'ru' ? 'Войти заново' : locale === 'en' ? 'Login again' : 'Qayta kirish'}
          </button>
        </div>
      </main>
    );
  }

  const { profile, today, recentLogs } = data;

  // Calculate BMI for modal & header
  const hM = (profileForm.heightCm || 170) / 100;
  const currentBmi = hM > 0 ? (profileForm.weightKg / (hM * hM)).toFixed(1) : '0';

  const getBmiCategory = (bmiVal: number) => {
    if (bmiVal < 18.5) return { label: locale === 'ru' ? 'Дефицит веса' : locale === 'en' ? 'Underweight' : 'Vazn kamligi', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' };
    if (bmiVal < 25) return { label: locale === 'ru' ? 'Норма' : locale === 'en' ? 'Healthy' : 'Me\'yor', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' };
    if (bmiVal < 30) return { label: locale === 'ru' ? 'Избыток веса' : locale === 'en' ? 'Overweight' : 'Ortiqcha vazn', color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30' };
    return { label: locale === 'ru' ? 'Ожирение' : locale === 'en' ? 'Obesity' : 'Semizlik', color: 'text-red-500 bg-red-50 dark:bg-red-950/30' };
  };

  const bmiCategory = getBmiCategory(Number(currentBmi));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 110 }, (_, i) => currentYear - i);

  const getMonthsList = (lang: string) => {
    if (lang === 'ru') {
      return [
        { value: '1', label: 'Январь' }, { value: '2', label: 'Февраль' }, { value: '3', label: 'Март' },
        { value: '4', label: 'Апрель' }, { value: '5', label: 'Май' }, { value: '6', label: 'Июнь' },
        { value: '7', label: 'Июль' }, { value: '8', label: 'Август' }, { value: '9', label: 'Сентябрь' },
        { value: '10', label: 'Октябрь' }, { value: '11', label: 'Ноябрь' }, { value: '12', label: 'Декабрь' },
      ];
    }
    return [
      { value: '1', label: 'Yanvar' }, { value: '2', label: 'Fevral' }, { value: '3', label: 'Mart' },
      { value: '4', label: 'Aprel' }, { value: '5', label: 'May' }, { value: '6', label: 'Iyun' },
      { value: '7', label: 'Iyul' }, { value: '8', label: 'Avgust' }, { value: '9', label: 'Sentyabr' },
      { value: '10', label: 'Oktyabr' }, { value: '11', label: 'Noyabr' }, { value: '12', label: 'Dekabr' },
    ];
  };

  const getDaysArray = (yStr: string, mStr: string) => {
    const y = parseInt(yStr) || currentYear;
    const m = parseInt(mStr) || 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // Handle saving profile from inside Dashboard modal
  const handleSaveProfileFromDashboard = async () => {
    setIsSavingProfile(true);
    try {
      let dateOfBirth: string | undefined = undefined;
      if (profileForm.dobYear && profileForm.dobMonth && profileForm.dobDay) {
        const m = profileForm.dobMonth.padStart(2, '0');
        const d = profileForm.dobDay.padStart(2, '0');
        dateOfBirth = `${profileForm.dobYear}-${m}-${d}`;
      }

      const payload = {
        name: profileForm.name,
        ...(dateOfBirth && { dateOfBirth }),
        gender: profileForm.gender,
        heightCm: Number(profileForm.heightCm),
        weightKg: Number(profileForm.weightKg),
        goal: profileForm.goal,
      };

      const { data: updated } = await api.patch('/profile', payload);

      // Re-fetch dashboard & invalidation
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      toast.success(
        locale === 'ru'
          ? `Профиль сохранен! Новая цель: ${updated.dailyCalorieGoal} ккал/день`
          : locale === 'en'
          ? `Profile updated! New goal: ${updated.dailyCalorieGoal} kcal/day`
          : `Profil yangilandi! Yangi kkal me'yori: ${updated.dailyCalorieGoal} kkal/kun`
      );

      setIsProfileModalOpen(false);
    } catch {
      toast.error(
        locale === 'ru'
          ? 'Ошибка обновления профиля'
          : locale === 'en'
          ? 'Failed to update profile'
          : 'Profilni yangilashda xatolik'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Humanized Translations
  const uiText = {
    dailyGoal: locale === 'ru' ? 'Дневная цель:' : locale === 'en' ? 'Daily Goal:' : "Kunlik me'yor:",
    done: locale === 'ru' ? 'Выполнено' : locale === 'en' ? 'Achieved' : 'Bajarildi',
    caloriesGoal: locale === 'ru' ? 'Цель' : locale === 'en' ? 'Target' : 'Reja',
    consumed: locale === 'ru' ? 'Съедено' : locale === 'en' ? 'Consumed' : 'Qabul qilindi',
    remaining: locale === 'ru' ? 'Осталось' : locale === 'en' ? 'Remaining' : 'Qoldi',
    protein: locale === 'ru' ? 'Белки' : locale === 'en' ? 'Proteins' : 'Oqsillar',
    fat: locale === 'ru' ? 'Жиры' : locale === 'en' ? 'Fats' : "Yog'lar",
    carbs: locale === 'ru' ? 'Углеводы' : locale === 'en' ? 'Carbs' : 'Uglevodlar',
    recentLogsTitle: locale === 'ru' ? '📋 История приемов пищи' : locale === 'en' ? '📋 Meal History' : '📋 Bugungi taomlar ro\'yxati',
    latestAnalysisTitle: locale === 'ru' ? '📷 Последнее проанализированное блюдо' : locale === 'en' ? '📷 Latest Analyzed Food' : '📷 Oxirgi tahlil qilingan taom',
    latestPhotoPlaceholder: locale === 'ru' ? 'У вас еще нет добавленных блюд. Сделайте фото, чтобы искусственный интеллект проанализировал вашу еду!' : locale === 'en' ? 'You haven\'t logged any meals yet. Take a photo and let our AI analyze your food!' : 'Sizda hali tahlil qilingan taomlar yo\'q. Taom rasmini yuklang, sun\'iy intellekt uni tahlil qilib beradi!',
    mealTypeBreakfast: locale === 'ru' ? 'Завтрак' : locale === 'en' ? 'Breakfast' : 'Ertalabki nonushta',
    mealTypeLunch: locale === 'ru' ? 'Обед' : locale === 'en' ? 'Lunch' : 'Tushlik',
    mealTypeDinner: locale === 'ru' ? 'Ужин' : locale === 'en' ? 'Dinner' : 'Kechki ovqat',
    mealTypeSnack: locale === 'ru' ? 'Перекус' : locale === 'en' ? 'Snack' : 'Perekus / Yengil taom',
    noMealsDesc: locale === 'ru' ? 'Пока нет записей. Нажмите на кнопку ниже, чтобы сфотографировать тарелку.' : locale === 'en' ? 'No records yet. Press the button below to take a photo of your plate.' : 'Hozircha hech narsa yo\'q. Kamerani yoqib, taom rasmini yuklang.',
    addMealBtn: locale === 'ru' ? 'Добавить еду' : locale === 'en' ? 'Add Meal' : 'Taom tahlili',
  };

  const getMealTypeName = (type: string) => {
    if (type === 'BREAKFAST') return uiText.mealTypeBreakfast;
    if (type === 'LUNCH') return uiText.mealTypeLunch;
    if (type === 'DINNER') return uiText.mealTypeDinner;
    return uiText.mealTypeSnack;
  };

  const getHumanizedMacros = (p: number, f: number, c: number) => {
    if (locale === 'ru') {
      return `Белки: ${Math.round(p)}г · Жиры: ${Math.round(f)}г · Углеводы: ${Math.round(c)}г`;
    }
    if (locale === 'en') {
      return `P: ${Math.round(p)}g · F: ${Math.round(f)}g · C: ${Math.round(c)}g`;
    }
    return `Oqsil: ${Math.round(p)}g · Yog': ${Math.round(f)}g · Ugl: ${Math.round(c)}g`;
  };

  const latestLogWithImage = recentLogs.find(log => log.imageUrl);
  const latestMealDisplay = latestLogWithImage || recentLogs[0];

  return (
    <main className="min-h-screen pb-28 bg-transparent">
      <TrialBanner />

      {/* Header with Centered Navigation */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200/40 dark:border-slate-800/40 bg-white/40 dark:bg-slate-900/10 backdrop-blur-md sticky top-0 z-30 transition-all duration-300">

        {/* Logo Section */}
        <div className="flex items-center gap-3 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/15 shrink-0">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">CaloFit</span>
        </div>

        {/* Centered Navigation Menu */}
        <nav className="flex items-center justify-center bg-white/90 dark:bg-[#1e293b]/90 backdrop-blur-md px-2 py-1 rounded-2xl border border-gray-200/60 dark:border-slate-800 shadow-md gap-1">
          <Link href="/dashboard" className="px-4 py-2 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 transition-all">
            {locale === 'ru' ? 'Главная' : locale === 'en' ? 'Home' : 'Bosh sahifa'}
          </Link>
          <Link href="/chat" className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-450 flex items-center gap-1.5 transition-all">
            <Sparkles size={13} className="text-emerald-500" />
            {locale === 'ru' ? 'ИИ Диетолог' : locale === 'en' ? 'AI Dietician' : 'Sun\'iy intellekt'}
          </Link>
          <Link href="/support" className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-450 transition-all">
            {locale === 'ru' ? 'Помощь' : locale === 'en' ? 'Support' : 'Yordam'}
          </Link>
          {(user?.role === 'ADMIN' || user?.email?.startsWith('admin@')) && (
            <Link href="/admin" className="px-3 py-2 rounded-xl text-xs font-extrabold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all">
              👑 Admin
            </Link>
          )}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* User Profile / Account Button */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-250 dark:border-slate-800 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm active:scale-95 duration-200 cursor-pointer"
            title={locale === 'ru' ? 'Профиль и Статистика' : 'Profile & Stats'}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
              {profile.name ? profile.name.charAt(0).toUpperCase() : <User size={12} />}
            </div>
            <span className="hidden sm:inline font-bold">{profile.name ?? 'Account'}</span>
          </button>

          {/* Language Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-250 dark:border-slate-800 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-200"
            >
              <span>{LANG_MAP[locale as 'uz' | 'ru' | 'en']?.flag || "🇺🇿"}</span>
              <span className="hidden sm:inline font-bold">{LANG_MAP[locale as 'uz' | 'ru' | 'en']?.label}</span>
              <ChevronDown size={12} className={`text-gray-400 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`} />
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-32 rounded-xl border border-gray-150 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-xl py-1.5 z-50 animate-fade-in">
                {(Object.keys(LANG_MAP) as Array<'uz' | 'ru' | 'en'>).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLangOpen(false);
                      router.replace(pathname, { locale: l });
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-left text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span>{LANG_MAP[l].flag}</span>
                      <span className="font-bold">{LANG_MAP[l].label}</span>
                    </span>
                    {locale === l && <Check size={12} className="text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Switch */}
          <button onClick={toggleTheme} className="p-2.5 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-green-50/50 dark:hover:bg-slate-800 transition-all border border-gray-250/50 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm cursor-pointer active:scale-95 duration-200" title={theme === 'dark' ? "Kunduzgi rejim" : "Tungi rejim"}>
            {theme === 'dark' ? <Sun size={16} className="text-amber-500 animate-spin-slow" /> : <Moon size={16} className="text-indigo-650" />}
          </button>

          {/* Logout Button */}
          <button onClick={logout} className="p-2.5 rounded-xl text-slate-450 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all border border-gray-250/50 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm cursor-pointer active:scale-95 duration-200" aria-label="Chiqish" title="Tizimdan chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <div className="w-full max-w-6xl mx-auto px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 page-enter">

        {/* Left Side: Profile Banner, Circular ring, and Macros Progress (Grid Span 8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Profile Welcome Banner */}
          <div className="glass rounded-3xl p-6 shadow-xl relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/5 dark:to-transparent border border-emerald-500/10 hover-lift">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>
                    {locale === 'ru'
                      ? `Привет, ${profile.name ?? 'Пользователь'} 👋`
                      : locale === 'en'
                        ? `Hello, ${profile.name ?? 'User'} 👋`
                        : `Salom, ${profile.name ?? 'Foydalanuvchi'} 👋`}
                  </span>
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="p-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-50 text-emerald-600 transition-all text-xs font-bold border border-emerald-500/20"
                    title={locale === 'ru' ? 'Редактировать профиль' : 'Edit Profile'}
                  >
                    <Edit3 size={14} />
                  </button>
                </h1>
                <p className="text-xs text-slate-650 dark:text-slate-350 mt-1 font-semibold">
                  {locale === 'ru'
                    ? 'Рады видеть вас! Вот ваш баланс калорий на сегодня.'
                    : locale === 'en'
                      ? 'We are glad to see you! Here is your calorie balance for today.'
                      : 'Bugungi ovqatlanish balansingiz va statistika.'}
                </p>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="self-start sm:self-center px-4 py-2.5 rounded-2xl text-xs font-black bg-white dark:bg-[#1e293b] text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>{uiText.dailyGoal} {profile.dailyCalorieGoal} {locale === 'ru' ? 'ккал' : 'kcal'}</span>
                <Edit3 size={12} className="opacity-70" />
              </button>
            </div>
          </div>

          {/* Prominent Latest Analyzed Meal Card */}
          <div onClick={() => latestMealDisplay && setSelectedMealLog(latestMealDisplay)} className="glass rounded-3xl p-6 shadow-xl relative overflow-hidden dark:bg-slate-900/50 dark:border-slate-800 transition-all hover-lift cursor-pointer">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-4">
              {uiText.latestAnalysisTitle}
            </p>

            {latestMealDisplay ? (
              <div className="flex flex-col md:flex-row gap-5 items-stretch">

                {/* Visual Image Preview */}
                <div className="relative w-full md:w-48 h-40 md:h-auto min-h-[140px] rounded-2xl overflow-hidden shadow-md shrink-0 border border-gray-150/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  {latestMealDisplay.imageUrl ? (
                    <img src={latestMealDisplay.imageUrl} alt={latestMealDisplay.foodName} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-4xl">
                      {MEAL_EMOJI[latestMealDisplay.mealType] || '🍽️'}
                    </div>
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl text-[9px] font-black text-white bg-slate-950/70 backdrop-blur-md uppercase tracking-wider">
                    {getMealTypeName(latestMealDisplay.mealType)}
                  </span>
                </div>

                {/* Details Breakdown */}
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white line-clamp-2">
                      {latestMealDisplay.foodName}
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5 mt-1">
                      <span>{MEAL_EMOJI[latestMealDisplay.mealType]}</span>
                      <span>{new Date(latestMealDisplay.loggedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'uz-Latn', { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-150/50 dark:border-slate-800/80 flex flex-wrap gap-2 items-center">
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                      {Math.round(latestMealDisplay.calories)} {locale === 'ru' ? 'ккал' : locale === 'en' ? 'kcal' : 'kkal'}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-650 dark:text-slate-350">
                      {getHumanizedMacros(latestMealDisplay.protein, latestMealDisplay.fat, latestMealDisplay.carbs)}
                    </span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center bg-gradient-to-br from-emerald-500/5 via-emerald-500/0 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/0 dark:to-transparent rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 flex flex-col items-center justify-center">
                <p className="text-4xl mb-3 animate-bounce">📸</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-4">
                  {uiText.latestPhotoPlaceholder}
                </p>
                <Link
                  href="/analyze"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-md shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  {uiText.addMealBtn}
                </Link>
              </div>
            )}
          </div>

          {/* Calorie Ring Card */}
          <div className="glass rounded-3xl p-6 shadow-xl relative overflow-hidden dark:bg-slate-900/50 dark:border-slate-800 transition-all hover-lift">
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <p className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-5">{t('title')}</p>

            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Circular Dial */}
              <div className="relative w-36 h-36 shrink-0">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="8" />
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
                    className="transition-all duration-1000 ease-out glow-ring"
                    stroke="url(#progress-gradient)"
                    strokeDasharray={`${Math.min(today.progress, 100) * 3.267} 326.7`} />
                  <defs>
                    <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={today.progress > 100 ? '#f43f5e' : '#10b981'} />
                      <stop offset="100%" stopColor={today.progress > 100 ? '#e11d48' : '#059669'} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{today.progress}%</span>
                  <span className="text-[9px] text-gray-400 mt-1.5 uppercase font-black tracking-wider">{uiText.done}</span>
                </div>
              </div>

              {/* Stats Panel */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150/70 dark:border-slate-800/80 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1">{uiText.caloriesGoal}</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{profile.dailyCalorieGoal} <span className="text-[10px] font-normal text-gray-400">{locale === 'ru' ? 'ккал' : locale === 'en' ? 'kcal' : 'kkal'}</span></span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-55/40 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block mb-1">{uiText.consumed}</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{Math.round(today.consumed.calories)} <span className="text-[10px] font-normal text-emerald-500/70">{locale === 'ru' ? 'ккал' : locale === 'en' ? 'kcal' : 'kkal'}</span></span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150/70 dark:border-slate-800/80 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1">{uiText.remaining}</span>
                  <span className="text-lg font-black text-slate-700 dark:text-slate-350">{Math.round(today.remaining.calories)} <span className="text-[10px] font-normal text-gray-450">{locale === 'ru' ? 'ккал' : locale === 'en' ? 'kcal' : 'kkal'}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Macro Progress Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: uiText.protein, value: today.consumed.protein, max: 150, color: 'from-blue-400 to-blue-600', bg: 'bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/40 dark:border-blue-900/20' },
              { label: uiText.fat, value: today.consumed.fat, max: 80, color: 'from-amber-400 to-amber-600', bg: 'bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100/40 dark:border-amber-900/20' },
              { label: uiText.carbs, value: today.consumed.carbs, max: 250, color: 'from-purple-400 to-purple-600', bg: 'bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100/40 dark:border-purple-900/20' },
            ].map((m) => (
              <div key={m.label} className={`glass rounded-2xl p-5 shadow-sm space-y-3 transition-all hover-lift ${m.bg}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{m.label}</span>
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-500">Max: {m.max}g</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{Math.round(m.value)}</span>
                  <span className="text-xs text-gray-450 font-bold">g</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${m.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min((m.value / m.max) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Side: Recent Logs */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass rounded-3xl p-6 shadow-xl dark:bg-slate-900/50 dark:border-slate-800 flex flex-col h-full min-h-[400px] hover-lift">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">{uiText.recentLogsTitle}</h2>
              <Link
                href="/log"
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors uppercase tracking-wider bg-green-50/50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-500/10 active:scale-95 cursor-pointer"
              >
                {locale === 'ru' ? 'Дневник ➔' : locale === 'en' ? 'Diary ➔' : 'Kundalik ➔'}
              </Link>
            </div>

            {recentLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <p className="text-5xl mb-3 animate-pulse">🥗</p>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 leading-relaxed max-w-[170px] mx-auto">{uiText.noMealsDesc}</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[580px] pr-1">
                {recentLogs.map((log) => (
                  <div key={log.id} onClick={() => setSelectedMealLog(log)} className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-gray-150/70 dark:border-slate-800/80 hover-lift flex items-center gap-3.5 shadow-sm cursor-pointer">
                    {log.imageUrl ? (
                      <img src={log.imageUrl} alt={log.foodName} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0">
                        {MEAL_EMOJI[log.mealType] ?? '🍽️'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate text-xs">{log.foodName}</p>
                      <p className="text-[9px] font-bold text-emerald-605 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <span>{MEAL_EMOJI[log.mealType]}</span>
                        <span>{new Date(log.loggedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'uz-Latn', { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900 dark:text-white text-xs">
                        {Math.round(Number(log.calories))} {locale === 'ru' ? 'ккал' : locale === 'en' ? 'kcal' : 'kkal'}
                      </p>
                      <p className="text-[8px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                        {getHumanizedMacros(log.protein, log.fat, log.carbs)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Floating Action FAB */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <Link href="/analyze"
          className="flex items-center gap-2.5 px-8 py-4.5 rounded-full font-black text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-2xl shadow-green-500/40 hover:shadow-green-500/60 hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer">
          <Camera size={20} className="group-hover:rotate-12 transition-transform" />
          {uiText.addMealBtn}
        </Link>
      </div>

      {/* PROFILE & ACCOUNT INFO MODAL (Opened by avatar / user button) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md page-enter">
          <div className="relative w-full max-w-xl glass rounded-3xl overflow-hidden shadow-2xl dark:bg-slate-900 dark:border-slate-800 border border-gray-150 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200/40 dark:border-slate-800/40 flex items-center justify-between z-10 shrink-0 bg-white/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 text-white flex items-center justify-center text-base font-black shadow-md">
                  {profileForm.name ? profileForm.name.charAt(0).toUpperCase() : <User size={18} />}
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                    {locale === 'ru' ? 'Профиль и Аккаунт' : locale === 'en' ? 'Account & Profile' : 'Profil va Hisob'}
                  </h2>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    {locale === 'ru' ? 'Статистика и редактирование' : 'Stats & Parameters'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile Analytical Header inside modal */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-slate-950 dark:to-slate-950 border border-emerald-500/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">BMI / ИМТ</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{currentBmi}</span>
                  <span className={`block text-[8px] font-extrabold px-1.5 py-0.5 rounded-full mt-1 ${bmiCategory.color}`}>
                    {bmiCategory.label}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-md">
                  <span className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider block">
                    {locale === 'ru' ? 'Цель калорий' : 'Calorie Goal'}
                  </span>
                  <span className="text-lg font-black">{profile.dailyCalorieGoal}</span>
                  <span className="block text-[8px] font-extrabold text-emerald-100 mt-1">
                    {locale === 'ru' ? 'ккал/день' : 'kcal/day'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    {locale === 'ru' ? 'Текущий вес' : 'Weight'}
                  </span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{profileForm.weightKg} kg</span>
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {profileForm.heightCm} cm
                  </span>
                </div>
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  {locale === 'ru' ? 'Изменить параметры' : 'Edit Parameters'}
                </h3>

                {/* Name */}
                <div>
                  <label htmlFor="modal-name" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                    {locale === 'ru' ? 'Имя и Фамилия' : 'Full Name'}
                  </label>
                  <input
                    id="modal-name"
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="Абдуллох"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                    {locale === 'ru' ? 'Пол' : 'Gender'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['MALE', 'FEMALE'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, gender: g }))}
                        className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${
                          profileForm.gender === g
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'border-gray-200 bg-white text-gray-600 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                        }`}
                      >
                        {g === 'MALE' ? (locale === 'ru' ? 'Мужчина 👨' : 'Male 👨') : (locale === 'ru' ? 'Женщина 👩' : 'Female 👩')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Birth Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-500" />
                    {locale === 'ru' ? 'Дата рождения' : 'Date of Birth'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={profileForm.dobYear}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, dobYear: e.target.value }))}
                      className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold text-xs cursor-pointer"
                    >
                      <option value="">{locale === 'ru' ? 'Год' : 'Year'}</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>

                    <select
                      value={profileForm.dobMonth}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, dobMonth: e.target.value }))}
                      className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold text-xs cursor-pointer"
                    >
                      <option value="">{locale === 'ru' ? 'Месяц' : 'Month'}</option>
                      {getMonthsList(locale).map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>

                    <select
                      value={profileForm.dobDay}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, dobDay: e.target.value }))}
                      className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold text-xs cursor-pointer"
                    >
                      <option value="">{locale === 'ru' ? 'День' : 'Day'}</option>
                      {getDaysArray(profileForm.dobYear, profileForm.dobMonth).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Height */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-gray-200/60 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="modal-height-num" className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Ruler size={13} className="text-emerald-500" />
                      {locale === 'ru' ? 'Рост (см)' : 'Height (cm)'}
                    </label>
                    <input
                      id="modal-height-num"
                      type="number"
                      min={100}
                      max={260}
                      value={profileForm.heightCm}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, heightCm: Number(e.target.value) }))}
                      className="w-16 px-2.5 py-1 rounded-xl text-center font-extrabold text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={260}
                    value={profileForm.heightCm}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, heightCm: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Weight */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-gray-200/60 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="modal-weight-num" className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Scale size={13} className="text-emerald-500" />
                      {locale === 'ru' ? 'Вес (кг)' : 'Weight (kg)'}
                    </label>
                    <input
                      id="modal-weight-num"
                      type="number"
                      min={30}
                      max={300}
                      step={0.1}
                      value={profileForm.weightKg}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, weightKg: Number(e.target.value) }))}
                      className="w-16 px-2.5 py-1 rounded-xl text-center font-extrabold text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={300}
                    step={0.5}
                    value={profileForm.weightKg}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, weightKg: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Goal Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Target size={13} className="text-emerald-500" />
                    {locale === 'ru' ? 'Цель питания' : 'Nutritional Goal'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'LOSE_WEIGHT', label: locale === 'ru' ? 'Сброс' : 'Lose', emoji: '🏃', desc: '-500 kcal' },
                      { value: 'MAINTAIN', label: locale === 'ru' ? 'Баланс' : 'Maintain', emoji: '⚖️', desc: 'Stable' },
                      { value: 'GAIN_WEIGHT', label: locale === 'ru' ? 'Набор' : 'Gain', emoji: '💪', desc: '+300 kcal' },
                    ] as const).map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, goal: g.value }))}
                        className={`p-3 rounded-xl text-center transition-all border ${
                          profileForm.goal === g.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-sm'
                            : 'border-gray-200 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 dark:border-slate-800'
                        }`}
                      >
                        <span className="text-xl block mb-1">{g.emoji}</span>
                        <p className="font-bold text-[11px] leading-tight">{g.label}</p>
                        <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{g.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer / Save Action */}
            <div className="px-6 py-4 border-t border-gray-200/40 dark:border-slate-800/40 bg-gray-50/60 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-600 dark:text-slate-400 transition-all cursor-pointer"
              >
                {locale === 'ru' ? 'Отмена' : 'Cancel'}
              </button>

              <button
                onClick={handleSaveProfileFromDashboard}
                disabled={isSavingProfile}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {isSavingProfile
                  ? (locale === 'ru' ? 'Перерасчет...' : 'Recalculating...')
                  : (locale === 'ru' ? 'Сохранить и пересчитать' : 'Save & Recalculate')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Detailed Log Modal Popup (Only opens when card is clicked) */}
      {selectedMealLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md page-enter">
          <div className="relative w-full max-w-lg glass rounded-3xl overflow-hidden shadow-2xl dark:bg-slate-900 dark:border-slate-800 border border-gray-150 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200/40 dark:border-slate-800/40 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{MEAL_EMOJI[selectedMealLog.mealType] || '🍽️'}</span>
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    {locale === 'ru' ? 'Детали блюда' : locale === 'en' ? 'Meal Details' : 'Taom tafsilotlari'}
                  </h2>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    {getMealTypeName(selectedMealLog.mealType)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMealLog(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photo & Main Name */}
              <div className="flex flex-col sm:flex-row gap-5 items-center">
                {selectedMealLog.imageUrl && (
                  <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 border border-gray-150/60 dark:border-slate-800/80 shadow-md bg-slate-100 dark:bg-slate-950">
                    <img src={selectedMealLog.imageUrl} alt={selectedMealLog.foodName} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-center sm:text-left min-w-0">
                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">{selectedMealLog.foodName}</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold mt-1 uppercase tracking-wide">
                    ⚖️ {selectedMealLog.portionSize || 'N/A'}
                  </p>
                  <p className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-black border border-red-100/50 dark:border-red-950/30">
                    🔥 {Math.round(Number(selectedMealLog.calories))} kcal
                  </p>
                </div>
              </div>

              {/* Nutrients Breakdown Progress bars */}
              <div className="bg-white/40 dark:bg-slate-950/20 p-4 rounded-2xl border border-gray-100/50 dark:border-slate-800/80 space-y-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                  {locale === 'ru' ? 'Состав макронутриентов' : locale === 'en' ? 'Macronutrient breakdown' : 'Makronutrient tarkibi'}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {/* Protein */}
                  <div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">{uiText.protein}</span>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{Math.round(Number(selectedMealLog.protein))}g</p>
                  </div>
                  {/* Fat */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">{uiText.fat}</span>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{Math.round(Number(selectedMealLog.fat))}g</p>
                  </div>
                  {/* Carbs */}
                  <div>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide">{uiText.carbs}</span>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{Math.round(Number(selectedMealLog.carbs))}g</p>
                  </div>
                </div>
              </div>

              {/* Ingredients list */}
              {selectedMealLog.ingredients && selectedMealLog.ingredients.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-455 dark:text-slate-400 uppercase tracking-wider">
                    🍎 {locale === 'ru' ? 'Ингредиенты' : locale === 'en' ? 'Ingredients' : 'Tarkibi'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMealLog.ingredients.map((ing: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-green-50 dark:bg-emerald-950/20 text-green-700 dark:text-emerald-450 rounded-xl text-xs font-semibold border border-green-150/40 dark:border-emerald-900/25">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Portion breakdown */}
              {selectedMealLog.portionBreakdown && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-455 dark:text-slate-400 uppercase tracking-wider">
                    ⚖️ {locale === 'ru' ? 'Распределение веса' : locale === 'en' ? 'Weight breakdown' : 'Vazn taqsimoti'}
                  </h4>
                  <p className="text-xs text-gray-655 dark:text-slate-350 leading-relaxed font-bold bg-white/40 dark:bg-slate-950/40 p-4 rounded-2xl border border-gray-100/50 dark:border-slate-800/80">
                    {selectedMealLog.portionBreakdown}
                  </p>
                </div>
              )}

              {/* Health advice */}
              {selectedMealLog.healthAdvice && (
                <div className="space-y-2 bg-gradient-to-br from-emerald-500/5 via-emerald-500/5 to-transparent dark:from-slate-900/30 dark:to-transparent border border-green-200/40 dark:border-slate-800 rounded-3xl p-5">
                  <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-emerald-500" />
                    {locale === 'ru' ? 'Рекомендация ИИ Диетолога' : locale === 'en' ? 'AI Dietologist recommendation' : 'AI Dietolog tavsiyasi'}
                  </h4>
                  <p className="text-xs text-emerald-900/80 dark:text-slate-300 leading-relaxed font-semibold bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-emerald-100/40 dark:border-slate-800 shadow-sm whitespace-pre-line">
                    {selectedMealLog.healthAdvice}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer / Delete Log Action */}
            <div className="px-6 py-4 border-t border-gray-200/40 dark:border-slate-800/40 bg-gray-50/40 dark:bg-slate-950/20 flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedMealLog(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                {locale === 'ru' ? 'Закрыть' : locale === 'en' ? 'Close' : 'Yopish'}
              </button>
              
              <button
                onClick={() => deleteMutation.mutate(selectedMealLog.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {locale === 'ru' ? 'Удалить' : locale === 'en' ? 'Delete' : 'O\'chirish'}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
