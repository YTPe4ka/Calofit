import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import {
  AIProvider,
  FoodAnalysisResult,
} from '../interfaces/ai-provider.interface';

const FoodAnalysisSchema = z.object({
  is_food: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()),
  food_name: z.string().max(200).default(''),
  food_name_local: z.string().max(200).default(''),
  portion_size: z.string().max(200).default(''),
  calories: z.coerce.number().min(0).max(20_000).default(0),
  protein: z.coerce.number().min(0).max(5_000).default(0),
  fat: z.coerce.number().min(0).max(5_000).default(0),
  carbs: z.coerce.number().min(0).max(5_000).default(0),
  confidence_score: z.coerce.number().min(0).max(1).default(0.85),
  notes: z.string().max(1000).default(''),
  ingredients: z.array(z.string()).default([]),
  health_advice: z.string().nullable().optional(),
  portion_breakdown: z.string().nullable().optional(),
});

@Injectable()
export class GeminiProvider extends AIProvider {
  private readonly genAI: GoogleGenerativeAI;
  private readonly primaryModel: string;
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private config: ConfigService) {
    super();
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
    this.primaryModel = config.get<string>('GEMINI_MODEL') || 'gemini-flash-lite-latest';
  }

  async analyzeFood(
    buffer: Buffer,
    mimeType: string,
    locale?: string,
  ): Promise<FoodAnalysisResult> {
    const userLanguage =
      locale === 'ru' ? 'Russian' : locale === 'en' ? 'English' : 'Uzbek';

    const prompt = `You are a professional nutritionist, dietician, and computer vision food recognition AI.

CRITICAL INSTRUCTION - STRICT FOOD DETECTION:
1. Examine the image thoroughly.
2. Determine if the image contains real, edible food or beverages intended for human consumption (e.g. prepared dishes, cooked meals, bakery, fruits, vegetables, drinks).
3. If the image is NOT edible food or beverage (for example: animals, pets, cats, dogs, humans, selfies, faces, mountains, landscapes, nature, cars, vehicles, electronics, furniture, clothes, empty plates or empty tables with NO food, screenshots, memes, random objects):
   - You MUST set "is_food": false
   - Set "food_name": "Not food"
   - Set "food_name_local": "Not food"
   - Set "portion_size": "0g"
   - Set "calories": 0
   - Set "protein": 0
   - Set "fat": 0
   - Set "carbs": 0
   - Set "confidence_score": 0.0
   - Set "notes": "No food detected in image."
   - Set "ingredients": []
   - Set "health_advice": null
   - Set "portion_breakdown": null

4. ONLY IF the image contains real food or beverages ("is_food": true):
   - Provide accurate nutritional calculations for the entire visible portion.
   - "food_name": Dish Name in English
   - "food_name_local": Dish Name in ${userLanguage}
   - "portion_size": Estimated portion in ${userLanguage} (e.g. 1 portion ~300g)
   - "calories": Total calories (kcal)
   - "protein": Total protein (g)
   - "fat": Total fat (g)
   - "carbs": Total carbohydrates (g)
   - "confidence_score": Confidence from 0.5 to 1.0
   - "notes": Short note in ${userLanguage}
   - "ingredients": Array of key detected ingredients in ${userLanguage}
   - "health_advice": Professional, concise nutritionist advice in ${userLanguage}
   - "portion_breakdown": Weight breakdown of ingredients in ${userLanguage} (e.g. "Мясо: ~150г, Гарнир: ~150г")

Return ONLY a valid JSON object matching the schema. No markdown formatting, no backticks, no comments.`;

    const imageMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: imageMime,
      },
    };

    const candidateModels = [
      this.primaryModel,
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-flash-latest',
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        // 12-second per-model timeout to avoid hanging when a model is slow
        const callPromise = model.generateContent([prompt, imagePart]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MODEL_TIMEOUT')), 12_000),
        );

        const result = await Promise.race([callPromise, timeoutPromise]);
        const rawContent = result.response.text();

        let parsed: any;
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          const cleaned = rawContent
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
          parsed = JSON.parse(cleaned);
        }

        const validated = FoodAnalysisSchema.safeParse(parsed);
        if (!validated.success) {
          this.logger.error(
            `Gemini (${modelName}) Zod validation failed: ${validated.error.message}`,
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
        if (err.message === 'NOT_FOOD_IMAGE') {
          throw err;
        }
        this.logger.warn(`Gemini model ${modelName} error: ${err?.message || err}`);
        lastError = err;
      }
    }

    this.logger.error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
    throw new Error('AI_API_ERROR');
  }
}
