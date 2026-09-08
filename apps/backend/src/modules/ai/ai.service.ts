import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
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
      const result = await Promise.race([
        this.provider.analyzeFood(buffer, mimeType, locale),
        this.createTimeout(this.TIMEOUT_MS),
      ]);

      return result;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;

      this.logger.warn(`AI provider error: ${err?.message || err}`);

      // If user uploaded a non-food image (cat, dog, landscape, person, etc.)
      if (err.message === 'NOT_FOOD_IMAGE') {
        throw new UnprocessableEntityException({
          error: 'NOT_FOOD_IMAGE',
          message:
            locale === 'ru'
              ? 'На фото не обнаружена еда или напитки. Пожалуйста, загрузите чёткое фото вашего блюда.'
              : locale === 'en'
                ? 'No food or drink detected in the image. Please upload a clear photo of your meal.'
                : 'Rasmdan ovqat yoki ichimlik aniqlanmadi. Iltimos, taomingizning aniq rasmini yuklang.',
        });
      }

      if (err.message === 'TIMEOUT') {
        throw new RequestTimeoutException({
          error: 'AI_TIMEOUT',
          message:
            locale === 'ru'
              ? 'Превышено время ожидания ответа от нейросети. Пожалуйста, попробуйте еще раз.'
              : locale === 'en'
                ? 'AI analysis request timed out. Please try again.'
                : 'Tahlil vaqti tugadi. Qaytadan urinib ko\'ring.',
        });
      }

      throw new UnprocessableEntityException({
        error: 'AI_ANALYSIS_FAILED',
        message:
          locale === 'ru'
            ? 'Не удалось распознать блюдо на фото. Пожалуйста, сделайте более чёткий снимок.'
            : locale === 'en'
              ? 'Could not recognize the dish in the photo. Please take a clearer picture.'
              : 'Rasmdagi taomni aniqlab bo\'lmadi. Iltimos, aniqroq rasm yuboring.',
      });
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms),
    );
  }
}
