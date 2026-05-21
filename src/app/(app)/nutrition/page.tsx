import { Utensils } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function NutritionPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Phase 6"
        title="Calories and macros"
        description="Daily macro targets, food logging, OpenFoodFacts integration, saved meals, barcode scanning, and AI meal suggestions will build from this boundary."
      />
      <FeatureCard
        icon={Utensils}
        title="Gram-based food model"
        description="Foods store values per 100g, while logs snapshot calculated calories, protein, carbs, and fats for history-safe tracking."
      />
    </div>
  );
}
