"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { type Route } from "next";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import FoodLogList from "@/components/nutrition/food-log-list";
import {
  calculateLogItem,
  DEFAULT_MACRO_GOALS,
  FOOD_CATEGORIES,
  FOOD_LOG_STORAGE_KEY,
  NUTRITION_GOALS_STORAGE_KEY,
  getDateKey,
  getCaloriesFromMacroGoals,
  getItemCalories,
  isNutritionMacroGoals,
  isNutritionLogItem,
  readFoodCatalog
} from "@/features/nutrition/client-store";
import type {
  FoodCategory,
  FoodDatabaseItem,
  NutritionLogItem,
  NutritionMacroGoals
} from "@/types/nutrition";

const DEFAULT_LOG_GRAMS = 100;

type MacroKey = keyof NutritionMacroGoals;

const MACRO_CIRCLES: { key: MacroKey; label: string; color: string }[] = [
  { key: "carbs", label: "Carbs", color: "hsl(var(--foreground))" },
  { key: "protein", label: "Protein", color: "hsl(var(--foreground) / 0.6)" },
  { key: "fat", label: "Fat", color: "hsl(var(--foreground) / 0.3)" }
];

function getLogsByDate() {
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

function getStoredMacroGoals() {
  try {
    const raw = localStorage.getItem(NUTRITION_GOALS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return isNutritionMacroGoals(parsed) ? parsed : DEFAULT_MACRO_GOALS;
  } catch {
    return DEFAULT_MACRO_GOALS;
  }
}

function MacroRing({
  label,
  value,
  target,
  color
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const percentage = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  const progressDegrees = String(percentage * 3.6);
  const background = `conic-gradient(${color} ${progressDegrees}deg, hsl(var(--muted)) 0deg)`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="grid size-24 place-items-center rounded-full"
        style={{ background }}
        aria-label={`${label} ${String(percentage)}%`}
      >
        <div className="grid size-20 place-items-center rounded-full bg-background">
          <div className="text-center">
            <p className="text-lg font-semibold">{percentage}%</p>
            <p className="text-[11px] text-muted-foreground">{value.toFixed(1)}g</p>
          </div>
        </div>
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export default function NutritionPage() {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") ?? getDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [logsByDate, setLogsByDate] = useState<Record<string, NutritionLogItem[]>>({});
  const [macroGoals, setMacroGoals] = useState<NutritionMacroGoals>(DEFAULT_MACRO_GOALS);
  const [foodCatalog, setFoodCatalog] = useState<FoodDatabaseItem[]>([]);
  const [logCategory, setLogCategory] = useState<FoodCategory | "">("");
  const [logFoodId, setLogFoodId] = useState("");
  const [logGrams, setLogGrams] = useState<number | "">(DEFAULT_LOG_GRAMS);
  const [logStatus, setLogStatus] = useState<string | null>(null);

  useEffect(() => {
    setLogsByDate(getLogsByDate());
    setMacroGoals(getStoredMacroGoals());
    setFoodCatalog(readFoodCatalog());
  }, []);

  const logs = useMemo(() => logsByDate[selectedDate] ?? [], [logsByDate, selectedDate]);

  const foodCatalogByCategory = useMemo(() => {
    return FOOD_CATEGORIES.map((category) => ({
      ...category,
      foods: foodCatalog.filter((food) => food.category === category.id)
    })).filter((category) => category.foods.length > 0);
  }, [foodCatalog]);

  useEffect(() => {
    setLogCategory((currentCategory) => {
      if (foodCatalogByCategory.some((category) => category.id === currentCategory)) {
        return currentCategory;
      }

      return foodCatalogByCategory[0]?.id ?? "";
    });
  }, [foodCatalogByCategory]);

  const logCategoryFoods = useMemo(
    () => foodCatalogByCategory.find((category) => category.id === logCategory)?.foods ?? [],
    [foodCatalogByCategory, logCategory]
  );

  useEffect(() => {
    setLogFoodId((currentId) => {
      if (logCategoryFoods.some((food) => food.id === currentId)) {
        return currentId;
      }

      return logCategoryFoods[0]?.id ?? "";
    });
  }, [logCategoryFoods]);

  const selectedLogFood = useMemo(
    () => foodCatalog.find((food) => food.id === logFoodId) ?? null,
    [foodCatalog, logFoodId]
  );

  const logPreviewCalories =
    selectedLogFood && typeof logGrams === "number" && logGrams > 0
      ? Math.round((selectedLogFood.caloriesPer100g * logGrams) / 100)
      : null;

  const totalConsumed = useMemo(
    () => logs.reduce((sum, item) => sum + getItemCalories(item), 0),
    [logs]
  );
  const calorieGoal = getCaloriesFromMacroGoals(macroGoals);
  const caloriesLeft = Math.max(calorieGoal - totalConsumed, 0);
  const caloriePercentage =
    calorieGoal > 0 ? Math.min((totalConsumed / calorieGoal) * 100, 100) : 0;

  const macroTotals = useMemo(
    () =>
      logs.reduce(
        (totals, item) => ({
          carbs: totals.carbs + (item.carbs ?? 0),
          protein: totals.protein + (item.protein ?? 0),
          fat: totals.fat + (item.fat ?? 0)
        }),
        { carbs: 0, protein: 0, fat: 0 }
      ),
    [logs]
  );

  function handleDelete(id: string) {
    setLogsByDate((currentLogsByDate) => {
      const next = {
        ...currentLogsByDate,
        [selectedDate]: (currentLogsByDate[selectedDate] ?? []).filter((item) => item.id !== id)
      };
      localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleQuickLogFood(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const food = foodCatalog.find((candidate) => candidate.id === logFoodId);
    const grams = typeof logGrams === "number" ? logGrams : Number(logGrams);

    if (!food) {
      setLogStatus("Choose a food to log.");
      return;
    }

    if (!Number.isFinite(grams) || grams <= 0) {
      setLogStatus("Enter a valid amount in grams.");
      return;
    }

    const logItem = calculateLogItem(food, grams);

    setLogsByDate((currentLogsByDate) => {
      const next = {
        ...currentLogsByDate,
        [selectedDate]: [...(currentLogsByDate[selectedDate] ?? []), logItem]
      };
      localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setLogStatus(`Logged ${String(grams)}g of ${food.name} (${String(logItem.calories)} kcal).`);
    setLogGrams(DEFAULT_LOG_GRAMS);
  }

  function handleMacroGoalChange(key: MacroKey, value: number) {
    const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;

    setMacroGoals((currentGoals) => {
      const nextGoals = {
        ...currentGoals,
        [key]: safeValue
      };

      localStorage.setItem(NUTRITION_GOALS_STORAGE_KEY, JSON.stringify(nextGoals));

      return nextGoals;
    });
  }

  const logFoodHref = `/nutrition/log-food?date=${selectedDate}` as Route;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-muted px-3 text-sm">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
            }}
            className="bg-transparent text-sm outline-none"
            aria-label="Select nutrition date"
          />
        </label>
      </div>

      <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Calories you can eat today</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal">
            {Math.round(caloriesLeft)} kcal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {Math.round(totalConsumed)} eaten of {Math.round(calorieGoal)} kcal goal
          </p>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${String(caloriePercentage)}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {MACRO_CIRCLES.map((macro) => (
            <MacroRing
              key={macro.key}
              label={macro.label}
              value={macroTotals[macro.key]}
              target={macroGoals[macro.key]}
              color={macro.color}
            />
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Macro goal</h2>
            <p className="text-sm font-medium text-primary">{Math.round(calorieGoal)} kcal</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {MACRO_CIRCLES.map((macro) => (
              <label key={macro.key} className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground">
                  {macro.label}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={macroGoals[macro.key]}
                  onChange={(event) => {
                    handleMacroGoalChange(macro.key, Number(event.target.value));
                  }}
                  className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-center text-sm outline-none focus:border-primary/70"
                  aria-label={`${macro.label} goal grams`}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Log food</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a food from your database and enter how many grams you ate.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleQuickLogFood}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,160px)_1fr_120px]">
            <select
              value={logCategory}
              onChange={(event) => {
                setLogCategory(event.target.value as FoodCategory);
              }}
              aria-label="Food category"
              className="h-12 min-w-0 rounded-xl border border-border bg-background px-3 outline-none"
            >
              {foodCatalogByCategory.length === 0 ? (
                <option value="">No categories yet</option>
              ) : null}
              {foodCatalogByCategory.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <select
              value={logFoodId}
              onChange={(event) => {
                setLogFoodId(event.target.value);
              }}
              aria-label="Food to log"
              disabled={logCategoryFoods.length === 0}
              className="h-12 min-w-0 rounded-xl border border-border bg-background px-3 outline-none disabled:opacity-50"
            >
              {logCategoryFoods.length === 0 ? (
                <option value="">No foods in this category</option>
              ) : null}
              {logCategoryFoods.map((food) => (
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
              value={logGrams}
              onChange={(event) => {
                setLogGrams(event.target.value === "" ? "" : Number(event.target.value));
              }}
              aria-label="Amount in grams"
              placeholder="Grams"
              className="h-12 rounded-xl border border-border bg-background/70 px-3 text-right outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {logPreviewCalories !== null
                ? `≈ ${String(logPreviewCalories)} kcal`
                : "Enter an amount to preview calories"}
            </p>
            <Button type="submit" disabled={foodCatalog.length === 0}>
              <Plus className="size-4" aria-hidden="true" />
              Log food
            </Button>
          </div>

          {logStatus ? <p className="text-sm text-primary">{logStatus}</p> : null}
        </form>
      </section>

      <div className="flex justify-center">
        <Link
          href={logFoodHref}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a new food or saved meal
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Food logged</h2>
        <FoodLogList items={logs} onDelete={handleDelete} />
      </section>
    </div>
  );
}
