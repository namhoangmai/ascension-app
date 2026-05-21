"use client";

import React, { useEffect, useMemo, useState } from "react";
import CalorieSummaryCard from "@/components/nutrition/calorie-summary-card";
import AddFoodModal from "@/components/nutrition/add-food-modal";
import FoodLogList from "@/components/nutrition/food-log-list";
import type { NutritionLogItem } from "@/types/nutrition";

const STORAGE_KEY = "nutrition.foodLog.v1";

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

export default function NutritionPage() {
  const [logs, setLogs] = useState<NutritionLogItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState<number>(2400);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) {
        setLogs(parsed.filter(isNutritionLogItem));
      }
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  const totalConsumed = useMemo(() => logs.reduce((sum, item) => sum + item.calories, 0), [logs]);

  function handleAdd(item: NutritionLogItem) {
    setLogs((currentLogs) => [item, ...currentLogs]);
  }

  function handleDelete(id: string) {
    setLogs((currentLogs) => currentLogs.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <CalorieSummaryCard calorieGoal={goal} totalConsumed={totalConsumed} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsOpen(true);
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Add Food
          </button>
          <div className="ml-2 flex items-center gap-2">
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
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium">Today&apos;s Log</h3>
        <FoodLogList items={logs} onDelete={handleDelete} />
      </div>

      <AddFoodModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        onAdd={handleAdd}
      />
    </div>
  );
}
