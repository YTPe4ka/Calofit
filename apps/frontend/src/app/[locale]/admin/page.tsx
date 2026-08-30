'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Users,
  Crown,
  Sparkles,
  Clock,
  Send,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageCircle,
  Calendar,
  Utensils,
  Lock,
  ChevronRight,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

interface AdminStats {
  totalUsers: number;
  totalSubscribers: number;
  totalMeals: number;
  activeSubscriptions: number;
  inTrial: number;
  expired: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  telegramId?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  createdAt: string;
  trialEndsAt: string;
  subscriptionExpiresAt: string | null;
  isSubscriptionActive: boolean;
  mealsLogged: number;
  status: 'ADMIN' | 'ACTIVE' | 'TRIAL' | 'EXPIRED';
  daysRemaining: number;
}

export default function AdminPage() {
  const { user } = useAuth();
  const params = useParams();
  const locale = (params?.locale as string) || 'ru';

  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Broadcast state
  const [broadcastCategory, setBroadcastCategory] = useState<string>('lunch');
  const [customBroadcastText, setCustomBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Check saved admin key or admin role
  useEffect(() => {
    const saved = localStorage.getItem('calofit_admin_key');
    if (saved) {
      setAdminKey(saved);
      setIsAuthenticated(true);
    } else if (
      user?.role === 'ADMIN' ||
      user?.telegramUsername?.toLowerCase() === 'yeb0n' ||
      user?.email?.toLowerCase()?.includes('yeb0n') ||
      user?.email?.startsWith('admin@')
    ) {
      localStorage.setItem('calofit_admin_key', 'yeb0n_admin_pass');
      setAdminKey('yeb0n_admin_pass');
      setIsAuthenticated(true);
    }
  }, [user]);

  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users', { params: { query: searchQuery } }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Не удалось загрузить данные администратора');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData();
    }
  }, [isAuthenticated, fetchAdminData]);

  const handleKeyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    localStorage.setItem('calofit_admin_key', keyInput.trim());
    setAdminKey(keyInput.trim());
    setIsAuthenticated(true);
    toast.success('Ключ администратора применён!');
  };

  const handleUpdateSubscription = async (
    userId: string,
    options: {
      days?: number;
      trialDays?: number;
      isLifetime?: boolean;
      deactivate?: boolean;
    },
  ) => {
    setIsActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/subscription`, options);
      toast.success('Статус подписки успешно обновлен!');
      await fetchAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка обновления подписки');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSendBroadcast = async (category?: string) => {
    setIsBroadcasting(true);
    try {
      await api.post('/admin/broadcast', {
        category: category || broadcastCategory,
        customText: customBroadcastText || undefined,
      });
      toast.success('Уведомление успешно отправлено в Telegram-бот!');
      if (customBroadcastText) setCustomBroadcastText('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка отправки уведомления');
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <div className="w-full max-w-sm glass rounded-3xl p-8 shadow-2xl space-y-6 dark:bg-slate-900/60 dark:border-slate-800 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Lock size={28} />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Панель Администратора</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Введите пароль администратора @yeb0n для управления CaloFit
            </p>
          </div>

          <form onSubmit={handleKeyLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Пароль администратора..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              required
            />

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              Войти в Админку
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 page-enter">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-6 rounded-3xl dark:bg-slate-900/60 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              CaloFit Admin Control
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                @yeb0n
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Управление подписками, пользователями и пуш-уведомлениями бота
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const current = localStorage.getItem('calofit_api_url') || process.env.NEXT_PUBLIC_API_URL || '';
              const newUrl = prompt('Укажите URL бэкенда (например https://calofit-backend.onrender.com или оставьте пустым для авто):', current);
              if (newUrl !== null) {
                if (newUrl.trim()) {
                  localStorage.setItem('calofit_api_url', newUrl.trim());
                } else {
                  localStorage.removeItem('calofit_api_url');
                }
                toast.success('URL API обновлён!');
                fetchAdminData();
              }
            }}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer text-xs font-bold"
            title="Настройка адреса API"
          >
            ⚙️ API
          </button>

          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer"
            title="Обновить данные"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
          >
            В приложение <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Всего юзеров</span>
              <Users size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.totalUsers}
            </div>
          </div>

          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Премиум подписки</span>
              <Crown size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.activeSubscriptions}
            </div>
          </div>

          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>На триале (4 дн.)</span>
              <Sparkles size={16} className="text-green-500" />
            </div>
            <div className="text-2xl font-black text-green-600 dark:text-green-400">
              {stats.inTrial}
            </div>
          </div>

          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Истёк триал</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.expired}
            </div>
          </div>

          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Бот подписчики</span>
              <MessageCircle size={16} className="text-sky-500" />
            </div>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
              {stats.totalSubscribers}
            </div>
          </div>

          <div className="glass p-4 rounded-2xl dark:bg-slate-900/50 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Анализов еды</span>
              <Utensils size={16} className="text-teal-500" />
            </div>
            <div className="text-2xl font-black text-teal-600 dark:text-teal-400">
              {stats.totalMeals}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast & Bot Reminders Control Box */}
      <div className="glass p-6 rounded-3xl dark:bg-slate-900/50 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Send size={18} className="text-sky-500" />
            Отправка уведомлений в Telegram-бот
          </h2>
          <span className="text-[11px] text-gray-400">
            Подписчиков: {stats?.totalSubscribers || 0}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'morning', label: '🍳 Завтрак (Утро)', color: 'from-amber-500 to-orange-500' },
            { id: 'lunch', label: '🥗 Обед («Покушай!»)', color: 'from-green-500 to-emerald-600' },
            { id: 'snack', label: '🍎 Перекус (Полдник)', color: 'from-purple-500 to-pink-500' },
            { id: 'dinner', label: '🍲 Ужин (Вечер)', color: 'from-blue-500 to-indigo-600' },
            { id: 'summary', label: '🌙 Итоги дня', color: 'from-indigo-600 to-violet-700' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleSendBroadcast(item.id)}
              disabled={isBroadcasting}
              className={`p-3 rounded-2xl text-white font-bold text-xs bg-gradient-to-r ${item.color} shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center text-center cursor-pointer disabled:opacity-50`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          <input
            type="text"
            placeholder="Или введите свой текст уведомления всем подписчикам..."
            value={customBroadcastText}
            onChange={(e) => setCustomBroadcastText(e.target.value)}
            className="flex-grow px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          <button
            onClick={() => handleSendBroadcast('custom')}
            disabled={isBroadcasting || !customBroadcastText.trim()}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Send size={14} />
            Отправить всем
          </button>
        </div>
      </div>

      {/* User Management Section */}
      <div className="glass p-6 rounded-3xl dark:bg-slate-900/50 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-emerald-500" />
              Пользователи и подписки ({users.length})
            </h2>
            <p className="text-xs text-gray-400">
              Поиск и мгновенная выдача подписки пользователям
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по email, имени, @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3">
          {users.map((u) => {
            const isLoadingThis = isActionLoading === u.id;

            return (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/70 border border-gray-150 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* User Info */}
                <div className="space-y-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {u.name !== '—' ? u.name : u.email.split('@')[0]}
                    </span>

                    {/* Status Badge */}
                    {u.status === 'ADMIN' ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold text-[10px] border border-purple-500/20">
                        👑 ADMIN
                      </span>
                    ) : u.status === 'ACTIVE' ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Премиум ({u.daysRemaining} дн.)
                      </span>
                    ) : u.status === 'TRIAL' ? (
                      <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-700 dark:text-green-300 font-bold text-[10px] border border-green-500/20 flex items-center gap-1">
                        <Sparkles size={10} /> Триал ({u.daysRemaining} дн.)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] border border-rose-500/20 flex items-center gap-1">
                        <XCircle size={10} /> Истёк
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                    <span>{u.email}</span>
                    {u.telegramUsername && (
                      <a
                        href={`https://t.me/${u.telegramUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-500 hover:underline font-semibold flex items-center gap-1"
                      >
                        @{u.telegramUsername}
                      </a>
                    )}
                    {u.telegramId && !u.telegramUsername && (
                      <span className="text-gray-400 font-mono text-[11px]">
                        TG ID: {u.telegramId}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 flex items-center gap-3 pt-0.5">
                    <span>Регистрация: {new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span>Анализов: {u.mealsLogged}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleUpdateSubscription(u.id, { days: 30 })}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Выдать подписку на 1 месяц"
                  >
                    +1 Месяц
                  </button>

                  <button
                    onClick={() => handleUpdateSubscription(u.id, { days: 90 })}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Выдать подписку на 3 месяца"
                  >
                    +3 Месяца
                  </button>

                  <button
                    onClick={() => handleUpdateSubscription(u.id, { isLifetime: true })}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-xl font-extrabold text-[11px] bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Бессрочный доступ (Lifetime)"
                  >
                    👑 Lifetime
                  </button>

                  <button
                    onClick={() => handleUpdateSubscription(u.id, { trialDays: 7 })}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Продлить бесплатный триал на 7 дней"
                  >
                    +7д Триал
                  </button>

                  {u.status !== 'EXPIRED' && u.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleUpdateSubscription(u.id, { deactivate: true })}
                      disabled={isLoadingThis}
                      className="px-2 py-1.5 rounded-xl font-bold text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Отключить подписку"
                    >
                      Отключить
                    </button>
                  )}

                  {u.telegramUsername && (
                    <a
                      href={`https://t.me/${u.telegramUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 border border-sky-500/20 transition-all"
                      title="Написать в Telegram"
                    >
                      <MessageCircle size={15} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {users.length === 0 && !isLoading && (
            <div className="p-8 text-center text-gray-400 text-xs">
              Пользователи не найдены
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
