"use client";

import type { NutritionLogItem } from "@/types/nutrition";

interface Props {
  item: NutritionLogItem;
  onDelete: (id: string) => void;
}

export function FoodLogItem({ item, onDelete }: Props) {
  return (
    <div className="border-white/6 flex items-start justify-between rounded-md border p-3">
      <div>
        <div className="flex items-baseline gap-3">
          <h4 className="font-medium">{item.name}</h4>
          <span className="text-sm text-muted-foreground">
            {item.quantity ? `${String(item.quantity)} g` : null}
          </span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          <div>{item.calories} kcal</div>
          {item.protein !== undefined && <div>Protein: {item.protein} g</div>}
          {item.carbs !== undefined && <div>Carbs: {item.carbs} g</div>}
          {item.fat !== undefined && <div>Fat: {item.fat} g</div>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm text-muted-foreground">
          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <button
          onClick={() => {
            onDelete(item.id);
          }}
          className="text-sm text-destructive"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default FoodLogItem;
