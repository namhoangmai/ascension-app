import type {
  FoodCategory,
  FoodDatabaseItem,
  FoodOverride,
  NutritionLogItem,
  NutritionMacroGoals,
  SavedMealItem
} from "@/types/nutrition";

export const FOOD_LOG_STORAGE_KEY = "nutrition.foodLog.v2";
export const FOOD_DATABASE_STORAGE_KEY = "nutrition.foodDatabase.v2";
export const SAVED_MEALS_STORAGE_KEY = "nutrition.savedMeals.v1";
export const NUTRITION_GOALS_STORAGE_KEY = "nutrition.macroGoals.v1";
export const FOOD_OVERRIDES_STORAGE_KEY = "nutrition.foodOverrides.v1";
export const DELETED_FOOD_IDS_STORAGE_KEY = "nutrition.deletedFoodIds.v1";

export const FOOD_CATEGORIES: { id: FoodCategory; label: string }[] = [
  { id: "carbs", label: "Carbs" },
  { id: "meat", label: "Meat" },
  { id: "dairy", label: "Dairy" },
  { id: "vegetables", label: "Vegetables" },
  { id: "fruits", label: "Fruit" },
  { id: "snacks", label: "Snacks" },
  { id: "beverages", label: "Beverages" },
  { id: "supplements", label: "Supplements" },
  { id: "sauces", label: "Sauces" },
  { id: "other", label: "Other" }
];

export const DEFAULT_FOOD_CATEGORY: FoodCategory = "other";

const FOOD_CATEGORY_IDS = new Set(FOOD_CATEGORIES.map((category) => category.id));

export function isFoodCategory(value: unknown): value is FoodCategory {
  return typeof value === "string" && FOOD_CATEGORY_IDS.has(value as FoodCategory);
}

export function isFoodOverride(value: unknown): value is FoodOverride {
  if (!value || typeof value !== "object") {
    return false;
  }

  const override = value as Partial<FoodOverride>;

  return (
    typeof override.name === "string" &&
    isFoodCategory(override.category) &&
    typeof override.caloriesPer100g === "number" &&
    typeof override.proteinPer100g === "number" &&
    typeof override.carbsPer100g === "number" &&
    typeof override.fatPer100g === "number"
  );
}

export function applyFoodOverride(
  food: FoodDatabaseItem,
  override?: FoodOverride
): FoodDatabaseItem {
  return override ? { ...food, ...override } : food;
}

export const CALORIES_PER_GRAM = {
  carbs: 4,
  protein: 4,
  fat: 9
} as const;

export const MACRO_TARGETS = {
  carbs: 250,
  protein: 180,
  fat: 70
} as const;

export const DEFAULT_MACRO_GOALS: NutritionMacroGoals = {
  carbs: MACRO_TARGETS.carbs,
  protein: MACRO_TARGETS.protein,
  fat: MACRO_TARGETS.fat
};

export const DUTCH_FOOD_DATABASE: FoodDatabaseItem[] = [
  {
    id: "nl-magere-kwark",
    category: "dairy",
    name: "Magere kwark",
    caloriesPer100g: 54,
    proteinPer100g: 10,
    carbsPer100g: 4,
    fatPer100g: 0.2,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-volkoren-brood",
    category: "carbs",
    name: "Volkoren brood",
    caloriesPer100g: 235,
    proteinPer100g: 9,
    carbsPer100g: 39,
    fatPer100g: 3.5,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-pindakaas",
    category: "snacks",
    name: "Pindakaas",
    caloriesPer100g: 625,
    proteinPer100g: 26,
    carbsPer100g: 14,
    fatPer100g: 52,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-kaas-48",
    category: "dairy",
    name: "Goudse kaas 48+",
    caloriesPer100g: 356,
    proteinPer100g: 25,
    carbsPer100g: 0,
    fatPer100g: 29,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-kipfilet",
    category: "meat",
    name: "Kipfilet",
    caloriesPer100g: 110,
    proteinPer100g: 23,
    carbsPer100g: 0,
    fatPer100g: 1.5,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-zilvervliesrijst",
    category: "carbs",
    name: "Zilvervliesrijst gekookt",
    caloriesPer100g: 123,
    proteinPer100g: 2.6,
    carbsPer100g: 26,
    fatPer100g: 1,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-aardappel",
    category: "carbs",
    name: "Aardappel gekookt",
    caloriesPer100g: 83,
    proteinPer100g: 1.9,
    carbsPer100g: 17,
    fatPer100g: 0.1,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-havermout",
    category: "carbs",
    name: "Havermout",
    caloriesPer100g: 371,
    proteinPer100g: 13,
    carbsPer100g: 60,
    fatPer100g: 7,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-halfvolle-melk",
    category: "dairy",
    name: "Halfvolle melk",
    caloriesPer100g: 47,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatPer100g: 1.5,
    createdAt: 0,
    source: "netherlands"
  },
  {
    id: "nl-ei",
    category: "meat",
    name: "Ei",
    caloriesPer100g: 143,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 10,
    createdAt: 0,
    source: "netherlands"
  }
];

