'use client';

import { useAuth } from '@/providers/auth-provider';
import { useParams } from 'next/navigation';
import {
  X,
  Sparkles,
  CheckCircle,
  Send,
  Crown,
  Zap,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';

interface SubscriptionPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionPaywallModal({
  isOpen,
  onClose,
}: SubscriptionPaywallModalProps) {
  const { user } = useAuth();
  const params = useParams();
  const locale = (params?.locale as string) || 'ru';

  if (!isOpen) return null;

  const userIdentifier = user?.email || user?.id || 'CaloFit User';
  const tgMessage =
    locale === 'ru'
      ? `Привет! Хочу оформить подписку на CaloFit для аккаунта: ${userIdentifier}`
      : locale === 'en'
        ? `Hello! I would like to subscribe to CaloFit for account: ${userIdentifier}`
        : `Salom! CaloFit obunasini faollashtirmoqchiman. Profil: ${userIdentifier}`;

  const tgUrl = `https://t.me/yeb0n?text=${encodeURIComponent(tgMessage)}`;

  const handleSubscribeClick = () => {
    // If inside Telegram WebApp, open link using Telegram SDK or window
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/yeb0n`);
    } else {
      window.open(tgUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-scale-up">
        {/* Top Header Banner */}
        <div className="relative p-6 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white transition-all active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner mb-3">
            <Crown className="w-8 h-8 text-amber-300 animate-bounce" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">
            {locale === 'ru'
              ? 'CaloFit Премиум Подписка'
              : locale === 'en'
                ? 'CaloFit Premium Subscription'
                : 'CaloFit Premium Obunasi'}
          </h2>
          <p className="text-xs text-white/85 mt-1 font-medium max-w-xs mx-auto">
            {locale === 'ru'
              ? 'Неограниченный ИИ-анализ блюд, персональный диетолог и точный КБЖУ трекинг'
              : locale === 'en'
                ? 'Unlimited AI meal analysis, personal dietitian, and macro tracking'
                : 'Cheksiz AI tahlili, shaxsiy dietolog va aniq KBJU hisobi'}
          </p>
        </div>

        {/* Benefits List */}
        <div className="p-6 space-y-4">
          <div className="space-y-2.5">
            {[
              {
                icon: <Zap className="w-4 h-4 text-emerald-500" />,
                titleRu: 'Мгновенный анализ фото еды за 3 сек',
                titleEn: 'Instant 3-second meal photo analysis',
                titleUz: 'Taom rasmini 3 sekundda tahlil qilish',
              },
              {
                icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
                titleRu: 'ИИ Диетолог с рекомендациями под вашу цель',
                titleEn: 'AI Dietitian with personalized goal advice',
                titleUz: 'Maqsadingizga mos shaxsiy AI Dietolog maslahatlari',
              },
              {
                icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
                titleRu: 'Точный расчёт белков, жиров и углеводов',
                titleEn: 'Accurate calories, protein, fat & carb breakdown',
                titleUz: 'Aniq oqsil, yog‘, uglevod va kaloriya hisobi',
              },
              {
                icon: <HeartHandshake className="w-4 h-4 text-emerald-500" />,
                titleRu: 'Заботливые напоминания поесть в Telegram-боте',
                titleEn: 'Helpful meal reminders in Telegram bot',
                titleUz: 'Telegram botda vaqtida ovqatlanish eslatmalari',
              },
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {benefit.icon}
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                  {locale === 'ru'
                    ? benefit.titleRu
                    : locale === 'en'
                      ? benefit.titleEn
                      : benefit.titleUz}
                </span>
              </div>
            ))}
          </div>

          {/* Payment instructions box */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/60 dark:border-amber-900/40 text-center space-y-1.5">
            <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
              {locale === 'ru'
                ? '💳 Оплата и подключение через Telegram:'
                : locale === 'en'
                  ? '💳 Subscription activation via Telegram:'
                  : '💳 Telegram orqali to‘lov va faollashtirish:'}
            </p>
            <p className="text-[10px] text-amber-800/90 dark:text-slate-350 leading-relaxed">
              {locale === 'ru'
                ? 'Нажмите кнопку ниже, чтобы написать создателю @yeb0n. Подписка будет мгновенно активирована для вашего аккаунта!'
                : locale === 'en'
                  ? 'Tap the button below to message creator @yeb0n. Your subscription will be activated instantly!'
                  : 'Pastdagi tugmani bosing va @yeb0n profiliga yozing. Obuna hisobingiz uchun darhol yoqib beriladi!'}
            </p>
            <div className="text-[10px] font-mono font-semibold text-gray-500 dark:text-slate-400 pt-1">
              ID: {userIdentifier}
            </div>
          </div>

          {/* Action CTA Button */}
          <button
            onClick={handleSubscribeClick}
            className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {locale === 'ru'
                ? 'Оформить подписку через @yeb0n'
                : locale === 'en'
                  ? 'Subscribe via @yeb0n in Telegram'
                  : 'Telegram @yeb0n orqali obunani ulash'}
            </span>
          </button>

          <p className="text-center text-[10px] text-gray-400 dark:text-slate-500">
            {locale === 'ru'
              ? 'Первые 4 дня бесплатно для каждого пользователя'
              : locale === 'en'
                ? 'First 4 days are completely free for every user'
                : 'Dastlabki 4 kun har bir foydalanuvchi uchun mutlaqo bepul'}
          </p>
        </div>
      </div>
    </div>
  );
}
