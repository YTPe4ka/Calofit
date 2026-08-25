import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AIProvider,
  FoodAnalysisResult,
} from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly TIMEOUT_MS = 30_000;

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
    } catch (err) {
      if (err instanceof HttpException) throw err;

      this.logger.error(`AI analysis failed: ${err.message}`);

      const errorMap: Record<string, () => never> = {
        TIMEOUT: () => {
          throw new ServiceUnavailableException({
            error: 'AI_SERVICE_TIMEOUT',
            message: "Tahlil vaqti tugadi. Iltimos, qayta urinib ko'ring.",
          });
        },
        AI_API_ERROR: () => {
          throw new ServiceUnavailableException({
            error: 'AI_SERVICE_UNAVAILABLE',
            message: 'Tahlil xizmati vaqtincha ishlamayapti.',
          });
        },
        AI_PARSE_ERROR: () => {
          throw new ServiceUnavailableException({
            error: 'AI_PARSE_ERROR',
            message: "Tahlil natijasini o'qib bo'lmadi.",
          });
        },
        AI_INVALID_RESPONSE: () => {
          throw new ServiceUnavailableException({
            error: 'AI_INVALID_RESPONSE',
            message: 'Tahlil natijasi yaroqsiz.',
          });
        },
        NOT_FOOD_IMAGE: () => {
          throw new UnprocessableEntityException({
            error: 'NOT_FOOD_IMAGE',
            message: 'Rasmda ovqat aniqlanmadi. Boshqa rasm yuklang.',
          });
        },
      };

      const handler = errorMap[err.message];
      if (handler) handler();

      throw new ServiceUnavailableException({
        error: 'AI_SERVICE_UNAVAILABLE',
        message: 'Tahlil xizmati vaqtincha ishlamayapti.',
      });
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms),
    );
  }
}
