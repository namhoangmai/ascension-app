import type { FoodDatabaseItem } from "@/types/nutrition";

const FATSECRET_FOOD_URL = "https://platform.fatsecret.com/rest/food/v5";

interface FatSecretServing {
  serving_id?: string;
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  calories?: string;
  carbohydrate?: string;
  protein?: string;
  fat?: string;
}

interface FatSecretFood {
  food_id?: string;
  food_name?: string;
  brand_name?: string;
  servings?: {
    serving?: FatSecretServing | FatSecretServing[];
  };
}

interface FatSecretFoodResponse {
  food?: FatSecretFood;
}

export interface FatSecretImportResult {
  food: FoodDatabaseItem;
}

function parsePositiveNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function getServings(food: FatSecretFood) {
  const serving = food.servings?.serving;

  if (!serving) {
    return [];
  }

  return Array.isArray(serving) ? serving : [serving];
}

function getServingGrams(serving: FatSecretServing) {
  const metricAmount = parsePositiveNumber(serving.metric_serving_amount);

  if (metricAmount && serving.metric_serving_unit?.toLowerCase() === "g") {
    return metricAmount;
  }

  const description = `${serving.serving_description ?? ""} ${serving.measurement_description ?? ""}`;
  const isGramServing = /\bg\b/i.test(description);
  const units = parsePositiveNumber(serving.number_of_units);

  return isGramServing ? units : null;
}

function scoreServing(serving: FatSecretServing) {
  const grams = getServingGrams(serving);

  if (!grams) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(grams - 100);
}

function pickBestGramServing(servings: FatSecretServing[]) {
  return servings
    .filter((serving) => getServingGrams(serving) !== null)
    .sort((left, right) => scoreServing(left) - scoreServing(right))[0];
}

function normalizePer100g(value: number, grams: number) {
  return Number(((value / grams) * 100).toFixed(2));
}

function normalizeFatSecretFood(food: FatSecretFood): FoodDatabaseItem {
  const foodId = food.food_id;
  const name = food.food_name?.trim();
  const serving = pickBestGramServing(getServings(food));

  if (!foodId || !name || !serving) {
    throw new Error("FatSecret food response is missing required food or gram serving data.");
  }

  const grams = getServingGrams(serving);
  const calories = parseNumber(serving.calories);
  const protein = parseNumber(serving.protein);
  const carbs = parseNumber(serving.carbohydrate);
  const fat = parseNumber(serving.fat);

  if (grams === null || calories === null || protein === null || carbs === null || fat === null) {
    throw new Error("FatSecret serving response is missing required macro data.");
  }

  return {
    id: `fatsecret-${foodId}`,
    externalId: foodId,
    name,
    caloriesPer100g: normalizePer100g(calories, grams),
    proteinPer100g: normalizePer100g(protein, grams),
    carbsPer100g: normalizePer100g(carbs, grams),
    fatPer100g: normalizePer100g(fat, grams),
    createdAt: Date.now(),
    source: "fatsecret",
    ...(serving.serving_id ? { servingId: serving.serving_id } : {}),
    ...(food.brand_name?.trim() ? { brand: food.brand_name.trim() } : {})
  };
}

function isFatSecretFoodResponse(value: unknown): value is FatSecretFoodResponse {
  return Boolean(value && typeof value === "object" && "food" in value);
}

export async function getFatSecretFood(foodId: string): Promise<FatSecretImportResult> {
  const accessToken = process.env.FATSECRET_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("FATSECRET_ACCESS_TOKEN is not configured.");
  }

  const url = new URL(FATSECRET_FOOD_URL);
  url.searchParams.set("food_id", foodId);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`FatSecret request failed with status ${String(response.status)}.`);
  }

  const payload: unknown = await response.json();

  if (!isFatSecretFoodResponse(payload) || !payload.food) {
    throw new Error("FatSecret returned an unexpected food response.");
  }

  return {
    food: normalizeFatSecretFood(payload.food)
  };
}
