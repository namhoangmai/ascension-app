"use client";

import FoodLogItem from "./food-log-item";
import type { NutritionLogItem } from "@/types/nutrition";

interface Props {
  items: NutritionLogItem[];
  onDelete: (id: string) => void;
}

export function FoodLogList({ items, onDelete }: Props) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">No foods logged today.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FoodLogItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default FoodLogList;
