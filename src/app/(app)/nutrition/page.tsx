"use client";

import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import CalorieSummaryCard from "@/components/nutrition/calorie-summary-card";
import FoodLogList from "@/components/nutrition/food-log-list";
import type { FoodDatabaseItem, NutritionLogItem } from "@/types/nutrition";

const FOOD_LOG_STORAGE_KEY = "nutrition.foodLog.v1";
const FOOD_DATABASE_STORAGE_KEY = "nutrition.foodDatabase.v1";
const CALORIES_PER_GRAM = {
  carbs: 4,
  protein: 4,
  fat: 9
} as const;

type MacroKey = keyof typeof CALORIES_PER_GRAM;

interface MacroBoard {
  key: MacroKey;
  label: string;
  colorClass: string;
  subtitle: string;
}

const MACRO_BOARDS: MacroBoard[] = [
  {
    key: "carbs",
    label: "Carbs",
    colorClass: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    subtitle: "4 kcal per gram"
  },
  {
    key: "protein",
    label: "Protein",
    colorClass: "from-sky-500/20 via-sky-500/10 to-transparent",
    subtitle: "4 kcal per gram"
  },
  {
    key: "fat",
    label: "Fat",
    colorClass: "from-amber-500/20 via-amber-500/10 to-transparent",
    subtitle: "9 kcal per gram"
  }
];

