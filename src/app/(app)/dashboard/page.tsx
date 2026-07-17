import { Activity, Dumbbell, Sparkles, Utensils } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Foundation"
        title="Built for fast gym logging"
        description="Ascension fitness platform."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={Dumbbell}
          title="Strength tracking"
          description="Program, workout day, exercise, session, and set models are ready for low-friction logging."
          href="/strength"
        />
        <FeatureCard
          icon={Utensils}
          title="Macros"
          description="Food, logs, saved meals, and nutrition goals are normalized around accurate gram-based tracking."
          href="/nutrition"
        />
        <FeatureCard
          icon={Activity}
          title="Body progress"
          description="Weight, measurements, and private photo storage references are included in the schema."
          href="/body"
        />
        <FeatureCard
          icon={Sparkles}
          title="AI-ready"
          description="The route plan leaves a clean boundary for meal suggestions once nutrition data exists."
          href="/ai-coach"
        />
      </div>
    </div>
  );
}
