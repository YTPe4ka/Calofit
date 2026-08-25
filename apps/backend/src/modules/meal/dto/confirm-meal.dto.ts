import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MealType } from '@prisma/client';

export class ConfirmMealDto {
  @ApiProperty({ description: 'AI tahlil ID si' })
  @IsString()
  @IsNotEmpty()
  analysisId: string;

  @ApiProperty({ enum: MealType, example: MealType.LUNCH })
  @IsEnum(MealType, {
    message: "mealType: BREAKFAST, LUNCH, DINNER yoki SNACK bo'lishi kerak",
  })
  mealType: MealType;

  @ApiProperty({ example: 'Palov', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  foodName: string;

  @ApiProperty({ example: '300g', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  portionSize: string;

  @ApiProperty({ example: 450.0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Kaloriya manfiy bo'lishi mumkin emas" })
  @Max(10_000)
  calories: number;

  @ApiProperty({ example: 12.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000)
  protein: number;

  @ApiProperty({ example: 18.0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000)
  fat: number;

  @ApiProperty({ example: 60.0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000)
  carbs: number;
}
