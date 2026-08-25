"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Utensils } from "lucide-react";

import {
  DEFAULT_MACRO_GOALS,
  FOOD_LOG_STORAGE_KEY,
  NUTRITION_GOALS_STORAGE_KEY,
  getCaloriesFromMacroGoals,
  getDateKey,
  getItemCalories,
  isNutritionLogItem,
  isNutritionMacroGoals
} from "@/features/nutrition/client-store";
import type { NutritionLogItem, NutritionMacroGoals } from "@/types/nutrition";

function readTodayLogs(): NutritionLogItem[] {
  try {
    const raw = localStorage.getItem(FOOD_LOG_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    const entries = (parsed as Record<string, unknown>)[getDateKey(new Date())];

    return Array.isArray(entries) ? entries.filter(isNutritionLogItem) : [];
  } catch {
    return [];
  }
}

function readMacroGoals(): NutritionMacroGoals {
  try {
    const raw = localStorage.getItem(NUTRITION_GOALS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return isNutritionMacroGoals(parsed) ? parsed : DEFAULT_MACRO_GOALS;
  } catch {
    return DEFAULT_MACRO_GOALS;
  }
}

export function NutritionSnapshot() {
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [goals, setGoals] = useState<NutritionMacroGoals>(DEFAULT_MACRO_GOALS);

  useEffect(() => {
    setLogs(readTodayLogs());
    setGoals(readMacroGoals());
  }, []);

  const consumed = Math.round(logs.reduce((sum, item) => sum + getItemCalories(item), 0));
  const goal = Math.round(getCaloriesFromMacroGoals(goals));
  const remaining = Math.max(goal - consumed, 0);
  const percentage = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-card/80 p-5 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-primary/12 grid size-9 place-items-center rounded-lg text-primary">
            <Utensils className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold text-card-foreground">Today&apos;s fuel</h2>
        </div>
        <Link href="/nutrition" className="text-xs font-medium text-primary hover:underline">
          Log food
        </Link>
      </div>

      <p className="mt-4 text-2xl font-semibold text-card-foreground">{remaining} kcal left</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {consumed} eaten of {goal} kcal goal
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${String(percentage)}%` }}
        />
      </div>
    </section>
  );
}
