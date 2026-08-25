import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Gender, Goal } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Abdulloh', minLength: 2, maxLength: 100 })
  @IsOptional()
  @MinLength(2, { message: "Ism kamida 2 ta belgi bo'lishi kerak" })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: '1998-05-15',
    description: 'ISO 8601 sana formati',
  })
  @IsOptional()
  @IsDateString({}, { message: "Sana noto'g'ri formatda" })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender, { message: "Jins: MALE yoki FEMALE bo'lishi kerak" })
  gender?: Gender;

  @ApiPropertyOptional({ example: 178, minimum: 50, maximum: 280 })
  @IsOptional()
  @IsInt({ message: "Bo'y butun son bo'lishi kerak" })
  @Min(50, { message: "Bo'y kamida 50 sm" })
  @Max(280, { message: "Bo'y 280 sm dan oshmasligi kerak" })
  heightCm?: number;

  @ApiPropertyOptional({ example: 75.5, minimum: 10, maximum: 500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Vazn son bo'lishi kerak" })
  @Min(10, { message: 'Vazn kamida 10 kg' })
  @Max(500, { message: 'Vazn 500 kg dan oshmasligi kerak' })
  weightKg?: number;

  @ApiPropertyOptional({ enum: Goal, example: Goal.LOSE_WEIGHT })
  @IsOptional()
  @IsEnum(Goal, {
    message: "Maqsad: LOSE_WEIGHT, MAINTAIN yoki GAIN_WEIGHT bo'lishi kerak",
  })
  goal?: Goal;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  dailyCalorieGoal?: number;
}
