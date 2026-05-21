"use client";

import React from "react";

interface Props {
  calorieGoal: number;
  totalConsumed: number;
}

export function CalorieSummaryCard({ calorieGoal, totalConsumed }: Props) {
  const remaining = Math.max(calorieGoal - totalConsumed, 0);

  return (
    <section className="from-white/3 rounded-2xl border border-white/10 bg-gradient-to-b to-transparent p-6 shadow-md">
      <h3 className="text-sm font-medium text-muted-foreground">Calories Left Today</h3>
      <div className="mt-3 flex items-baseline gap-4">
        <div>
          <p className="text-3xl font-semibold text-foreground">{remaining} kcal</p>
          <p className="text-sm text-muted-foreground">
            {remaining === 0 ? "Goal reached" : "left"}
          </p>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          <div>
            Goal: <span className="font-medium text-card-foreground">{calorieGoal} kcal</span>
          </div>
          <div className="mt-1">
            Consumed: <span className="font-medium text-card-foreground">{totalConsumed} kcal</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CalorieSummaryCard;
