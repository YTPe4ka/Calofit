import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import {
  AIProvider,
  FoodAnalysisResult,
} from '../interfaces/ai-provider.interface';

const FoodAnalysisSchema = z.object({
  is_food: z.boolean(),
  food_name: z.string().min(1).max(100),
  food_name_local: z.string().max(100),
  portion_size: z.string().min(1).max(200),
  calories: z.number().min(0).max(10_000),
  protein: z.number().min(0).max(1_000),
  fat: z.number().min(0).max(1_000),
  carbs: z.number().min(0).max(1_000),
  confidence_score: z.number().min(0).max(1),
  notes: z.string().max(200),
  ingredients: z.array(z.string()),
  health_advice: z.string().nullable().optional(),
  portion_breakdown: z.string().nullable().optional(),
});

@Injectable()
export class GeminiProvider extends AIProvider {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private config: ConfigService) {
    super();
    const apiKey =
      config.get<string>('GEMINI_API_KEY') ||
      config.get<string>('GOOGLE_AI_API_KEY') ||
      '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = config.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
  }

  async analyzeFood(
    buffer: Buffer,
    mimeType: string,
    locale?: string,
  ): Promise<FoodAnalysisResult> {
    const userLanguage =
      locale === 'ru' ? 'Russian' : locale === 'en' ? 'English' : 'Uzbek';

    const prompt = `You are a professional nutritionist. Analyze this food image accurately and return ONLY a valid JSON object matching this structure with NO markdown or extra text:
{
  "is_food": true,
  "food_name": "Dish Name in English",
  "food_name_local": "Dish Name in ${userLanguage}",
  "portion_size": "Estimated portion in ${userLanguage} (e.g. 1 portion ~300g)",
  "calories": 450,
  "protein": 25,
  "fat": 15,
  "carbs": 50,
  "confidence_score": 0.95,
  "notes": "Short note",
  "ingredients": ["Ingredient 1", "Ingredient 2"],
  "health_advice": "Short, clear professional dietician advice in ${userLanguage} without fluff.",
  "portion_breakdown": "Breakdown of ingredients weight in ${userLanguage}"
}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const imagePart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const rawContent = result.response.text();

      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        const cleaned = rawContent
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        parsed = JSON.parse(cleaned);
      }

      const validated = FoodAnalysisSchema.safeParse(parsed);
      if (!validated.success) {
        this.logger.error(
          'Gemini Zod validation failed',
          validated.error.message,
        );
        throw new Error('AI_INVALID_RESPONSE');
      }

      if (!validated.data.is_food) {
        throw new Error('NOT_FOOD_IMAGE');
      }

      return {
        foodName: validated.data.food_name_local || validated.data.food_name,
        portionSize: validated.data.portion_size,
        calories: Math.round(validated.data.calories * 100) / 100,
        protein: Math.round(validated.data.protein * 100) / 100,
        fat: Math.round(validated.data.fat * 100) / 100,
        carbs: Math.round(validated.data.carbs * 100) / 100,
        confidenceScore: validated.data.confidence_score,
        ingredients: validated.data.ingredients,
        healthAdvice: validated.data.health_advice || null,
        portionBreakdown: validated.data.portion_breakdown || null,
      };
    } catch (err: any) {
      if (
        err.message === 'NOT_FOOD_IMAGE' ||
        err.message === 'AI_INVALID_RESPONSE'
      ) {
        throw err;
      }
      this.logger.error(`Gemini API error: ${err?.message || err}`);
      throw new Error('AI_API_ERROR');
    }
  }
}
