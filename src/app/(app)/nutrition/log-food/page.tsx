"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type Route } from "next";
import { ArrowLeft, Plus, Save, Search, Utensils } from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  calculateLogItem,
  DUTCH_FOOD_DATABASE,
  FOOD_DATABASE_STORAGE_KEY,
  FOOD_LOG_STORAGE_KEY,
  getDateKey,
  isFoodDatabaseItem,
  isNutritionLogItem,
  isSavedMealItem,
  SAVED_MEALS_STORAGE_KEY
} from "@/features/nutrition/client-store";
import type {
  FoodDatabaseItem,
  NutritionLogItem,
  SavedMealFood,
  SavedMealItem
} from "@/types/nutrition";

const DEFAULT_GRAMS = 100;
const DEFAULT_FATSECRET_FOOD_ID = "33691";

interface FoodFormState {
  name: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
}

const EMPTY_FOOD_FORM: FoodFormState = {
  name: "",
  caloriesPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: ""
};

function readFoodDatabase() {
  try {
    const raw = localStorage.getItem(FOOD_DATABASE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isFoodDatabaseItem);
  } catch {
    return [];
  }
}

function readSavedMeals() {
  try {
    const raw = localStorage.getItem(SAVED_MEALS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedMealItem);
  } catch {
    return [];
  }
}

function readLogsByDate() {
  try {
    const raw = localStorage.getItem(FOOD_LOG_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([dateKey, value]) => [
        dateKey,
        Array.isArray(value) ? value.filter(isNutritionLogItem) : []
      ])
    ) as Record<string, NutritionLogItem[]>;
  } catch {
    return {};
  }
}

function parseMacroValue(value: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function FoodMacroRow({ food }: { food: FoodDatabaseItem }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-muted-foreground">
      <span>{String(food.caloriesPer100g)} kcal</span>
      <span>{String(food.proteinPer100g)}g P</span>
      <span>{String(food.carbsPer100g)}g C</span>
      <span>{String(food.fatPer100g)}g F</span>
    </div>
  );
}

function getFoodPreview(food: FoodDatabaseItem, grams: number) {
  const multiplier = grams / 100;

  return {
    calories: Math.round(food.caloriesPer100g * multiplier),
    protein: Number((food.proteinPer100g * multiplier).toFixed(1)),
    carbs: Number((food.carbsPer100g * multiplier).toFixed(1)),
    fat: Number((food.fatPer100g * multiplier).toFixed(1))
  };
}

function isFoodImportResponse(value: unknown): value is { food: FoodDatabaseItem } {
  if (!value || typeof value !== "object" || !("food" in value)) {
    return false;
  }

  const response = value as { food?: unknown };

  return isFoodDatabaseItem(response.food);
}

