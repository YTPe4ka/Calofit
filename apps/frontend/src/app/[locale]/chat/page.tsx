'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useRouter, usePathname } from '@/i18n/routing';
import {
  ArrowLeft,
  Send,
  Sparkles,
  User,
  Bot,
  Loader2,
  Trash2,
  ArrowRight,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Utensils,
  X,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { SubscriptionPaywallModal } from '@/components/SubscriptionPaywallModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedMeal {
  foodName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionSize?: string;
  mealContext?: string;
}

const WELCOME_MESSAGES: Record<string, string> = {
  uz: "Salom! Men sizning shaxsiy diyetolog-konsultantingizman. Sog'lom ovqatlanish, parhezlar, taomlar rejasi yoki kaloriya hisoblash bo'yicha qanday savollaringiz bor? Istalgan tilda so'rashingiz mumkin!",
  ru: "Привет! Я ваш персональный диетолог-консультант. Задавайте любые вопросы по питанию, КБЖУ или прикрепите блюдо кнопкой 🍽️, чтобы разобрать его пользу!",
  en: "Hello! I am your personal dietician consultant. Ask any questions about healthy eating, calories, or attach a dish with 🍽️ to analyze its benefits!",
};

const SUGGESTIONS: Record<string, string[]> = {
  uz: [
    "Vazn yo'qotish uchun namuna taomlar rejasi bering",
    "Kuniga necha litr suv ichish kerak?",
    "Mushak massasini oshirish uchun qanday ovqatlanish lozim?",
    "Kechki ovqatga eng maqbul yengil taomlar nimalar?",
  ],
  ru: [
    "Примерный план питания для снижения веса",
    "Сколько воды нужно пить в день?",
    "Как питаться для набора мышечной массы?",
    "Что лучше всего съесть на легкий ужин?",
  ],
  en: [
    "Provide a sample meal plan for weight loss",
    "How much water should I drink daily?",
    "What should I eat to build muscle mass?",
    "What are the best light options for dinner?",
  ],
};

const MEAL_EMOJIS: Record<string, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
  SNACK: '🍎',
};

const LANG_MAP = {
  uz: { label: "O'zbekcha", flag: "🇺🇿" },
  ru: { label: "Русский", flag: "🇷🇺" },
  en: { label: "English", flag: "🇬🇧" },
};

