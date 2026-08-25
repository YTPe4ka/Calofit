export interface FoodAnalysisResult {
  foodName: string;
  portionSize: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  confidenceScore: number;
  ingredients: string[];
  healthAdvice: string | null;
  portionBreakdown: string | null;
}

export abstract class AIProvider {
  abstract analyzeFood(
    buffer: Buffer,
    mimeType: string,
    locale?: string,
  ): Promise<FoodAnalysisResult>;
}