export default function LogFoodPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateKey = searchParams.get("date") ?? getDateKey(new Date());
  const nutritionHref = `/nutrition?date=${dateKey}` as Route;

  const [customFoods, setCustomFoods] = useState<FoodDatabaseItem[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMealItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodDatabaseItem | null>(null);
  const [selectedGrams, setSelectedGrams] = useState(DEFAULT_GRAMS);
  const [foodForm, setFoodForm] = useState<FoodFormState>(EMPTY_FOOD_FORM);
  const [foodFormError, setFoodFormError] = useState<string | null>(null);
  const [fatSecretFoodId, setFatSecretFoodId] = useState(DEFAULT_FATSECRET_FOOD_ID);
  const [isImportingFatSecretFood, setIsImportingFatSecretFood] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealFoodId, setMealFoodId] = useState(DUTCH_FOOD_DATABASE[0]?.id ?? "");
  const [mealGrams, setMealGrams] = useState(DEFAULT_GRAMS);
  const [mealBuilderItems, setMealBuilderItems] = useState<SavedMealFood[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setCustomFoods(readFoodDatabase());
    setSavedMeals(readSavedMeals());
  }, []);

  const foods = useMemo(() => [...DUTCH_FOOD_DATABASE, ...customFoods], [customFoods]);

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return foods.filter((food) => food.name.toLowerCase().includes(normalizedQuery));
  }, [foods, query]);

  const hasSearchQuery = query.trim().length > 0;
  const safeSelectedGrams = Number.isFinite(selectedGrams) && selectedGrams > 0 ? selectedGrams : 0;
  const selectedFoodPreview = selectedFood ? getFoodPreview(selectedFood, safeSelectedGrams) : null;

  function persistLogs(items: NutritionLogItem[]) {
    const logsByDate = readLogsByDate();
    const nextLogs = {
      ...logsByDate,
      [dateKey]: [...(logsByDate[dateKey] ?? []), ...items]
    };

    localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(nextLogs));
  }

  function handleSelectFood(food: FoodDatabaseItem) {
    setSelectedFood(food);
    setSelectedGrams(DEFAULT_GRAMS);
    setStatusMessage(null);
  }

  function handleLogSelectedFood() {
    if (!selectedFood || !Number.isFinite(selectedGrams) || selectedGrams <= 0) {
      setStatusMessage("Enter a valid amount in grams.");
      return;
    }

    persistLogs([calculateLogItem(selectedFood, selectedGrams)]);
    router.push(nutritionHref);
  }

  function handleCreateFood(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const caloriesPer100g = parseMacroValue(foodForm.caloriesPer100g);
    const proteinPer100g = parseMacroValue(foodForm.proteinPer100g);
    const carbsPer100g = parseMacroValue(foodForm.carbsPer100g);
    const fatPer100g = parseMacroValue(foodForm.fatPer100g);
    const name = foodForm.name.trim();

    if (
      !name ||
      caloriesPer100g === null ||
      proteinPer100g === null ||
      carbsPer100g === null ||
      fatPer100g === null
    ) {
      setFoodFormError("Fill every field with valid nutrition values.");
      return;
    }

    const customFood: FoodDatabaseItem = {
      id: `custom-${crypto.randomUUID()}`,
      name,
      caloriesPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      createdAt: Date.now(),
      source: "custom"
    };

    const nextCustomFoods = [customFood, ...customFoods];
    setCustomFoods(nextCustomFoods);
    localStorage.setItem(FOOD_DATABASE_STORAGE_KEY, JSON.stringify(nextCustomFoods));
    setFoodForm(EMPTY_FOOD_FORM);
    setFoodFormError(null);
    setStatusMessage(`${name} added to your food database.`);
  }

  async function handleImportFatSecretFood() {
    const foodId = fatSecretFoodId.trim();

    if (!/^\d+$/.test(foodId)) {
      setStatusMessage("Enter a numeric FatSecret food id.");
      return;
    }

    setIsImportingFatSecretFood(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/nutrition/fatsecret/food?foodId=${foodId}`);
      const payload: unknown = await response.json();

      if (!response.ok || !isFoodImportResponse(payload)) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to import FatSecret food.";

        setStatusMessage(errorMessage);
        return;
      }

      const importedFood = payload.food;
      const nextCustomFoods = [
        importedFood,
        ...customFoods.filter((food) => food.id !== importedFood.id)
      ];

      setCustomFoods(nextCustomFoods);
      localStorage.setItem(FOOD_DATABASE_STORAGE_KEY, JSON.stringify(nextCustomFoods));
      setQuery(importedFood.name);
      setStatusMessage(`${importedFood.name} imported from FatSecret.`);
    } catch {
      setStatusMessage("Unable to reach the FatSecret import endpoint.");
    } finally {
      setIsImportingFatSecretFood(false);
    }
  }

  function handleAddMealBuilderItem() {
    if (!mealFoodId || !Number.isFinite(mealGrams) || mealGrams <= 0) {
      setStatusMessage("Choose a food and valid grams before adding it to the meal.");
      return;
    }

    setMealBuilderItems((items) => [...items, { foodId: mealFoodId, grams: mealGrams }]);
  }

  function handleSaveMeal() {
    const name = mealName.trim();

    if (!name || mealBuilderItems.length === 0) {
      setStatusMessage("Name the meal and add at least one food.");
      return;
    }

    const meal: SavedMealItem = {
      id: `meal-${crypto.randomUUID()}`,
      name,
      items: mealBuilderItems,
      createdAt: Date.now()
    };

    const nextSavedMeals = [meal, ...savedMeals];
    setSavedMeals(nextSavedMeals);
    localStorage.setItem(SAVED_MEALS_STORAGE_KEY, JSON.stringify(nextSavedMeals));
    setMealName("");
    setMealBuilderItems([]);
    setStatusMessage(`${name} saved as a meal.`);
  }

  function handleLogMeal(meal: SavedMealItem) {
    const mealLogs = meal.items
      .map((item) => {
        const food = foods.find((candidate) => candidate.id === item.foodId);
        return food ? calculateLogItem(food, item.grams) : null;
      })
      .filter((item): item is NutritionLogItem => item !== null);

    if (mealLogs.length === 0) {
      setStatusMessage("This meal no longer has matching foods.");
      return;
    }

    persistLogs(mealLogs);
    router.push(nutritionHref);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <header className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={nutritionHref}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Nutrition
          </Link>
        </Button>
        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-muted-foreground">
          {dateKey}
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-card/90 p-4 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <Search className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Log food</h1>
            <p className="text-sm text-muted-foreground">
              Search Dutch staples, add foods, or log saved meals.
            </p>
          </div>
        </div>

        <label className="mt-5 flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-background/70 px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search Netherlands food database"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
      </section>

      {statusMessage ? (
        <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </p>
      ) : null}

      {hasSearchQuery ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Search results</h2>
            <p className="text-xs text-muted-foreground">{String(filteredFoods.length)} found</p>
          </div>

          {filteredFoods.length > 0 ? (
            <div className="space-y-3">
              {filteredFoods.map((food) => {
                return (
                  <article
                    key={food.id}
                    className="rounded-2xl border border-white/10 bg-card/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold">{food.name}</h3>
                          <span className="bg-white/8 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-normal text-muted-foreground">
                            {food.source === "custom"
                              ? "Custom"
                              : food.source === "fatsecret"
                                ? "FatSecret"
                                : "NL"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Nutrition per 100g</p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        aria-label={`Select ${food.name}`}
                        onClick={() => {
                          handleSelectFood(food);
                        }}
                      >
                        <Plus className="size-5" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="mt-4">
                      <FoodMacroRow food={food} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 bg-card/60 p-4 text-sm text-muted-foreground">
              No foods found. Add it manually or import it from FatSecret.
            </p>
          )}
        </section>
      ) : null}

      {selectedFood && selectedFoodPreview ? (
        <section className="rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Log amount</p>
              <h2 className="truncate text-xl font-semibold">{selectedFood.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Nutrition calculated from grams.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFood(null);
              }}
            >
              Cancel
            </Button>
          </div>

          <label className="mt-4 flex h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-background/70 px-4 text-sm">
            <span className="font-medium text-muted-foreground">Grams</span>
            <input
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              value={selectedGrams || ""}
              onChange={(event) => {
                setSelectedGrams(Number(event.target.value));
              }}
              className="w-28 bg-transparent text-right text-xl font-semibold outline-none"
              autoFocus
            />
          </label>

          <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-background/60 p-3 text-center">
            <div>
              <p className="text-base font-semibold">{String(selectedFoodPreview.calories)}</p>
              <p className="text-[11px] text-muted-foreground">kcal</p>
            </div>
            <div>
              <p className="text-base font-semibold">{String(selectedFoodPreview.protein)}g</p>
              <p className="text-[11px] text-muted-foreground">Protein</p>
            </div>
            <div>
              <p className="text-base font-semibold">{String(selectedFoodPreview.carbs)}g</p>
              <p className="text-[11px] text-muted-foreground">Carbs</p>
            </div>
            <div>
              <p className="text-base font-semibold">{String(selectedFoodPreview.fat)}g</p>
              <p className="text-[11px] text-muted-foreground">Fat</p>
            </div>
          </div>

          <Button
            type="button"
            className="mt-4 w-full"
            onClick={handleLogSelectedFood}
            disabled={safeSelectedGrams <= 0}
          >
            Log {String(safeSelectedGrams)}g
          </Button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-card/80 p-4">
        <h2 className="text-lg font-semibold">Import from FatSecret</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fetch a food by FatSecret id and add its gram-based nutrition to your list.
        </p>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
          <input
            value={fatSecretFoodId}
            onChange={(event) => {
              setFatSecretFoodId(event.target.value);
            }}
            inputMode="numeric"
            placeholder="FatSecret food id"
            className="h-12 min-w-0 rounded-xl border border-white/10 bg-background/70 px-4 outline-none"
          />
          <Button
            type="button"
            onClick={() => {
              void handleImportFatSecretFood();
            }}
            disabled={isImportingFatSecretFood}
          >
            {isImportingFatSecretFood ? "Importing" : "Import"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/80 p-4">
        <h2 className="text-lg font-semibold">Add food</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create foods you eat often with nutrition per 100g.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleCreateFood}>
          <input
            value={foodForm.name}
            onChange={(event) => {
              setFoodForm((form) => ({ ...form, name: event.target.value }));
            }}
            placeholder="Food name"
            className="h-12 w-full rounded-xl border border-white/10 bg-background/70 px-4 outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            {(["caloriesPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"] as const).map(
              (field) => (
                <input
                  key={field}
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={foodForm[field]}
                  onChange={(event) => {
                    setFoodForm((form) => ({ ...form, [field]: event.target.value }));
                  }}
                  placeholder={
                    field === "caloriesPer100g"
                      ? "Calories"
                      : field === "proteinPer100g"
                        ? "Protein"
                        : field === "carbsPer100g"
                          ? "Carbs"
                          : "Fat"
                  }
                  className="h-12 rounded-xl border border-white/10 bg-background/70 px-4 outline-none"
                />
              )
            )}
          </div>
          {foodFormError ? <p className="text-sm text-destructive">{foodFormError}</p> : null}
          <Button type="submit" className="w-full">
            <Save className="size-4" aria-hidden="true" />
            Save food
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/80 p-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/8 grid size-10 place-items-center rounded-full">
            <Utensils className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Meals</h2>
            <p className="text-sm text-muted-foreground">
              Save combinations and log them in one tap.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {savedMeals.length > 0 ? (
            savedMeals.map((meal) => (
              <article
                key={meal.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-background/60 p-3"
              >
                <div>
                  <h3 className="font-medium">{meal.name}</h3>
                  <p className="text-xs text-muted-foreground">{String(meal.items.length)} foods</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    handleLogMeal(meal);
                  }}
                >
                  Log
                </Button>
              </article>
            ))
          ) : (
            <p className="rounded-xl bg-background/60 p-4 text-sm text-muted-foreground">
              No saved meals yet.
            </p>
          )}
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <input
            value={mealName}
            onChange={(event) => {
              setMealName(event.target.value);
            }}
            placeholder="Meal name"
            className="h-12 w-full rounded-xl border border-white/10 bg-background/70 px-4 outline-none"
          />
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <select
              value={mealFoodId}
              onChange={(event) => {
                setMealFoodId(event.target.value);
              }}
              className="h-12 min-w-0 rounded-xl border border-white/10 bg-background px-3 outline-none"
            >
              {foods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              value={mealGrams}
              onChange={(event) => {
                setMealGrams(Number(event.target.value));
              }}
              aria-label="Meal food grams"
              className="h-12 rounded-xl border border-white/10 bg-background/70 px-3 text-right outline-none"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleAddMealBuilderItem}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add item
            </Button>
            <Button type="button" className="flex-1" onClick={handleSaveMeal}>
              Save meal
            </Button>
          </div>

          {mealBuilderItems.length > 0 ? (
            <div className="space-y-2">
              {mealBuilderItems.map((item, index) => {
                const food = foods.find((candidate) => candidate.id === item.foodId);
                const label = food?.name ?? "Unknown food";

                return (
                  <div
                    key={`${item.foodId}-${String(index)}`}
                    className="rounded-xl bg-background/60 px-3 py-2 text-sm"
                  >
                    {label} - {String(item.grams)}g
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
