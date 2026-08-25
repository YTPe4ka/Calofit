import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { format } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { ConfirmMealDto } from './dto/confirm-meal.dto';

@Injectable()
export class MealService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private storageService: StorageService,
  ) {}

  async analyze(userId: string, file: Express.Multer.File, locale?: string) {
    // 1. Storage ga yuklash (с fallback-ом при ошибках хранилища)
    let storageKey = '';
    try {
      const res = await this.storageService.upload(
        file.buffer,
        file.mimetype,
        userId,
      );
      storageKey = res.storageKey;
    } catch (err: any) {
      storageKey = `${userId}/${Date.now()}.jpg`;
    }

    // 2. AI tahlil
    const nutrition = await this.aiService.analyzeFood(
      file.buffer,
      file.mimetype,
      locale,
    );

    // 3. MealAnalysis DB ga saqlash
    const analysis = await this.prisma.mealAnalysis.create({
      data: {
        userId,
        storageKey,
        foodName: nutrition.foodName,
        portionSize: nutrition.portionSize,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
        confidenceScore: nutrition.confidenceScore,
        ingredients: nutrition.ingredients,
        healthAdvice: nutrition.healthAdvice,
        portionBreakdown: nutrition.portionBreakdown,
        isConfirmed: false,
      },
    });

    // 4. Signed URL generatsiya
    let imageUrl = '';
    try {
      imageUrl = await this.storageService.getSignedUrl(storageKey);
    } catch {}

    return {
      analysisId: analysis.id,
      imageUrl,
      nutrition,
      warning:
        nutrition.confidenceScore < 0.6
          ? 'AI natijasi ishonchli emas. Iltimos, qiymatlarni tekshiring.'
          : null,
    };
  }

  // ─── Confirm ──────────────────────────────────────────
  async confirm(userId: string, dto: ConfirmMealDto) {
    // 1. Analysis topish
    const analysis = await this.prisma.mealAnalysis.findUnique({
      where: { id: dto.analysisId },
      select: {
        id: true,
        userId: true,
        isConfirmed: true,
        storageKey: true,
        ingredients: true,
        healthAdvice: true,
        portionBreakdown: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Tahlil topilmadi',
      });
    }

    // 2. Egasilikni tekshirish
    if (analysis.userId !== userId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: "Ruxsat yo'q",
      });
    }

    // 3. Allaqachon tasdiqlanganmi?
    if (analysis.isConfirmed) {
      throw new ConflictException({
        error: 'ALREADY_CONFIRMED',
        message: 'Bu tahlil allaqachon tasdiqlangan',
      });
    }

    // 4. Signed URL for log
    const imageUrl = await this.storageService.getSignedUrl(
      analysis.storageKey,
    );

    // 5. Transaction: analysis update + meal log create
    const mealLog = await this.prisma.$transaction(async (tx) => {
      await tx.mealAnalysis.update({
        where: { id: dto.analysisId },
        data: { isConfirmed: true },
      });

      return tx.mealLog.create({
        data: {
          userId,
          analysisId: dto.analysisId,
          mealType: dto.mealType,
          foodName: dto.foodName,
          portionSize: dto.portionSize,
          calories: dto.calories,
          protein: dto.protein,
          fat: dto.fat,
          carbs: dto.carbs,
          imageUrl,
          ingredients: analysis.ingredients,
          healthAdvice: analysis.healthAdvice,
          portionBreakdown: analysis.portionBreakdown,
        },
      });
    });

    return mealLog;
  }

  // ─── Daily Logs ───────────────────────────────────────
  async getDailyLogs(userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const [profile, logs] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { dailyCalorieGoal: true },
      }),
      this.prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { loggedAt: 'asc' },
      }),
    ]);

    const rawSummary = logs.reduce(
      (acc, log) => ({
        totalCalories: acc.totalCalories + Number(log.calories),
        totalProtein: acc.totalProtein + Number(log.protein),
        totalFat: acc.totalFat + Number(log.fat),
        totalCarbs: acc.totalCarbs + Number(log.carbs),
        logCount: acc.logCount + 1,
      }),
      {
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        logCount: 0,
      },
    );

    const dailyCalorieGoal = profile?.dailyCalorieGoal ?? 2000;

    const summary = {
      totalCalories: Math.round(rawSummary.totalCalories * 100) / 100,
      totalProtein: Math.round(rawSummary.totalProtein * 100) / 100,
      totalFat: Math.round(rawSummary.totalFat * 100) / 100,
      totalCarbs: Math.round(rawSummary.totalCarbs * 100) / 100,
      logCount: rawSummary.logCount,
      dailyCalorieGoal,
      remainingCalories: Math.max(
        0,
        dailyCalorieGoal - rawSummary.totalCalories,
      ),
      diffCalories:
        Math.round((rawSummary.totalCalories - dailyCalorieGoal) * 100) / 100,
    };

    return { date: dateStr, summary, logs };
  }

  // ─── Delete Log ───────────────────────────────────────
  async deleteLog(userId: string, logId: string) {
    const log = await this.prisma.mealLog.findUnique({
      where: { id: logId },
      select: { id: true, userId: true },
    });

    if (!log) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Ovqat logi topilmadi',
      });
    }

    if (log.userId !== userId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: "Ruxsat yo'q",
      });
    }

    await this.prisma.mealLog.delete({ where: { id: logId } });
  }
}
