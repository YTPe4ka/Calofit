import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  AIProvider,
  FoodAnalysisResult,
} from '../interfaces/ai-provider.interface';

// ─── Zod Schema ───────────────────────────────────────────
const FoodAnalysisSchema = z.object({
  is_food: z.boolean(),
  food_name: z.string().max(100).default(''),
  food_name_local: z.string().max(100).default(''),
  portion_size: z.string().max(200).default(''),
  calories: z.number().min(0).max(10_000).default(0),
  protein: z.number().min(0).max(1_000).default(0),
  fat: z.number().min(0).max(1_000).default(0),
  carbs: z.number().min(0).max(1_000).default(0),
  confidence_score: z.number().min(0).max(1).default(0),
  notes: z.string().max(500).default(''),
  ingredients: z.array(z.string()).default([]),
  health_advice: z.string().nullable().optional(),
  portion_breakdown: z.string().nullable().optional(),
});

// ─── OpenAI JSON Schema ───────────────────────────────────
const FOOD_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    is_food: {
      type: 'boolean',
      description: 'True if the image contains real edible food or drink for human consumption, false otherwise.',
    },
    food_name: {
      type: 'string',
      description: 'Name of the food/dish in English. "Not food" if not food.',
    },
    food_name_local: {
      type: 'string',
      description: 'Local name in the requested language. "Not food" if not food.',
    },
    portion_size: {
      type: 'string',
      description: 'Estimated portion description (e.g. "1 serving (~300g)"). "0g" if not food.',
    },
    calories: {
      type: 'number',
      description:
        'Total calories (kcal) for the entire visible portion. 0 if not food.',
    },
    protein: {
      type: 'number',
      description: 'Total protein in grams. 0 if not food.',
    },
    fat: { type: 'number', description: 'Total fat in grams. 0 if not food.' },
    carbs: {
      type: 'number',
      description: 'Total carbohydrates in grams. 0 if not food.',
    },
    confidence_score: {
      type: 'number',
      description: 'Confidence level from 0.0 to 1.0. 0.0 if not food.',
    },
    notes: {
      type: 'string',
      description: 'Optional brief note. Max 200 chars.',
    },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description:
        'List of detected key ingredients in the language of the request.',
    },
    health_advice: {
      type: ['string', 'null'],
      description:
        'Detailed professional dietician advice about this dish in the requested language. Null if not food.',
    },
    portion_breakdown: {
      type: ['string', 'null'],
      description:
        'Estimated breakdown of dish weight components. Null if not food.',
    },
  },
  required: [
    'is_food',
    'food_name',
    'food_name_local',
    'portion_size',
    'calories',
    'protein',
    'fat',
    'carbs',
    'confidence_score',
    'notes',
    'ingredients',
    'health_advice',
    'portion_breakdown',
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a professional dietician, nutritionist, and computer vision food recognition AI.

CRITICAL RULES - STRICT FOOD DETECTION:
1. First, rigorously determine if the image contains real, edible food or beverages intended for human consumption.
2. If the image does NOT contain food/drink (for example: animals like cats, dogs, pets; humans, faces, selfies; mountains, landscapes, nature; cars, vehicles, electronics, furniture, clothes, empty plates or empty tables with NO food, screenshots, memes, random objects):
   - You MUST set "is_food": false
   - Set "food_name": "Not food"
   - Set "food_name_local": "Not food"
   - Set "portion_size": "0g"
   - Set calories, protein, fat, carbs, and confidence_score to 0
   - Set "notes": "No food detected"
   - Set "ingredients": []
   - Set "health_advice": null
   - Set "portion_breakdown": null
3. If and ONLY IF the image contains real food/beverages ("is_food": true):
   - Estimate portion size based on visual cues (plate size, utensils, context).
   - If multiple dishes are visible, analyze the TOTAL combined nutrition.
   - Provide values per the ENTIRE visible portion, not per 100g.
   - Use standard nutritional databases for accuracy.
   - For Central Asian cuisine (palov, lagman, samsa, etc.), apply region-specific values.
   - confidence_score reflects certainty (0.5 to 1.0).
   - health_advice: Professional dietician advice explaining nutritional pros and cons.
   - ingredients: List of visible ingredients.
   - portion_breakdown: Estimated breakdown of dish weight components.
4. Always respond with valid JSON matching the schema.`;

const USER_PROMPT =
  'Analyze this food image, perform a full dietician analysis, and return a JSON object matching the required schema.';

@Injectable()
export class OpenAIProvider extends AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private config: ConfigService) {
    super();
    this.client = new OpenAI({
      apiKey: config.get<string>('OPENAI_API_KEY') || 'dummy-openai-key',
    });
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o');
  }

  async analyzeFood(
    buffer: Buffer,
    mimeType: string,
    locale?: string,
  ): Promise<FoodAnalysisResult> {
    let rawContent: string;

    const userLanguage =
      locale === 'ru' ? 'Russian' : locale === 'en' ? 'English' : 'Uzbek';
    const dynamicPrompt = `Analyze this food image, perform a full dietician analysis, and return a JSON object matching the required schema. IMPORTANT: All text/string fields ("food_name_local", "portion_size", "notes", "ingredients", "health_advice", "portion_breakdown") MUST be written in the following language: ${userLanguage}.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1500,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'food_analysis',
            strict: true,
            schema: FOOD_ANALYSIS_SCHEMA,
          },
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${buffer.toString('base64')}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: dynamicPrompt },
            ],
          },
        ],
      });

      rawContent = response.choices[0]?.message?.content ?? '';
    } catch (err: any) {
      this.logger.error(
        `OpenAI API error (${err?.status || 'unknown'}): ${err?.message || err}`,
      );
      throw new Error('AI_API_ERROR');
    }

    // JSON parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      this.logger.error('JSON parse failed', rawContent);
      throw new Error('AI_PARSE_ERROR');
    }

    // Zod validation
    const result = FoodAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.error('Zod validation failed', result.error.message);
      throw new Error('AI_INVALID_RESPONSE');
    }

    if (!result.data.is_food) {
      throw new Error('NOT_FOOD_IMAGE');
    }

    return {
      foodName: result.data.food_name_local || result.data.food_name,
      portionSize: result.data.portion_size,
      calories: Math.round(result.data.calories * 100) / 100,
      protein: Math.round(result.data.protein * 100) / 100,
      fat: Math.round(result.data.fat * 100) / 100,
      carbs: Math.round(result.data.carbs * 100) / 100,
      confidenceScore: result.data.confidence_score,
      ingredients: result.data.ingredients,
      healthAdvice: result.data.health_advice || null,
      portionBreakdown: result.data.portion_breakdown || null,
    };
  }
}
