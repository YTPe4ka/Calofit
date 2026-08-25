'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useParams } from 'next/navigation';
import { Sparkles, AlertTriangle, ShieldCheck, ChevronRight, Crown } from 'lucide-react';
import { SubscriptionPaywallModal } from './SubscriptionPaywallModal';

export function TrialBanner() {
  const { user, isTrialActive, isSubscriptionActive, daysRemaining } = useAuth();
  const params = useParams();
  const locale = (params?.locale as string) || 'ru';
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  // Don't show banners for Admin
  if (user.role === 'ADMIN') {
    return null;
  }

  // Active paid subscription
  if (isSubscriptionActive) {
    return (
      <>
        <div className="w-full bg-gradient-to-r from-emerald-500/10 via-emerald-600/15 to-teal-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold mx-auto sm:mx-0">
            <Crown className="w-4 h-4 text-emerald-500" />
            <span>
              {locale === 'ru'
                ? `Премиум CaloFit активен ${daysRemaining > 0 && daysRemaining < 1000 ? `(осталось ${daysRemaining} дн.)` : '(Бессрочно)'}`
                : locale === 'en'
                  ? `CaloFit Premium Active ${daysRemaining > 0 && daysRemaining < 1000 ? `(${daysRemaining} days left)` : '(Lifetime)'}`
                  : `CaloFit Premium faol ${daysRemaining > 0 && daysRemaining < 1000 ? `(${daysRemaining} kun qoldi)` : '(Cheksiz)'}`}
            </span>
          </div>
        </div>
      </>
    );
  }

  // In Trial (4 days free trial)
  if (isTrialActive) {
    return (
      <>
        <div className="w-full bg-gradient-to-r from-green-500/15 via-emerald-500/20 to-teal-500/15 border-b border-green-500/25 px-4 py-2.5 flex items-center justify-between text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 text-green-900 dark:text-emerald-200 font-medium">
            <Sparkles className="w-4 h-4 text-green-600 dark:text-emerald-400 animate-pulse" />
            <span>
              {locale === 'ru' ? (
                <>
                  Бесплатный пробный период: <strong className="font-bold text-green-700 dark:text-emerald-300">осталось {daysRemaining} дн.</strong>
                </>
              ) : locale === 'en' ? (
                <>
                  Free Trial: <strong className="font-bold text-green-700 dark:text-emerald-300">{daysRemaining} days left</strong>
                </>
              ) : (
                <>
                  Bepul sinov davri: <strong className="font-bold text-green-700 dark:text-emerald-300">{daysRemaining} kun qoldi</strong>
                </>
              )}
            </span>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <span>{locale === 'ru' ? 'Премиум' : locale === 'en' ? 'Upgrade' : 'Premium'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <SubscriptionPaywallModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </>
    );
  }

  // Expired Trial
  return (
    <>
      <div className="w-full bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-orange-500/20 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {locale === 'ru'
              ? 'Пробный период 4 дня завершён. Оформите подписку для доступа к ИИ-функциям!'
              : locale === 'en'
                ? 'Your 4-day trial has ended. Subscribe to continue AI meal analysis!'
                : '4 kunlik sinov muddati tugadi. AI tahlilidan foydalanish uchun obunani faollashtiring!'}
          </span>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-lg font-bold text-[11px] shadow-md transition-all flex items-center gap-1 active:scale-95 cursor-pointer shrink-0 ml-2"
        >
          <span>{locale === 'ru' ? 'Оформить' : locale === 'en' ? 'Subscribe' : 'Ulanish'}</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <SubscriptionPaywallModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
