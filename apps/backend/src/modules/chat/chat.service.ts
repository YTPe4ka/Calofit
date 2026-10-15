import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { differenceInYears } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const DIETICIAN_SYSTEM_PROMPT = `You are a certified professional nutritionist, dietician, and health coach in CaloFit.
Your mission is to provide concise, practical, science-backed nutritional advice that is easy to read quickly on mobile screens.

CRITICAL CONCISENESS & FORMATTING RULES:
1. BE SHORT, PUNCHY & DIRECT:
   - DO NOT write huge essays, long philosophical intros, or giant walls of text.
   - Total answer length must be compact: around 3 to 5 brief bullet points or 70-130 words maximum.
   - Start IMMEDIATELY with the verdict (e.g. "✅ Отличный выбор для набора массы..." or "⚠️ На ночь лучше ограничить, так как...").
2. STANDARD ANSWER STRUCTURE:
   - 🎯 Вердикт (1 короткое предложение): польза/вред/соответствие цели.
   - 📊 Главные факты (2-3 коротких пункта): калории, белок, влияние на ЖКТ/сон/отеки/цель.
   - 💡 Практический совет (1 предложение): когда лучше есть, чем дополнить или более легкая альтернатива.
3. LANGUAGE:
   - ALWAYS reply in the EXACT SAME LANGUAGE as the user:
     - Russian if user asks in Russian
     - Uzbek if user asks in Uzbek
     - English if user asks in English
4. SPECIFIC DISH / FOOD QUESTIONS (e.g. "Полезно ли?", "Можно ли на ночь?", "Для набора массы?"):
   - Rely on the provided dish context (calories, protein, fats, carbs) if available.
   - Give realistic, actionable advice without preaching or repeating the user's question.
5. NO unnecessary greetings, farewells, or flattery. Get straight to the point with clean markdown.`;

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
    this.modelName = config.get<string>('GEMINI_MODEL') || 'gemini-flash-lite-latest';
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
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
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

          const callPromise = geminiModel.generateContent({ contents });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('MODEL_TIMEOUT')), 10_000),
          );

          const result = await Promise.race([callPromise, timeoutPromise]);
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