export function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isNutritionLogItem(value: unknown): value is NutritionLogItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<NutritionLogItem>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.calories === "number" &&
    typeof item.quantity === "number" &&
    typeof item.createdAt === "number"
  );
}

export function isFoodDatabaseItem(value: unknown): value is FoodDatabaseItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<FoodDatabaseItem>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.caloriesPer100g === "number" &&
    typeof item.proteinPer100g === "number" &&
    typeof item.carbsPer100g === "number" &&
    typeof item.fatPer100g === "number" &&
    typeof item.createdAt === "number"
  );
}

export function normalizeFoodDatabaseItem(item: FoodDatabaseItem): FoodDatabaseItem {
  return isFoodCategory(item.category) ? item : { ...item, category: DEFAULT_FOOD_CATEGORY };
}

export function readCustomFoods(): FoodDatabaseItem[] {
  try {
    const raw = localStorage.getItem(FOOD_DATABASE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isFoodDatabaseItem).map(normalizeFoodDatabaseItem);
  } catch {
    return [];
  }
}

export function readFoodOverrides(): Record<string, FoodOverride> {
  try {
    const raw = localStorage.getItem(FOOD_OVERRIDES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isFoodOverride(value)));
  } catch {
    return {};
  }
}

export function readDeletedFoodIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_FOOD_IDS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function readFoodCatalog(): FoodDatabaseItem[] {
  const overrides = readFoodOverrides();
  const deletedIds = readDeletedFoodIds();

  const builtInFoods = DUTCH_FOOD_DATABASE.filter((food) => !deletedIds.includes(food.id)).map(
    (food) => applyFoodOverride(food, overrides[food.id])
  );

  return [...builtInFoods, ...readCustomFoods()];
}

export function isSavedMealItem(value: unknown): value is SavedMealItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meal = value as Partial<SavedMealItem>;

  return typeof meal.id === "string" && typeof meal.name === "string" && Array.isArray(meal.items);
}

export function isNutritionMacroGoals(value: unknown): value is NutritionMacroGoals {
  if (!value || typeof value !== "object") {
    return false;
  }

  const goals = value as Partial<NutritionMacroGoals>;

  return (
    typeof goals.carbs === "number" &&
    goals.carbs >= 0 &&
    typeof goals.protein === "number" &&
    goals.protein >= 0 &&
    typeof goals.fat === "number" &&
    goals.fat >= 0
  );
}

export function getCaloriesFromMacroGoals(goals: NutritionMacroGoals) {
  return (
    goals.carbs * CALORIES_PER_GRAM.carbs +
    goals.protein * CALORIES_PER_GRAM.protein +
    goals.fat * CALORIES_PER_GRAM.fat
  );
}

export function calculateLogItem(food: FoodDatabaseItem, grams: number): NutritionLogItem {
  const multiplier = grams / 100;

  return {
    id: crypto.randomUUID(),
    foodId: food.id,
    name: food.name,
    calories: Math.round(food.caloriesPer100g * multiplier),
    protein: Number((food.proteinPer100g * multiplier).toFixed(1)),
    carbs: Number((food.carbsPer100g * multiplier).toFixed(1)),
    fat: Number((food.fatPer100g * multiplier).toFixed(1)),
    quantity: grams,
    createdAt: Date.now()
  };
}

export function getItemCalories(item: NutritionLogItem) {
  const hasMacroData =
    item.carbs !== undefined || item.protein !== undefined || item.fat !== undefined;

  if (!hasMacroData) {
    return item.calories;
  }

  return (
    (item.carbs ?? 0) * CALORIES_PER_GRAM.carbs +
    (item.protein ?? 0) * CALORIES_PER_GRAM.protein +
    (item.fat ?? 0) * CALORIES_PER_GRAM.fat
  );
}
