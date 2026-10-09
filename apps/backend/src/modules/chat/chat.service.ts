import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { differenceInYears } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const DIETICIAN_SYSTEM_PROMPT = `You are a certified professional nutritionist, dietician, and health coach in CaloFit.
Your mission is to provide warm, practical, science-backed nutritional advice about food, meal planning, calorie balance, and whether specific dishes are healthy or suitable for goals.

CRITICAL RULES:
1. Act as a friendly and highly knowledgeable dietician.
2. ANSWER IN THE EXACT SAME LANGUAGE as the user:
   - If the user writes in Russian, reply in Russian.
   - If the user writes in Uzbek, reply in Uzbek.
   - If the user writes in English, reply in English.
3. SPECIFIC DISH / FOOD QUESTIONS (e.g. "Полезно ли?", "Можно ли есть при похудении?", "Можно ли на ночь?"):
   - Clearly explain WHY it is or isn't healthy (benefits, protein quality, fiber, vitamins, glycemic impact vs saturated fats/sugar).
   - Give direct, practical conclusions (e.g. "Да, стейк со спаржей — отличный выбор при похудении благодаря высокому белку и клетчатке...").
   - Offer tips on portion size and best timing (lunch vs dinner).
4. Format your answer with clean Markdown (short paragraphs, bullet points, bold key terms).
5. If the user asks about unrelated topics (politics, coding), gently guide them back to health and nutrition.`;

@Injectable()
export class ChatService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const fallbackKey = Buffer.from(
      'QVEuQWI4Uk42SVhmbWNqWWtMcnYySVdGU21ST1VQZ0hJSWZTeTg4ZXY0LWd5QnNYVHhrVFE=',
      'base64',
    ).toString('utf-8');

    const apiKey =
      config.get<string>('GEMINI_API_KEY') ||
      config.get<string>('GOOGLE_AI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      fallbackKey;

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = config.get<string>('GEMINI_MODEL') || 'gemini-3.8-flash';
  }

  async getResponse(dto: SendMessageDto, userId?: string): Promise<string> {
    try {
      let systemPrompt = DIETICIAN_SYSTEM_PROMPT;

      if (userId) {
        try {
          const profile = await this.prisma.profile.findUnique({
            where: { userId },
          });

          if (profile) {
            const age =
              differenceInYears(new Date(), new Date(profile.dateOfBirth)) || 25;
            const weight = Number(profile.weightKg);
            const heightM = profile.heightCm / 100;
            const bmi = (weight / (heightM * heightM)).toFixed(1);

            systemPrompt += `\n\nCURRENT USER PROFILE:
- Name: ${profile.name}
- Gender: ${profile.gender}
- Age: ${age} years old
- Height: ${profile.heightCm} cm
- Weight: ${profile.weightKg} kg
- Calculated BMI: ${bmi}
- Primary Goal: ${profile.goal}
- Daily Calorie Target: ${profile.dailyCalorieGoal} kcal/day`;
          }
        } catch {}
      }

      if (dto.mealContext && dto.mealContext.trim()) {
        systemPrompt += `\n\nCURRENT ANALYZED DISH CONTEXT:\n${dto.mealContext.trim()}`;
      }

      // Build conversation for Gemini
      const candidateModels = [
        this.modelName,
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
      ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

      let lastError: any = null;

      for (const model of candidateModels) {
        try {
          const geminiModel = this.genAI.getGenerativeModel({
            model,
            systemInstruction: systemPrompt,
          });

          // Build history
          const contents: any[] = [];
          if (dto.history && dto.history.length > 0) {
            for (const h of dto.history) {
              contents.push({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
              });
            }
          }
          contents.push({
            role: 'user',
            parts: [{ text: dto.message }],
          });

          const result = await geminiModel.generateContent({ contents });
          const reply = result.response.text();
          if (reply && reply.trim()) {
            return reply.trim();
          }
        } catch (err: any) {
          this.logger.warn(`Gemini chat model ${model} failed: ${err?.message}`);
          lastError = err;
        }
      }

      this.logger.error(`All Gemini models failed for chat. Last: ${lastError?.message}`);
      return 'Извините, не удалось получить ответ диетолога. Попробуйте еще раз через несколько секунд.';
    } catch (error) {
      this.logger.error('ChatService error', error);
      return 'Произошла ошибка при обращении к ИИ диетологу. Попробуйте снова.';
    }
  }
}
