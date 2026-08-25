import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // Parallel queries
    const [profile, logs] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          name: true,
          dateOfBirth: true,
          gender: true,
          heightCm: true,
          weightKg: true,
          goal: true,
          dailyCalorieGoal: true,
        },
      }),
      this.prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { loggedAt: 'desc' },
        select: {
          id: true,
          mealType: true,
          foodName: true,
          calories: true,
          protein: true,
          fat: true,
          carbs: true,
          imageUrl: true,
          loggedAt: true,
          portionSize: true,
          ingredients: true,
          healthAdvice: true,
          portionBreakdown: true,
        },
      }),
    ]);

    // Aggregate
    const consumed = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + Number(log.calories),
        protein: acc.protein + Number(log.protein),
        fat: acc.fat + Number(log.fat),
        carbs: acc.carbs + Number(log.carbs),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );

    const dailyGoal = profile?.dailyCalorieGoal ?? 2000;
    const remaining = Math.max(0, dailyGoal - consumed.calories);
    const progress = Math.min(
      100,
      Math.round((consumed.calories / dailyGoal) * 100),
    );

    return {
      profile: profile
        ? {
            name: profile.name,
            dateOfBirth: profile.dateOfBirth
              ? profile.dateOfBirth.toISOString().split('T')[0]
              : null,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: Number(profile.weightKg),
            goal: profile.goal,
            dailyCalorieGoal: dailyGoal,
          }
        : {
            name: null,
            dateOfBirth: null,
            gender: 'MALE',
            heightCm: 170,
            weightKg: 70,
            goal: 'MAINTAIN',
            dailyCalorieGoal: dailyGoal,
          },
      today: {
        date: dateStr,
        consumed: {
          calories: Math.round(consumed.calories * 100) / 100,
          protein: Math.round(consumed.protein * 100) / 100,
          fat: Math.round(consumed.fat * 100) / 100,
          carbs: Math.round(consumed.carbs * 100) / 100,
        },
        remaining: { calories: Math.round(remaining * 100) / 100 },
        progress,
      },
      recentLogs: logs.slice(0, 5),
    };
  }
}