function getItemCalories(item: NutritionLogItem) {
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

function isNutritionLogItem(value: unknown): value is NutritionLogItem {
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

function isFoodDatabaseItem(value: unknown): value is FoodDatabaseItem {
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

interface FoodFormState {
  name: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
}

const emptyFoodForm: FoodFormState = {
  name: "",
  caloriesPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: ""
};

export default function NutritionPage() {
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [foods, setFoods] = useState<FoodDatabaseItem[]>([]);
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [logGrams, setLogGrams] = useState("100");
  const [goal, setGoal] = useState<number>(2400);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOOD_LOG_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) {
        setLogs(parsed.filter(isNutritionLogItem));
      }
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOOD_DATABASE_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) {
        const savedFoods = parsed.filter(isFoodDatabaseItem);
        setFoods(savedFoods);
        setSelectedFoodId(savedFoods[0]?.id ?? "");
      }
    } catch {
      setFoods([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(FOOD_DATABASE_STORAGE_KEY, JSON.stringify(foods));
  }, [foods]);

  const macroTotals = useMemo(
    () =>
      logs.reduce(
        (totals, item) => ({
          carbs: totals.carbs + (item.carbs ?? 0),
          protein: totals.protein + (item.protein ?? 0),
          fat: totals.fat + (item.fat ?? 0)
        }),
        {
          carbs: 0,
          protein: 0,
          fat: 0
        }
      ),
    [logs]
  );

  const totalConsumed = useMemo(
    () => logs.reduce((sum, item) => sum + getItemCalories(item), 0),
    [logs]
  );

  function handleFoodFormChange(key: keyof FoodFormState, value: string) {
    setFoodForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function handleCreateFood(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = foodForm.name.trim();
    const caloriesPer100g = Number(foodForm.caloriesPer100g);
    const proteinPer100g = Number(foodForm.proteinPer100g);
    const carbsPer100g = Number(foodForm.carbsPer100g);
    const fatPer100g = Number(foodForm.fatPer100g);

    if (
      !name ||
      !Number.isFinite(caloriesPer100g) ||
      !Number.isFinite(proteinPer100g) ||
      !Number.isFinite(carbsPer100g) ||
      !Number.isFinite(fatPer100g)
    ) {
      return;
    }

    const food: FoodDatabaseItem = {
      id: crypto.randomUUID(),
      name,
      caloriesPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      createdAt: Date.now()
    };

    setFoods((currentFoods) => [food, ...currentFoods]);
    setSelectedFoodId(food.id);
    setFoodForm(emptyFoodForm);
  }

  function handleDeleteFood(id: string) {
    setFoods((currentFoods) => currentFoods.filter((food) => food.id !== id));

    if (selectedFoodId === id) {
      setSelectedFoodId("");
    }
  }

  function handleLogSelectedFood(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const food = foods.find((item) => item.id === selectedFoodId);
    const grams = Number(logGrams);

    if (!food || !Number.isFinite(grams) || grams <= 0) {
      return;
    }

    const multiplier = grams / 100;
    const logItem: NutritionLogItem = {
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

    setLogs((currentLogs) => [logItem, ...currentLogs]);
  }

  function handleDelete(id: string) {
    setLogs((currentLogs) => currentLogs.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <CalorieSummaryCard calorieGoal={goal} totalConsumed={totalConsumed} />

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          {MACRO_BOARDS.map((board) => {
            const amount = macroTotals[board.key];

            return (
              <section
                key={board.key}
                className={`rounded-2xl border border-white/10 bg-gradient-to-b ${board.colorClass} p-5 shadow-sm`}
              >
                <p className="text-sm font-medium text-muted-foreground">{board.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold text-foreground">{amount.toFixed(0)} g</p>
                    <p className="mt-1 text-sm text-muted-foreground">{board.subtitle}</p>
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    {(amount * CALORIES_PER_GRAM[board.key]).toFixed(0)} kcal
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-white/10 bg-card/80 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Food Database</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save foods with calories and macros per 100g.
            </p>
          </div>

          <form onSubmit={handleCreateFood} className="grid gap-3">
            <input
              value={foodForm.name}
              onChange={(event) => {
                handleFoodFormChange("name", event.target.value);
              }}
              placeholder="Food name"
              className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={foodForm.caloriesPer100g}
                onChange={(event) => {
                  handleFoodFormChange("caloriesPer100g", event.target.value);
                }}
                type="number"
                min={0}
                placeholder="Calories"
                className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
                required
              />
              <input
                value={foodForm.proteinPer100g}
                onChange={(event) => {
                  handleFoodFormChange("proteinPer100g", event.target.value);
                }}
                type="number"
                min={0}
                step="0.1"
                placeholder="Protein"
                className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
                required
              />
              <input
                value={foodForm.carbsPer100g}
                onChange={(event) => {
                  handleFoodFormChange("carbsPer100g", event.target.value);
                }}
                type="number"
                min={0}
                step="0.1"
                placeholder="Carbs"
                className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
                required
              />
              <input
                value={foodForm.fatPer100g}
                onChange={(event) => {
                  handleFoodFormChange("fatPer100g", event.target.value);
                }}
                type="number"
                min={0}
                step="0.1"
                placeholder="Fat"
                className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
                required
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Save Food
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {foods.length ? (
              foods.map((food) => (
                <article
                  key={food.id}
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{food.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {food.caloriesPer100g} kcal per 100g
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteFood(food.id);
                      }}
                      className="rounded-md px-2 py-1 text-sm text-destructive hover:bg-white/5"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <span>Protein {food.proteinPer100g}g</span>
                    <span>Carbs {food.carbsPer100g}g</span>
                    <span>Fat {food.fatPer100g}g</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                No saved foods yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card/80 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Log Food</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a saved food and enter grams to add it to today.
            </p>
          </div>

          <form
            onSubmit={handleLogSelectedFood}
            className="grid gap-3 sm:grid-cols-[1fr_120px_auto]"
          >
            <select
              value={selectedFoodId}
              onChange={(event) => {
                setSelectedFoodId(event.target.value);
              }}
              className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
              disabled={!foods.length}
            >
              <option value="">Select food</option>
              {foods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                </option>
              ))}
            </select>
            <input
              value={logGrams}
              onChange={(event) => {
                setLogGrams(event.target.value);
              }}
              type="number"
              min={1}
              placeholder="Grams"
              className="h-11 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-primary/70"
            />
            <button
              type="submit"
              className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={!foods.length}
            >
              Add to Log
            </button>
          </form>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Goal</label>
          <input
            type="number"
            value={goal}
            onChange={(event) => {
              setGoal(Number(event.target.value || 0));
            }}
            className="w-24 rounded-md border bg-input px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium">Today&apos;s Log</h3>
        <FoodLogList items={logs} onDelete={handleDelete} />
      </div>
    </div>
  );
}