export default function ChatPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('chat');
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [locale, setLocale] = useState('uz');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Attached meal state
  const [selectedMeal, setSelectedMeal] = useState<AttachedMeal | null>(null);
  const [isMealPickerOpen, setIsMealPickerOpen] = useState(false);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [isLoadingTodayMeals, setIsLoadingTodayMeals] = useState(false);
  const [customMealInput, setCustomMealInput] = useState('');

  // Unwrap params safely
  useEffect(() => {
    Promise.resolve(params).then((resolved) => {
      setLocale(resolved.locale || 'uz');
    });
  }, [params]);

  // Load transferred question/answer from /analyze OR set welcome message
  useEffect(() => {
    if (!locale) return;

    try {
      const saved = sessionStorage.getItem('calofit_chat_transfer');
      if (saved) {
        const parsed = JSON.parse(saved);
        sessionStorage.removeItem('calofit_chat_transfer');

        const initialMsgs: Message[] = [
          {
            role: 'assistant',
            content: WELCOME_MESSAGES[locale] || WELCOME_MESSAGES.uz,
          },
        ];

        if (parsed.question && parsed.answer) {
          initialMsgs.push(
            { role: 'user', content: parsed.question },
            { role: 'assistant', content: parsed.answer },
          );
        }

        setMessages(initialMsgs);

        if (parsed.meal) {
          setSelectedMeal(parsed.meal);
        }
        return;
      }
    } catch {}

    setMessages([
      {
        role: 'assistant',
        content: WELCOME_MESSAGES[locale] || WELCOME_MESSAGES.uz,
      },
    ]);
  }, [locale]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const { hasAccess } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const fetchTodayMeals = async () => {
    setIsLoadingTodayMeals(true);
    try {
      const { data } = await api.get('/meals');
      setTodayMeals(data?.logs || []);
    } catch {
      setTodayMeals([]);
    } finally {
      setIsLoadingTodayMeals(false);
    }
  };

  const handleSelectLoggedMeal = (meal: any) => {
    const mealContext = `Блюдо: ${meal.foodName}, прием пищи: ${meal.mealType}, калории: ${meal.calories} ккал, белки: ${meal.protein || 0}г, жиры: ${meal.fat || 0}г, углеводы: ${meal.carbs || 0}г${meal.portionSize ? `, порция: ${meal.portionSize}` : ''}${meal.ingredients?.length ? `, ингредиенты: ${meal.ingredients.join(', ')}` : ''}.`;

    setSelectedMeal({
      foodName: meal.foodName,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      fat: Number(meal.fat) || 0,
      carbs: Number(meal.carbs) || 0,
      portionSize: meal.portionSize || '',
      mealContext,
    });
    setIsMealPickerOpen(false);
    toast.success(
      locale === 'ru'
        ? `Блюдо «${meal.foodName}» прикреплено`
        : `«${meal.foodName}» biriktirildi`,
    );
  };

  const handleSelectCustomMeal = () => {
    const trimmed = customMealInput.trim();
    if (!trimmed) return;

    const mealContext = `Пользователь обсуждает блюдо: ${trimmed}.`;
    setSelectedMeal({
      foodName: trimmed,
      calories: 0,
      mealContext,
    });
    setCustomMealInput('');
    setIsMealPickerOpen(false);
    toast.success(
      locale === 'ru'
        ? `Блюдо «${trimmed}» прикреплено`
        : `«${trimmed}» biriktirildi`,
    );
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    if (!hasAccess) {
      setPaywallOpen(true);
      return;
    }

    const userMessage = textToSend.trim();
    setInput('');

    // Add user message to state
    const updatedMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const history = updatedMessages
        .slice(1, -1) // exclude welcome message and latest user message
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const mealContext = selectedMeal
        ? selectedMeal.mealContext ||
          `Блюдо: ${selectedMeal.foodName}, калории: ${selectedMeal.calories} ккал, белки: ${selectedMeal.protein || 0}г, жиры: ${selectedMeal.fat || 0}г, углеводы: ${selectedMeal.carbs || 0}г.`
        : undefined;

      const { data } = await api.post<{ reply: string }>('/chat', {
        message: userMessage,
        history,
        mealContext,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      toast.error(
        locale === 'ru'
          ? 'Ошибка связи с ИИ'
          : locale === 'en'
            ? 'AI connection error occurred'
            : 'AI bilan bog\'lanishda xatolik yuz berdi',
      );
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: WELCOME_MESSAGES[locale] || WELCOME_MESSAGES.uz,
      },
    ]);
    setSelectedMeal(null);
    toast.success(
      locale === 'ru'
        ? 'История очищена'
        : locale === 'en'
          ? 'Chat history cleared'
          : 'Tarix tozalandi',
    );
  };

  const handleLocaleChange = (newLocale: 'uz' | 'ru' | 'en') => {
    setLangOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  const currentSuggestions = SUGGESTIONS[locale] || SUGGESTIONS.uz;
  const currentLang = LANG_MAP[locale as 'uz' | 'ru' | 'en'] || LANG_MAP.uz;

  return (
    <main className="h-screen w-screen flex bg-slate-50 dark:bg-[#0b0f19] overflow-hidden font-sans relative">
      <SubscriptionPaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />

      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-15%] w-[45vw] h-[45vw] rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[40vw] h-[40vw] rounded-full bg-green-200/20 dark:bg-green-500/5 blur-[110px] pointer-events-none" />

      {/* Sidebar Panel (Desktop) */}
      <aside className="hidden lg:flex w-72 bg-white/70 dark:bg-[#111827]/60 backdrop-blur-xl border-r border-gray-200/50 dark:border-slate-800/50 flex-col shrink-0 p-5 z-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">CaloFit AI</h2>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider uppercase">
              {t('title')}
            </p>
          </div>
        </div>

        {/* Sidebar Info Section */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Attached Meal Card in Sidebar if any */}
          {selectedMeal && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Utensils size={12} />
                  <span>{t('attached_label')}</span>
                </span>
                <button
                  onClick={() => setSelectedMeal(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                  title={t('detach_btn')}
                >
                  <X size={12} />
                </button>
              </div>
              <div className="font-bold text-xs text-gray-900 dark:text-white">
                {selectedMeal.foodName}
              </div>
              {selectedMeal.calories > 0 && (
                <div className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedMeal.calories} ккал
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/20">
            <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
              {locale === 'ru' ? 'Как это работает?' : locale === 'en' ? 'How it works' : 'Bu qanday ishlaydi?'}
            </h3>
            <p className="text-xs text-emerald-900/80 dark:text-slate-300 leading-relaxed font-medium">
              {locale === 'ru'
                ? 'Диетолог отвечает коротко и по делу: вердикт, КБЖУ, влияние на цель и практический совет. Вы можете прикрепить любое блюдо кнопкой 🍽️!'
                : locale === 'en'
                  ? 'Dietician gives concise verdict, macros, goal impact, and quick advice. You can attach any dish via 🍽️ button!'
                  : 'Dietolog qisqa va aniq javob beradi: xulosa, KBJU, maqsadga ta’siri va amaliy maslahat. 🍽️ tugmasi orqali taom biriktirishingiz mumkin!'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              {locale === 'ru' ? 'Примеры вопросов' : locale === 'en' ? 'Example Questions' : 'Savol namunalari'}
            </h3>
            <div className="space-y-2">
              {currentSuggestions.slice(0, 2).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(sug)}
                  className="w-full p-2.5 rounded-xl bg-white/80 hover:bg-emerald-50/50 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-gray-100/80 dark:border-slate-800/50 text-left text-[11px] text-gray-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-400 transition-all font-medium block"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="pt-4 border-t border-gray-200/50 dark:border-slate-800">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold text-xs transition-all border border-gray-200/20 dark:border-slate-800/50 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} />
            {locale === 'ru' ? 'Вернуться в дашборд' : locale === 'en' ? 'Back to Dashboard' : 'Dashboardga qaytish'}
          </button>
        </div>
      </aside>

      {/* Main Chat Display Wrapper */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Sticky Header */}
        <header className="h-16 border-b border-gray-200/60 dark:border-slate-800/80 flex items-center justify-between px-6 shrink-0 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all border border-gray-100/50 dark:border-slate-800/50"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white text-sm md:text-base leading-tight">
                  {t('title')}
                </h1>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Online
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Elements */}
          <div className="flex items-center gap-2">
            {/* Language Selector Dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>{currentLang.flag}</span>
                <span className="hidden sm:inline">{currentLang.label}</span>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform ${langOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-40 page-enter">
                  {(Object.keys(LANG_MAP) as Array<'uz' | 'ru' | 'en'>).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLocaleChange(l)}
                      className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-left text-xs font-medium text-gray-700 dark:text-slate-200 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <span>{LANG_MAP[l].flag}</span>
                        <span>{LANG_MAP[l].label}</span>
                      </span>
                      {locale === l && <Check size={12} className="text-green-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:text-green-600 dark:hover:text-emerald-400 hover:bg-green-50/50 dark:hover:bg-slate-800/80 transition-all border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-slate-600" />}
            </button>

            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              title={locale === 'ru' ? 'Очистить историю' : 'Tarixni tozalash'}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable Messages Panel */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 min-h-0 bg-[#f8fafc]/40 dark:bg-[#0f172a]/20"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 max-w-[90%] sm:max-w-[78%] animate-fade-in ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
                    : 'bg-gradient-to-br from-emerald-400 to-green-600 text-white'
                }`}
              >
                {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm transition-all border ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white border-transparent rounded-tr-none shadow-emerald-500/10'
                      : 'bg-white dark:bg-[#1e293b] text-gray-800 dark:text-slate-100 border-gray-150/70 dark:border-slate-800/80 rounded-tl-none whitespace-pre-line'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-[90%] sm:max-w-[78%] mr-auto">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0 bg-gradient-to-br from-emerald-400 to-green-600 text-white flex items-center justify-center shadow-sm">
                <Bot size={15} />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-white dark:bg-[#1e293b] border border-gray-150/70 dark:border-slate-800/80 rounded-tl-none flex items-center gap-2 shadow-sm text-gray-500 text-xs">
                <Loader2 size={14} className="animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-gray-500 dark:text-slate-400 animate-pulse">
                  {locale === 'ru' ? 'Диетолог думает...' : locale === 'en' ? 'Dietician is thinking...' : 'Diyetolog o\'ylamoqda...'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Suggestions Cards (Show only when no user messages are sent yet) */}
          {messages.length === 1 && !selectedMeal && (
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto animate-fade-in">
              {currentSuggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(sug)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#1e293b] border border-gray-200/50 dark:border-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-400 transition-all flex justify-between items-center gap-3 shadow-sm hover:shadow group cursor-pointer"
                >
                  <span>{sug}</span>
                  <ArrowRight
                    size={14}
                    className="text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input Bar Form */}
        <footer className="p-3 sm:p-5 border-t border-gray-250/50 dark:border-slate-800/80 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto space-y-2">
            {/* Attached Meal Floating Banner */}
            {selectedMeal && (
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 flex flex-col gap-2 animate-fade-in shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Utensils size={13} />
                    </div>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                      {selectedMeal.foodName}
                    </span>
                    {selectedMeal.calories > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/15">
                        {selectedMeal.calories} ккал
                      </span>
                    )}
                    {selectedMeal.protein !== undefined && selectedMeal.protein > 0 && (
                      <span className="hidden sm:inline text-[10px] text-gray-500 dark:text-slate-400 shrink-0 font-medium">
                        (Б: {selectedMeal.protein}г • Ж: {selectedMeal.fat || 0}г • У: {selectedMeal.carbs || 0}г)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMeal(null)}
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                    title={t('detach_btn')}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Quick Prompts for attached meal */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 shrink-0 uppercase tracking-wider">
                    {t('ask_prefix')}
                  </span>
                  {[t('quick_q1'), t('quick_q2'), t('quick_q3'), t('quick_q4')].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSend(chip)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition-all shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2"
            >
              {/* Attach Meal Button */}
              <button
                type="button"
                onClick={() => {
                  fetchTodayMeals();
                  setIsMealPickerOpen(true);
                }}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95 ${
                  selectedMeal
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40'
                }`}
                title={t('attach_meal')}
              >
                <Utensils size={17} />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={
                  selectedMeal
                    ? locale === 'ru'
                      ? `Спросите о «${selectedMeal.foodName}»...`
                      : `Ask about "${selectedMeal.foodName}"...`
                    : locale === 'ru'
                      ? 'Задайте вопрос диетологу (или прикрепите блюдо 🍽️)...'
                      : locale === 'en'
                        ? 'Ask the dietician a question (or attach a meal 🍽️)...'
                        : 'Diyetologga savol bering (yoki taom biriktiring 🍽️)...'
                }
                className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white placeholder:text-gray-400 text-xs sm:text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
              />

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm cursor-pointer shrink-0 active:scale-95"
              >
                <Send size={16} />
                <span className="hidden sm:inline">
                  {locale === 'ru' ? 'Отправить' : locale === 'en' ? 'Send' : 'Yuborish'}
                </span>
              </button>
            </form>
          </div>
        </footer>
      </div>

      {/* Select Meal Modal */}
      {isMealPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 shadow-2xl p-6 space-y-4 relative animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsMealPickerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 mb-1">
                <Utensils size={22} />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                {t('modal_title')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {t('modal_desc')}
              </p>
            </div>

            {/* Today's Meals Section */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={13} className="text-amber-500" />
                <span>{t('today_meals')}</span>
              </h4>

              {isLoadingTodayMeals ? (
                <div className="p-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span>{locale === 'ru' ? 'Загрузка блюд...' : 'Taomlar yuklanmoqda...'}</span>
                </div>
              ) : todayMeals.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {todayMeals.map((meal) => (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => handleSelectLoggedMeal(meal)}
                      className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 border border-gray-150 dark:border-slate-800 hover:border-emerald-500/30 flex items-center justify-between text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base shrink-0">
                          {MEAL_EMOJIS[meal.mealType] || '🍽️'}
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {meal.foodName}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">
                            {meal.mealType} • {meal.calories} ккал
                            {meal.protein ? ` • Б:${meal.protein} Ж:${meal.fat} У:${meal.carbs}` : ''}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-center text-xs text-gray-400 font-medium">
                  {t('no_meals_today')}
                </div>
              )}
            </div>

            {/* Custom Meal Input Section */}
            <div className="pt-3 border-t border-gray-150 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                {t('custom_meal_title')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMealInput}
                  onChange={(e) => setCustomMealInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSelectCustomMeal();
                    }
                  }}
                  placeholder={t('custom_meal_placeholder')}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-xs placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <button
                  type="button"
                  onClick={handleSelectCustomMeal}
                  disabled={!customMealInput.trim()}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  {t('select_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

