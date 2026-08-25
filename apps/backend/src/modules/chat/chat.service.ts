import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { differenceInYears } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const DIETICIAN_SYSTEM_PROMPT = `You are a professional dietician, nutritionist, and health coach.
Your target is to provide healthy, structured, and science-backed nutritional advice.

RULES:
1. Act as a friendly and expert dietician.
2. Answer in the same language as the user (Uzbek, Russian, or English).
3. Keep the advice customized to the user's inquiry and their body parameters.
4. If the user asks about unrelated topics (like movies, programming, history), politely remind them that you are a dietician and can only help with health, meal planning, and nutrition topics.
5. Format your answers clearly using Markdown (use lists, bold text, etc.).
6. CALORIE & SAFETY GUIDELINES:
   - Always recommend realistic, safe, and medically sound daily calorie targets.
   - For high body weight or extreme height, emphasize gradual, sustainable weight management and safe calorie ranges (never recommend absurdly high targets above 4000 kcal/day unless for elite extreme endurance training).
   - Encourage healthy macro distribution (balanced proteins, healthy fats, complex carbs) and adequate hydration.`;

@Injectable()
export class ChatService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') });
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async getResponse(dto: SendMessageDto, userId?: string): Promise<string> {
    try {
      let systemPrompt = DIETICIAN_SYSTEM_PROMPT;

      if (userId) {
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
      }

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Append conversation history if present
      if (dto.history && dto.history.length > 0) {
        dto.history.forEach((msg) => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Append the latest user message
      messages.push({ role: 'user', content: dto.message });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      return (
        response.choices[0]?.message?.content ??
        'Sorry, I could not generate a response.'
      );
    } catch (error) {
      this.logger.error('Failed to communicate with OpenAI API', error);
      throw new Error('AI_COMMUNICATION_ERROR');
    }
  }
}
