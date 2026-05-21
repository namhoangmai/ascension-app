export interface NutritionLogItem {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  quantity: number;
  createdAt: number;
}
