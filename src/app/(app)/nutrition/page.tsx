"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { type Route } from "next";
import { useEffect, useMemo, useState } from "react";

import FoodLogList from "@/components/nutrition/food-log-list";
import {
  DEFAULT_MACRO_GOALS,
  FOOD_LOG_STORAGE_KEY,
  NUTRITION_GOALS_STORAGE_KEY,
  getDateKey,
  getCaloriesFromMacroGoals,
  getItemCalories,
  isNutritionMacroGoals,
  isNutritionLogItem
} from "@/features/nutrition/client-store";
import type { NutritionLogItem, NutritionMacroGoals } from "@/types/nutrition";

type MacroKey = keyof NutritionMacroGoals;

const MACRO_CIRCLES: { key: MacroKey; label: string; color: string }[] = [
  { key: "carbs", label: "Carbs", color: "#34d399" },
  { key: "protein", label: "Protein", color: "#38bdf8" },
  { key: "fat", label: "Fat", color: "#fbbf24" }
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
  const background = `conic-gradient(${color} ${progressDegrees}deg, rgba(255,255,255,0.1) 0deg)`;

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

  useEffect(() => {
    setLogsByDate(getLogsByDate());
    setMacroGoals(getStoredMacroGoals());
  }, []);

  const logs = useMemo(() => logsByDate[selectedDate] ?? [], [logsByDate, selectedDate]);

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
        <label className="inline-flex h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm">
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

      <section className="rounded-2xl border border-white/10 bg-card/90 p-5 shadow-xl shadow-black/20">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Calories you can eat today</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal">
            {Math.round(caloriesLeft)} kcal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {Math.round(totalConsumed)} eaten of {Math.round(calorieGoal)} kcal goal
          </p>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
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

        <div className="mt-6 rounded-xl border border-white/10 bg-background/60 p-4">
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
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-center text-sm outline-none focus:border-primary/70"
                  aria-label={`${macro.label} goal grams`}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <Link
          href={logFoodHref}
          className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Log food"
        >
          <Plus className="size-8" aria-hidden="true" />
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Food logged</h2>
        <FoodLogList items={logs} onDelete={handleDelete} />
      </section>
    </div>
  );
}
