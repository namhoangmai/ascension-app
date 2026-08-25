"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type Route } from "next";
import { ArrowLeft, ImagePlus, Plus, Save, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type SyntheticEvent } from "react";

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

export default function LogFoodPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateKey = searchParams.get("date") ?? getDateKey(new Date());
  const nutritionHref = `/nutrition?date=${dateKey}` as Route;

  const [customFoods, setCustomFoods] = useState<FoodDatabaseItem[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMealItem[]>([]);
  const [foodForm, setFoodForm] = useState<FoodFormState>(EMPTY_FOOD_FORM);
  const [foodFormError, setFoodFormError] = useState<string | null>(null);
  const [foodPhotoDataUrl, setFoodPhotoDataUrl] = useState("");
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

  function persistLogs(items: NutritionLogItem[]) {
    const logsByDate = readLogsByDate();
    const nextLogs = {
      ...logsByDate,
      [dateKey]: [...(logsByDate[dateKey] ?? []), ...items]
    };

    localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(nextLogs));
  }

  function handleFoodPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFoodPhotoDataUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
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
      source: "custom",
      ...(foodPhotoDataUrl ? { imageUrl: foodPhotoDataUrl } : {})
    };

    const nextCustomFoods = [customFood, ...customFoods];
    setCustomFoods(nextCustomFoods);
    localStorage.setItem(FOOD_DATABASE_STORAGE_KEY, JSON.stringify(nextCustomFoods));
    setFoodForm(EMPTY_FOOD_FORM);
    setFoodFormError(null);
    setFoodPhotoDataUrl("");
    setStatusMessage(`${name} added to your food database.`);
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
    <div className="w-full max-w-6xl space-y-6 px-4 pb-24 sm:px-6 lg:mx-auto lg:px-8">
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

      <section className="rounded-2xl border border-white/10 bg-card/90 p-4 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <Utensils className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Log food</h1>
            <p className="text-sm text-muted-foreground">Add foods you eat, or log a saved meal.</p>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <section className="rounded-2xl border border-white/10 bg-card/80 p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">Add food</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create foods you eat often with nutrition per 100g.
          </p>

          <form className="mt-4 space-y-4" onSubmit={handleCreateFood}>
            <input
              value={foodForm.name}
              onChange={(event) => {
                setFoodForm((form) => ({ ...form, name: event.target.value }));
              }}
              placeholder="Food name"
              className="h-12 w-full rounded-xl border border-white/10 bg-background/70 px-4 outline-none"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="grid size-20 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {foodPhotoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foodPhotoDataUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium transition-colors hover:bg-white/10">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {foodPhotoDataUrl ? "Change photo" : "Add photo (optional)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleFoodPhotoChange}
                  />
                </label>
                {foodPhotoDataUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFoodPhotoDataUrl("");
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            {foodFormError ? <p className="text-sm text-destructive">{foodFormError}</p> : null}
            <Button type="submit" className="w-full sm:w-auto">
              <Save className="size-4" aria-hidden="true" />
              Save food
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card/80 p-4 sm:p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="bg-white/8 grid size-10 place-items-center rounded-full">
              <Utensils className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Meals</h2>
              <p className="text-sm text-muted-foreground">Save combinations and log them in one tap.</p>
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
    </div>
  );
}
