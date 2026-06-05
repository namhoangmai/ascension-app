export interface NutritionLogItem {
  id: string;
  foodId?: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  quantity: number;
  createdAt: number;
}

export interface FoodDatabaseItem {
  id: string;
  externalId?: string;
  servingId?: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  createdAt: number;
  source?: "netherlands" | "custom" | "fatsecret";
}

export interface SavedMealFood {
  foodId: string;
  grams: number;
}

export interface SavedMealItem {
  id: string;
  name: string;
  items: SavedMealFood[];
  createdAt: number;
}

export interface NutritionMacroGoals {
  carbs: number;
  protein: number;
  fat: number;
}
