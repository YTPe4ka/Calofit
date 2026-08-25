import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  // ─── Stats ──────────────────────────────────────────
  async getStats() {
    const now = new Date();

    const [totalUsers, totalSubscribers, totalMeals, users] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.telegramSubscriber.count(),
        this.prisma.mealLog.count(),
        this.prisma.user.findMany({
          select: {
            id: true,
            role: true,
            trialEndsAt: true,
            subscriptionExpiresAt: true,
            isSubscriptionActive: true,
            createdAt: true,
          },
        }),
      ]);

    let activeSubscriptions = 0;
    let inTrial = 0;
    let expired = 0;

    for (const u of users) {
      if (u.role === 'ADMIN') {
        activeSubscriptions++;
        continue;
      }
      const isSub =
        u.isSubscriptionActive ||
        (u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > now);
      const isTr = u.trialEndsAt && new Date(u.trialEndsAt) > now;

      if (isSub) {
        activeSubscriptions++;
      } else if (isTr) {
        inTrial++;
      } else {
        expired++;
      }
    }

    return {
      totalUsers,
      totalSubscribers,
      totalMeals,
      activeSubscriptions,
      inTrial,
      expired,
    };
  }

  // ─── List Users ─────────────────────────────────────
  async getUsers(query?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = {};
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { telegramUsername: { contains: q, mode: 'insensitive' } },
        { telegramId: { contains: q, mode: 'insensitive' } },
        { profile: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          telegramId: true,
          telegramUsername: true,
          telegramChatId: true,
          trialEndsAt: true,
          subscriptionExpiresAt: true,
          isSubscriptionActive: true,
          createdAt: true,
          profile: {
            select: {
              name: true,
              gender: true,
              goal: true,
              dailyCalorieGoal: true,
            },
          },
          _count: {
            select: {
              mealLogs: true,
            },
          },
        },
      }),
    ]);

    const formatted = users.map((u) => {
      const isSub =
        u.isSubscriptionActive ||
        (u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > now);
      const isTr = u.trialEndsAt && new Date(u.trialEndsAt) > now;

      let daysRemaining = 0;
      if (u.role === 'ADMIN') {
        daysRemaining = 9999;
      } else if (isSub && u.subscriptionExpiresAt) {
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(u.subscriptionExpiresAt).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
      } else if (isTr && u.trialEndsAt) {
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(u.trialEndsAt).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
      }

      const status =
        u.role === 'ADMIN'
          ? 'ADMIN'
          : isSub
            ? 'ACTIVE'
            : isTr
              ? 'TRIAL'
              : 'EXPIRED';

      return {
        id: u.id,
        email: u.email,
        name: u.profile?.name || '—',
        role: u.role,
        telegramId: u.telegramId,
        telegramUsername: u.telegramUsername,
        telegramChatId: u.telegramChatId,
        createdAt: u.createdAt,
        trialEndsAt: u.trialEndsAt,
        subscriptionExpiresAt: u.subscriptionExpiresAt,
        isSubscriptionActive: u.isSubscriptionActive,
        mealsLogged: u._count.mealLogs,
        status,
        daysRemaining,
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: formatted,
    };
  }

  // ─── Manage Subscription ────────────────────────────
  async updateSubscription(
    userId: string,
    params: {
      days?: number; // Add subscription days (e.g. 30, 90, 365, 9999)
      trialDays?: number; // Extend trial days (e.g. 3, 7)
      isLifetime?: boolean; // Set lifetime subscription
      deactivate?: boolean; // Cancel / revoke
      role?: 'USER' | 'ADMIN';
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'Foydalanuvchi topilmadi',
      });
    }

    const now = new Date();
    let newSubscriptionExpiresAt = user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt)
      : null;
    let newTrialEndsAt = user.trialEndsAt
      ? new Date(user.trialEndsAt)
      : new Date();
    let isSubActive = user.isSubscriptionActive;
    let newRole = params.role || user.role;

    if (params.deactivate) {
      isSubActive = false;
      newSubscriptionExpiresAt = new Date(Date.now() - 1000);
      newTrialEndsAt = new Date(Date.now() - 1000);
    } else if (params.isLifetime) {
      isSubActive = true;
      const lifetimeDate = new Date();
      lifetimeDate.setFullYear(lifetimeDate.getFullYear() + 50);
      newSubscriptionExpiresAt = lifetimeDate;
    } else if (params.days && params.days > 0) {
      isSubActive = true;
      const baseDate =
        newSubscriptionExpiresAt && newSubscriptionExpiresAt > now
          ? newSubscriptionExpiresAt
          : now;
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + params.days);
      newSubscriptionExpiresAt = targetDate;
    }

    if (params.trialDays && params.trialDays > 0) {
      const baseTrial = newTrialEndsAt > now ? newTrialEndsAt : now;
      const targetTrial = new Date(baseTrial);
      targetTrial.setDate(targetTrial.getDate() + params.trialDays);
      newTrialEndsAt = targetTrial;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        isSubscriptionActive: isSubActive,
        subscriptionExpiresAt: newSubscriptionExpiresAt,
        trialEndsAt: newTrialEndsAt,
      },
    });

    // Notify user in Telegram bot if they have linked telegram
    if (updated.telegramChatId) {
      try {
        const chatId = parseInt(updated.telegramChatId, 10);
        if (!isNaN(chatId)) {
          let notifyMsg = '';
          if (params.deactivate) {
            notifyMsg = `ℹ️ Ваша подписка на CaloFit была деактивирована администратором.`;
          } else if (params.isLifetime) {
            notifyMsg = `🎉 **Поздравляем!**\nВам активирован **бессрочный Премиум-доступ (Lifetime)** к CaloFit! 🚀\nВсе функции теперь без ограничений!`;
          } else if (params.days) {
            const formattedExp = newSubscriptionExpiresAt
              ? newSubscriptionExpiresAt.toLocaleDateString('ru-RU')
              : '';
            notifyMsg = `🎉 **Подписка CaloFit активирована!**\n\nСрок действия: до **${formattedExp}** (+${params.days} дней).\nПриятного пользования! 🥗`;
          } else if (params.trialDays) {
            notifyMsg = `🎁 **Ваш пробный период продлен на ${params.trialDays} дн.!**\nПриятного пользования CaloFit! 🥑`;
          }

          if (notifyMsg) {
            await this.telegramService.sendCustomMessage(
              chatId,
              notifyMsg,
              '📱 Открыть CaloFit',
            );
          }
        }
      } catch (err: any) {
        this.logger.warn('Failed to send TG notification to user: ' + err?.message);
      }
    }

    return {
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isSubscriptionActive: updated.isSubscriptionActive,
        subscriptionExpiresAt: updated.subscriptionExpiresAt,
        trialEndsAt: updated.trialEndsAt,
      },
    };
  }

  // ─── Broadcast to Bot Subscribers ───────────────────
  async broadcastNotification(params: {
    category?: 'morning' | 'lunch' | 'dinner' | 'summary' | 'custom';
    customText?: string;
    targetChatId?: string;
  }) {
    if (params.targetChatId) {
      const chatId = parseInt(params.targetChatId, 10);
      if (isNaN(chatId)) {
        throw new NotFoundException('Invalid target chat ID');
      }

      if (params.customText) {
        await this.telegramService.sendCustomMessage(chatId, params.customText);
      } else {
        await this.telegramService.sendRandomNotification(
          chatId,
          (params.category as any) || 'lunch',
        );
      }
      return { success: true, count: 1 };
    }

    if (params.category && params.category !== 'custom') {
      await this.telegramService.broadcastNotification(params.category);
    } else if (params.customText) {
      const subscribers = await this.prisma.telegramSubscriber.findMany({
        select: { chatId: true },
      });

      for (const sub of subscribers) {
        try {
          const cId = parseInt(sub.chatId, 10);
          if (!isNaN(cId)) {
            await this.telegramService.sendCustomMessage(cId, params.customText);
          }
        } catch {}
      }
    }

    return { success: true };
  }
}
