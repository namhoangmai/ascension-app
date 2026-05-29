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
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  createdAt: number;
}
