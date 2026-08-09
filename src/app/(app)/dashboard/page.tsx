import { Activity, Dumbbell, Sparkles, Utensils } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { getRequiredCompletedProfile } from "@/features/profile/server";
import {
  displayNameForProfile,
  fitnessGoalLabels,
  trainingExperienceLabels
} from "@/features/profile/types";

export default async function DashboardPage() {
  const profile = await getRequiredCompletedProfile();
  const displayName = displayNameForProfile(profile);
  const firstName = profile.firstName ?? displayName.split(" ")[0] ?? "athlete";
  const goal = profile.mainFitnessGoal ? fitnessGoalLabels[profile.mainFitnessGoal] : "your goal";
  const experience = profile.trainingExperience
    ? trainingExperienceLabels[profile.trainingExperience].toLowerCase()
    : "current";
  const trainingDays = String(profile.trainingFrequency ?? 0);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`Welcome back, ${firstName}`}
        title="Built for your next training decision"
        description={`Your dashboard is tuned for ${goal.toLowerCase()}, ${trainingDays} training days per week, and your ${experience} training history.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={Dumbbell}
          title="Strength tracking"
          description={`Keep sessions aligned with your ${goal.toLowerCase()} target and preferred weekly rhythm.`}
          href="/strength"
        />
        <FeatureCard
          icon={Utensils}
          title="Macros"
          description={`Use your current ${profile.weightKg?.toString() ?? "--"} kg baseline when planning intake.`}
          href="/nutrition"
        />
        <FeatureCard
          icon={Activity}
          title="Body progress"
          description={`Track changes toward ${profile.targetWeightKg ? `${profile.targetWeightKg.toString()} kg` : "your next milestone"}.`}
          href="/body"
        />
        <FeatureCard
          icon={Sparkles}
          title="AI-ready"
          description={`Profile context is ready for coaching across strength, macros, body progress, and recovery.`}
          href="/ai-coach"
        />
      </div>
    </div>
  );
}
