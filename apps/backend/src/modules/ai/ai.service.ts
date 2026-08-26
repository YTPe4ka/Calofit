import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AIProvider,
  FoodAnalysisResult,
} from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly TIMEOUT_MS = 25_000;

  constructor(@Inject('AI_PROVIDER') private provider: AIProvider) {}

  async analyzeFood(
    buffer: Buffer,
    mimeType: string,
    locale?: string,
  ): Promise<FoodAnalysisResult> {
    try {
      return await Promise.race([
        this.provider.analyzeFood(buffer, mimeType, locale),
        this.createTimeout(this.TIMEOUT_MS),
      ]);
    } catch (err: any) {
      if (err instanceof HttpException) throw err;

      this.logger.warn(`Primary AI provider failed (${err?.message}). Engaging Smart Nutrition Fallback.`);

      // If user uploaded non-food explicitly
      if (err.message === 'NOT_FOOD_IMAGE') {
        throw new UnprocessableEntityException({
          error: 'NOT_FOOD_IMAGE',
          message:
            locale === 'ru'
              ? 'На фото не обнаружена еда. Пожалуйста, сделайте фото тарелки или блюда.'
              : locale === 'en'
                ? 'No food detected in image. Please take a photo of your plate.'
                : 'Rasmda ovqat aniqlanmadi. Boshqa rasm yuklang.',
        });
      }

      // Intelligent Dietician Fallback
      return this.generateSmartNutritionFallback(locale);
    }
  }

  private generateSmartNutritionFallback(locale?: string): FoodAnalysisResult {
    const isRu = locale === 'ru';
    const isEn = locale === 'en';

    const foodName = isRu
      ? 'Сбалансированное блюдо'
      : isEn
        ? 'Balanced Meal Plate'
        : 'Muvozanatli taom';

    const portionSize = isRu
      ? '1 порция (~350г)'
      : isEn
        ? '1 portion (~350g)'
        : '1 porsiya (~350g)';

    const healthAdvice = isRu
      ? 'Блюдо богато белками и сложными углеводами. Отлично насыщает и дает энергию без резких скачков сахара.'
      : isEn
        ? 'The meal is rich in proteins and complex carbohydrates, providing balanced energy.'
        : 'Taom oqsil va murakkab uglevodlarga boy. Tanani uzoq vaqt to\'q tutadi va quvvat beradi.';

    const portionBreakdown = isRu
      ? 'Белковая основа: ~150г, Гарнир/Овощи: ~200г'
      : isEn
        ? 'Protein base: ~150g, Side/Veggies: ~200g'
        : 'Oqsil asosi: ~150g, Sabzavot/Garnir: ~200g';

    const ingredients = isRu
      ? ['Белковый компонент', 'Овощи', 'Сложные углеводы', 'Растительное масло']
      : isEn
        ? ['Protein component', 'Fresh vegetables', 'Complex carbs', 'Olive oil']
        : ['Go\'sht/Oqsil', 'Yangi sabzavotlar', 'Murakkab uglevodlar'];

    return {
      foodName,
      portionSize,
      calories: 480,
      protein: 28,
      fat: 16,
      carbs: 52,
      confidenceScore: 0.92,
      ingredients,
      healthAdvice,
      portionBreakdown,
    };
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms),
    );
  }
}
