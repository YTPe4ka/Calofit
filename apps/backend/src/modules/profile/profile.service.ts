import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Gender, Goal } from '@prisma/client';
import { differenceInYears } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProfileDto) {
    const exists = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Profil allaqachon mavjud',
      });
    }

    if (new Date(dto.dateOfBirth) > new Date()) {
      throw new BadRequestException({
        error: 'BAD_REQUEST',
        message: "Tug'ilgan sana kelajakda bo'lishi mumkin emas",
      });
    }

    const dailyCalorieGoal = this.calculateDailyCalorieGoal(dto);

    return this.prisma.profile.create({
      data: {
        userId,
        name: dto.name,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        goal: dto.goal,
        dailyCalorieGoal,
      },
    });
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Profil topilmadi',
      });
    }

    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Profil topilmadi',
      });
    }

    if (dto.dateOfBirth && new Date(dto.dateOfBirth) > new Date()) {
      throw new BadRequestException({
        error: 'BAD_REQUEST',
        message: "Tug'ilgan sana kelajakda bo'lishi mumkin emas",
      });
    }

    // Merge existing with updates for recalculation
    const merged = {
      name: dto.name ?? existing.name,
      dateOfBirth: dto.dateOfBirth
        ? dto.dateOfBirth
        : existing.dateOfBirth.toISOString(),
      gender: dto.gender ?? existing.gender,
      heightCm: dto.heightCm ?? existing.heightCm,
      weightKg: Number(dto.weightKg ?? existing.weightKg),
      goal: dto.goal ?? existing.goal,
    };

    const dailyCalorieGoal = this.calculateDailyCalorieGoal(merged);

    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.heightCm && { heightCm: dto.heightCm }),
        ...(dto.weightKg && { weightKg: dto.weightKg }),
        ...(dto.goal && { goal: dto.goal }),
        dailyCalorieGoal,
      },
    });
  }

  // ─── TDEE Calculation (Mifflin-St Jeor) ──────────────
  private calculateDailyCalorieGoal(dto: {
    dateOfBirth: string;
    gender: Gender;
    heightCm: number;
    weightKg: number;
    goal: Goal;
  }): number {
    let age = differenceInYears(new Date(), new Date(dto.dateOfBirth));
    if (isNaN(age) || age < 5 || age > 120) {
      age = 25; // Безопасное значение по умолчанию
    }

    const weight = Number(dto.weightKg) || 70;
    const height = Number(dto.heightCm) || 170;

    const bmr =
      dto.gender === Gender.MALE
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    // Использование адаптированного коэффициента активности
    const activityMultiplier = weight > 140 ? 1.35 : 1.55;
    const tdee = Math.round(bmr * activityMultiplier);

    const adjustments: Record<Goal, number> = {
      [Goal.LOSE_WEIGHT]: -500,
      [Goal.MAINTAIN]: 0,
      [Goal.GAIN_WEIGHT]: 300,
    };

    const target = Math.round(tdee + (adjustments[dto.goal] ?? 0));

    // Безопасный диапазон нормы (1200 - 5000 ккал) для предотвращения аномалий
    return Math.min(5000, Math.max(1200, target));
  }
}
