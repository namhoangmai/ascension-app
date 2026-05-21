"use client";

import { type SyntheticEvent, useState } from "react";

import type { NutritionLogItem } from "@/types/nutrition";

interface FoodForm {
  name: string;
  calories: number | "";
  protein?: number | "";
  carbs?: number | "";
  fat?: number | "";
  quantity: number | "";
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: NutritionLogItem) => void;
}

export function AddFoodModal({ isOpen, onClose, onAdd }: Props) {
  const [form, setForm] = useState<FoodForm>({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    quantity: ""
  });

  function update<K extends keyof FoodForm>(k: K, v: FoodForm[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function submit(e?: SyntheticEvent) {
    e?.preventDefault();
    if (!form.name || form.calories === "") return;

    const item: NutritionLogItem = {
      id: String(Date.now()),
      name: form.name,
      calories: form.calories,
      ...(form.protein === "" || form.protein === undefined ? {} : { protein: form.protein }),
      ...(form.carbs === "" || form.carbs === undefined ? {} : { carbs: form.carbs }),
      ...(form.fat === "" || form.fat === undefined ? {} : { fat: form.fat }),
      quantity: form.quantity === "" ? 0 : form.quantity,
      createdAt: Date.now()
    };

    onAdd(item);
    setForm({ name: "", calories: "", protein: "", carbs: "", fat: "", quantity: "" });
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close add food modal"
      />
      <form
        onSubmit={submit}
        className="relative w-full rounded-t-2xl bg-background p-6 shadow-2xl md:w-[540px] md:rounded-2xl"
      >
        <h4 className="text-lg font-semibold">Add Food</h4>
        <div className="mt-4 grid gap-3">
          <input
            value={form.name}
            onChange={(event) => {
              update("name", event.target.value);
            }}
            placeholder="Food name (e.g., Chicken Breast)"
            className="w-full rounded-md border bg-input px-3 py-2 text-sm"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.calories}
              onChange={(event) => {
                update("calories", event.target.value === "" ? "" : Number(event.target.value));
              }}
              type="number"
              min={0}
              placeholder="Calories (kcal)"
              className="rounded-md border bg-input px-3 py-2 text-sm"
              required
            />
            <input
              value={form.quantity}
              onChange={(event) => {
                update("quantity", event.target.value === "" ? "" : Number(event.target.value));
              }}
              type="number"
              min={0}
              placeholder="Quantity (g)"
              className="rounded-md border bg-input px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              value={form.protein}
              onChange={(event) => {
                update("protein", event.target.value === "" ? "" : Number(event.target.value));
              }}
              type="number"
              min={0}
              placeholder="Protein (g)"
              className="rounded-md border bg-input px-3 py-2 text-sm"
            />
            <input
              value={form.carbs}
              onChange={(event) => {
                update("carbs", event.target.value === "" ? "" : Number(event.target.value));
              }}
              type="number"
              min={0}
              placeholder="Carbs (g)"
              className="rounded-md border bg-input px-3 py-2 text-sm"
            />
            <input
              value={form.fat}
              onChange={(event) => {
                update("fat", event.target.value === "" ? "" : Number(event.target.value));
              }}
              type="number"
              min={0}
              placeholder="Fat (g)"
              className="rounded-md border bg-input px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddFoodModal;
