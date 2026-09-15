import Link from "next/link";
import { Bot, Dumbbell, Flame, Scale, Target, UserCheck, Utensils } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/shared/feature-card";
import { LastWorkoutPanel, type WorkoutSummary } from "@/components/dashboard/last-workout-panel";
import { NutritionSnapshot } from "@/components/dashboard/nutrition-snapshot";
import { StatTile } from "@/components/dashboard/stat-tile";
import { getRequiredCompletedProfile } from "@/features/profile/server";
import {
  displayNameForProfile,
  fitnessGoalLabels,
  profileCompletionPercentage,
  trainingExperienceLabels
} from "@/features/profile/types";
import { listStrengthWorkouts } from "@/features/strength/server";
import type { StrengthWorkout } from "@/types/strength";

const MS_PER_DAY = 86_400_000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(dateKey: string) {
  const today = Date.parse(`${todayKey()}T00:00:00.000Z`);
  const target = Date.parse(`${dateKey}T00:00:00.000Z`);

  return Math.round((today - target) / MS_PER_DAY);
}

function relativeDayLabel(dateKey: string) {
  const diff = daysAgo(dateKey);

  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${String(diff)} days ago`;

  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function summarizeWorkout(workout: StrengthWorkout): WorkoutSummary {
  let completedSets = 0;
  let totalVolume = 0;

  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      completedSets += 1;
      if (set.weight !== null && set.reps !== null) {
        totalVolume += set.weight * set.reps;
      }
    }
  }

  const trimmedName = workout.name?.trim();

  return {
    name: trimmedName === undefined || trimmedName === "" ? "Workout" : trimmedName,
    relativeDate: relativeDayLabel(workout.date),
    exerciseCount: workout.exercises.length,
    completedSets,
    totalVolume: Math.round(totalVolume),
    topExercise: workout.exercises[0]?.name ?? null
  };
}

function numberFromDecimal(value: Prisma.Decimal | null) {
  if (value === null) return null;
  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? parsed : null;
}

function weightSubLabel(current: number | null, target: number | null) {
  if (current === null) {
    return "Complete your profile to track this";
  }

  if (target === null) {
    return "Set a target weight in your profile";
  }

  const delta = target - current;

  if (Math.abs(delta) < 0.05) {
    return "At goal weight";
  }

  return `${Math.abs(delta).toFixed(1)} kg ${delta > 0 ? "to gain" : "to lose"}`;
}

export default async function DashboardPage() {
  const [profile, workouts] = await Promise.all([
    getRequiredCompletedProfile(),
    listStrengthWorkouts()
  ]);

  const displayName = displayNameForProfile(profile);
  const firstName = profile.firstName ?? displayName.split(" ")[0] ?? "athlete";
  const goalLabel = profile.mainFitnessGoal
    ? fitnessGoalLabels[profile.mainFitnessGoal]
    : "Set a goal";
  const experienceLabel = profile.trainingExperience
    ? trainingExperienceLabels[profile.trainingExperience]
    : "Not set";
  const trainingTarget = profile.trainingFrequency ?? 0;

  const sessionsThisWeek = workouts.filter((workout) => {
    const diff = daysAgo(workout.date);
    return diff >= 0 && diff < 7;
  }).length;

  const lastWorkoutSummary = workouts[0] ? summarizeWorkout(workouts[0]) : null;

  const currentWeight = numberFromDecimal(profile.weightKg);
  const targetWeight = numberFromDecimal(profile.targetWeightKg);
  const weightValue = currentWeight !== null ? `${String(currentWeight)} kg` : "Add weight";

  const completion = profileCompletionPercentage(profile);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card via-card/70 to-background p-6 shadow-xl shadow-black/30 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-sm font-medium text-primary">Welcome back</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {firstName}, ready to train?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Your dashboard is tuned for {goalLabel.toLowerCase()}, {String(trainingTarget)} training
            days a week, and your {experienceLabel.toLowerCase()} training history.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/strength">Log a workout</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/nutrition">Log food</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Flame}
          label="This week"
          value={
            trainingTarget > 0
              ? `${String(sessionsThisWeek)} / ${String(trainingTarget)}`
              : String(sessionsThisWeek)
          }
          sub={trainingTarget > 0 ? "sessions vs. your weekly target" : "sessions logged this week"}
          progress={
            trainingTarget > 0
              ? Math.min((sessionsThisWeek / trainingTarget) * 100, 100)
              : undefined
          }
        />
        <StatTile
          icon={Scale}
          label="Weight"
          value={weightValue}
          sub={weightSubLabel(currentWeight, targetWeight)}
          href="/profile"
        />
        <StatTile
          icon={Target}
          label="Focus"
          value={goalLabel}
          sub={`${experienceLabel} · training experience`}
        />
        <StatTile
          icon={UserCheck}
          label="Profile"
          value={`${String(completion)}% complete`}
          sub={completion < 100 ? "Finish setup for sharper coaching" : "All set"}
          progress={completion}
          href="/profile"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <LastWorkoutPanel summary={lastWorkoutSummary} />
        <NutritionSnapshot />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Jump back in</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={Dumbbell}
            title="Strength tracking"
            description={`Log sets aligned with your ${goalLabel.toLowerCase()} target and weekly rhythm.`}
            href="/strength"
          />
          <FeatureCard
            icon={Utensils}
            title="Nutrition"
            description="Track meals and macros against your daily calorie goal."
            href="/nutrition"
          />
          <FeatureCard
            icon={Scale}
            title="Body progress"
            description={
              targetWeight !== null
                ? `Track changes toward ${String(targetWeight)} kg.`
                : "Log check-ins to watch your trend over time."
            }
            href="/body"
          />
          <FeatureCard
            icon={Bot}
            title="AI Coach"
            description="Get coaching grounded in your strength, macros, and recovery data."
            href="/ai-coach"
          />
        </div>
      </div>
    </div>
  );
}
